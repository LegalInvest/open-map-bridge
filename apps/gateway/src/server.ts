import { resolve } from 'node:path';
import { buildApp } from './app.js';

const port = Number(process.env.OMB_GATEWAY_PORT ?? '4174');
const dataPath = process.env.OMB_DATA_PATH ?? resolve('data/temporal-state.json');
const oviPort = process.env.OMB_OVI_PORT;
const app = await buildApp({
  dataPath,
  ...(oviPort ? { ovi: { baseUrl: `http://127.0.0.1:${Number(oviPort)}`, mapType: 200 } } : {}),
});

await app.listen({ host: '127.0.0.1', port });
