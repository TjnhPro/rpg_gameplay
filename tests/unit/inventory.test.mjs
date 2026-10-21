import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as g from '../../dist/index.js';

function fixture() {
  const potion = {definitionId: 'potion', categoryId: 'consumable', tagIds: [], rarityId: null, properties: {}};
  const sword = {...potion, definitionId: 'sword', categoryId: 'weapon'};
  const context = {items: [
    {definition: potion, stackPolicy: {stackable: true}, maxStackQuantity: 20},
    {definition: sword, stackPolicy: {stackable: false}, maxStackQuantity: null},
  ]};
  const state = {inventoryId: ' chest ', owner: {ownerKind: 'test-chest', ownerId: 'c-1'}, entries: [
    {item: {instanceId: 'p-1', definitionId: 'potion', properties: {nested: {values: [1, null]}}}, quantity: 9},
    {item: {instanceId: 's-1', definitionId: 'sword', properties: {}}, quantity: 1},
  ]};
  return {state, context};
}

test('Inventory explicit identity, ownerless empty snapshot and neutral owner', () => {
  const input = {inventoryId: 'empty', owner: null, entries: []};
  assert.deepEqual(g.createInventoryState(input, {items: []}), {inventoryId: 'empty', owner: null, entries: []});
  const {state, context} = fixture();
  const result = g.createInventoryState(state, context);
  assert.equal(result.inventoryId, ' chest ');
  assert.deepEqual(result.owner, {ownerKind: 'test-chest', ownerId: 'c-1'});
  assert.throws(() => g.createInventoryState({...input, inventoryId: '  '}, {items: []}), TypeError);
  assert.throws(() => g.createInventoryState({...input, owner: {ownerKind: '', ownerId: 'c-1'}}, {items: []}), TypeError);
  assert.throws(() => g.createInventoryState({...input, owner: {ownerKind: 'bank', ownerId: ''}}, {items: []}), TypeError);
});

test('Inventory preserves ordered Item snapshots, detached deeply frozen data and deterministic validation', () => {
  const {state, context} = fixture();
  const result = g.createInventoryState(state, context);
  assert.deepEqual(result.entries, [
    {item: {instanceId: 'p-1', definitionId: 'potion', properties: {nested: {values: [1, null]}}}, quantity: 9},
    {item: {instanceId: 's-1', definitionId: 'sword', properties: {}}, quantity: 1},
  ]);
  const second = g.validateInventoryState(result, {items: [...context.items].reverse()});
  assert.deepEqual(second, result);
  assert.notEqual(second, result);
  assert.notEqual(second.entries[0].item.properties.nested, result.entries[0].item.properties.nested);
  for (const value of [result, result.owner, result.entries, result.entries[0], result.entries[0].item,
    result.entries[0].item.properties, result.entries[0].item.properties.nested,
    result.entries[0].item.properties.nested.values]) assert.ok(Object.isFrozen(value));
  assert.throws(() => { result.entries[0].item.properties.nested.values.push(2); }, TypeError);
  state.entries[0].item.properties.nested.values[0] = 99;
  state.owner.ownerId = 'changed';
  state.entries.reverse();
  context.items[0].definition.categoryId = 'changed';
  context.items[0].stackPolicy.stackable = false;
  context.items.length = 0;
  assert.deepEqual(result.entries[0].item.properties.nested.values, [1, null]);
  assert.equal(result.owner.ownerId, 'c-1');
  assert.equal(result.entries[0].item.instanceId, 'p-1');
  assert.equal(Object.isFrozen(state.entries[0]), false);
});

test('Inventory quantity obeys explicit stackability, caps and safe-integer boundaries', () => {
  const {state, context} = fixture();
  for (const quantity of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '9']) {
    assert.throws(() => g.validateInventoryState({...state, entries: [{...state.entries[0], quantity}]}, context), TypeError);
  }
  assert.throws(() => g.validateInventoryState({...state, entries: [{...state.entries[1], quantity: 2}]}, context), /Nonstackable/);
  assert.throws(() => g.validateInventoryState({...state, entries: [{...state.entries[0], quantity: 21}]}, context), /exceeds maximum/);
  const noCap = {items: [{...context.items[0], maxStackQuantity: null}]};
  const large = {...state, entries: [{...state.entries[0], quantity: Number.MAX_SAFE_INTEGER}]};
  assert.equal(g.validateInventoryState(large, noCap).entries[0].quantity, Number.MAX_SAFE_INTEGER);
  for (const maxStackQuantity of [0, 1.5, undefined, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => g.validateInventoryState(state,
      {items: [{...context.items[0], maxStackQuantity}]}), TypeError);
  }
  assert.equal(state.entries[0].quantity, 9);
});

