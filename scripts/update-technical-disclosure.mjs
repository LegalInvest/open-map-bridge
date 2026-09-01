import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const documentPath = join(root, 'docs', '技术交底书.md');
const mode = process.argv[2] ?? 'check';
const note = process.argv.slice(3).join(' ').trim() || '同步当前技术基线';

const sourcePaths = [
  '.github/workflows',
  '.nvmrc',
  'README.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'HANDOFF.md',
  'apps',
  'deploy',
  'packages',
  'scripts',
  'package.json',
  'package-lock.json',
  'tsconfig.base.json',
  'playwright.config.ts',
  'playwright.authorized.config.ts',
  'vitest.config.ts',
  'vitest.compat.config.ts',
  'goal.md',
  'research.md',
  'BLOCKED.md',
  'PROGRESS.md',
  'docs/acceptance',
  'docs/automation-api.md',
  'docs/deployment.md',
  'docs/merge-readiness.md',
  'docs/runbook.md',
  'docs/问题账本.md',
  'docs/open-map-source-schema.md',
  'docs/developer-sdk.md',
  'docs/可视化与自动化路线图.md',
  'docs/compatibility',
  'docs/superpowers/specs',
];

function gitText(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

function gitBuffer(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: null, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr.toString('utf8').trim() || `git ${args.join(' ')} failed`);
  return result.stdout;
}

async function sourceFingerprint() {
  const listed = gitBuffer(['ls-files', '-z', '-c', '-o', '--exclude-standard', '--', ...sourcePaths]);
  const paths = listed
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .filter((path) => path !== 'docs/技术交底书.md')
    .sort();
  const hash = createHash('sha256');
  let fileCount = 0;
  for (const path of paths) {
    let contents;
    try {
      contents = await readFile(join(root, path));
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') continue;
      throw error;
    }
    hash.update(path, 'utf8');
    hash.update('\0');
    hash.update(contents);
    hash.update('\0');
    fileCount += 1;
  }
  if (fileCount === 0) throw new Error('technical disclosure source set is empty');
  return { fingerprint: hash.digest('hex'), fileCount };
}

function shanghaiTimestamp() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace('Z', '+08:00');
}

function metadata(document) {
  const block = /<!-- TECH_DISCLOSURE_META_START -->([\s\S]*?)<!-- TECH_DISCLOSURE_META_END -->/.exec(document)?.[1];
  if (!block) throw new Error('technical disclosure metadata block is missing');
  const value = (key) => new RegExp('- `' + key + '`: `([^`]+)`').exec(block)?.[1];
  return {
    createdAt: value('created_at'),
    lastUpdatedAt: value('last_updated_at'),
    basisCommit: value('basis_commit'),
    fingerprint: value('source_fingerprint_sha256'),
  };
}

function safeLogCell(value) {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ').slice(0, 240);
}

async function main() {
  if (!['check', 'update'].includes(mode)) throw new Error('usage: update-technical-disclosure.mjs <check|update> [note]');
  const document = await readFile(documentPath, 'utf8');
  const current = metadata(document);
  const snapshot = await sourceFingerprint();

  if (mode === 'check') {
    if (current.fingerprint !== snapshot.fingerprint) {
      throw new Error(
        `技术交底书已过期：记录 ${current.fingerprint ?? 'missing'}，当前 ${snapshot.fingerprint}。` +
          '请运行 npm run disclosure:update -- "变更说明"。',
      );
    }
    if (!current.createdAt || !current.lastUpdatedAt || !current.basisCommit) {
      throw new Error('technical disclosure timestamps or basis commit are missing');
    }
    process.stdout.write(
      `technical disclosure is current (${snapshot.fileCount} files, ${snapshot.fingerprint.slice(0, 12)})\n`,
    );
    return;
  }

  if (current.fingerprint === snapshot.fingerprint && current.createdAt !== 'PENDING') {
    process.stdout.write(`technical disclosure already matches ${snapshot.fingerprint.slice(0, 12)}\n`);
    return;
  }

  const timestamp = shanghaiTimestamp();
  const basisCommit = gitText(['rev-parse', '--short=12', 'HEAD']);
  const createdAt = current.createdAt && current.createdAt !== 'PENDING' ? current.createdAt : timestamp;
  const meta = `<!-- TECH_DISCLOSURE_META_START -->
- \`document_id\`: \`OMB-TD-001\`
- \`version\`: \`0.1.0-draft\`
- \`created_at\`: \`${createdAt}\`
- \`last_updated_at\`: \`${timestamp}\`
- \`basis_commit\`: \`${basisCommit}\`
- \`source_fingerprint_sha256\`: \`${snapshot.fingerprint}\`
- \`status\`: \`持续更新中的技术事实稿\`
<!-- TECH_DISCLOSURE_META_END -->`;
  let updated = document.replace(
    /<!-- TECH_DISCLOSURE_META_START -->[\s\S]*?<!-- TECH_DISCLOSURE_META_END -->/,
    meta,
  );
  const marker = '<!-- TECH_DISCLOSURE_LOG_ROWS_START -->';
  if (!updated.includes(marker)) throw new Error('technical disclosure log marker is missing');
  const row = `| ${timestamp} | \`${basisCommit}\` | \`${snapshot.fingerprint.slice(0, 12)}\` | ${safeLogCell(note)} |`;
  updated = updated.replace(marker, `${marker}\n${row}`);
  await writeFile(documentPath, updated, 'utf8');
  process.stdout.write(
    `updated ${relative(root, documentPath)} (${snapshot.fileCount} files, ${snapshot.fingerprint.slice(0, 12)})\n`,
  );
}

await main();
