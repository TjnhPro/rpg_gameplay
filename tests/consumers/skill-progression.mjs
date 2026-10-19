import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEntity, createProgressionState, advanceProgressionLevel, gainExperience,
  createAttributePointState, grantAttributePointRewards, createEntityAttributeState,
  createEntityResourceState, createEntityLifeState,
  createSkillRankState, getSkillRank, createSkillPointState, grantSkillPointRewards,
  evaluateSkillUpgrade, upgradeSkillRank,
} from '@rpg/gameplay';

const actor = createEntity({id: 'player-1', kind: 'player'});
const progression = (level = 20, experience = 260) => createProgressionState(actor, {level, experience});
const initial = (unspentPoints = 3, spentPoints = 5, rewardedThroughLevel = 10) =>
  ({unspentPoints, spentPoints, rewardedThroughLevel});
const pool = () => createSkillPointState(progression(), initial());
const ranks = () => createSkillRankState(actor, {sword_basic: 2, fireball: 0, sword_mastery: 0});
const request = () => ({skillId: 'sword_basic', expectedRank: 2, maxRank: 10, pointCost: 2,
  requiredCharacterLevel: 15, prerequisites: [], eligible: true});
const rules = (targetLevel = 12, experienceMode = 'cumulative') => ({experienceMode, maxLevel: 100, targetLevel,
  requirements: [{toLevel: 11, requiredExperience: 100, eligible: true},
    {toLevel: 12, requiredExperience: 150, eligible: true},
    {toLevel: 13, requiredExperience: 500, eligible: true}].slice(0, targetLevel - 10)});
const receipt = (target = 12, mode = 'cumulative') => advanceProgressionLevel(progression(10), rules(target, mode));
const rewards = () => ({pointsByLevel: {11: 1, 12: 2}});
const assessment = (patch = {}) => ({entityId: 'player-1', skillId: 'sword_basic', beforeRank: 2, projectedRank: 3,
  beforeUnspent: 3, projectedUnspent: 1, pointsSpent: 2, outcome: 'upgraded', reason: 'none', ...patch});

let reads = 0;
const accessor = (base, key) => Object.defineProperty({...base}, key, {get() {reads++; throw Error('getter invoked');}, enumerable: true});
const badShapes = base => [null, undefined, [], 1, () => {}, {}, Object.create(base),
  {...base, extra: 1}, {...base, [Symbol('extra')]: 1}, Object.defineProperty({...base}, 'hidden', {value: 1}),
  ...Object.keys(base).map(key => accessor(base, key)), ...Object.keys(base).map(key => {
    const missing = {...base}; delete missing[key]; return missing;
  })];

test('PG14: exact registered ranks, zero versus unknown, special own keys, detached immutable actors and validation', () => {
  const source = {sword_basic: 2, fireball: 0, '123': 4, ' Odd / ID ': 1};
  const state = createSkillRankState(actor, source);
  assert.deepEqual(state, {entityId: 'player-1', ranks: {'123': 4, sword_basic: 2, fireball: 0, ' Odd / ID ': 1}});
  assert.equal(getSkillRank(state, 'sword_basic'), 2);
  assert.equal(getSkillRank(state, 'fireball'), 0);
  assert.equal(getSkillRank(state, 'missing'), undefined);
  assert.equal(getSkillRank(state, 'constructor'), undefined);
  assert.equal(getSkillRank(state, ' Odd / ID '), 1);
  assert.equal(getSkillRank(state, 'Odd / ID'), undefined);
  assert.deepEqual(createSkillRankState(actor, {}), {entityId: 'player-1', ranks: {}});
  source.fireball = 99;
  assert.equal(getSkillRank(state, 'fireball'), 0);
  assert.equal(Object.isFrozen(source), false);
  for (const item of [state, state.ranks]) assert.ok(Object.isFrozen(item));
  assert.throws(() => {state.ranks.fireball = 2;}, TypeError);
  const special = JSON.parse('{"__proto__":0,"constructor":2,"toString":3}');
  const specialState = createSkillRankState(createEntity({id: ' Exact / ID ', kind: 'custom'}), special);
  assert.equal(specialState.entityId, ' Exact / ID ');
  assert.equal(getSkillRank(specialState, '__proto__'), 0);
  assert.equal(getSkillRank(specialState, 'constructor'), 2);
  assert.equal(getSkillRank(specialState, 'toString'), 3);
  assert.equal(Object.getPrototypeOf(specialState.ranks), Object.prototype);
  assert.equal(Object.getPrototypeOf(special), Object.prototype);
  assert.deepEqual(createSkillRankState(actor, Object.assign(Object.create(null), {x: 1})).ranks, {x: 1});
  for (const value of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '1', null, undefined]) {
    assert.throws(() => createSkillRankState(actor, {x: value}), TypeError);
  }
  for (const map of [null, undefined, [], 1, () => {}, Object.create({x: 1}), {'': 1}, {' ': 1},
    {[Symbol('skill')]: 1}, accessor({x: 1}, 'x')]) assert.throws(() => createSkillRankState(actor, map), TypeError);
  for (const id of ['', ' ', null, 123, Symbol('skill')]) assert.throws(() => getSkillRank(state, id), TypeError);
  for (const bad of badShapes(state)) assert.throws(() => getSkillRank(bad, 'fireball'), TypeError);
  assert.throws(() => createSkillRankState({...actor, extra: 1}, {}), TypeError);
  const monster = createSkillRankState(createEntity({id: 'monster-1', kind: 'monster'}), {fireball: 5});
  assert.equal(getSkillRank(monster, 'fireball'), 5);
  assert.equal(state.ranks.fireball, 0);
  assert.equal(reads, 0);
});

