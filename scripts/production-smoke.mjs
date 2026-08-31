import { createHash, randomBytes } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const artifact = join(root, 'dist', 'open-map-bridge');
const temporary = await mkdtemp(join(tmpdir(), 'open-map-bridge-production-smoke-'));
const release = join(temporary, 'release');
const token = randomBytes(32).toString('base64url');
const vaultKey = randomBytes(32).toString('base64url');

async function availablePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  if (!port) throw new Error('failed to allocate a production smoke port');
  return port;
}

function cappedCollector(stream) {
  let value = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    if (value.length < 65_536) value += chunk.slice(0, 65_536 - value.length);
  });
  return () => value;
}

async function waitForHealth(url, headers, child) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`production gateway exited before health check (${child.exitCode})`);
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(1_000) });
      if (response.ok) return response;
    } catch {
      // The bound loopback port may not be ready yet.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error('production gateway health check timed out');
}

let child;
try {
  await cp(artifact, release, { recursive: true, force: true });
  const manifest = JSON.parse(await readFile(join(release, 'build-manifest.json'), 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.gatewayEntry !== 'server.mjs' || !/^[a-f0-9]{64}$/.test(manifest.gatewaySha256)) {
    throw new Error('production build manifest is invalid');
  }
  const gatewayBytes = await readFile(join(release, manifest.gatewayEntry));
  if (createHash('sha256').update(gatewayBytes).digest('hex') !== manifest.gatewaySha256) {
    throw new Error('production gateway does not match its build manifest');
  }
  const index = await readFile(join(release, 'web', 'index.html'), 'utf8');
  if (createHash('sha256').update(index).digest('hex') !== manifest.webIndexSha256) {
    throw new Error('production Web index does not match its build manifest');
  }
  const service = await readFile(join(release, manifest.deploymentTemplates, 'systemd', 'open-map-bridge.service'), 'utf8');
  if (!service.includes('/opt/open-map-bridge/runtime/current/bin/node')) {
    throw new Error('production service does not use the project-scoped Node runtime');
  }
  if (!index.includes('OpenMapBridge') || index.includes(token)) throw new Error('production web artifact is invalid');

  const port = await availablePort();
  const origin = 'http://127.0.0.1:5173';
  child = spawn(process.execPath, [join(release, 'server.mjs')], {
    cwd: release,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      OMB_GATEWAY_PORT: String(port),
      OMB_GATEWAY_TOKEN: token,
      OMB_WEB_ORIGIN: origin,
      OMB_DATA_PATH: join(temporary, 'state.json'),
      OMB_VAULT_PATH: join(temporary, 'credential-vault.json'),
      OMB_VAULT_KEY: vaultKey,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = cappedCollector(child.stdout);
  const stderr = cappedCollector(child.stderr);
  const baseUrl = `http://127.0.0.1:${port}`;
  const headers = { authorization: `Bearer ${token}`, origin };
  const health = await waitForHealth(`${baseUrl}/api/health`, headers, child);
  const body = await health.json();
  if (body.ok !== true || body.persistence !== 'atomic-json' || body.credentialVault !== 'encrypted-local') {
    throw new Error('production health payload is invalid');
  }
  const vaultBytes = await readFile(join(temporary, 'credential-vault.json'), 'utf8');
  if (!vaultBytes.includes('"schemaVersion": 1') || vaultBytes.includes(vaultKey) || (await stat(join(temporary, 'credential-vault.json'))).mode & 0o077) {
    throw new Error('production credential vault boundary is invalid');
  }
  const unauthenticated = await fetch(`${baseUrl}/api/health`);
  if (unauthenticated.status !== 401) throw new Error('production gateway admitted an unauthenticated request');

  const exitPromise = new Promise((resolveExit) => child.once('exit', (code, signal) => resolveExit({ code, signal })));
  child.kill('SIGTERM');
  const exit = await Promise.race([
    exitPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('production gateway did not stop within 5 seconds')), 5_000)),
  ]);
  if (exit.code !== 0 || exit.signal !== null) {
    throw new Error(`production gateway stopped unexpectedly: ${JSON.stringify(exit)}\n${stdout()}\n${stderr()}`);
  }
  if (!stdout().includes('gateway.started') || !stdout().includes('gateway.stopped') || stderr()) {
    throw new Error(`production lifecycle logs are incomplete\n${stdout()}\n${stderr()}`);
  }
  process.stdout.write('production-smoke-ok: artifact, auth health, persistence, and graceful SIGTERM\n');
} finally {
  if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  await rm(temporary, { recursive: true, force: true });
}
