import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function evaluateEnvironment({ nodeMajor, freeBytes }) {
  const errors = [];
  if (nodeMajor < 24 || nodeMajor > 26) errors.push(`unsupported Node ${nodeMajor}`);
  if (freeBytes < 8n * 1024n ** 3n) errors.push('at least 8 GiB free disk is required');
  return { ok: errors.length === 0, errors };
}

function currentFreeBytes() {
  const output = execFileSync('df', ['-k', '/'], { encoding: 'utf8' }).trim().split('\n');
  const fields = output.at(-1)?.trim().split(/\s+/);
  if (!fields?.[3]) throw new Error('cannot read free disk from df');
  return BigInt(fields[3]) * 1024n;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = evaluateEnvironment({
    nodeMajor: Number(process.versions.node.split('.')[0]),
    freeBytes: currentFreeBytes(),
  });
  if (!result.ok) {
    console.error(result.errors.join('\n'));
    process.exit(1);
  }
  console.log('environment-ok');
}
