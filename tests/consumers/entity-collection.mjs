import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEntity, createEntityCollection, addEntity, getEntity, hasEntity,
  listEntities, removeEntity, replaceEntity,
} from '@rpg/gameplay';

test('EC04–EC06: exact collection-local IDs, lookup and deterministic add/replace/remove order', () => {
  const sequence = () => {
    const empty = createEntityCollection();
    assert.deepEqual(empty, {entities: []});
    assert.equal(getEntity(empty, 'missing'), undefined);
    assert.equal(hasEntity(empty, 'missing'), false);
    const first = addEntity(empty, createEntity({id: 'player-1', kind: 'player'}));
    const second = addEntity(first, {id: 'actor-1', kind: 'npc'});
    const third = addEntity(second, {id: 'monster-1', kind: 'monster'});
    assert.deepEqual(listEntities(first), [{id: 'player-1', kind: 'player'}]);
    assert.deepEqual(listEntities(second), [{id: 'player-1', kind: 'player'}, {id: 'actor-1', kind: 'npc'}]);
    assert.deepEqual(getEntity(third, 'monster-1'), {id: 'monster-1', kind: 'monster'});
    assert.equal(hasEntity(third, 'actor-1'), true);
    assert.equal(getEntity(third, 'ACTOR-1'), undefined);
    const updated = replaceEntity(third, {id: 'actor-1', kind: 'companion'});
    assert.notEqual(updated, third);
    assert.deepEqual(listEntities(updated), [
      {id: 'player-1', kind: 'player'}, {id: 'actor-1', kind: 'companion'}, {id: 'monster-1', kind: 'monster'},
    ]);
    const removed = removeEntity(updated, 'player-1');
    assert.notEqual(removed, updated);
    assert.deepEqual(listEntities(removed), [{id: 'actor-1', kind: 'companion'}, {id: 'monster-1', kind: 'monster'}]);
    const readded = addEntity(removed, {id: 'player-1', kind: 'player'});
    const exactIds = addEntity(addEntity(createEntityCollection(), {id: 'player-1', kind: 'npc'}),
      {id: ' player-1 ', kind: 'custom'});
    assert.deepEqual(listEntities(exactIds), [{id: 'player-1', kind: 'npc'}, {id: ' player-1 ', kind: 'custom'}]);
    assert.equal(hasEntity(exactIds, ' player-1 '), true);
    assert.deepEqual(listEntities(third), [
      {id: 'player-1', kind: 'player'}, {id: 'actor-1', kind: 'npc'}, {id: 'monster-1', kind: 'monster'},
    ]);
    assert.deepEqual(empty, {entities: []});
    return listEntities(readded);
  };
  const savedNow = Date.now, savedRandom = Math.random;
  const forbidden = () => { throw Error('implicit source access'); };
  let a, b;
  try {
    Date.now = forbidden; Math.random = forbidden;
    a = sequence(); b = sequence();
  } finally { Date.now = savedNow; Math.random = savedRandom; }
  const expected = [{id: 'actor-1', kind: 'companion'}, {id: 'monster-1', kind: 'monster'}, {id: 'player-1', kind: 'player'}];
  assert.deepEqual(a, expected); assert.deepEqual(b, expected);
});

