import { createHash, randomUUID } from 'node:crypto';
import type { AutomationRun, AutomationStep, MapSourceDefinition } from '@omb/source-schema';
import type { TemporalStateRepository } from '../storage/temporal-state.js';
import type { TemporalSourceRecord, TemporalSourceRegistry } from '../temporal/registry.js';
import { inspectSourceNetworkPolicy } from '../security/source-policy.js';
import type { CredentialVault } from '../security/credential-vault.js';

const readySourceStatuses = new Set(['confirmed', 'probed', 'rendered', 'saved']);

function fingerprint(
  source: MapSourceDefinition,
  runtime: TemporalSourceRecord | null,
  credentialVault: Pick<CredentialVault, 'has'> | null,
): string {
  const evidence = {
    processId: 'source-readiness',
    evaluatorVersion: 1,
    policyVersion: 1,
    sourceId: source.id,
    status: source.status,
    updatedAt: source.updatedAt,
    credentialConfigured: source.credentialRef !== null && credentialVault?.has(source.credentialRef) === true,
    hosts: source.hosts,
    pathTemplate: source.pathTemplate,
    compatibilityExtension: source.compatibilityExtension,
    runtime: runtime
      ? { id: runtime.id, kind: runtime.kind, legacyMapType: runtime.legacyMapType ?? null, availability: runtime.availability }
      : null,
  };
  return createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
}

function pending(kind: AutomationStep['kind']): AutomationStep {
  return {
    kind,
    status: 'pending',
    attempt: 0,
    startedAt: null,
    endedAt: null,
    externalRequest: false,
    errorCode: null,
    message: '等待前置步骤',
    nextAction: '',
  };
}

function evaluated(
  kind: AutomationStep['kind'],
  at: string,
  status: AutomationStep['status'],
  message: string,
  nextAction = '',
  errorCode: string | null = null,
): AutomationStep {
  return {
    kind,
    status,
    attempt: 1,
    startedAt: at,
    endedAt: at,
    externalRequest: false,
    errorCode,
    message,
    nextAction,
  };
}

function runtimeFor(source: MapSourceDefinition, registry: TemporalSourceRegistry): TemporalSourceRecord | null {
  return registry.get(source.id);
}

