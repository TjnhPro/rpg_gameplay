import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as g from '@rpg/gameplay';

const entity = {id: 'monster-1', kind: 'monster'};
const source = {kind: 'entity', sourceId: 'player-1', sourceKey: 'player-1/skill-001'};
const policy = {sourceEligible: true, targetEligible: true, allowedTargetLifeStatuses: ['alive']};
const entities = {entities: [{id: 'player-1', kind: 'player'}, entity]};
const life = {entityId: 'monster-1', status: 'alive'};
const instance = id => ({effectInstanceId: id, effectId: 'poison', source: {...source}, targetEntityId: 'monster-1'});
const event = (type, id, atMs, reason) => ({type, effectInstanceId: id, effectId: 'poison', targetEntityId: 'monster-1', atMs,
  ...(reason === undefined ? {} : {reason})});
const rejected = reason => ({status: 'rejected', reason, state: null, events: []});
function fixture(time = 1000) {
  const clock = {time, calls: 0, now() {this.calls++; return this.time;}};
  const context = g.createExecutionContext({clock});
  return {clock, context, state: g.createEffectLifecycleState(g.createEffectState(entity), context)};
}
function application(state, id = 'A', eligible = true) {
  const request = {instance: instance(id)};
  assert.equal(g.evaluateEffectApplyAdmission({effectId: 'poison'}, request, state.effectState, entities, life,
    {...policy, sourceEligible: eligible}).status, eligible ? 'admitted' : 'rejected');
  return g.applyEffect({effectId: 'poison'}, request, state.effectState, entities, life, {...policy, sourceEligible: eligible});
}
function start(f, id, duration = {mode: 'timed', durationMs: 5000}) {
  const result = g.startEffectLifetime(f.state, application(f.state, id), duration, f.context);
  assert.equal(result.status, 'started'); f.state = result.state; return result;
}
function frozen(value) {
  if (value && typeof value === 'object') {assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen);}
}

test('EF11/EF12: empty initialization, actual EF09 binding, independent timed/persistent/fractional lifetimes', () => {
  const f = fixture();
  assert.equal(f.clock.calls, 1);
  assert.deepEqual(f.state, {effectState: {entityId: 'monster-1', instances: []}, lifetimes: [], observedAtMs: 1000});
  const initial = f.state;
  assert.deepEqual(start(f, 'A'), {status: 'started', reason: 'none', state: {
    effectState: {entityId: 'monster-1', instances: [instance('A')]},
    lifetimes: [{effectInstanceId: 'A', mode: 'timed', startedAtMs: 1000, expiresAtMs: 6000}], observedAtMs: 1000},
    events: [event('started', 'A', 1000)]});
  const afterA = f.state;
  start(f, 'B', {mode: 'persistent'});
  start(f, 'C', {mode: 'timed', durationMs: 0.25});
  assert.deepEqual(f.state.lifetimes, [
    {effectInstanceId: 'A', mode: 'timed', startedAtMs: 1000, expiresAtMs: 6000},
    {effectInstanceId: 'B', mode: 'persistent', startedAtMs: 1000, expiresAtMs: null},
    {effectInstanceId: 'C', mode: 'timed', startedAtMs: 1000, expiresAtMs: 1000.25}]);
  assert.equal(f.clock.calls, 4); frozen(f.state);
  assert.equal(initial.effectState.instances.length, 0); assert.equal(afterA.effectState.instances.length, 1);
  assert.throws(() => g.createEffectLifecycleState(f.state.effectState, f.context), TypeError);
  const clone = structuredClone(f.state), app = structuredClone(application(clone, 'D'));
  const result = g.startEffectLifetime(clone, app, {mode: 'persistent'}, f.context);
  assert.equal(result.status, 'started'); assert.notEqual(result.state.effectState, app.state);
  assert.equal(Object.isFrozen(clone), false); assert.equal(Object.isFrozen(app), false);
  app.state.instances[0].source.sourceKey = 'changed'; clone.lifetimes[0].startedAtMs = 999;
  assert.equal(result.state.effectState.instances[0].source.sourceKey, 'player-1/skill-001');
  assert.equal(result.state.lifetimes[0].startedAtMs, 1000); frozen(result);
  console.log('EFFECT_LIFECYCLE_START_PASS S01-S05/S27/S30; actual_EF09; fractional; values_not_references; one_collection');
});

