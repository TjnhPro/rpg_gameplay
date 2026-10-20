import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as g from '@rpg/gameplay';

// L3 fixtures and explicit L4 local snapshots only; no production coordinator.
const assignment = {eligible: true, allowDuplicateInstance: false};
const expectedTimeline = [
  ['activation', 1000, 'accepted', 75, 1000, 1750, 'attempt-001'],
  ['combat', 'action-001', 'landed', 100, 150, .5, 75, 25, 'completed'],
  ['activation', 1250, 'cooldown_active', 75, 1000, 1750, null],
  ['activation', 1750, 'accepted', 50, 1750, 2500, 'attempt-003'],
  ['combat', 'action-003', 'dodged', null, null, null, 0, 25, 'completed'],
  ['activation', 2000, 'cooldown_active', 50, 1750, 2500, null],
  ['ready', 2500, 'ready', 0, 2500],
];
function frozen(value) {
  if (value && typeof value === 'object') {
    assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen);
  }
}
const rejected = reason => ({status: 'rejected', reason, request: null, resources: null, cooldown: null});
function fixture({ranked = true, multi = false} = {}) {
  const actor = g.createEntity({id: 'player-1', kind: 'player'});
  const target = g.createEntity({id: 'monster-1', kind: 'monster'});
  const entities = [actor, target].reduce(g.addEntity, g.createEntityCollection());
  const life = g.createEntityLifeState(actor, {status: 'alive'});
  const targetLife = g.createEntityLifeState(target, {status: 'alive'});
  const definition = g.createSkillDefinition({skillId: ranked ? 'fireball' : 'caller-skill'});
  const calls = {clock: [], random: [], ids: []};
  const clock = {time: 1000, now() {calls.clock.push(this.time); return this.time;}};
  const random = {values: [.2, .2], next() {
    assert.ok(this.values.length, 'unexpected random read'); const value = this.values.shift(); calls.random.push(value); return value;
  }};
  const context = g.createExecutionContext({clock, random, ids: {next() {
    assert.equal(calls.ids.length, 0, 'unexpected ID read'); calls.ids.push('instance-001'); return 'instance-001';
  }}});
  const instance = g.createSkillInstance(definition, actor, {instanceId: g.nextExecutionId(context)});
  const ranks = ranked ? g.createSkillRankState(actor, {fireball: 3}) : null;
  const policy = {owned: true, eligible: true, rank: ranked
    ? {mode: 'required', currentRank: g.getSkillRank(ranks, 'fireball') ?? null, minimumRank: 2}
    : {mode: 'not_required'}};
  const admission = g.evaluateSkillActivationAdmission(definition, instance, actor.id, entities, life, policy);
  const resourceState = g.createEntityResourceState(actor, multi
    ? {mana: {minimum: 0, maximum: 100, current: 80}, stamina: {minimum: 0, maximum: 100, current: 40}}
    : {mana: {minimum: 0, maximum: 100, current: 100}});
  const resourceCosts = {costs: multi ? [{resourceId: 'mana', amount: 30}, {resourceId: 'stamina', amount: 20}]
    : [{resourceId: 'mana', amount: 25}], bounds: (multi ? ['mana', 'stamina'] : ['mana'])
    .map(resourceId => ({resourceId, minimum: 0, maximum: 100, currentAboveMaximum: 'reject'}))};
  const dispatch = ranked ? {kind: 'combat', actionId: 'action-001', actionType: 'spell_attack', targetEntityId: target.id} : {kind: 'caller'};
  const input = {instance, admission, resourceState, resourceCosts, cooldownState: g.createSkillCooldownState(instance),
    cooldownConfig: {baseDurationMs: 1000, effectiveCdr: .25}, executionContext: context,
    intent: {attemptId: 'attempt-001', dispatch}, executionPreflight: {kind: dispatch.kind, status: 'accepted'}};
  const loadout = g.createSkillLoadoutState(actor, {loadoutId: 'primary', slotIds: ['slot-1', 'slot-2']});
  const assigned = g.assignSkillLoadoutSlot(loadout, 'slot-1', instance, assignment);
  assert.equal(assigned.status, 'applied');
  function preflight(actorEntityId, handoff, relation = 'enemy') {
    const action = g.createCombatActionContext({actionId: handoff.actionId, actionType: handoff.actionType,
      sourceEntityId: actorEntityId, target: {kind: 'entity', entityId: handoff.targetEntityId}});
    const admission = g.evaluateCombatActionAdmission(action, entities, life, {eligible: true});
    const validation = g.evaluateCombatTargetValidation(admission, entities, targetLife,
      {relation, allowedRelations: ['enemy'], allowedLifeStatuses: ['alive']});
    return {admission, validation};
  }
  return {actor, target, entities, life, targetLife, definition, instance, ranks, policy, calls, clock, context,
    input, loadout, assigned: assigned.state, preflight};
}
function numerical(dodged) {
  return {hit: {dodgeChance: dodged ? .5 : 0, eligible: true, rule: {enabled: true, bounds: {min: 0, max: 1}}},
    critical: {chance: .5, bonus: .5, eligible: true, rule: {enabled: true, bounds: {min: 0, max: 1}}},
    damage: {base: 100, rank: 3, perRank: 0, scaling: [], flat: {definition: 0, additional: 0, resolved: 0}, bonuses: []},
    mitigation: {ruleKey: 'armor', rating: 100, rule: {enabled: true, bounds: {min: 0, max: 1},
      baseK: 100, levelPenalty: 0, levelScalingEnabled: false}}};
}
function rankedSession() {
  const f = fixture(), trace = [], history = [];
  assert.equal(g.readExecutionTime(f.context), 1000);
  assert.deepEqual(f.input.admission, {instanceId: 'instance-001', skillId: 'fireball', actorEntityId: 'player-1', status: 'admitted', reason: 'none'});
  const duplicates = g.assignSkillLoadoutSlot(f.assigned, 'slot-2', f.instance, {...assignment, allowDuplicateInstance: true});
  assert.equal(duplicates.status, 'applied');
  const catalog = new Map([[f.instance.instanceId, f.instance]]); // Test-local caller reference resolution, never L2 state.
  let resources = f.input.resourceState, cooldown = f.input.cooldownState;
  let targetResources = g.createEntityResourceState(f.target, {health: {minimum: 0, maximum: 100, current: 100}});
  for (const [index, time] of [1000, 1250, 1750, 2000].entries()) {
    f.clock.time = time;
    const slot = duplicates.state.slots[index === 1 ? 1 : 0];
    const instance = catalog.get(slot.instanceId);
    assert.strictEqual(instance, f.instance); // Both slots resolve the same instance/cooldown authority.
    const intent = {attemptId: `attempt-00${index + 1}`, dispatch: {...f.input.intent.dispatch, actionId: `action-00${index + 1}`}};
    const checked = f.preflight(instance.entityId, intent.dispatch);
    assert.equal(checked.admission.status, 'admitted'); assert.equal(checked.validation.status, 'accepted');
    const input = {...f.input, instance, resourceState: resources, cooldownState: cooldown, intent,
      executionPreflight: {kind: 'combat', status: checked.validation.status}};
    const result = g.activateSkill(input);
    frozen(result);
    if (index === 1 || index === 3) assert.deepEqual(result, rejected('cooldown_active'));
    else {
      assert.equal(result.status, 'accepted');
      assert.deepEqual(result.request, {attemptId: intent.attemptId, instanceId: 'instance-001', skillId: 'fireball',
        actorEntityId: 'player-1', dispatch: intent.dispatch});
      assert.notEqual(result.resources, resources); assert.notEqual(result.resources.current, resources.current);
      // L4 rechecks the current local authoritative snapshots, then commits both together.
      assert.strictEqual(input.resourceState, resources); assert.strictEqual(input.cooldownState, cooldown);
      resources = result.resources; cooldown = result.cooldown;
      history.push(result);
    }
    trace.push(['activation', time, result.status === 'accepted' ? 'accepted' : result.reason,
      resources.current.mana, cooldown.startedAtMs, cooldown.readyAtMs, result.request?.attemptId ?? null]);
    if (result.status === 'accepted') {
      const handoff = f.preflight(result.request.actorEntityId, result.request.dispatch);
      const attack = g.resolveCombatAttack(handoff.admission, handoff.validation, numerical(index === 2), f.context);
      const application = g.applyCombatAttackDamage(attack, targetResources, f.targetLife,
        {resourceId: 'health', minimum: 0, maximum: 100, currentAboveMaximum: 'allow'});
      frozen(attack); frozen(application);
      if (index === 2) {assert.equal(application.resourceResult, null); assert.equal(application.lifeResult, null);}
      else {
        assert.equal(application.appliedDamage, 75); assert.equal(application.lifeResult.state.status, 'alive');
        targetResources = application.resourceResult.state;
      }
      const outcome = g.reportSkillExecutionOutcome(result.request, {status: 'completed'});
      frozen(outcome);
      assert.deepEqual(outcome, {attemptId: intent.attemptId, instanceId: 'instance-001', skillId: 'fireball',
        actorEntityId: 'player-1', dispatchKind: 'combat', status: 'completed'});
      trace.push(['combat', intent.dispatch.actionId, attack.outcome, attack.b0?.raw ?? null,
        attack.b1?.beforeDefense ?? null, attack.mitigation?.reduction ?? null, attack.finalDamage,
        targetResources.current.health, outcome.status]);
    }
  }
  f.clock.time = 2500;
  const ready = g.evaluateSkillCooldownReady(f.instance, cooldown, f.context);
  trace.push(['ready', 2500, ready.status, ready.remainingMs, ready.readyAtMs]);
  assert.deepEqual(trace, expectedTimeline); // Both sessions independently use this task-derived literal oracle.
  assert.deepEqual(f.calls, {clock: [1000, 1000, 1250, 1750, 2000, 2500], random: [.2, .2], ids: ['instance-001']});
  assert.deepEqual(f.ranks, {entityId: 'player-1', ranks: {fireball: 3}});
  assert.equal(f.input.resourceState.current.mana, 100); assert.equal(f.input.cooldownState.readyAtMs, null);
  assert.equal(history[0].resources.current.mana, 75); assert.equal(history[0].cooldown.readyAtMs, 1750);
  assert.notEqual(history[0].resources.current, history[1].resources.current);
  frozen(f.instance); frozen(duplicates.state); history.forEach(frozen);
  return {trace, history, loadout: duplicates.state, instance: f.instance};
}

