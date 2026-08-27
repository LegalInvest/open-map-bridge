import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import test from 'node:test';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBytes.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return output;
}

function png(seed) {
  const width = 16;
  const height = 16;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let row = 0; row < height; row += 1) {
    const start = row * (1 + width * 4);
    raw[start] = 0;
    for (let column = 0; column < width; column += 1) {
      const offset = start + 1 + column * 4;
      raw.set([(column * 17 + seed) % 256, (row * 29 + seed) % 256, (column * row + seed) % 256, 255], offset);
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

test('requires four genuinely decodable dates and compares their normalized hashes', async () => {
  const requestedDates = ['2006-06-30', '2012-06-30', '2019-06-30', '2025-06-30'];
  const fixtures = new Map(requestedDates.map((date, index) => [date.replaceAll('-', ''), png(11 + index * 29)]));
  assert.ok([...fixtures.values()].every((image) => image.length > 100));
  const server = createServer((request, response) => {
    const body = [...fixtures].find(([date]) => request.url?.includes(date))?.[1];
    if (!body) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': 'image/png', 'content-length': body.length });
    response.end(body);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('fixture server did not bind a TCP port');
    const child = spawn(process.execPath, [resolve('scripts/probe-ovi-bridge.mjs')], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OMB_OVI_PORT: String(address.port),
        OMB_OVI_MAP_TYPE: '200',
        OMB_PROBE_LONGITUDE: '119.285',
        OMB_PROBE_LATITUDE: '33.18',
        OMB_PROBE_DATES: requestedDates.join(','),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (data) => { stdout += data; });
    child.stderr.setEncoding('utf8').on('data', (data) => { stderr += data; });
    const [code] = await once(child, 'close');
    assert.equal(code, 0, stderr);
    const receipts = JSON.parse(stdout);
    assert.equal(receipts.length, 4);
    assert.deepEqual(receipts.map((receipt) => receipt.requestedDate), requestedDates);
    assert.ok(receipts.every((receipt) => receipt.dimensions.width === 16 && receipt.dimensions.height === 16));
    assert.equal(new Set(receipts.map((receipt) => receipt.sha256)).size, 4);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