test('EF13: exact boundary, delayed expiry order, persistent retention and survivor order, terminal once', () => {
  const f = fixture(); start(f, 'A');
  f.clock.time = 5999;
  const before = g.advanceEffectLifecycle(f.state, f.context);
  assert.equal(before.status, 'applied'); assert.equal(before.state.observedAtMs, 5999);
  assert.deepEqual(before.state.effectState.instances, [instance('A')]); assert.deepEqual(before.events, []);
  f.clock.time = 6000;
  const exact = g.advanceEffectLifecycle(before.state, f.context);
  assert.deepEqual(exact, {status: 'applied', reason: 'none', state: {
    effectState: {entityId: 'monster-1', instances: []}, lifetimes: [], observedAtMs: 6000}, events: [event('expired', 'A', 6000)]});
  assert.deepEqual(g.advanceEffectLifecycle(exact.state, f.context), {...exact, events: []});
  assert.deepEqual(g.removeEffectLifetime(exact.state, 'A', 'explicit'), rejected('effect_not_found'));
  const delayed = fixture();
  for (const [id, durationMs] of [['late', 6000], ['a', 4000], ['Z', 4000], ['early', 2000]]) {
    start(delayed, id, {mode: 'timed', durationMs});
  }
  start(delayed, 'survivor-z', {mode: 'persistent'}); start(delayed, 'survivor-a', {mode: 'persistent'});
  delayed.clock.time = 8000;
  const result = g.advanceEffectLifecycle(delayed.state, delayed.context);
  assert.deepEqual(result.events, [event('expired', 'early', 3000), event('expired', 'Z', 5000),
    event('expired', 'a', 5000), event('expired', 'late', 7000)]);
  assert.deepEqual(result.state.effectState.instances, [instance('survivor-z'), instance('survivor-a')]);
  assert.deepEqual(result.state.lifetimes.map(item => item.effectInstanceId), ['survivor-z', 'survivor-a']);
  assert.equal(result.state.observedAtMs, 8000);
  delayed.clock.time = Number.MAX_VALUE;
  assert.deepEqual(g.advanceEffectLifecycle(result.state, delayed.context).state.lifetimes, result.state.lifetimes);
  const fraction = fixture(0); start(fraction, 'F', {mode: 'timed', durationMs: 0.25});
  fraction.clock.time = 0.249; assert.deepEqual(g.advanceEffectLifecycle(fraction.state, fraction.context).events, []);
  fraction.clock.time = 0.25; assert.deepEqual(g.advanceEffectLifecycle(fraction.state, fraction.context).events, [event('expired', 'F', 0.25)]);
  frozen(result); assert.equal(delayed.state.effectState.instances.length, 6);
  console.log('EFFECT_LIFECYCLE_EXPIRY_PASS S06-S11; exact_boundary; delayed_deadlines; lexical_Z_before_a; survivor_order; once');
});

test('EF12/EF15: timeline and stale-baseline rejection return no candidate and no partial mutation', () => {
  const f = fixture(), empty = f.state, appA = application(empty, 'A');
  f.clock.time = 999;
  assert.deepEqual(g.startEffectLifetime(empty, appA, {mode: 'persistent'}, f.context), rejected('time_regressed'));
  assert.deepEqual(g.advanceEffectLifecycle(empty, f.context), rejected('time_regressed'));
  f.clock.time = 1001;
  assert.deepEqual(g.startEffectLifetime(empty, appA, {mode: 'persistent'}, f.context), rejected('lifecycle_not_advanced'));
  f.clock.time = 1000;
  assert.deepEqual(g.startEffectLifetime(empty, application(empty, 'A', false), {mode: 'persistent'}, f.context), rejected('application_rejected'));
  start(f, 'B'); const before = structuredClone(f.state);
  const duplicateStart = g.startEffectLifetime(empty, appA, {mode: 'persistent'}, f.context);
  assert.deepEqual(g.startEffectLifetime(duplicateStart.state, appA, {mode: 'persistent'}, f.context), rejected('stale_application'));
  assert.deepEqual(g.startEffectLifetime(f.state, appA, {mode: 'persistent'}, f.context), rejected('stale_application'));
  const currentApp = application(f.state, 'C');
  for (const change of [i => i.effectId = 'other', i => i.source.kind = 'system', i => i.source.sourceId = 'other',
    i => i.source.sourceKey = 'other', i => i.effectInstanceId = 'other']) {
    const altered = structuredClone(currentApp); change(altered.state.instances[0]);
    assert.deepEqual(g.startEffectLifetime(f.state, altered, {mode: 'persistent'}, f.context), rejected('stale_application'));
  }
  assert.deepEqual(g.startEffectLifetime(empty, currentApp, {mode: 'persistent'}, f.context), rejected('stale_application'));
  const other = structuredClone(currentApp); other.state.entityId = 'other-target';
  for (const item of other.state.instances) item.targetEntityId = 'other-target';
  other.admission.request.instance.targetEntityId = 'other-target';
  assert.deepEqual(g.startEffectLifetime(f.state, other, {mode: 'persistent'}, f.context), rejected('stale_application'));
  assert.deepEqual(f.state, before); frozen(f.state);
  console.log('EFFECT_LIFECYCLE_REJECTIONS_PASS S12-S15; full_prefix_content; stale_not_merge; null_state_empty_events');
});

