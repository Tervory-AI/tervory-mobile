import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

test('security gate blocks high findings and incomplete reports while reporting warnings', async () => {
  const root = resolve('.tmp');
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(`${root}/security-test-`);
  const path = `${directory}/report.json`;
  try {
    for (const [severity, expected] of [['WARNING', 0], ['ERROR', 1], ['HIGH', 1], ['CRITICAL', 1], ['unknown', 1]]) {
      await writeFile(path, JSON.stringify({ results: [{ extra: { severity }, path: 'app.java', start: { line: 1 }, check_id: 'rule' }], errors: [] }));
      const result = spawnSync(process.execPath, ['scripts/check-semgrep.mjs', path], { encoding: 'utf8' });
      assert.equal(result.status, expected);
      assert.match(result.stdout, /app.java:1: rule/);
    }
    await writeFile(path, JSON.stringify({ results: [], errors: [{ level: 'error', message: 'scan failed' }] }));
    assert.equal(spawnSync(process.execPath, ['scripts/check-semgrep.mjs', path]).status, 1);
    await writeFile(path, '{}');
    assert.notEqual(spawnSync(process.execPath, ['scripts/check-semgrep.mjs', path]).status, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
