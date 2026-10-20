import assert from 'node:assert/strict';
import test from 'node:test';
import * as g from '@rpg/gameplay';

// Count real assertions per contract so an empty/no-assertion fixture fails closed.
function contract(name, run) {
  test(name, () => {
    let assertions = 0;
    const checked = new Proxy(assert, {get(target, key) {
      const method = Reflect.get(target, key);
      return (...args) => {assertions++; return method(...args);};
    }});
    run(checked);
    assert.ok(assertions > 0, 'contract must execute real assertions');
  });
}

const target = {id: 'target', kind: 'monster'};
const origin = {kind: 'system', sourceId: 'environment', sourceKey: 'zone-1'};
const timed = durationMs => ({mode: 'timed', durationMs});
const spec = (value = 0.2, operation = 'add_percent', extra = {}) =>
  ({modifierId: 'attack-bonus', target: 'attack', operation, value, enabled: true, ...extra});
const capture = (modifiers = [spec()], classification = 'buff') => ({classification, modifiers});
const group = (effectId = 'focus', sourceKey = origin.sourceKey) => ({targetEntityId: target.id, effectId, sourceKey});
const base = g.createEntityAttributeState(target, {});
function stats(state, other = []) {
  return g.calculateEntityStats(base, {attributeOrder: [], statOrder: ['attack'], attributeRules: {}, attributeBaselines: {},
    baseStats: {attack: 100}, rules: {attack: {default: 0, bounds: {}, enabled: true, precision: {decimalPlaces: 8}, scaling: [], training: 0}},
    flatContributions: {}, modifiers: [...other, ...g.listActiveEffectModifiers(state)]}).stats.attack;
}
function fixture() {
  const clock = {time: 1000, now() {return this.time;}};
  const context = g.createExecutionContext({clock});
  const state = g.createEffectModifierState(g.createEffectLifecycleState(g.createEffectState(target), context));
  return {clock, context, state};
}
function application(lifecycle, id, effectId = 'focus', source = origin, eligible = true) {
  const instance = g.createEffectInstance({effectId}, target, {effectInstanceId: id, source});
  return g.applyEffect({effectId}, {instance}, lifecycle.effectState, g.addEntity(g.createEntityCollection(), target),
    {entityId: target.id, status: 'alive'}, {sourceEligible: eligible, targetEligible: true, allowedTargetLifeStatuses: ['alive']});
}
function addition(f, id, duration = timed(5000), effect = 'focus', source = origin, start = false) {
  const lifecycle = f.state.lifecycle, applied = application(lifecycle, id, effect, source);
  return start ? g.startEffectLifetime(lifecycle, applied, duration, f.context)
    : g.applyEffectStack(lifecycle, applied, duration, {mode: 'stack', maxStacks: 8}, f.context);
}
function commit(f, transition, payload) {
  const result = g.applyEffectModifierTransition(f.state, transition, payload);
  assert.equal(result.status, 'applied'); f.state = result.state; return result;
}
function add(f, id, payload = capture(), duration, effect, source, start) {
  return commit(f, addition(f, id, duration, effect, source, start), payload);
}
function advance(f, atMs) {
  f.clock.time = atMs;
  return commit(f, g.advanceEffectLifecycle(f.state.lifecycle, f.context));
}
function frozen(value) {
  if (value && typeof value === 'object') {assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen);}
}