test('Inventory requires complete canonical Item context and unique membership keys', () => {
  const {state, context} = fixture();
  assert.throws(() => g.validateInventoryState(state, {items: []}), /Unresolved/);
  const mismatch = {...state.entries[0].item, definitionId: 'missing'};
  assert.throws(() => g.validateInventoryState({...state, entries: [{item: mismatch, quantity: 1}]}, context), /Unresolved/);
  assert.throws(() => g.validateInventoryState(state, {items: [...context.items, context.items[0]]}), /Duplicate.*context/);
  assert.throws(() => g.validateInventoryState(state, {items: [...context.items,
    {...context.items[0], definition: {...context.items[0].definition, categoryId: 'conflict'}}]}), /Duplicate.*context/);
  const duplicate = {...state.entries[1], item: {...state.entries[1].item, instanceId: 'p-1'}};
  assert.throws(() => g.validateInventoryState({...state, entries: [state.entries[0], duplicate]}, context), /Duplicate.*instanceId/);
  assert.throws(() => g.validateInventoryState(state, {items: [{...context.items[0],
    definition: {definitionId: 'potion'}}]}), /Item fields/);
  assert.throws(() => g.validateInventoryState(state, {items: [{...context.items[0], stackPolicy: {stackable: 1}}]}), TypeError);
  // Unused context definitions are still fully validated.
  assert.throws(() => g.validateInventoryState({...state, entries: []},
    {items: [{...context.items[0], stackPolicy: {stackable: true, extra: 1}}]}), TypeError);
});

test('Inventory rejects hostile closed shapes and delegates nested Item safety without invoking getters', () => {
  const {state, context} = fixture();
  let calls = 0;
  const accessor = {get inventoryId() { calls++; return 'bad'; }, owner: null, entries: []};
  const arrayAccessor = [];
  Object.defineProperty(arrayAccessor, '0', {get() { calls++; return state.entries[0]; }});
  for (const input of [accessor, {...state, extra: true}, {...state, [Symbol('bad')]: 1},
    Object.assign(Object.create({inherited: 1}), state), {...state, entries: arrayAccessor},
    {...state, entries: new Array(1)}, {...state, owner: {...state.owner, entityId: 'no'}},
    {...state, entries: [{...state.entries[0], slot: 0}]}]) {
    assert.throws(() => g.validateInventoryState(input, context), TypeError);
  }
  const cycle = {}; cycle.self = cycle;
  const itemAccessor = {...state.entries[0].item};
  Object.defineProperty(itemAccessor, 'definitionId', {get() { calls++; return 'potion'; }});
  assert.throws(() => g.validateInventoryState({...state, entries: [{item: itemAccessor, quantity: 1}]}, context), TypeError);
  for (const properties of [cycle, {get value() { calls++; return 1; }}, {[Symbol('bad')]: 1}]) {
    assert.throws(() => g.validateInventoryState({...state, entries: [{quantity: 1,
      item: {...state.entries[0].item, properties}}]}, context), TypeError);
  }
  assert.equal(calls, 0);
  const ownKeys = JSON.parse('{"__proto__":{"nested":1},"constructor":2}');
  const safe = g.validateInventoryState({...state, entries: [{quantity: 1,
    item: {...state.entries[0].item, properties: ownKeys}}]}, context);
  assert.deepEqual(safe.entries[0].item.properties, ownKeys);
  assert.equal(Object.getPrototypeOf(safe.entries[0].item.properties), Object.prototype);
});

test('Inventory is optional, depends only on Item, and leaves Item-only composition intact', () => {
  const declarations = JSON.parse(readFileSync(new URL('../../harness/modules.json', import.meta.url))).modules;
  let registry = g.createModuleRegistry();
  for (const declaration of declarations) registry = g.registerModule(registry, declaration);
  assert.deepEqual(declarations.find(value => value.id === 'inventory'),
    {id: 'inventory', optional: true, dependencies: ['item']});
  assert.deepEqual(g.composeModules(registry, g.configureModules(registry)).moduleIds, []);
  assert.deepEqual(g.composeModules(registry, g.configureModules(registry, {enable: ['item', 'inventory']})).moduleIds,
    ['item', 'inventory']);
  assert.deepEqual(g.composeModules(registry, g.configureModules(registry, {enable: ['item']})).moduleIds, ['item']);
  assert.throws(() => g.composeModules(registry, g.configureModules(registry, {enable: ['inventory']})), /dependency/);
});
