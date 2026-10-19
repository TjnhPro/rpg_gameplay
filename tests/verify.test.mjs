import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
test('verification requires source, executes every gate, propagates failures, handles spaced Node paths', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rpg verify gates '));
  try {
    for (const folder of ['scripts', 'src', 'harness', 'docs']) fs.mkdirSync(path.join(temp, folder));
    for (const script of ['verify.mjs', 'check-boundaries.mjs', 'harness-selftest.mjs']) {
      fs.copyFileSync(path.join(root, 'scripts', script), path.join(temp, 'scripts', script));
    }
    for (const doc of ['AGENTS.md', 'ARCHITECTURE.md', 'docs/DECISIONS.md', 'docs/TASK_EXECUTION.md', 'docs/TESTING.md']) {
      fs.writeFileSync(path.join(temp, doc), 'orchestration test fixture');
    }
    fs.writeFileSync(path.join(temp, 'harness/modules.json'), JSON.stringify({schemaVersion:1,modules:[]}));
    fs.writeFileSync(path.join(temp, 'src/index.ts'), 'export {};');
    // These observable probe scripts are only fixture gates, never production tests.
    fs.writeFileSync(path.join(temp, 'gate.mjs'), `
import fs from 'node:fs';
const file='trace.json'; const trace=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):[];
trace.push(process.argv[2]); fs.writeFileSync(file,JSON.stringify(trace));
if(process.env.FAIL_GATE===process.argv[2]) process.exit(7);
`);
    const gates = ['build', 'typecheck', 'test:functional'];
    const pkg = {type:'module', scripts:Object.fromEntries(gates.map(name => [name, `node gate.mjs ${name}`]))};
    const writePkg = () => fs.writeFileSync(path.join(temp, 'package.json'), JSON.stringify(pkg));
    writePkg();
    let executable = process.execPath;
    if (!executable.includes(' ')) {
      executable = path.join(temp, process.platform === 'win32' ? 'node with spaces.exe' : 'node with spaces');
      fs.copyFileSync(process.execPath, executable);
      fs.chmodSync(executable, 0o755);
    }
    const run = (failure = '') => {
      fs.rmSync(path.join(temp, 'trace.json'), {force:true});
      return spawnSync(executable, ['scripts/verify.mjs'], {cwd:temp, shell:false,
        encoding:'utf8', env:{...process.env, FAIL_GATE:failure}});
    };
    const trace = () => fs.existsSync(path.join(temp, 'trace.json')) ? JSON.parse(fs.readFileSync(path.join(temp, 'trace.json'), 'utf8')) : [];
    let result = run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(trace(), gates);
    assert.match(result.stdout, /VERIFY_PASS/);
    for (const [index, gate] of gates.entries()) {
      result = run(gate);
      assert.equal(result.status, 7, result.stdout + result.stderr);
      assert.deepEqual(trace(), gates.slice(0, index + 1));
      assert.match(result.stderr, /VERIFY_FAIL/);
      assert.doesNotMatch(result.stdout, /VERIFY_PASS/);
    }
    for (const gate of gates) {
      const saved = pkg.scripts[gate]; delete pkg.scripts[gate]; writePkg();
      result = run();
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stderr, new RegExp(`missing '${gate}' script`));
      assert.deepEqual(trace(), []);
      pkg.scripts[gate] = saved;
    }
    writePkg();
    fs.renameSync(path.join(temp, 'src/index.ts'), path.join(temp, 'index.saved'));
    fs.writeFileSync(path.join(temp, 'src/other.ts'), 'export {};');
    // v0.1.0 requires its entrypoint even if other source or stale build output exists.
    fs.mkdirSync(path.join(temp, 'dist'));
    fs.writeFileSync(path.join(temp, 'dist/index.js'), 'export {};');
    for (const state of ['missing entrypoint', 'empty src', 'missing src']) {
      if (state === 'empty src') fs.rmSync(path.join(temp, 'src/other.ts'));
      if (state === 'missing src') fs.rmdirSync(path.join(temp, 'src'));
      result = run();
      assert.equal(result.status, 1, `${state}: ${result.stdout}${result.stderr}`);
      assert.match(result.stderr, /VERIFY_FAIL: required production entrypoint src\/index\.ts is missing/);
      assert.doesNotMatch(result.stdout, /VERIFY_PASS|HARNESS_VERIFIED/);
      assert.deepEqual(trace(), []);
    }
  } finally {
    const resolved = fs.realpathSync(temp);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('rpg verify gates '));
    fs.rmSync(resolved, {recursive:true,force:true});
  }
});