contract('EF21/22: explicit classification, exact Core identities, apply-time detached immutable captures', assert => {
  const f = fixture(), input = capture([spec()]);
  const initial = f.state;
  add(f, '__proto__', input, undefined, undefined, undefined, true);
  input.modifiers[0].value = 0.4; input.classification = 'debuff'; input.modifiers.push(spec(1));
  assert.deepEqual(f.state.snapshots, [{effectInstanceId: '__proto__', classification: 'buff', modifiers: [spec()]}]);
  assert.deepEqual(g.listActiveEffectModifiers(f.state), [{identity: {source: 'effect', sourceInstanceId: '__proto__', id: 'attack-bonus'},
    target: 'attack', operation: 'add_percent', value: 0.2, enabled: true}]);
  assert.equal(stats(f.state), 120);
  assert.deepEqual(initial.snapshots, []); assert.equal(Object.isFrozen(input), false);
  frozen(f.state); frozen(g.listActiveEffectModifiers(f.state));
  for (const [id, classification, modifiers] of [['constructor', 'neutral', []], ['Poison', 'debuff', [spec(0)]],
    ['poison', 'buff', [spec(-1, 'add_flat')]]]) add(f, id, capture(modifiers, classification));
  assert.deepEqual(f.state.snapshots.map(s => [s.effectInstanceId, s.classification]),
    [['__proto__', 'buff'], ['constructor', 'neutral'], ['Poison', 'debuff'], ['poison', 'buff']]);
  const empty = fixture(); add(empty, 'debuff-no-numbers', capture([], 'debuff'));
  assert.equal(stats(empty.state), 100); assert.equal(empty.state.snapshots.length, 1);
  assert.throws(() => { f.state.snapshots[0].modifiers[0].value = 9; }, TypeError);
  console.log('EFFECT_MODIFIER_CAPTURE_PASS classifications; exact_identity; apply_time; deep_freeze');
});

contract('EF23/24: actual Entity/Core math, disabled and points, independent sources, collisions and unknown targets', assert => {
  const f = fixture(); add(f, 'buff');
  assert.equal(stats(f.state), 120);
  add(f, 'debuff', capture([spec(-10, 'add_flat')], 'debuff'), undefined, 'weakness');
  assert.equal(stats(f.state), 108);
  const equipment = {identity: {source: 'equipment', sourceInstanceId: 'buff', id: 'attack-bonus'},
    target: 'attack', operation: 'add_flat', value: 5, enabled: true};
  assert.equal(stats(f.state, [equipment]), 114);
  assert.equal(stats(f.state, [equipment, {...equipment}]), 114); // Core equivalent dedup.
  assert.throws(() => stats(f.state, [equipment, {...equipment, value: 6}]), /Conflicting Modifier instance/);
  const effectRecord = g.listActiveEffectModifiers(f.state)[0];
  assert.equal(stats(f.state, [effectRecord]), 108);
  assert.throws(() => stats(f.state, [{...effectRecord, value: 0.3}]), /Conflicting Modifier instance/);
  add(f, 'disabled', capture([spec(999, 'add_flat', {enabled: false})]));
  assert.equal(g.listActiveEffectModifiers(f.state).at(-1).enabled, false); assert.equal(stats(f.state), 108);
  add(f, 'points', capture([spec(2, 'add_percentage_points')])); assert.equal(stats(f.state), 110);
  const bad = fixture(); add(bad, 'unknown', capture([spec(1, 'add_flat', {target: 'unsupported-stat'})]));
  assert.throws(() => stats(bad.state), {name: 'TypeError', message: 'Unknown modifier target'});
  const attribute = g.createEntityAttributeState(target, {strength: 10});
  const a = fixture(); add(a, 'attribute', capture([spec(5, 'add_flat', {target: 'strength'})]));
  assert.equal(g.calculateEntityStats(attribute, {attributeOrder: ['strength'], statOrder: [],
    attributeRules: {strength: {default: 0, bounds: {}, enabled: true}}, attributeBaselines: {strength: 0},
    baseStats: {}, rules: {}, flatContributions: {}, modifiers: g.listActiveEffectModifiers(a.state)}).effectiveAttributes.strength, 15);
  assert.deepEqual(base.baseAttributes, {}); assert.deepEqual(attribute.baseAttributes, {strength: 10});
  console.log('EFFECT_MODIFIER_NUMERICAL_PASS literal120_108_114_110; Core_conflicts; Entity_targets');
});

