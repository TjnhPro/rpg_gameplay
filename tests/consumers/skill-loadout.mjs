import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as g from '@rpg/gameplay';

const allowed = {eligible: true, allowDuplicateInstance: false};
const duplicate = {...allowed, allowDuplicateInstance: true};
const actor = g.createEntity({id: 'player-1', kind: 'player'});
const skill = id => g.createSkillInstance(g.createSkillDefinition({skillId: id}), actor, {instanceId: `${id}-instance`});
const fire = skill('fireball'), heal = skill('heal'), lightning = skill('lightning');
const state = (values = [null, null, null], loadoutId = 'primary') => ({entityId: 'player-1', loadoutId,
  slots: values.map((instanceId, index) => ({slotId: `slot-${index + 1}`, instanceId}))});
const initial = () => g.createSkillLoadoutState(actor, {loadoutId: 'primary', slotIds: ['slot-1', 'slot-2', 'slot-3']});
function frozen(value) {
  if (value && typeof value === 'object') {assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen);}
}
function rejection(operation, reason, slotId, beforeInstanceId = null) {
  return {status: 'rejected', reason, operation, slotId, beforeInstanceId, afterInstanceId: null, state: null};
}
function noImplicitProviders(run) {
  const now = Date.now, random = Math.random;
  try {Date.now = Math.random = () => {throw Error('implicit time/RNG');}; run();}
  finally {Date.now = now; Math.random = random;}
}

test('SK26–SK29: literal ordered transitions and two independent immutable replay histories', () => noImplicitProviders(() => {
  for (let session = 0; session < 2; session++) {
    const history = [initial()];
    const transitions = [
      ['assign', fire, 'slot-1', null, 'fireball-instance', ['fireball-instance', null, null]],
      ['assign', heal, 'slot-2', null, 'heal-instance', ['fireball-instance', 'heal-instance', null]],
      ['replace', lightning, 'slot-1', 'fireball-instance', 'lightning-instance', ['lightning-instance', 'heal-instance', null]],
      ['remove', null, 'slot-2', 'heal-instance', null, ['lightning-instance', null, null]],
    ];
    const expectedHistory = [state()];
    for (const [operation, instance, slotId, beforeInstanceId, afterInstanceId, slots] of transitions) {
      const previous = history.at(-1);
      const result = operation === 'remove' ? g.removeSkillLoadoutSlot(previous, slotId, {eligible: true})
        : (operation === 'assign' ? g.assignSkillLoadoutSlot : g.replaceSkillLoadoutSlot)(previous, slotId, instance, allowed);
      const expected = state(slots);
      assert.deepEqual(result, {status: 'applied', reason: 'none', operation, slotId, beforeInstanceId, afterInstanceId, state: expected});
      frozen(result); assert.notEqual(result.state, previous); assert.notEqual(result.state.slots, previous.slots);
      history.push(result.state); expectedHistory.push(expected);
      assert.deepEqual(history, expectedHistory); // Every intermediate state matches task literals, not session A.
    }
    assert.deepEqual(history[0], state());
    assert.deepEqual(history.at(-1), state(['lightning-instance', null, null]));
  }
  console.log('SKILL_LOADOUT_TRANSITIONS_PASS S01/S02/S04/S07/S16/S25/S27; literal_intermediate_history; sessions2; hidden_providers0');
}));

test('SK27–SK30: exact rejection priority and explicit duplicate policy without partial state', () => {
  const occupied = state(['fireball-instance', 'heal-instance', null]);
  const cases = [
    ['assign', occupied, 'missing', fire, {eligible: false, allowDuplicateInstance: false}, 'slot_not_found', null],
    ['replace', occupied, 'missing', fire, allowed, 'slot_not_found', null],
    ['remove', occupied, 'missing', null, {eligible: false}, 'slot_not_found', null],
    ['assign', occupied, 'slot-1', fire, {eligible: false, allowDuplicateInstance: false}, 'slot_ineligible', 'fireball-instance'],
    ['replace', occupied, 'slot-3', fire, {eligible: false, allowDuplicateInstance: false}, 'slot_ineligible', null],
    ['remove', occupied, 'slot-1', null, {eligible: false}, 'slot_ineligible', 'fireball-instance'],
    ['assign', occupied, 'slot-2', fire, allowed, 'slot_occupied', 'heal-instance'],
    ['replace', occupied, 'slot-3', fire, allowed, 'slot_empty', null],
    ['remove', occupied, 'slot-3', null, {eligible: true}, 'slot_empty', null],
    ['replace', state(['fireball-instance', 'fireball-instance', null]), 'slot-1', fire, allowed, 'same_instance', 'fireball-instance'],
    ['assign', occupied, 'slot-3', fire, allowed, 'instance_already_assigned', null],
    ['replace', occupied, 'slot-2', fire, allowed, 'instance_already_assigned', 'heal-instance'],
  ];
  for (const [operation, input, slotId, instance, policy, reason, before] of cases) {
    const original = structuredClone(input);
    const result = operation === 'remove' ? g.removeSkillLoadoutSlot(input, slotId, policy)
      : (operation === 'assign' ? g.assignSkillLoadoutSlot : g.replaceSkillLoadoutSlot)(input, slotId, instance, policy);
    assert.deepEqual(result, rejection(operation, reason, slotId, before)); frozen(result);
    assert.deepEqual(input, original);
    assert.equal(Object.isFrozen(input), false);
  }
  const assigned = g.assignSkillLoadoutSlot(occupied, 'slot-3', fire, duplicate);
  assert.deepEqual(assigned.state, state(['fireball-instance', 'heal-instance', 'fireball-instance']));
  const replaced = g.replaceSkillLoadoutSlot(occupied, 'slot-2', fire, duplicate);
  assert.deepEqual(replaced.state, state(['fireball-instance', 'fireball-instance', null]));
  assert.deepEqual(g.removeSkillLoadoutSlot(replaced.state, 'slot-1', {eligible: true}).state,
    state([null, 'fireball-instance', null])); // Remove only one duplicate reference.
  console.log('SKILL_LOADOUT_POLICY_PASS S03/S05/S06/S08-S10/S12-S15; priority; duplicates_both_policies; no_partial_state');
});

