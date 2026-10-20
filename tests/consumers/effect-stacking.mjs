import assert from 'node:assert/strict';
import test from 'node:test';
import * as g from '@rpg/gameplay';

const entity = {id: 'monster-1', kind: 'monster'};
const source = {kind: 'entity', sourceId: 'player-1', sourceKey: 'skill/poison'};
const key = {targetEntityId: 'monster-1', effectId: 'poison', sourceKey: 'skill/poison'};
const timed = durationMs => ({mode: 'timed', durationMs});
const persistent = {mode: 'persistent'};
const stack = maxStacks => ({mode: 'stack', maxStacks});
const refresh = {mode: 'refresh', maxStacks: 1};
const rejected = reason => ({status: 'rejected', reason, state: null, events: []});
function fixture(target = entity) {
  const clock = {time: 1000, calls: 0, now() {this.calls++; return this.time;}};
  const context = g.createExecutionContext({clock});
  return {clock, context, state: g.createEffectLifecycleState(g.createEffectState(target), context)};
}
function application(state, id, origin = source, effect = 'poison', eligible = true) {
  const target = {id: state.effectState.entityId, kind: 'monster'};
  const instance = g.createEffectInstance({effectId: effect}, target, {effectInstanceId: id, source: origin});
  return g.applyEffect({effectId: effect}, {instance}, state.effectState,
    [target, {id: 'player-1', kind: 'player'}, {id: 'player-2', kind: 'player'}]
      .reduce((collection, item) => g.addEntity(collection, item), g.createEntityCollection()),
    {entityId: target.id, status: 'alive'},
    {sourceEligible: eligible, targetEligible: true, allowedTargetLifeStatuses: ['alive']});
}
function add(f, id, duration = timed(5000), policy = stack(5), origin = source, effect = 'poison') {
  const result = g.applyEffectStack(f.state, application(f.state, id, origin, effect), duration, policy, f.context);
  assert.equal(result.status, 'applied'); f.state = result.state; return result;
}
function advance(f, time) {
  f.clock.time = time;
  const result = g.advanceEffectLifecycle(f.state, f.context);
  assert.equal(result.status, 'applied'); f.state = result.state; return result;
}
const ids = state => state.effectState.instances.map(instance => instance.effectInstanceId);
const deadlines = state => state.lifetimes.map(lifetime => [lifetime.effectInstanceId, lifetime.startedAtMs, lifetime.expiresAtMs]);
function frozen(value) {
  if (value && typeof value === 'object') {assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen);}
}

test('EF16: exact derived groups, stable appearance order, source isolation, special keys and source-agnostic origins', () => {
  const f = fixture(); assert.deepEqual(g.inspectEffectStackGroups(f.state), []); frozen(g.inspectEffectStackGroups(f.state));
  add(f, 'A'); add(f, 'B', timed(6000), stack(5), {...source, sourceKey: 'equipment/poison'});
  add(f, 'C'); add(f, 'D', persistent, stack(5), {kind: 'system', sourceId: 'weather', sourceKey: 'environment'});
  add(f, 'E', persistent, stack(5), source, 'Poison');
  add(f, '__proto__', persistent, stack(5), {...source, sourceKey: '__proto__'}, 'constructor');
  add(f, 'constructor', persistent, stack(5), {...source, sourceKey: 'Skill/poison'});
  const groups = g.inspectEffectStackGroups(f.state);
  assert.deepEqual(groups.map(group => [group.key.effectId, group.key.sourceKey, group.instanceIds, group.stackCount]), [
    ['poison', 'skill/poison', ['A', 'C'], 2], ['poison', 'equipment/poison', ['B'], 1],
    ['poison', 'environment', ['D'], 1], ['Poison', 'skill/poison', ['E'], 1],
    ['constructor', '__proto__', ['__proto__'], 1], ['poison', 'Skill/poison', ['constructor'], 1]]);
  assert.deepEqual(groups[0], {key, source, instanceIds: ['A', 'C'], stackCount: 2}); frozen(groups);
  const other = fixture({id: 'monster-2', kind: 'monster'}); add(other, 'A');
  assert.deepEqual(g.inspectEffectStackGroups(other.state)[0].key, {...key, targetEntityId: 'monster-2'});
  const clone = structuredClone(f.state), view = g.inspectEffectStackGroups(clone);
  clone.effectState.instances[0].source.sourceId = 'changed';
  assert.equal(view[0].source.sourceId, 'player-1'); assert.equal(Object.isFrozen(clone), false);
  console.log('EFFECT_STACK_GROUPS_PASS S12-S14/S24; exact_D06; derived; detached; no_registry');
});

