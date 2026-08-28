import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const fixture = {
  file: resolve('fixtures/local/tencent-5.ovmap'),
  sha256: 'a3de20dd1830e81697950bc13d93dba0d67dfc7d2f91651a86c79f04db750128',
  url: 'https://raw.githubusercontent.com/soneverdance/ovital/main/%E8%85%BE%E8%AE%AF%E5%9C%B0%E5%9B%BE5%E7%A7%8D.ovmap',
};

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

await mkdir(dirname(fixture.file), { recursive: true });
try {
  const existing = await readFile(fixture.file);
  if (digest(existing) === fixture.sha256) {
    console.log('fixture-already-verified');
    process.exit(0);
  }
  throw new Error('refusing to overwrite a local fixture with a different hash');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const response = await fetch(fixture.url, { signal: AbortSignal.timeout(15_000) });
if (!response.ok) throw new Error(`fixture download failed: ${response.status}`);
const bytes = new Uint8Array(await response.arrayBuffer());
if (digest(bytes) !== fixture.sha256) throw new Error('fixture hash mismatch');
const temporary = `${fixture.file}.${process.pid}.tmp`;
await writeFile(temporary, bytes, { mode: 0o600 });
await rename(temporary, fixture.file);
console.log('fixture-acquired; local research only; not redistributable by this project');
