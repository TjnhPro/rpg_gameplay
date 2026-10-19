import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEntity, createProgressionState, gainExperience, advanceProgressionLevel,
  createAttributePointState, grantAttributePointRewards, allocateAttributePoints,
  createEntityAttributeState, calculateEntityStats, createEntityResourceState, createEntityLifeState,
} from '@rpg/gameplay';

const actor = createEntity({id: 'player-1', kind: 'player'});
const progression = (level = 1, experience = 260) => createProgressionState(actor, {level, experience});
const initial = (unspentPoints = 0, spentPoints = 0, rewardedThroughLevel = 1) =>
  ({unspentPoints, spentPoints, rewardedThroughLevel});
const pool = (unspentPoints = 0, spentPoints = 0) => createAttributePointState(progression(), initial(unspentPoints, spentPoints));
const rules = (targetLevel = 3) => ({experienceMode: 'cumulative', maxLevel: 100, targetLevel,
  requirements: [{toLevel: 2, requiredExperience: 100, eligible: true},
    {toLevel: 3, requiredExperience: 250, eligible: true},
    {toLevel: 4, requiredExperience: 500, eligible: true}].slice(0, targetLevel - 1)});
const receipt = () => advanceProgressionLevel(progression(), rules());
const rewardPolicy = () => ({pointsByLevel: {2: 5, 3: 5}});
const request = () => ({attributeId: 'strength', pointCost: 3, newBaseValue: 23});

test('PG11–PG12: explicit pool, actual completed-prefix grants, zero/no-level rewards and updated-cursor replay guard', () => {
  const input = initial(5, 3, 10), state = createAttributePointState(progression(10), input);
  assert.deepEqual(state, {entityId: 'player-1', pointKind: 'attribute', unspentPoints: 5, spentPoints: 3, rewardedThroughLevel: 10});
  assert.ok(Object.isFrozen(state));
  assert.equal(Object.isFrozen(input), false);
  input.unspentPoints = 99;
  assert.equal(state.unspentPoints, 5);
  assert.throws(() => {state.unspentPoints = 10;}, TypeError);
  // Caller can explicitly initialize a pending reward cursor below current level.
  assert.equal(createAttributePointState(progression(10), initial(0, 0, 1)).rewardedThroughLevel, 1);
  const before = pool(), advancement = receipt(), policy = rewardPolicy();
  const saved = structuredClone({before, advancement, policy});
  const expected = {state: {entityId: 'player-1', pointKind: 'attribute', unspentPoints: 10, spentPoints: 0, rewardedThroughLevel: 3},
    transition: {entityId: 'player-1', rewardedLevels: [2, 3], pointsGranted: 10, beforeUnspent: 0, afterUnspent: 10}};
  const result = grantAttributePointRewards(before, advancement, policy);
  assert.deepEqual(result, expected);
  assert.deepEqual({before, advancement, policy}, saved);
  assert.deepEqual(grantAttributePointRewards(before, advanceProgressionLevel(progression(), rules(4)), policy), expected);
  // Local EXP-consuming receipts have the same completed levels as cumulative receipts.
  const local = advanceProgressionLevel(progression(), {...rules(), experienceMode: 'level-local',
    requirements: [{toLevel: 2, requiredExperience: 100, eligible: true}, {toLevel: 3, requiredExperience: 150, eligible: true}]});
  assert.equal(local.state.experience, 10);
  assert.deepEqual(grantAttributePointRewards(before, local, policy), expected);
  assert.throws(() => grantAttributePointRewards(result.state, advancement, policy), TypeError);
  // Reusing stale input deliberately creates an alternative branch, not exactly-once IO.
  assert.deepEqual(grantAttributePointRewards(before, advancement, policy), expected);
  const zeroReceipt = advanceProgressionLevel(progression(), rules(2));
  const zero = grantAttributePointRewards(pool(5, 3), zeroReceipt, {pointsByLevel: {2: 0}});
  assert.deepEqual(zero, {state: {entityId: 'player-1', pointKind: 'attribute', unspentPoints: 5, spentPoints: 3, rewardedThroughLevel: 2},
    transition: {entityId: 'player-1', rewardedLevels: [2], pointsGranted: 0, beforeUnspent: 5, afterUnspent: 5}});
  assert.throws(() => grantAttributePointRewards(zero.state, zeroReceipt, {pointsByLevel: {2: 0}}), TypeError);
  // Sequential correctly threaded receipts continue from the new cursor.
  const next = advanceProgressionLevel(zeroReceipt.state, {...rules(), requirements: [rules().requirements[1]]});
  assert.equal(grantAttributePointRewards(zero.state, next, {pointsByLevel: {3: 7}}).state.unspentPoints, 12);
  for (const inputRules of [rules(1), {...rules(1), maxLevel: 1}, rules(2),
    {...rules(2), requirements: [{...rules(2).requirements[0], eligible: false}]}]) {
    const noLevels = advanceProgressionLevel(progression(1, 0), inputRules);
    assert.deepEqual(grantAttributePointRewards(before, noLevels, {pointsByLevel: {}}), {state: before,
      transition: {entityId: 'player-1', rewardedLevels: [], pointsGranted: 0, beforeUnspent: 0, afterUnspent: 0}});
  }
  for (const value of [result, result.state, result.transition, result.transition.rewardedLevels]) assert.ok(Object.isFrozen(value));
  assert.notEqual(result.transition.rewardedLevels, advancement.transition.advancedLevels);
  assert.throws(() => result.transition.rewardedLevels.push(4), TypeError);
  assert.throws(() => {result.transition.pointsGranted = 99;}, TypeError);
  const mutableReceipt = structuredClone(advancement), mutablePoints = {...before};
  const detached = grantAttributePointRewards(mutablePoints, mutableReceipt, policy);
  mutableReceipt.transition.advancedLevels[0] = 99; mutableReceipt.state.level = 99;
  mutablePoints.unspentPoints = 999; policy.pointsByLevel[2] = 99;
  assert.deepEqual(detached, expected);
  assert.deepEqual(grantAttributePointRewards(before, structuredClone(advancement), rewardPolicy()), expected);
});