test('SK30: complete malformed contracts throw before ordinary rejection without getters', () => {
  let reads = 0;
  const malformed = value => [null, [], 1, {...value, extra: true}, {...value, [Symbol()]: 1}, Object.create(value),
    ...Object.keys(value).flatMap(key => {
      const missing = {...value}; delete missing[key];
      return [missing, Object.assign(Object.create({[key]: value[key]}), missing),
        Object.defineProperty({...value}, key, {get() {reads++; throw Error('getter');}})];
    })];
  const badArrays = entry => [null, {}, [,], Object.assign([entry], {extra: true}),
    Object.assign([entry], {[Symbol()]: 1}), Object.defineProperty([entry], '0', {get() {reads++; throw Error('getter');}})];
  const invalidIds = ['', ' ', null, 0, {}, undefined];
  const layout = {loadoutId: 'primary', slotIds: ['slot-1']};
  for (const bad of malformed(actor)) assert.throws(() => g.createSkillLoadoutState(bad, layout), TypeError);
  for (const bad of [...malformed(layout), ...badArrays('slot-1').map(slotIds => ({...layout, slotIds})),
    ...invalidIds.map(loadoutId => ({...layout, loadoutId})),
    ...invalidIds.map(id => ({...layout, slotIds: [id]})), {...layout, slotIds: ['slot-1', 'slot-1']}]) {
    assert.throws(() => g.createSkillLoadoutState(actor, bad), TypeError);
  }
  const good = state();
  const badStates = [...malformed(good), ...badArrays(good.slots[0]).map(slots => ({...good, slots})),
    ...malformed(good.slots[0]).map(slot => ({...good, slots: [slot]})),
    {...good, slots: [{slotId: 'same', instanceId: null}, {slotId: 'same', instanceId: null}]}];
  for (const key of ['entityId', 'loadoutId']) for (const value of invalidIds) badStates.push({...good, [key]: value});
  for (const key of ['slotId', 'instanceId']) for (const value of invalidIds) {
    if (key === 'instanceId' && value === null) continue;
    badStates.push({...good, slots: [{...good.slots[0], [key]: value}]});
  }
  for (const bad of badStates) {
    assert.throws(() => g.validateSkillLoadoutState(bad), TypeError);
    assert.throws(() => g.assignSkillLoadoutSlot(bad, 'missing', fire, allowed), TypeError);
    assert.throws(() => g.replaceSkillLoadoutSlot(bad, 'missing', fire, allowed), TypeError);
    assert.throws(() => g.removeSkillLoadoutSlot(bad, 'missing', {eligible: false}), TypeError);
  }
  for (const mutate of [g.assignSkillLoadoutSlot, g.replaceSkillLoadoutSlot]) {
    for (const bad of [...malformed(fire), ...['instanceId', 'skillId', 'entityId'].flatMap(key => invalidIds.map(value => ({...fire, [key]: value}))),
      {...fire, entityId: 'player-2'}]) assert.throws(() => mutate(good, 'missing', bad, {eligible: false, allowDuplicateInstance: false}), TypeError);
    for (const bad of [...malformed(allowed), {...allowed, eligible: 'yes'}, {...allowed, allowDuplicateInstance: 1}]) {
      assert.throws(() => mutate(good, 'missing', fire, bad), TypeError);
    }
    for (const id of invalidIds) assert.throws(() => mutate(good, id, fire, allowed), TypeError);
  }
  for (const bad of [...malformed({eligible: true}), {eligible: 'yes'}]) {
    assert.throws(() => g.removeSkillLoadoutSlot(good, 'missing', bad), TypeError);
  }
  for (const id of invalidIds) assert.throws(() => g.removeSkillLoadoutSlot(good, id, {eligible: true}), TypeError);
  assert.equal(reads, 0);
  console.log('SKILL_LOADOUT_VALIDATION_PASS S11/S19/S20; whole_input_before_rejection; canonical_entity_instance; getters0');
});

