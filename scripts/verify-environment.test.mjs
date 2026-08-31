import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateEnvironment } from './verify-environment.mjs';

test('requires supported Node and eight GiB free', () => {
  assert.equal(evaluateEnvironment({ nodeMajor: 23, npmMajor: 11, freeBytes: 9n * 1024n ** 3n }).ok, false);
  assert.equal(evaluateEnvironment({ nodeMajor: 26, npmMajor: 10, freeBytes: 9n * 1024n ** 3n }).ok, false);
  assert.equal(evaluateEnvironment({ nodeMajor: 26, npmMajor: 11, freeBytes: 7n * 1024n ** 3n }).ok, false);
  assert.deepEqual(evaluateEnvironment({ nodeMajor: 26, npmMajor: 11, freeBytes: 8n * 1024n ** 3n }), {
    ok: true,
    errors: [],
  });
});

test('all supported heavyweight root commands run the environment gate first', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const heavyweightCommands = [
    'test',
    'test:production',
    'test:compat',
    'test:e2e',
    'test:e2e:authorized-qr',
    'typecheck',
    'build',
    'dev',
    'fixtures:acquire',
  ];

  for (const command of heavyweightCommands) {
    assert.equal(packageJson.scripts[`pre${command}`], 'npm run env:check', command);
  }
});