test('EF14: single timed/persistent removals with each explicit reason, no cascades or duplicate terminal events', () => {
  for (const reason of ['explicit', 'dispel', 'target_defeated', 'source_removed', 'session_cleanup']) {
    const f = fixture(); start(f, 'A'); start(f, 'B', {mode: 'persistent'});
    f.clock.now = () => {throw Error('removal must not read clock');};
    const calls = f.clock.calls;
    const removed = g.removeEffectLifetime(f.state, 'A', reason);
    assert.equal(f.clock.calls, calls); assert.deepEqual(removed.events, [event('removed', 'A', 1000, reason)]);
    assert.deepEqual(removed.state.effectState.instances, [instance('B')]);
    assert.deepEqual(removed.state.lifetimes, [{effectInstanceId: 'B', mode: 'persistent', startedAtMs: 1000, expiresAtMs: null}]);
    assert.deepEqual(g.removeEffectLifetime(removed.state, 'A', reason), rejected('effect_not_found'));
    assert.deepEqual(g.removeEffectLifetime(f.state, 'unknown', reason), rejected('effect_not_found'));
    const last = g.removeEffectLifetime(removed.state, 'B', reason);
    assert.deepEqual(last.events, [event('removed', 'B', 1000, reason)]);
    assert.deepEqual(last.state, {effectState: {entityId: 'monster-1', instances: []}, lifetimes: [], observedAtMs: 1000});
    assert.equal(f.state.effectState.instances.length, 2); frozen(removed); frozen(last);
  }
  console.log('EFFECT_LIFECYCLE_REMOVAL_PASS S16-S19; all_reasons; no_clock; independent; terminal_once');
});

