import { lookup as dnsLookup } from 'node:dns/promises';
import {
  request as httpRequest,
  type IncomingMessage,
  type OutgoingHttpHeaders,
} from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP, SocketAddress, type LookupFunction } from 'node:net';
import { domainToASCII } from 'node:url';

const MAX_DNS_ANSWERS = 16;
const metadataAddresses = new Set(['169.254.169.254', '100.100.100.200']);
const metadataHostnames = new Set(['metadata.google.internal']);
const forbiddenRequestHeaders = new Set([
  'connection',
  'content-length',
  'forwarded',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-port',
  'x-forwarded-proto',
]);

const blockedIpv4 = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedIpv4.addSubnet(network, prefix, 'ipv4');
}

const globalIpv6 = new BlockList();
globalIpv6.addSubnet('2000::', 3, 'ipv6');

const blockedIpv6 = new BlockList();
for (const [network, prefix] of [
  ['::', 96],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
] as const) {
  blockedIpv6.addSubnet(network, prefix, 'ipv6');
}

export interface DnsAnswer {
  address: string;
  family: 4 | 6;
}

export type DnsResolver = (hostname: string) => Promise<readonly DnsAnswer[]>;

export interface ApprovedUpstreamAuthority {
  protocol: 'http:' | 'https:';
  hostname: string;
  port: number;
  allowIpLiteral?: boolean;
  allowedNonPublicAddresses?: readonly string[];
}

export interface ResolvedRequestTarget {
  readonly protocol: 'http:' | 'https:';
  readonly hostname: string;
  readonly port: number;
  readonly addresses: readonly DnsAnswer[];
  readonly pinnedAddress: string;
  readonly family: 4 | 6;
}

export interface PinnedUpstreamRequestOptions {
  method?: 'GET' | 'HEAD';
  headers?: OutgoingHttpHeaders;
  timeoutMs?: number;
}

export class UpstreamNetworkPolicyError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'UpstreamNetworkPolicyError';
  }
}

const issuedTargets = new WeakSet<object>();

function policyError(code: string, message: string): never {
  throw new UpstreamNetworkPolicyError(code, message);
}

function canonicalIp(address: string, expectedFamily?: 4 | 6): DnsAnswer {
  const family = isIP(address);
  if ((family !== 4 && family !== 6) || (expectedFamily !== undefined && family !== expectedFamily)) {
    return policyError('UPSTREAM_DNS_ADDRESS_INVALID', 'DNS returned an invalid address or address family');
  }
  try {
    const socketAddress = new SocketAddress({
      address,
      port: 0,
      family: family === 4 ? 'ipv4' : 'ipv6',
    });
    return { address: socketAddress.address, family };
  } catch {
    return policyError('UPSTREAM_DNS_ADDRESS_INVALID', 'DNS returned an invalid address');
  }
}

function normalizeHostname(value: string): string {
  if (!value || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) {
    return policyError('UPSTREAM_AUTHORITY_INVALID', 'approved upstream hostname is invalid');
  }
  const unwrapped = value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value;
  const ipFamily = isIP(unwrapped);
  if (ipFamily === 4 || ipFamily === 6) return canonicalIp(unwrapped, ipFamily).address;
  const ascii = domainToASCII(unwrapped.toLowerCase());
  const normalized = ascii.endsWith('.') ? ascii.slice(0, -1) : ascii;
  const labels = normalized.split('.');
  if (
    !normalized ||
    normalized.length > 253 ||
    !normalized.includes('.') ||
    labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  ) {
    return policyError('UPSTREAM_AUTHORITY_INVALID', 'approved upstream hostname is invalid');
  }
  return normalized;
}

function isMetadataAddress(answer: DnsAnswer): boolean {
  return (answer.family === 4 && metadataAddresses.has(answer.address)) || answer.address === 'fd00:ec2::254';
}

export function isNonPublicAddress(address: string): boolean {
  const answer = canonicalIp(address);
  if (answer.family === 4) return blockedIpv4.check(answer.address, 'ipv4');
  return !globalIpv6.check(answer.address, 'ipv6') || blockedIpv6.check(answer.address, 'ipv6');
}

const defaultResolver: DnsResolver = async (hostname) => {
  const answers = await dnsLookup(hostname, { all: true, verbatim: true });
  return answers.map((answer) => {
    if (answer.family !== 4 && answer.family !== 6) {
      return policyError('UPSTREAM_DNS_ADDRESS_INVALID', 'DNS returned an invalid address family');
    }
    return { address: answer.address, family: answer.family };
  });
};