test('EF17/EF19: accepted EF09 binding, capacity boundaries, source conflicts and stable rejection priority', () => {
  const f = fixture(), first = application(f.state, 'A');
  assert.deepEqual(g.evaluateEffectStackAdmission(f.state, first, timed(5000), stack(5), f.context),
    {status: 'admitted', reason: 'none', operation: 'add', group: key});
  add(f, 'A'); add(f, 'B'); add(f, 'C'); add(f, 'D'); add(f, 'E');
  const full = f.state, sixth = application(full, 'F');
  assert.deepEqual(g.applyEffectStack(full, sixth, timed(5000), stack(5), f.context), rejected('max_stacks_reached'));
  assert.deepEqual(ids(full), ['A', 'B', 'C', 'D', 'E']);
  const conflict = application(full, 'F', {...source, sourceId: 'player-2'});
  assert.deepEqual(g.applyEffectStack(full, conflict, timed(5000), refresh, f.context), rejected('source_identity_conflict'));
  const systemConflict = application(full, 'F', {...source, kind: 'system'});
  assert.equal(g.evaluateEffectStackAdmission(full, systemConflict, timed(5000), stack(5), f.context).reason, 'source_identity_conflict');
  assert.deepEqual(g.applyEffectStack(full, sixth, persistent, refresh, f.context), rejected('group_policy_conflict'));
  f.clock.time = 999;
  assert.deepEqual(g.applyEffectStack(full, first, timed(1), stack(1), f.context), rejected('stale_application'));
  const denied = application(full, 'F', source, 'poison', false);
  assert.deepEqual(g.applyEffectStack(full, denied, timed(1), stack(1), f.context), rejected('application_rejected'));
  assert.deepEqual(g.applyEffectStack(full, sixth, timed(1), stack(5), f.context), rejected('time_regressed'));
  f.clock.time = 1001;
  assert.deepEqual(g.applyEffectStack(full, sixth, timed(1), stack(5), f.context), rejected('lifecycle_not_advanced'));
  f.clock.time = 1000;
  const single = fixture(); add(single, 'A', timed(5000), stack(1));
  assert.deepEqual(g.applyEffectStack(single.state, application(single.state, 'B'), timed(5000), stack(1), single.context), rejected('max_stacks_reached'));
  add(single, 'C', timed(5000), stack(1), {...source, sourceKey: 'independent'});
  // Full-value candidate matching rejects changed historical payload, not just IDs.
  const stale = structuredClone(sixth); stale.state.instances[0].source.sourceId = 'player-2';
  assert.deepEqual(g.applyEffectStack(full, stale, timed(5000), stack(9), f.context), rejected('stale_application'));
  console.log('EFFECT_STACK_ADMISSION_PASS S01-S04/S14-S15/S26; full_validation; priority; capacity');
});

