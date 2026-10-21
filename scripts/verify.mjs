#!/usr/bin/env node
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
function fail(message) {
  console.error(`VERIFY_FAIL: ${message}`);
  process.exit(1);
}
if (!fs.existsSync(new URL('../src/index.ts', import.meta.url))) fail('Required source src/index.ts is missing.');
for (const dependency of ['typescript/bin/tsc', '@rpg/core/package.json']) {
  if (!fs.existsSync(new URL(`../node_modules/${dependency}`, import.meta.url))) {
    fail('Dependencies missing. Setup: npm run core:prepare then npm ci --ignore-scripts.');
  }
}
const npmCli = process.env.npm_execpath;
if (!npmCli || !fs.existsSync(npmCli)) fail('Run verification with npm run verify.');
for (const step of ['harness:check', 'build', 'typecheck', 'test:functional']) {
  console.log(`VERIFY_STEP: ${step}`);
  const result = spawnSync(process.execPath, [npmCli, 'run', step], {cwd: root, stdio: 'inherit', shell: false});
  if (result.error || result.status !== 0) {
    fail(`${step} failed (${result.error?.message ?? result.signal ?? result.status}).`);
  }
}
console.log('VERIFY_PASS: boundaries, build, strict typecheck and selected direct function tests.');
