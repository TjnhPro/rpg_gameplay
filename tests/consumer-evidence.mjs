// Shared installed-runner guards, exercised by real negative controls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

export function copyRequiredConsumer(source, destination) {
  assert.ok(fs.statSync(source).isFile(), 'required consumer must be a file');
  fs.copyFileSync(source, destination);
}
export function assertVersion(actual, expected) {assert.equal(actual, expected, 'installed package version');}
// Root source manifest is the oracle; installed metadata cannot certify itself.
export function assertBuildVersions(rootPackage, lockfile, installedPackage) {
  const expectedVersion = rootPackage.version;
  assert.equal(typeof expectedVersion, 'string', 'root package version required');
  assert.ok(expectedVersion.length > 0, 'root package version required');
  assertVersion(lockfile.version, expectedVersion);
  assertVersion(lockfile.packages[''].version, expectedVersion);
  assertVersion(installedPackage.version, expectedVersion);
}
export function assertCoreIntegrity(bytes, expected) {
  assert.equal('sha512-' + createHash('sha512').update(bytes).digest('base64'), expected, 'Core artifact integrity');
}
export function assertTapEvidence(output, count, markers = []) {
  const metric = name => {
    const matches = [...output.matchAll(new RegExp(`^# ${name} (\\d+)\\r?$`, 'gm'))];
    assert.equal(matches.length, 1, `required TAP ${name} summary`);
    return Number(matches[0][1]);
  };
  const tests = metric('tests');
  assert.ok(tests > 0, 'required tests must execute');
  if (count !== undefined) assert.equal(tests, count, 'required test count');
  assert.equal(metric('pass'), tests);
  for (const name of ['fail', 'cancelled', 'skipped', 'todo']) assert.equal(metric(name), 0, `TAP ${name}`);
  for (const marker of markers) assert.ok(output.includes(marker), `required evidence ${marker}`);
}