function normalizeAuthority(authority: ApprovedUpstreamAuthority): {
  protocol: 'http:' | 'https:';
  hostname: string;
  port: number;
  allowIpLiteral: boolean;
  allowedNonPublicAddresses: Set<string>;
} {
  if (!['http:', 'https:'].includes(authority.protocol)) {
    return policyError('UPSTREAM_AUTHORITY_INVALID', 'approved upstream protocol is invalid');
  }
  if (!Number.isInteger(authority.port) || authority.port < 1 || authority.port > 65_535) {
    return policyError('UPSTREAM_AUTHORITY_INVALID', 'approved upstream port is invalid');
  }
  const allowedNonPublicAddresses = new Set<string>();
  if ((authority.allowedNonPublicAddresses?.length ?? 0) > MAX_DNS_ANSWERS) {
    return policyError('UPSTREAM_AUTHORITY_INVALID', 'approved non-public address list is too large');
  }
  for (const rawAddress of authority.allowedNonPublicAddresses ?? []) {
    const answer = canonicalIp(rawAddress);
    if (isMetadataAddress(answer)) {
      return policyError('UPSTREAM_METADATA_ADDRESS', 'cloud metadata addresses can never be approved');
    }
    allowedNonPublicAddresses.add(answer.address);
  }
  const hostname = normalizeHostname(authority.hostname);
  if (metadataHostnames.has(hostname)) {
    return policyError('UPSTREAM_METADATA_ADDRESS', 'cloud metadata hostnames can never be approved');
  }
  return {
    protocol: authority.protocol,
    hostname,
    port: authority.port,
    allowIpLiteral: authority.allowIpLiteral === true,
    allowedNonPublicAddresses,
  };
}

function requestPort(url: URL): number {
  if (url.port) return Number(url.port);
  return url.protocol === 'https:' ? 443 : 80;
}

export async function authorizeUpstreamRequest(
  input: URL | string,
  authority: ApprovedUpstreamAuthority,
  resolver: DnsResolver = defaultResolver,
): Promise<ResolvedRequestTarget> {
  let url: URL;
  try {
    url = input instanceof URL ? new URL(input.href) : new URL(input);
  } catch {
    return policyError('UPSTREAM_URL_INVALID', 'upstream request URL is invalid');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash ||
    !url.hostname
  ) {
    return policyError('UPSTREAM_URL_INVALID', 'upstream request URL contains a forbidden component');
  }

  const approved = normalizeAuthority(authority);
  const hostname = normalizeHostname(url.hostname);
  const port = requestPort(url);
  if (url.protocol !== approved.protocol || hostname !== approved.hostname || port !== approved.port) {
    return policyError('UPSTREAM_AUTHORITY_MISMATCH', 'upstream request does not match the approved authority');
  }

  const literalFamily = isIP(hostname);
  let rawAnswers: readonly DnsAnswer[];
  if (literalFamily === 4 || literalFamily === 6) {
    if (!approved.allowIpLiteral) {
      return policyError('UPSTREAM_IP_LITERAL_REVIEW', 'IP-literal upstreams require explicit approval');
    }
    rawAnswers = [{ address: hostname, family: literalFamily }];
  } else {
    try {
      rawAnswers = await resolver(hostname);
    } catch {
      return policyError('UPSTREAM_DNS_FAILURE', 'upstream DNS resolution failed');
    }
  }

  if (rawAnswers.length === 0) return policyError('UPSTREAM_DNS_EMPTY', 'upstream DNS returned no addresses');
  if (rawAnswers.length > MAX_DNS_ANSWERS) {
    return policyError('UPSTREAM_DNS_LIMIT', 'upstream DNS returned too many addresses');
  }
  const addresses: DnsAnswer[] = [];
  const seen = new Set<string>();
  for (const rawAnswer of rawAnswers) {
    const answer = canonicalIp(rawAnswer.address, rawAnswer.family);
    if (isMetadataAddress(answer)) {
      return policyError('UPSTREAM_METADATA_ADDRESS', 'cloud metadata addresses are permanently blocked');
    }
    if (isNonPublicAddress(answer.address) && !approved.allowedNonPublicAddresses.has(answer.address)) {
      return policyError('UPSTREAM_ADDRESS_BLOCKED', 'DNS returned a non-public address without exact approval');
    }
    const key = `${answer.family}:${answer.address}`;
    if (!seen.has(key)) {
      seen.add(key);
      addresses.push(answer);
    }
  }

  const pinned = addresses[0];
  if (!pinned) return policyError('UPSTREAM_DNS_EMPTY', 'upstream DNS returned no usable addresses');
  const target: ResolvedRequestTarget = Object.freeze({
    protocol: approved.protocol,
    hostname: approved.hostname,
    port: approved.port,
    addresses: Object.freeze(addresses.map((answer) => Object.freeze({ ...answer }))),
    pinnedAddress: pinned.address,
    family: pinned.family,
  });
  issuedTargets.add(target);
  return target;
}

