import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEntity, createProgressionState, createEntityCollection, addEntity,
  getEntity, removeEntity, listEntities, createEntityAttributeState,
  createEntityResourceState, createEntityLifeState, createModuleRegistry,
  registerModule, configureModules, composeModules, resolveModuleDependencies,
} from '@rpg/gameplay';

test('PG01–PG03: shared exact association, explicit numeric values and detached immutable snapshots', () => {
  const definitions = [{id: 'player-1', kind: 'player'}, {id: 'monster-1', kind: 'monster'}, {id: 'npc-1', kind: 'npc'}];
  const inputs = [{level: 10, experience: 1500}, {level: 5, experience: 0}, {level: 1, experience: 0}];
  assert.deepEqual(definitions.map((entity, i) => createProgressionState(createEntity(entity), inputs[i])), [
    {entityId: 'player-1', level: 10, experience: 1500},
    {entityId: 'monster-1', level: 5, experience: 0},
    {entityId: 'npc-1', level: 1, experience: 0},
  ]);
  const entity = {id: ' Exact / ID ', kind: 'custom-summon'}, input = {level: 7, experience: 300};
  const saved = createProgressionState(entity, input);
  const same = createProgressionState(entity, input);
  assert.deepEqual(same, saved); assert.notEqual(same, saved);
  assert.deepEqual(createProgressionState(entity, {level: 30, experience: 0.125}),
    {entityId: ' Exact / ID ', level: 30, experience: 0.125});
  for (const experience of [0, -0, Number.MIN_VALUE, 1.25, Number.MAX_VALUE]) {
    const boundary = createProgressionState(entity, {level: Number.MAX_SAFE_INTEGER, experience});
    assert.equal(boundary.level, Number.MAX_SAFE_INTEGER);
    assert.ok(Object.is(boundary.experience, experience), 'preserve exact JS numeric value, even -0');
  }
  assert.deepEqual(createProgressionState(entity, Object.assign(Object.create(null), {level: 1, experience: 0})),
    {entityId: ' Exact / ID ', level: 1, experience: 0});
  assert.deepEqual(entity, {id: ' Exact / ID ', kind: 'custom-summon'});
  assert.deepEqual(input, {level: 7, experience: 300});
  assert.equal(Object.isFrozen(entity), false); assert.equal(Object.isFrozen(input), false);
  entity.id = 'changed'; input.level = 100; input.experience = 10000;
  assert.deepEqual(saved, {entityId: ' Exact / ID ', level: 7, experience: 300});
  assert.deepEqual(same, saved);
  assert.ok(Object.isFrozen(saved));
  assert.deepEqual(Reflect.ownKeys(saved), ['entityId', 'level', 'experience']);
  for (const [key, value] of [['entityId', 'other'], ['level', 99], ['experience', 999], ['skillPoints', 0]]) {
    assert.equal(Reflect.set(saved, key, value), false);
  }
  assert.throws(() => Object.defineProperty(saved, 'level', {value: 99}), TypeError);
});