test('PG11–PG12: malformed states/receipts/reward maps, cursor/identity mismatch and safe arithmetic reject atomically without getters', () => {
  let reads = 0;
  const accessor = (base, key) => Object.defineProperty({...base}, key, {get() {reads++; throw Error('getter');}, enumerable: true});
  const shapes = base => [null, undefined, [], 1, () => {}, {}, Object.create(base),
    {...base, extra: 1}, {...base, [Symbol('extra')]: 1}, Object.defineProperty({...base}, 'hidden', {value: 1}),
    ...Object.keys(base).map(key => accessor(base, key))];
  const badInitials = shapes(initial());
  for (const key of Object.keys(initial())) {const missing = initial(); delete missing[key]; badInitials.push(missing);}
  for (const key of ['unspentPoints', 'spentPoints']) {
    for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null, undefined]) badInitials.push({...initial(), [key]: value});
  }
  for (const value of [0, -1, 1.5, 2, Infinity, Number.MAX_SAFE_INTEGER + 1, '1']) badInitials.push({...initial(), rewardedThroughLevel: value});
  badInitials.push(initial(Number.MAX_SAFE_INTEGER, 1));
  for (const input of badInitials) assert.throws(() => createAttributePointState(progression(), input), TypeError);
  assert.throws(() => createAttributePointState({...progression(), experience: -1}, initial()), TypeError);
  assert.throws(() => createAttributePointState(accessor(progression(), 'entityId'), initial()), TypeError);
  const valid = pool(), levelResult = receipt(), policy = rewardPolicy();
  const badPoints = [...shapes(valid), {...valid, entityId: ''}, {...valid, entityId: 1},
    {...valid, unspentPoints: Number.MAX_SAFE_INTEGER, spentPoints: 1},
    {...valid, spentPoints: -1}, {...valid, unspentPoints: 0.5}, {...valid, rewardedThroughLevel: 0}];
  for (const points of badPoints) {
    assert.throws(() => grantAttributePointRewards(points, levelResult, policy), TypeError);
    assert.throws(() => allocateAttributePoints(points, createEntityAttributeState(actor, {strength: 20}), request()), TypeError);
  }
  for (const points of [{...valid, entityId: 'other'}, {...valid, rewardedThroughLevel: 2}]) {
    assert.throws(() => grantAttributePointRewards(points, levelResult, policy), TypeError);
  }
  const badReceipts = shapes(levelResult);
  for (const transition of shapes(levelResult.transition)) badReceipts.push({...levelResult, transition});
  for (const state of [...shapes(levelResult.state), {...levelResult.state, entityId: 'other'},
    {...levelResult.state, level: 4}, {...levelResult.state, experience: -1}]) badReceipts.push({...levelResult, state});
  for (const [key, value] of [['entityId', 'other'], ['beforeLevel', 0], ['beforeLevel', 2],
    ['projectedLevel', 4], ['targetLevel', 2], ['levelsGained', 3], ['levelsGained', 0.5],
    ['beforeExperience', Infinity], ['beforeExperience', 0], ['projectedExperience', 100],
    ['experienceConsumed', -1], ['experienceConsumed', 1], ['reason', 'unknown'], ['reason', 'target_reached'],
    ['reason', 'insufficient_experience'], ['blockedAtLevel', 4], ['blockedAtLevel', undefined]]) {
    badReceipts.push({...levelResult, transition: {...levelResult.transition, [key]: value}});
  }
  const sparse = new Array(2); sparse[0] = 2;
  const getterArray = [2, 3]; Object.defineProperty(getterArray, '1', {get() {reads++; throw Error('array getter');}});
  for (const advancedLevels of [null, {}, [], [2], [2, 2], [3, 2], [2, 4], [2, 3, 4], sparse, getterArray,
    Object.assign([2, 3], {extra: 1}), Object.assign([2, 3], {[Symbol('extra')]: 1})]) {
    badReceipts.push({...levelResult, transition: {...levelResult.transition, advancedLevels}});
  }
  const partial = advanceProgressionLevel(progression(), rules(4));
  for (const patch of [{blockedAtLevel: 3}, {blockedAtLevel: undefined}, {reason: 'none'}, {targetLevel: 3}]) {
    badReceipts.push({...partial, transition: {...partial.transition, ...patch}});
  }
  for (const invalid of badReceipts) assert.throws(() => grantAttributePointRewards(valid, invalid, policy), TypeError);
  const badPolicies = shapes(policy);
  const maps = [null, [], 1, () => {}, {}, {2: 5}, {2: 5, 3: 5, 4: 100},
    {'02': 5, 3: 5}, {'2e0': 5, 3: 5}, {2: 5, 3: 5, [Symbol('extra')]: 1},
    Object.create({2: 5, 3: 5}), Object.assign(Object.create({2: 5}), {3: 5}),
    accessor({2: 5, 3: 5}, '3'), Object.defineProperty({2: 5, 3: 5}, 'extra', {value: 0})];
  for (const value of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '5', null, undefined]) maps.push({2: 5, 3: value});
  for (const pointsByLevel of maps) badPolicies.push({pointsByLevel});
  for (const input of badPolicies) assert.throws(() => grantAttributePointRewards(valid, levelResult, input), TypeError);
  // Sum overflow, unspent overflow and total (including spent) overflow are distinct.
  assert.throws(() => grantAttributePointRewards(valid, levelResult, {pointsByLevel: {2: Number.MAX_SAFE_INTEGER, 3: 1}}), TypeError);
  assert.throws(() => grantAttributePointRewards(pool(Number.MAX_SAFE_INTEGER), levelResult, policy), TypeError);
  assert.throws(() => grantAttributePointRewards(pool(0, Number.MAX_SAFE_INTEGER), levelResult, policy), TypeError);
  assert.equal(grantAttributePointRewards(valid, levelResult, {pointsByLevel: {2: Number.MAX_SAFE_INTEGER, 3: 0}}).state.unspentPoints, Number.MAX_SAFE_INTEGER);
  assert.deepEqual(grantAttributePointRewards(Object.assign(Object.create(null), valid), levelResult,
    {pointsByLevel: Object.assign(Object.create(null), {2: 5, 3: 5})}).state,
  {entityId: 'player-1', pointKind: 'attribute', unspentPoints: 10, spentPoints: 0, rewardedThroughLevel: 3});
  assert.equal(reads, 0);
  assert.deepEqual(valid, {entityId: 'player-1', pointKind: 'attribute', unspentPoints: 0, spentPoints: 0, rewardedThroughLevel: 1});
  assert.deepEqual(levelResult, receipt());
  assert.deepEqual(policy, rewardPolicy());
});

