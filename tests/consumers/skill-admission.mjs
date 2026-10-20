import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createSkillDefinition, createSkillInstance, evaluateSkillActivationAdmission as evaluate,
  createEntity, createEntityCollection, addEntity, createEntityLifeState,
  createSkillRankState, getSkillRank, createEntityResourceState, createProgressionState,
  createModuleRegistry, registerModule, configureModules, composeModules} from '@rpg/gameplay';

function inputs() {
  const actor = createEntity({id: 'player-1', kind: 'player'});
  const definition = createSkillDefinition({skillId: 'fireball'});
  return [definition, createSkillInstance(definition, actor, {instanceId: 'instance-001'}),
    actor.id, addEntity(createEntityCollection(), actor), createEntityLifeState(actor, {status: 'alive'}),
    {owned: true, eligible: true, rank: {mode: 'not_required'}}];
}
const expected = reason => ({instanceId: 'instance-001', skillId: 'fireball', actorEntityId: 'player-1',
  status: reason === 'none' ? 'admitted' : 'rejected', reason});

test('SK06–SK09: rankless composition and canonical ranked/ownership/life/eligibility outcomes', () => {
  const args = inputs();
  const {modules} = JSON.parse(readFileSync(new URL('./skill-modules.json', import.meta.url), 'utf8'));
  const registry = modules.reduce(registerModule, createModuleRegistry());
  assert.deepEqual(composeModules(registry, configureModules(registry,
    {enable: ['entity', 'skill'], disable: ['progression', 'combat']})).moduleIds, ['entity', 'skill']);
  assert.deepEqual(evaluate(...args), expected('none')); // S01: no rank source needed
  const actor = createEntity({id: 'player-1', kind: 'player'});
  const ranks = createSkillRankState(actor, {fireball: 3, unlearned: 0, low: 2});
  for (const [id, minimumRank, reason] of [
    ['fireball', 2, 'none'], ['fireball', 3, 'none'], // S02/S10
    ['absent', 1, 'skill_rank_unregistered'], // S07: undefined explicitly becomes null
    ['unlearned', 1, 'skill_rank_too_low'], ['low', 3, 'skill_rank_too_low'], // S08/S09
  ]) {
    const definition = createSkillDefinition({skillId: id});
    const instance = createSkillInstance(definition, actor, {instanceId: 'instance-001'});
    const currentRank = getSkillRank(ranks, id) ?? null;
    const result = evaluate(definition, instance, actor.id, args[3], args[4],
      {owned: true, eligible: true, rank: {mode: 'required', currentRank, minimumRank}});
    assert.deepEqual(result, {...expected(reason), skillId: id});
  }
  assert.equal(getSkillRank(ranks, 'unlearned'), 0);
  assert.equal(getSkillRank(ranks, 'absent'), undefined);
  for (const [slot, replacement, reason] of [
    [3, createEntityCollection(), 'actor_not_found'],
    [4, {entityId: 'player-1', status: 'dead'}, 'actor_dead'],
    [1, {...args[1], entityId: 'player-2'}, 'skill_not_owned'],
    [5, {...args[5], owned: false}, 'skill_not_owned'],
    [5, {...args[5], eligible: false}, 'actor_ineligible'],
  ]) {
    const changed = [...args]; changed[slot] = replacement;
    assert.deepEqual(evaluate(...changed), expected(reason)); // S03–S06/S11
  }
  const monster = createEntity({id: 'player-1', kind: 'monster'});
  assert.deepEqual(evaluate(args[0], args[1], args[2], addEntity(createEntityCollection(), monster), args[4], args[5]), expected('none'));
  const extrema = {...args[5], rank: {mode: 'required', currentRank: Number.MAX_SAFE_INTEGER, minimumRank: Number.MAX_SAFE_INTEGER}};
  assert.deepEqual(evaluate(...args.slice(0, 5), extrema), expected('none'));
  console.log('SKILL_ADMISSION_OUTCOMES_PASS S01-S11/S16-S17; canonical_rank3/0/undefined; rankless_entity+skill');
});

test('SK10: literal rejection priority survives overlapping failures and property reordering', () => {
  const args = inputs();
  const denied = {rank: {minimumRank: 1, currentRank: null, mode: 'required'}, eligible: false, owned: false};
  const cases = [
    [createEntityCollection(), 'dead', denied, 'actor_not_found'],
    [args[3], 'dead', denied, 'actor_dead'],
    [args[3], 'alive', denied, 'skill_not_owned'],
    [args[3], 'alive', {...denied, owned: true}, 'skill_rank_unregistered'],
    [args[3], 'alive', {...denied, owned: true, rank: {mode: 'required', currentRank: 0, minimumRank: 1}}, 'skill_rank_too_low'],
    [args[3], 'alive', {...denied, owned: true, rank: {mode: 'required', currentRank: 1, minimumRank: 1}}, 'actor_ineligible'],
    [args[3], 'alive', args[5], 'none'],
  ];
  for (const [entities, status, policy, reason] of cases) {
    assert.deepEqual(evaluate(args[0], args[1], args[2], entities, {status, entityId: 'player-1'}, policy), expected(reason));
  }
  console.log('SKILL_ADMISSION_PRIORITY_PASS S12; not_found>dead>ownership>unregistered>low>eligibility>none');
});

