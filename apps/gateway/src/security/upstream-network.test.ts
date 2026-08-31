import { createServer } from 'node:http';
import { expect, it, vi } from 'vitest';
import {
  assertPinnedPeer,
  authorizeUpstreamRequest,
  createPinnedLookup,
  isNonPublicAddress,
  requestPinnedUpstream,
  type DnsResolver,
} from './upstream-network.js';

const publicAuthority = {
  protocol: 'https:' as const,
  hostname: 'tiles.example.invalid',
  port: 443,
};

function resolver(...addresses: Array<{ address: string; family: 4 | 6 }>): DnsResolver {
  return vi.fn(async () => addresses);
}

it.each([
  '0.0.0.0',
  '10.2.3.4',
  '100.64.0.1',
  '127.0.0.1',
  '169.254.169.254',
  '172.31.255.255',
  '192.168.1.1',
  '198.18.0.1',
  '224.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
  '64:ff9b::a00:1',
  '2001:db8::1',
  '2002:7f00:1::',
  'fc00::1',
  'fe80::1',
  'ff02::1',
  '3fff::1',
])('classifies non-public or translation-sensitive address %s as blocked', (address) => {
  expect(isNonPublicAddress(address)).toBe(true);
});

it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('allows globally routable address %s', (address) => {
  expect(isNonPublicAddress(address)).toBe(false);
});

it('authorizes every public DNS answer and pins a single immutable address snapshot', async () => {
  const dns = resolver(
    { address: '203.0.114.9', family: 4 },
    { address: '2606:4700:4700::1111', family: 6 },
  );
  const target = await authorizeUpstreamRequest('https://tiles.example.invalid/z/x/y.png', publicAuthority, dns);

  expect(dns).toHaveBeenCalledOnce();
  expect(target).toEqual({
    protocol: 'https:',
    hostname: 'tiles.example.invalid',
    port: 443,
    addresses: [
      { address: '203.0.114.9', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 },
    ],
    pinnedAddress: '203.0.114.9',
    family: 4,
  });
  expect(Object.isFrozen(target)).toBe(true);
  expect(Object.isFrozen(target.addresses)).toBe(true);
});

it('fails closed when any DNS answer is private, metadata, malformed, empty, or excessive', async () => {
  await expect(
    authorizeUpstreamRequest(
      'https://tiles.example.invalid/tile',
      publicAuthority,
      resolver({ address: '203.0.114.9', family: 4 }, { address: '127.0.0.1', family: 4 }),
    ),
  ).rejects.toMatchObject({ code: 'UPSTREAM_ADDRESS_BLOCKED' });
  await expect(
    authorizeUpstreamRequest(
      'https://tiles.example.invalid/tile',
      publicAuthority,
      resolver({ address: '169.254.169.254', family: 4 }),
    ),
  ).rejects.toMatchObject({ code: 'UPSTREAM_METADATA_ADDRESS' });
  await expect(
    authorizeUpstreamRequest('https://metadata.google.internal/tile', {
      protocol: 'https:',
      hostname: 'metadata.google.internal',
      port: 443,
    }, resolver({ address: '8.8.8.8', family: 4 })),
  ).rejects.toMatchObject({ code: 'UPSTREAM_METADATA_ADDRESS' });
  await expect(
    authorizeUpstreamRequest('https://tiles.example.invalid/tile', {
      ...publicAuthority,
      allowedNonPublicAddresses: ['fd00:ec2::254'],
    }, resolver({ address: 'fd00:ec2::254', family: 6 })),
  ).rejects.toMatchObject({ code: 'UPSTREAM_METADATA_ADDRESS' });
  await expect(
    authorizeUpstreamRequest(
      'https://tiles.example.invalid/tile',
      publicAuthority,
      resolver({ address: 'not-an-ip', family: 4 }),
    ),
  ).rejects.toMatchObject({ code: 'UPSTREAM_DNS_ADDRESS_INVALID' });
  await expect(
    authorizeUpstreamRequest('https://tiles.example.invalid/tile', publicAuthority, resolver()),
  ).rejects.toMatchObject({ code: 'UPSTREAM_DNS_EMPTY' });
  await expect(
    authorizeUpstreamRequest(
      'https://tiles.example.invalid/tile',
      publicAuthority,
      resolver(...Array.from({ length: 17 }, (_, index) => ({ address: `203.0.114.${index + 1}`, family: 4 as const }))),
    ),
  ).rejects.toMatchObject({ code: 'UPSTREAM_DNS_LIMIT' });
});