test('PG15: explicit independent skill pool, real completed-prefix receipts, zero/no-level rewards, replay and safe rejection', () => {
  assert.deepEqual(pool(), {entityId: 'player-1', unspentPoints: 3, spentPoints: 5, rewardedThroughLevel: 10});
  const input = initial(0, 0, 10), before = createSkillPointState(progression(10), input);
  input.unspentPoints = 99;
  assert.equal(before.unspentPoints, 0);
  assert.equal(Object.isFrozen(input), false);
  const level = receipt(), policy = rewards();
  const expected = {state: {entityId: 'player-1', unspentPoints: 3, spentPoints: 0, rewardedThroughLevel: 12},
    transition: {entityId: 'player-1', rewardedLevels: [11, 12], pointsGranted: 3, beforeUnspent: 0, afterUnspent: 3}};
  const granted = grantSkillPointRewards(before, level, policy);
  assert.deepEqual(granted, expected);
  assert.deepEqual(grantSkillPointRewards(before, receipt(13), policy), expected);
  assert.deepEqual(grantSkillPointRewards(before, receipt(13, 'level-local'), policy), expected);
  assert.throws(() => grantSkillPointRewards(granted.state, level, policy), TypeError);
  assert.deepEqual(grantSkillPointRewards(before, level, policy), expected, 'stale snapshot can branch');
  const zeroReceipt = receipt(11), zero = grantSkillPointRewards(before, zeroReceipt, {pointsByLevel: {11: 0}});
  assert.deepEqual(zero.state, {entityId: 'player-1', unspentPoints: 0, spentPoints: 0, rewardedThroughLevel: 11});
  assert.equal(zero.transition.pointsGranted, 0);
  assert.throws(() => grantSkillPointRewards(zero.state, zeroReceipt, {pointsByLevel: {11: 0}}), TypeError);
  const noLevels = advanceProgressionLevel(progression(10, 0), rules(11));
  assert.deepEqual(grantSkillPointRewards(before, noLevels, {pointsByLevel: {}}).state, before);
  const attributeBefore = createAttributePointState(progression(10), initial(0, 0, 10));
  const attributeReward = grantAttributePointRewards(attributeBefore, level, {pointsByLevel: {11: 5, 12: 5}});
  assert.deepEqual(attributeReward.state, {entityId: 'player-1', unspentPoints: 10, spentPoints: 0, rewardedThroughLevel: 12});
  assert.equal(before.rewardedThroughLevel, 10, 'Attribute reward does not move Skill cursor');
  assert.equal(granted.state.unspentPoints, 3);
  assert.equal(attributeBefore.rewardedThroughLevel, 10);
  for (const value of [granted, granted.state, granted.transition, granted.transition.rewardedLevels]) assert.ok(Object.isFrozen(value));
  const mutableReceipt = structuredClone(level), mutablePolicy = rewards();
  const detached = grantSkillPointRewards({...before}, mutableReceipt, mutablePolicy);
  mutableReceipt.transition.advancedLevels[0] = 99; mutablePolicy.pointsByLevel[11] = 99;
  assert.deepEqual(detached, expected);
  for (const bad of badShapes(initial())) assert.throws(() => createSkillPointState(progression(), bad), TypeError);
  for (const key of ['unspentPoints', 'spentPoints']) for (const value of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '1']) {
    assert.throws(() => createSkillPointState(progression(), {...initial(), [key]: value}), TypeError);
  }
  for (const cursor of [0, -1, 1.5, 21, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => createSkillPointState(progression(), {...initial(), rewardedThroughLevel: cursor}), TypeError);
  }
  assert.throws(() => createSkillPointState(progression(), initial(Number.MAX_SAFE_INTEGER, 1)), TypeError);
  assert.throws(() => createSkillPointState({...progression(), experience: -1}, initial()), TypeError);
  assert.equal(createSkillPointState(progression(), initial(0, 0, 1)).rewardedThroughLevel, 1);
  for (const state of [...badShapes(before), {...before, entityId: 'other'}, {...before, rewardedThroughLevel: 11},
    {...before, unspentPoints: -1}]) assert.throws(() => grantSkillPointRewards(state, level, policy), TypeError);
  for (const bad of [...badShapes(level), {state: level.state, transition: {...level.transition, levelsGained: 3}},
    {state: {...level.state, level: 13}, transition: level.transition},
    {state: level.state, transition: {...level.transition, advancedLevels: [11, 13]}},
    {state: level.state, transition: accessor(level.transition, 'reason')}, level.state]) {
    assert.throws(() => grantSkillPointRewards(before, bad, policy), TypeError);
  }
  for (const bad of [...badShapes(policy), {pointsByLevel: {}}, {pointsByLevel: {11: 1}},
    {pointsByLevel: {11: 1, 12: 2, 13: 9}}, {pointsByLevel: {'011': 1, 12: 2}},
    {pointsByLevel: accessor({11: 1, 12: 2}, '12')}, {pointsByLevel: Object.create({11: 1, 12: 2})}]) {
    assert.throws(() => grantSkillPointRewards(before, level, bad), TypeError);
  }
  for (const value of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '1']) {
    assert.throws(() => grantSkillPointRewards(before, level, {pointsByLevel: {11: 1, 12: value}}), TypeError);
  }
  assert.throws(() => grantSkillPointRewards(before, level, {pointsByLevel: {11: Number.MAX_SAFE_INTEGER, 12: 1}}), TypeError);
  assert.throws(() => grantSkillPointRewards({...before, unspentPoints: Number.MAX_SAFE_INTEGER}, level, policy), TypeError);
  assert.throws(() => grantSkillPointRewards({...before, spentPoints: Number.MAX_SAFE_INTEGER}, level, policy), TypeError);
  assert.deepEqual(before, {entityId: 'player-1', unspentPoints: 0, spentPoints: 0, rewardedThroughLevel: 10});
  assert.equal(reads, 0);
});

