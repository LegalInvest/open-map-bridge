import { decodeOmsQr } from './oms.js';
import { decodeOviQuery, type RawQrCandidate } from './ovi-query.js';

export function decodeQrPayload(payload: string): RawQrCandidate[] {
  if (new TextEncoder().encode(payload).length > 4096) throw new Error('INPUT_QR_LIMIT');
  if (payload.startsWith('ovobj?')) return decodeOviQuery(payload);
  if (payload.startsWith('oms1:')) return decodeOmsQr(payload);
  throw new Error('FORMAT_QR_HEAD');
}

export * from './oms.js';
export * from './ovi-query.js';