it('permits only an exact, explicit non-public exception and never permits metadata', async () => {
  const target = await authorizeUpstreamRequest(
    'http://tiles.corp.internal:8080/tile',
    {
      protocol: 'http:',
      hostname: 'tiles.corp.internal',
      port: 8080,
      allowedNonPublicAddresses: ['10.20.30.40'],
    },
    resolver({ address: '10.20.30.40', family: 4 }),
  );
  expect(target.pinnedAddress).toBe('10.20.30.40');

  await expect(
    authorizeUpstreamRequest(
      'http://tiles.corp.internal:8080/tile',
      {
        protocol: 'http:',
        hostname: 'tiles.corp.internal',
        port: 8080,
        allowedNonPublicAddresses: ['10.20.30.40'],
      },
      resolver({ address: '10.20.30.41', family: 4 }),
    ),
  ).rejects.toMatchObject({ code: 'UPSTREAM_ADDRESS_BLOCKED' });

  await expect(
    authorizeUpstreamRequest('https://tiles.example.invalid/tile', {
      ...publicAuthority,
      allowedNonPublicAddresses: ['169.254.169.254'],
    }, resolver({ address: '169.254.169.254', family: 4 })),
  ).rejects.toMatchObject({ code: 'UPSTREAM_METADATA_ADDRESS' });
});

it.each([
  ['http://tiles.example.invalid/tile', 'UPSTREAM_AUTHORITY_MISMATCH'],
  ['https://other.example.invalid/tile', 'UPSTREAM_AUTHORITY_MISMATCH'],
  ['https://tiles.example.invalid:444/tile', 'UPSTREAM_AUTHORITY_MISMATCH'],
  ['https://user:secret@tiles.example.invalid/tile', 'UPSTREAM_URL_INVALID'],
  ['https://tiles.example.invalid/tile#fragment', 'UPSTREAM_URL_INVALID'],
])('rejects a request or redirect outside the exact approved authority: %s', async (url, code) => {
  const dns = resolver({ address: '203.0.114.9', family: 4 });
  await expect(authorizeUpstreamRequest(url, publicAuthority, dns)).rejects.toMatchObject({ code });
  expect(dns).not.toHaveBeenCalled();
});

it('does not resolve an IP literal unless the exact authority approved it', async () => {
  const dns = resolver({ address: '8.8.8.8', family: 4 });
  await expect(
    authorizeUpstreamRequest(
      'https://8.8.8.8/tile',
      { protocol: 'https:', hostname: '8.8.8.8', port: 443 },
      dns,
    ),
  ).rejects.toMatchObject({ code: 'UPSTREAM_IP_LITERAL_REVIEW' });
  expect(dns).not.toHaveBeenCalled();

  await expect(
    authorizeUpstreamRequest(
      'https://8.8.8.8/tile',
      { protocol: 'https:', hostname: '8.8.8.8', port: 443, allowIpLiteral: true },
      dns,
    ),
  ).resolves.toMatchObject({ pinnedAddress: '8.8.8.8', family: 4 });
  expect(dns).not.toHaveBeenCalled();
});

it('supplies only the pinned address to the transport and never re-runs DNS', async () => {
  const dns = resolver({ address: '203.0.114.9', family: 4 }, { address: '203.0.114.10', family: 4 });
  const target = await authorizeUpstreamRequest('https://tiles.example.invalid/tile', publicAuthority, dns);
  const lookup = createPinnedLookup(target);
  const result = await new Promise<{ address: string; family: number }>((resolve, reject) => {
    lookup('tiles.example.invalid', { family: 0, hints: 0, all: false }, (error, address, family) => {
      if (error) return reject(error);
      if (typeof address !== 'string' || family === undefined) return reject(new Error('unexpected lookup result'));
      resolve({ address, family });
    });
  });
  expect(result).toEqual({ address: '203.0.114.9', family: 4 });
  expect(dns).toHaveBeenCalledOnce();
});

it('rejects transport host drift and connected peer drift after DNS authorization', async () => {
  const target = await authorizeUpstreamRequest(
    'https://tiles.example.invalid/tile',
    publicAuthority,
    resolver({ address: '203.0.114.9', family: 4 }),
  );
  const lookup = createPinnedLookup(target);
  await expect(
    new Promise((resolve, reject) => {
      lookup('attacker.example.invalid', { family: 0, hints: 0, all: false }, (error, address) => {
        if (error) reject(error);
        else resolve(address);
      });
    }),
  ).rejects.toMatchObject({ code: 'UPSTREAM_LOOKUP_HOST_MISMATCH' });
  expect(() => assertPinnedPeer(target, '203.0.114.10')).toThrow(
    expect.objectContaining({ code: 'UPSTREAM_PEER_MISMATCH' }),
  );
  expect(() => assertPinnedPeer(target, undefined)).toThrow(
    expect.objectContaining({ code: 'UPSTREAM_PEER_MISSING' }),
  );
  expect(() => assertPinnedPeer(target, '203.0.114.9')).not.toThrow();
});