test('EF11/EF15: malformed closed contracts, timing, bindings and contexts fail before ordinary rejections without getters', () => {
  const f = fixture(); start(f, 'A'); start(f, 'B', {mode: 'persistent'});
  const goodApp = application(f.state, 'C'), badApp = application(f.state, 'C', false);
  for (const duration of [null, {}, {mode: 'instant'}, {mode: 'persistent', durationMs: 5000},
    ...[0, -1, NaN, Infinity, -Infinity, '5000', null].map(durationMs => ({mode: 'timed', durationMs}))]) {
    assert.throws(() => g.startEffectLifetime(f.state, badApp, duration, f.context), TypeError);
  }
  for (const [time, durationMs] of [[Number.MAX_VALUE, Number.MAX_VALUE], [Number.MAX_VALUE, 1]]) {
    const overflow = fixture(time);
    assert.throws(() => g.startEffectLifetime(overflow.state, application(overflow.state), {mode: 'timed', durationMs}, overflow.context), TypeError);
  }
  const malformedStates = [null, {}, {...structuredClone(f.state), extra: true}];
  for (const change of [s => s.lifetimes.pop(), s => s.lifetimes.push({...s.lifetimes[0]}),
    s => s.lifetimes[1].effectInstanceId = 'A', s => s.lifetimes[0].effectInstanceId = 'orphan',
    s => s.lifetimes.reverse(), s => s.lifetimes[0].expiresAtMs = null,
    s => s.lifetimes[1].expiresAtMs = 6000, s => s.lifetimes[0].mode = 'instant',
    s => s.lifetimes[0].startedAtMs = 1001, s => s.lifetimes[0].startedAtMs = -1,
    s => s.lifetimes[0].expiresAtMs = 1000, s => s.observedAtMs = 6000,
    s => s.observedAtMs = NaN, s => s.observedAtMs = -1,
    s => delete s.lifetimes[0], s => s.lifetimes.extra = true,
    s => s.lifetimes[0].extra = true, s => s.effectState.instances[0].source.extra = true]) {
    const s = structuredClone(f.state); change(s); malformedStates.push(s);
  }
  for (const s of malformedStates) {
    assert.throws(() => g.removeEffectLifetime(s, 'missing', 'explicit'), TypeError);
    assert.throws(() => g.advanceEffectLifecycle(s, f.context), TypeError);
    assert.throws(() => g.startEffectLifetime(s, badApp, {mode: 'persistent'}, f.context), TypeError);
  }
  for (const change of [a => a.extra = true, a => a.reason = 'source_ineligible', a => a.status = 'started',
    a => a.admission.status = 'rejected', a => a.admission.reason = 'source_ineligible',
    a => a.admission.extra = true, a => a.admission.request.extra = true,
    a => a.admission.request.instance.source.sourceKey = 'mismatch', a => a.state = null]) {
    const a = structuredClone(goodApp); change(a);
    assert.throws(() => g.startEffectLifetime(f.state, a, {mode: 'persistent'}, f.context), TypeError);
  }
  for (const change of [a => a.state = f.state.effectState, a => a.reason = 'none',
    a => a.admission.reason = 'target_ineligible', a => a.admission.status = 'admitted']) {
    const a = structuredClone(badApp); change(a);
    assert.throws(() => g.startEffectLifetime(f.state, a, {mode: 'persistent'}, f.context), TypeError);
  }
  for (const reason of [null, '', 'expired', 'EXPLICIT', {}, undefined]) {
    assert.throws(() => g.removeEffectLifetime(f.state, 'missing', reason), TypeError);
  }
  for (const id of ['', '  ', null, 1]) assert.throws(() => g.removeEffectLifetime(f.state, id, 'explicit'), TypeError);
  for (const output of [-1, NaN, Infinity, '1000', null]) {
    const ctx = g.createExecutionContext({clock: {now: () => output}});
    assert.throws(() => g.startEffectLifetime(f.state, badApp, {mode: 'persistent'}, ctx), TypeError);
    assert.throws(() => g.advanceEffectLifecycle(f.state, ctx), TypeError);
    assert.throws(() => g.createEffectLifecycleState(g.createEffectState(entity), ctx), TypeError);
  }
  assert.throws(() => g.startEffectLifetime(f.state, application(fixture().state), {mode: 'persistent'}, {}), TypeError);
  let getters = 0;
  const reads = [
    [() => structuredClone(f.state), s => s, s => g.removeEffectLifetime(s, 'missing', 'explicit')],
    [() => structuredClone(f.state), s => s.lifetimes[0], s => g.advanceEffectLifecycle(s, f.context)],
    [() => structuredClone(f.state), s => s.lifetimes, s => g.advanceEffectLifecycle(s, f.context)],
    [() => structuredClone(goodApp), a => a.admission.request.instance.source,
      a => g.startEffectLifetime(f.state, a, {mode: 'persistent'}, f.context)],
    [() => ({mode: 'timed', durationMs: 5000}), d => d,
      d => g.startEffectLifetime(f.state, badApp, d, f.context)],
  ];
  for (const [make, select, call] of reads) {
    for (const kind of ['accessor', 'symbol', 'inherited', 'missing']) {
      const value = make(), record = select(value), key = Object.keys(record)[0];
      if (kind === 'symbol') record[Symbol('extra')] = 1;
      else if (kind === 'missing') delete record[key];
      else if (kind === 'inherited') {const original = record[key]; delete record[key]; Object.setPrototypeOf(record, {[key]: original});}
      else Object.defineProperty(record, key, {get() {getters++; throw Error('getter invoked');}});
      assert.throws(() => call(value), TypeError);
    }
  }
  assert.equal(getters, 0);
  console.log('EFFECT_LIFECYCLE_VALIDATION_PASS S23-S26; closed_records; getters0; malformed_before_rejection; overflow_precision');
});