test('SK31/SK32 P1: ranked loadout through canonical Combat with independent literal replay', () => {
  const oldTime = Date.now, oldRandom = Math.random;
  Date.now = Math.random = () => {throw Error('implicit provider');};
  try {
    const a = rankedSession(), b = rankedSession();
    assert.deepEqual(a, b); assert.notEqual(a.instance, b.instance); assert.notEqual(a.loadout.slots, b.loadout.slots);
    assert.notEqual(a.history[0].resources.current, b.history[0].resources.current);
    console.log('SKILL_INTEGRATION_TRACE_PASS ' + JSON.stringify(a.trace));
  } finally {Date.now = oldTime; Math.random = oldRandom;}
});

test('SK31 P2/P3: rankless paid/free caller dispatch, multi-resource reject/recover, failed execution after commit', () => {
  const {modules} = JSON.parse(readFileSync(new URL('./skill-modules.json', import.meta.url), 'utf8'));
  const registry = modules.reduce(g.registerModule, g.createModuleRegistry());
  assert.deepEqual(g.composeModules(registry, g.configureModules(registry,
    {enable: ['entity', 'skill'], disable: ['progression', 'combat']})).moduleIds, ['entity', 'skill']);
  const f = fixture({ranked: false, multi: true});
  assert.equal(f.ranks, null); assert.equal(f.input.admission.reason, 'none');
  const resolved = new Map([[f.instance.instanceId, f.instance]]).get(f.assigned.slots[0].instanceId);
  assert.strictEqual(resolved, f.instance);
  const insufficient = g.transitionEntityResource(f.input.resourceState, 'stamina', {operation: 'decrease', amount: 30,
    maximum: 100, rule: {minimum: 0, currentAboveMaximum: 'reject', allowIncreaseFromMinimum: false}}).state;
  const failedInput = {...f.input, resourceState: insufficient};
  assert.deepEqual(g.activateSkill(failedInput), rejected('resource_cost_rejected'));
  assert.deepEqual(insufficient.current, {mana: 80, stamina: 10}); assert.deepEqual(f.calls.clock, []);
  const recovered = g.transitionEntityResource(insufficient, 'stamina', {operation: 'increase', amount: 30,
    maximum: 100, rule: {minimum: 0, currentAboveMaximum: 'reject', allowIncreaseFromMinimum: true}}).state;
  const paid = g.activateSkill({...f.input, resourceState: recovered});
  assert.equal(paid.status, 'accepted'); assert.deepEqual(paid.resources.current, {mana: 50, stamina: 20});
  assert.deepEqual(paid.cooldown, {instanceId: 'instance-001', skillId: 'caller-skill', entityId: 'player-1', startedAtMs: 1000, readyAtMs: 1750});
  const committed = {resources: paid.resources, cooldown: paid.cooldown};
  let dispatches = 0;
  const executor = () => {dispatches++; throw new Error('external caller executor failed');};
  let outcome;
  try {executor(paid.request);} catch (error) {
    assert.equal(error.message, 'external caller executor failed');
    outcome = g.reportSkillExecutionOutcome(paid.request, {status: 'failed'});
  }
  assert.equal(dispatches, 1); assert.equal(outcome.status, 'failed'); assert.equal(outcome.dispatchKind, 'caller');
  assert.deepEqual(committed.resources.current, {mana: 50, stamina: 20}); assert.equal(committed.cooldown.readyAtMs, 1750);
  const free = g.activateSkill({...f.input, resourceState: committed.resources, cooldownState: g.createSkillCooldownState(f.instance),
    resourceCosts: {costs: [], bounds: []}, cooldownConfig: {baseDurationMs: 0, effectiveCdr: 0},
    intent: {attemptId: 'free-001', dispatch: {kind: 'caller'}}});
  assert.equal(free.status, 'accepted'); assert.deepEqual(free.resources.current, {mana: 50, stamina: 20});
  assert.equal(free.cooldown.readyAtMs, 1000); assert.equal(g.reportSkillExecutionOutcome(free.request, {status: 'completed'}).status, 'completed');
  assert.deepEqual(f.calls, {clock: [1000, 1000], random: [], ids: ['instance-001']});
  [paid, outcome, free].forEach(frozen);
  console.log('SKILL_INTEGRATION_CALLER_PASS P2/P3; insufficient80_10; recover80_40; paid50_20; failed_no_refund; free_completed');
});

