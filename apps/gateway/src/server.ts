import { resolve } from 'node:path';
import { buildApp } from './app.js';
import { parseOviBridgeConfig } from './config.js';

const port = Number(process.env.OMB_GATEWAY_PORT ?? '4174');
const dataPath = process.env.OMB_DATA_PATH ?? resolve('data/temporal-state.json');
const ovi = parseOviBridgeConfig(process.env);
const app = await buildApp({
  dataPath,
  ...(ovi ? { ovi } : {}),
});

await app.listen({ host: '127.0.0.1', port });
