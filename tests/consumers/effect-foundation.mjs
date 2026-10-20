import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as g from '@rpg/gameplay';

const target = {id: 'monster-1', kind: 'monster'};
const entitySource = {kind: 'entity', sourceId: 'player-1', sourceKey: 'player-1/skill-instance-001'};
const literal = {effectInstanceId: 'effect-instance-001', effectId: 'poison',
  source: {kind: 'entity', sourceId: 'player-1', sourceKey: 'player-1/skill-instance-001'}, targetEntityId: 'monster-1'};
const rawInstance = (id, source, entity) => g.createEffectInstance({effectId: 'poison'}, entity, {effectInstanceId: id, source});
const instance = (id = 'effect-instance-001', source = entitySource, entity = target) => rawInstance(id, source, entity);
function frozen(value) {
  if (value && typeof value === 'object') {assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen);}
}

test('EF01–EF03: exact independent identities and Entity/Equipment/System origins without application', () => {
  const definition = g.createEffectDefinition({effectId: 'poison'});
  assert.deepEqual(definition, {effectId: 'poison'});
  assert.deepEqual(instance(), literal);
  const equipment = instance('equipment-effect', {kind: 'entity', sourceId: 'player-1', sourceKey: 'equipment/sword-instance-001'});
  const environment = instance('environment-effect', {kind: 'system', sourceId: 'swamp-zone', sourceKey: 'swamp-zone/poison-area-001'});
  assert.deepEqual(equipment, {effectInstanceId: 'equipment-effect', effectId: 'poison', source: {
    kind: 'entity', sourceId: 'player-1', sourceKey: 'equipment/sword-instance-001'}, targetEntityId: 'monster-1'});
  assert.deepEqual(environment, {effectInstanceId: 'environment-effect', effectId: 'poison', source: {
    kind: 'system', sourceId: 'swamp-zone', sourceKey: 'swamp-zone/poison-area-001'}, targetEntityId: 'monster-1'});
  assert.deepEqual(instance('other-target', entitySource, {id: 'monster-2', kind: 'monster'}),
    {...literal, effectInstanceId: 'other-target', targetEntityId: 'monster-2'});
  // No source lookup, ownership or life input is required by structural creation.
  assert.deepEqual(instance('outside', {kind: 'entity', sourceId: 'not-in-any-collection', sourceKey: 'caller-key'}).source,
    {kind: 'entity', sourceId: 'not-in-any-collection', sourceKey: 'caller-key'});
  const exact = g.createEffectInstance({effectId: ' Poison '}, {id: ' Target ', kind: ' custom '}, {
    effectInstanceId: '__proto__', source: {kind: 'system', sourceId: 'toString', sourceKey: 'constructor'}});
  assert.deepEqual(exact, {effectInstanceId: '__proto__', effectId: ' Poison ', source: {
    kind: 'system', sourceId: 'toString', sourceKey: 'constructor'}, targetEntityId: ' Target '});
  assert.notDeepEqual(g.createEffectDefinition({effectId: 'Poison'}), definition);
  assert.deepEqual(g.createEffectDefinition(Object.assign(Object.create(null), {effectId: '__proto__'})), {effectId: '__proto__'});
  assert.equal(Object.prototype.polluted, undefined);
  [definition, equipment, environment, exact].forEach(frozen);
  assert.deepEqual(Reflect.ownKeys(instance()).sort(), ['effectId', 'effectInstanceId', 'source', 'targetEntityId']);
  console.log('EFFECT_IDENTITY_PASS S01-S07/S13/S16; entity_equipment_system; exact_opaque_ids; structural_only');
});

test('EF04: ordered complete state validation rejects duplicates and wrong targets without grouping', () => {
  const empty = g.createEffectState(target);
  assert.deepEqual(empty, {entityId: 'monster-1', instances: []}); frozen(empty);
  assert.notEqual(g.createEffectState(target).instances, empty.instances);
  const input = {entityId: 'monster-1', instances: [
    {...literal, effectInstanceId: 'z-instance'}, {...literal, effectInstanceId: 'a-instance'}]};
  const result = g.validateEffectState(input);
  assert.deepEqual(result, {entityId: 'monster-1', instances: [
    {...literal, effectInstanceId: 'z-instance'}, {...literal, effectInstanceId: 'a-instance'}]});
  frozen(result); assert.notEqual(result, input); assert.notEqual(result.instances, input.instances);
  for (const [index, item] of result.instances.entries()) {
    assert.notEqual(item, input.instances[index]); assert.notEqual(item.source, input.instances[index].source);
  }
  assert.throws(() => g.validateEffectState({entityId: 'monster-1', instances: [literal, {...literal}]}), TypeError);
  assert.throws(() => g.validateEffectState({entityId: 'monster-2', instances: [literal]}), TypeError);
  // Duplicate definition/sourceKey are structurally allowed, not stacking admission.
  assert.equal(result.instances[0].effectId, result.instances[1].effectId);
  assert.equal(result.instances[0].source.sourceKey, result.instances[1].source.sourceKey);
  assert.deepEqual(g.validateEffectState({entityId: '__proto__', instances: []}), {entityId: '__proto__', instances: []});
  assert.deepEqual(g.validateEffectState(empty), empty);
  console.log('EFFECT_STATE_PASS S08-S12; empty_ordered_detached; duplicate_instance_and_target_mismatch_TypeError; no_stack_policy');
});

