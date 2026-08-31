import { parseMapSourceDefinition } from '@omb/source-schema';
import type { RawQrCandidate } from './ovi-query.js';

export function decodeOmsQr(payload: string): RawQrCandidate[] {
  if (!payload.startsWith('oms1:')) throw new Error('FORMAT_OMS_HEAD');
  const encoded = payload.slice(5).replace(/-/g, '+').replace(/_/g, '/');
  const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=');
  let json: string;
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('FORMAT_OMS_BASE64');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('FORMAT_OMS_JSON');
  }
  const source = parseMapSourceDefinition(raw);
  return [
    {
      adapter: 'oms-qr-v1',
      legacyId: source.legacyId,
      name: source.name,
      host: source.hosts[0] ?? '',
      pathTemplate: source.pathTemplate,
      transportScheme: source.transportScheme,
      projection: source.projection,
      rawCodes: {},
      opaqueFieldNames: [],
      containsSensitiveQuery:
        source.compatibilityExtension.credentialRequired === true || source.credentialRef !== null,
      queryParameters: source.queryParameters,
      requestPlanProvenance: source.requestPlanProvenance,
      opaqueTemplate: false,
      sourceDefinition: source,
    },
  ];
}
