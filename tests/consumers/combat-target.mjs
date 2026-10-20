import assert from 'node:assert/strict';
import test from 'node:test';
import {createEntity, createEntityCollection, addEntity, createEntityLifeState,
  createCombatActionContext, evaluateCombatActionAdmission, evaluateCombatTargetValidation,
  createEntityResourceState, createProgressionState} from '@rpg/gameplay';

const source = createEntity({id: 'player-1', kind: 'player'});
const monster = createEntity({id: 'monster-1', kind: 'monster'});
const ally = createEntity({id: 'player-2', kind: 'player'});
const npc = createEntity({id: 'npc-1', kind: 'npc'});
const entities = [source, monster, ally, npc].reduce(addEntity, createEntityCollection());
const request = (targetId = 'monster-1') => ({actionId: 'attack-001', actionType: 'basic_attack',
  sourceEntityId: 'player-1', target: {kind: 'entity', entityId: targetId}});
const admission = (targetId = 'monster-1') => evaluateCombatActionAdmission(
  createCombatActionContext(request(targetId)), entities,
  createEntityLifeState(source, {status: 'alive'}), {eligible: true});
const policy = () => ({relation: 'enemy', allowedRelations: ['enemy'], allowedLifeStatuses: ['alive']});
const life = () => ({entityId: 'monster-1', status: 'alive'});
const expected = {context: {actionId: 'attack-001', actionType: 'basic_attack', sourceEntityId: 'player-1',
  target: {kind: 'entity', entityId: 'monster-1'}}, targetEntityId: 'monster-1', relation: 'enemy',
  targetLifeStatus: 'alive', status: 'accepted', reason: 'none'};

test('CB11–CB14: explicit relation/life policies and exact identity, no kind inference', () => {
  assert.deepEqual(evaluateCombatTargetValidation(admission(), entities,
    createEntityLifeState(monster, {status: 'alive'}), policy()), expected);
  assert.equal(evaluateCombatTargetValidation(admission('player-2'), entities,
    createEntityLifeState(ally, {status: 'alive'}), {relation: 'ally',
      allowedRelations: ['self', 'ally'], allowedLifeStatuses: ['alive', 'dead']}).status, 'accepted');
  for (const [targetId, relation] of [['player-1', 'self'], ['player-2', 'ally'], ['npc-1', 'neutral'],
    ['monster-1', 'enemy'], ['player-2', 'enemy'], ['monster-1', 'ally']]) {
    for (const status of ['alive', 'dead']) {
      const result = evaluateCombatTargetValidation(admission(targetId), entities, {entityId: targetId, status},
        {relation, allowedRelations: [relation], allowedLifeStatuses: [status]});
      assert.deepEqual(result, {context: request(targetId), targetEntityId: targetId, relation,
        targetLifeStatus: status, status: 'accepted', reason: 'none'});
    }
  }
  for (const [targetId, relation] of [['player-1', 'enemy'], ['monster-1', 'self']]) {
    assert.throws(() => evaluateCombatTargetValidation(admission(targetId), entities,
      {entityId: targetId, status: 'alive'}, {...policy(), relation}), TypeError);
  }
  const exact = {id: ' Monster / exact ', kind: 'custom'};
  assert.deepEqual(evaluateCombatTargetValidation(admission(exact.id), addEntity(entities, exact),
    {entityId: exact.id, status: 'alive'}, policy()),
  {...expected, context: request(exact.id), targetEntityId: exact.id});
  console.log('COMBAT_TARGET_POLICY_PASS self/ally/enemy/neutral; alive/dead explicit; exact_IDs; no_kind_inference');
});

test('CB15: literal rejection priority, admission stage gate and target-only lookup', () => {
  const cases = [
    [createEntityCollection(), 'enemy', 'alive', 'target_not_found'],
    [createEntityCollection(), 'ally', 'dead', 'target_not_found'],
    [entities, 'ally', 'dead', 'relation_not_allowed'],
    [entities, 'ally', 'alive', 'relation_not_allowed'],
    [entities, 'enemy', 'dead', 'target_life_not_allowed'],
  ];
  for (const [collection, relation, status, reason] of cases) {
    assert.deepEqual(evaluateCombatTargetValidation(admission(), collection,
      {entityId: 'monster-1', status}, {...policy(), relation}),
    {...expected, relation, targetLifeStatus: status, status: 'rejected', reason});
  }
  // No source in this supplied collection: source existence/life/eligibility are not rerun.
  const targetOnly = addEntity(createEntityCollection(), monster);
  assert.deepEqual(evaluateCombatTargetValidation(admission(), targetOnly, life(), policy()), expected);
  const rejected = evaluateCombatActionAdmission(request(), entities,
    createEntityLifeState(source, {status: 'dead'}), {eligible: true});
  assert.deepEqual([rejected.status, rejected.reason], ['rejected', 'source_dead']);
  let targetReads = 0;
  const poison = new Proxy({}, {ownKeys() {targetReads++; throw Error('Target evaluation ran');}});
  assert.throws(() => evaluateCombatTargetValidation(rejected, poison, poison, poison), TypeError);
  assert.equal(targetReads, 0);
  // Matching structure is sufficient; no claim of provenance/authentication.
  assert.deepEqual(evaluateCombatTargetValidation({context: request(), status: 'admitted', reason: 'none'},
    targetOnly, life(), policy()), expected);
  assert.equal(evaluateCombatTargetValidation(admission('Monster-1'), entities,
    {entityId: 'Monster-1', status: 'alive'}, policy()).reason, 'target_not_found');
});