test('EF15: two independent literal replay traces and historical snapshots without hidden time/RNG/timers', () => {
  const originals = [Date.now, Math.random, globalThis.setTimeout, globalThis.setInterval];
  const performanceNow = Object.getOwnPropertyDescriptor(performance, 'now');
  const denied = () => {throw Error('implicit provider');};
  try {
    Date.now = Math.random = globalThis.setTimeout = globalThis.setInterval = denied;
    Object.defineProperty(performance, 'now', {value: denied, configurable: true});
    const run = () => {
      const f = fixture(), history = [f.state];
      start(f, 'A'); history.push(f.state);
      start(f, 'B', {mode: 'persistent'}); history.push(f.state);
      f.clock.time = 4000; f.state = g.advanceEffectLifecycle(f.state, f.context).state;
      const removed = g.removeEffectLifetime(f.state, 'B', 'explicit'); f.state = removed.state; history.push(f.state);
      f.clock.time = 6000; const expired = g.advanceEffectLifecycle(f.state, f.context); history.push(expired.state);
      assert.deepEqual(expired.state, {effectState: {entityId: 'monster-1', instances: []}, lifetimes: [], observedAtMs: 6000});
      assert.deepEqual([...removed.events, ...expired.events], [event('removed', 'B', 4000, 'explicit'), event('expired', 'A', 6000)]);
      assert.deepEqual(history.map(s => [s.effectState.instances.map(i => i.effectInstanceId), s.observedAtMs]),
        [[[], 1000], [['A'], 1000], [['A', 'B'], 1000], [['A'], 4000], [[], 6000]]);
      history.forEach(frozen); assert.equal(f.clock.calls, 5); return history;
    };
    const first = run(), second = run(); assert.deepEqual(first, second); assert.notEqual(first[2], second[2]);
  } finally {
    [Date.now, Math.random, globalThis.setTimeout, globalThis.setInterval] = originals;
    if (performanceNow) Object.defineProperty(performance, 'now', performanceNow); else delete performance.now;
  }
  console.log('EFFECT_LIFECYCLE_REPLAY_PASS S28-S29; sessions2_literal; history_frozen; no_implicit_providers');
});

test('EF14/EF15: real Entity death stays caller-mediated, sibling snapshots unchanged, entity+effect only', () => {
  const f = fixture(), actor = g.createEntity({id: 'player-1', kind: 'player'});
  const targetResources = g.createEntityResourceState(entity, {health: {minimum: 0, maximum: 100, current: 0}, mana: {minimum: 0, maximum: 50, current: 30}});
  const actorResources = g.createEntityResourceState(actor, {health: {minimum: 0, maximum: 100, current: 0}});
  const attributes = g.createEntityAttributeState(entity, {strength: 20});
  const ranks = g.createSkillRankState(actor, {fireball: 1});
  const combat = g.createCombatActionContext({actionId: 'attack-1', actionType: 'attack', sourceEntityId: 'player-1', target: {kind: 'entity', entityId: 'monster-1'}});
  const skill = g.createSkillInstance(g.createSkillDefinition({skillId: 'fireball'}), actor, {instanceId: 'skill-1'});
  const owned = {targetResources, actorResources, attributes, ranks, combat, skill, life}; const before = structuredClone(owned);
  start(f, 'A'); start(f, 'B', {mode: 'persistent'});
  const actorDead = g.resolveEntityDefeat(g.createEntityLifeState(actor, {status: 'alive'}), actorResources, {resourceId: 'health', minimum: 0, maximum: 100});
  assert.equal(actorDead.state.status, 'dead');
  f.clock.time = 2000; const advanced = g.advanceEffectLifecycle(f.state, f.context);
  assert.deepEqual(advanced.events, []); assert.equal(advanced.state.effectState.instances.length, 2);
  const targetDead = g.resolveEntityDefeat(life, targetResources, {resourceId: 'health', minimum: 0, maximum: 100});
  assert.equal(targetDead.state.status, 'dead');
  const cleanup = g.removeEffectLifetime(advanced.state, 'A', 'target_defeated');
  assert.deepEqual(cleanup.events, [event('removed', 'A', 2000, 'target_defeated')]);
  assert.deepEqual(cleanup.state.effectState.instances, [instance('B')]); assert.deepEqual(owned, before);
  const registryData = JSON.parse(readFileSync(new URL('./effect-modules.json', import.meta.url), 'utf8'));
  let registry = g.createModuleRegistry(); for (const module of registryData.modules) registry = g.registerModule(registry, module);
  const composition = g.composeModules(registry, g.configureModules(registry, {enable: ['entity', 'effect']}));
  assert.deepEqual(composition.moduleIds, ['entity', 'effect']);
  console.log('EFFECT_LIFECYCLE_OWNERS_PASS S20-S22/S31-S32; actual_Entity_death; caller_cleanup; no_sibling_writes; optional');
});
