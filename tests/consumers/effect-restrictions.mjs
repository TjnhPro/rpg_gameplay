import assert from 'node:assert/strict';
import test from 'node:test';
import * as g from '@rpg/gameplay';

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
const actor = {id: 'player-1', kind: 'player'}, enemy = {id: 'enemy', kind: 'monster'};
const origin = {kind: 'system', sourceId: 'environment', sourceKey: 'zone-1'};
const timed = durationMs => ({mode: 'timed', durationMs});
const capture = (statusIds = [], restrictionIds = []) => ({statusIds, restrictionIds});
const group = (effectId = 'silence', sourceKey = origin.sourceKey) => ({targetEntityId: actor.id, effectId, sourceKey});
const entities = g.addEntity(g.addEntity(g.createEntityCollection(), actor), enemy);
const life = {entityId: actor.id, status: 'alive'};
const magicPolicy = {blockedByRestrictionIds: ['disable-all-actions', 'disable-magic-skill']};
const combatPolicy = {blockedByRestrictionIds: ['disable-all-actions']};
function fixture() {
  const clock = {time: 1000, now() {return this.time;}};
  const context = g.createExecutionContext({clock});
  const lifecycle = g.createEffectLifecycleState(g.createEffectState(actor), context);
  return {clock, context, lifecycle, state: g.createEffectStatusState(lifecycle)};
}
function request(f, id, effectId = 'silence', source = origin) {
  return {instance: g.createEffectInstance({effectId}, actor, {effectInstanceId: id, source})};
}
function application(f, id, effectId = 'silence', source = origin, policy = {}) {
  return g.applyEffect({effectId}, request(f, id, effectId, source), f.lifecycle.effectState, entities, life,
    {sourceEligible: true, targetEligible: true, allowedTargetLifeStatuses: ['alive'], ...policy});
}
function addition(f, id, duration = timed(5000), effectId = 'silence', source = origin, start = false) {
  const accepted = application(f, id, effectId, source);
  return start ? g.startEffectLifetime(f.lifecycle, accepted, duration, f.context)
    : g.applyEffectStack(f.lifecycle, accepted, duration, {mode: 'stack', maxStacks: 8}, f.context);
}
function commit(f, transition, payload) {
  const result = g.applyEffectStatusTransition(f.state, f.lifecycle, transition, payload);
  assert.equal(result.status, 'applied');
  f.lifecycle = transition.state; f.state = result.state;
  return result;
}
function add(f, id, payload = capture(), duration, effectId, source, start) {
  return commit(f, addition(f, id, duration, effectId, source, start), payload);
}
function advance(f, atMs) {
  f.clock.time = atMs; return commit(f, g.advanceEffectLifecycle(f.lifecycle, f.context));
}
function gate(f, policy) {return g.evaluateEffectRestrictionGate(f.lifecycle, f.state, policy);}
function frozen(value) {
  if (value && typeof value === 'object') {assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen);}
}
function skillAdmission(f, policy = magicPolicy, options = {}) {
  const assessment = gate(f, policy);
  // Caller binds the assessment to the actual actor before composing independent conditions.
  if (assessment.entityId !== actor.id) throw new TypeError('Wrong restriction actor');
  return g.evaluateSkillActivationAdmission({skillId: 'magic'},
    {instanceId: 'skill-1', skillId: 'magic', entityId: actor.id}, actor.id, options.entities ?? entities,
    options.life ?? life, {owned: options.owned ?? true,
      eligible: (options.eligible ?? true) && assessment.status === 'allowed', rank: options.rank ?? {mode: 'not_required'}});
}
function combatAdmission(f, options = {}) {
  const assessment = gate(f, combatPolicy);
  if (assessment.entityId !== actor.id) throw new TypeError('Wrong restriction actor');
  return g.evaluateCombatActionAdmission({actionId: 'attack-1', actionType: 'melee', sourceEntityId: actor.id,
    target: {kind: 'entity', entityId: enemy.id}}, options.entities ?? entities, options.life ?? life,
    {eligible: (options.eligible ?? true) && assessment.status === 'allowed'});
}

