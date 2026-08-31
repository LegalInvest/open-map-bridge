import { resolve } from 'node:path';
import { buildApp } from './app.js';
import { parseCredentialVaultConfig, parseGatewayServerConfig, parseOviBridgeConfig } from './config.js';
import { EncryptedCredentialVault } from './security/credential-vault.js';

async function main(): Promise<void> {
  const gateway = parseGatewayServerConfig(process.env);
  const dataPath = process.env.OMB_DATA_PATH ?? resolve('data/temporal-state.json');
  const ovi = parseOviBridgeConfig(process.env);
  const vaultConfig = parseCredentialVaultConfig(process.env);
  const credentialVault = vaultConfig
    ? await EncryptedCredentialVault.open(vaultConfig.path, vaultConfig.key)
    : undefined;
  const app = await buildApp({
    dataPath,
    access: gateway.access,
    ...(ovi ? { ovi } : {}),
    ...(credentialVault ? { credentialVault } : {}),
  });

  let closing = false;
  async function shutdown(signal: 'SIGINT' | 'SIGTERM'): Promise<void> {
    if (closing) return;
    closing = true;
    try {
      await app.close();
      process.stdout.write(`${JSON.stringify({ event: 'gateway.stopped', signal })}\n`);
    } catch (cause) {
      process.exitCode = 1;
      process.stderr.write(`${JSON.stringify({ event: 'gateway.stop_failed', signal, error: cause instanceof Error ? cause.name : 'Error' })}\n`);
    }
  }

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  await app.listen({ host: '127.0.0.1', port: gateway.port });
  process.stdout.write(`${JSON.stringify({ event: 'gateway.started', host: '127.0.0.1', port: gateway.port })}\n`);
}

void main().catch((cause) => {
  process.exitCode = 1;
  process.stderr.write(`${JSON.stringify({ event: 'gateway.start_failed', error: cause instanceof Error ? cause.name : 'Error' })}\n`);
});
