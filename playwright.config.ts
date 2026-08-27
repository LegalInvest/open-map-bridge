import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const e2eDataPath = join(tmpdir(), 'open-map-bridge-e2e', `${randomUUID()}.json`);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    env: { OMB_DATA_PATH: e2eDataPath },
    url: 'http://127.0.0.1:5173/api/health',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
