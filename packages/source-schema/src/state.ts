import type { SourceStatus } from './schema.js';

const transitions: Record<SourceStatus, readonly SourceStatus[]> = {
  received: ['parsed', 'invalid', 'unsupported', 'blocked'],
  parsed: ['confirmed', 'invalid', 'unsupported', 'blocked', 'needs-credential', 'needs-data'],
  confirmed: ['probed', 'probe-failed', 'blocked', 'disabled'],
  probed: ['rendered', 'render-failed', 'stale', 'disabled'],
  rendered: ['saved', 'render-failed', 'stale', 'disabled'],
  saved: ['stale', 'disabled'],
  invalid: [],
  unsupported: [],
  blocked: ['confirmed', 'disabled'],
  'needs-credential': ['confirmed', 'disabled'],
  'needs-data': ['confirmed', 'disabled'],
  'probe-failed': ['confirmed', 'disabled'],
  'render-failed': ['probed', 'disabled'],
  stale: ['confirmed', 'disabled'],
  disabled: ['confirmed'],
};

export function transitionSource(from: SourceStatus, to: SourceStatus): SourceStatus {
  if (!transitions[from].includes(to)) throw new Error(`invalid source transition: ${from} -> ${to}`);
  return to;
}

export function allowedSourceTransitions(from: SourceStatus): readonly SourceStatus[] {
  return transitions[from];
}