contract('EF26/27: exact generic independent identities, explicit empty capture, detached immutable payload', assert => {
  const f = fixture();
  assert.deepEqual(f.state, {entityId: 'player-1', observedAtMs: 1000, snapshots: []});
  const empty = f.state;
  add(f, 'empty', capture(), undefined, 'empty', undefined, true);
  const input = capture(['stunned', 'silenced', 'custom-status-001', '__proto__', ' Stunned '], ['disable-all-actions']);
  add(f, 'A', input);
  assert.equal(Object.isFrozen(input), false); assert.equal(Object.isFrozen(input.statusIds), false);
  input.statusIds[0] = 'changed'; input.restrictionIds.push('changed');
  assert.deepEqual(f.state.snapshots, [
    {effectInstanceId: 'empty', statusIds: [], restrictionIds: []},
    {effectInstanceId: 'A', statusIds: ['stunned', 'silenced', 'custom-status-001', '__proto__', ' Stunned '], restrictionIds: ['disable-all-actions']},
  ]);
  add(f, 'status-only', capture(['poisoned']), undefined, 'poison');
  add(f, 'restriction-only', capture([], ['Disable-Magic', '*', 'any', 'constructor']), undefined, 'custom');
  assert.deepEqual(g.listActiveEffectStatuses(f.lifecycle, f.state).map(view => view.statusId),
    ['stunned', 'silenced', 'custom-status-001', '__proto__', ' Stunned ', 'poisoned']);
  assert.deepEqual(gate(f, {blockedByRestrictionIds: ['disable-magic', 'disable-*', 'all']}).matches, []);
  assert.deepEqual(gate(f, {blockedByRestrictionIds: ['Disable-Magic']}).matches,
    [{effectInstanceId: 'restriction-only', effectId: 'custom', restrictionId: 'Disable-Magic'}]);
  assert.deepEqual(gate(f, {blockedByRestrictionIds: []}), {entityId: 'player-1', status: 'allowed', reason: 'none', matches: []});
  assert.deepEqual(empty.snapshots, []);
  frozen(f.state); frozen(g.listActiveEffectStatuses(f.lifecycle, f.state)); frozen(g.listActiveEffectRestrictions(f.lifecycle, f.state));
  frozen(gate(f, magicPolicy));
  assert.throws(() => {f.state.snapshots[1].statusIds.push('changed');}, TypeError);
  assert.throws(() => g.createEffectStatusState(f.lifecycle), TypeError);
  console.log('EFFECT_STATUS_CAPTURE_PASS exact_ids; independent_arrays; empty_capture; deep_freeze');
});

contract('EF26/28: first appearance, ordered provenance, exact policy and surviving contributors', assert => {
  const f = fixture();
  add(f, 'A', capture(['silenced', 'poisoned'], ['disable-magic-skill', 'custom-block']));
  add(f, 'B', capture(['poisoned', 'silenced'], ['disable-magic-skill']), undefined, 'curse');
  assert.deepEqual(g.listActiveEffectStatuses(f.lifecycle, f.state), [
    {statusId: 'silenced', effectInstanceIds: ['A', 'B']}, {statusId: 'poisoned', effectInstanceIds: ['A', 'B']},
  ]);
  assert.deepEqual(g.listActiveEffectRestrictions(f.lifecycle, f.state), [
    {effectInstanceId: 'A', effectId: 'silence', restrictionId: 'disable-magic-skill'},
    {effectInstanceId: 'A', effectId: 'silence', restrictionId: 'custom-block'},
    {effectInstanceId: 'B', effectId: 'curse', restrictionId: 'disable-magic-skill'},
  ]);
  assert.deepEqual(gate(f, magicPolicy), {entityId: 'player-1', status: 'blocked', reason: 'active_restriction', matches: [
    {effectInstanceId: 'A', effectId: 'silence', restrictionId: 'disable-magic-skill'},
    {effectInstanceId: 'B', effectId: 'curse', restrictionId: 'disable-magic-skill'},
  ]});
  assert.equal(gate(f, {blockedByRestrictionIds: ['disable-physical-action']}).status, 'allowed');
  commit(f, g.removeEffectLifetime(f.lifecycle, 'A', 'explicit'));
  assert.deepEqual(g.listActiveEffectStatuses(f.lifecycle, f.state), [
    {statusId: 'poisoned', effectInstanceIds: ['B']}, {statusId: 'silenced', effectInstanceIds: ['B']},
  ]);
  assert.equal(gate(f, magicPolicy).status, 'blocked');
  assert.deepEqual(gate(f, magicPolicy).matches, [{effectInstanceId: 'B', effectId: 'curse', restrictionId: 'disable-magic-skill'}]);
  commit(f, g.removeEffectLifetime(f.lifecycle, 'B', 'dispel'));
  assert.equal(gate(f, magicPolicy).status, 'allowed');
  console.log('EFFECT_STATUS_PROVENANCE_PASS two_contributors; exact_matching; survivor_still_blocks');
});

