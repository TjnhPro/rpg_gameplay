// Public installed-package contracts; callback traces are probes, not gameplay modules.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createModuleRegistry, registerModule, configureModules, composeModules,
  createGameplayRuntime as create, initializeGameplayRuntime as initialize,
  startGameplayRuntime as start, stopGameplayRuntime as stop,
  disposeGameplayRuntime as dispose, inspectGameplayRuntime as inspect,
} from '@rpg/gameplay';

const definition = (id, dependencies = [], optional = false) => ({id, dependencies, optional});
function compositionOf(definitions) {
  const registry = definitions.reduce((r, d) => registerModule(r, d), createModuleRegistry());
  return composeModules(registry, configureModules(registry));
}
const chain = () => compositionOf([
  definition('equipment', ['inventory']), definition('inventory', ['character']), definition('character'),
  definition('disabled', ['unregistered'], true),
]);
const advance = (fn, runtime) => {
  const result = fn(runtime);
  assert.equal(result.ok, true);
  assert.equal(Object.isFrozen(result), true);
  return result.runtime;
};
const status = runtime => inspect(runtime).status;
const progress = runtime => inspect(runtime).modules.map(({id, status, completedStages}) => ({id, status, completedStages}));
const probe = (trace, id) => Object.fromEntries(['initialize', 'start', 'stop', 'dispose'].map(stage => [stage, context => {
  assert.equal(context.moduleId, id); assert.equal(context.stage, stage);
  assert.equal(Object.isFrozen(context), true);
  assert.equal(Object.isFrozen(context.runtime.modules), true);
  assert.equal(Object.isFrozen(context.runtime.modules[0]), true);
  trace.push(`${stage}:${id}`);
}]));

test('GF06–GF09: ordered lifecycle, truthful inspection, immutable snapshots and no replay', () => {
  const trace = [];
  const bindings = Object.fromEntries(['character', 'inventory', 'equipment'].map(id => [id, probe(trace, id)]));
  const created = create(chain(), bindings);
  assert.deepEqual(trace, []);
  assert.deepEqual(inspect(created), {status:'created', moduleIds:['character', 'inventory', 'equipment'], modules:[
    {id:'character', status:'created', completedStages:[]},
    {id:'inventory', status:'created', completedStages:[]},
    {id:'equipment', status:'created', completedStages:[]},
  ]});
  assert.throws(() => start(created), /Cannot start/);
  assert.throws(() => stop(created), /Cannot stop/);
  assert.deepEqual(trace, []);
  const originalInspection = inspect(created);
  const initialized = advance(initialize, created);
  assert.equal(status(initialized), 'initialized');
  assert.throws(() => initialize(initialized), /Cannot initialize/);
  assert.throws(() => initialize(created), /already advanced/);
  const running = advance(start, initialized);
  assert.equal(status(running), 'running');
  assert.throws(() => start(running), /Cannot start/);
  assert.throws(() => dispose(running), /Cannot dispose/);
  const stopped = advance(stop, running);
  assert.equal(status(stopped), 'stopped');
  assert.throws(() => stop(stopped), /Cannot stop/);
  assert.throws(() => start(stopped), /Cannot start/);
  const disposed = advance(dispose, stopped);
  assert.equal(status(disposed), 'disposed');
  for (const fn of [initialize, start, stop, dispose]) assert.throws(() => fn(disposed), TypeError);
  assert.deepEqual(trace, [
    'initialize:character','initialize:inventory','initialize:equipment',
    'start:character','start:inventory','start:equipment',
    'stop:equipment','stop:inventory','stop:character',
    'dispose:equipment','dispose:inventory','dispose:character',
  ]);
  assert.deepEqual(progress(disposed), [
    {id:'character', status:'disposed', completedStages:['initialize','start','stop','dispose']},
    {id:'inventory', status:'disposed', completedStages:['initialize','start','stop','dispose']},
    {id:'equipment', status:'disposed', completedStages:['initialize','start','stop','dispose']},
  ]);
  assert.equal(inspect(created), originalInspection);
  assert.equal(status(created), 'created'); assert.equal(status(initialized), 'initialized');
  assert.equal(status(running), 'running'); assert.equal(status(stopped), 'stopped');
  for (const action of [
    () => { originalInspection.status = 'running'; },
    () => originalInspection.moduleIds.reverse(),
    () => originalInspection.modules.pop(),
    () => { originalInspection.modules[0].status = 'failed'; },
    () => originalInspection.modules[0].completedStages.push('start'),
  ]) assert.throws(action, TypeError);
  assert.equal(Object.keys(created).length, 0); // Opaque capability; inspection carries public data.
  assert.throws(() => inspect({}), TypeError);
  assert.throws(() => initialize({...created}), TypeError); // A copied capability cannot replay hooks.
});