test('SK31/SK32: equipped references confer no admission; actual rejected gates preserve caller authority', () => {
  const f = fixture();
  const reasons = [];
  for (const [life, policy, expected] of [
    [g.createEntityLifeState(f.actor, {status: 'dead'}), {...f.policy, owned: false}, 'actor_dead'],
    [f.life, {...f.policy, owned: false}, 'skill_not_owned'],
    [f.life, {...f.policy, rank: {...f.policy.rank, currentRank: g.getSkillRank(g.createSkillRankState(f.actor, {fireball: 1}), 'fireball')}}, 'skill_rank_too_low'],
  ]) {
    const admission = g.evaluateSkillActivationAdmission(f.definition, f.instance, f.actor.id, f.entities, life, policy);
    assert.equal(admission.reason, expected); reasons.push(expected);
    assert.deepEqual(g.activateSkill({...f.input, admission, executionPreflight: {kind: 'combat', status: 'rejected'},
      resourceState: {...f.input.resourceState, current: {mana: 0}}}), rejected('skill_admission_rejected'));
  }
  const checked = f.preflight(f.actor.id, f.input.intent.dispatch, 'ally');
  assert.equal(checked.validation.reason, 'relation_not_allowed');
  assert.deepEqual(g.activateSkill({...f.input, executionPreflight: {kind: 'combat', status: checked.validation.status},
    resourceState: {...f.input.resourceState, current: {mana: 0}}}), rejected('execution_preflight_rejected'));
  const active = {...f.input.cooldownState, startedAtMs: 1000, readyAtMs: 1750};
  f.clock.time = 1250;
  assert.deepEqual(g.activateSkill({...f.input, cooldownState: active, resourceState: {...f.input.resourceState, current: {mana: 0}}}), rejected('resource_cost_rejected'));
  assert.deepEqual(g.activateSkill({...f.input, cooldownState: active}), rejected('cooldown_active'));
  const occupied = g.assignSkillLoadoutSlot(f.assigned, 'slot-1', f.instance, assignment);
  const duplicate = g.assignSkillLoadoutSlot(f.assigned, 'slot-2', f.instance, assignment);
  assert.equal(occupied.reason, 'slot_occupied'); assert.equal(duplicate.reason, 'instance_already_assigned');
  assert.equal(occupied.state, null); assert.equal(duplicate.state, null);
  assert.deepEqual(f.calls, {clock: [1250], random: [], ids: ['instance-001']});
  assert.deepEqual(g.validateSkillLoadoutState(f.assigned), {entityId: 'player-1', loadoutId: 'primary',
    slots: [{slotId: 'slot-1', instanceId: 'instance-001'}, {slotId: 'slot-2', instanceId: null}]});
  assert.equal(f.input.resourceState.current.mana, 100); assert.equal(f.input.cooldownState.readyAtMs, null);
  console.log('SKILL_INTEGRATION_REJECTIONS_PASS ' + reasons.join('/') + '; canonical_preflight; gate_priority; null_candidates; no_commit');
});