test('EF18: renewal retains anchor and start, never shortens, independent lifetimes and persistent mode rules', () => {
  const f = fixture(); add(f, 'A', timed(5000), refresh);
  const original = f.state.effectState.instances[0]; advance(f, 4000);
  const attempt = application(f.state, 'B'), attemptCopy = structuredClone(attempt);
  assert.equal(g.evaluateEffectStackAdmission(f.state, attempt, timed(5000), refresh, f.context).operation, 'refresh');
  const result = g.applyEffectStack(f.state, attempt, timed(5000), refresh, f.context);
  assert.equal(result.action, 'refreshed');
  assert.deepEqual(result.state.effectState.instances, [original]);
  assert.deepEqual(deadlines(result.state), [['A', 1000, 9000]]);
  assert.deepEqual(result.events, [{type: 'refreshed', effectInstanceId: 'A', effectId: 'poison', targetEntityId: 'monster-1', atMs: 4000, expiresAtMs: 9000}]);
  assert.deepEqual(attempt, attemptCopy); f.state = result.state;
  const shorter = g.refreshEffectStackLifetime(f.state, 'A', timed(1000), f.context);
  assert.deepEqual(deadlines(shorter.state), [['A', 1000, 9000]]);
  assert.deepEqual(g.applyEffectStack(f.state, application(f.state, 'C'), persistent, refresh, f.context), rejected('duration_mode_conflict'));
  const multiple = fixture(); add(multiple, 'A', timed(4000)); add(multiple, 'B', timed(6000)); add(multiple, 'C', timed(8000));
  advance(multiple, 4000);
  const renewed = g.refreshEffectStackLifetime(multiple.state, 'B', timed(6000), multiple.context);
  assert.deepEqual(deadlines(renewed.state), [['A', 1000, 5000], ['B', 1000, 10000], ['C', 1000, 9000]]);
  multiple.state = renewed.state;
  assert.deepEqual(advance(multiple, 6000).events.map(event => event.effectInstanceId), ['A']);
  assert.deepEqual(ids(multiple.state), ['B', 'C']);
  const p = fixture(); add(p, 'P', persistent, refresh);
  assert.deepEqual(g.applyEffectStack(p.state, application(p.state, 'Q'), persistent, refresh, p.context), rejected('persistent_already_present'));
  assert.deepEqual(g.applyEffectStack(p.state, application(p.state, 'Q'), timed(5000), refresh, p.context), rejected('duration_mode_conflict'));
  assert.deepEqual(g.refreshEffectStackLifetime(p.state, 'P', timed(5000), p.context), rejected('not_timed'));
  assert.deepEqual(g.refreshEffectStackLifetime(f.state, 'A', persistent, f.context), rejected('not_timed'));
  assert.deepEqual(g.refreshEffectStackLifetime(f.state, 'missing', timed(1), f.context), rejected('effect_not_found'));
  add(p, 'Q', persistent, stack(2)); assert.deepEqual(deadlines(p.state), [['P', 1000, null], ['Q', 1000, null]]);
  frozen(result); console.log('EFFECT_STACK_REFRESH_PASS S05-S11; original_identity; no_shortening; independent_expiry; persistent');
});

test('EF20: exact-N atomic consume, deadline/lexical/persistent order, whole group removal and untouched survivors', () => {
  const f = fixture(); add(f, 'A', timed(6000)); add(f, 'a', timed(4000)); add(f, 'P', persistent);
  add(f, 'Z', timed(4000)); add(f, 'other', timed(3000), stack(5), {...source, sourceKey: 'other'});
  const before = f.state, calls = f.clock.calls;
  assert.deepEqual(g.consumeEffectStacks(before, {group: key, count: 5}), rejected('insufficient_stacks'));
  assert.deepEqual(g.consumeEffectStacks(before, {group: {...key, sourceKey: 'missing'}, count: 1}), rejected('group_not_found'));
  const consumed = g.consumeEffectStacks(before, {group: key, count: 2});
  assert.equal(consumed.action, 'consumed');
  assert.deepEqual(consumed.events, [{type: 'stack-consumed', group: key, consumedInstanceIds: ['Z', 'a'], remainingStacks: 2, atMs: 1000}]);
  assert.deepEqual(ids(consumed.state), ['A', 'P', 'other']);
  assert.deepEqual(ids(before), ['A', 'a', 'P', 'Z', 'other']);
  const all = g.consumeEffectStacks(consumed.state, {group: key, count: 2});
  assert.deepEqual(all.events[0].consumedInstanceIds, ['A', 'P']); assert.deepEqual(ids(all.state), ['other']);
  const removed = g.removeEffectStackGroup(before, key, 'dispel');
  assert.equal(removed.action, 'group_removed');
  assert.deepEqual(removed.events.map(event => [event.effectInstanceId, event.type, event.reason, event.atMs]),
    [['Z', 'removed', 'dispel', 1000], ['a', 'removed', 'dispel', 1000], ['A', 'removed', 'dispel', 1000], ['P', 'removed', 'dispel', 1000]]);
  assert.deepEqual(removed.state.effectState.instances, [before.effectState.instances[4]]);
  assert.deepEqual(removed.state.lifetimes, [before.lifetimes[4]]);
  assert.deepEqual(g.removeEffectStackGroup(removed.state, key, 'explicit'), rejected('group_not_found'));
  assert.deepEqual(g.removeEffectStackGroup(before, {...key, targetEntityId: 'monster-2'}, 'explicit'), rejected('group_not_found'));
  assert.equal(f.clock.calls, calls); frozen(consumed); frozen(removed);
  console.log('EFFECT_STACK_CONSUME_PASS S17-S23; exact_N; lexical_Z_before_a; persistent_last; survivor_order; no_clock');
});