contract('EF25: per-stack values, consume, refresh preservation and refresh capture rejection', assert => {
  const f = fixture(); add(f, 'A', capture([spec(0.1)]), timed(5000));
  add(f, 'B', capture([spec(0.1)]), timed(3000));
  assert.equal(stats(f.state), 120);
  assert.deepEqual(g.listActiveEffectModifiers(f.state).map(m => m.identity.sourceInstanceId), ['A', 'B']);
  const previous = f.state;
  commit(f, g.consumeEffectStacks(f.state.lifecycle, {group: group(), count: 1}));
  assert.deepEqual(f.state.snapshots.map(s => s.effectInstanceId), ['A']); assert.equal(stats(f.state), 110);
  assert.deepEqual(f.state.snapshots[0], previous.snapshots[0]); assert.equal(stats(previous), 120);
  const renewal = g.refreshEffectStackLifetime(f.state.lifecycle, 'A', timed(9000), f.context);
  assert.throws(() => g.applyEffectModifierTransition(f.state, renewal, capture([spec(0.9)], 'debuff')), TypeError);
  commit(f, renewal); assert.equal(stats(f.state), 110);
  assert.deepEqual(f.state.snapshots[0], previous.snapshots[0]); assert.equal(f.state.lifecycle.lifetimes[0].expiresAtMs, 10000);
  const viaApplication = g.applyEffectStack(f.state.lifecycle, application(f.state.lifecycle, 'discarded'), timed(12000),
    {mode: 'refresh', maxStacks: 1}, f.context);
  commit(f, viaApplication); assert.equal(stats(f.state), 110); assert.equal(f.state.snapshots.length, 1);
  add(f, 'new-template', capture([spec(0.3)])); assert.equal(stats(f.state), 140);
  assert.equal(f.state.snapshots[0].modifiers[0].value, 0.1);
  console.log('EFFECT_MODIFIER_STACK_PASS independent120_110; refresh_retains_capture; new_instance_resolves_new_value');
});

contract('EF25: canonical expiry/removal/group cleanup, persistence and pending-expiry projection', assert => {
  const f = fixture(); add(f, 'buff', capture(), timed(1000)); assert.equal(stats(f.state), 120);
  advance(f, 2000); assert.equal(stats(f.state), 100); assert.deepEqual(f.state.snapshots, []);
  add(f, 'debuff', capture([spec(-10, 'add_flat')], 'debuff'), {mode: 'persistent'}, 'weakness');
  assert.equal(stats(f.state), 90);
  commit(f, g.removeEffectLifetime(f.state.lifecycle, 'debuff', 'dispel')); assert.equal(stats(f.state), 100);
  add(f, 'persistent', capture([spec(0.15)]), {mode: 'persistent'}, 'aura');
  advance(f, 50000); assert.equal(stats(f.state), 115);
  add(f, 'A'); add(f, 'B');
  commit(f, g.removeEffectStackGroup(f.state.lifecycle, group(), 'session_cleanup'));
  assert.deepEqual(f.state.snapshots.map(s => s.effectInstanceId), ['persistent']); assert.equal(stats(f.state), 115);
  commit(f, g.removeEffectLifetime(f.state.lifecycle, 'persistent', 'explicit')); assert.equal(stats(f.state), 100);
  const pending = fixture(); add(pending, 'due', capture(), timed(1000));
  const due = {...pending.state, lifecycle: {...pending.state.lifecycle, observedAtMs: 2000}};
  assert.throws(() => g.listActiveEffectModifiers(due), TypeError);
  pending.clock.time = 2000;
  // Advance the last committed canonical lifecycle, then explicitly synchronize.
  commit(pending, g.advanceEffectLifecycle(pending.state.lifecycle, pending.context));
  assert.equal(stats(pending.state), 100);
  assert.deepEqual(base.baseAttributes, {});
  console.log('EFFECT_MODIFIER_CLEANUP_PASS expiry120_100; removal90_100; persistent115; group_isolation; pending_fails');
});

