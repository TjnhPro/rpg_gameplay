import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createModuleRegistry, registerModule, configureModules, composeModules,
  createGameplayMessaging as create, registerCommandHandler as register,
  dispatchCommand as dispatch, subscribeEvent as subscribe, publishEvent as publish,
  unsubscribeEvent as unsubscribe, unsubscribeModuleEvents as cleanup,
  createGameplayRuntime, initializeGameplayRuntime, startGameplayRuntime,
  stopGameplayRuntime, disposeGameplayRuntime, inspectGameplayRuntime,
} from '@rpg/gameplay';

const definition = (id, dependencies = [], optional = false) => ({id, dependencies, optional});
function compositionOf(definitions = [definition('alpha'), definition('beta', ['alpha']), definition('disabled', [], true)]) {
  const registry = definitions.reduce(registerModule, createModuleRegistry());
  return composeModules(registry, configureModules(registry));
}
const message = (type = 'event-x', payload = undefined) => ({type, payload});
const add = (context, moduleId, eventType, handler) => subscribe(context, {moduleId, eventType, handler});
const handle = (context, moduleId, commandType, handler) => register(context, {moduleId, commandType, handler});
function assertOpaque(value) {
  assert.equal(Object.isFrozen(value), true);
  for (let object = value; object !== null && object !== Object.prototype; object = Object.getPrototypeOf(object)) {
    for (const key of Reflect.ownKeys(object)) {
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      assert.equal(descriptor.get, undefined);
      assert.equal(descriptor.set, undefined);
      assert.notEqual(typeof descriptor.value, 'function');
      assert.ok(descriptor.value === null || typeof descriptor.value !== 'object', 'no reachable coordination stores/bindings');
    }
  }
}

test('GF10–GF11: exact routing, explicit outcomes, selected ownership and detached metadata', () => {
  const context = create(compositionOf());
  const trace = [];
  const payload = {input: 3};
  const value = {output: 7};
  const outcome = {status: 'success', value};
  const registration = {moduleId: 'beta', commandType: 'skill-use', handler(command) {
    trace.push('skill');
    assert.equal(command.payload, payload);
    assert.equal(Object.isFrozen(command), true);
    return outcome;
  }};
  register(context, registration);
  handle(context, 'alpha', 'inventory-use', () => { trace.push('inventory'); return {status: 'success'}; });
  let automaticEvents = 0;
  add(context, 'alpha', 'skill-use', () => { automaticEvents++; });
  registration.handler = () => { throw Error('caller replacement must not run'); };
  registration.commandType = 'renamed';
  for (const invalid of [
    null, {moduleId: 'unknown', commandType: 'valid', handler() {}},
    {moduleId: 'disabled', commandType: 'valid', handler() {}},
    {moduleId: 'alpha', commandType: ' bad ', handler() {}},
    {moduleId: 'alpha', commandType: 'valid', handler: 1},
    {moduleId: 'alpha', commandType: 'skill-use', handler() { throw Error('overwrite'); }},
  ]) assert.throws(() => register(context, invalid), TypeError);
  const command = message('skill-use', payload);
  const result = dispatch(context, command);
  assert.deepEqual(result, {status: 'success', commandType: 'skill-use', moduleId: 'beta', value});
  assert.equal(result.value, value);
  assert.deepEqual(trace, ['skill']);
  assert.equal(automaticEvents, 0);
  assert.equal(Object.isFrozen(command), false);
  assert.equal(Object.isFrozen(payload), false);
  assert.equal(Object.isFrozen(value), false);
  outcome.status = 'rejected'; outcome.value = 99;
  assert.equal(result.status, 'success'); assert.equal(result.value, value);
  assert.throws(() => { result.moduleId = 'alpha'; }, TypeError);
  handle(context, 'alpha', 'decline', () => ({status: 'rejected', reason: 'CALLER_RULE'}));
  assert.deepEqual(dispatch(context, message('decline')), {status: 'rejected', moduleId: 'alpha', commandType: 'decline', reason: 'CALLER_RULE'});
  assert.deepEqual(dispatch(context, message('unknown')), {status: 'unhandled', commandType: 'unknown'});
  assert.deepEqual(dispatch(context, message('inventory-use')), {status: 'success', commandType: 'inventory-use', moduleId: 'alpha'});
  assert.deepEqual(trace, ['skill', 'inventory']);
});