it('normalizes an absolute DNS name without widening the approved authority', async () => {
  const dns = resolver({ address: '203.0.114.9', family: 4 });
  const target = await authorizeUpstreamRequest(
    'https://tiles.example.invalid./tile',
    { ...publicAuthority, hostname: 'TILES.EXAMPLE.INVALID.' },
    dns,
  );
  expect(target.hostname).toBe('tiles.example.invalid');
  expect(dns).toHaveBeenCalledWith('tiles.example.invalid');
});

it('opens a real local fixture connection through the pinned lookup without a second DNS call', async () => {
  const server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end(request.url === '/tile?z=1' ? 'pinned-ok' : 'wrong-path');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('fixture server did not expose a port');
    const dns = vi.fn<DnsResolver>(async () => {
      if (dns.mock.calls.length > 1) return [{ address: '169.254.169.254', family: 4 }];
      return [{ address: '127.0.0.1', family: 4 }];
    });
    const authority = {
      protocol: 'http:' as const,
      hostname: 'tiles.fixture.invalid',
      port: address.port,
      allowedNonPublicAddresses: ['127.0.0.1'],
    };
    const url = `http://tiles.fixture.invalid:${address.port}/tile?z=1`;
    const target = await authorizeUpstreamRequest(url, authority, dns);
    const response = await requestPinnedUpstream(url, target, { timeoutMs: 2_000 });
    const chunks: Buffer[] = [];
    for await (const chunk of response) chunks.push(Buffer.from(chunk));

    expect(response.statusCode).toBe(200);
    expect(Buffer.concat(chunks).toString('utf8')).toBe('pinned-ok');
    expect(dns).toHaveBeenCalledOnce();
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

it('does not follow redirects inside the pinned transport', async () => {
  let requestCount = 0;
  const server = createServer((_request, response) => {
    requestCount += 1;
    response.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data' });
    response.end();
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('fixture server did not expose a port');
    const authority = {
      protocol: 'http:' as const,
      hostname: 'tiles.fixture.invalid',
      port: address.port,
      allowedNonPublicAddresses: ['127.0.0.1'],
    };
    const url = `http://tiles.fixture.invalid:${address.port}/redirect`;
    const target = await authorizeUpstreamRequest(url, authority, resolver({ address: '127.0.0.1', family: 4 }));
    const response = await requestPinnedUpstream(url, target);
    response.resume();
    await new Promise<void>((resolve) => response.once('end', resolve));

    expect(response.statusCode).toBe(302);
    expect(requestCount).toBe(1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

it('rejects caller-controlled authority and hop-by-hop headers', async () => {
  const target = await authorizeUpstreamRequest(
    'https://tiles.example.invalid/tile',
    publicAuthority,
    resolver({ address: '203.0.114.9', family: 4 }),
  );
  await expect(
    requestPinnedUpstream('https://tiles.example.invalid/tile', target, { headers: { host: 'internal.invalid' } }),
  ).rejects.toMatchObject({ code: 'UPSTREAM_HEADER_BLOCKED' });
  await expect(
    requestPinnedUpstream('https://tiles.example.invalid/tile', target, { headers: { 'proxy-authorization': 'fixture' } }),
  ).rejects.toMatchObject({ code: 'UPSTREAM_HEADER_BLOCKED' });
});

it('rejects structurally forged authorization targets', async () => {
  const forged = {
    protocol: 'https:' as const,
    hostname: 'tiles.example.invalid',
    port: 443,
    addresses: [{ address: '203.0.114.9', family: 4 as const }],
    pinnedAddress: '203.0.114.9',
    family: 4 as const,
  };
  expect(() => createPinnedLookup(forged)).toThrow(
    expect.objectContaining({ code: 'UPSTREAM_TARGET_INVALID' }),
  );
  await expect(requestPinnedUpstream('https://tiles.example.invalid/tile', forged)).rejects.toMatchObject({
    code: 'UPSTREAM_TARGET_INVALID',
  });
});