function requireIssuedTarget(target: ResolvedRequestTarget): void {
  if (!issuedTargets.has(target)) {
    return policyError('UPSTREAM_TARGET_INVALID', 'upstream target was not issued by the request-time policy');
  }
}

export function createPinnedLookup(target: ResolvedRequestTarget): LookupFunction {
  requireIssuedTarget(target);
  return (hostname, options, callback) => {
    let normalized: string;
    try {
      normalized = normalizeHostname(hostname);
    } catch (error) {
      queueMicrotask(() => callback(error as NodeJS.ErrnoException, '', 0));
      return;
    }
    if (normalized !== target.hostname) {
      const error = new UpstreamNetworkPolicyError(
        'UPSTREAM_LOOKUP_HOST_MISMATCH',
        'transport attempted to resolve a host outside the approved authority',
      ) as NodeJS.ErrnoException;
      error.code = 'UPSTREAM_LOOKUP_HOST_MISMATCH';
      queueMicrotask(() => callback(error, '', 0));
      return;
    }
    const answer = { address: target.pinnedAddress, family: target.family };
    queueMicrotask(() => {
      if (options.all) callback(null, [answer]);
      else callback(null, answer.address, answer.family);
    });
  };
}

export function assertPinnedPeer(target: ResolvedRequestTarget, remoteAddress: string | undefined): void {
  requireIssuedTarget(target);
  if (!remoteAddress) return policyError('UPSTREAM_PEER_MISSING', 'connected upstream peer address is unavailable');
  const peer = canonicalIp(remoteAddress);
  if (peer.family !== target.family || peer.address !== target.pinnedAddress) {
    return policyError('UPSTREAM_PEER_MISMATCH', 'connected upstream peer differs from the pinned DNS result');
  }
}

function validateRequestAgainstTarget(input: URL | string, target: ResolvedRequestTarget): URL {
  requireIssuedTarget(target);
  let url: URL;
  try {
    url = input instanceof URL ? new URL(input.href) : new URL(input);
  } catch {
    return policyError('UPSTREAM_URL_INVALID', 'upstream request URL is invalid');
  }
  if (
    url.username ||
    url.password ||
    url.hash ||
    normalizeHostname(url.hostname) !== target.hostname ||
    url.protocol !== target.protocol ||
    requestPort(url) !== target.port
  ) {
    return policyError('UPSTREAM_AUTHORITY_MISMATCH', 'transport URL differs from the authorized request target');
  }
  return url;
}

export async function requestPinnedUpstream(
  input: URL | string,
  target: ResolvedRequestTarget,
  options: PinnedUpstreamRequestOptions = {},
): Promise<IncomingMessage> {
  const url = validateRequestAgainstTarget(input, target);
  const method = options.method ?? 'GET';
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!['GET', 'HEAD'].includes(method)) {
    return Promise.reject(new UpstreamNetworkPolicyError('UPSTREAM_METHOD_BLOCKED', 'upstream method is not allowed'));
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
    return Promise.reject(new UpstreamNetworkPolicyError('UPSTREAM_TIMEOUT_INVALID', 'upstream timeout is invalid'));
  }
  for (const header of Object.keys(options.headers ?? {})) {
    if (forbiddenRequestHeaders.has(header.toLowerCase())) {
      return Promise.reject(new UpstreamNetworkPolicyError('UPSTREAM_HEADER_BLOCKED', 'upstream header is controlled by the transport'));
    }
  }
  const requestFunction = target.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise<IncomingMessage>((resolve, reject) => {
    let settled = false;
    const request = requestFunction({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method,
      path: `${url.pathname}${url.search}`,
      headers: options.headers,
      agent: false,
      family: target.family,
      lookup: createPinnedLookup(target),
    });
    request.once('socket', (socket) => {
      const verifyPeer = () => {
        try {
          assertPinnedPeer(target, socket.remoteAddress);
        } catch (error) {
          request.destroy(error as Error);
        }
      };
      if (socket.connecting) socket.once('connect', verifyPeer);
      else verifyPeer();
    });
    request.once('response', (response) => {
      settled = true;
      resolve(response);
    });
    request.once('error', (error) => {
      if (!settled) reject(error);
    });
    request.setTimeout(timeoutMs, () => {
      request.destroy(new UpstreamNetworkPolicyError('UPSTREAM_TIMEOUT', 'upstream request timed out'));
    });
    request.end();
  });
}
