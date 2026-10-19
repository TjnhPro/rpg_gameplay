import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEntity, createProgressionState, gainExperience, adjustExperience,
  createEntityCollection, addEntity, listEntities, createEntityAttributeState,
  createEntityResourceState, createEntityLifeState,
} from '@rpg/gameplay';

const player = createEntity({id: 'player-1', kind: 'player'});
const stateAt = experience => createProgressionState(player, {level: 10, experience});

test('PG04–PG06: literal signed transitions, floor/cap, zero, fractions and finite numerical boundaries', () => {
  // before, delta, maximum, after, signed applied, limited. Oracles from the approved contract.
  const cases = [
    [1500, 250, undefined, 1750, 250, false],
    [100, 30, undefined, 130, 30, false],
    [500, -200, undefined, 300, -200, false],
    [30, -100, undefined, 0, -30, true],
    [95, 20, 100, 100, 5, true],
    [100, 20, 100, 100, 0, true],
    [10.5, 2.25, undefined, 12.75, 2.25, false],
    [10, 0, undefined, 10, 0, false],
    [100, 0, 100, 100, 0, false],
    [0, 10, 0, 0, 0, true],
    [30, -30, undefined, 0, -30, false],
    [95, 5, 100, 100, 5, false],
    [10.5, 2, 11.25, 11.25, 0.75, true],
    [Number.MIN_VALUE, Number.MIN_VALUE, undefined, 1e-323, Number.MIN_VALUE, false],
    [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE, 0, true],
    [Number.MAX_VALUE / 2, Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE / 2, true],
    [1e20, 1, undefined, 1e20, 0, false], // IEEE number precision, no invented rounding policy.
  ];
  for (const [before, delta, maximum, after, applied, limited] of cases) {
    const original = stateAt(before);
    const adjustment = maximum === undefined ? {delta} : {delta, maximumExperience: maximum};
    const expected = {state: {entityId: 'player-1', level: 10, experience: after},
      transition: {entityId: 'player-1', before, after, requestedDelta: delta, appliedDelta: applied, limited}};
    const result = adjustExperience(original, adjustment);
    assert.deepEqual(result, expected);
    if (delta >= 0) {
      assert.deepEqual(gainExperience(original, delta,
        maximum === undefined ? undefined : {maximumExperience: maximum}), expected);
    }
    assert.deepEqual(original, {entityId: 'player-1', level: 10, experience: before});
    assert.ok(Object.isFrozen(result) && Object.isFrozen(result.state) && Object.isFrozen(result.transition));
    assert.equal(Reflect.set(result.state, 'experience', 999), false);
    assert.equal(Reflect.set(result.transition, 'appliedDelta', 999), false);
    assert.equal(Reflect.set(result, 'state', original), false);
  }
  assert.throws(() => gainExperience(stateAt(Number.MAX_VALUE), Number.MAX_VALUE), /overflow/);
  assert.throws(() => adjustExperience(stateAt(Number.MAX_VALUE), {delta: Number.MAX_VALUE}), /overflow/);
  assert.deepEqual(gainExperience(stateAt(95), 20, {maximumExperience: 100}).state,
    {entityId: 'player-1', level: 10, experience: 100});
  // A previous operation's cap is never stored or retained.
  assert.equal(gainExperience(gainExperience(stateAt(95), 20, {maximumExperience: 100}).state, 20).state.experience, 120);
});