test('GF11: throw, async and malformed outcomes fail with owner/type; no poisoned execution guard', async () => {
  const context = create(compositionOf());
  let calls = 0, thenCalls = 0;
  const probes = [
    ['throw', () => { throw Error('probe failure'); }, /probe failure/],
    ['promise', () => Promise.reject(Error('unsupported async')), /Async/],
    ['thenable', () => ({then() { thenCalls++; }}), /Async/],
    ['missing', () => undefined, /explicit success/],
    ['boolean', () => true, /explicit success/],
    ['bad-status', () => ({status: 'unhandled'}), /explicit success/],
    ['bad-reason', () => ({status: 'rejected', reason: ' '}), /rejection reason/],
  ];
  for (const [type, callback, expected] of probes) {
    handle(context, 'beta', type, () => { calls++; return callback(); });
    const result = dispatch(context, message(type));
    assert.equal(result.status, 'failed');
    assert.equal(result.failure.moduleId, 'beta'); assert.equal(result.failure.commandType, type);
    assert.match(result.failure.message, expected);
    assert.equal(Object.isFrozen(result), true); assert.equal(Object.isFrozen(result.failure), true);
  }
  assert.equal(calls, probes.length); assert.equal(thenCalls, 0);
  // Let native rejection observation run; an unhandled rejection fails this test.
  await Promise.resolve();
  assert.deepEqual(dispatch(context, message('still-unhandled')), {status: 'unhandled', commandType: 'still-unhandled'});
});

test('GF12–GF13: registration-order fan-out, exact unsubscribe, owner cleanup and payload ownership', () => {
  const context = create(compositionOf());
  const trace = [], payload = {value: 2};
  const a = add(context, 'beta', 'event-x', event => { trace.push('A'); assert.equal(event.payload, payload); assert.equal(Object.isFrozen(event), true); });
  const b = add(context, 'alpha', 'event-x', () => { trace.push('B'); });
  add(context, 'alpha', 'event-y', () => { trace.push('C'); });
  const registration = {moduleId: 'beta', eventType: 'event-x', handler() { trace.push('D'); }};
  subscribe(context, registration);
  registration.eventType = 'event-y'; registration.handler = () => { trace.push('replacement'); };
  const event = message('event-x', payload);
  const result = publish(context, event);
  assert.deepEqual(result, {ok: true, eventType: 'event-x', completedDeliveries: 3});
  assert.deepEqual(trace, ['A', 'B', 'D']); // Not dependency order (alpha precedes beta).
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(payload), false); assert.equal(Object.isFrozen(event), false);
  assert.deepEqual(payload, {value: 2});
  assert.equal(unsubscribe(context, b), true); assert.equal(unsubscribe(context, b), false);
  trace.length = 0; publish(context, event); assert.deepEqual(trace, ['A', 'D']);
  assert.equal(cleanup(context, 'beta'), 2); assert.equal(cleanup(context, 'beta'), 0);
  assert.equal(unsubscribe(context, a), false);
  trace.length = 0;
  assert.deepEqual(publish(context, event), {ok: true, eventType: 'event-x', completedDeliveries: 0});
  publish(context, message('event-y')); assert.deepEqual(trace, ['C']);
});

test('GF13: subscription mutations use publish-start snapshot and affect only next publish', () => {
  const context = create(compositionOf());
  const trace = [];
  let first = true;
  const a = add(context, 'alpha', 'event-x', () => {
    trace.push('A');
    if (first) {
      first = false;
      assert.equal(unsubscribe(context, a), true);
      assert.equal(cleanup(context, 'beta'), 1);
      add(context, 'alpha', 'event-x', () => { trace.push('D'); });
    }
  });
  add(context, 'beta', 'event-x', () => { trace.push('B'); });
  add(context, 'alpha', 'event-x', () => { trace.push('C'); });
  assert.equal(publish(context, message()).completedDeliveries, 3);
  assert.deepEqual(trace, ['A', 'B', 'C']);
  trace.length = 0;
  assert.equal(publish(context, message()).completedDeliveries, 2);
  assert.deepEqual(trace, ['C', 'D']);
});