test('EF01–EF04: full closed nested validation fails before getters or caller mutation', () => {
  let getters = 0;
  const getter = () => {getters++; throw Error('getter invoked');};
  function malformed(record) {
    const values = [undefined, null, [], 1, 'text', true, {...record, extra: 1},
      {...record, [Symbol('extra')]: true}, Object.create(record),
      Object.defineProperty({...record}, 'hidden', {value: 1})];
    for (const key of Object.keys(record)) {
      const missing = {...record}; delete missing[key]; values.push(missing);
      values.push(Object.defineProperty({...record}, key, {get: getter}));
      values.push(Object.assign(Object.create({[key]: record[key]}), missing));
    }
    return values;
  }
  for (const record of malformed({effectId: 'poison'})) {
    assert.throws(() => g.createEffectDefinition(record), TypeError);
    assert.throws(() => g.createEffectInstance(record, target, {effectInstanceId: 'id', source: entitySource}), TypeError);
  }
  for (const record of malformed({effectInstanceId: 'id', source: entitySource})) {
    assert.throws(() => g.createEffectInstance({effectId: 'poison'}, target, record), TypeError);
  }
  for (const source of malformed(entitySource)) {
    assert.throws(() => rawInstance('id', source, target), TypeError);
    assert.throws(() => g.validateEffectState({entityId: 'monster-1', instances: [{...literal, source}]}), TypeError);
  }
  for (const kind of ['skill', 'item', 'equipment', 'environment', '', null, 1, undefined]) {
    assert.throws(() => instance('id', {...entitySource, kind}), TypeError);
  }
  const invalidIds = ['', ' \t\n ', 1, null, undefined, {}, Symbol('id')];
  for (const value of invalidIds) {
    assert.throws(() => g.createEffectDefinition({effectId: value}), TypeError);
    assert.throws(() => rawInstance(value, entitySource, target), TypeError);
    for (const key of ['sourceId', 'sourceKey']) assert.throws(() => instance('id', {...entitySource, [key]: value}), TypeError);
    assert.throws(() => g.validateEffectState({entityId: value, instances: []}), TypeError);
    for (const key of ['effectInstanceId', 'effectId', 'targetEntityId']) {
      assert.throws(() => g.validateEffectState({entityId: 'monster-1', instances: [{...literal, [key]: value}]}), TypeError);
    }
  }
  for (const record of malformed(literal)) assert.throws(() => g.validateEffectState({entityId: 'monster-1', instances: [record]}), TypeError);
  for (const record of malformed({entityId: 'monster-1', instances: [literal]})) assert.throws(() => g.validateEffectState(record), TypeError);
  for (const array of [null, {}, 'array', [,], [literal,,], {...[literal]},
    Object.assign([literal], {extra: 1}), Object.assign([literal], {[Symbol('extra')]: 1}),
    Object.defineProperty([literal], '0', {get: getter}),
    Object.assign(Object.create(Array.prototype), {length: 1})]) {
    assert.throws(() => g.validateEffectState({entityId: 'monster-1', instances: array}), TypeError);
  }
  const inheritedArray = Array(1); Object.setPrototypeOf(inheritedArray, {0: literal});
  assert.throws(() => g.validateEffectState({entityId: 'monster-1', instances: inheritedArray}), TypeError);
  for (const entity of malformed(target).concat([{id: '', kind: 'monster'}, {id: 'target', kind: ''}])) {
    assert.throws(() => g.createEffectState(entity), TypeError);
    assert.throws(() => rawInstance('id', entitySource, entity), TypeError);
  }
  assert.equal(getters, 0); assert.deepEqual(instance(), literal);
  assert.equal(Object.isFrozen(target), false); assert.equal(Object.isFrozen(entitySource), false);
  console.log('EFFECT_VALIDATION_PASS S10-S15; closed_all_levels; dense_own_data; TypeError; getters0; no_partial_mutation');
});

