import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEnvironment } from './verify-environment.mjs';

test('requires supported Node and five GiB free', () => {
  assert.equal(evaluateEnvironment({ nodeMajor: 23, freeBytes: 9n * 1024n ** 3n }).ok, false);
  assert.equal(evaluateEnvironment({ nodeMajor: 26, freeBytes: 4n * 1024n ** 3n }).ok, false);
  assert.deepEqual(evaluateEnvironment({ nodeMajor: 26, freeBytes: 5n * 1024n ** 3n }), {
    ok: true,
    errors: [],
  });
});
