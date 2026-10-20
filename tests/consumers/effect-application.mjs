import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as g from '@rpg/gameplay';

const literal = {effectInstanceId: 'effect-instance-001', effectId: 'poison',
  source: {kind: 'entity', sourceId: 'player-1', sourceKey: 'player-1/skill-instance-001'}, targetEntityId: 'monster-1'};
function fixture() {
  return {definition: {effectId: 'poison'}, request: {instance: structuredClone(literal)},
    state: {entityId: 'monster-1', instances: []},
    entities: {entities: [{id: 'player-1', kind: 'player'}, {id: 'monster-1', kind: 'monster'}]},
    targetLife: {entityId: 'monster-1', status: 'alive'},
    policy: {sourceEligible: true, targetEligible: true, allowedTargetLifeStatuses: ['alive']}};
}
const call = (fn, f) => fn(f.definition, f.request, f.state, f.entities, f.targetLife, f.policy);
const admission = (instance = literal, reason = 'none') => ({request: {instance}, status: reason === 'none' ? 'admitted' : 'rejected', reason});
function frozen(value) {
  if (value && typeof value === 'object') {assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen);}
}
function mutable(value) {
  if (value && typeof value === 'object') {assert.equal(Object.isFrozen(value), false); Object.values(value).forEach(mutable);}
}

test('EF06–EF08: Entity/System sources, exact identities and explicit alive/dead eligibility', () => {
  const f = fixture();
  assert.deepEqual(call(g.evaluateEffectApplyAdmission, f), admission());
  for (const status of ['alive', 'dead']) {
    f.targetLife.status = status; f.policy.allowedTargetLifeStatuses = [status];
    assert.deepEqual(call(g.evaluateEffectApplyAdmission, f), admission());
    const outcome = call(g.applyEffect, f);
    assert.deepEqual(outcome, {status: 'applied', reason: 'none', admission: admission(),
      state: {entityId: 'monster-1', instances: [literal]}});
    assert.equal(f.targetLife.status, status); frozen(outcome);
  }
  f.policy.allowedTargetLifeStatuses = ['dead', 'alive'];
  f.request.instance.source = {kind: 'system', sourceId: 'swamp-zone', sourceKey: 'swamp-zone/poison-area-001'};
  f.entities.entities = [{id: 'monster-1', kind: 'monster'}]; // No system Entity or Entity source required.
  assert.deepEqual(call(g.evaluateEffectApplyAdmission, f), admission({...literal, source: {
    kind: 'system', sourceId: 'swamp-zone', sourceKey: 'swamp-zone/poison-area-001'}}));
  f.policy.sourceEligible = false;
  assert.equal(call(g.applyEffect, f).reason, 'source_ineligible');
  const exact = fixture();
  exact.definition.effectId = exact.request.instance.effectId = ' Poison ';
  exact.state.entityId = exact.targetLife.entityId = exact.request.instance.targetEntityId = '__proto__';
  exact.entities.entities[1].id = '__proto__'; exact.request.instance.effectInstanceId = 'constructor';
  exact.request.instance.source.sourceKey = ' equipment/ armor-1 ';
  assert.deepEqual(call(g.applyEffect, exact).state, {entityId: '__proto__', instances: [{
    effectInstanceId: 'constructor', effectId: ' Poison ', targetEntityId: '__proto__',
    source: {kind: 'entity', sourceId: 'player-1', sourceKey: ' equipment/ armor-1 '}}]});
  assert.equal(Object.prototype.polluted, undefined);
  console.log('EFFECT_APPLY_SOURCES_PASS S01-S02/S05-S09; exact_ids; explicit_dead_allowed; no_fake_system_entity');
});

test('EF08/EF10: fixed rejection priority, exact outcomes and null candidates without mutation', () => {
  for (const [stage, reason] of ['source_not_found', 'target_not_found', 'target_life_not_allowed',
    'source_ineligible', 'target_ineligible', 'instance_already_present', 'none'].entries()) {
    const f = fixture(); f.state.instances = [structuredClone(literal)];
    f.entities.entities = stage === 0 ? [] : stage === 1 ? [f.entities.entities[0]] : f.entities.entities;
    f.targetLife.status = stage <= 2 ? 'dead' : 'alive';
    f.policy.sourceEligible = stage > 3; f.policy.targetEligible = stage > 4;
    if (stage === 6) f.state.instances = [];
    // Enumeration order is irrelevant to assessment priority.
    f.policy = {allowedTargetLifeStatuses: ['alive'], targetEligible: f.policy.targetEligible, sourceEligible: f.policy.sourceEligible};
    const before = structuredClone(f);
    assert.deepEqual(call(g.evaluateEffectApplyAdmission, f), admission(literal, reason));
    const outcome = call(g.applyEffect, f);
    assert.deepEqual(outcome, reason === 'none'
      ? {status: 'applied', reason: 'none', admission: admission(), state: {entityId: 'monster-1', instances: [literal]}}
      : {status: 'rejected', reason, admission: admission(literal, reason), state: null});
    frozen(outcome); assert.deepEqual(f, before); mutable(f);
  }
  console.log('EFFECT_APPLY_PRIORITY_PASS S03-S09/S12; six_exact_reasons; priority_literal; rejected_state_null; callers_unchanged');
});

