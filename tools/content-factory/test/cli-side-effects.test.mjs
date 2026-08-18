import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { executeCli } from '../cli.mjs';

const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));

function outputBuffer() {
  let value = '';
  return {
    stream: { write(chunk) { value += String(chunk); } },
    read() { return value; },
  };
}

function forbiddenEnvironment() {
  return new Proxy({}, {
    get(_target, key) {
      throw new Error(`plan read environment key ${String(key)}`);
    },
  });
}

test('plan reads content only: no environment, fetch, or filesystem writer capability', async () => {
  const stdout = outputBuffer();
  let fetchCalls = 0;
  let reads = 0;
  const dependencies = {
    root: workspaceRoot,
    readFile: async (...args) => {
      reads += 1;
      return readFile(...args);
    },
    env: forbiddenEnvironment(),
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('plan attempted network access');
    },
    stdout: stdout.stream,
    stderr: outputBuffer().stream,
  };
  Object.defineProperty(dependencies, 'writeFile', {
    get() { throw new Error('plan requested a filesystem writer'); },
  });

  const execution = await executeCli(['plan', '--json'], dependencies);
  const plan = JSON.parse(stdout.read());
  assert.ok(reads > 0);
  assert.equal(fetchCalls, 0);
  assert.equal(execution.exitCode, 0);
  assert.equal(plan.mode, 'planning_only');
  assert.equal(plan.dispatchable_job_count, 0);
  assert.equal(plan.paid_dispatch_authorized, false);
});

test('inventory --check reports blockers without network or credential reads', async () => {
  const stdout = outputBuffer();
  let fetchCalls = 0;
  const execution = await executeCli(['inventory', '--json', '--check'], {
    root: workspaceRoot,
    env: forbiddenEnvironment(),
    fetchImpl: async () => { fetchCalls += 1; },
    stdout: stdout.stream,
    stderr: outputBuffer().stream,
  });
  const inventory = JSON.parse(stdout.read());
  assert.equal(execution.exitCode, 2);
  assert.equal(fetchCalls, 0);
  assert.equal(inventory.totals.top_level_unit_count, 132);
  assert.ok(inventory.blockers.length > 0);
});
