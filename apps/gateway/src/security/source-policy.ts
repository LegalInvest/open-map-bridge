import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';
import type { MapSourceDefinition } from '@omb/source-schema';

export type SourcePolicyResult =
  | { decision: 'allowed'; code: null; message: string; nextAction: string }
  | { decision: 'blocked'; code: string; message: string; nextAction: string }
  | { decision: 'intervention'; code: string; message: string; nextAction: string };

interface HostParts {
  hostname: string;
  port: number | null;
}

function splitHost(value: string): HostParts | null {
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    if (end < 0) return null;
    const suffix = value.slice(end + 1);
    if (suffix !== '' && !/^:\d+$/.test(suffix)) return null;
    return { hostname: value.slice(1, end), port: suffix ? Number(suffix.slice(1)) : null };
  }
  const colonCount = [...value].filter((character) => character === ':').length;
  if (colonCount === 1) {
    const [hostname, portText] = value.split(':');
    if (!hostname || !portText || !/^\d+$/.test(portText)) return null;
    return { hostname, port: Number(portText) };
  }
  return { hostname: value, port: null };
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [a, b] = octets as [number, number, number, number];
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function isSensitiveIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    return mapped === '169.254.169.254' || mapped === '100.100.100.200' || isPrivateIpv4(mapped);
  }
  return normalized === '::' || normalized === '::1' || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb') || normalized.startsWith('fc') || normalized.startsWith('fd');
}

function inspectHost(rawHost: string): SourcePolicyResult {
  const parts = splitHost(rawHost.trim().toLowerCase());
  if (!parts || !parts.hostname || (parts.port !== null && (!Number.isInteger(parts.port) || parts.port < 1 || parts.port > 65_535))) {
    return { decision: 'blocked', code: 'POLICY_HOST_INVALID', message: '图源主机格式无效', nextAction: '修正主机后重新导入' };
  }
  if (parts.port !== null && ![80, 443].includes(parts.port)) {
    return {
      decision: 'intervention',
      code: 'POLICY_ENTERPRISE_PORT_REVIEW',
      message: `图源使用非标准端口 ${parts.port}，默认不允许外联`,
      nextAction: '后续在企业主机授权页逐主机确认',
    };
  }
  const hostname = parts.hostname;
  if (
    hostname === '169.254.169.254' ||
    hostname === '100.100.100.200' ||
    hostname === 'metadata.google.internal' ||
    hostname === '::ffff:169.254.169.254' ||
    hostname === '::ffff:100.100.100.200'
  ) {
    return { decision: 'blocked', code: 'POLICY_METADATA_HOST', message: '云元数据地址永久禁止', nextAction: '移除该图源' };
  }
  const ipVersion = isIP(hostname);
  if (ipVersion === 4 || ipVersion === 6) {
    const sensitive = ipVersion === 4 ? isPrivateIpv4(hostname) : isSensitiveIpv6(hostname);
    return {
      decision: 'intervention',
      code: sensitive ? 'POLICY_PRIVATE_IP_REVIEW' : 'POLICY_BARE_IP_REVIEW',
      message: sensitive ? '图源指向私网、回环或链路本地 IP，默认不允许外联' : '图源使用裸 IP，默认不允许外联',
      nextAction: '后续在企业主机授权页逐主机确认；云元数据地址不可放行',
    };
  }
  const ascii = domainToASCII(hostname);
  if (!ascii || ascii.length > 253 || ascii.includes('..')) {
    return { decision: 'blocked', code: 'POLICY_HOST_INVALID', message: '图源域名无效', nextAction: '修正主机后重新导入' };
  }
  if (ascii === 'localhost' || ascii.endsWith('.localhost')) {
    return { decision: 'blocked', code: 'POLICY_LOOPBACK_HOST', message: '任意导入图源不能直接访问 localhost', nextAction: '使用受控本机桥接适配器' };
  }
  if (!ascii.includes('.') || ascii.endsWith('.local') || ascii.endsWith('.internal')) {
    return {
      decision: 'intervention',
      code: 'POLICY_ENTERPRISE_HOST_REVIEW',
      message: '图源可能是企业内网主机，默认不允许外联',
      nextAction: '后续在企业主机授权页逐主机确认',
    };
  }
  return { decision: 'allowed', code: null, message: '静态主机策略通过；真实请求前仍须校验 DNS 解析结果', nextAction: '' };
}

export function inspectSourceNetworkPolicy(source: MapSourceDefinition): SourcePolicyResult {
  const lowerPath = source.pathTemplate.toLowerCase();
  if (
    !source.pathTemplate.startsWith('/') ||
    source.pathTemplate.startsWith('//') ||
    source.pathTemplate.includes('\\') ||
    source.pathTemplate.includes('#') ||
    /[\u0000-\u001f\u007f]/.test(source.pathTemplate) ||
    source.pathTemplate.split('/').includes('..') ||
    lowerPath.includes('%2e') ||
    lowerPath.includes('%2f') ||
    lowerPath.includes('%5c')
  ) {
    return {
      decision: 'blocked',
      code: 'POLICY_PATH_TEMPLATE',
      message: '瓦片路径不是安全的站内绝对路径',
      nextAction: '修正路径模板后重新导入',
    };
  }
  const needsOviBridge = source.compatibilityExtension.needsOviBridge === true;
  if (!needsOviBridge) {
    const untrusted = new Set(['not-provided', 'redacted', 'legacy-unknown']);
    const provenance = source.requestPlanProvenance;
    if (
      untrusted.has(provenance.hosts) ||
      untrusted.has(provenance.pathTemplate) ||
      Object.values(provenance.queryParameters).some((value) => untrusted.has(value))
    ) {
      return {
        decision: 'intervention',
        code: 'POLICY_REQUEST_PLAN_UNVERIFIED',
        message: '图源请求主机、路径或公开参数仍含未确认字段，默认不允许外联',
        nextAction: '重新导入或人工校正请求计划字段后再检查',
      };
    }
    if (source.transportScheme === 'unknown') {
      return {
        decision: 'intervention',
        code: 'POLICY_TRANSPORT_SCHEME_UNKNOWN',
        message: '图源没有可证实的 HTTP/HTTPS 传输协议，默认不允许外联',
        nextAction: '重新导入带完整 URL 的图源，或人工确认传输协议',
      };
    }
    if (source.transportScheme === 'http') {
      return {
        decision: 'intervention',
        code: 'POLICY_INSECURE_TRANSPORT_REVIEW',
        message: '图源使用明文 HTTP，默认不允许携带凭证或直接外联',
        nextAction: '优先改用 HTTPS；确需 HTTP 时进行逐源风险确认',
      };
    }
  }
  for (const host of source.hosts) {
    const result = inspectHost(host);
    if (result.decision !== 'allowed') return result;
  }
  return {
    decision: 'allowed',
    code: null,
    message: '所有主机通过零外联静态策略；尚未执行 DNS 或 HTTP 探测',
    nextAction: '',
  };
}
