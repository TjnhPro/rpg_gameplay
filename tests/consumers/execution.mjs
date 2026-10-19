import assert from 'node:assert/strict';
import test from 'node:test';
import * as g from '@rpg/gameplay';

test('GF14–GF15: explicit reads, receiver/method snapshots, ownership and isolated contexts', () => {
  const clock = {value: 0, calls: 0, now() { this.calls++; return this.value; }};
  const random = {value: 0, calls: 0, next() { this.calls++; return this.value; }};
  const ids = {value: ' ID / caller ', calls: 0, next() { this.calls++; return this.value; }};
  const dependencies = {clock, random, ids};
  const context = g.createExecutionContext(dependencies);
  assert.deepEqual([clock.calls, random.calls, ids.calls], [0, 0, 0]);
  const other = g.createExecutionContext({clock: {now: () => 99}});
  assert.equal(g.readExecutionTime(other), 99);
  assert.deepEqual([clock.calls, random.calls, ids.calls], [0, 0, 0]);
  const unexpected = () => { throw Error('replacement invoked'); };
  clock.now = unexpected; random.next = unexpected; ids.next = unexpected;
  dependencies.clock = {now: unexpected}; dependencies.random = {next: unexpected}; dependencies.ids = {next: unexpected};
  assert.equal(g.readExecutionTime(context), 0);
  clock.value = 1000; assert.equal(g.readExecutionTime(context), 1000);
  clock.value = 2.5; assert.equal(g.readExecutionTime(context), 2.5); // no monotonic policy
  assert.equal(g.nextExecutionRandom(context), 0);
  random.value = 0.999; assert.equal(g.nextExecutionRandom(context), 0.999);
  assert.equal(g.nextExecutionId(context), ' ID / caller ');
  assert.equal(g.nextExecutionId(context), ' ID / caller '); // no uniqueness policy
  assert.deepEqual([clock.calls, random.calls, ids.calls], [3, 2, 2]);
  for (const value of [dependencies, clock, random, ids]) assert.equal(Object.isFrozen(value), false);
  assert.equal(g.readExecutionTime(other), 99);
});

test('GF14–GF15: malformed ports/output fail, one call per request, unchanged provider throws', () => {
  for (const bad of [undefined, null, [], {}, {clock: null}, {clock: {now: 1}},
    {clock: {now() {}}, random: null}, {clock: {now() {}}, random: {next: 1}},
    {clock: {now() {}}, ids: []}, {clock: {now() {}}, ids: {next: false}}]) {
    assert.throws(() => g.createExecutionContext(bad), TypeError);
  }
  const optional = g.createExecutionContext({clock: {now: () => 0}});
  assert.throws(() => g.nextExecutionRandom(optional), /provider is missing/);
  assert.throws(() => g.nextExecutionId(optional), /provider is missing/);
  for (const [port, method, read, invalid] of [
    ['clock', 'now', g.readExecutionTime, [-1, NaN, Infinity, -Infinity, '1', undefined, null, Promise.resolve(1)]],
    ['random', 'next', g.nextExecutionRandom, [-0.1, 1, 2, NaN, Infinity, '0.5', undefined, null]],
    ['ids', 'next', g.nextExecutionId, ['', '  ', 0, undefined, null, {}]],
  ]) {
    for (const value of invalid) {
      let calls = 0;
      const context = g.createExecutionContext({clock: {now: () => 0}, [port]: {[method]() { calls++; return value; }}});
      assert.equal(calls, 0);
      assert.throws(() => read(context), TypeError);
      assert.equal(calls, 1, 'no retry after invalid output');
    }
    const thrown = {caller: 'sentinel'};
    let calls = 0;
    const context = g.createExecutionContext({clock: {now: () => 0}, [port]: {[method]() { calls++; throw thrown; }}});
    assert.throws(() => read(context), error => error === thrown);
    assert.equal(calls, 1);
  }
});

