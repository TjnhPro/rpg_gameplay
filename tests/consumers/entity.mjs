import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEntity, createModuleRegistry, registerModule, configureModules,
  resolveModuleDependencies, composeModules, createExecutionContext, nextExecutionId,
} from '@rpg/gameplay';

test('EC01–EC03: shared actors, exact identity/kind, detached immutable independent snapshots', () => {
  const playerInput = {id: 'player-1', kind: 'player'};
  const player = createEntity(playerInput);
  const monster = createEntity({id: 'monster-1', kind: 'monster'});
  const npc = createEntity({id: 'npc-1', kind: 'npc'});
  assert.deepEqual([player, monster, npc], [
    {id: 'player-1', kind: 'player'}, {id: 'monster-1', kind: 'monster'}, {id: 'npc-1', kind: 'npc'},
  ]);
  const custom = createEntity({id: ' Actor / 001 ', kind: ' Caller Custom Kind '});
  assert.deepEqual(custom, {id: ' Actor / 001 ', kind: ' Caller Custom Kind '});
  const repeated = createEntity({id: 'player-1', kind: 'player'});
  assert.deepEqual(repeated, player); assert.notEqual(repeated, player); // no global uniqueness authority
  assert.notEqual(player, playerInput); assert.equal(Object.isFrozen(playerInput), false);
  playerInput.id = 'changed'; playerInput.kind = 'changed';
  assert.deepEqual(player, {id: 'player-1', kind: 'player'});
  for (const entity of [player, monster, npc, custom, repeated]) {
    assert.equal(Object.isFrozen(entity), true);
    assert.deepEqual(Reflect.ownKeys(entity), ['id', 'kind']);
    assert.throws(() => { entity.id = 'rewrite'; }, TypeError);
    assert.throws(() => { entity.kind = 'rewrite'; }, TypeError);
    assert.throws(() => { entity.hp = 100; }, TypeError);
    assert.throws(() => Object.defineProperty(entity, 'id', {value: 'rewrite'}), TypeError);
  }
  assert.deepEqual(monster, {id: 'monster-1', kind: 'monster'});
  assert.deepEqual(repeated, {id: 'player-1', kind: 'player'});
});

test('EC03: invalid/extra/inherited/accessor fields fail atomically without touching existing entities', () => {
  const existing = createEntity({id: 'same-id', kind: 'npc'});
  let getterCalls = 0;
  const accessor = {get id() { getterCalls++; return 'actor'; }, kind: 'npc'};
  const hiddenExtra = Object.defineProperty({id: 'actor', kind: 'npc'}, 'hp', {value: 1});
  const symbolExtra = {id: 'actor', kind: 'npc', [Symbol('state')]: {}};
  const inherited = Object.create({id: 'actor', kind: 'npc'});
  for (const invalid of [null, undefined, [], 'actor', 1, true, () => {}, {},
    {id: 'actor'}, {kind: 'npc'}, {id: '', kind: 'npc'}, {id: ' \t\n', kind: 'npc'},
    {id: 'actor', kind: ''}, {id: 'actor', kind: ' \t'}, {id: 1, kind: 'npc'},
    {id: 'actor', kind: false}, {id: null, kind: 'npc'}, {id: 'actor', kind: null},
    {id: 'actor', kind: 'npc', stats: {}}, {id: 'actor', kind: 'npc', callback() {}},
    hiddenExtra, symbolExtra, inherited, accessor,
  ]) {
    assert.throws(() => createEntity(invalid), TypeError);
    assert.deepEqual(existing, {id: 'same-id', kind: 'npc'});
  }
  assert.equal(getterCalls, 0, 'accessors must not execute during validation');
  assert.deepEqual(createEntity({id: 'same-id', kind: 'npc'}), {id: 'same-id', kind: 'npc'});
  const plainData = Object.assign(Object.create(null), {id: 'null-prototype', kind: 'custom'});
  assert.deepEqual(createEntity(plainData), {id: 'null-prototype', kind: 'custom'});
  assert.equal(Object.isFrozen(plainData), false);
});

test('EC01/GF01–GF05/GF15: optional module composition and explicitly supplied ID; no implicit sources', () => {
  const moduleDefinition = {id: 'entity', optional: true, dependencies: []};
  const registry = registerModule(createModuleRegistry(), moduleDefinition);
  const defaults = configureModules(registry);
  assert.deepEqual(composeModules(registry, defaults), {moduleIds: [], definitions: []});
  const selected = configureModules(registry, {enable: ['entity']});
  assert.deepEqual(resolveModuleDependencies(registry, selected), ['entity']);
  assert.deepEqual(composeModules(registry, selected), {moduleIds: ['entity'], definitions: [moduleDefinition]});
  let clockCalls = 0, randomCalls = 0, idCalls = 0;
  const execution = createExecutionContext({
    clock: {now() { clockCalls++; return 0; }}, random: {next() { randomCalls++; return 0.5; }},
    ids: {next() { idCalls++; return ' Caller ID / 1 '; }},
  });
  const suppliedId = nextExecutionId(execution);
  const savedNow = Date.now, savedRandom = Math.random;
  const forbidden = () => { throw Error('implicit source access'); };
  let entity, same;
  try {
    Date.now = forbidden; Math.random = forbidden;
    entity = createEntity({id: suppliedId, kind: 'summon'});
    assert.throws(() => createEntity({kind: 'summon'}), TypeError);
    same = createEntity({id: suppliedId, kind: 'summon'});
  } finally { Date.now = savedNow; Math.random = savedRandom; }
  assert.deepEqual(entity, {id: ' Caller ID / 1 ', kind: 'summon'});
  assert.deepEqual(same, entity); assert.notEqual(same, entity);
  assert.deepEqual([clockCalls, randomCalls, idCalls], [0, 0, 1]);
  assert.deepEqual(composeModules(registry, defaults), {moduleIds: [], definitions: []});
});