test('EF19: due membership rejects pending_expiry without hidden expiration; old lifecycle validation preserved', () => {
  const f = fixture(); add(f, 'A', timed(4000));
  const valid = f.state, due = {...structuredClone(valid), observedAtMs: 5000}; f.clock.time = 5000;
  const attempt = application(due, 'B');
  assert.deepEqual(g.applyEffectStack(due, attempt, timed(5000), stack(5), f.context), rejected('pending_expiry'));
  assert.deepEqual(g.refreshEffectStackLifetime(due, 'A', timed(5000), f.context), rejected('pending_expiry'));
  assert.deepEqual(g.consumeEffectStacks(due, {group: key, count: 1}), rejected('pending_expiry'));
  assert.deepEqual(g.removeEffectStackGroup(due, key, 'explicit'), rejected('pending_expiry'));
  assert.deepEqual(ids(due), ['A']);
  assert.throws(() => g.advanceEffectLifecycle(due, f.context), TypeError);
  // Advance the last valid canonical snapshot, then build a fresh EF09 application.
  assert.deepEqual(advance(f, 5000).events.map(event => event.effectInstanceId), ['A']);
  add(f, 'B'); assert.deepEqual(ids(f.state), ['B']);
  console.log('EFFECT_STACK_PENDING_PASS S25; explicit_boundary; no_silent_expiry; EF11_EF15_preserved');
});

test('EF16-EF20: closed contracts, no getters, malformed before rejections, arithmetic and snapshot isolation', () => {
  const f = fixture(); add(f, 'A', timed(5000), stack(1));
  const app = application(f.state, 'B'), call = (policy = stack(1), duration = timed(5000), state = f.state, receipt = app, ctx = f.context) =>
    g.applyEffectStack(state, receipt, duration, policy, ctx);
  for (const bad of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => call(stack(bad)), TypeError);
    assert.throws(() => g.consumeEffectStacks(f.state, {group: key, count: bad}), TypeError);
  }
  for (const bad of [{mode: 'refresh', maxStacks: 2}, {mode: 'replace', maxStacks: 1}, {mode: 'stack'},
    {...stack(1), extra: 0}, {...stack(1), [Symbol()]: 0}, Object.create(stack(1))]) assert.throws(() => call(bad), TypeError);
  const counter = {calls: 0}; const getter = (input, field) => Object.defineProperty({...input}, field, {get() {counter.calls++; throw Error('getter');}, enumerable: true});
  assert.throws(() => call(getter(stack(1), 'maxStacks')), TypeError);
  assert.throws(() => g.consumeEffectStacks(f.state, {group: getter(key, 'sourceKey'), count: 1}), TypeError);
  assert.throws(() => call(stack(1), getter(timed(1), 'durationMs')), TypeError);
  assert.throws(() => call(stack(1), timed(1), f.state, getter(app, 'admission')), TypeError);
  assert.throws(() => g.inspectEffectStackGroups(getter(f.state, 'lifetimes')), TypeError);
  assert.equal(counter.calls, 0);
  for (const bad of [{...key, extra: 0}, {...key, sourceKey: ''}, Object.create(key), {...key, [Symbol()]: 0}]) {
    assert.throws(() => g.removeEffectStackGroup(f.state, bad, 'explicit'), TypeError);
  }
  assert.throws(() => g.removeEffectStackGroup(f.state, key, 'consumed'), TypeError);
  assert.throws(() => g.consumeEffectStacks(f.state, {group: key, count: 1, extra: 0}), TypeError);
  for (const mutate of [s => {s.lifetimes = Array(1);}, s => {s.lifetimes[0].expiresAtMs = NaN;},
    s => {s.lifetimes[0].effectInstanceId = 'wrong';}, s => {s.effectState.instances[0].targetEntityId = 'wrong';},
    s => {s.effectState.instances.push(s.effectState.instances[0]); s.lifetimes.push(s.lifetimes[0]);}]) {
    const bad = structuredClone(f.state); mutate(bad); assert.throws(() => g.inspectEffectStackGroups(bad), TypeError);
  }
  const conflicting = fixture(); add(conflicting, 'A'); add(conflicting, 'B');
  const bad = structuredClone(conflicting.state); bad.effectState.instances[1].source.sourceId = 'player-2';
  assert.throws(() => g.inspectEffectStackGroups(bad), TypeError);
  assert.throws(() => call(stack(1), timed(0)), TypeError);
  assert.throws(() => call(stack(1), timed(Number.MAX_VALUE), f.state, app, g.createExecutionContext({clock: {now: () => Number.MAX_VALUE}})), TypeError);
  assert.throws(() => call(stack(1), timed(Number.MIN_VALUE)), TypeError);
  assert.throws(() => call(stack(1), timed(1), f.state, app, {}), TypeError);
  const input = structuredClone(conflicting.state), receipt = structuredClone(application(input, 'C')), duration = timed(5000), policy = stack(5);
  const result = g.applyEffectStack(input, receipt, duration, policy, conflicting.context);
  const before = structuredClone(result);
  input.effectState.instances[0].source.sourceKey = 'changed'; receipt.state.instances[2].source.sourceId = 'changed';
  duration.durationMs = 10; policy.maxStacks = 1;
  assert.deepEqual(result, before); frozen(result);
  for (const value of [input, receipt, duration, policy]) assert.equal(Object.isFrozen(value), false);
  console.log('EFFECT_STACK_VALIDATION_PASS S16/S27; closed_records; getters_zero; overflow; deep_freeze; detached');
});