test('GF15: reflection exposes no bindings/state and cannot forge execution identity', () => {
  let calls = 0;
  const context = g.createExecutionContext({clock: {now() { calls++; return 7; }}});
  assert.equal(Object.isFrozen(context), true);
  for (let object = context; object !== null && object !== Object.prototype; object = Object.getPrototypeOf(object)) {
    for (const key of Reflect.ownKeys(object)) {
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      assert.equal(descriptor.get, undefined); assert.equal(descriptor.set, undefined);
      assert.notEqual(typeof descriptor.value, 'function');
      assert.ok(descriptor.value === null || typeof descriptor.value !== 'object');
    }
  }
  for (const forged of [null, {}, {...context}, Object.create(context),
    Object.defineProperties({}, Object.getOwnPropertyDescriptors(context))]) {
    for (const read of [g.readExecutionTime, g.nextExecutionRandom, g.nextExecutionId]) assert.throws(() => read(forged), TypeError);
  }
  assert.equal(calls, 0); assert.equal(g.readExecutionTime(context), 7); assert.equal(calls, 1);
});

const definition = (id, dependencies = [], optional = false) => ({id, dependencies, optional});
function compose(trace) {
  const registry = [definition('action', ['actor']), definition('observer', ['actor'], true),
    definition('unused', [], true), definition('actor')].reduce(g.registerModule, g.createModuleRegistry());
  const selection = g.configureModules(registry, {enable: ['observer']});
  const resolved = g.resolveModuleDependencies(registry, selection);
  const composition = g.composeModules(registry, selection);
  assert.deepEqual(resolved, ['actor', 'action', 'observer']);
  assert.deepEqual(composition.moduleIds, resolved);
  trace.push(['resolved', ...resolved]);
  return composition;
}
function scripted(values) {
  return {index: 0, next() { assert.ok(this.index < values.length, 'unexpected provider access'); return values[this.index++]; }};
}
function session(times = [1000, 1500, 2000], samples = [0.25], identifiers = ['cmd-1']) {
  const trace = [], composition = compose(trace), messaging = g.createGameplayMessaging(composition);
  const clock = scripted(times), random = scripted(samples), ids = scripted(identifiers);
  const execution = g.createExecutionContext({clock: {now: clock.next.bind(clock)}, random, ids});
  let observer;
  const bindings = Object.fromEntries(composition.moduleIds.map(id => [id, {
    initialize() {
      trace.push(['initialize', id]);
      if (id === 'actor') {
        trace.push(['clock', g.readExecutionTime(execution)]);
        g.subscribeEvent(messaging, {moduleId: id, eventType: 'observed', handler(event) { trace.push(['event', id, event.payload]); }});
      }
      if (id === 'action') g.registerCommandHandler(messaging, {moduleId: id, commandType: 'act', handler(command) {
        const time = g.readExecutionTime(execution), sample = g.nextExecutionRandom(execution), key = g.nextExecutionId(execution);
        trace.push(['clock', time], ['random', sample], ['id', key]);
        return {status: 'success', value: {input: command.payload, time, sample, key}};
      }});
      if (id === 'observer') observer = g.subscribeEvent(messaging, {moduleId: id, eventType: 'observed', handler(event) { trace.push(['event', id, event.payload]); }});
    },
    start() { trace.push(['start', id]); },
    stop() { trace.push(['stop', id]); trace.push(['cleanup', id, g.unsubscribeModuleEvents(messaging, id)]); },
    dispose() { trace.push(['dispose', id]); },
  }]));
  let runtime = g.createGameplayRuntime(composition, bindings);
  const original = g.inspectGameplayRuntime(runtime);
  assert.deepEqual([clock.index, random.index, ids.index], [0, 0, 0]);
  function advance(fn) { const result = fn(runtime); assert.equal(result.ok, true); runtime = result.runtime; }
  advance(g.initializeGameplayRuntime); advance(g.startGameplayRuntime);
  const result = g.dispatchCommand(messaging, {type: 'act', payload: 'neutral-input'});
  trace.push(['command', result]);
  assert.equal(result.status, 'success');
  assert.equal(trace.some(entry => entry[0] === 'event'), false, 'command emits no implicit event');
  trace.push(['publish', g.publishEvent(messaging, {type: 'observed', payload: result.value})]);
  trace.push(['unsubscribe', g.unsubscribeEvent(messaging, observer)]);
  trace.push(['publish', g.publishEvent(messaging, {type: 'observed', payload: result.value})]);
  advance(g.stopGameplayRuntime); advance(g.disposeGameplayRuntime);
  trace.push(['after-cleanup', g.publishEvent(messaging, {type: 'observed', payload: null}).completedDeliveries]);
  trace.push(['clock', g.readExecutionTime(execution)]);
  const inspection = g.inspectGameplayRuntime(runtime);
  trace.push(['inspection', inspection]);
  assert.equal(original.status, 'created'); assert.equal(Object.isFrozen(inspection.modules), true);
  assert.deepEqual([clock.index, random.index, ids.index], [3, 1, 1]);
  return trace;
}
const value = {input: 'neutral-input', time: 1500, sample: 0.25, key: 'cmd-1'};
const expected = [
  ['resolved', 'actor', 'action', 'observer'],
  ['initialize', 'actor'], ['clock', 1000], ['initialize', 'action'], ['initialize', 'observer'],
  ['start', 'actor'], ['start', 'action'], ['start', 'observer'],
  ['clock', 1500], ['random', 0.25], ['id', 'cmd-1'],
  ['command', {status: 'success', commandType: 'act', moduleId: 'action', value}],
  ['event', 'actor', value], ['event', 'observer', value],
  ['publish', {ok: true, eventType: 'observed', completedDeliveries: 2}], ['unsubscribe', true],
  ['event', 'actor', value], ['publish', {ok: true, eventType: 'observed', completedDeliveries: 1}],
  ['stop', 'observer'], ['cleanup', 'observer', 0], ['stop', 'action'], ['cleanup', 'action', 0], ['stop', 'actor'], ['cleanup', 'actor', 1],
  ['dispose', 'observer'], ['dispose', 'action'], ['dispose', 'actor'], ['after-cleanup', 0], ['clock', 2000],
  ['inspection', {status: 'disposed', moduleIds: ['actor', 'action', 'observer'], modules: [
    {id: 'actor', status: 'disposed', completedStages: ['initialize', 'start', 'stop', 'dispose']},
    {id: 'action', status: 'disposed', completedStages: ['initialize', 'start', 'stop', 'dispose']},
    {id: 'observer', status: 'disposed', completedStages: ['initialize', 'start', 'stop', 'dispose']},
  ]}],
];

