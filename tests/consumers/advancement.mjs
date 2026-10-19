import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEntity, createProgressionState, gainExperience, adjustExperience,
  evaluateLevelAdvancement, advanceProgressionLevel, createEntityCollection, addEntity,
  listEntities, createEntityAttributeState, createEntityResourceState, createEntityLifeState,
} from '@rpg/gameplay';

const player = createEntity({id: 'player-1', kind: 'player'});
const stateAt = (experience, level = 1) => createProgressionState(player, {level, experience});
const requirement = (toLevel, requiredExperience, eligible = true) => ({toLevel, requiredExperience, eligible});
const policy = (requirements, experienceMode = 'cumulative', maxLevel = 100, targetLevel = requirements.length + 1) =>
  ({experienceMode, maxLevel, targetLevel, requirements});

test('PG07–PG10: literal cumulative/local projections, ordered prefix, eligibility priority, target and cap reasons', () => {
  // Complete independent diagnostics for task scenarios A/B/C, including dry-run.
  const cases = [
    [120, policy([requirement(2, 100)]), {state: {entityId: 'player-1', level: 2, experience: 120},
      transition: {entityId: 'player-1', beforeLevel: 1, projectedLevel: 2, targetLevel: 2,
        beforeExperience: 120, projectedExperience: 120, levelsGained: 1, experienceConsumed: 0, advancedLevels: [2], reason: 'none'}}],
    [260, policy([requirement(2, 100), requirement(3, 250), requirement(4, 500)]),
      {state: {entityId: 'player-1', level: 3, experience: 260},
        transition: {entityId: 'player-1', beforeLevel: 1, projectedLevel: 3, targetLevel: 4,
          beforeExperience: 260, projectedExperience: 260, levelsGained: 2, experienceConsumed: 0,
          advancedLevels: [2, 3], blockedAtLevel: 4, reason: 'insufficient_experience'}}],
    [260, policy([requirement(2, 100), requirement(3, 150), requirement(4, 200)], 'level-local'),
      {state: {entityId: 'player-1', level: 3, experience: 10},
        transition: {entityId: 'player-1', beforeLevel: 1, projectedLevel: 3, targetLevel: 4,
          beforeExperience: 260, projectedExperience: 10, levelsGained: 2, experienceConsumed: 250,
          advancedLevels: [2, 3], blockedAtLevel: 4, reason: 'insufficient_experience'}}],
  ];
  for (const [experience, input, expected] of cases) {
    const state = stateAt(experience);
    assert.deepEqual(evaluateLevelAdvancement(state, input), expected.transition);
    assert.deepEqual(advanceProgressionLevel(state, input), expected);
    assert.deepEqual(state, {entityId: 'player-1', level: 1, experience});
  }
  const blocked = advanceProgressionLevel(stateAt(1000), policy([
    requirement(2, 100), requirement(3, 250, false), requirement(4, 500)]));
  assert.deepEqual(blocked.state, {entityId: 'player-1', level: 2, experience: 1000});
  assert.deepEqual(blocked.transition, {entityId: 'player-1', beforeLevel: 1, projectedLevel: 2, targetLevel: 4,
    beforeExperience: 1000, projectedExperience: 1000, levelsGained: 1, experienceConsumed: 0,
    advancedLevels: [2], blockedAtLevel: 3, reason: 'condition_not_met'});
  // Both eligibility and EXP fail: external gate has priority.
  assert.equal(evaluateLevelAdvancement(stateAt(0), policy([requirement(2, 100, false)])).reason, 'condition_not_met');
  assert.deepEqual(advanceProgressionLevel(stateAt(99), policy([requirement(2, 100)])), {
    state: {entityId: 'player-1', level: 1, experience: 99},
    transition: {entityId: 'player-1', beforeLevel: 1, projectedLevel: 1, targetLevel: 2,
      beforeExperience: 99, projectedExperience: 99, levelsGained: 0, experienceConsumed: 0,
      advancedLevels: [], blockedAtLevel: 2, reason: 'insufficient_experience'}});
  for (const [level, maxLevel, reason] of [[10, 10, 'max_level'], [5, 100, 'target_reached']]) {
    const state = stateAt(10000, level), input = policy([], 'level-local', maxLevel, level);
    assert.deepEqual(advanceProgressionLevel(state, input), {state,
      transition: {entityId: 'player-1', beforeLevel: level, projectedLevel: level, targetLevel: level,
        beforeExperience: 10000, projectedExperience: 10000, levelsGained: 0, experienceConsumed: 0,
        advancedLevels: [], reason}});
    assert.deepEqual(evaluateLevelAdvancement(state, input), advanceProgressionLevel(state, input).transition);
  }
  // Reaching max in this call succeeds with reason none and keeps surplus EXP.
  const capped = advanceProgressionLevel(stateAt(10000), policy([requirement(2, 100)], 'level-local', 2));
  assert.deepEqual(capped.state, {entityId: 'player-1', level: 2, experience: 9900});
  assert.equal(capped.transition.reason, 'none');
  assert.equal(gainExperience(capped.state, 100).state.experience, 10000);
  // Zero/fractional/decreasing local costs; equal cumulative thresholds; exact boundary.
  const local = advanceProgressionLevel(stateAt(1.25), policy([
    requirement(2, 1), requirement(3, 0), requirement(4, 0.25)], 'level-local'));
  assert.deepEqual(local.state, {entityId: 'player-1', level: 4, experience: 0});
  assert.deepEqual(local.transition.advancedLevels, [2, 3, 4]);
  assert.equal(local.transition.experienceConsumed, 1.25);
  assert.equal(local.transition.reason, 'none');
  assert.equal(advanceProgressionLevel(stateAt(0), policy([requirement(2, 0), requirement(3, 0)])).state.level, 3);
  // Native number semantics, no implicit epsilon, rounding or new decimal engine.
  const fractional = advanceProgressionLevel(stateAt(0.3), policy([requirement(2, 0.1), requirement(3, 0.2)], 'level-local'));
  assert.equal(fractional.state.level, 2);
  assert.equal(fractional.state.experience, 0.19999999999999998);
  const huge = advanceProgressionLevel(stateAt(Number.MAX_VALUE), policy([requirement(2, Number.MAX_VALUE)], 'level-local'));
  assert.equal(huge.state.experience, 0);
  assert.equal(huge.transition.experienceConsumed, Number.MAX_VALUE);
  const last = advanceProgressionLevel(stateAt(1, Number.MAX_SAFE_INTEGER - 1),
    policy([requirement(Number.MAX_SAFE_INTEGER, 1)], 'cumulative', Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER));
  assert.equal(last.state.level, Number.MAX_SAFE_INTEGER);
  assert.equal(last.transition.levelsGained, 1);
});

