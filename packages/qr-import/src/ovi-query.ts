import {
  isSafeNonSecretQueryParameter,
  type MapSourceDefinition,
  type ProjectionId,
  type TransportScheme,
} from '@omb/source-schema';

export interface RawQrCandidate {
  adapter: 'ovi-query-v1' | 'oms-qr-v1';
  legacyId: number | null;
  name: string;
  host: string;
  pathTemplate: string;
  transportScheme: TransportScheme;
  projection: ProjectionId;
  rawCodes: Record<string, string>;
  opaqueFieldNames: string[];
  containsSensitiveQuery: boolean;
  queryParameters: Record<string, string>;
  requestPlanProvenance: MapSourceDefinition['requestPlanProvenance'];
  opaqueTemplate: boolean;
  sourceDefinition: MapSourceDefinition | null;
}

const rawCodeKeys = ['t', 'po', 'he', 'oy', 'df'] as const;
const credentialKeys = ['at', 'ad', 'al'] as const;
const opaqueExtensionKeys = ['hs', 'mf', 'ml', 'ms', 'mt', 'pn', 'pt'] as const;
const allowedKeys = new Set([
  'id',
  'na',
  'hn',
  'ul',
  ...rawCodeKeys,
  ...credentialKeys,
  ...opaqueExtensionKeys,
]);
const coreKeys = new Set(['id', 'na', 'hn', 'ul']);
function decodePart(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    throw new Error('FORMAT_QR_PERCENT_ENCODING');
  }
}

function stripSensitiveQuery(path: string): {
  pathTemplate: string;
  containsSensitiveQuery: boolean;
  queryParameters: Record<string, string>;
  queryParameterProvenance: MapSourceDefinition['requestPlanProvenance']['queryParameters'];
} {
  const question = path.indexOf('?');
  if (question < 0) {
    return { pathTemplate: path, containsSensitiveQuery: false, queryParameters: {}, queryParameterProvenance: {} };
  }
  const pathname = path.slice(0, question);
  const query = path.slice(question + 1);
  let containsSensitiveQuery = false;
  const queryParameters: Record<string, string> = {};
  const queryParameterProvenance: MapSourceDefinition['requestPlanProvenance']['queryParameters'] = {};
  const seen = new Set<string>();
  for (const item of query.split('&')) {
    const equals = item.indexOf('=');
    const key = equals >= 0 ? item.slice(0, equals) : item;
    const value = equals >= 0 ? item.slice(equals + 1) : '';
    if (seen.has(key)) {
      containsSensitiveQuery = true;
      delete queryParameters[key];
      delete queryParameterProvenance[key];
      continue;
    }
    seen.add(key);
    if (!isSafeNonSecretQueryParameter(key, value)) {
      containsSensitiveQuery = true;
      continue;
    }
    queryParameters[key] = value;
    queryParameterProvenance[key] = 'parsed';
  }
  return { pathTemplate: pathname || '/', containsSensitiveQuery, queryParameters, queryParameterProvenance };
}

function requestPath(host: string, rawPath: string): {
  transportScheme: TransportScheme;
  transportSchemeProvenance: MapSourceDefinition['requestPlanProvenance']['transportScheme'];
  pathTemplate: string;
  pathTemplateProvenance: MapSourceDefinition['requestPlanProvenance']['pathTemplate'];
  containsSensitiveQuery: boolean;
  queryParameters: Record<string, string>;
  queryParameterProvenance: MapSourceDefinition['requestPlanProvenance']['queryParameters'];
  opaqueTemplate: boolean;
} {
  if (rawPath.startsWith('/')) {
    return {
      transportScheme: 'unknown',
      transportSchemeProvenance: 'not-provided',
      pathTemplateProvenance: 'parsed',
      opaqueTemplate: false,
      ...stripSensitiveQuery(rawPath),
    };
  }
  if (rawPath.startsWith('https://') || rawPath.startsWith('http://')) {
    let url: URL;
    try {
      url = new URL(rawPath);
    } catch {
      throw new Error('FORMAT_QR_URL');
    }
    if (url.username || url.password || url.hash || url.host.toLowerCase() !== host.toLowerCase()) {
      throw new Error('POLICY_QR_AUTHORITY');
    }
    return {
      transportScheme: url.protocol === 'https:' ? 'https' : 'http',
      transportSchemeProvenance: 'parsed',
      pathTemplateProvenance: 'parsed',
      opaqueTemplate: false,
      ...stripSensitiveQuery(`${url.pathname.replace(/%7b/gi, '{').replace(/%7d/gi, '}')}${url.search}`),
    };
  }
  return {
    transportScheme: 'unknown',
    transportSchemeProvenance: 'redacted',
    pathTemplate: '/',
    pathTemplateProvenance: 'redacted',
    containsSensitiveQuery: true,
    queryParameters: {},
    queryParameterProvenance: {},
    opaqueTemplate: true,
  };
}

export function decodeOviQuery(payload: string): RawQrCandidate[] {
  if (!payload.startsWith('ovobj?')) throw new Error('FORMAT_QR_HEAD');
  const values = new Map<string, string[]>();
  for (const pair of payload.slice(6).split('&')) {
    if (pair.length === 0) continue;
    const equals = pair.indexOf('=');
    const key = decodePart(equals >= 0 ? pair.slice(0, equals) : pair);
    const value = decodePart(equals >= 0 ? pair.slice(equals + 1) : '');
    if (!allowedKeys.has(key)) throw new Error('FORMAT_QR_UNKNOWN_KEY');
    const existing = values.get(key) ?? [];
    if (existing.length > 0) throw new Error('FORMAT_QR_DUPLICATE');
    existing.push(value);
    values.set(key, existing);
  }
  for (const key of coreKeys) {
    const entries = values.get(key);
    if (!entries || entries.length !== 1 || entries[0] === '') throw new Error(`FORMAT_QR_CORE_${key.toUpperCase()}`);
  }
  const idText = values.get('id')?.[0] ?? '';
  const legacyId = Number(idText);
  if (!Number.isSafeInteger(legacyId) || legacyId < 0) throw new Error('FORMAT_QR_ID');
  const host = values.get('hn')?.[0] ?? '';
  if (host.includes('@') || host.includes('/') || host.includes('://') || host.length > 253) throw new Error('POLICY_QR_HOST');
  const rawPath = values.get('ul')?.[0] ?? '';
  if (rawPath.length > 8192) throw new Error('FORMAT_QR_PATH');
  const path = requestPath(host, rawPath);
  const name = values.get('na')?.[0] ?? '';
  if (name.length > 256) throw new Error('FORMAT_QR_NAME');

  return [
    {
      adapter: 'ovi-query-v1',
      legacyId,
      name,
      host,
      pathTemplate: path.pathTemplate,
      transportScheme: path.transportScheme,
      projection: 'unknown',
      rawCodes: Object.fromEntries(rawCodeKeys.map((key) => [key, values.get(key)?.[0] ?? ''])),
      opaqueFieldNames: opaqueExtensionKeys.filter((key) => values.has(key)),
      containsSensitiveQuery:
        path.containsSensitiveQuery || credentialKeys.some((key) => (values.get(key)?.[0]?.length ?? 0) > 0),
      queryParameters: path.queryParameters,
      requestPlanProvenance: {
        transportScheme: path.transportSchemeProvenance,
        hosts: 'parsed',
        pathTemplate: path.pathTemplateProvenance,
        queryParameters: path.queryParameterProvenance,
      },
      opaqueTemplate: path.opaqueTemplate,
      sourceDefinition: null,
    },
  ];
}