test('EF01–EF04: detached caller inputs and two literal replay sessions without gameplay/provider execution', () => {
  const oldNow = Date.now, oldRandom = Math.random, oldTimeout = globalThis.setTimeout, oldInterval = globalThis.setInterval;
  function session() {
    const definitionInput = {effectId: 'poison'}, targetInput = {...target};
    const initialInput = {effectInstanceId: 'effect-instance-001', source: {...entitySource}};
    const canonical = {resources: g.createEntityResourceState(target, {health: {minimum: 0, maximum: 100, current: 100}}),
      life: g.createEntityLifeState(target, {status: 'dead'}),
      attributes: g.createEntityAttributeState(target, {strength: 5}),
      ranks: g.createSkillRankState(target, {fireball: 3}),
      skill: g.createSkillInstance({skillId: 'fireball'}, target, {instanceId: 'skill-instance-1'})};
    const before = structuredClone(canonical);
    const definition = g.createEffectDefinition(definitionInput);
    const captured = g.createEffectInstance(definitionInput, targetInput, initialInput);
    const input = {entityId: 'monster-1', instances: [{...literal, source: {...entitySource}}]};
    const state = g.validateEffectState(input), empty = g.createEffectState(targetInput);
    assert.deepEqual(definition, {effectId: 'poison'}); assert.deepEqual(captured, literal);
    assert.deepEqual(state, {entityId: 'monster-1', instances: [literal]});
    assert.deepEqual(empty, {entityId: 'monster-1', instances: []});
    assert.deepEqual(canonical, before); // Structural Effect never commits other owners' state, even for dead target.
    for (const item of [definitionInput, targetInput, initialInput, initialInput.source, input, input.instances,
      input.instances[0], input.instances[0].source]) assert.equal(Object.isFrozen(item), false);
    definitionInput.effectId = targetInput.id = initialInput.effectInstanceId = initialInput.source.sourceKey = 'mutated';
    input.entityId = input.instances[0].effectId = input.instances[0].source.sourceId = 'mutated'; input.instances.push(literal);
    assert.deepEqual(captured, literal); assert.deepEqual(state, {entityId: 'monster-1', instances: [literal]});
    [definition, captured, state, empty].forEach(frozen);
    assert.throws(() => {state.instances[0].source.sourceKey = 'change';}, TypeError);
    assert.throws(() => {state.instances.push(literal);}, TypeError);
    return {definition, captured, state, empty};
  }
  try {
    Date.now = Math.random = globalThis.setTimeout = globalThis.setInterval = () => {throw Error('hidden provider/timer');};
    const a = session(), b = session(); assert.deepEqual(a, b);
    assert.notEqual(a.captured, b.captured); assert.notEqual(a.captured.source, b.captured.source);
    assert.notEqual(a.state.instances, b.state.instances); assert.notEqual(a.state.instances[0], b.state.instances[0]);
  } finally {Date.now = oldNow; Math.random = oldRandom; globalThis.setTimeout = oldTimeout; globalThis.setInterval = oldInterval;}
  console.log('EFFECT_ISOLATION_PASS S17-S18/S20; sessions2_literal_oracle; detached_frozen; callers_unfrozen; no_hidden_providers_gameplay');
});

test('EF05: actual optional registry and Entity-only composition, no sibling coupling or auto enablement', () => {
  const {modules} = JSON.parse(readFileSync(new URL('./effect-modules.json', import.meta.url), 'utf8'));
  assert.deepEqual(modules.find(m => m.id === 'effect'), {id: 'effect', optional: true, dependencies: ['entity']});
  const registry = modules.reduce(g.registerModule, g.createModuleRegistry());
  const selection = input => g.configureModules(registry, input);
  const compose = input => g.composeModules(registry, selection(input)).moduleIds;
  assert.deepEqual(compose(), []); assert.deepEqual(compose({enable: ['entity'], disable: ['effect']}), ['entity']);
  const effectOnly = selection({enable: ['effect']}); assert.deepEqual(effectOnly.enabledModuleIds, ['effect']);
  assert.throws(() => g.composeModules(registry, effectOnly), error => error instanceof TypeError && /entity/.test(error.message));
  assert.deepEqual(compose({enable: ['effect', 'entity'], disable: ['skill', 'combat', 'progression']}), ['entity', 'effect']);
  assert.deepEqual(compose({enable: ['effect', 'skill', 'entity']}), ['entity', 'skill', 'effect']);
  assert.deepEqual(compose({enable: ['entity', 'skill'], disable: ['effect']}), ['entity', 'skill']);
  assert.deepEqual(instance(), literal);
  console.log('EFFECT_COMPOSITION_PASS S19/S21-S23; entity_effect_only; optional; siblings_independent; no_auto_enable');
});
