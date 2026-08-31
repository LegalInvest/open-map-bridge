import { randomUUID } from 'node:crypto';
import type { RawOviLayer37 } from '@omb/ovmap-codec';
import type { RawQrCandidate } from '@omb/qr-import';
import {
  appError,
  isSafeNonSecretQueryParameter,
  parseMapSourceDefinition,
  type FieldProvenance,
  type ImportLayerCandidate,
  type MapSourceDefinition,
  type TileFormat,
  type TransportScheme,
} from '@omb/source-schema';

function formatFromPath(path: string): TileFormat {
  const clean = path.split('?', 1)[0]?.toLowerCase() ?? '';
  if (clean.endsWith('.png')) return 'png';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'jpg';
  if (clean.endsWith('.webp')) return 'webp';
  return 'unknown';
}

function sanitizePath(raw: string): {
  pathTemplate: string;
  queryParameters: Record<string, string>;
  queryParameterProvenance: Record<string, FieldProvenance>;
  redactedCredential: boolean;
} {
  const question = raw.indexOf('?');
  if (question < 0) {
    return { pathTemplate: raw, queryParameters: {}, queryParameterProvenance: {}, redactedCredential: false };
  }
  const queryParameters: Record<string, string> = {};
  const queryParameterProvenance: Record<string, FieldProvenance> = {};
  let redactedCredential = false;
  const seen = new Set<string>();
  for (const item of raw.slice(question + 1).split('&')) {
    const equals = item.indexOf('=');
    const key = equals >= 0 ? item.slice(0, equals) : item;
    const value = equals >= 0 ? item.slice(equals + 1) : '';
    if (seen.has(key)) {
      redactedCredential = true;
      delete queryParameters[key];
      delete queryParameterProvenance[key];
      continue;
    }
    seen.add(key);
    if (!isSafeNonSecretQueryParameter(key, value)) {
      redactedCredential = true;
      continue;
    }
    queryParameters[key] = value;
    queryParameterProvenance[key] = 'parsed';
  }
  return {
    pathTemplate: raw.slice(0, question) || '/',
    queryParameters,
    queryParameterProvenance,
    redactedCredential,
  };
}

function sanitizeQueryRecord(
  values: Record<string, string>,
  provenance: Record<string, FieldProvenance>,
): {
  queryParameters: Record<string, string>;
  queryParameterProvenance: Record<string, FieldProvenance>;
  redactedCredential: boolean;
} {
  const queryParameters: Record<string, string> = {};
  const queryParameterProvenance: Record<string, FieldProvenance> = {};
  let redactedCredential = false;
  for (const [key, value] of Object.entries(values)) {
    if (!isSafeNonSecretQueryParameter(key, value)) {
      redactedCredential = true;
      continue;
    }
    queryParameters[key] = value;
    queryParameterProvenance[key] = provenance[key] ?? 'legacy-unknown';
  }
  return { queryParameters, queryParameterProvenance, redactedCredential };
}

function normalizeHost(rawHost: string): {
  host: string;
  transportScheme: TransportScheme;
  transportSchemeProvenance: FieldProvenance;
} {
  if (!rawHost.startsWith('https://') && !rawHost.startsWith('http://')) {
    return { host: rawHost, transportScheme: 'unknown', transportSchemeProvenance: 'not-provided' };
  }
  let url: URL;
  try {
    url = new URL(rawHost);
  } catch {
    throw new Error('FORMAT_SOURCE_HOST_URL');
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '' && url.pathname !== '/')) {
    throw new Error('POLICY_SOURCE_HOST_URL');
  }
  return {
    host: url.host,
    transportScheme: url.protocol === 'https:' ? 'https' : 'http',
    transportSchemeProvenance: 'parsed',
  };
}

function candidateFromSource(
  source: MapSourceDefinition,
  redactedCredential: boolean,
  requiresCompanionData = false,
): ImportLayerCandidate {
  const warnings = source.projection === 'unknown' ? [
    appError('PROJECTION_UNKNOWN', '投影尚未从当前格式证据中确认', {
      retryable: true,
      nextAction: '保存后在探测前选择并验证投影',
    }),
  ] : [];
  if (redactedCredential) {
    warnings.push(
      appError('CREDENTIAL_REQUIRED', '检测到未验证或疑似凭证参数，已从开放定义中移除', {
        retryable: true,
        nextAction: '后续通过本地凭证保险库重新输入',
      }),
    );
  }
  if (requiresCompanionData) {
    warnings.push(
      appError('DATA_OPAQUE_TEMPLATE', '该二维码使用不透明的奥维协议配置，未把私有内容写入开放定义', {
        retryable: true,
        nextAction: '通过本机奥维桥接或后续凭证保险库完成真实探测',
      }),
    );
  }
  return {
    candidateId: randomUUID(),
    source,
    selectable: true,
    warnings,
    requiresCredential: redactedCredential,
    requiresCompanionData,
  };
}