test('PG03: closed own-data validation, canonical Entity rejection and atomic failures without getters', () => {
  const actor = createEntity({id: 'player-1', kind: 'player'}), valid = {level: 7, experience: 300};
  const saved = createProgressionState(actor, valid);
  let reads = 0;
  const accessor = key => Object.defineProperty({}, key, {get() {reads++; throw Error('Getter invoked');}, enumerable: true});
  for (const level of [0, -0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '10', undefined, null, true, 1n, {}, () => 1]) {
    assert.throws(() => createProgressionState(actor, {level, experience: 0}), TypeError);
  }
  for (const experience of [-1, -Number.MIN_VALUE, NaN, Infinity, -Infinity, '100', undefined, null, true, 1n, {}, () => 1]) {
    assert.throws(() => createProgressionState(actor, {level: 1, experience}), TypeError);
  }
  const hidden = Object.defineProperty({...valid}, 'extra', {value: 0});
  const malformed = [null, undefined, [], 'state', 1, true, () => {}, {}, {level: 1}, {experience: 0},
    {...valid, entityId: actor.id}, {...valid, skillPoints: 0}, {...valid, [Symbol('extra')]: 0}, hidden,
    Object.create(valid), Object.assign(Object.create({level: 1}), {experience: 0}),
    Object.assign(accessor('level'), {experience: 0}), Object.assign(accessor('experience'), {level: 1})];
  for (const input of malformed) assert.throws(() => createProgressionState(actor, input), TypeError);
  for (const entity of [null, undefined, [], {}, {id: '' , kind: 'player'}, {id: ' ', kind: 'npc'},
    {id: 'x', kind: ''}, {id: 'x', kind: 1}, {id: 1, kind: 'npc'}, Object.create(actor),
    {...actor, extra: 1}, {...actor, [Symbol('extra')]: 0},
    Object.assign(accessor('id'), {kind: 'npc'}), Object.assign(accessor('kind'), {id: 'x'})]) {
    assert.throws(() => createProgressionState(entity, valid), TypeError);
  }
  assert.equal(reads, 0);
  assert.deepEqual(actor, {id: 'player-1', kind: 'player'});
  assert.deepEqual(valid, {level: 7, experience: 300});
  assert.deepEqual(saved, {entityId: 'player-1', level: 7, experience: 300});
});

test('PG01/PG03: collection/domain independence, optional composition and explicit Entity dependency', () => {
  const player = createEntity({id: 'player-1', kind: 'player'}), monster = createEntity({id: 'monster-1', kind: 'monster'});
  const collection = addEntity(addEntity(createEntityCollection(), player), monster);
  const states = [createEntityAttributeState(player, {strength: 3}),
    createEntityResourceState(player, {health: {minimum: 0, maximum: 9, current: 8}}),
    createEntityLifeState(player, {status: 'alive'})];
  const before = structuredClone(states);
  // Module registration intentionally puts the dependent first to prove resolver ownership.
  let registry = registerModule(createModuleRegistry(), {id: 'progression', optional: true, dependencies: ['entity']});
  registry = registerModule(registry, {id: 'entity', optional: true, dependencies: []});
  assert.deepEqual(composeModules(registry, configureModules(registry)).moduleIds, []);
  const selected = configureModules(registry, {enable: ['progression', 'entity']});
  assert.deepEqual(resolveModuleDependencies(registry, selected), ['entity', 'progression']);
  assert.deepEqual(composeModules(registry, selected).moduleIds, ['entity', 'progression']);
  const missing = configureModules(registry, {enable: ['progression']});
  assert.deepEqual(missing.enabledModuleIds, ['progression']); // no automatic Entity selection
  assert.throws(() => composeModules(registry, missing), /requires dependency 'entity' to be enabled/);
  assert.deepEqual(missing.enabledModuleIds, ['progression']);
  assert.deepEqual(composeModules(registry, configureModules(registry, {enable: ['entity']})).moduleIds, ['entity']);
  const now = Date.now, random = Math.random;
  Date.now = Math.random = () => {throw Error('Implicit time/RNG');};
  let saved, same;
  try {
    saved = createProgressionState(getEntity(collection, player.id), {level: 7, experience: 300});
    same = createProgressionState(getEntity(collection, player.id), {level: 7, experience: 300});
  } finally {Date.now = now; Math.random = random;}
  const removed = removeEntity(collection, player.id);
  assert.deepEqual(saved, {entityId: 'player-1', level: 7, experience: 300});
  assert.deepEqual(same, saved);
  assert.deepEqual(listEntities(collection), [player, monster]);
  assert.deepEqual(listEntities(removed), [monster]);
  assert.deepEqual(states, before);
  assert.deepEqual(createProgressionState(monster, {level: 5, experience: 0}), {entityId: 'monster-1', level: 5, experience: 0});
  assert.deepEqual(saved, {entityId: 'player-1', level: 7, experience: 300});
});