test('GF13: fail-fast diagnostics preserve completed deliveries and identify exact subscriber', async () => {
  const context = create(compositionOf());
  const trace = [];
  add(context, 'alpha', 'event-x', () => { trace.push('A'); });
  const bad = add(context, 'beta', 'event-x', () => { trace.push('B'); throw Error('listener probe'); });
  add(context, 'alpha', 'event-x', () => { trace.push('C'); });
  const failed = publish(context, message());
  assert.deepEqual(failed, {ok: false, eventType: 'event-x', completedDeliveries: 1,
    failure: {eventType: 'event-x', moduleId: 'beta', subscription: bad, message: 'listener probe'}});
  assert.deepEqual(trace, ['A', 'B']);
  assert.equal(Object.isFrozen(failed), true); assert.equal(Object.isFrozen(failed.failure), true);
  assertOpaque(failed.failure.subscription);
  unsubscribe(context, bad); trace.length = 0;
  assert.equal(publish(context, message()).completedDeliveries, 2); assert.deepEqual(trace, ['A', 'C']);
  for (const returned of [Promise.reject(Error('async listener')), {then() { throw Error('must not execute thenable'); }}, 1]) {
    let after = 0;
    const token = add(context, 'beta', 'probe', () => returned);
    const later = add(context, 'alpha', 'probe', () => { after++; });
    const result = publish(context, message('probe'));
    assert.equal(result.ok, false); assert.equal(result.completedDeliveries, 0);
    assert.equal(result.failure.subscription, token); assert.equal(result.failure.moduleId, 'beta');
    assert.match(result.failure.message, returned === 1 ? /return undefined/ : /Async/);
    assert.equal(after, 0);
    unsubscribe(context, token); unsubscribe(context, later);
  }
  await Promise.resolve();
  assert.equal(publish(context, message('probe')).ok, true);
});