test('GF06: composition and explicit binding trust boundary; detached caller inputs', () => {
  const a = definition('base'), b = definition('dependent', ['base']);
  for (const value of [null, [], {}, {moduleIds:[], definitions:null},
    {moduleIds:['base'], definitions:[]}, {moduleIds:['wrong'], definitions:[a]},
    {moduleIds:['base','base'], definitions:[a,a]},
    {moduleIds:['dependent'], definitions:[b]},
    {moduleIds:['dependent','base'], definitions:[b,a]},
    {moduleIds:['a','b'], definitions:[definition('a',['b']),definition('b',['a'])]},
    {moduleIds:['base'], definitions:[{...a,optional:1}]},
  ]) assert.throws(() => create(value), TypeError);
  const composition = {moduleIds:['base','dependent'], definitions:[a,b]};
  for (const bindings of [null, [], {disabled:{}}, {base:null}, {base:{start:3}}, {base:{update(){}}}]) {
    assert.throws(() => create(composition, bindings), TypeError);
  }
  const trace = [];
  const bindings = {base:{initialize:() => { trace.push('original'); }}};
  const runtime = create(composition, bindings);
  composition.moduleIds.reverse(); b.dependencies.push('missing'); a.id = 'changed';
  bindings.base.initialize = () => { trace.push('replacement'); };
  bindings.dependent = {initialize:() => { trace.push('added'); }};
  assert.deepEqual(inspect(runtime).moduleIds, ['base','dependent']);
  assert.equal(status(advance(initialize, runtime)), 'initialized');
  assert.deepEqual(trace, ['original']);
});

test('GF07: initialize/start failure preserves partial progress and eligible cleanup', () => {
  for (const stage of ['initialize','start']) {
    const trace = [];
    const bindings = Object.fromEntries(['character','inventory','equipment'].map(id => [id, probe(trace,id)]));
    bindings.inventory[stage] = () => { trace.push(`${stage}:inventory:throw`); throw new Error('probe failure'); };
    let runtime = create(chain(), bindings);
    if (stage === 'start') runtime = advance(initialize, runtime);
    trace.length = 0;
    const failed = (stage === 'initialize' ? initialize : start)(runtime);
    assert.equal(failed.ok, false);
    assert.deepEqual(failed.failure, {moduleId:'inventory',stage,message:'probe failure'});
    assert.equal(status(failed.runtime), 'failed');
    assert.deepEqual(inspect(failed.runtime).failure, failed.failure);
    assert.deepEqual(trace, [`${stage}:character`,`${stage}:inventory:throw`]);
    assert.deepEqual(progress(failed.runtime), stage === 'initialize' ? [
      {id:'character',status:'initialized',completedStages:['initialize']},
      {id:'inventory',status:'failed',completedStages:[]},
      {id:'equipment',status:'created',completedStages:[]},
    ] : [
      {id:'character',status:'running',completedStages:['initialize','start']},
      {id:'inventory',status:'failed',completedStages:['initialize']},
      {id:'equipment',status:'initialized',completedStages:['initialize']},
    ]);
    assert.throws(() => initialize(failed.runtime), /Cannot initialize/);
    assert.throws(() => start(failed.runtime), /Cannot start/);
    trace.length = 0;
    const cleaned = advance(dispose, failed.runtime);
    assert.deepEqual(trace, stage === 'initialize' ? ['dispose:character'] : ['dispose:equipment','dispose:inventory','dispose:character']);
    assert.equal(status(cleaned), 'disposed');
    assert.deepEqual(inspect(cleaned).failure, failed.failure); // Historical diagnostic survives cleanup.
    assert.equal(status(failed.runtime), 'failed');
    assert.throws(() => { failed.failure.message = 'hidden'; }, TypeError);
  }
});