test('EF09–EF10: ordered append, conflicting retry rejection and target-local identity scope', () => {
  const f = fixture(), empty = structuredClone(f.state);
  f.request.instance.effectInstanceId = 'z-instance';
  const a = call(g.applyEffect, f);
  f.state = a.state; f.request.instance.effectInstanceId = 'a-instance';
  const b = call(g.applyEffect, f);
  assert.deepEqual(b.state, {entityId: 'monster-1', instances: [
    {...literal, effectInstanceId: 'z-instance'}, {...literal, effectInstanceId: 'a-instance'}]});
  f.state = b.state; f.request.instance.effectInstanceId = 'z-instance';
  for (const conflict of [false, true]) {
    if (conflict) {
      f.definition.effectId = f.request.instance.effectId = 'burning';
      f.request.instance.source = {kind: 'system', sourceId: 'environment', sourceKey: 'other-source'};
    }
    assert.deepEqual(call(g.applyEffect, f), {status: 'rejected', reason: 'instance_already_present',
      admission: admission(structuredClone(f.request.instance), 'instance_already_present'), state: null});
    assert.deepEqual(b.state.instances, [{...literal, effectInstanceId: 'z-instance'}, {...literal, effectInstanceId: 'a-instance'}]);
  }
  f.state = empty;
  assert.equal(call(g.applyEffect, f).status, 'applied'); // No global processed-request store.
  f.state.entityId = f.targetLife.entityId = f.request.instance.targetEntityId = 'player-1';
  assert.equal(call(g.applyEffect, f).status, 'applied'); // Same ID in a different target state is permitted.
  assert.deepEqual(empty.instances, []); frozen(a); frozen(b);
  assert.notEqual(a.state.instances[0], b.state.instances[0]);
  console.log('EFFECT_APPLY_CANDIDATE_PASS S10-S14; stable_append; duplicate_conflicts_reject; local_identity; no_overwrite');
});