test('GF10–GF13: malformed boundaries, context isolation, reflection and nested execution', () => {
  const composition = compositionOf();
  const a = create(composition), b = create(composition);
  for (const invalid of [null, {}, {moduleIds: ['alpha'], definitions: []},
    {moduleIds: ['beta', 'alpha'], definitions: [definition('beta', ['alpha']), definition('alpha')]},
    {moduleIds: ['alpha', 'alpha'], definitions: [definition('alpha'), definition('alpha')]},
    {moduleIds: ['other'], definitions: [definition('alpha')]},
  ]) assert.throws(() => create(invalid), TypeError);
  const mutable = {moduleIds: ['alpha'], definitions: [definition('alpha')]};
  const detached = create(mutable); mutable.moduleIds.push('injected');
  assert.throws(() => handle(detached, 'injected', 'probe', () => ({status: 'success'})), TypeError);
  let aCalls = 0, bCalls = 0;
  handle(a, 'alpha', 'probe', () => { aCalls++; return {status: 'success', value: 'A'}; });
  assert.equal(dispatch(b, message('probe')).status, 'unhandled');
  handle(b, 'beta', 'probe', () => { bCalls++; return {status: 'success', value: 'B'}; });
  assert.equal(dispatch(a, message('probe')).value, 'A'); assert.equal(bCalls, 0);
  assert.equal(dispatch(b, message('probe')).value, 'B'); assert.equal(aCalls, 1);
  const token = add(a, 'alpha', 'event-x', () => { aCalls++; });
  add(b, 'beta', 'event-x', () => { bCalls++; });
  assertOpaque(a); assertOpaque(b); assertOpaque(token);
  for (const invalid of [{}, {...token}, null]) assert.throws(() => unsubscribe(a, invalid), TypeError);
  assert.throws(() => unsubscribe(b, token), TypeError);
  assert.throws(() => dispatch({...a}, message('probe')), TypeError);
  for (const registration of [null, {moduleId: 'disabled', eventType: 'event-x', handler() {}},
    {moduleId: 'unknown', eventType: 'event-x', handler() {}},
    {moduleId: 'alpha', eventType: 'bad type', handler() {}}, {moduleId: 'alpha', eventType: 'valid', handler: false},
  ]) assert.throws(() => subscribe(a, registration), TypeError);
  assert.throws(() => cleanup(a, 'unknown'), TypeError);
  assert.throws(() => cleanup(a, 'disabled'), TypeError);
  for (const invalid of [null, {}, {type: 'valid'}, message(''), message(' Upper '), message(3)]) {
    assert.throws(() => dispatch(a, invalid), TypeError);
    assert.throws(() => publish(a, invalid), TypeError);
  }
  publish(a, message()); assert.equal(aCalls, 2); assert.equal(bCalls, 1);
  cleanup(a, 'alpha'); publish(a, message()); publish(b, message());
  assert.equal(aCalls, 2); assert.equal(bCalls, 2);
  // Both callback kinds reject both nested execution operations on the same context.
  for (const outer of ['command', 'event']) {
    for (const nested of [dispatch, publish]) {
      const context = create(composition);
      const callback = () => nested(context, message('nested'));
      if (outer === 'command') {
        handle(context, 'alpha', 'outer', callback);
        const result = dispatch(context, message('outer'));
        assert.equal(result.status, 'failed'); assert.match(result.failure.message, /Reentrant/);
      } else {
        let later = 0;
        add(context, 'alpha', 'outer', callback);
        add(context, 'beta', 'outer', () => { later++; });
        const result = publish(context, message('outer'));
        assert.equal(result.ok, false); assert.match(result.failure.message, /Reentrant/); assert.equal(later, 0);
      }
      assert.equal(dispatch(context, message('after')).status, 'unhandled');
    }
  }
  handle(a, 'alpha', 'caught', () => {
    assert.throws(() => publish(a, message()), /Reentrant/);
    assert.equal(dispatch(b, message('probe')).value, 'B'); // Independent context remains usable.
    assert.equal(publish(b, message()).ok, true);
    return {status: 'success'};
  });
  assert.equal(dispatch(a, message('caught')).status, 'success');
});

test('GF13/GF07: explicit lifecycle wiring subscribes and cleans owner without implicit runtime gating', () => {
  const composition = compositionOf(), messaging = create(composition);
  const trace = [], removed = [];
  let runtime = createGameplayRuntime(composition, {
    alpha: {
      initialize() { add(messaging, 'alpha', 'event-x', () => { trace.push('alpha'); }); },
      stop() { removed.push(cleanup(messaging, 'alpha')); },
      dispose() { removed.push(cleanup(messaging, 'alpha')); },
    },
    beta: {
      initialize() { add(messaging, 'beta', 'event-x', () => { trace.push('beta'); }); },
      dispose() { removed.push(cleanup(messaging, 'beta')); },
    },
  });
  function advance(transition) { const result = transition(runtime); assert.equal(result.ok, true); runtime = result.runtime; }
  assert.equal(publish(messaging, message()).completedDeliveries, 0);
  advance(initializeGameplayRuntime);
  publish(messaging, message()); assert.deepEqual(trace, ['alpha', 'beta']); // Explicitly permitted before start.
  advance(startGameplayRuntime); advance(stopGameplayRuntime);
  trace.length = 0; publish(messaging, message()); assert.deepEqual(trace, ['beta']);
  advance(disposeGameplayRuntime);
  trace.length = 0;
  assert.equal(publish(messaging, message()).completedDeliveries, 0); assert.deepEqual(trace, []);
  assert.deepEqual(removed, [1, 1, 0]); assert.equal(inspectGameplayRuntime(runtime).status, 'disposed');
});