contract('EF27/30: canonical refresh, expiry, persistent advance, exact consumption and group cleanup', assert => {
  const f = fixture();
  add(f, 'A', capture(['poisoned'], ['block']), timed(8000), 'poison');
  add(f, 'B', capture(['poisoned'], ['block']), timed(1000), 'poison');
  add(f, 'C', capture(['poisoned'], ['block']), timed(7000), 'poison');
  add(f, 'aura', capture(['shielded'], ['disable-teleport']), {mode: 'persistent'}, 'aura');
  const previous = f.state;
  commit(f, g.consumeEffectStacks(f.lifecycle, {group: group('poison'), count: 1}));
  assert.deepEqual(g.listActiveEffectStatuses(f.lifecycle, f.state), [
    {statusId: 'poisoned', effectInstanceIds: ['A', 'C']}, {statusId: 'shielded', effectInstanceIds: ['aura']},
  ]);
  assert.deepEqual(previous.snapshots.map(s => s.effectInstanceId), ['A', 'B', 'C', 'aura']);
  commit(f, g.removeEffectStackGroup(f.lifecycle, group('poison'), 'session_cleanup'));
  assert.deepEqual(f.state.snapshots, [{effectInstanceId: 'aura', statusIds: ['shielded'], restrictionIds: ['disable-teleport']}]);
  advance(f, 50000);
  assert.equal(f.state.observedAtMs, 50000); assert.equal(f.state.snapshots.length, 1);
  commit(f, g.removeEffectLifetime(f.lifecycle, 'aura', 'explicit'));
  assert.deepEqual(f.state.snapshots, []);
  const r = fixture(); add(r, 'silence', capture(['silenced'], ['disable-magic-skill']));
  advance(r, 2000); const snapshot = r.state.snapshots[0];
  const refreshed = g.refreshEffectStackLifetime(r.lifecycle, 'silence', timed(8000), r.context);
  assert.throws(() => g.applyEffectStatusTransition(r.state, r.lifecycle, refreshed, capture(['changed'], ['changed'])), TypeError);
  commit(r, refreshed);
  assert.deepEqual(r.state.snapshots[0], snapshot); assert.equal(r.lifecycle.lifetimes[0].expiresAtMs, 10000);
  commit(r, g.applyEffectStack(r.lifecycle, application(r, 'incoming'), timed(1000), {mode: 'refresh', maxStacks: 1}, r.context));
  assert.deepEqual(r.state.snapshots, [snapshot]); assert.equal(r.lifecycle.effectState.instances[0].effectInstanceId, 'silence');
  advance(r, 9999); assert.equal(gate(r, magicPolicy).status, 'blocked');
  advance(r, 10000);
  assert.deepEqual(g.listActiveEffectStatuses(r.lifecycle, r.state), []);
  assert.deepEqual(gate(r, magicPolicy), {entityId: 'player-1', status: 'allowed', reason: 'none', matches: []});
  console.log('EFFECT_STATUS_CLEANUP_PASS refresh_preserved; consumed_exactly; group_pruned; persistent; expiry_unblocks');
});