test('CB15: malformed data always throws before gameplay rejection; no getters/callbacks', () => {
  let calls = 0;
  const getter = (record, key) => Object.defineProperty(record, key,
    {configurable: true, get() {calls++; throw Error('Getter ran');}});
  const badRecords = record => [undefined, null, [], {}, {...record, extra: true},
    {...record, [Symbol()]: true}, Object.create(record), getter({...record}, Object.keys(record)[0])];
  const badArrays = valid => [undefined, null, {}, [], [valid, valid], ['unknown'], [1], [() => {calls++;}],
    new Array(1), Object.assign([valid], {extra: true}), Object.assign([valid], {[Symbol()]: true}),
    getter([valid], '0'), Object.create([valid]),
    Object.setPrototypeOf(new Array(1), {'0': valid}),
    Object.defineProperty([valid], 'extra', {value: true})];
  const policies = [...badRecords(policy()), {...policy(), relation: 'unknown'},
    {...policy(), relation: () => {calls++;}},
    ...badArrays('enemy').map(allowedRelations => ({...policy(), allowedRelations})),
    ...badArrays('alive').map(allowedLifeStatuses => ({...policy(), allowedLifeStatuses}))];
  for (const key of Object.keys(policy())) {
    const missing = policy(); delete missing[key]; policies.push(missing);
  }
  const lives = [...badRecords(life()), {entityId: 'player-1', status: 'alive'},
    {entityId: '', status: 'alive'}, {entityId: 1, status: 'alive'},
    {entityId: 'monster-1', status: 'living'}];
  for (const collection of [entities, createEntityCollection()]) {
    for (const status of ['alive', 'dead']) {
      for (const invalid of policies) assert.throws(() => evaluateCombatTargetValidation(admission(),
        collection, {entityId: 'monster-1', status}, invalid), TypeError);
    }
    for (const invalid of lives) assert.throws(() => evaluateCombatTargetValidation(admission(),
      collection, invalid, {...policy(), relation: 'ally'}), TypeError);
  }
  for (const invalid of [...badRecords(admission()), {...admission(), status: 'accepted'},
    {...admission(), reason: 'source_dead'}, {...admission(), context: null},
    {...admission(), context: {...request(), target: {kind: 'position', entityId: 'monster-1'}}},
    {...admission(), context: getter(request(), 'sourceEntityId')}]) {
    assert.throws(() => evaluateCombatTargetValidation(invalid, entities, life(), policy()), TypeError);
  }
  for (const invalid of [undefined, {}, {entities: [monster, monster]}, {entities: [, monster]},
    getter({}, 'entities')]) {
    assert.throws(() => evaluateCombatTargetValidation(admission(), invalid, life(), policy()), TypeError);
  }
  assert.deepEqual(evaluateCombatTargetValidation(Object.assign(Object.create(null), admission()), entities,
    Object.assign(Object.create(null), life()), Object.assign(Object.create(null), policy())), expected);
  assert.equal(calls, 0);
  console.log('COMBAT_TARGET_VALIDATION_PASS malformed_before_rejection; getters/callbacks=0; stage/identity=TypeError');
});

test('CB15: two immutable independent sessions match literal oracle without state/time/RNG effects', () => {
  const resources = createEntityResourceState(monster, {
    health: {minimum: 0, maximum: 100, current: 0},
    mana: {minimum: 0, maximum: 100, current: 30},
  });
  const progression = createProgressionState(monster, {level: 10, experience: 1500});
  const before = JSON.stringify({entities, resources, progression});
  const now = Date.now, random = Math.random;
  const results = [];
  try {
    Date.now = () => {throw Error('Hidden clock');};
    Math.random = () => {throw Error('Hidden RNG');};
    for (let session = 0; session < 2; session++) {
      const receipt = {context: request(), status: 'admitted', reason: 'none'};
      const collection = {entities: [{id: 'monster-1', kind: 'monster'}]};
      const targetLife = life(), rules = policy();
      const original = JSON.stringify({receipt, collection, targetLife, rules});
      const result = evaluateCombatTargetValidation(receipt, collection, targetLife, rules);
      assert.deepEqual(result, expected);
      assert.equal(JSON.stringify({receipt, collection, targetLife, rules}), original);
      for (const input of [receipt, receipt.context, receipt.context.target, collection, collection.entities,
        collection.entities[0], targetLife, rules, rules.allowedRelations, rules.allowedLifeStatuses]) {
        assert.equal(Object.isFrozen(input), false);
      }
      for (const output of [result, result.context, result.context.target]) assert.ok(Object.isFrozen(output));
      assert.notEqual(result.context, receipt.context);
      assert.notEqual(result.context.target, receipt.context.target);
      assert.throws(() => {result.context.target.entityId = 'changed';}, TypeError);
      assert.throws(() => {result.reason = 'target_not_found';}, TypeError);
      receipt.context.target.entityId = 'changed'; receipt.status = 'rejected';
      collection.entities[0].id = 'changed'; targetLife.status = 'dead';
      rules.allowedRelations[0] = 'ally'; rules.allowedLifeStatuses[0] = 'dead';
      assert.deepEqual(result, expected);
      results.push(result);
      const rejected = evaluateCombatTargetValidation(admission(), entities, life(), {...policy(), relation: 'ally'});
      for (const output of [rejected, rejected.context, rejected.context.target]) assert.ok(Object.isFrozen(output));
    }
  } finally {Date.now = now; Math.random = random;}
  assert.deepEqual(results[0], results[1]);
  assert.notEqual(results[0], results[1]);
  assert.equal(JSON.stringify({entities, resources, progression}), before);
  assert.deepEqual(resources, {entityId: 'monster-1', current: {health: 0, mana: 30}});
  console.log('COMBAT_TARGET_SESSIONS_PASS sessions=2 literal_oracle; HP0_life_alive; no_mutation; execution=NOT_IMPLEMENTED');
});