test('GF01–GF16: independent installed sessions match a literal full-flow semantic oracle', () => {
  const a = session(), b = session();
  assert.deepEqual(a, expected); assert.deepEqual(b, expected); assert.deepEqual(a, b);
  console.log('FOUNDATION_TRACE_PASS clock=[1000,1500,2000] random=[0.25] ids=[cmd-1]; resolved=actor,action,observer; deliveries=2,1,0; final=disposed');
});

test('GF16: changed clock and RNG affect only explicit observations with stable ordering', () => {
  const changed = session([10, 20, 30], [0.75]);
  const changedValue = {input: 'neutral-input', time: 20, sample: 0.75, key: 'cmd-1'};
  // Independent changed observations, preserving the literal control-flow oracle.
  const changedExpected = expected.map(entry => {
    if (entry[0] === 'clock') return ['clock', ({1000: 10, 1500: 20, 2000: 30})[entry[1]]];
    if (entry[0] === 'random') return ['random', 0.75];
    if (entry[0] === 'command') return ['command', {status: 'success', commandType: 'act', moduleId: 'action', value: changedValue}];
    if (entry[0] === 'event') return ['event', entry[1], changedValue];
    return entry;
  });
  assert.deepEqual(changed, changedExpected); assert.notDeepEqual(changed, expected);
});