test('SK31: replace/remove references preserve independent canonical instance/rank/resource/cooldown snapshots', () => {
  const f = fixture(), accepted = g.activateSkill(f.input);
  assert.equal(accepted.status, 'accepted');
  const second = g.createSkillInstance(g.createSkillDefinition({skillId: 'other-skill'}), f.actor, {instanceId: 'instance-002'});
  const secondCooldown = g.createSkillCooldownState(second);
  const before = structuredClone({instance: f.instance, ranks: f.ranks, resources: accepted.resources, cooldown: accepted.cooldown, second, secondCooldown});
  const replaced = g.replaceSkillLoadoutSlot(f.assigned, 'slot-1', second, assignment);
  assert.equal(replaced.status, 'applied'); assert.equal(replaced.state.slots[0].instanceId, 'instance-002');
  const removed = g.removeSkillLoadoutSlot(replaced.state, 'slot-1', {eligible: true});
  assert.equal(removed.status, 'applied'); assert.equal(removed.state.slots[0].instanceId, null);
  assert.deepEqual({instance: f.instance, ranks: f.ranks, resources: accepted.resources, cooldown: accepted.cooldown, second, secondCooldown}, before);
  assert.equal(f.assigned.slots[0].instanceId, 'instance-001'); assert.deepEqual(f.calls.clock, [1000]);
  [f.assigned, replaced, removed, secondCooldown].forEach(frozen);
  console.log('SKILL_INTEGRATION_LOADOUT_PASS assign_replace_remove; references_only; rank_resource_cooldown_instances_preserved');
});