test('GF07: stop/cleanup failure halts reverse order; explicit cleanup skips completed hooks', () => {
  const trace = [];
  let rejectCleanup = true;
  const bindings = Object.fromEntries(['character','inventory','equipment'].map(id => [id, probe(trace,id)]));
  bindings.inventory.stop = () => { trace.push('stop:inventory:throw'); throw 'stop failure'; };
  bindings.inventory.dispose = () => {
    trace.push('dispose:inventory');
    if (rejectCleanup) throw new Error('cleanup failure');
  };
  const running = advance(start, advance(initialize, create(chain(),bindings)));
  trace.length = 0;
  const stopped = stop(running);
  assert.equal(stopped.ok, false);
  assert.deepEqual(stopped.failure, {moduleId:'inventory',stage:'stop',message:'stop failure'});
  assert.deepEqual(trace,['stop:equipment','stop:inventory:throw']);
  assert.deepEqual(progress(stopped.runtime), [
    {id:'character',status:'running',completedStages:['initialize','start']},
    {id:'inventory',status:'failed',completedStages:['initialize','start']},
    {id:'equipment',status:'stopped',completedStages:['initialize','start','stop']},
  ]);
  trace.length = 0;
  const failedCleanup = dispose(stopped.runtime);
  assert.equal(failedCleanup.ok, false);
  assert.equal(status(failedCleanup.runtime), 'failed');
  assert.deepEqual(failedCleanup.failure, {moduleId:'inventory',stage:'dispose',message:'cleanup failure'});
  assert.deepEqual(trace,['dispose:equipment','dispose:inventory']);
  assert.deepEqual(inspect(failedCleanup.runtime).modules[2].completedStages,['initialize','start','stop','dispose']);
  assert.equal(inspect(failedCleanup.runtime).modules[0].status, 'running');
  rejectCleanup = false; trace.length = 0;
  const cleaned = advance(dispose, failedCleanup.runtime); // Explicit retry of outstanding cleanup only.
  assert.deepEqual(trace,['dispose:inventory','dispose:character']);
  assert.equal(status(cleaned), 'disposed');
  assert.throws(() => dispose(stopped.runtime), /already advanced/);
});

test('GF07: synchronous return contract and reentrant execution reject with progress', () => {
  for (const returned of [Promise.resolve(), Promise.reject(new Error('async rejection')), {then() { throw new Error('must not invoke thenable'); }}, 1]) {
    const runtime = create(compositionOf([definition('unit'),definition('later')]), {
      unit:{initialize:() => returned}, later:{initialize:() => assert.fail('later must not run')},
    });
    const failed = initialize(runtime);
    assert.equal(failed.ok, false);
    assert.equal(failed.failure.moduleId, 'unit'); assert.equal(failed.failure.stage, 'initialize');
    assert.match(failed.failure.message, returned === 1 ? /return undefined/ : /Async.*unsupported/);
    assert.deepEqual(inspect(failed.runtime).modules[0].completedStages,[]);
    assert.equal(status(advance(dispose,failed.runtime)), 'disposed');
  }
  let runtime;
  let calls = 0;
  runtime = create(compositionOf([definition('unit')]), {unit:{initialize:() => {
    calls++; initialize(runtime);
  }}});
  const result = initialize(runtime);
  assert.equal(result.ok, false);
  assert.match(result.failure.message,/already advanced.*in progress/);
  assert.equal(calls,1);
});