contract('EF26/28: complete closed records, dense arrays, duplicates, getter safety and lifecycle binding', assert => {
  const f = fixture(), transition = addition(f, 'A'); let getters = 0;
  const accessor = () => {getters++; return [];};
  const getterRecord = Object.defineProperty({restrictionIds: []}, 'statusIds', {get: accessor, enumerable: true});
  const getterArray = Object.defineProperty([], '0', {get: accessor, enumerable: true});
  const badCaptures = [null, undefined, [], {}, {statusIds: []}, {...capture(), extra: 1}, {...capture(), [Symbol()]: 1},
    Object.create(capture()), getterRecord, capture(new Array(1)), capture(getterArray), capture(['']), capture([' ']),
    capture([1]), capture(['stunned', 'stunned']), capture([], ['block', 'block']), capture([], ['']), capture([], null)];
  for (const value of badCaptures) {
    if (value === undefined) continue; // Omission is the explicit capture_required outcome, tested separately.
    assert.throws(() => g.applyEffectStatusTransition(f.state, f.lifecycle, transition, value), TypeError);
  }
  const input = capture(['silenced'], ['disable-magic-skill']); add(f, 'A', input);
  const clone = value => structuredClone(value);
  const badStates = [null, undefined, [], {}, {...f.state, entityId: 'enemy'}, {...f.state, observedAtMs: 1001},
    {...f.state, observedAtMs: NaN}, {...f.state, extra: 0}, {...f.state, snapshots: []},
    {...f.state, snapshots: [...f.state.snapshots, f.state.snapshots[0]]},
    {...f.state, snapshots: [{...f.state.snapshots[0], effectInstanceId: 'orphan'}]},
    {...f.state, snapshots: [{...f.state.snapshots[0], statusIds: ['a', 'a']}]},
    {...f.state, snapshots: [{...f.state.snapshots[0], effectId: 'silence'}]},
    Object.create(f.state), {...f.state, snapshots: new Array(1)},
    Object.defineProperty({...f.state}, 'entityId', {get() {getters++; return actor.id;}})];
  const badPolicies = [null, undefined, [], {}, {blockedByRestrictionIds: ['', 'x']},
    {blockedByRestrictionIds: ['x', 'x']}, {blockedByRestrictionIds: new Array(1)},
    {blockedByRestrictionIds: getterArray}, {...magicPolicy, extra: true}, Object.create(magicPolicy),
    Object.defineProperty({}, 'blockedByRestrictionIds', {get: accessor})];
  for (const state of badStates) {
    assert.throws(() => g.listActiveEffectStatuses(f.lifecycle, state), TypeError);
    assert.throws(() => g.listActiveEffectRestrictions(f.lifecycle, state), TypeError);
    assert.throws(() => g.evaluateEffectRestrictionGate(f.lifecycle, state, magicPolicy), TypeError);
    assert.throws(() => g.applyEffectStatusTransition(state, f.lifecycle, g.removeEffectLifetime(f.lifecycle, 'A', 'explicit')), TypeError);
  }
  for (const policy of badPolicies) assert.throws(() => gate(f, policy), TypeError);
  for (const value of [null, [], {...f.lifecycle, observedAtMs: -1}, {...f.lifecycle, lifetimes: []},
    {...f.lifecycle, effectState: {...f.lifecycle.effectState, entityId: 'wrong'}},
    {...f.lifecycle, lifetimes: [{...f.lifecycle.lifetimes[0], expiresAtMs: Infinity}]}]) {
    assert.throws(() => g.listActiveEffectStatuses(value, f.state), TypeError);
    assert.throws(() => g.evaluateEffectRestrictionGate(value, f.state, magicPolicy), TypeError);
  }
  const pending = {...clone(f.lifecycle), observedAtMs: 6000};
  const pendingStatus = {...clone(f.state), observedAtMs: 6000};
  assert.throws(() => g.evaluateEffectRestrictionGate(pending, pendingStatus, magicPolicy), TypeError);
  assert.throws(() => g.listActiveEffectStatuses(pending, pendingStatus), TypeError);
  add(f, 'B', capture());
  assert.throws(() => g.listActiveEffectStatuses(f.lifecycle, {...f.state, snapshots: [...f.state.snapshots].reverse()}), TypeError);
  assert.equal(getters, 0); assert.equal(gate(f, magicPolicy).status, 'blocked');
  console.log('EFFECT_STATUS_VALIDATION_PASS closed_records; duplicates; dense_arrays; getters0; wrong_entity; stale_boundary');
});