function failedSession() {
  const trace = [], composition = compose(trace), messaging = g.createGameplayMessaging(composition);
  const error = new Error('scripted provider failure');
  let calls = 0;
  const execution = g.createExecutionContext({clock: {now() { calls++; throw error; }}});
  g.registerCommandHandler(messaging, {moduleId: 'action', commandType: 'act', handler() { g.readExecutionTime(execution); return {status: 'success'}; }});
  trace.push(['command', g.dispatchCommand(messaging, {type: 'act', payload: null})]);
  g.subscribeEvent(messaging, {moduleId: 'actor', eventType: 'observed', handler() { trace.push(['listener', 'actor']); }});
  const bad = g.subscribeEvent(messaging, {moduleId: 'action', eventType: 'observed', handler() { g.readExecutionTime(execution); }});
  g.subscribeEvent(messaging, {moduleId: 'observer', eventType: 'observed', handler() { trace.push(['must-not-run']); }});
  const event = g.publishEvent(messaging, {type: 'observed', payload: null});
  assert.equal(event.failure.subscription, bad);
  trace.push(['event-failure', {ok: event.ok, completed: event.completedDeliveries, moduleId: event.failure.moduleId, eventType: event.failure.eventType, message: event.failure.message}]);
  let runtime = g.createGameplayRuntime(composition, {
    actor: {initialize() { trace.push(['initialize', 'actor']); }, dispose() { trace.push(['dispose', 'actor']); }},
    action: {initialize() { g.readExecutionTime(execution); }},
    observer: {initialize() { trace.push(['must-not-run']); }},
  });
  const failed = g.initializeGameplayRuntime(runtime);
  assert.equal(failed.ok, false); runtime = failed.runtime;
  trace.push(['lifecycle', g.inspectGameplayRuntime(runtime)]);
  const disposed = g.disposeGameplayRuntime(runtime); assert.equal(disposed.ok, true);
  trace.push(['disposed', g.inspectGameplayRuntime(disposed.runtime)]);
  trace.push(['cleanup', ...composition.moduleIds.map(id => g.unsubscribeModuleEvents(messaging, id))]);
  trace.push(['after-cleanup', g.publishEvent(messaging, {type: 'observed', payload: null}).completedDeliveries]);
  trace.push(['after-failure', g.dispatchCommand(messaging, {type: 'unknown', payload: null}).status]);
  assert.equal(calls, 3);
  return trace;
}
test('GF16: scripted provider failures preserve command/event diagnostics, partial lifecycle and cleanup', () => {
  const failure = {moduleId: 'action', stage: 'initialize', message: 'scripted provider failure'};
  const modules = [
    {id: 'actor', status: 'initialized', completedStages: ['initialize']},
    {id: 'action', status: 'failed', completedStages: [], failure},
    {id: 'observer', status: 'created', completedStages: []},
  ];
  const oracle = [
    ['resolved', 'actor', 'action', 'observer'],
    ['command', {status: 'failed', failure: {commandType: 'act', moduleId: 'action', message: 'scripted provider failure'}}],
    ['listener', 'actor'], ['event-failure', {ok: false, completed: 1, moduleId: 'action', eventType: 'observed', message: 'scripted provider failure'}],
    ['initialize', 'actor'], ['lifecycle', {status: 'failed', moduleIds: ['actor', 'action', 'observer'], modules, failure}],
    ['dispose', 'actor'], ['disposed', {status: 'disposed', moduleIds: ['actor', 'action', 'observer'], modules: [
      {id: 'actor', status: 'disposed', completedStages: ['initialize', 'dispose']}, modules[1], modules[2],
    ], failure}],
    ['cleanup', 1, 1, 1], ['after-cleanup', 0], ['after-failure', 'unhandled'],
  ];
  const a = failedSession(), b = failedSession();
  assert.deepEqual(a, oracle); assert.deepEqual(b, oracle); assert.deepEqual(a, b);
});

test('Foundation profiles: text action, opaque 2D position and 2.5D direction survive routing unchanged', () => {
  const composition = g.composeModules(g.registerModule(g.createModuleRegistry(), definition('adapter')),
    {enabledModuleIds: ['adapter']});
  for (const payload of [{action: 'inspect'}, {action: 'inspect', position: {x: 3, y: -2}},
    {action: 'inspect', position: {x: 3, y: -2}, direction: 'caller-facing'}]) {
    const before = structuredClone(payload);
    const messaging = g.createGameplayMessaging(composition), trace = [];
    g.registerCommandHandler(messaging, {moduleId: 'adapter', commandType: 'probe', handler(command) {
      assert.equal(command.payload, payload); return {status: 'success', value: command.payload};
    }});
    g.subscribeEvent(messaging, {moduleId: 'adapter', eventType: 'probed', handler(event) { trace.push(event.payload); }});
    const result = g.dispatchCommand(messaging, {type: 'probe', payload});
    assert.equal(result.value, payload);
    assert.equal(g.publishEvent(messaging, {type: 'probed', payload: result.value}).completedDeliveries, 1);
    assert.equal(trace[0], payload); assert.equal(Object.isFrozen(payload), false);
    assert.deepEqual(payload, before);
    if (payload.position) assert.equal(Object.isFrozen(payload.position), false);
  }
});