test('PG13: canonical exact-key upgrades, closed allocation, positive affordable cost, identity and combined immutable result', () => {
  const points = pool(5), attributes = createEntityAttributeState(actor, {strength: 20, vitality: 7});
  const result = allocateAttributePoints(points, attributes, request());
  const expected = {points: {entityId: 'player-1', pointKind: 'attribute', unspentPoints: 2, spentPoints: 3, rewardedThroughLevel: 1},
    attributes: {entityId: 'player-1', baseAttributes: {strength: 23, vitality: 7}},
    transition: {entityId: 'player-1', attributeId: 'strength', beforeValue: 20, afterValue: 23,
      pointsSpent: 3, beforeUnspent: 5, afterUnspent: 2}};
  assert.deepEqual(result, expected);
  for (const value of [result, result.points, result.attributes, result.attributes.baseAttributes, result.transition]) assert.ok(Object.isFrozen(value));
  assert.throws(() => {result.points.spentPoints = 0;}, TypeError);
  assert.throws(() => {result.attributes.baseAttributes.strength = 0;}, TypeError);
  assert.throws(() => {result.transition.pointsSpent = 0;}, TypeError);
  assert.throws(() => {result.attributes = attributes;}, TypeError);
  assert.deepEqual(points, {entityId: 'player-1', pointKind: 'attribute', unspentPoints: 5, spentPoints: 0, rewardedThroughLevel: 1});
  assert.deepEqual(attributes.baseAttributes, {strength: 20, vitality: 7});
  assert.throws(() => allocateAttributePoints(result.points, result.attributes, {...request(), newBaseValue: 26}), TypeError);
  assert.deepEqual(allocateAttributePoints(points, attributes, request()), expected, 'stale snapshot can branch');
  // Cost/value have no implicit conversion ratio, rounding or attribute schema.
  assert.equal(allocateAttributePoints(pool(1), createEntityAttributeState(actor, {strength: 10.5}),
    {attributeId: 'strength', pointCost: 1, newBaseValue: 11.25}).attributes.baseAttributes.strength, 11.25);
  assert.equal(allocateAttributePoints(pool(3), attributes, {...request(), newBaseValue: 100}).attributes.baseAttributes.strength, 100);
  const special = createEntityAttributeState(actor, JSON.parse('{"__proto__":-2," Odd ":1}'));
  assert.deepEqual(allocateAttributePoints(pool(1), special, {attributeId: '__proto__', pointCost: 1, newBaseValue: -1.5}).attributes.baseAttributes,
    JSON.parse('{"__proto__":-1.5," Odd ":1}'));
  assert.equal(allocateAttributePoints(pool(Number.MAX_SAFE_INTEGER), attributes,
    {...request(), pointCost: Number.MAX_SAFE_INTEGER}).points.spentPoints, Number.MAX_SAFE_INTEGER);
  let reads = 0;
  const accessor = (base, key) => Object.defineProperty({...base}, key, {get() {reads++; throw Error('getter');}, enumerable: true});
  const invalid = [null, undefined, [], 1, {}, Object.create(request()), {...request(), extra: 1},
    {...request(), [Symbol('extra')]: 1}, Object.defineProperty(request(), 'hidden', {value: 1}),
    ...Object.keys(request()).map(key => accessor(request(), key))];
  for (const key of Object.keys(request())) {const missing = request(); delete missing[key]; invalid.push(missing);}
  for (const pointCost of [0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, 6, '3', null]) invalid.push({...request(), pointCost});
  for (const newBaseValue of [20, 19, -1, Infinity, NaN, -Infinity, '23', null]) invalid.push({...request(), newBaseValue});
  for (const input of invalid) assert.throws(() => allocateAttributePoints(points, attributes, input), TypeError);
  for (const attributeId of ['unknown', 'Strength', 'constructor', '', ' ', null, 1]) {
    assert.throws(() => allocateAttributePoints(points, attributes, {...request(), attributeId}), TypeError);
  }
  assert.throws(() => allocateAttributePoints(points, attributes, {...request(), attributeId: 'unknown'}), /Unknown attribute/);
  assert.throws(() => allocateAttributePoints(points, {...attributes, entityId: 'monster-1'}, request()), TypeError);
  for (const attributeState of [null, {}, {...attributes, extra: 1}, accessor(attributes, 'entityId'),
    accessor(attributes, 'baseAttributes'), {entityId: 'player-1', baseAttributes: accessor({strength: 20}, 'strength')},
    {entityId: 'player-1', baseAttributes: Object.create({strength: 20})}]) {
    assert.throws(() => allocateAttributePoints(points, attributeState, request()), TypeError);
  }
  assert.equal(reads, 0);
  const mutablePoints = {...points}, mutableAttributes = structuredClone(attributes), mutableRequest = request();
  const saved = structuredClone({mutablePoints, mutableAttributes, mutableRequest});
  const detached = allocateAttributePoints(mutablePoints, mutableAttributes, mutableRequest);
  assert.deepEqual({mutablePoints, mutableAttributes, mutableRequest}, saved);
  assert.equal(Object.isFrozen(mutableAttributes.baseAttributes), false);
  mutableAttributes.baseAttributes.vitality = 99; mutablePoints.spentPoints = 99; mutableRequest.newBaseValue = 999;
  assert.deepEqual(detached, expected);
});