contract('EF27: canonical receipt validation, stale deltas, capture presence and atomic companion candidates', assert => {
  const f = fixture(), added = addition(f, 'A');
  assert.deepEqual(g.applyEffectStatusTransition(f.state, f.lifecycle, added),
    {status: 'rejected', reason: 'capture_required', state: null});
  const failed = g.startEffectLifetime(f.lifecycle, application(f, 'bad', 'silence', origin, {targetEligible: false}), timed(5000), f.context);
  assert.deepEqual(g.applyEffectStatusTransition(f.state, f.lifecycle, failed, capture()),
    {status: 'rejected', reason: 'transition_rejected', state: null});
  const before = f.state;
  assert.throws(() => g.applyEffectStatusTransition(f.state, f.lifecycle, {...added, events: []}, capture()), TypeError);
  for (const bad of [null, [], {...added, status: 'accepted'}, {...added, extra: 1},
    {...added, events: [{...added.events[0], targetEntityId: 'wrong'}]},
    {...added, events: [{...added.events[0], atMs: 999}]},
    {...failed, reason: 'invented'}, {...failed, events: added.events}]) {
    assert.throws(() => g.applyEffectStatusTransition(f.state, f.lifecycle, bad, capture()), TypeError);
  }
  const foreign = fixture(); foreign.lifecycle = {...foreign.lifecycle, effectState: {entityId: 'enemy', instances: []}};
  foreign.state = g.createEffectStatusState(foreign.lifecycle);
  assert.deepEqual(g.applyEffectStatusTransition(foreign.state, foreign.lifecycle, added, capture()),
    {status: 'rejected', reason: 'stale_transition', state: null});
  assert.equal(f.state, before); commit(f, added, capture(['silenced'], ['disable-magic-skill']));
  const next = addition(f, 'B');
  const altered = structuredClone(next); altered.state.effectState.instances[0].source.sourceId = 'changed';
  assert.deepEqual(g.applyEffectStatusTransition(f.state, f.lifecycle, altered, capture()),
    {status: 'rejected', reason: 'stale_transition', state: null});
  const forged = structuredClone(next); forged.state.lifetimes[0].expiresAtMs = 7000;
  assert.throws(() => g.applyEffectStatusTransition(f.state, f.lifecycle, forged, capture()), TypeError);
  commit(f, next, capture(['silenced'], ['disable-magic-skill']));
  const consume = g.consumeEffectStacks(f.lifecycle, {group: group(), count: 1});
  const wrong = structuredClone(consume); wrong.events[0].consumedInstanceIds = ['invented'];
  assert.throws(() => g.applyEffectStatusTransition(f.state, f.lifecycle, wrong), TypeError);
  const remove = g.removeEffectLifetime(f.lifecycle, 'A', 'explicit');
  assert.throws(() => g.applyEffectStatusTransition(f.state, f.lifecycle, remove, capture()), TypeError);
  assert.throws(() => g.applyEffectStatusTransition(f.state, f.lifecycle, {...remove, events: []}), TypeError);
  f.clock.time = 6000; const expiry = g.advanceEffectLifecycle(f.lifecycle, f.context);
  const wrongExpiry = structuredClone(expiry); wrongExpiry.events[0].atMs = 5999;
  assert.throws(() => g.applyEffectStatusTransition(f.state, f.lifecycle, wrongExpiry), TypeError);
  assert.equal(f.state.snapshots.length, 2);
  const modifier = g.createEffectModifierState(fixture().lifecycle);
  const statusCandidate = g.applyEffectStatusTransition(before, fixture().lifecycle, added, capture(['silenced']));
  assert.equal(statusCandidate.status, 'applied');
  const modifierCandidate = g.applyEffectModifierTransition(modifier, added);
  assert.equal(modifierCandidate.reason, 'capture_required');
  // L4 refuses the joint commit. The authoritative lifecycle and both companions remain empty.
  assert.deepEqual(before.snapshots, []); assert.deepEqual(modifier.lifecycle.effectState.instances, []);
  console.log('EFFECT_STATUS_TRANSITION_PASS canonical_deltas; stale_rejected; forged_receipts; no_partial_commit');
});

