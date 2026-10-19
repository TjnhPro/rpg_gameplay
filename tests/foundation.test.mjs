import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = process.env.npm_execpath;
function exec(args, cwd) {
  const env = {...process.env};
  // The installed consumer owns its test runner, not the parent runner's IPC context.
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, args, {cwd, shell: false, encoding: 'utf8', env});
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}

test('installed artifact: GF01–GF16, ESM root, closed exports, strict declarations and real Kernel', () => {
  assert.ok(cli, 'run with npm run test:functional');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rpg package consumer '));
  try {
    const pin = JSON.parse(fs.readFileSync(path.join(root, 'harness/core-pin.json'), 'utf8'));
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    const coreArtifact = path.join(root, '.artifacts', pin.artifact);
    const integrity = 'sha512-' + createHash('sha512').update(fs.readFileSync(coreArtifact)).digest('base64');
    assert.equal(integrity, lock.packages['node_modules/@rpg/core'].integrity);
    const packedResult = JSON.parse(exec([cli, 'pack', '--ignore-scripts', '--json', '--pack-destination', temp], root));
    const packed = Array.isArray(packedResult) ? packedResult[0] : packedResult['@rpg/gameplay'];
    assert.deepEqual(packed.files.map(x => x.path).sort(), [
      'README.md', 'dist/foundation/execution/index.d.ts', 'dist/foundation/execution/index.js',
      'dist/foundation/messaging/index.d.ts', 'dist/foundation/messaging/index.js',
      'dist/foundation/modules/index.d.ts', 'dist/foundation/modules/index.js',
      'dist/foundation/runtime/index.d.ts', 'dist/foundation/runtime/index.js',
      'dist/index.d.ts', 'dist/index.js', 'package.json',
    ]);
    fs.writeFileSync(path.join(temp, 'package.json'), JSON.stringify({name: 'foundation-consumer', private: true, type: 'module'}));
    exec([cli, 'install', '--ignore-scripts', '--no-audit', '--no-fund', path.join(temp, packed.filename), coreArtifact], temp);
    const installed = path.join(temp, 'node_modules/@rpg/gameplay');
    assert.equal(fs.lstatSync(installed).isSymbolicLink(), false, 'must install tarball, not source link');
    assert.ok(fs.existsSync(path.join(installed, 'dist/index.d.ts')));
    assert.equal(fs.existsSync(path.join(installed, 'src')), false);
    const packageJson = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
    assert.equal(packageJson.version, '0.1.5');
    assert.equal(packageJson.private, true);
    assert.equal(packageJson.type, 'module');
    assert.deepEqual(packageJson.exports, {'.': {types: './dist/index.d.ts', import: './dist/index.js'}});
    fs.writeFileSync(path.join(temp, 'consumer.mjs'), `
import assert from 'node:assert/strict';
import * as gameplay from '@rpg/gameplay';
import {calculateResourceTransition} from '@rpg/core/kernel';
assert.deepEqual(Object.keys(gameplay).sort(), ['composeModules', 'configureModules', 'createGameplayRuntime', 'createModuleRegistry',
 'disposeGameplayRuntime', 'getModule', 'initializeGameplayRuntime', 'inspectGameplayRuntime', 'isModuleEnabled', 'listModules',
 'registerModule', 'resolveModuleDependencies', 'startGameplayRuntime', 'stopGameplayRuntime', 'validateModuleDefinition',
 'createGameplayMessaging', 'registerCommandHandler', 'dispatchCommand', 'subscribeEvent', 'publishEvent', 'unsubscribeEvent', 'unsubscribeModuleEvents',
 'createExecutionContext', 'readExecutionTime', 'nextExecutionRandom', 'nextExecutionId'].sort());
// Independent contract oracle: 8 units minus 3 gives 5, bounds [0,10].
assert.deepEqual(calculateResourceTransition({resource:'energy',current:8,maximum:10,
 amount:3,operation:'decrease',rule:{minimum:0,currentAboveMaximum:'reject',allowIncreaseFromMinimum:true}}),
 {resource:'energy',before:8,after:5,applied:3,reachedMinimum:false});
for (const spec of ['@rpg/gameplay/src/index.ts','@rpg/gameplay/dist/index.js', '@rpg/gameplay/foundation/modules', '@rpg/gameplay/foundation/runtime', '@rpg/gameplay/dist/foundation/runtime/index.js', '@rpg/gameplay/foundation/messaging', '@rpg/gameplay/dist/foundation/messaging/index.js', '@rpg/gameplay/foundation/execution', '@rpg/gameplay/dist/foundation/execution/index.js']) {
 await assert.rejects(import(spec), {code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
}
`);
    exec(['consumer.mjs'], temp);
    fs.copyFileSync(path.join(root, 'tests/consumers/modules.mjs'), path.join(temp, 'modules.mjs'));
    const moduleEvidence = exec(['--test', '--test-reporter=tap', 'modules.mjs'], temp);
    assert.match(moduleEvidence, /# pass 3/);
    assert.match(moduleEvidence, /# skipped 0/);
    console.log('INSTALLED_MODULE_CONTRACTS_PASS GF01–GF03; consumer_tests=3 skipped=0');
    fs.copyFileSync(path.join(root, 'tests/consumers/modules.ts'), path.join(temp, 'modules.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/composition.mjs'), path.join(temp, 'composition.mjs'));
    const compositionEvidence = exec(['--test', '--test-reporter=tap', 'composition.mjs'], temp);
    assert.match(compositionEvidence, /# pass 4/);
    assert.match(compositionEvidence, /# skipped 0/);
    console.log('INSTALLED_COMPOSITION_CONTRACTS_PASS GF04–GF05; consumer_tests=4 skipped=0');
    fs.copyFileSync(path.join(root, 'tests/consumers/composition.ts'), path.join(temp, 'composition.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/runtime.mjs'), path.join(temp, 'runtime.mjs'));
    const runtimeEvidence = exec(['--test', '--test-reporter=tap', 'runtime.mjs'], temp);
    assert.match(runtimeEvidence, /# pass 8/);
    assert.match(runtimeEvidence, /# skipped 0/);
    console.log('INSTALLED_RUNTIME_CONTRACTS_PASS GF06–GF09; consumer_tests=8 skipped=0');
    fs.copyFileSync(path.join(root, 'tests/consumers/runtime.ts'), path.join(temp, 'runtime.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/messaging.mjs'), path.join(temp, 'messaging.mjs'));
    const messagingEvidence = exec(['--test', '--test-reporter=tap', 'messaging.mjs'], temp);
    assert.match(messagingEvidence, /# pass 7/);
    assert.match(messagingEvidence, /# skipped 0/);
    console.log('INSTALLED_MESSAGING_CONTRACTS_PASS GF10–GF13; consumer_tests=7 skipped=0');
    fs.copyFileSync(path.join(root, 'tests/consumers/messaging.ts'), path.join(temp, 'messaging.ts'));
    fs.copyFileSync(path.join(root, 'tests/consumers/execution.mjs'), path.join(temp, 'execution.mjs'));
    const executionEvidence = exec(['--test', '--test-reporter=tap', 'execution.mjs'], temp);
    assert.match(executionEvidence, /# pass 7/);
    assert.match(executionEvidence, /# skipped 0/);
    assert.match(executionEvidence, /FOUNDATION_TRACE_PASS/);
    console.log('INSTALLED_EXECUTION_CLOSURE_PASS GF14–GF16 + GF01–GF13 integration/profiles; consumer_tests=7 skipped=0');
    console.log(executionEvidence.split(/\r?\n/).find(line => line.includes('FOUNDATION_TRACE_PASS')));
    fs.copyFileSync(path.join(root, 'tests/consumers/execution.ts'), path.join(temp, 'execution.ts'));
    const executionDeclarations = fs.readFileSync(path.join(installed, 'dist/foundation/execution/index.d.ts'), 'utf8');
    assert.doesNotMatch(executionDeclarations, /\b(?:ExecutionData|executionRecords|capture|readContext|WeakMap)\b/);
    const messagingDeclarations = fs.readFileSync(path.join(installed, 'dist/foundation/messaging/index.d.ts'), 'utf8');
    assert.doesNotMatch(messagingDeclarations, /\b(?:MessagingData|messagingRecords|readMessaging|beginExecution|snapshotMessage|requireSynchronous|Map|WeakMap|WeakSet)\b/);
    const runtimeDeclarations = fs.readFileSync(path.join(installed, 'dist/foundation/runtime/index.d.ts'), 'utf8');
    assert.doesNotMatch(runtimeDeclarations, /\b(?:RuntimeData|snapshotComposition|snapshotBindings|readRuntime|makeRuntime|transition|WeakMap)\b/);
    const declarations = fs.readFileSync(path.join(installed, 'dist/foundation/modules/index.d.ts'), 'utf8');
    assert.doesNotMatch(declarations, /\b(?:isRecord|requireId|readIds|describeCycle|Map|WeakMap)\b/);
    fs.writeFileSync(path.join(temp, 'consumer.ts'), `
import * as gameplay from '@rpg/gameplay';
import {calculateResourceTransition, type ResourceTransitionInput} from '@rpg/core/kernel';
const input: ResourceTransitionInput<'energy'> = {resource:'energy',current:8,maximum:10,
 amount:3,operation:'decrease',rule:{minimum:0,currentAboveMaximum:'reject',allowIncreaseFromMinimum:true}};
const resource: 'energy' = calculateResourceTransition(input).resource;
// @ts-expect-error No gameplay execution engine is exposed.
gameplay.createGameplayEngine();
// @ts-expect-error Installed Kernel declarations must reject invalid operation.
const invalid: ResourceTransitionInput['operation'] = 'teleport';
void resource; void invalid;
`);
    fs.writeFileSync(path.join(temp, 'tsconfig.json'), JSON.stringify({compilerOptions: {
      target:'ES2022', lib:['ES2022'], module:'NodeNext', moduleResolution:'NodeNext',
      strict:true, noEmit:true, types:[], skipLibCheck:false
    }, files:['consumer.ts', 'modules.ts', 'composition.ts', 'runtime.ts', 'messaging.ts', 'execution.ts']}));
    exec([path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], temp);
  } finally {
    const resolved = fs.realpathSync(temp);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('rpg package consumer '));
    fs.rmSync(resolved, {recursive: true, force: true});
  }
});
