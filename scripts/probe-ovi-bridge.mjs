import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const port = Number(process.env.OMB_OVI_PORT);
const mapType = Number(process.env.OMB_OVI_MAP_TYPE);
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('OMB_OVI_PORT must be a valid local port');
if (!Number.isInteger(mapType) || mapType < 1) throw new Error('OMB_OVI_MAP_TYPE must be a positive integer');

const zoom = 10;
const longitude = 119.285;
const latitude = 33.18;
const scale = 2 ** zoom;
const x = Math.floor(((longitude + 180) / 360) * scale);
const latitudeRadians = latitude * Math.PI / 180;
const y = Math.floor((1 - Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI) / 2 * scale);
const requestedDates = ['2006-06-30', '2025-06-30'];

function imageHeader(bytes) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), format: 'png' };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
      const length = bytes.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length) break;
      if (marker !== undefined && [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5), format: 'jpeg' };
      }
      offset += 2 + length;
    }
  }
  throw new Error('response is not a decodable PNG or JPEG header');
}

async function decodeAndNormalize(bytes, format) {
  const directory = await mkdtemp(join(tmpdir(), 'omb-ovi-probe-'));
  const inputPath = join(directory, `tile.${format === 'jpeg' ? 'jpg' : 'png'}`);
  const outputPath = join(directory, 'normalized.png');
  try {
    await writeFile(inputPath, bytes, { mode: 0o600 });
    await execFileAsync('/usr/bin/sips', ['-s', 'format', 'png', inputPath, '--out', outputPath], { timeout: 10_000 });
    const { stdout } = await execFileAsync('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', outputPath], { timeout: 10_000 });
    const width = Number(/pixelWidth:\s*(\d+)/.exec(stdout)?.[1]);
    const height = Number(/pixelHeight:\s*(\d+)/.exec(stdout)?.[1]);
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
      throw new Error('system image decoder returned invalid dimensions');
    }
    return { width, height, normalized: await readFile(outputPath) };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const receipts = [];
for (const requestedDate of requestedDates) {
  const compactDate = requestedDate.replaceAll('-', '');
  const path = `/getomap_${mapType}_${zoom}_${x}_${y}_jpg_${compactDate}.jpg`;
  const response = await fetch(new URL(path, `http://127.0.0.1:${port}/`), { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  const body = Buffer.from(await response.arrayBuffer());
  if (!response.ok) throw new Error(`official bridge returned HTTP ${response.status}`);
  if (body.length < 100 || body.length > 5 * 1024 * 1024) throw new Error('official bridge returned an invalid tile size');
  const header = imageHeader(body);
  const decoded = await decodeAndNormalize(body, header.format);
  if (decoded.width !== header.width || decoded.height !== header.height) throw new Error('decoded dimensions do not match image header');
  receipts.push({
    requestedDate,
    statusCategory: 'image-ok',
    dimensions: { width: decoded.width, height: decoded.height, format: header.format },
    sha256: createHash('sha256').update(decoded.normalized).digest('hex'),
    observedAt: new Date().toISOString(),
  });
}

if (receipts[0]?.sha256 === receipts[1]?.sha256) throw new Error('two requested dates returned identical tile bytes');
process.stdout.write(`${JSON.stringify(receipts, null, 2)}\n`);
