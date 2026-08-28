import { resolve } from 'node:path';
import { buildApp } from './app.js';
import { parseGatewayServerConfig, parseOviBridgeConfig } from './config.js';

const gateway = parseGatewayServerConfig(process.env);
const dataPath = process.env.OMB_DATA_PATH ?? resolve('data/temporal-state.json');
const ovi = parseOviBridgeConfig(process.env);
const app = await buildApp({
  dataPath,
  access: gateway.access,
  ...(ovi ? { ovi } : {}),
});

await app.listen({ host: '127.0.0.1', port: gateway.port });