test('EF06–EF10: complete closed validation and associations precede every ordinary rejection', () => {
  let getters = 0;
  const getter = () => {getters++; throw Error('getter invoked');};
  function malformed(record) {
    const result = [null, undefined, [], true, 42, 'record', Object.create(record), {...record, extra: 1},
      {...record, [Symbol('extra')]: 1}, Object.defineProperty({...record}, 'hidden', {value: 1})];
    for (const key of Object.keys(record)) {
      const missing = {...record}; delete missing[key]; result.push(missing);
      result.push(Object.defineProperty({...record}, key, {get: getter}));
      result.push(Object.assign(Object.create({[key]: record[key]}), missing));
    }
    return result;
  }
  function invalid(change) {
    for (const fn of [g.evaluateEffectApplyAdmission, g.applyEffect]) {
      const f = fixture(); f.entities.entities = []; f.policy.sourceEligible = f.policy.targetEligible = false;
      change(f); assert.throws(() => call(fn, f), TypeError);
    }
  }
  const f = fixture();
  for (const key of ['definition', 'request', 'state', 'targetLife', 'policy', 'entities']) {
    for (const value of malformed(f[key])) invalid(x => {x[key] = value;});
  }
  for (const value of malformed(literal)) {
    invalid(x => {x.request.instance = value;});
    invalid(x => {x.state.instances = [value];});
  }
  for (const value of malformed(literal.source)) {
    invalid(x => {x.request.instance.source = value;});
    invalid(x => {x.state.instances = [{...literal, source: value}];});
  }
  for (const value of malformed(f.entities.entities[0])) invalid(x => {x.entities.entities = [value];});
  const badArrays = value => [null, {}, 'array', [,], [value,,],
    Object.assign([value], {extra: 1}), Object.assign([value], {[Symbol('extra')]: 1}),
    Object.defineProperty([value], '0', {get: getter})];
  for (const value of badArrays('alive').concat([[], ['alive', 'alive'], ['unknown'], ['alive', 'dead', 'alive'], [null]])) {
    invalid(x => {x.policy.allowedTargetLifeStatuses = value;});
  }
  for (const value of badArrays(literal)) invalid(x => {x.state.instances = value;});
  for (const value of badArrays(f.entities.entities[0])) invalid(x => {x.entities.entities = value;});
  const inherited = Array(1); Object.setPrototypeOf(inherited, {0: 'alive'});
  invalid(x => {x.policy.allowedTargetLifeStatuses = inherited;});
  for (const value of [null, undefined, 0, 'true', {}, []]) {
    for (const field of ['sourceEligible', 'targetEligible']) invalid(x => {x.policy[field] = value;});
  }
  for (const value of ['', ' \t ', null, undefined, 3, {}, Symbol('id')]) {
    invalid(x => {x.definition.effectId = value;});
    for (const key of ['effectInstanceId', 'effectId', 'targetEntityId']) invalid(x => {x.request.instance[key] = value;});
    for (const key of ['sourceId', 'sourceKey']) invalid(x => {x.request.instance.source[key] = value;});
    invalid(x => {x.targetLife.entityId = value;}); invalid(x => {x.state.entityId = value;});
  }
  for (const value of ['equipment', 'skill', 'environment', undefined]) invalid(x => {x.request.instance.source.kind = value;});
  for (const value of ['unknown', '', undefined, null, 1]) invalid(x => {x.targetLife.status = value;});
  invalid(x => {x.definition.effectId = 'burning';});
  invalid(x => {x.state.entityId = 'monster-2';}); invalid(x => {x.targetLife.entityId = 'monster-2';});
  invalid(x => {x.state.instances = [literal, structuredClone(literal)];});
  invalid(x => {x.state.instances = [{...literal, targetEntityId: 'monster-2'}];});
  invalid(x => {x.entities.entities = [{id: 'same', kind: 'player'}, {id: 'same', kind: 'monster'}];});
  invalid(x => {x.request.admission = admission();}); // No forged admission receipt bypass.
  assert.equal(getters, 0); assert.deepEqual(call(g.evaluateEffectApplyAdmission, fixture()), admission());
  console.log('EFFECT_APPLY_VALIDATION_PASS S15-S19; all_nested_closed; canonical_collection; TypeError_before_rejection; getters0');
});

test('EF09–EF10: independent literal replay, mutable-input isolation and no hidden providers', () => {
  function session() {
    const f = fixture(), before = structuredClone(f);
    const assessment = call(g.evaluateEffectApplyAdmission, f), a = call(g.applyEffect, f);
    assert.deepEqual(f, before); mutable(f);
    assert.notEqual(assessment.request, f.request); assert.notEqual(assessment.request.instance.source, f.request.instance.source);
    assert.notEqual(a.state.instances[0], a.admission.request.instance);
    const next = fixture(); next.state = a.state; next.request.instance.effectInstanceId = 'effect-instance-002';
    const b = call(g.applyEffect, next);
    const retry = call(g.applyEffect, {...fixture(), state: b.state});
    const expected = {entityId: 'monster-1', instances: [literal, {...literal, effectInstanceId: 'effect-instance-002'}]};
    assert.deepEqual(b.state, expected);
    assert.deepEqual([a.status, b.status, retry.reason], ['applied', 'applied', 'instance_already_present']);
    assert.deepEqual(retry, {status: 'rejected', reason: 'instance_already_present',
      admission: admission(literal, 'instance_already_present'), state: null});
    f.definition.effectId = f.request.instance.effectId = f.request.instance.source.sourceKey = 'changed';
    f.request.instance.effectInstanceId = f.state.entityId = f.targetLife.status = 'changed';
    f.state.instances.push({...literal}); f.entities.entities[0].id = 'changed'; f.entities.entities.length = 0;
    f.policy.sourceEligible = false; f.policy.allowedTargetLifeStatuses[0] = 'dead';
    assert.deepEqual(assessment, admission()); assert.deepEqual(a.state, {entityId: 'monster-1', instances: [literal]});
    assert.deepEqual(b.state, expected); [assessment, a, b, retry].forEach(frozen);
    assert.throws(() => {b.state.instances[0].source.sourceKey = 'write';}, TypeError);
    return {a, b, retry};
  }
  const slots = [[Date, 'now'], [Math, 'random'], [performance, 'now'], [globalThis, 'setTimeout'], [globalThis, 'setInterval']];
  const original = slots.map(([owner, key]) => Object.getOwnPropertyDescriptor(owner, key));
  try {
    for (const [owner, key] of slots) Object.defineProperty(owner, key, {value() {throw Error('hidden time/RNG/timer');}, configurable: true});
    const a = session(), b = session(); assert.deepEqual(a, b);
    assert.notEqual(a.b.state.instances, b.b.state.instances); assert.notEqual(a.a.admission.request, b.a.admission.request);
  } finally {
    slots.forEach(([owner, key], i) => original[i] ? Object.defineProperty(owner, key, original[i]) : delete owner[key]);
  }
  console.log('EFFECT_APPLY_REPLAY_PASS S20-S22; sessions2_literal; detached_frozen; mutable_callers; no_time_RNG_timers');
});

