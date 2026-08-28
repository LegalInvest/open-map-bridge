import { expect, it } from 'vitest';
import { buildApp } from '../app.js';
import type { GatewayAccessConfig } from './gateway-access.js';

const uiToken = 'u'.repeat(43);
const developerToken = 'd'.repeat(43);
const host = '127.0.0.1:4174';
const origin = 'http://127.0.0.1:5173';

function access(maxRequests = 100): GatewayAccessConfig {
  return {
    allowedHosts: [host],
    allowedOrigins: [origin],
    principals: [
      {
        id: 'omb.local.web',
        token: uiToken,
        permissions: ['gateway:ui', 'read-source-metadata', 'read-temporal-catalog', 'read-tiles'],
      },
      { id: 'org.example.metadata', token: developerToken, permissions: ['read-source-metadata'] },
    ],
    rateLimit: { maxRequests, windowMs: 60_000 },
  };
}

function uiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { host, origin, authorization: `Bearer ${uiToken}`, ...extra };
}

it('rejects untrusted host, origin, cross-site, missing token, and missing CSRF evidence', async () => {
  const app = await buildApp({ dataPath: null, access: access() });
  const untrustedHost = await app.inject({ method: 'GET', url: '/api/health', headers: { ...uiHeaders(), host: 'evil.test' } });
  expect(untrustedHost.statusCode).toBe(421);
  expect(untrustedHost.json()).toEqual({ error: 'host-not-allowed' });

  const untrustedOrigin = await app.inject({
    method: 'GET',
    url: '/api/health',
    headers: { ...uiHeaders(), origin: 'https://evil.test' },
  });
  expect(untrustedOrigin.statusCode).toBe(403);
  expect(untrustedOrigin.json()).toEqual({ error: 'origin-not-allowed' });

  const crossSite = await app.inject({
    method: 'GET',
    url: '/api/health',
    headers: uiHeaders({ 'sec-fetch-site': 'cross-site' }),
  });
  expect(crossSite.statusCode).toBe(403);

  const unauthenticated = await app.inject({ method: 'GET', url: '/api/health', headers: { host, origin } });
  expect(unauthenticated.statusCode).toBe(401);
  expect(unauthenticated.body).not.toContain(uiToken);

  const wrongToken = await app.inject({
    method: 'GET',
    url: '/api/health',
    headers: { ...uiHeaders(), authorization: `Bearer ${'x'.repeat(43)}` },
  });
  expect(wrongToken.statusCode).toBe(401);

  const missingCsrf = await app.inject({
    method: 'POST',
    url: '/api/import/inspect/qr',
    headers: uiHeaders(),
    payload: { payload: 'invalid' },
  });
  expect(missingCsrf.statusCode).toBe(403);
  expect(missingCsrf.json()).toEqual({ error: 'csrf-required' });

  const admittedCliMutation = await app.inject({
    method: 'POST',
    url: '/api/import/inspect/qr',
    headers: { host, authorization: `Bearer ${uiToken}`, 'x-omb-csrf': '1' },
    payload: { payload: 'invalid' },
  });
  expect(admittedCliMutation.statusCode).toBe(400);

  const admitted = await app.inject({ method: 'GET', url: '/api/health', headers: uiHeaders() });
  expect(admitted.statusCode).toBe(200);
  expect(admitted.headers['cache-control']).toBe('no-store');
  expect(admitted.headers['x-content-type-options']).toBe('nosniff');
  await app.close();
});

it('enforces developer app identity and server-side route permissions', async () => {
  const app = await buildApp({ dataPath: null, access: access() });
  const headers = {
    host,
    authorization: `Bearer ${developerToken}`,
    'x-omb-app-id': 'org.example.metadata',
  };
  const metadata = await app.inject({ method: 'GET', url: '/api/v1/developer/sources', headers });
  expect(metadata.statusCode).toBe(200);

  const dates = await app.inject({
    method: 'GET',
    url: '/api/v1/developer/sources/synthetic-lakes/dates?aoiId=area-1&from=2006-01-01&to=2025-12-31',
    headers,
  });
  expect(dates.statusCode).toBe(403);
  expect(dates.json()).toEqual({ error: 'permission-denied' });

  const uiRoute = await app.inject({ method: 'GET', url: '/api/aois', headers });
  expect(uiRoute.statusCode).toBe(403);
  expect(uiRoute.json()).toEqual({ error: 'permission-denied' });

  const wrongIdentity = await app.inject({
    method: 'GET',
    url: '/api/v1/developer/sources',
    headers: { ...headers, 'x-omb-app-id': 'org.example.other' },
  });
  expect(wrongIdentity.statusCode).toBe(403);
  expect(wrongIdentity.json()).toEqual({ error: 'app-id-mismatch' });
  await app.close();
});

it('rate-limits an authenticated principal without echoing its secret', async () => {
  const app = await buildApp({ dataPath: null, access: access(2) });
  expect((await app.inject({ method: 'GET', url: '/api/health', headers: uiHeaders() })).statusCode).toBe(200);
  expect((await app.inject({ method: 'GET', url: '/api/health', headers: uiHeaders() })).statusCode).toBe(200);
  const limited = await app.inject({ method: 'GET', url: '/api/health', headers: uiHeaders() });
  expect(limited.statusCode).toBe(429);
  expect(limited.json()).toEqual({ error: 'rate-limit-exceeded' });
  expect(limited.headers['retry-after']).toBeTruthy();
  expect(limited.body).not.toContain(uiToken);
  await app.close();
});
