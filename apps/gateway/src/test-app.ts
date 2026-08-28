import { buildApp, type BuildAppOptions } from './app.js';

export function buildTestApp(options: Omit<BuildAppOptions, 'access'>) {
  return buildApp({ ...options, access: null });
}