test('SK31/SK34: representative malformed cross-owner data throws before providers with no getter execution', () => {
  const f = fixture(); let getters = 0;
  const bad = [
    {...f.input, extra: true}, {...f.input, [Symbol('extra')]: true}, Object.create(f.input),
    {...f.input, instance: {...f.instance, instanceId: ''}},
    {...f.input, admission: {...f.input.admission, actorEntityId: 'other'}},
    {...f.input, cooldownState: {...f.input.cooldownState, instanceId: 'other'}},
    {...f.input, cooldownState: {...f.input.cooldownState, startedAtMs: 1000, readyAtMs: 999}},
    {...f.input, resourceState: {entityId: 'other', current: {mana: 100}}},
    {...f.input, resourceState: {entityId: 'player-1', current: {mana: NaN}}},
    {...f.input, cooldownConfig: {baseDurationMs: Infinity, effectiveCdr: .25}},
    {...f.input, intent: {attemptId: '', dispatch: {kind: 'caller'}}},
    {...f.input, resourceCosts: {get costs() {getters++; throw Error('getter');}, bounds: f.input.resourceCosts.bounds}},
  ];
  for (const input of bad) assert.throws(() => g.activateSkill(input), TypeError);
  for (const slots of [[{slotId: 'slot-1', instanceId: 'instance-001', extra: true}], [,],
    [{get slotId() {getters++; throw Error('getter');}, instanceId: null}]]) {
    assert.throws(() => g.validateSkillLoadoutState({...f.assigned, slots}), TypeError);
  }
  const checked = f.preflight(f.actor.id, f.input.intent.dispatch);
  assert.throws(() => g.resolveCombatAttack(checked.admission,
    {...checked.validation, context: {...checked.validation.context, sourceEntityId: 'other'}}, numerical(false), f.context), TypeError);
  const invalidClock = g.createExecutionContext({clock: {now: () => NaN}});
  assert.throws(() => g.activateSkill({...f.input, executionContext: invalidClock}), TypeError);
  assert.equal(getters, 0); assert.deepEqual(f.calls, {clock: [], random: [], ids: ['instance-001']});
  assert.equal(f.input.resourceState.current.mana, 100); assert.equal(f.input.cooldownState.readyAtMs, null);
  console.log('SKILL_INTEGRATION_VALIDATION_PASS cross_owner_identity; malformed_closed_nested; TypeError; getters0; no_partial_commit');
});
