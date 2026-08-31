import { isAbsolute } from 'node:path';
import type { GatewayAccessConfig, GatewayPermission, GatewayPrincipal } from './security/gateway-access.js';
import {
  parseTemporalDateEntry,
  parseTemporalTileRequest,
  type TemporalDateEntry,
  type TemporalTileRequest,
} from '@omb/temporal-source';

export interface OviBridgeConfig {
  baseUrl: string;
  mapType: number;
  sourceId: string;
  verifiedDates?: TemporalDateEntry[];
  probeRequest?: TemporalTileRequest;
}

export interface GatewayServerConfig {
  port: number;
  access: GatewayAccessConfig;
}

export interface CredentialVaultConfig {
  path: string;
  key: Buffer;
}

const developerPermissions = new Set<GatewayPermission>([
  'read-source-metadata',
  'read-map-tiles',
  'read-temporal-catalog',
  'read-tiles',
]);

function requireToken(value: string | undefined, name: string): string {
  if (!value || value.length < 32 || value.length > 256 || /\s|[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`${name} must be a 32-256 character non-whitespace secret`);
  }
  return value;
}

function parseDeveloperPrincipals(raw: string | undefined): GatewayPrincipal[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('OMB_DEVELOPER_TOKENS_JSON must be valid JSON');
  }
  if (!Array.isArray(value)) throw new Error('OMB_DEVELOPER_TOKENS_JSON must be an array');
  const principals = value.map((entry, index): GatewayPrincipal => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`OMB_DEVELOPER_TOKENS_JSON[${index}] must be an object`);
    }
    const candidate = entry as { id?: unknown; token?: unknown; permissions?: unknown };
    if (typeof candidate.id !== 'string' || !/^[a-z0-9](?:[a-z0-9._-]{1,126}[a-z0-9])$/i.test(candidate.id)) {
      throw new Error(`OMB_DEVELOPER_TOKENS_JSON[${index}].id is invalid`);
    }
    if (!Array.isArray(candidate.permissions) || candidate.permissions.length === 0) {
      throw new Error(`OMB_DEVELOPER_TOKENS_JSON[${index}].permissions must not be empty`);
    }
    const permissions = candidate.permissions.map((permission) => {
      if (typeof permission !== 'string' || !developerPermissions.has(permission as GatewayPermission)) {
        throw new Error(`OMB_DEVELOPER_TOKENS_JSON[${index}] contains an invalid permission`);
      }
      return permission as GatewayPermission;
    });
    return {
      id: candidate.id,
      token: requireToken(typeof candidate.token === 'string' ? candidate.token : undefined, `developer token ${index}`),
      permissions: [...new Set(permissions)],
    };
  });
  if (new Set(principals.map((principal) => principal.id)).size !== principals.length) {
    throw new Error('developer app IDs must be unique');
  }
  return principals;
}

export function parseGatewayServerConfig(environment: NodeJS.ProcessEnv): GatewayServerConfig {
  const port = Number(environment.OMB_GATEWAY_PORT ?? '4174');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('OMB_GATEWAY_PORT must be an integer between 1 and 65535');
  }
  const webOrigin = environment.OMB_WEB_ORIGIN ?? 'http://127.0.0.1:5173';
  let origin: URL;
  try {
    origin = new URL(webOrigin);
  } catch {
    throw new Error('OMB_WEB_ORIGIN must be a loopback HTTP origin');
  }
  if (
    origin.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) ||
    origin.username ||
    origin.password ||
    origin.origin !== webOrigin
  ) {
    throw new Error('OMB_WEB_ORIGIN must be a loopback HTTP origin without path, query, or credentials');
  }
  const maxRequests = Number(environment.OMB_GATEWAY_RATE_LIMIT ?? '600');
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 10_000) {
    throw new Error('OMB_GATEWAY_RATE_LIMIT must be an integer between 1 and 10000');
  }
  const uiToken = requireToken(environment.OMB_GATEWAY_TOKEN, 'OMB_GATEWAY_TOKEN');
  const developerPrincipals = parseDeveloperPrincipals(environment.OMB_DEVELOPER_TOKENS_JSON);
  const principals: GatewayPrincipal[] = [
    {
      id: 'omb.local.web',
      token: uiToken,
      permissions: ['gateway:ui', 'read-source-metadata', 'read-map-tiles', 'read-temporal-catalog', 'read-tiles'],
    },
    ...developerPrincipals,
  ];
  if (new Set(principals.map((principal) => principal.id)).size !== principals.length) {
    throw new Error('gateway and developer principal IDs must be unique');
  }
  if (new Set(principals.map((principal) => principal.token)).size !== principals.length) {
    throw new Error('gateway and developer tokens must be unique');
  }
  const allowedHosts = port === 80
    ? ['127.0.0.1', 'localhost', '127.0.0.1:80', 'localhost:80']
    : [`127.0.0.1:${port}`, `localhost:${port}`];
  return {
    port,
    access: {
      allowedHosts,
      allowedOrigins: [webOrigin],
      principals,
      rateLimit: { maxRequests, windowMs: 60_000 },
    },
  };
}