test('PG11–PG13: installed flow, independent actors/domains, explicit real Kernel stats and literal deterministic replay', () => {
  const monster = createEntity({id: 'monster-1', kind: 'monster'});
  const monsterProgression = createProgressionState(monster, {level: 5, experience: 300});
  const monsterPoints = createAttributePointState(monsterProgression, initial(8, 2, 5));
  const monsterAttributes = createEntityAttributeState(monster, {strength: 8});
  const domains = [createEntityResourceState(actor, {health: {minimum: 0, maximum: 100, current: 30}}),
    createEntityLifeState(actor, {status: 'dead'})];
  const saved = structuredClone({monsterProgression, monsterPoints, monsterAttributes, domains});
  const now = Date.now, random = Math.random;
  Date.now = Math.random = () => {throw Error('implicit time/RNG');};
  const session = () => {
    const base = createProgressionState(createEntity({id: 'player-1', kind: 'player'}), {level: 1, experience: 0});
    const points = createAttributePointState(base, initial());
    const attributes = createEntityAttributeState(actor, {strength: 20});
    let transforms = 0;
    const configuration = {attributeOrder: ['strength'], statOrder: ['power'],
      attributeRules: {strength: {default: 0, enabled: true, bounds: {}}}, attributeBaselines: {strength: 0},
      baseStats: {power: 5}, rules: {power: {default: 5, enabled: true, bounds: {}, training: 0,
        scaling: [{attribute: 'strength', coefficient: 2, enabled: true}]}}, flatContributions: {}, modifiers: [],
      transforms: {power(value) {transforms++; return value;}}};
    const oldStats = calculateEntityStats(attributes, configuration);
    assert.equal(oldStats.stats.power, 45);
    assert.equal(transforms, 1);
    const earned = gainExperience(base, 260).state;
    const level = advanceProgressionLevel(earned, rules());
    const rewarded = grantAttributePointRewards(points, level, rewardPolicy());
    const allocated = allocateAttributePoints(rewarded.state, attributes, request());
    assert.deepEqual(allocated, {points: {entityId: 'player-1', pointKind: 'attribute', unspentPoints: 7, spentPoints: 3, rewardedThroughLevel: 3},
      attributes: {entityId: 'player-1', baseAttributes: {strength: 23}},
      transition: {entityId: 'player-1', attributeId: 'strength', beforeValue: 20, afterValue: 23,
        pointsSpent: 3, beforeUnspent: 10, afterUnspent: 7}});
    assert.equal(transforms, 1, 'allocation must not calculate stats');
    assert.equal(calculateEntityStats(allocated.attributes, configuration).stats.power, 51);
    assert.equal(transforms, 2);
    assert.equal(oldStats.stats.power, 45);
    assert.deepEqual(base, {entityId: 'player-1', level: 1, experience: 0});
    assert.deepEqual(level.state, {entityId: 'player-1', level: 3, experience: 260});
    assert.deepEqual(attributes.baseAttributes, {strength: 20});
    assert.deepEqual(points, {entityId: 'player-1', pointKind: 'attribute', unspentPoints: 0, spentPoints: 0, rewardedThroughLevel: 1});
    assert.throws(() => grantAttributePointRewards(allocated.points, level, rewardPolicy()), TypeError);
    return allocated;
  };
  try {assert.deepEqual(session(), session());} finally {Date.now = now; Math.random = random;}
  assert.deepEqual({monsterProgression, monsterPoints, monsterAttributes, domains}, saved);
  assert.deepEqual(createAttributePointState(monsterProgression, initial(8, 2, 5)),
    {entityId: 'monster-1', pointKind: 'attribute', unspentPoints: 8, spentPoints: 2, rewardedThroughLevel: 5});
  const exact = createProgressionState(createEntity({id: ' Exact / ID ', kind: 'custom'}), {level: 1, experience: 260});
  const exactPoints = createAttributePointState(exact, initial());
  const exactGrant = grantAttributePointRewards(exactPoints, advanceProgressionLevel(exact, rules()), rewardPolicy());
  assert.equal(exactGrant.transition.entityId, ' Exact / ID ');
  console.log('ATTRIBUTE_POINTS_TRACE_PASS level1->3; rewards5+5=10; spend3; final7/3/cursor3; base20->23; explicit_stats45->51; sessions=2 literal_oracle');
});