test('EC05–EC06: detached input, immutable enumeration and independently branching snapshots', () => {
  const input = {id: 'actor-1', kind: 'npc'};
  const empty = createEntityCollection();
  assert.notEqual(empty, createEntityCollection());
  const base = addEntity(empty, input);
  assert.notEqual(base, empty);
  const oldEntity = getEntity(base, 'actor-1');
  const replacement = {id: 'actor-1', kind: 'companion'};
  const branchA = replaceEntity(base, replacement);
  const branchB = removeEntity(base, 'actor-1');
  input.id = 'changed'; input.kind = 'changed'; replacement.kind = 'changed';
  assert.equal(Object.isFrozen(input), false); assert.equal(Object.isFrozen(replacement), false);
  assert.deepEqual(base, {entities: [{id: 'actor-1', kind: 'npc'}]});
  assert.deepEqual(branchA, {entities: [{id: 'actor-1', kind: 'companion'}]});
  assert.deepEqual(branchB, {entities: []});
  assert.deepEqual(oldEntity, {id: 'actor-1', kind: 'npc'});
  for (const collection of [empty, base, branchA, branchB]) {
    assert.equal(Object.isFrozen(collection), true);
    assert.deepEqual(Reflect.ownKeys(collection), ['entities']);
    assert.throws(() => { collection.entities = []; }, TypeError);
    assert.throws(() => { collection.store = new Map(); }, TypeError);
    for (const entities of [collection.entities, listEntities(collection)]) {
      assert.equal(Object.isFrozen(entities), true);
      assert.throws(() => entities.push({id: 'injected', kind: 'npc'}), TypeError);
      assert.throws(() => Object.defineProperty(entities, '0', {value: input}), TypeError);
      for (const entity of entities) {
        assert.equal(Object.isFrozen(entity), true);
        assert.throws(() => { entity.kind = 'mutated'; }, TypeError);
      }
    }
  }
  assert.throws(() => { oldEntity.id = 'mutated'; }, TypeError);
  // Structural boundary inputs are validated/detached, never trusted as live storage.
  const externalEntity = {id: 'external', kind: 'npc'};
  const external = {entities: [externalEntity]};
  const listing = listEntities(external), found = getEntity(external, 'external');
  const extended = addEntity(external, {id: 'another', kind: 'player'});
  externalEntity.kind = 'changed'; external.entities.length = 0;
  assert.deepEqual(listing, [{id: 'external', kind: 'npc'}]);
  assert.deepEqual(found, {id: 'external', kind: 'npc'});
  assert.deepEqual(extended, {entities: [{id: 'external', kind: 'npc'}, {id: 'another', kind: 'player'}]});
  assert.equal(Object.isFrozen(found), true);
});

test('EC04–EC06: duplicate, unknown and malformed operations reject atomically through canonical EC03', () => {
  const base = addEntity(createEntityCollection(), {id: 'actor-1', kind: 'npc'});
  assert.throws(() => addEntity(base, {id: 'actor-1', kind: 'monster'}), TypeError);
  assert.throws(() => replaceEntity(base, {id: 'new-id', kind: 'companion'}), TypeError);
  assert.throws(() => removeEntity(base, 'missing'), TypeError);
  let getterCalls = 0;
  const accessor = {id: 'actor-1', get kind() { getterCalls++; return 'npc'; }};
  for (const input of [accessor, {id: 'actor-1', kind: 'npc', state: {}}, {id: 'actor-1'}, null]) {
    for (const operation of [addEntity, replaceEntity]) assert.throws(() => operation(base, input), TypeError);
  }
  for (const id of ['', ' \t', 1, null, undefined, {}]) {
    for (const operation of [getEntity, hasEntity, removeEntity]) assert.throws(() => operation(base, id), TypeError);
  }
  const arrayAccessor = [];
  Object.defineProperty(arrayAccessor, '0', {get() { getterCalls++; return {id: 'x', kind: 'npc'}; }});
  const malformed = [null, [], {}, {entities: null}, {entities: [accessor]},
    {entities: [base.entities[0], base.entities[0]]}, {entities: new Array(1)}, {entities: arrayAccessor},
    {entities: [], state: {}}, Object.create({entities: []}),
    {get entities() { getterCalls++; return []; }},
  ];
  for (const collection of malformed) {
    for (const operation of [
      () => addEntity(collection, {id: 'new', kind: 'npc'}),
      () => replaceEntity(collection, {id: 'actor-1', kind: 'npc'}),
      () => removeEntity(collection, 'actor-1'), () => getEntity(collection, 'actor-1'),
      () => hasEntity(collection, 'actor-1'), () => listEntities(collection),
    ]) assert.throws(operation, TypeError);
  }
  assert.equal(getterCalls, 0);
  assert.deepEqual(base, {entities: [{id: 'actor-1', kind: 'npc'}]});
  assert.deepEqual(replaceEntity(base, {id: 'actor-1', kind: 'companion'}),
    {entities: [{id: 'actor-1', kind: 'companion'}]});
});