function baseSource(input: {
  name: string;
  legacyId: number | null;
  sourceKind: 'qr' | 'ovmap' | 'oms';
  adapter: string;
  inputSha256: string;
  host: string;
  pathTemplate: string;
  transportScheme: TransportScheme;
  queryParameters: Record<string, string>;
  requestPlanProvenance: MapSourceDefinition['requestPlanProvenance'];
  maxZoom: number;
  createdAt: string;
  compatibilityExtension?: Record<string, unknown>;
}): MapSourceDefinition {
  return parseMapSourceDefinition({
    schemaVersion: 1,
    id: randomUUID(),
    legacyId: input.legacyId,
    name: input.name,
    sourceKind: input.sourceKind,
    protocol: 'ovi-template',
    projection: 'unknown',
    minZoom: 0,
    maxZoom: input.maxZoom,
    tileSize: 256,
    format: formatFromPath(input.pathTemplate),
    transportScheme: input.transportScheme,
    hosts: [input.host],
    pathTemplate: input.pathTemplate,
    queryParameters: input.queryParameters,
    requestPlanProvenance: input.requestPlanProvenance,
    credentialRef: null,
    attribution: null,
    license: null,
    sourceProvenance: { inputSha256: input.inputSha256, adapter: input.adapter },
    compatibilityExtension: input.compatibilityExtension ?? {},
    status: 'parsed',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    lastVerifiedAt: null,
  });
}

export function normalizeOviLayer(
  layer: RawOviLayer37,
  inputSha256: string,
  createdAt: string,
): ImportLayerCandidate {
  const safe = sanitizePath(layer.pathTemplate);
  const endpoint = normalizeHost(layer.host);
  const source = baseSource({
    name: layer.name,
    legacyId: layer.legacyId,
    sourceKind: 'ovmap',
    adapter: 'ovmap-record37-zlib',
    inputSha256,
    host: endpoint.host,
    pathTemplate: safe.pathTemplate,
    transportScheme: endpoint.transportScheme,
    queryParameters: safe.queryParameters,
    requestPlanProvenance: {
      transportScheme: endpoint.transportSchemeProvenance,
      hosts: 'parsed',
      pathTemplate: 'parsed',
      queryParameters: safe.queryParameterProvenance,
    },
    maxZoom: Math.min(layer.maxZoom, 30),
    createdAt,
    compatibilityExtension: { credentialRequired: safe.redactedCredential },
  });
  return candidateFromSource(source, safe.redactedCredential);
}

export function normalizeQrCandidate(
  candidate: RawQrCandidate,
  inputSha256: string,
  createdAt: string,
): ImportLayerCandidate {
  if (candidate.sourceDefinition) {
    const original = candidate.sourceDefinition;
    const path = sanitizePath(original.pathTemplate);
    const query = sanitizeQueryRecord(original.queryParameters, original.requestPlanProvenance.queryParameters);
    const queryParameters = { ...path.queryParameters, ...query.queryParameters };
    const queryParameterProvenance = { ...path.queryParameterProvenance, ...query.queryParameterProvenance };
    const duplicateQueryKeys = Object.keys(path.queryParameters).filter((key) => key in query.queryParameters);
    for (const key of duplicateQueryKeys) {
      delete queryParameters[key];
      delete queryParameterProvenance[key];
    }
    const redactedCredential =
      candidate.containsSensitiveQuery ||
      path.redactedCredential ||
      query.redactedCredential ||
      duplicateQueryKeys.length > 0;
    const source = parseMapSourceDefinition({
      ...original,
      id: randomUUID(),
      sourceKind: 'oms',
      pathTemplate: path.pathTemplate,
      queryParameters,
      requestPlanProvenance: {
        ...original.requestPlanProvenance,
        pathTemplate: original.requestPlanProvenance.pathTemplate,
        queryParameters: queryParameterProvenance,
      },
      credentialRef: null,
      sourceProvenance: { inputSha256, adapter: candidate.adapter },
      compatibilityExtension: {
        ...original.compatibilityExtension,
        credentialRequired: redactedCredential,
      },
      status: 'parsed',
      createdAt,
      updatedAt: createdAt,
      lastVerifiedAt: null,
    });
    return candidateFromSource(source, redactedCredential);
  }
  const source = baseSource({
    name: candidate.name,
    legacyId: candidate.legacyId,
    sourceKind: candidate.adapter === 'oms-qr-v1' ? 'oms' : 'qr',
    adapter: candidate.adapter,
    inputSha256,
    host: candidate.host,
    pathTemplate: candidate.pathTemplate,
    transportScheme: candidate.transportScheme,
    queryParameters: candidate.queryParameters,
    requestPlanProvenance: candidate.requestPlanProvenance,
    maxZoom: 0,
    createdAt,
    compatibilityExtension: {
      credentialRequired: candidate.containsSensitiveQuery,
      ...(candidate.opaqueFieldNames.length > 0
        ? { observedOpaqueFields: candidate.opaqueFieldNames }
        : {}),
      ...(candidate.opaqueTemplate ? { opaqueTemplate: true, needsOviBridge: true } : {}),
    },
  });
  return candidateFromSource(source, candidate.containsSensitiveQuery, candidate.opaqueTemplate);
}
