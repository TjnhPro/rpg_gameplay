import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../../dist/index.js';

test('module dependencies, explicit lifecycle and encapsulated runtime', () => {
  let registry = g.createModuleRegistry();
  registry = g.registerModule(registry, {id: 'base', dependencies: [], optional: true});
  registry = g.registerModule(registry, {id: 'addon', dependencies: ['base'], optional: true});
  const composition = g.composeModules(registry, g.configureModules(registry, {enable: ['base']}));
  assert.deepEqual(g.composeModules(registry,
    g.configureModules(registry, {enable: ['addon', 'base']})).moduleIds, ['base', 'addon']);
  assert.throws(() => g.composeModules(registry,
    g.configureModules(registry, {enable: ['addon']})), /dependency/);
  const calls = [];
  const runtime = g.createGameplayRuntime(composition, {base: {
    initialize() { calls.push('initialize'); }, start() { calls.push('start'); },
    stop() { calls.push('stop'); }, dispose() { calls.push('dispose'); },
  }});
  assert.throws(() => g.startGameplayRuntime(runtime));
  assert.ok(Reflect.ownKeys(runtime).every(key => runtime[key] === true));
  const initialized = g.initializeGameplayRuntime(runtime);
  assert.equal(initialized.ok, true);
  assert.throws(() => g.initializeGameplayRuntime(runtime));
  const started = g.startGameplayRuntime(initialized.runtime);
  assert.equal(g.inspectGameplayRuntime(started.runtime).status, 'running');
  const stopped = g.stopGameplayRuntime(started.runtime);
  const disposed = g.disposeGameplayRuntime(stopped.runtime);
  assert.equal(g.inspectGameplayRuntime(disposed.runtime).status, 'disposed');
  assert.deepEqual(calls, ['initialize', 'start', 'stop', 'dispose']);
});

test('owned command dispatch and explicit execution providers', () => {
  const registry = g.registerModule(g.createModuleRegistry(), {id: 'base', dependencies: [], optional: false});
  const composition = g.composeModules(registry, g.configureModules(registry));
  const messaging = g.createGameplayMessaging(composition);
  g.registerCommandHandler(messaging, {moduleId: 'base', commandType: 'use',
    handler: () => ({status: 'success', value: 7})});
  assert.deepEqual(g.dispatchCommand(messaging, {type: 'use', payload: {}}),
    {status: 'success', commandType: 'use', moduleId: 'base', value: 7});
  assert.throws(() => g.registerCommandHandler(messaging,
    {moduleId: 'foreign', commandType: 'other', handler() {}}));
  const execution = g.createExecutionContext({clock: {now: () => 1000},
    random: {next: () => 0.2}, ids: {next: () => 'caller-id'}});
  assert.equal(g.readExecutionTime(execution), 1000);
  assert.equal(g.nextExecutionRandom(execution), 0.2);
  assert.equal(g.nextExecutionId(execution), 'caller-id');
  assert.throws(() => g.nextExecutionRandom(g.createExecutionContext({})));
});