test('PG16–PG18: literal upgrade/learning, prerequisites and deterministic blocker priority, dry-run and stale request', () => {
  const character = progression(), beforeRanks = ranks(), beforePoints = pool(), policy = request();
  const expected = {ranks: {entityId: 'player-1', ranks: {sword_basic: 3, fireball: 0, sword_mastery: 0}},
    points: {entityId: 'player-1', unspentPoints: 1, spentPoints: 7, rewardedThroughLevel: 10}, transition: assessment()};
  assert.deepEqual(evaluateSkillUpgrade(character, beforeRanks, beforePoints, policy), expected.transition);
  const result = upgradeSkillRank(character, beforeRanks, beforePoints, policy);
  assert.deepEqual(result, expected);
  assert.throws(() => upgradeSkillRank(character, result.ranks, result.points, policy), TypeError);
  assert.throws(() => evaluateSkillUpgrade(character, result.ranks, result.points, policy), TypeError);
  assert.deepEqual(upgradeSkillRank(character, beforeRanks, beforePoints, policy), expected, 'stale snapshots can branch');
  const learned = upgradeSkillRank(character, beforeRanks, createSkillPointState(character, initial(1, 0)),
    {...request(), skillId: 'fireball', expectedRank: 0, pointCost: 1});
  assert.equal(learned.ranks.ranks.fireball, 1); assert.equal(learned.points.unspentPoints, 0);
  const free = upgradeSkillRank(character, beforeRanks, createSkillPointState(character, initial(0, 5)),
    {...request(), skillId: 'fireball', expectedRank: 0, pointCost: 0});
  assert.equal(free.ranks.ranks.fireball, 1); assert.equal(free.points.unspentPoints, 0); assert.equal(free.points.spentPoints, 5);
  assert.equal(free.transition.pointsSpent, 0);
  const blockedCases = [
    [{...policy, maxRank: 2, requiredCharacterLevel: 99, prerequisites: [{skillId: 'fireball', minimumRank: 1}], eligible: false, pointCost: 99}, 'max_rank'],
    [{...policy, requiredCharacterLevel: 99, prerequisites: [{skillId: 'fireball', minimumRank: 1}], eligible: false, pointCost: 99}, 'character_level_too_low'],
    [{...policy, prerequisites: [{skillId: 'fireball', minimumRank: 1}], eligible: false, pointCost: 99}, 'prerequisite_not_met'],
    [{...policy, eligible: false, pointCost: 99}, 'condition_not_met'],
    [{...policy, pointCost: 99}, 'insufficient_points'],
  ];
  for (const [requirement, reason] of blockedCases) {
    const transition = assessment({projectedRank: 2, projectedUnspent: 3, pointsSpent: 0, outcome: 'blocked', reason});
    assert.deepEqual(evaluateSkillUpgrade(character, beforeRanks, beforePoints, requirement), transition);
    assert.deepEqual(upgradeSkillRank(character, beforeRanks, beforePoints, requirement),
      {ranks: beforeRanks, points: beforePoints, transition});
  }
  const prereq = upgradeSkillRank(character, beforeRanks, beforePoints, {...policy, skillId: 'sword_mastery', expectedRank: 0,
    prerequisites: [{skillId: 'sword_basic', minimumRank: 3}]});
  assert.equal(prereq.transition.reason, 'prerequisite_not_met'); assert.equal(prereq.ranks.ranks.sword_mastery, 0);
  const multiple = createSkillRankState(actor, {skill_a: 3, skill_b: 2, skill_c: 0});
  const multipleUpgrade = upgradeSkillRank(character, multiple, beforePoints, {...policy, skillId: 'skill_c', expectedRank: 0,
    prerequisites: [{skillId: 'skill_a', minimumRank: 3}, {skillId: 'skill_b', minimumRank: 2}]});
  assert.deepEqual(multipleUpgrade.ranks.ranks, {skill_a: 3, skill_b: 2, skill_c: 1});
  const atCap = upgradeSkillRank(character, createSkillRankState(actor, {fireball: 5}), beforePoints,
    {...policy, skillId: 'fireball', expectedRank: 5, maxRank: 5});
  assert.equal(atCap.transition.reason, 'max_rank'); assert.equal(atCap.transition.pointsSpent, 0);
  const special = createSkillRankState(actor, JSON.parse('{"__proto__":0,"constructor":2,"toString":3}'));
  const specialResult = upgradeSkillRank(character, special, beforePoints, {...policy, skillId: '__proto__', expectedRank: 0,
    prerequisites: [{skillId: 'constructor', minimumRank: 2}, {skillId: 'toString', minimumRank: 3}]});
  assert.deepEqual(specialResult.ranks.ranks, JSON.parse('{"__proto__":1,"constructor":2,"toString":3}'));
  assert.equal(Object.getPrototypeOf(specialResult.ranks.ranks), Object.prototype);
  for (const value of [result, result.ranks, result.ranks.ranks, result.points, result.transition]) assert.ok(Object.isFrozen(value));
  assert.throws(() => {result.ranks.ranks.sword_basic = 99;}, TypeError);
  assert.throws(() => {result.points.spentPoints = 0;}, TypeError);
  assert.throws(() => {result.transition.reason = 'max_rank';}, TypeError);
  assert.deepEqual(beforeRanks.ranks, {sword_basic: 2, fireball: 0, sword_mastery: 0});
  assert.deepEqual(beforePoints, {entityId: 'player-1', unspentPoints: 3, spentPoints: 5, rewardedThroughLevel: 10});
  const mutable = structuredClone({character, beforeRanks, beforePoints, policy});
  const detached = upgradeSkillRank(mutable.character, mutable.beforeRanks, mutable.beforePoints, mutable.policy);
  mutable.beforeRanks.ranks.fireball = 99; mutable.beforePoints.unspentPoints = 99; mutable.policy.pointCost = 99;
  assert.deepEqual(detached, expected);
  assert.equal(Object.isFrozen(mutable.beforeRanks.ranks), false);
});