contract('EF28/30: caller Stun/Silence composition reaches actual Skill and Combat admission', assert => {
  const f = fixture();
  assert.equal(skillAdmission(f).status, 'admitted'); assert.equal(combatAdmission(f).status, 'admitted');
  add(f, 'silence', capture(['silenced'], ['disable-magic-skill']));
  assert.equal(skillAdmission(f).reason, 'actor_ineligible');
  assert.equal(skillAdmission(f, {blockedByRestrictionIds: ['disable-all-actions', 'disable-physical-action']}).status, 'admitted');
  assert.equal(combatAdmission(f).status, 'admitted');
  add(f, 'stun', capture(['stunned'], ['disable-all-actions']), undefined, 'stun');
  assert.equal(combatAdmission(f).reason, 'source_ineligible'); assert.equal(skillAdmission(f).reason, 'actor_ineligible');
  assert.deepEqual(gate(f, magicPolicy).matches.map(v => v.effectInstanceId), ['silence', 'stun']);
  commit(f, g.removeEffectLifetime(f.lifecycle, 'stun', 'explicit'));
  assert.equal(combatAdmission(f).status, 'admitted'); assert.equal(skillAdmission(f).reason, 'actor_ineligible');
  advance(f, 6000);
  assert.equal(skillAdmission(f).status, 'admitted');
  assert.equal(skillAdmission(f, magicPolicy, {owned: false}).reason, 'skill_not_owned');
  assert.equal(skillAdmission(f, magicPolicy, {rank: {mode: 'required', currentRank: null, minimumRank: 1}}).reason, 'skill_rank_unregistered');
  assert.equal(skillAdmission(f, magicPolicy, {rank: {mode: 'required', currentRank: 1, minimumRank: 2}}).reason, 'skill_rank_too_low');
  assert.equal(skillAdmission(f, magicPolicy, {eligible: false}).reason, 'actor_ineligible');
  assert.equal(skillAdmission(f, magicPolicy, {life: {...life, status: 'dead'}}).reason, 'actor_dead');
  assert.equal(skillAdmission(f, magicPolicy, {entities: g.createEntityCollection()}).reason, 'actor_not_found');
  assert.equal(combatAdmission(f, {eligible: false}).reason, 'source_ineligible');
  assert.equal(combatAdmission(f, {life: {...life, status: 'dead'}}).reason, 'source_dead');
  assert.equal(combatAdmission(f, {entities: g.createEntityCollection()}).reason, 'source_not_found');
  const action = combatAdmission(f);
  assert.equal(g.evaluateCombatTargetValidation(action, entities, {entityId: enemy.id, status: 'alive'},
    {relation: 'enemy', allowedRelations: ['ally'], allowedLifeStatuses: ['alive']}).reason, 'relation_not_allowed');
  const wrong = fixture(); wrong.lifecycle = {...wrong.lifecycle, effectState: {entityId: 'enemy', instances: []}};
  wrong.state = g.createEffectStatusState(wrong.lifecycle);
  assert.throws(() => skillAdmission(wrong), TypeError); assert.throws(() => combatAdmission(wrong), TypeError);
  console.log('EFFECT_STATUS_ADMISSION_PASS actual_Skill_Combat; stun; silence; ownership_rank_life_preserved; actor_binding');
});