test('EF06/EF10: real Skill execution handoff, equipment/environment and unchanged canonical owners', () => {
  const f = fixture(), actor = g.getEntity(f.entities, 'player-1'), target = g.getEntity(f.entities, 'monster-1');
  const skillDefinition = g.createSkillDefinition({skillId: 'poison-skill'});
  const skill = g.createSkillInstance(skillDefinition, actor, {instanceId: 'skill-instance-001'});
  const life = g.createEntityLifeState(actor, {status: 'alive'});
  const skillAdmission = g.evaluateSkillActivationAdmission(skillDefinition, skill, actor.id, f.entities, life,
    {owned: true, eligible: true, rank: {mode: 'not_required'}});
  let clockReads = 0;
  const activation = g.activateSkill({instance: skill, admission: skillAdmission,
    resourceState: g.createEntityResourceState(actor, {mana: {minimum: 0, maximum: 100, current: 80}}),
    resourceCosts: {costs: [], bounds: []}, cooldownState: g.createSkillCooldownState(skill),
    cooldownConfig: {baseDurationMs: 0, effectiveCdr: 0},
    executionContext: g.createExecutionContext({clock: {now() {clockReads++; return 1000;}},
      random: {next() {throw Error('RNG');}}, ids: {next() {throw Error('ID');}}}),
    intent: {attemptId: 'skill-attempt-001', dispatch: {kind: 'caller'}}, executionPreflight: {kind: 'caller', status: 'accepted'}});
  assert.equal(activation.status, 'accepted'); assert.equal(clockReads, 1);
  assert.deepEqual(activation.request, {attemptId: 'skill-attempt-001', instanceId: 'skill-instance-001',
    skillId: 'poison-skill', actorEntityId: 'player-1', dispatch: {kind: 'caller'}});
  const attributes = g.createEntityAttributeState(target, {strength: 10});
  const numericalRule = {default: 0, bounds: {}, enabled: true};
  const stats = g.calculateEntityStats(attributes, {attributeOrder: ['strength'], statOrder: ['power'],
    attributeRules: {strength: numericalRule}, attributeBaselines: {strength: 0}, baseStats: {power: 5},
    rules: {power: {...numericalRule, default: 5, scaling: [{attribute: 'strength', coefficient: 2, enabled: true}], training: 0}},
    flatContributions: {}, modifiers: []});
  assert.equal(stats.stats.power, 25);
  const canonical = {activation, life, attributes, stats, ranks: g.createSkillRankState(actor, {'poison-skill': 2}),
    resources: g.createEntityResourceState(target, {health: {minimum: 0, maximum: 100, current: 100}, mana: {minimum: 0, maximum: 100, current: 50}}),
    combat: g.createCombatActionContext({actionId: 'action-001', actionType: 'attack', sourceEntityId: actor.id, target: {kind: 'entity', entityId: target.id}})};
  const before = structuredClone(canonical);
  for (const source of [
    {kind: 'entity', sourceId: activation.request.actorEntityId, sourceKey: `${activation.request.actorEntityId}/${activation.request.instanceId}`},
    {kind: 'entity', sourceId: actor.id, sourceKey: 'equipment/armor-instance-001'},
    {kind: 'system', sourceId: 'swamp-zone', sourceKey: 'swamp-zone/poison-area-001'},
  ]) {
    f.request.instance.source = source;
    assert.deepEqual(call(g.applyEffect, f).state, {entityId: 'monster-1', instances: [{...literal, source}]});
  }
  assert.deepEqual(canonical, before); assert.equal(clockReads, 1); // No Skill rerun or other owner transitions.
  const {modules} = JSON.parse(readFileSync(new URL('./effect-modules.json', import.meta.url), 'utf8'));
  const registry = modules.reduce(g.registerModule, g.createModuleRegistry());
  assert.deepEqual(g.composeModules(registry, g.configureModules(registry,
    {enable: ['entity', 'effect'], disable: ['skill', 'combat', 'progression']})).moduleIds, ['entity', 'effect']);
  console.log('EFFECT_APPLY_HANDOFF_PASS S23-S28; actual_Skill_execution_request; equipment_environment; entity_effect_only; owners_unchanged');
});
