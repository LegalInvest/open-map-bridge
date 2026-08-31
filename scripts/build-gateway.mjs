import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const artifact = join(root, 'dist', 'open-map-bridge');
const serverFile = join(artifact, 'server.mjs');
const webSource = join(root, 'apps', 'web', 'dist');
const webTarget = join(artifact, 'web');
const deployTarget = join(artifact, 'deploy');

await rm(artifact, { recursive: true, force: true });
await mkdir(artifact, { recursive: true });

await build({
  entryPoints: [join(root, 'apps', 'gateway', 'src', 'server.ts')],
  outfile: serverFile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  banner: { js: "import { createRequire as __ombCreateRequire } from 'node:module'; const require = __ombCreateRequire(import.meta.url);" },
  sourcemap: 'external',
  sourcesContent: false,
  legalComments: 'external',
  logLevel: 'info',
});

await cp(webSource, webTarget, { recursive: true, force: true });
await cp(join(root, 'deploy'), deployTarget, { recursive: true, force: true });
await cp(join(root, 'LICENSE'), join(artifact, 'LICENSE'), { force: true });
const serverBytes = await readFile(serverFile);
const indexBytes = await readFile(join(webTarget, 'index.html'));
const manifest = {
  schemaVersion: 1,
  nodeTarget: 'node24',
  gatewayEntry: 'server.mjs',
  webRoot: 'web',
  deploymentTemplates: 'deploy',
  gatewaySha256: createHash('sha256').update(serverBytes).digest('hex'),
  webIndexSha256: createHash('sha256').update(indexBytes).digest('hex'),
};
await writeFile(join(artifact, 'build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
process.stdout.write(`production artifact ready: dist/open-map-bridge (${serverBytes.byteLength} gateway bytes)\n`);