contract('EF29: exact immunity policy composes existing EF08, preserving every independent gate', assert => {
  const f = fixture(); add(f, 'immunity', capture(['poison-immune'], ['immune-poison']), {mode: 'persistent'}, 'immunity');
  function admit(effectId, overrides = {}) {
    const assessment = gate(f, {blockedByRestrictionIds: [effectId === 'poison' ? 'immune-poison' : 'immune-burning']});
    if (assessment.entityId !== actor.id) throw new TypeError('Wrong restriction target');
    return g.evaluateEffectApplyAdmission({effectId}, request(f, overrides.id ?? 'incoming', effectId, overrides.source ?? origin),
      f.lifecycle.effectState, overrides.entities ?? entities, overrides.life ?? life,
      {sourceEligible: overrides.sourceEligible ?? true,
        targetEligible: (overrides.targetEligible ?? true) && assessment.status === 'allowed', allowedTargetLifeStatuses: ['alive']});
  }
  assert.equal(admit('poison').reason, 'target_ineligible');
  assert.equal(admit('burning').status, 'admitted');
  assert.deepEqual(gate(f, {blockedByRestrictionIds: ['immune-poison']}).matches,
    [{effectInstanceId: 'immunity', effectId: 'immunity', restrictionId: 'immune-poison'}]);
  assert.equal(admit('burning', {sourceEligible: false}).reason, 'source_ineligible');
  assert.equal(admit('burning', {targetEligible: false}).reason, 'target_ineligible');
  assert.equal(admit('burning', {life: {...life, status: 'dead'}}).reason, 'target_life_not_allowed');
  assert.equal(admit('burning', {entities: g.createEntityCollection()}).reason, 'target_not_found');
  assert.equal(admit('burning', {source: {kind: 'entity', sourceId: 'missing', sourceKey: 'skill'}}).reason, 'source_not_found');
  add(f, 'existing-burning', capture(), undefined, 'burning');
  assert.equal(admit('burning', {id: 'existing-burning'}).reason, 'instance_already_present');
  add(f, 'burning-immunity', capture([], ['immune-burning']), {mode: 'persistent'}, 'ward');
  assert.equal(admit('burning').reason, 'target_ineligible');
  commit(f, g.removeEffectLifetime(f.lifecycle, 'immunity', 'explicit'));
  assert.equal(admit('poison').status, 'admitted');
  console.log('EFFECT_STATUS_IMMUNITY_PASS actual_EF08; poison_blocked; burning_independent; six_gates_preserved');
});

