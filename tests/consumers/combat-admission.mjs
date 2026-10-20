import assert from 'node:assert/strict';
import test from 'node:test';
import {createCombatActionContext, evaluateCombatActionAdmission, createEntity,
  createEntityCollection, addEntity, listEntities, createEntityLifeState,
  createEntityResourceState, createProgressionState} from '@rpg/gameplay';

const request = () => ({actionId: 'attack-001', actionType: 'basic_attack',
  sourceEntityId: 'player-1', target: {kind: 'entity', entityId: 'monster-1'}});
const expected = {context: {actionId: 'attack-001', actionType: 'basic_attack',
  sourceEntityId: 'player-1', target: {kind: 'entity', entityId: 'monster-1'}},
  status: 'admitted', reason: 'none'};
const player = createEntity({id: 'player-1', kind: 'player'});
const monster = createEntity({id: 'monster-1', kind: 'monster'});
const entities = addEntity(addEntity(createEntityCollection(), player), monster);
const alive = createEntityLifeState(player, {status: 'alive'});

test('CB06–CB09: canonical actor admission, role parity, unknown target and self-target', () => {
  assert.deepEqual(evaluateCombatActionAdmission(createCombatActionContext(request()), entities, alive, {eligible: true}), expected);
  assert.deepEqual(evaluateCombatActionAdmission({actionId: 'attack-002', actionType: 'basic_attack',
    sourceEntityId: 'monster-1', target: {kind: 'entity', entityId: 'player-1'}},
  entities, createEntityLifeState(monster, {status: 'alive'}), {eligible: true}),
  {context: {actionId: 'attack-002', actionType: 'basic_attack', sourceEntityId: 'monster-1',
    target: {kind: 'entity', entityId: 'player-1'}}, status: 'admitted', reason: 'none'});
  // Source is the only member: absence of target cannot block actor-stage admission.
  const sourceOnly = addEntity(createEntityCollection(), player);
  for (const targetId of ['unknown-target', 'player-1']) {
    const context = {...request(), target: {kind: 'entity', entityId: targetId}};
    assert.deepEqual(evaluateCombatActionAdmission(context, sourceOnly, alive, {eligible: true}),
      {context: {actionId: 'attack-001', actionType: 'basic_attack', sourceEntityId: 'player-1',
        target: {kind: 'entity', entityId: targetId}}, status: 'admitted', reason: 'none'});
  }
  const exact = addEntity(createEntityCollection(), {id: ' Player / exact ', kind: 'custom'});
  assert.deepEqual(evaluateCombatActionAdmission({actionId: ' attempt ', actionType: ' arbitrary ',
    sourceEntityId: ' Player / exact ', target: {kind: 'entity', entityId: 'unknown'}}, exact,
  {entityId: ' Player / exact ', status: 'alive'}, {eligible: true}),
  {context: {actionId: ' attempt ', actionType: ' arbitrary ', sourceEntityId: ' Player / exact ',
    target: {kind: 'entity', entityId: 'unknown'}}, status: 'admitted', reason: 'none'});
});

test('CB09: deterministic rejection priority and no actor/life substitution', () => {
  const dead = createEntityLifeState(player, {status: 'dead'});
  const cases = [
    [createEntityCollection(), alive, true, 'source_not_found'],
    [createEntityCollection(), dead, false, 'source_not_found'],
    [entities, dead, true, 'source_dead'],
    [entities, dead, false, 'source_dead'],
    [entities, alive, false, 'source_ineligible'],
  ];
  for (const [collection, life, eligible, reason] of cases) {
    assert.deepEqual(evaluateCombatActionAdmission(request(), collection, life, {eligible}),
      {context: expected.context, status: 'rejected', reason});
  }
  for (const collection of [entities, createEntityCollection()]) {
    assert.throws(() => evaluateCombatActionAdmission(request(), collection,
      createEntityLifeState(monster, {status: 'alive'}), {eligible: true}), TypeError);
  }
  // A differently cased ID must not match the actual source in the collection.
  assert.deepEqual(evaluateCombatActionAdmission({...request(), sourceEntityId: 'Player-1'},
    entities, {entityId: 'Player-1', status: 'alive'}, {eligible: true}),
  {context: {...expected.context, sourceEntityId: 'Player-1'}, status: 'rejected', reason: 'source_not_found'});
  console.log('COMBAT_ADMISSION_PRIORITY_PASS source_not_found > source_dead > source_ineligible > none');
});