test('PG08: reject complete malformed requests before blockers/no-op without accessor execution or partial state', () => {
  const state = {entityId: ' Exact / ID ', level: 1, experience: 500};
  const valid = policy([requirement(2, 100), requirement(3, 250)]);
  let reads = 0;
  const accessor = (base, key) => Object.defineProperty({...base}, key, {get() {reads++; throw Error('getter');}, enumerable: true});
  const bad = [null, undefined, [], 1, () => {}, {}, Object.create(valid),
    {...valid, experienceMode: undefined}, {...valid, experienceMode: 'automatic'},
    {...valid, extra: 1}, {...valid, [Symbol('extra')]: 1}, Object.defineProperty({...valid}, 'hidden', {value: 1}),
    ...Object.keys(valid).map(key => accessor(valid, key))];
  for (const key of Object.keys(valid)) {const missing = {...valid}; delete missing[key]; bad.push(missing);}
  for (const key of ['maxLevel', 'targetLevel']) {
    for (const value of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '3', null]) bad.push({...valid, [key]: value});
  }
  bad.push({...valid, maxLevel: 2}, {...valid, targetLevel: 101});
  const sparse = new Array(2); sparse[0] = requirement(2, 100);
  const arrayAccessor = [requirement(2, 100), requirement(3, 250)];
  Object.defineProperty(arrayAccessor, '1', {get() {reads++; throw Error('array getter');}});
  const lists = [undefined, null, {}, 'list', [], [requirement(2, 100)],
    [requirement(2, 100), requirement(2, 250)], [requirement(3, 100), requirement(2, 250)],
    [requirement(2, 100), requirement(4, 250)], [requirement(2, 100), requirement(3, 250), requirement(4, 500)],
    [requirement(2, 250), requirement(3, 100)], sparse, arrayAccessor,
    Object.assign([...valid.requirements], {extra: 1}), Object.assign([...valid.requirements], {[Symbol('extra')]: 1})];
  const wrongItems = [null, [], 1, {}, Object.create(requirement(3, 250)),
    {...requirement(3, 250), extra: 1}, {...requirement(3, 250), [Symbol('extra')]: 1},
    Object.defineProperty(requirement(3, 250), 'hidden', {value: 1}),
    ...['toLevel', 'requiredExperience', 'eligible'].map(key => accessor(requirement(3, 250), key))];
  for (const value of [-1, NaN, Infinity, -Infinity, '250', null, undefined]) wrongItems.push(requirement(3, value));
  for (const value of [0, 'true', undefined, null, () => true]) wrongItems.push({...requirement(3, 250), eligible: value});
  for (const item of wrongItems) lists.push([requirement(2, 100, false), item]);
  for (const requirements of lists) bad.push({...valid, requirements});
  for (const input of bad) {
    assert.throws(() => evaluateLevelAdvancement(state, input), TypeError);
    assert.throws(() => advanceProgressionLevel(state, input), TypeError);
  }
  // Full validation even when first step has insufficient EXP or when already at cap/target.
  assert.throws(() => advanceProgressionLevel(stateAt(0), policy([requirement(2, 100), requirement(3, -1)])), TypeError);
  for (const max of [1, 100]) {
    const noOp = policy([], 'cumulative', max, 1);
    assert.throws(() => advanceProgressionLevel(state, {...noOp, requirements: [requirement(2, 100)]}), TypeError);
    assert.throws(() => evaluateLevelAdvancement(state, {...noOp, experienceMode: undefined}), TypeError);
  }
  const badStates = [null, undefined, [], {}, Object.create(state), {...state, extra: 1},
    {...state, [Symbol('extra')]: 1}, ...Object.keys(state).map(key => accessor(state, key)),
    {...state, entityId: ' '}, {...state, entityId: 1}];
  for (const level of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1']) badStates.push({...state, level});
  for (const experience of [-1, NaN, Infinity, '500']) badStates.push({...state, experience});
  for (const current of badStates) {
    assert.throws(() => advanceProgressionLevel(current, valid), TypeError);
    assert.throws(() => evaluateLevelAdvancement(current, valid), TypeError);
  }
  assert.throws(() => advanceProgressionLevel(stateAt(100, 5), {...valid, targetLevel: 4}), TypeError);
  assert.throws(() => advanceProgressionLevel(stateAt(100, 5), {...valid, maxLevel: 4, targetLevel: 5}), TypeError);
  assert.equal(reads, 0);
  assert.deepEqual(state, {entityId: ' Exact / ID ', level: 1, experience: 500});
  assert.deepEqual(valid, policy([requirement(2, 100), requirement(3, 250)]));
  const nullState = Object.assign(Object.create(null), state);
  assert.equal(advanceProgressionLevel(nullState, Object.assign(Object.create(null), valid)).state.level, 3);
});

