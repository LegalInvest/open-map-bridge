import { z } from 'zod';

export const automationStepKinds = [
  'source-confirmed',
  'network-policy',
  'credential-readiness',
  'runtime-binding',
] as const;

export type AutomationStepKind = (typeof automationStepKinds)[number];
export type AutomationStepStatus = 'pending' | 'running' | 'succeeded' | 'blocked' | 'skipped' | 'retryable-failed';
export type AutomationRunStatus = 'running' | 'awaiting-intervention' | 'completed' | 'partial' | 'blocked' | 'failed' | 'cancelled';

export interface InterventionRequest {
  kind: 'credential-vault' | 'source-reinspection' | 'local-bridge' | 'enterprise-host';
  message: string;
}

export interface AutomationStep {
  kind: AutomationStepKind;
  status: AutomationStepStatus;
  attempt: number;
  startedAt: string | null;
  endedAt: string | null;
  externalRequest: boolean;
  errorCode: string | null;
  message: string;
  nextAction: string;
}

export interface AutomationRun {
  schemaVersion: 1;
  id: string;
  processId: 'source-readiness';
  inputFingerprint: string;
  sourceId: string;
  sourceName: string;
  status: AutomationRunStatus;
  currentStep: AutomationStepKind | null;
  nextAction: string;
  intervention: InterventionRequest | null;
  createdAt: string;
  updatedAt: string;
  steps: AutomationStep[];
}

const stepSchema = z
  .object({
    kind: z.enum(automationStepKinds),
    status: z.enum(['pending', 'running', 'succeeded', 'blocked', 'skipped', 'retryable-failed']),
    attempt: z.number().int().min(0).max(100),
    startedAt: z.string().datetime().nullable(),
    endedAt: z.string().datetime().nullable(),
    externalRequest: z.boolean(),
    errorCode: z.string().min(1).max(128).nullable(),
    message: z.string().max(1024),
    nextAction: z.string().max(1024),
  })
  .strict();

export const automationRunSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    processId: z.literal('source-readiness'),
    inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    sourceId: z.string().min(1).max(160),
    sourceName: z.string().min(1).max(256),
    status: z.enum(['running', 'awaiting-intervention', 'completed', 'partial', 'blocked', 'failed', 'cancelled']),
    currentStep: z.enum(automationStepKinds).nullable(),
    nextAction: z.string().max(1024),
    intervention: z
      .object({
        kind: z.enum(['credential-vault', 'source-reinspection', 'local-bridge', 'enterprise-host']),
        message: z.string().min(1).max(1024),
      })
      .strict()
      .nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    steps: z.array(stepSchema).length(automationStepKinds.length),
  })
  .strict()
  .superRefine((run, context) => {
    const kinds = run.steps.map((step) => step.kind);
    if (new Set(kinds).size !== automationStepKinds.length || automationStepKinds.some((kind) => !kinds.includes(kind))) {
      context.addIssue({ code: 'custom', message: 'automation run must contain every step exactly once', path: ['steps'] });
    }
    if (run.status === 'completed' && run.steps.some((step) => !['succeeded', 'skipped'].includes(step.status))) {
      context.addIssue({ code: 'custom', message: 'completed run contains unfinished steps', path: ['status'] });
    }
    if (run.currentStep !== null && !kinds.includes(run.currentStep)) {
      context.addIssue({ code: 'custom', message: 'current step is not part of the run', path: ['currentStep'] });
    }
  });

export function parseAutomationRun(value: unknown): AutomationRun {
  return automationRunSchema.parse(value) as AutomationRun;
}