test('SK26/SK30: structural references, independent loadouts and no admission or cascade authority', () => noImplicitProviders(() => {
  const stale = state(['old-instance-id', 'old-instance-id', null]);
  assert.deepEqual(g.validateSkillLoadoutState(stale), stale); // No catalog; duplicate refs are valid structural data.
  const empty = g.createSkillLoadoutState(actor, {loadoutId: 'empty', slotIds: []});
  assert.deepEqual(empty, {entityId: 'player-1', loadoutId: 'empty', slots: []});
  assert.deepEqual(g.assignSkillLoadoutSlot(empty, 'any', fire, allowed), rejection('assign', 'slot_not_found', 'any'));
  const secondary = g.createSkillLoadoutState(actor, {loadoutId: 'secondary', slotIds: ['custom']});
  const isolated = {instance: fire, ranks: g.createSkillRankState(actor, {fireball: 0}),
    resources: g.createEntityResourceState(actor, {mana: {minimum: 0, maximum: 100, current: 0}}),
    cooldown: {...fire, startedAtMs: 1000, readyAtMs: 1750},
    combat: g.createCombatActionContext({actionId: 'pending', actionType: 'spell', sourceEntityId: actor.id,
      target: {kind: 'entity', entityId: 'target'}})};
  const original = structuredClone(isolated);
  const admission = g.evaluateSkillActivationAdmission(g.createSkillDefinition({skillId: 'fireball'}), fire, actor.id,
    g.addEntity(g.createEntityCollection(), actor), g.createEntityLifeState(actor, {status: 'dead'}),
    {owned: true, eligible: true, rank: {mode: 'required', currentRank: 0, minimumRank: 1}});
  assert.equal(admission.reason, 'actor_dead');
  const assigned = g.assignSkillLoadoutSlot(initial(), 'slot-1', fire, allowed);
  assert.equal(assigned.status, 'applied');
  const replaced = g.replaceSkillLoadoutSlot(assigned.state, 'slot-1', heal, allowed);
  assert.equal(replaced.status, 'applied');
  assert.equal(g.removeSkillLoadoutSlot(replaced.state, 'slot-1', {eligible: true}).status, 'applied');
  assert.deepEqual(isolated, original);
  assert.deepEqual(secondary, {entityId: 'player-1', loadoutId: 'secondary', slots: [{slotId: 'custom', instanceId: null}]});
  const {modules} = JSON.parse(readFileSync(new URL('./skill-modules.json', import.meta.url), 'utf8'));
  const registry = modules.reduce(g.registerModule, g.createModuleRegistry());
  assert.deepEqual(g.composeModules(registry, g.configureModules(registry,
    {enable: ['entity', 'skill'], disable: ['progression', 'combat']})).moduleIds, ['entity', 'skill']);
  console.log('SKILL_LOADOUT_BOUNDARY_PASS S17/S18/S21-S24; stale_duplicate_refs_valid; dead_rank0_assigned; no_cascade; entity_skill_only');
}));

test('SK30: special identifiers and mutable caller data remain exact, detached and unfrozen', () => {
  const entity = {id: '__proto__', kind: 'custom'};
  const layout = {loadoutId: ' constructor ', slotIds: ['__proto__', 'constructor', 'toString', 'Slot', 'slot']};
  const created = g.createSkillLoadoutState(entity, layout);
  assert.deepEqual(created, {entityId: '__proto__', loadoutId: ' constructor ', slots: [
    {slotId: '__proto__', instanceId: null}, {slotId: 'constructor', instanceId: null},
    {slotId: 'toString', instanceId: null}, {slotId: 'Slot', instanceId: null}, {slotId: 'slot', instanceId: null}]});
  let current = created;
  for (const id of ['__proto__', 'constructor', 'toString']) {
    const instance = g.createSkillInstance(g.createSkillDefinition({skillId: id}), g.createEntity(entity), {instanceId: id});
    current = g.assignSkillLoadoutSlot(current, id, instance, allowed).state;
  }
  assert.deepEqual(current.slots.map(slot => slot.instanceId), ['__proto__', 'constructor', 'toString', null, null]);
  const input = structuredClone(current), original = structuredClone(input);
  const copied = g.validateSkillLoadoutState(input); frozen(copied);
  assert.notEqual(copied, input); assert.notEqual(copied.slots, input.slots);
  copied.slots.forEach((slot, index) => assert.notEqual(slot, input.slots[index]));
  assert.deepEqual(input, original);
  for (const value of [entity, layout, layout.slotIds, input, input.slots, ...input.slots, allowed]) assert.equal(Object.isFrozen(value), false);
  input.entityId = 'changed'; input.slots[0].instanceId = 'changed'; layout.slotIds.reverse(); entity.id = 'changed';
  assert.deepEqual(copied, original); assert.equal(created.slots[0].slotId, '__proto__');
  assert.throws(() => {copied.slots[0].instanceId = 'mutate';}, TypeError);
  assert.equal(Object.getPrototypeOf(copied), Object.prototype);
  assert.equal(Object.hasOwn(Object.prototype, 'instanceId'), false);
  console.log('SKILL_LOADOUT_ISOLATION_PASS S20/S26; opaque_special_case_space_ids; frozen_detached; caller_unfrozen; no_pollution');
});
