import { expect, it } from 'vitest';
import { automationStepKinds, parseAutomationRun } from './automation.js';

function fixture() {
  return {
    schemaVersion: 1,
    id: '018f4d39-32f1-7a31-9f60-81c6b453b890',
    processId: 'source-readiness',
    inputFingerprint: 'a'.repeat(64),
    sourceId: '018f4d39-32f1-7a31-9f60-81c6b453b886',
    sourceName: 'Fixture',
    status: 'blocked',
    currentStep: 'runtime-binding',
    nextAction: '绑定运行时适配器',
    intervention: null,
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z',
    steps: automationStepKinds.map((kind) => ({
      kind,
      status: kind === 'runtime-binding' ? 'blocked' : 'succeeded',
      attempt: 1,
      startedAt: '2026-08-28T00:00:00.000Z',
      endedAt: '2026-08-28T00:00:00.000Z',
      externalRequest: false,
      errorCode: kind === 'runtime-binding' ? 'RUNTIME_BINDING_REQUIRED' : null,
      message: kind === 'runtime-binding' ? '尚未绑定' : '已通过',
      nextAction: kind === 'runtime-binding' ? '绑定运行时适配器' : '',
    })),
  };
}

it('accepts one complete, secret-free source-readiness ledger', () => {
  expect(parseAutomationRun(fixture()).steps).toHaveLength(4);
});

it('rejects completed runs with blocked steps or duplicate step kinds', () => {
  expect(() => parseAutomationRun({ ...fixture(), status: 'completed' })).toThrow();
  const duplicated = fixture();
  duplicated.steps[3] = { ...duplicated.steps[3]!, kind: 'network-policy' };
  expect(() => parseAutomationRun(duplicated)).toThrow();
});