contract('EF22/25: closed nested contracts, exact memberships, no accessors, explicit capture and rejected receipts', assert => {
  const f = fixture(), transition = addition(f, 'A');
  const attempt = payload => g.applyEffectModifierTransition(f.state, transition, payload);
  assert.deepEqual(attempt(undefined), {status: 'rejected', reason: 'capture_required', state: null});
  for (const classification of ['positive', 'negative', 'damage', 'healing', 'unknown', null]) {
    assert.throws(() => attempt(capture([], classification)), TypeError);
  }
  for (const extra of [{operation: 'multiply'}, {operation: 'divide'}, {value: NaN}, {value: Infinity}, {value: -Infinity},
    {value: '1'}, {value: null}, {enabled: 1}, {enabled: undefined}, {modifierId: ' '}, {target: ''}, {extra: 1}]) {
    assert.throws(() => attempt(capture([spec(1, 'add_flat', extra)])), TypeError);
  }
  assert.throws(() => attempt(capture([spec(), spec()])), TypeError);
  let calls = 0;
  const getter = {get value() {calls++; return 1;}};
  for (const payload of [null, {}, {...capture(), extra: 1}, capture(new Array(1)), capture(Object.assign([], {extra: 1})),
    capture([Object.defineProperty(spec(), 'operation', {get() {calls++; return 'add_flat';}})]),
    capture([Object.defineProperty(spec(), 'value', Object.getOwnPropertyDescriptor(getter, 'value'))])]) {
    const beforeCalls = calls; assert.throws(() => attempt(payload), TypeError); assert.equal(calls, beforeCalls);
  }
  assert.equal(calls, 0);
  commit(f, transition, capture());
  assert.throws(() => g.createEffectModifierState(f.state.lifecycle), TypeError);
  for (const state of [{...f.state, extra: 1}, {...f.state, snapshots: []}, {...f.state, snapshots: [...f.state.snapshots, f.state.snapshots[0]]},
    {...f.state, snapshots: [{...f.state.snapshots[0], effectInstanceId: 'orphan'}]},
    {...f.state, lifecycle: {...f.state.lifecycle, effectState: {...f.state.lifecycle.effectState, entityId: 'other'}}}]) {
    assert.throws(() => g.listActiveEffectModifiers(state), TypeError);
  }
  const rejected = g.startEffectLifetime(f.state.lifecycle, application(f.state.lifecycle, 'B', 'focus', origin, false), timed(1), f.context);
  assert.deepEqual(g.applyEffectModifierTransition(f.state, rejected, capture()), {status: 'rejected', reason: 'transition_rejected', state: null});
  assert.equal(stats(f.state), 120);
  const moved = {...transition.state, effectState: {...transition.state.effectState,
    instances: transition.state.effectState.instances.map(i => ({...i, effectId: 'changed'}))}};
  const stale = {...transition, status: 'applied', state: moved, events: []};
  assert.deepEqual(g.applyEffectModifierTransition(f.state, stale), {status: 'rejected', reason: 'stale_transition', state: null});
  console.log('EFFECT_MODIFIER_VALIDATION_PASS closed_data; no_getters; membership; capture_required; rejection_no_candidate');
});