test('CB10: malformed inputs always throw before rejection, no accessor/callback execution', () => {
  let calls = 0;
  const getter = (record, key) => Object.defineProperty(record, key, {
    enumerable: true, configurable: true, get() {calls++; throw Error('Getter invoked');}});
  const malformedLife = [null, undefined, [], {}, {entityId: 'player-1'}, {status: 'alive'},
    {entityId: '', status: 'alive'}, {entityId: 1, status: 'alive'},
    {entityId: 'player-1', status: 'Alive'}, {entityId: 'player-1', status: null},
    {...alive, extra: 1}, {...alive, [Symbol('extra')]: 1},
    Object.defineProperty({...alive}, 'hidden', {value: 1}), Object.create(alive),
    Object.assign(Object.create({status: 'alive'}), {entityId: 'player-1'}),
    getter({...alive}, 'status'), getter({...alive}, 'entityId')];
  const malformedPolicies = [null, undefined, [], {}, {eligible: null}, {eligible: 1},
    {eligible: 'true'}, {eligible: undefined}, {eligible: () => {calls++; return true;}},
    {eligible: Promise.resolve(true)}, {eligible: true, extra: 1},
    {eligible: true, [Symbol('extra')]: 1}, Object.defineProperty({eligible: true}, 'hidden', {value: 1}),
    Object.create({eligible: true}), getter({eligible: true}, 'eligible')];
  for (const collection of [entities, createEntityCollection()]) {
    for (const life of malformedLife) {
      assert.throws(() => evaluateCombatActionAdmission(request(), collection, life, {eligible: false}), TypeError);
    }
    for (const life of [alive, {entityId: 'player-1', status: 'dead'}]) {
      for (const policy of malformedPolicies) {
        assert.throws(() => evaluateCombatActionAdmission(request(), collection, life, policy), TypeError);
      }
    }
  }
  for (const context of [null, {}, {...request(), extra: 1},
    {...request(), target: {kind: 'ground', entityId: 'monster-1'}},
    getter(request(), 'target'), getter(request(), 'actionId'),
    {...request(), target: getter({...request().target}, 'entityId')}]) {
    assert.throws(() => evaluateCombatActionAdmission(context, entities, alive, {eligible: true}), TypeError);
  }
  for (const collection of [null, {}, {entities: [player, player]}, {entities: [player, {id: 'bad'}]},
    {entities: new Array(1)}, Object.create({entities: []}), getter({entities: []}, 'entities'),
    {entities: [getter({...player}, 'id')]}]) {
    assert.throws(() => evaluateCombatActionAdmission(request(), collection, alive, {eligible: true}), TypeError);
  }
  const nullLife = Object.assign(Object.create(null), alive);
  const nullPolicy = Object.assign(Object.create(null), {eligible: true});
  assert.deepEqual(evaluateCombatActionAdmission(request(), entities, nullLife, nullPolicy), expected);
  assert.equal(calls, 0);
  console.log('COMBAT_ADMISSION_VALIDATION_PASS malformed_before_rejection; getters/callbacks=0; identity_mismatch=TypeError');
});

test('CB09/CB10: detached immutable results, deterministic sessions and unchanged caller domains', () => {
  const context = request(), collection = {entities: [{id: 'player-1', kind: 'player'}]};
  const life = {entityId: 'player-1', status: 'alive'}, policy = {eligible: true};
  // Resources intentionally contradict life: only caller-supplied Life owns this decision.
  const resources = createEntityResourceState(player, {health: {minimum: 0, maximum: 100, current: 0},
    mana: {minimum: 0, maximum: 50, current: 30}});
  const progression = createProgressionState(player, {level: 10, experience: 1500});
  const before = structuredClone({context, collection, life, policy});
  const now = Date.now, random = Math.random;
  Date.now = Math.random = () => {throw Error('Implicit time/RNG');};
  let first, second;
  try {
    first = evaluateCombatActionAdmission(context, collection, life, policy);
    second = evaluateCombatActionAdmission(request(), addEntity(createEntityCollection(), player),
      createEntityLifeState(player, {status: 'alive'}), {eligible: true});
  } finally {Date.now = now; Math.random = random;}
  assert.deepEqual(first, expected); assert.deepEqual(second, expected); assert.deepEqual(first, second);
  assert.notEqual(first, second); assert.notEqual(first.context, second.context);
  assert.notEqual(first.context.target, context.target);
  assert.deepEqual({context, collection, life, policy}, before);
  for (const input of [context, context.target, collection, collection.entities, collection.entities[0], life, policy]) {
    assert.equal(Object.isFrozen(input), false);
  }
  for (const result of [first, second, evaluateCombatActionAdmission(context, collection, life, {eligible: false})]) {
    assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.context)); assert.ok(Object.isFrozen(result.context.target));
    assert.deepEqual(Reflect.ownKeys(result), ['context', 'status', 'reason']);
    assert.equal(Reflect.set(result, 'status', 'executed'), false);
    assert.equal(Reflect.set(result, 'reason', 'changed'), false);
    assert.equal(Reflect.set(result, 'context', null), false);
    assert.equal(Reflect.set(result.context.target, 'entityId', 'changed'), false);
  }
  context.actionId = 'changed'; context.sourceEntityId = 'changed'; context.target.entityId = 'changed';
  collection.entities[0].id = 'changed'; collection.entities.push({id: 'new', kind: 'npc'});
  life.entityId = 'changed'; life.status = 'dead'; policy.eligible = false;
  assert.deepEqual(first, expected);
  assert.deepEqual(resources, {entityId: 'player-1', current: {health: 0, mana: 30}});
  assert.deepEqual(progression, {entityId: 'player-1', level: 10, experience: 1500});
  assert.deepEqual(alive, {entityId: 'player-1', status: 'alive'});
  assert.deepEqual(listEntities(entities), [{id: 'player-1', kind: 'player'}, {id: 'monster-1', kind: 'monster'}]);
  console.log('COMBAT_ADMISSION_SESSIONS_PASS sessions=2 literal_oracle; admitted/none; resource0/30_unchanged; execution=NOT_IMPLEMENTED');
});