test('PG04–PG06: validate closed own-data states/options before no-op, reject invalid numbers atomically without getters', () => {
  const original = {entityId: ' Exact / ID ', level: 10, experience: 500};
  const saved = structuredClone(original);
  let reads = 0;
  const accessor = (base, key) => Object.defineProperty({...base}, key, {get() {reads++; throw Error('getter');}, enumerable: true});
  const stateShapes = [null, undefined, [], 1, 'state', true, () => {}, {},
    {level: 10, experience: 500}, {entityId: 'x', experience: 500}, {entityId: 'x', level: 10},
    {...original, extra: 0}, {...original, [Symbol('extra')]: 1},
    Object.defineProperty({...original}, 'extra', {value: 1}), Object.create(original),
    ...['entityId', 'level', 'experience'].map(key => accessor(original, key))];
  for (const entityId of ['', ' ', 1, null, undefined]) stateShapes.push({...original, entityId});
  for (const level of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '10']) stateShapes.push({...original, level});
  for (const experience of [-1, NaN, Infinity, -Infinity, '500']) stateShapes.push({...original, experience});
  for (const state of stateShapes) {
    assert.throws(() => gainExperience(state, 0), TypeError);
    assert.throws(() => adjustExperience(state, {delta: 0}), TypeError);
  }
  const wrongNumbers = [NaN, Infinity, -Infinity, '10', null, undefined, true, {}, [], 1n, () => 1];
  for (const amount of [-1, ...wrongNumbers]) assert.throws(() => gainExperience(original, amount), TypeError);
  for (const delta of wrongNumbers) assert.throws(() => adjustExperience(original, {delta}), TypeError);
  for (const maximumExperience of [-1, 300, ...wrongNumbers]) {
    assert.throws(() => gainExperience(original, 0, {maximumExperience}), TypeError);
    assert.throws(() => adjustExperience(original, {delta: -500, maximumExperience}), TypeError);
  }
  const badOptions = [null, [], 1, 'options', () => {}, {extra: 1}, {[Symbol('extra')]: 1},
    Object.defineProperty({}, 'extra', {value: 1}), accessor({}, 'maximumExperience'),
    Object.create({maximumExperience: 1000})];
  for (const options of badOptions) assert.throws(() => gainExperience(original, 0, options), TypeError);
  const badAdjustments = [null, undefined, [], 1, () => {}, {}, {maximumExperience: 1000},
    {delta: 0, extra: 1}, {delta: 0, [Symbol('extra')]: 1},
    Object.create({delta: 0}), accessor({}, 'delta'), accessor({delta: 0}, 'maximumExperience'),
    Object.assign(Object.create({maximumExperience: 1000}), {delta: 0})];
  for (const input of badAdjustments) assert.throws(() => adjustExperience(original, input), TypeError);
  assert.equal(reads, 0);
  assert.deepEqual(original, saved);
  assert.equal(Object.isFrozen(original), false);
  const options = {delta: 20, maximumExperience: 1000};
  const result = adjustExperience(original, options);
  assert.deepEqual(options, {delta: 20, maximumExperience: 1000});
  assert.equal(Object.isFrozen(options), false);
  original.entityId = 'changed'; original.level = 99; original.experience = 9999;
  options.delta = -100; options.maximumExperience = 0;
  assert.deepEqual(result, {state: {entityId: ' Exact / ID ', level: 10, experience: 520},
    transition: {entityId: ' Exact / ID ', before: 500, after: 520, requestedDelta: 20, appliedDelta: 20, limited: false}});
  const nullState = Object.assign(Object.create(null), saved);
  assert.equal(adjustExperience(nullState, Object.assign(Object.create(null), {delta: 0})).state.experience, 500);
});

test('PG04–PG06: actor/domain isolation, literal replay and unchanged level without implicit time or RNG', () => {
  const monster = createEntity({id: 'monster-1', kind: 'monster'});
  const collection = addEntity(addEntity(createEntityCollection(), player), monster);
  const domains = [createEntityAttributeState(player, {strength: 3}),
    createEntityResourceState(player, {health: {minimum: 0, maximum: 9, current: 8}}),
    createEntityLifeState(player, {status: 'alive'})];
  const previous = structuredClone(domains);
  const playerState = stateAt(500), monsterState = createProgressionState(monster, {level: 5, experience: 100});
  assert.deepEqual(gainExperience(playerState, 300).state, {entityId: 'player-1', level: 10, experience: 800});
  assert.deepEqual(monsterState, {entityId: 'monster-1', level: 5, experience: 100});
  assert.equal(playerState.experience, 500);
  assert.deepEqual(domains, previous);
  assert.deepEqual(listEntities(collection), [player, monster]);
  assert.deepEqual(gainExperience(createProgressionState(player, {level: 1, experience: 0}), 100000).state,
    {entityId: 'player-1', level: 1, experience: 100000});
  const now = Date.now, random = Math.random;
  Date.now = Math.random = () => {throw Error('implicit execution dependency');};
  const session = () => {
    let state = stateAt(100);
    const trace = [];
    for (const result of [
      () => gainExperience(state, 250),
      () => adjustExperience(state, {delta: -100}),
      () => gainExperience(state, 50, {maximumExperience: 400}),
    ]) {
      const next = result(); state = next.state; trace.push(next.transition);
    }
    assert.deepEqual(trace, [
      {entityId: 'player-1', before: 100, after: 350, requestedDelta: 250, appliedDelta: 250, limited: false},
      {entityId: 'player-1', before: 350, after: 250, requestedDelta: -100, appliedDelta: -100, limited: false},
      {entityId: 'player-1', before: 250, after: 300, requestedDelta: 50, appliedDelta: 50, limited: false},
    ]);
    assert.deepEqual(state, {entityId: 'player-1', level: 10, experience: 300});
    return trace;
  };
  try {assert.deepEqual(session(), session());} finally {Date.now = now; Math.random = random;}
  console.log('EXPERIENCE_TRACE_PASS 100→350→250→300; floor30→0/applied-30; cap95→100/applied5; level_unchanged');
});