contract('EF25: reject forged deltas/events and wrong membership actions before payload synchronization', assert => {
  const f = fixture(); add(f, 'A'); add(f, 'B');
  const renewal = g.refreshEffectStackLifetime(f.state.lifecycle, 'A', timed(7000), f.context);
  const removed = g.removeEffectLifetime(f.state.lifecycle, 'A', 'explicit');
  const bad = [
    {...renewal, action: 'added'}, {...renewal, events: []}, {...renewal, events: [{...renewal.events[0], effectId: 'other'}]},
    {...removed, events: []}, {...removed, events: [{...removed.events[0], effectInstanceId: 'B'}]},
    {...removed, action: 'group_removed'}, {...removed, events: [{...removed.events[0], atMs: 5}]},
    {...renewal, state: {...renewal.state, lifetimes: renewal.state.lifetimes.map(l => ({...l, startedAtMs: 999}))}},
    {...renewal, reason: 'forged'}, {status: 'rejected', reason: 'forged', state: null, events: []},
    {...renewal, get status() {throw Error('must not invoke');}},
  ];
  for (const result of bad) assert.throws(() => g.applyEffectModifierTransition(f.state, result), TypeError);
  const addC = addition(f, 'C');
  assert.throws(() => g.applyEffectModifierTransition(f.state, {...addC, events: [{...addC.events[0], effectInstanceId: 'A'}]}, capture()), TypeError);
  const reordered = {...renewal, state: {...renewal.state, effectState: {...renewal.state.effectState,
    instances: [...renewal.state.effectState.instances].reverse()}, lifetimes: [...renewal.state.lifetimes].reverse()}};
  assert.equal(g.applyEffectModifierTransition(f.state, reordered).reason, 'stale_transition');
  assert.throws(() => g.applyEffectModifierTransition(f.state, removed, capture()), TypeError);
  assert.equal(stats(f.state), 140);
  console.log('EFFECT_MODIFIER_TRANSITION_PASS action_delta; event_identity; unchanged_survivors; stale_order');
});

contract('EF21–25: independent literal replay through canonical owners and source-isolated payloads', assert => {
  function session() {
    const f = fixture(), history = [], values = [];
    const record = () => {history.push(f.state); values.push(stats(f.state));};
    record(); add(f, 'A', capture(), timed(4000)); record();
    add(f, 'B', capture([spec(-10, 'add_flat')], 'debuff'), timed(2000), 'weakness'); record();
    add(f, 'C', capture([spec(0.1)]), timed(1000)); record();
    commit(f, g.refreshEffectStackLifetime(f.state.lifecycle, 'A', timed(6000), f.context)); record();
    commit(f, g.consumeEffectStacks(f.state.lifecycle, {group: group(), count: 1})); record();
    advance(f, 3000); record();
    commit(f, g.removeEffectLifetime(f.state.lifecycle, 'A', 'explicit')); record();
    assert.deepEqual(values, [100, 120, 108, 117, 117, 108, 120, 100]);
    assert.deepEqual(f.state.snapshots, []); return history;
  }
  const blocked = [[Date, 'now'], [Math, 'random'], [performance, 'now'], [globalThis, 'setTimeout'], [globalThis, 'setInterval']];
  const descriptors = blocked.map(([object, key]) => Object.getOwnPropertyDescriptor(object, key));
  let a, b;
  try {
    for (const [object, key] of blocked) Object.defineProperty(object, key,
      {configurable: true, value: () => {throw Error(`Implicit provider used: ${key}`);}});
    a = session(); b = session();
  } finally {
    blocked.forEach(([object, key], index) => {
      if (descriptors[index]) Object.defineProperty(object, key, descriptors[index]); else delete object[key];
    });
  }
  assert.deepEqual(a, b); assert.notEqual(a[1], b[1]);
  assert.notEqual(a[1].snapshots[0].modifiers, b[1].snapshots[0].modifiers);
  const f = fixture();
  for (const [id, kind, sourceId, sourceKey] of [['skill', 'entity', target.id, 'player/skill'],
    ['armor', 'system', 'equipment', 'armor-1'], ['swamp', 'system', 'environment', 'zone-1']]) {
    add(f, id, capture([spec(1, 'add_flat')]), undefined, 'focus', {kind, sourceId, sourceKey});
  }
  assert.equal(stats(f.state), 103);
  assert.deepEqual(g.listActiveEffectModifiers(f.state).map(m => m.identity.sourceInstanceId), ['skill', 'armor', 'swamp']);
  console.log('EFFECT_MODIFIER_REPLAY_PASS two_sessions; literal100_120_108_117_117_108_120_100; sources103');
});
