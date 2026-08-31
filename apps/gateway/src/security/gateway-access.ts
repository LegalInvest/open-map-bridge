import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export type GatewayPermission =
  | 'gateway:ui'
  | 'read-source-metadata'
  | 'read-map-tiles'
  | 'read-temporal-catalog'
  | 'read-tiles';

export interface GatewayPrincipal {
  id: string;
  token: string;
  permissions: readonly GatewayPermission[];
}

export interface GatewayAccessConfig {
  allowedHosts: readonly string[];
  allowedOrigins: readonly string[];
  principals: readonly GatewayPrincipal[];
  rateLimit: { maxRequests: number; windowMs: number };
}

interface WindowState {
  count: number;
  startedAt: number;
}

const safeMethods = new Set(['GET', 'HEAD']);

function singleHeader(value: string | string[] | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function tokenMatches(received: string, expected: string): boolean {
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(`Bearer ${expected}`);
  return receivedBytes.byteLength === expectedBytes.byteLength && timingSafeEqual(receivedBytes, expectedBytes);
}

function requiredPermission(request: FastifyRequest): GatewayPermission {
  const path = request.url.split('?', 1)[0] ?? request.url;
  if (/^\/api\/v1\/developer\/sources\/[^/]+\/map-tiles\//.test(path)) return 'read-map-tiles';
  if (/^\/api\/v1\/developer\/sources\/[^/]+\/tiles\//.test(path)) return 'read-tiles';
  if (/^\/api\/v1\/developer\/sources\/[^/]+\/dates$/.test(path)) return 'read-temporal-catalog';
  if (path === '/api/v1/developer/sources' || /^\/api\/v1\/developer\/sources\/[^/]+$/.test(path)) {
    return 'read-source-metadata';
  }
  return 'gateway:ui';
}

function deny(reply: FastifyReply, status: number, error: string): void {
  reply.code(status).send({ error });
}

export function registerGatewayAccessControl(app: FastifyInstance, config: GatewayAccessConfig): void {
  const allowedHosts = new Set(config.allowedHosts.map((value) => value.toLowerCase()));
  const allowedOrigins = new Set(config.allowedOrigins);
  const windows = new Map<string, WindowState>();

  app.addHook('onRequest', async (request, reply) => {
    reply.headers({
      'cache-control': 'no-store',
      'cross-origin-resource-policy': 'same-origin',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    });

    const host = singleHeader(request.headers.host)?.toLowerCase();
    if (!host || !allowedHosts.has(host)) {
      deny(reply, 421, 'host-not-allowed');
      return;
    }

    const origin = singleHeader(request.headers.origin);
    const fetchSite = singleHeader(request.headers['sec-fetch-site']);
    if (fetchSite === 'cross-site' || (origin !== null && !allowedOrigins.has(origin))) {
      deny(reply, 403, 'origin-not-allowed');
      return;
    }

    const authorization = singleHeader(request.headers.authorization);
    const principal = authorization
      ? config.principals.find((candidate) => tokenMatches(authorization, candidate.token))
      : undefined;
    if (!principal) {
      deny(reply, 401, 'authentication-required');
      return;
    }

    if (principal.id !== 'omb.local.web') {
      const appId = singleHeader(request.headers['x-omb-app-id']);
      if (appId !== principal.id) {
        deny(reply, 403, 'app-id-mismatch');
        return;
      }
    }

    const permission = requiredPermission(request);
    if (!principal.permissions.includes(permission)) {
      deny(reply, 403, 'permission-denied');
      return;
    }

    if (!safeMethods.has(request.method) && singleHeader(request.headers['x-omb-csrf']) !== '1') {
      deny(reply, 403, 'csrf-required');
      return;
    }

    const now = Date.now();
    const key = `${principal.id}:${request.ip}`;
    const previous = windows.get(key);
    const current = !previous || now - previous.startedAt >= config.rateLimit.windowMs
      ? { count: 1, startedAt: now }
      : { count: previous.count + 1, startedAt: previous.startedAt };
    windows.set(key, current);
    if (current.count > config.rateLimit.maxRequests) {
      const remainingMs = Math.max(1, config.rateLimit.windowMs - (now - current.startedAt));
      reply.header('retry-after', String(Math.ceil(remainingMs / 1_000)));
      deny(reply, 429, 'rate-limit-exceeded');
    }
  });
}
