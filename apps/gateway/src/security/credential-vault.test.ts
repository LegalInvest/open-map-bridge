import { chmod, mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { EncryptedCredentialVault } from './credential-vault.js';

const sourceId = '018f4d39-32f1-7a31-9f60-81c6b453b886';

it('atomically stores only an authenticated encrypted envelope and reopens it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'omb-vault-'));
  const path = join(directory, 'credentials.json');
  const key = Buffer.alloc(32, 7);
  const first = await EncryptedCredentialVault.open(path, key);
  const reference = await first.put(sourceId, {
    fields: [{ placement: 'query', name: 'api_key', value: 'not-a-real-secret-fixture' }],
  });
  expect(reference).toBe(`vault://source/${sourceId}`);
  const raw = await readFile(path, 'utf8');
  expect(raw).not.toContain('not-a-real-secret-fixture');
  expect(raw).not.toContain('api_key');
  expect((await stat(path)).mode & 0o777).toBe(0o600);

  const reopened = await EncryptedCredentialVault.open(path, key);
  expect(reopened.has(reference)).toBe(true);
  expect(reopened.resolve(reference)).toEqual({
    fields: [{ placement: 'query', name: 'api_key', value: 'not-a-real-secret-fixture' }],
  });
  const fingerprint = reopened.fingerprint(reference);
  expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(fingerprint).not.toContain('not-a-real-secret-fixture');
  expect(reopened.fingerprint(reference)).toBe(fingerprint);
  await reopened.put(sourceId, {
    fields: [{ placement: 'query', name: 'api_key', value: 'rotated-fixture-value' }],
  });
  expect(reopened.fingerprint(reference)).not.toBe(fingerprint);
  await reopened.remove(reference);
  expect(reopened.has(reference)).toBe(false);
});

it('fails closed when the configured key cannot authenticate an existing vault', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'omb-vault-key-'));
  const path = join(directory, 'credentials.json');
  const first = await EncryptedCredentialVault.open(path, Buffer.alloc(32, 1));
  await first.put(sourceId, { fields: [{ placement: 'header', name: 'Authorization', value: 'fixture' }] });
  await expect(EncryptedCredentialVault.open(path, Buffer.alloc(32, 2))).rejects.toThrow(/decrypt/);
});

it('fails closed when an existing vault file is readable by group or others', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'omb-vault-mode-'));
  const path = join(directory, 'credentials.json');
  await EncryptedCredentialVault.open(path, Buffer.alloc(32, 3));
  await chmod(path, 0o640);
  await expect(EncryptedCredentialVault.open(path, Buffer.alloc(32, 3))).rejects.toThrow(/not private/);
});