export function parseOviBridgeConfig(environment: NodeJS.ProcessEnv): OviBridgeConfig | undefined {
  const portValue = environment.OMB_OVI_PORT;
  const mapTypeValue = environment.OMB_OVI_MAP_TYPE;
  const sourceId = environment.OMB_OVI_SOURCE_ID;
  const datesValue = environment.OMB_OVI_VERIFIED_DATES_JSON;
  const probeValue = environment.OMB_OVI_PROBE_JSON;
  const configuredCount = [portValue, mapTypeValue, sourceId].filter(Boolean).length;
  if ((configuredCount > 0 && configuredCount < 3) || (configuredCount === 0 && (datesValue || probeValue))) {
    throw new Error('OMB_OVI_PORT, OMB_OVI_MAP_TYPE, and OMB_OVI_SOURCE_ID must be configured together before probe metadata');
  }
  if (!portValue || !mapTypeValue || !sourceId) return undefined;

  const port = Number(portValue);
  const mapType = Number(mapTypeValue);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('OMB_OVI_PORT must be an integer between 1 and 65535');
  }
  if (!Number.isInteger(mapType) || mapType < 1) {
    throw new Error('OMB_OVI_MAP_TYPE must be a positive integer');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceId)) {
    throw new Error('OMB_OVI_SOURCE_ID must be a UUID');
  }
  let verifiedDates: TemporalDateEntry[] | undefined;
  if (datesValue) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(datesValue);
    } catch {
      throw new Error('OMB_OVI_VERIFIED_DATES_JSON must be valid JSON');
    }
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 500) {
      throw new Error('OMB_OVI_VERIFIED_DATES_JSON must contain 1 to 500 date entries');
    }
    const allowedDateKeys = new Set(['id', 'requestDate', 'captureDate', 'precision', 'availability']);
    verifiedDates = parsed.map((entry) => {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        Array.isArray(entry) ||
        Object.keys(entry).some((key) => !allowedDateKeys.has(key))
      ) {
        throw new Error('OMB_OVI_VERIFIED_DATES_JSON contains an invalid or non-public field');
      }
      return parseTemporalDateEntry({ ...entry, provenance: 'authorized-operator-ovi-date' });
    });
    if (new Set(verifiedDates.map((entry) => entry.id)).size !== verifiedDates.length) {
      throw new Error('OMB_OVI_VERIFIED_DATES_JSON date IDs must be unique');
    }
  }

  let probeRequest: TemporalTileRequest | undefined;
  if (probeValue) {
    if (!verifiedDates) throw new Error('OMB_OVI_PROBE_JSON requires OMB_OVI_VERIFIED_DATES_JSON');
    let parsed: unknown;
    try {
      parsed = JSON.parse(probeValue);
    } catch {
      throw new Error('OMB_OVI_PROBE_JSON must be valid JSON');
    }
    probeRequest = parseTemporalTileRequest(parsed);
    const probeDate = verifiedDates.find((entry) => entry.id === probeRequest?.dateId);
    if (!probeDate || ['missing', 'failed'].includes(probeDate.availability)) {
      throw new Error('OMB_OVI_PROBE_JSON must reference a requestable verified date');
    }
  }

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    mapType,
    sourceId,
    ...(verifiedDates ? { verifiedDates } : {}),
    ...(probeRequest ? { probeRequest } : {}),
  };
}

export function parseCredentialVaultConfig(environment: NodeJS.ProcessEnv): CredentialVaultConfig | undefined {
  const path = environment.OMB_VAULT_PATH;
  const encodedKey = environment.OMB_VAULT_KEY;
  if (!path && !encodedKey) return undefined;
  if (!path || !encodedKey) throw new Error('OMB_VAULT_PATH and OMB_VAULT_KEY must be configured together');
  if (!isAbsolute(path) || path.length > 4096 || /[\u0000-\u001f\u007f]/.test(path)) {
    throw new Error('OMB_VAULT_PATH must be a bounded absolute path');
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(encodedKey)) {
    throw new Error('OMB_VAULT_KEY must be an unpadded base64url-encoded 32-byte key');
  }
  const key = Buffer.from(encodedKey, 'base64url');
  if (key.byteLength !== 32 || key.toString('base64url') !== encodedKey) {
    throw new Error('OMB_VAULT_KEY must be an unpadded base64url-encoded 32-byte key');
  }
  return { path, key };
}