test('EF16-EF20: independent replay matches literal oracle, caller clock only and no numerical side effects', () => {
  function run() {
    const f = fixture(), trace = [];
    const sentinels = {resources: g.createEntityResourceState(entity,
      {hp: {minimum: 0, maximum: 100, current: 100}, mana: {minimum: 0, maximum: 50, current: 50}}),
      attributes: g.createEntityAttributeState(entity, {strength: 20}), life: g.createEntityLifeState(entity, {status: 'alive'}),
      skill: g.createSkillInstance({skillId: 'poison'}, entity, {instanceId: 'skill-1'})};
    const before = structuredClone(sentinels);
    function record(result) {
      trace.push([result.status, result.status === 'applied' ? result.action ?? 'advance' : result.reason,
        result.state ? ids(result.state) : null, result.events.map(event => event.type)]);
      if (result.state) f.state = result.state;
    }
    record(add(f, 'A', timed(4000), stack(2))); record(add(f, 'B', timed(6000), stack(2)));
    advance(f, 4000);
    record(g.refreshEffectStackLifetime(f.state, 'B', timed(6000), f.context));
    record(g.applyEffectStack(f.state, application(f.state, 'C'), timed(5000), stack(2), f.context));
    record(g.consumeEffectStacks(f.state, {group: key, count: 1}));
    f.clock.time = 6000; record(g.advanceEffectLifecycle(f.state, f.context));
    record(g.removeEffectStackGroup(f.state, key, 'explicit'));
    assert.deepEqual(trace, [
      ['applied', 'added', ['A'], ['started']], ['applied', 'added', ['A', 'B'], ['started']],
      ['applied', 'refreshed', ['A', 'B'], ['refreshed']], ['rejected', 'max_stacks_reached', null, []],
      ['applied', 'consumed', ['B'], ['stack-consumed']], ['applied', 'advance', ['B'], []],
      ['applied', 'group_removed', [], ['removed']]]);
    assert.deepEqual(deadlines(f.state), []); assert.equal(f.clock.calls, 7);
    assert.deepEqual(sentinels, before); return {trace, state: f.state};
  }
  const blocked = () => {throw Error('implicit provider');};
  const saved = [Date.now, Math.random, globalThis.setTimeout, globalThis.setInterval, Object.getOwnPropertyDescriptor(performance, 'now')];
  let a, b;
  try {
    Date.now = blocked; Math.random = blocked; globalThis.setTimeout = blocked; globalThis.setInterval = blocked;
    Object.defineProperty(performance, 'now', {value: blocked, configurable: true});
    a = run(); b = run();
  } finally {
    [Date.now, Math.random, globalThis.setTimeout, globalThis.setInterval] = saved;
    if (saved[4]) Object.defineProperty(performance, 'now', saved[4]); else delete performance.now;
  }
  assert.deepEqual(a, b); assert.notEqual(a.state, b.state); assert.notEqual(a.trace, b.trace);
  console.log('EFFECT_STACK_REPLAY_PASS S28-S29; literal_oracle; caller_clock_7; no_numerical_mutation');
});