test('PG16–PG18: complete malformed-policy/state rejection before blockers, no getters, atomic safety at integer bounds', () => {
  const character = progression(), skillRanks = ranks(), points = pool(), policy = request();
  const check = (c, r, p, req) => {
    assert.throws(() => evaluateSkillUpgrade(c, r, p, req), TypeError);
    assert.throws(() => upgradeSkillRank(c, r, p, req), TypeError);
  };
  for (const invalid of [...badShapes(character), {...character, level: 0}, {...character, experience: -1}]) check(invalid, skillRanks, points, policy);
  for (const invalid of [...badShapes(skillRanks), {...skillRanks, entityId: ''}, {...skillRanks, ranks: {sword_basic: -1}},
    {...skillRanks, ranks: Object.create({sword_basic: 2})}]) check(character, invalid, points, policy);
  for (const invalid of [...badShapes(points), {...points, entityId: ''}, {...points, spentPoints: -1},
    {...points, unspentPoints: Number.MAX_SAFE_INTEGER, spentPoints: 1}, {...points, rewardedThroughLevel: 0}]) check(character, skillRanks, invalid, policy);
  check({...character, entityId: 'other'}, skillRanks, points, policy);
  check(character, {...skillRanks, entityId: 'other'}, points, policy);
  check(character, skillRanks, {...points, entityId: 'other'}, policy);
  const invalidPolicies = badShapes(policy);
  for (const skillId of ['', ' ', 'unknown', 'constructor', null, 123]) invalidPolicies.push({...policy, skillId});
  for (const key of ['expectedRank', 'pointCost']) for (const value of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '2', null]) {
    invalidPolicies.push({...policy, [key]: value});
  }
  invalidPolicies.push({...policy, expectedRank: 1}, {...policy, maxRank: 1});
  for (const key of ['maxRank', 'requiredCharacterLevel']) for (const value of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null]) {
    invalidPolicies.push({...policy, [key]: value});
  }
  for (const eligible of [1, 'true', null, undefined, () => true]) invalidPolicies.push({...policy, eligible});
  const prerequisite = {skillId: 'fireball', minimumRank: 1};
  const sparse = new Array(1), getterList = [prerequisite];
  Object.defineProperty(getterList, '0', {get() {reads++; throw Error('getter');}});
  const badLists = [null, {}, sparse, getterList, Object.assign([], {extra: 1}),
    Object.assign([], {[Symbol('extra')]: 1}), [prerequisite, prerequisite],
    [{skillId: 'sword_basic', minimumRank: 1}], [{skillId: 'unknown', minimumRank: 1}],
    [{skillId: 'constructor', minimumRank: 1}], ...badShapes(prerequisite).map(item => [item])];
  for (const minimumRank of [0, -1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '1']) badLists.push([{...prerequisite, minimumRank}]);
  for (const skillId of ['', ' ', null, 123]) badLists.push([{...prerequisite, skillId}]);
  for (const prerequisites of badLists) invalidPolicies.push({...policy, prerequisites});
  for (const invalid of invalidPolicies) check(character, skillRanks, points, invalid);
  // Even max-rank/low-level blockers may not conceal malformed later requirements.
  for (const prerequisites of [[prerequisite, {skillId: 'unknown', minimumRank: 1}], getterList]) {
    check(character, skillRanks, points, {...policy, maxRank: 2, requiredCharacterLevel: 99, prerequisites});
  }
  const maximum = Number.MAX_SAFE_INTEGER;
  const last = createSkillRankState(actor, {sword_basic: maximum - 1});
  const lastPolicy = {...policy, expectedRank: maximum - 1, maxRank: maximum, pointCost: 3};
  const largePool = createSkillPointState(character, initial(3, maximum - 3));
  const final = upgradeSkillRank(character, last, largePool, lastPolicy);
  assert.equal(final.ranks.ranks.sword_basic, maximum); assert.equal(final.points.spentPoints, maximum);
  assert.equal(evaluateSkillUpgrade(character, final.ranks, final.points, {...lastPolicy, expectedRank: maximum}).reason, 'max_rank');
  assert.deepEqual(skillRanks, ranks()); assert.deepEqual(points, pool()); assert.deepEqual(policy, request());
  assert.equal(reads, 0);
});