contract('EF30: independent literal replay, shared modifier lifecycle, source independence and no side effects', assert => {
  function replay() {
    const f = fixture(); let modifier = g.createEffectModifierState(f.lifecycle);
    const base = g.createEntityAttributeState(actor, {}), history = [], trace = [];
    const resources = g.createEntityResourceState(actor, {hp: {minimum: 0, maximum: 100, current: 100}, mana: {minimum: 0, maximum: 50, current: 50}});
    const rank = g.createSkillRankState(actor, {magic: 2});
    const cooldown = g.createSkillCooldownState({instanceId: 'skill-1', skillId: 'magic', entityId: actor.id});
    const unchanged = structuredClone({base, resources, rank, cooldown, entities});
    function joint(transition, payload) {
      const m = g.applyEffectModifierTransition(modifier, transition,
        payload === undefined ? undefined : {classification: 'neutral', modifiers: [
          {modifierId: 'bonus', target: 'attack', operation: 'add_flat', value: 1, enabled: true}]} );
      const s = g.applyEffectStatusTransition(f.state, f.lifecycle, transition, payload);
      assert.equal(m.status, 'applied'); assert.equal(s.status, 'applied');
      modifier = m.state; f.state = s.state; f.lifecycle = transition.state;
      assert.deepEqual(modifier.lifecycle, f.lifecycle); history.push(f.state);
    }
    const time = globalThis.Date.now, rng = Math.random, timer = globalThis.setTimeout;
    const forbidden = () => {throw new Error('Implicit provider forbidden');};
    try {
      globalThis.Date.now = forbidden; Math.random = forbidden; globalThis.setTimeout = forbidden;
      joint(addition(f, 'A', timed(8000), 'stun', {kind: 'entity', sourceId: enemy.id, sourceKey: 'skill-1'}),
        capture(['stunned'], ['disable-all-actions']));
      joint(addition(f, 'B'), capture(['silenced'], ['disable-magic-skill']));
      joint(addition(f, 'C', {mode: 'persistent'}, 'immunity', {kind: 'system', sourceId: 'equipment', sourceKey: 'item-1'}),
        capture(['poison-immune'], ['immune-poison']));
      const sample = () => trace.push([combatAdmission(f).reason, skillAdmission(f).reason,
        gate(f, {blockedByRestrictionIds: ['immune-poison']}).status]);
      sample();
      f.clock.time = 2000; joint(g.advanceEffectLifecycle(f.lifecycle, f.context));
      joint(g.refreshEffectStackLifetime(f.lifecycle, 'B', timed(5000), f.context));
      joint(g.consumeEffectStacks(f.lifecycle, {group: group('stun', 'skill-1'), count: 1})); sample();
      f.clock.time = 7000; joint(g.advanceEffectLifecycle(f.lifecycle, f.context)); sample();
      joint(g.removeEffectLifetime(f.lifecycle, 'C', 'source_removed')); sample();
      const stats = g.calculateEntityStats(base, {attributeOrder: [], statOrder: ['attack'], attributeRules: {}, attributeBaselines: {},
        baseStats: {attack: 100}, rules: {attack: {default: 0, bounds: {}, enabled: true, precision: {decimalPlaces: 8}, scaling: [], training: 0}},
        flatContributions: {}, modifiers: g.listActiveEffectModifiers(modifier)});
      assert.equal(stats.stats.attack, 100);
      assert.deepEqual({base, resources, rank, cooldown, entities}, unchanged);
      assert.deepEqual(g.listActiveEffectStatuses(f.lifecycle, f.state), []);
      assert.deepEqual(g.listActiveEffectRestrictions(f.lifecycle, f.state), []);
    } finally {globalThis.Date.now = time; Math.random = rng; globalThis.setTimeout = timer;}
    return {trace, history, modifier};
  }
  const left = replay(), right = replay();
  const expected = [['source_ineligible', 'actor_ineligible', 'blocked'], ['none', 'actor_ineligible', 'blocked'],
    ['none', 'none', 'blocked'], ['none', 'none', 'allowed']];
  assert.deepEqual(left.trace, expected); assert.deepEqual(right.trace, expected);
  assert.deepEqual(left, right); assert.notEqual(left.history[0].snapshots[0], right.history[0].snapshots[0]);
  assert.deepEqual(left.history[0].snapshots, [{effectInstanceId: 'A', statusIds: ['stunned'], restrictionIds: ['disable-all-actions']}]);
  const f = fixture();
  for (const [id, source] of [
    ['skill', {kind: 'entity', sourceId: enemy.id, sourceKey: 'skill-1'}],
    ['equipment', {kind: 'system', sourceId: 'equipment', sourceKey: 'item-1'}],
    ['environment', origin], ['system', {kind: 'system', sourceId: 'system', sourceKey: 'system-1'}],
  ]) add(f, id, capture(['custom'], ['custom-block']), {mode: 'persistent'}, id, source);
  advance(f, 50000);
  assert.deepEqual(g.listActiveEffectStatuses(f.lifecycle, f.state), [{statusId: 'custom', effectInstanceIds: ['skill', 'equipment', 'environment', 'system']}]);
  const sourceResources = g.createEntityResourceState(enemy, {hp: {minimum: 0, maximum: 100, current: 0}});
  const deadSource = g.resolveEntityDefeat(g.createEntityLifeState(enemy, {status: 'alive'}), sourceResources,
    {resourceId: 'hp', minimum: 0, maximum: 100});
  assert.equal(deadSource.state.status, 'dead');
  assert.equal(gate(f, {blockedByRestrictionIds: ['custom-block']}).matches.length, 4);
  console.log('EFFECT_STATUS_REPLAY_PASS independent_sessions2; literal_trace; coordinated_modifiers; sources; no_side_effects');
});
