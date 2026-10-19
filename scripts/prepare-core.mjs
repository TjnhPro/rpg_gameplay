import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {run, npmCli} from './subprocess.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const pin = JSON.parse(fs.readFileSync(path.join(root, 'harness/core-pin.json'), 'utf8'));
assert.match(pin.revision, /^[0-9a-f]{40}$/);
assert.equal(pin.artifact, `rpg-core-${pin.version}.tgz`);
const artifacts = path.join(root, '.artifacts');
fs.mkdirSync(artifacts, {recursive: true});
const cli = npmCli();
const locked = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8')).packages['node_modules/@rpg/core'];
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rpg-core-package '));
const checkout = path.join(temp, 'checkout');
try {
  run('git', ['-c', 'core.autocrlf=false', 'clone', '--no-checkout', pin.repository, checkout], root);
  run('git', ['-c', 'core.autocrlf=false', 'checkout', '--detach', pin.revision], checkout);
  assert.equal(run('git', ['rev-parse', 'HEAD'], checkout, true).trim(), pin.revision);
  const pkg = JSON.parse(fs.readFileSync(path.join(checkout, 'package.json'), 'utf8'));
  assert.equal(pkg.name, pin.name);
  assert.equal(pkg.version, pin.version);
  assert.ok(pkg.exports['./kernel']);
  run(process.execPath, [cli, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], checkout);
  // Execute Core's build stages without modifying its source. Explicit LF output
  // makes the packed bytes identical across Windows and Linux.
  run(process.execPath, ['scripts/clean.mjs'], checkout);
  run(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--newLine', 'lf'], checkout);
  run(process.execPath, ['scripts/legacy-build-paths.mjs'], checkout);
  const packResult = JSON.parse(run(process.execPath, [cli, 'pack', '--ignore-scripts', '--json', '--pack-destination', temp], checkout, true));
  const packed = Array.isArray(packResult) ? packResult[0] : packResult[pin.name];
  assert.equal(packed.filename, pin.artifact);
  const artifact = path.join(temp, packed.filename);
  const integrity = 'sha512-' + createHash('sha512').update(fs.readFileSync(artifact)).digest('base64');
  assert.equal(integrity, locked.integrity, 'Rebuilt Core artifact differs from package-lock integrity');
  fs.copyFileSync(artifact, path.join(artifacts, pin.artifact));
  console.log(`CORE_ARTIFACT_READY revision=${pin.revision} integrity=${integrity}`);
} finally {
  const resolved = fs.realpathSync(temp);
  assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith('rpg-core-package '));
  fs.rmSync(resolved, {recursive: true, force: true});
}
