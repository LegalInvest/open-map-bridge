import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, open, readFile, rename, stat, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseCredentialBundle, type CredentialBundle } from '@omb/source-schema';

const vaultFileMaxBytes = 1024 * 1024;
const sourceIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const referencePattern = /^vault:\/\/source\/([0-9a-f-]{36})$/i;

interface EncryptedEntry {
  sourceId: string;
  nonce: string;
  ciphertext: string;
  tag: string;
  createdAt: string;
  updatedAt: string;
}

interface VaultFile {
  schemaVersion: 1;
  entries: Record<string, EncryptedEntry>;
}

export interface CredentialVault {
  put(sourceId: string, bundle: CredentialBundle): Promise<string>;
  has(reference: string): boolean;
  resolve(reference: string): CredentialBundle;
  remove(reference: string): Promise<void>;
}

function referenceFor(sourceId: string): string {
  if (!sourceIdPattern.test(sourceId)) throw new Error('credential source ID must be a UUID');
  return `vault://source/${sourceId.toLowerCase()}`;
}

function sourceIdFromReference(reference: string): string {
  const sourceId = referencePattern.exec(reference)?.[1];
  if (!sourceId || !sourceIdPattern.test(sourceId)) throw new Error('credential reference is invalid');
  return sourceId.toLowerCase();
}

function parseEntry(sourceId: string, value: unknown): EncryptedEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('vault entry is invalid');
  const entry = value as Record<string, unknown>;
  const keys = Object.keys(entry);
  if (
    keys.length !== 6 ||
    keys.some((key) => !['sourceId', 'nonce', 'ciphertext', 'tag', 'createdAt', 'updatedAt'].includes(key)) ||
    entry.sourceId !== sourceId ||
    typeof entry.nonce !== 'string' ||
    typeof entry.ciphertext !== 'string' ||
    typeof entry.tag !== 'string' ||
    typeof entry.createdAt !== 'string' ||
    typeof entry.updatedAt !== 'string'
  ) {
    throw new Error('vault entry is invalid');
  }
  if (!/^[-_A-Za-z0-9]+$/.test(entry.nonce) || !/^[-_A-Za-z0-9]+$/.test(entry.ciphertext) || !/^[-_A-Za-z0-9]+$/.test(entry.tag)) {
    throw new Error('vault entry encoding is invalid');
  }
  return entry as unknown as EncryptedEntry;
}

function parseVaultFile(value: unknown): VaultFile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('credential vault is invalid');
  const raw = value as Record<string, unknown>;
  if (
    Object.keys(raw).length !== 2 ||
    Object.keys(raw).some((key) => !['schemaVersion', 'entries'].includes(key)) ||
    raw.schemaVersion !== 1 ||
    typeof raw.entries !== 'object' ||
    raw.entries === null ||
    Array.isArray(raw.entries)
  ) {
    throw new Error('credential vault is invalid');
  }
  const entries: Record<string, EncryptedEntry> = {};
  for (const [sourceId, entry] of Object.entries(raw.entries as Record<string, unknown>)) {
    if (!sourceIdPattern.test(sourceId)) throw new Error('credential vault source ID is invalid');
    const normalizedSourceId = sourceId.toLowerCase();
    if (entries[normalizedSourceId]) throw new Error('credential vault source ID is duplicated');
    entries[normalizedSourceId] = parseEntry(sourceId, entry);
  }
  if (Object.keys(entries).length > 1024) throw new Error('credential vault entry limit exceeded');
  return { schemaVersion: 1, entries };
}

export class EncryptedCredentialVault implements CredentialVault {
  private state: VaultFile;
  private writeTail: Promise<void> = Promise.resolve();

  private constructor(
    private readonly path: string | null,
    private readonly key: Buffer,
    state: VaultFile,
  ) {
    this.state = state;
  }

  static async open(path: string | null, key: Uint8Array): Promise<EncryptedCredentialVault> {
    const keyBytes = Buffer.from(key);
    if (keyBytes.byteLength !== 32) throw new Error('credential vault key must be exactly 32 bytes');
    if (path === null) return new EncryptedCredentialVault(null, keyBytes, { schemaVersion: 1, entries: {} });
    let state: VaultFile;
    try {
      const metadata = await stat(path);
      if (!metadata.isFile() || metadata.size > vaultFileMaxBytes || (metadata.mode & 0o077) !== 0) {
        throw new Error('credential vault file is invalid, too large, or not private');
      }
      state = parseVaultFile(JSON.parse(await readFile(path, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const vault = new EncryptedCredentialVault(path, keyBytes, { schemaVersion: 1, entries: {} });
      await vault.persist();
      return vault;
    }
    const vault = new EncryptedCredentialVault(path, keyBytes, state);
    for (const sourceId of Object.keys(state.entries)) vault.resolve(referenceFor(sourceId));
    return vault;
  }

  has(reference: string): boolean {
    return this.state.entries[sourceIdFromReference(reference)] !== undefined;
  }

  resolve(reference: string): CredentialBundle {
    const sourceId = sourceIdFromReference(reference);
    const entry = this.state.entries[sourceId];
    if (!entry) throw new Error('credential reference was not found');
    try {
      const nonce = Buffer.from(entry.nonce, 'base64url');
      const tag = Buffer.from(entry.tag, 'base64url');
      const ciphertext = Buffer.from(entry.ciphertext, 'base64url');
      if (nonce.byteLength !== 12 || tag.byteLength !== 16 || ciphertext.byteLength === 0) throw new Error('invalid envelope');
      const decipher = createDecipheriv('aes-256-gcm', this.key, nonce);
      decipher.setAAD(Buffer.from(`omb-credential-v1:${sourceId}`, 'utf8'));
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return parseCredentialBundle(JSON.parse(plaintext.toString('utf8')));
    } catch {
      throw new Error('credential vault could not decrypt an entry');
    }
  }

  async put(sourceId: string, input: CredentialBundle): Promise<string> {
    const normalizedSourceId = sourceId.toLowerCase();
    const reference = referenceFor(normalizedSourceId);
    const bundle = parseCredentialBundle(input);
    const plaintext = Buffer.from(JSON.stringify(bundle), 'utf8');
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    cipher.setAAD(Buffer.from(`omb-credential-v1:${normalizedSourceId}`, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const now = new Date().toISOString();
    const previous = this.state.entries[normalizedSourceId];
    const next: EncryptedEntry = {
      sourceId: normalizedSourceId,
      nonce: nonce.toString('base64url'),
      ciphertext: ciphertext.toString('base64url'),
      tag: cipher.getAuthTag().toString('base64url'),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    await this.mutate((state) => ({ ...state, entries: { ...state.entries, [normalizedSourceId]: next } }));
    return reference;
  }

  async remove(reference: string): Promise<void> {
    const sourceId = sourceIdFromReference(reference);
    await this.mutate((state) => {
      if (!state.entries[sourceId]) return state;
      const entries = { ...state.entries };
      delete entries[sourceId];
      return { ...state, entries };
    });
  }

  private async mutate(update: (state: VaultFile) => VaultFile): Promise<void> {
    const operation = this.writeTail.then(async () => {
      const next = update(this.state);
      if (next === this.state) return;
      await this.persist(next);
      this.state = next;
    });
    this.writeTail = operation.catch(() => undefined);
    await operation;
  }

  private async persist(state: VaultFile = this.state): Promise<void> {
    if (this.path === null) return;
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      const handle = await open(temporary, 'wx', 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, this.path);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }
}