test('PG14–PG18: actual level/reward/upgrade handoff, independent domains/actors and two literal deterministic sessions', () => {
  const monster = createEntity({id: 'monster-1', kind: 'monster'});
  const monsterProgression = createProgressionState(monster, {level: 20, experience: 0});
  const monsterRanks = createSkillRankState(monster, {sword_basic: 1});
  const monsterPoints = createSkillPointState(monsterProgression, initial(5, 0));
  const other = {monsterProgression, monsterRanks, monsterPoints,
    attributes: createEntityAttributeState(actor, {strength: 20}),
    resources: createEntityResourceState(actor, {health: {minimum: 0, maximum: 100, current: 30}}),
    life: createEntityLifeState(actor, {status: 'dead'})};
  const saved = structuredClone(other);
  const now = Date.now, random = Math.random;
  Date.now = Math.random = () => {throw Error('implicit clock/RNG');};
  const session = () => {
    const starting = createProgressionState(createEntity({id: 'player-1', kind: 'player'}), {level: 10, experience: 0});
    const points = createSkillPointState(starting, initial(0, 0));
    const skillRanks = createSkillRankState(actor, {sword_basic: 2, fireball: 0});
    const attributes = createAttributePointState(starting, initial(0, 0));
    const earned = gainExperience(starting, 260).state;
    assert.deepEqual(points, {entityId: 'player-1', unspentPoints: 0, spentPoints: 0, rewardedThroughLevel: 10}, 'EXP gain grants nothing');
    const level = advanceProgressionLevel(earned, rules());
    const attributeReward = grantAttributePointRewards(attributes, level, {pointsByLevel: {11: 5, 12: 5}});
    assert.equal(points.rewardedThroughLevel, 10);
    const rewarded = grantSkillPointRewards(points, level, rewards());
    const policy = {...request(), requiredCharacterLevel: 12};
    assert.deepEqual(evaluateSkillUpgrade(level.state, skillRanks, rewarded.state, policy), assessment());
    const upgraded = upgradeSkillRank(level.state, skillRanks, rewarded.state, policy);
    assert.deepEqual(upgraded, {ranks: {entityId: 'player-1', ranks: {sword_basic: 3, fireball: 0}},
      points: {entityId: 'player-1', unspentPoints: 1, spentPoints: 2, rewardedThroughLevel: 12}, transition: assessment()});
    assert.deepEqual(level.state, {entityId: 'player-1', level: 12, experience: 260});
    assert.deepEqual(attributeReward.state, {entityId: 'player-1', unspentPoints: 10, spentPoints: 0, rewardedThroughLevel: 12});
    assert.deepEqual(skillRanks.ranks, {sword_basic: 2, fireball: 0});
    assert.equal(rewarded.state.unspentPoints, 3);
    assert.throws(() => upgradeSkillRank(level.state, upgraded.ranks, upgraded.points, policy), TypeError);
    return upgraded;
  };
  try {assert.deepEqual(session(), session());} finally {Date.now = now; Math.random = random;}
  assert.deepEqual(other, saved);
  const monsterUpgrade = upgradeSkillRank(monsterProgression, monsterRanks, monsterPoints, {...request(), expectedRank: 1});
  assert.equal(monsterUpgrade.ranks.ranks.sword_basic, 2);
  assert.equal(monsterUpgrade.points.unspentPoints, 3);
  console.log('SKILL_PROGRESSION_TRACE_PASS level10->12; rewards1+2=3; rank2->3; cost2; final1/2/cursor12; attributes10_unchanged; sessions=2 literal_oracle');
});