export function buildSourceReadinessRun(
  source: MapSourceDefinition,
  registry: TemporalSourceRegistry,
  at = new Date().toISOString(),
  credentialVault: Pick<CredentialVault, 'has'> | null = null,
): AutomationRun {
  const runtime = runtimeFor(source, registry);
  const steps: AutomationStep[] = [
    pending('source-confirmed'),
    pending('network-policy'),
    pending('credential-readiness'),
    pending('runtime-binding'),
  ];
  const base = {
    schemaVersion: 1 as const,
    id: randomUUID(),
    processId: 'source-readiness' as const,
    inputFingerprint: fingerprint(source, runtime, credentialVault),
    sourceId: source.id,
    sourceName: source.name,
    createdAt: at,
    updatedAt: at,
    steps,
  };

  if (!readySourceStatuses.has(source.status)) {
    steps[0] = evaluated(
      'source-confirmed',
      at,
      'blocked',
      `图源当前状态为 ${source.status}，尚未完成授权保存`,
      '返回图源导入页，完成预览、授权确认和保存',
      'SOURCE_NOT_CONFIRMED',
    );
    return {
      ...base,
      status: 'blocked',
      currentStep: 'source-confirmed',
      nextAction: steps[0].nextAction,
      intervention: { kind: 'source-reinspection', message: steps[0].message },
    };
  }
  steps[0] = evaluated('source-confirmed', at, 'succeeded', '图源已授权保存；这不代表服务器或瓦片已经验证');

  const policy = inspectSourceNetworkPolicy(source);
  if (policy.decision !== 'allowed') {
    steps[1] = evaluated('network-policy', at, 'blocked', policy.message, policy.nextAction, policy.code);
    return {
      ...base,
      status: policy.decision === 'intervention' ? 'awaiting-intervention' : 'blocked',
      currentStep: 'network-policy',
      nextAction: policy.nextAction,
      intervention:
        policy.decision === 'intervention' ? { kind: 'enterprise-host', message: policy.message } : null,
    };
  }
  steps[1] = evaluated('network-policy', at, 'succeeded', policy.message);

  const needsOviBridge = source.compatibilityExtension.needsOviBridge === true;
  const credentialRequired = source.compatibilityExtension.credentialRequired;
  const credentialAvailable = source.credentialRef !== null && credentialVault?.has(source.credentialRef) === true;
  if (needsOviBridge) {
    steps[2] = evaluated(
      'credential-readiness',
      at,
      'skipped',
      '不透明奥维配置由受控本机桥处理；开放任务账本不保存或展示私有内容',
    );
  } else if (source.credentialRef !== null && !credentialAvailable) {
    steps[2] = evaluated(
      'credential-readiness',
      at,
      'blocked',
      '图源的凭证引用在当前本地保险库中不存在或不可用',
      '在本地图源页重新加密保存凭证，再运行检查',
      'CREDENTIAL_VAULT_REQUIRED',
    );
    return {
      ...base,
      status: 'awaiting-intervention',
      currentStep: 'credential-readiness',
      steps,
      nextAction: steps[2].nextAction,
      intervention: { kind: 'credential-vault', message: steps[2].message },
    };
  } else if (credentialRequired === true && !credentialAvailable) {
    steps[2] = evaluated(
      'credential-readiness',
      at,
      'blocked',
      '导入时发现疑似凭证参数并已脱敏，但尚未配置本地凭证引用',
      '在本地图源页重新加密保存凭证，再运行检查',
      'CREDENTIAL_VAULT_REQUIRED',
    );
    return {
      ...base,
      status: 'awaiting-intervention',
      currentStep: 'credential-readiness',
      nextAction: steps[2].nextAction,
      intervention: { kind: 'credential-vault', message: steps[2].message },
    };
  } else if (credentialRequired !== true && credentialRequired !== false && !credentialAvailable) {
    steps[2] = evaluated(
      'credential-readiness',
      at,
      'blocked',
      '旧版保存记录没有凭证需求判定，不能把未知误报为无需凭证',
      '重新导入同一图源以补齐脱敏元数据',
      'CREDENTIAL_REQUIREMENT_UNKNOWN',
    );
    return {
      ...base,
      status: 'awaiting-intervention',
      currentStep: 'credential-readiness',
      nextAction: steps[2].nextAction,
      intervention: { kind: 'source-reinspection', message: steps[2].message },
    };
  } else {
    steps[2] = evaluated(
      'credential-readiness',
      at,
      'succeeded',
      credentialAvailable ? '已配置且当前保险库可解析凭证引用；任务账本不暴露引用内容' : '导入证据未发现固定凭证需求',
    );
  }

  if (!runtime) {
    const message = needsOviBridge ? '没有配置可承接该图源的奥维本机桥' : '没有绑定可承接该图源的时序瓦片适配器';
    const nextAction = needsOviBridge ? '配置受控奥维本机桥并完成源级绑定' : '实现并绑定安全瓦片适配器';
    steps[3] = evaluated('runtime-binding', at, 'blocked', message, nextAction, 'RUNTIME_NOT_BOUND');
    return {
      ...base,
      status: needsOviBridge ? 'awaiting-intervention' : 'blocked',
      currentStep: 'runtime-binding',
      nextAction,
      intervention: needsOviBridge ? { kind: 'local-bridge', message } : null,
    };
  }
  if (runtime.availability !== 'ready') {
    const message = `${runtime.name} 已配置但尚未通过运行时就绪验收`;
    steps[3] = evaluated('runtime-binding', at, 'blocked', message, '完成运行时健康检查和源级绑定后重试', 'RUNTIME_NOT_READY');
    return {
      ...base,
      status: runtime.kind === 'ovi-bridge' ? 'awaiting-intervention' : 'blocked',
      currentStep: 'runtime-binding',
      nextAction: steps[3].nextAction,
      intervention: runtime.kind === 'ovi-bridge' ? { kind: 'local-bridge', message } : null,
    };
  }
  steps[3] = evaluated('runtime-binding', at, 'succeeded', `${runtime.name} 已就绪；本任务仍未发出上游请求`);
  return {
    ...base,
    status: 'completed',
    currentStep: null,
    nextAction: '进入独立的真实探测验收；本任务本身不证明瓦片可用',
    intervention: null,
  };
}

export class SourceReadinessService {
  constructor(
    private readonly repository: TemporalStateRepository,
    private readonly registry: TemporalSourceRegistry,
    private readonly credentialVault: Pick<CredentialVault, 'has'> | null = null,
  ) {}

  async start(sourceId: string): Promise<{ run: AutomationRun; created: boolean }> {
    const source = this.repository.listImportSources().find((entry) => entry.id === sourceId);
    if (!source) throw new Error('source-not-found');
    return this.repository.ensureAutomationRun(buildSourceReadinessRun(source, this.registry, new Date().toISOString(), this.credentialVault));
  }
}
