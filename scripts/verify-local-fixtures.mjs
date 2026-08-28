import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const bytes = await readFile(resolve('fixtures/local/tencent-5.ovmap'));
const actual = createHash('sha256').update(bytes).digest('hex');
const expected = 'a3de20dd1830e81697950bc13d93dba0d67dfc7d2f91651a86c79f04db750128';
if (actual !== expected) throw new Error('fixtures/local/tencent-5.ovmap hash mismatch');
console.log('fixtures-ok');