test('PG09–PG10: detached frozen snapshots, actor/domain isolation, explicit gain and deterministic literal replay', () => {
  const state = {entityId: ' Exact / ID ', level: 1, experience: 260};
  const input = policy([requirement(2, 100), requirement(3, 150), requirement(4, 200)], 'level-local');
  const saved = structuredClone({state, input});
  const result = advanceProgressionLevel(state, input);
  assert.deepEqual(evaluateLevelAdvancement(state, input), result.transition);
  assert.deepEqual({state, input}, saved);
  for (const value of [result, result.state, result.transition, result.transition.advancedLevels]) assert.ok(Object.isFrozen(value));
  assert.throws(() => {result.state.level = 9;}, TypeError);
  assert.throws(() => {result.transition.reason = 'none';}, TypeError);
  assert.throws(() => {result.transition.advancedLevels.push(99);}, TypeError);
  assert.throws(() => {result.state = state;}, TypeError);
  assert.equal(Object.isFrozen(input.requirements), false);
  state.entityId = 'changed'; state.level = 99; state.experience = 0;
  input.requirements[0].requiredExperience = 0; input.requirements.reverse();
  assert.deepEqual(result.state, {entityId: ' Exact / ID ', level: 3, experience: 10});
  assert.equal(result.transition.entityId, ' Exact / ID ');
  assert.deepEqual(result.transition.advancedLevels, [2, 3]);

  const monster = createEntity({id: 'monster-1', kind: 'monster'});
  const monsterState = createProgressionState(monster, {level: 5, experience: 300});
  const collection = addEntity(addEntity(createEntityCollection(), player), monster);
  const domains = [createEntityAttributeState(player, {strength: 3}),
    createEntityResourceState(player, {health: {minimum: 0, maximum: 9, current: 8}}),
    createEntityLifeState(player, {status: 'dead'})];
  const prior = structuredClone(domains);
  assert.equal(advanceProgressionLevel(stateAt(500), policy([requirement(2, 100)])).state.level, 2);
  assert.deepEqual(monsterState, {entityId: 'monster-1', level: 5, experience: 300});
  assert.deepEqual(listEntities(collection), [player, monster]);
  assert.deepEqual(domains, prior);
  const gained = gainExperience(stateAt(0), 10000);
  assert.deepEqual(gained.state, {entityId: 'player-1', level: 1, experience: 10000});
  const advanced = advanceProgressionLevel(gained.state, policy([requirement(2, 100)]));
  assert.deepEqual(advanced.state, {entityId: 'player-1', level: 2, experience: 10000});
  assert.deepEqual(adjustExperience(advanced.state, {delta: -10000}).state,
    {entityId: 'player-1', level: 2, experience: 0});

  const now = Date.now, random = Math.random;
  Date.now = Math.random = () => {throw Error('implicit clock/RNG');};
  const session = () => {
    const initial = createProgressionState(createEntity({id: 'replay', kind: 'custom'}), {level: 1, experience: 0});
    const earned = gainExperience(initial, 260).state;
    const rules = policy([requirement(2, 100), requirement(3, 150), requirement(4, 200)], 'level-local');
    const actual = advanceProgressionLevel(earned, rules);
    const expected = {state: {entityId: 'replay', level: 3, experience: 10}, transition: {
      entityId: 'replay', beforeLevel: 1, projectedLevel: 3, targetLevel: 4, beforeExperience: 260,
      projectedExperience: 10, levelsGained: 2, experienceConsumed: 250, advancedLevels: [2, 3],
      blockedAtLevel: 4, reason: 'insufficient_experience'}};
    assert.deepEqual(actual, expected);
    assert.deepEqual(evaluateLevelAdvancement(earned, rules), expected.transition);
    assert.deepEqual(initial, {entityId: 'replay', level: 1, experience: 0});
    return actual;
  };
  try {assert.deepEqual(session(), session());} finally {Date.now = now; Math.random = random;}
  console.log('ADVANCEMENT_TRACE_PASS cumulative=3/260; local=3/10/consumed250; blocked4; sessions=2 literal_oracle');
});