test('GF08/GF09: independent runtime bindings, progress, failures and inspection', () => {
  const composition = chain();
  const aCalls = [], bCalls = [];
  const a = create(composition,{character:probe(aCalls,'character')});
  const b = create(composition,{character:probe(bCalls,'character'), inventory:{initialize:() => { throw Error('B only'); }}});
  const runningA = advance(start,advance(initialize,a));
  assert.equal(status(runningA),'running'); assert.equal(status(b),'created');
  assert.deepEqual(progress(runningA), [
    {id:'character',status:'running',completedStages:['initialize','start']},
    {id:'inventory',status:'running',completedStages:['initialize','start']},
    {id:'equipment',status:'running',completedStages:['initialize','start']},
  ]); // Missing hooks still complete lifecycle stages.
  assert.deepEqual(bCalls,[]);
  const stoppedA = advance(stop,runningA);
  assert.equal(status(b),'created');
  const failedB = initialize(b);
  assert.equal(failedB.ok,false); assert.equal(status(stoppedA),'stopped');
  const beforeA = [...aCalls], beforeB = [...bCalls];
  const view = inspect(failedB.runtime);
  assert.deepEqual(inspect(failedB.runtime),view);
  assert.deepEqual(aCalls,beforeA); assert.deepEqual(bCalls,beforeB);
  assert.equal(view.failure.message,'B only');
  const disposedA = advance(dispose,stoppedA);
  assert.equal(status(failedB.runtime),'failed'); assert.deepEqual(bCalls,beforeB);
  const afterA = [...aCalls];
  advance(dispose,failedB.runtime);
  assert.equal(status(disposedA),'disposed'); assert.deepEqual(aCalls,afterA);
  assert.equal(status(a),'created'); assert.equal(status(b),'created');
});

test('GF06–GF09: empty, absent hooks and early disposal follow real lifecycle', () => {
  const empty = create(compositionOf([]));
  const initialized = advance(initialize,empty);
  const running = advance(start,initialized);
  const stopped = advance(stop,running);
  const disposed = advance(dispose,stopped);
  for (const [runtime, expected] of [[empty,'created'],[initialized,'initialized'],[running,'running'],[stopped,'stopped'],[disposed,'disposed']]) {
    assert.deepEqual(inspect(runtime),{status:expected,moduleIds:[],modules:[]});
  }
  const calls = [];
  const composition = compositionOf([definition('unit')]);
  const freshDisposed = advance(dispose,create(composition,{unit:probe(calls,'unit')}));
  assert.deepEqual(calls,[]);
  assert.equal(status(freshDisposed),'disposed');
  assert.deepEqual(progress(freshDisposed),[{id:'unit',status:'created',completedStages:[]}]);
  const initializedDisposed = advance(dispose,advance(initialize,create(composition,{unit:probe(calls,'unit')})));
  assert.deepEqual(calls,['initialize:unit','dispose:unit']);
  assert.deepEqual(progress(initializedDisposed),[{id:'unit',status:'disposed',completedStages:['initialize','dispose']}]);
});

test('GF06–GF09 regression: reflection exposes no execution mutators or lifecycle bindings', () => {
  const calls = [];
  const bindings = {unit:probe(calls,'unit')};
  let runtime = create(compositionOf([definition('unit')]),bindings);
  const created = runtime;
  function assertOpaque(value) {
    // Inspect all own descriptors, including symbols/non-enumerable properties,
    // and any custom prototype. An opaque capability exposes passive metadata only.
    for (let object = value; object !== null && object !== Object.prototype; object = Object.getPrototypeOf(object)) {
      for (const key of Reflect.ownKeys(object)) {
        const descriptor = Object.getOwnPropertyDescriptor(object,key);
        assert.equal(descriptor.get,undefined,'no callable internal accessors');
        assert.equal(descriptor.set,undefined,'no callable internal mutators');
        assert.notEqual(typeof descriptor.value,'function','no executable internals');
        assert.ok(descriptor.value === null || typeof descriptor.value !== 'object','no internal data/bindings reachable');
      }
    }
    assert.equal(Object.isFrozen(value),true);
  }
  for (const transition of [initialize,start,stop,dispose]) {
    assertOpaque(runtime);
    const old = inspect(runtime);
    assert.throws(() => inspect({...runtime}),TypeError);
    runtime = advance(transition,runtime); // Reflection cannot consume/poison the capability.
    assert.equal(inspect(created).status,'created');
    assert.equal(Object.isFrozen(old),true);
  }
  assertOpaque(runtime);
  assert.deepEqual(calls,['initialize:unit','start:unit','stop:unit','dispose:unit']);
  const failed = initialize(create(compositionOf([definition('unit')]),{unit:{initialize(){throw Error('probe');}}}));
  assert.equal(failed.ok,false);
  assertOpaque(failed.runtime);
  assertOpaque(advance(dispose,failed.runtime));
});