test('SK06–SK10: full invocation validation precedes rejection; malformed records never invoke getters', () => {
  const args = structuredClone(inputs());
  let getters = 0;
  function malformed(record) {
    const entries = Object.entries(record);
    const values = [undefined, null, [], 1, true, 'record', {}, Object.create(record),
      {...record, extra: true}, {...record, [Symbol('unknown')]: true},
      Object.defineProperty({...record}, 'hidden', {value: true})];
    for (const [key] of entries) {
      const missing = {...record}; delete missing[key]; values.push(missing);
      values.push(Object.defineProperty({...record}, key, {get() {getters++; throw Error('getter');}}));
    }
    return values;
  }
  const badBySlot = [
    malformed(args[0]).concat([{skillId: ''}, {skillId: 'heal'}, {skillId: 1}]),
    malformed(args[1]).concat(['instanceId', 'skillId', 'entityId'].flatMap(key =>
      ['', ' \t', null, 1, undefined].map(value => ({...args[1], [key]: value})))),
    [undefined, null, '', ' ', 1, {}, Symbol('actor')],
    malformed(args[3]).concat([{entities: [null]}, {entities: [{id: 'player-1'}]},
      {entities: [args[3].entities[0], args[3].entities[0]]}, {entities: new Array(1)}]),
    malformed(args[4]).concat([Object.assign(Object.create({}), args[4]),
      {entityId: 'monster-1', status: 'alive'}, {entityId: ' ', status: 'alive'},
      {entityId: 'player-1', status: 'ALIVE'}, {entityId: 'player-1', status: false}]),
    malformed(args[5]).concat([0, 1, null, undefined, 'true'].flatMap(value =>
      [{...args[5], owned: value}, {...args[5], eligible: value}]),
      malformed({mode: 'not_required'}).map(rank => ({...args[5], rank})),
      malformed({mode: 'required', currentRank: 1, minimumRank: 1}).map(rank => ({...args[5], rank})),
      [{mode: 'unknown'}, {mode: 'not_required', currentRank: 1}, {mode: 'not_required', minimumRank: 1}]
        .map(rank => ({...args[5], rank})),
      [-1, NaN, Infinity, -Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, undefined, '1', false, {}]
        .map(currentRank => ({...args[5], rank: {mode: 'required', currentRank, minimumRank: 1}})),
      [0, -1, NaN, Infinity, -Infinity, 2.5, Number.MAX_SAFE_INTEGER + 1, undefined, null, '1', false]
        .map(minimumRank => ({...args[5], rank: {mode: 'required', currentRank: 1, minimumRank}}))),
  ];
  const before = structuredClone(args);
  for (const [slot, malformedValues] of badBySlot.entries()) {
    for (const value of malformedValues) {
      // Missing actor, dead life, denied ownership/rank/eligibility cannot mask malformed later inputs.
      const attempt = [...args];
      attempt[3] = createEntityCollection(); attempt[4] = {entityId: 'player-1', status: 'dead'};
      attempt[5] = {owned: false, eligible: false, rank: {mode: 'required', currentRank: null, minimumRank: 1}};
      attempt[slot] = value;
      assert.throws(() => evaluate(...attempt), TypeError, `Malformed slot ${slot}`);
    }
  }
  assert.equal(getters, 0);
  assert.deepEqual(args, before);
  assert.deepEqual(evaluate(...args), expected('none'));
  console.log('SKILL_ADMISSION_VALIDATION_PASS S13-S15; all_six_inputs; TypeError_before_rejection; getters0');
});

test('SK10: detached immutable exact identities, replay, caller ownership and no domain transitions', () => {
  function session() {
    const args = structuredClone(inputs());
    const actor = createEntity({id: 'player-1', kind: 'player'});
    const ranks = createSkillRankState(actor, {fireball: 3});
    const resources = createEntityResourceState(actor, {mana: {minimum: 0, maximum: 10, current: 8}});
    const progression = createProgressionState(actor, {level: 1, experience: 0});
    const before = structuredClone([args, ranks, resources, progression]);
    const results = [evaluate(...args), evaluate(...args),
      evaluate(...args.slice(0, 5), {...args[5], owned: false})];
    assert.deepEqual(results, [expected('none'), expected('none'), expected('skill_not_owned')]);
    assert.notEqual(results[0], results[1]);
    assert.deepEqual([args, ranks, resources, progression], before);
    for (const value of results) {
      assert.ok(Object.isFrozen(value));
      assert.deepEqual(Reflect.ownKeys(value).sort(), ['actorEntityId', 'instanceId', 'reason', 'skillId', 'status']);
      assert.throws(() => {value.status = 'rejected';}, TypeError);
    }
    for (const value of [args[0], args[1], args[3], args[3].entities, args[4], args[5], args[5].rank]) assert.equal(Object.isFrozen(value), false);
    args[0].skillId = args[1].instanceId = args[1].skillId = args[4].entityId = 'changed';
    args[3].entities.length = 0; args[5].owned = false; args[5].rank.mode = 'changed';
    assert.deepEqual(results[0], expected('none'));
    return results;
  }
  const now = Date.now, random = Math.random;
  try {
    Date.now = Math.random = () => {throw Error('Implicit time/RNG');};
    assert.deepEqual(session(), session());
  } finally {Date.now = now; Math.random = random;}
  const id = ' Actor / 1 ', skillId = ' Fireball ', instanceId = ' Instance / 1 ';
  const actor = createEntity({id, kind: 'arbitrary'}), definition = createSkillDefinition({skillId});
  const instance = createSkillInstance(definition, actor, {instanceId});
  assert.deepEqual(evaluate(definition, instance, id, addEntity(createEntityCollection(), actor),
    createEntityLifeState(actor, {status: 'alive'}), inputs()[5]),
  {instanceId, skillId, actorEntityId: id, status: 'admitted', reason: 'none'});
  assert.throws(() => evaluate({...definition, skillId: ' fireball '}, instance, id,
    addEntity(createEntityCollection(), actor), {entityId: id, status: 'alive'}, inputs()[5]), TypeError);
  console.log('SKILL_ADMISSION_ISOLATION_PASS S18; frozen_detached; unchanged_domains; deterministic_two_sessions');
});
