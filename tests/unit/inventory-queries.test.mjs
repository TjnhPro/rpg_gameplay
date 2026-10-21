import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../../dist/index.js';

function fixture() {
  const definition = {definitionId: 'd', categoryId: null, tagIds: [], rarityId: null, properties: {}};
  const context = {items: [{definition, stackPolicy: {stackable: true}, maxStackQuantity: null}]};
  const state = {inventoryId: 'bag', owner: null, entries: [
    {item: {definitionId: 'd', instanceId: 'Kiếm', properties: {nested: [1]}}, quantity: 9},
    {item: {definitionId: 'd', instanceId: 'kiếm', properties: {}}, quantity: 1},
  ]};
  return {state, context};
}

test('Inventory queries preserve exact Unicode IDs, order and detached immutable snapshots', () => {
  const {state, context} = fixture();
  const empty = {...state, entries: []};
  assert.deepEqual(g.listInventoryEntries(empty, context), []);
  assert.equal(g.getInventoryEntry(empty, context, 'missing'), null);
  assert.equal(g.hasInventoryItem(empty, context, 'missing'), false);
  const list = g.listInventoryEntries(state, context);
  const entry = g.getInventoryEntry(state, context, 'Kiếm');
  assert.deepEqual(list, [
    {item: {definitionId: 'd', instanceId: 'Kiếm', properties: {nested: [1]}}, quantity: 9},
    {item: {definitionId: 'd', instanceId: 'kiếm', properties: {}}, quantity: 1},
  ]);
  assert.deepEqual(entry, list[0]);
  assert.notEqual(entry, list[0]);
  assert.equal(g.getInventoryEntry(state, context, 'kiếm').quantity, 1);
  assert.equal(g.hasInventoryItem(state, context, 'KIẾM'), false);
  assert.equal(g.hasInventoryItem(state, context, 'Kiếm'), true);
  assert.equal(g.hasInventoryItem(state, context, ' Kiếm'), false);
  assert.equal(g.hasInventoryItem(state, context, 'Kie\u0302\u0301m'), false);
  state.entries[0].item.properties.nested[0] = 99;
  state.entries.reverse();
  assert.deepEqual(entry.item.properties.nested, [1]);
  assert.equal(list[0].item.instanceId, 'Kiếm');
  for (const value of [list, list[0], entry, entry.item, entry.item.properties, entry.item.properties.nested]) {
    assert.ok(Object.isFrozen(value));
  }
  assert.throws(() => list.push(entry), TypeError);
  assert.throws(() => {entry.item.properties.nested[0] = 2;}, TypeError);
  assert.throws(() => g.getInventoryEntry(empty, context, ' '), TypeError);
});

test('Inventory capacity counts entries, handles zero/unbounded and never invalidates over-capacity state', () => {
  const {state, context} = fixture();
  const assess = (maxEntries, additional) => g.assessInventoryCapacity(state, context, {maxEntries}, additional);
  assert.deepEqual(assess(3, 1), {fits: true, occupied: 2, available: 1});
  assert.deepEqual(assess(3, 2), {fits: false, occupied: 2, available: 1});
  assert.deepEqual(assess(2, 0), {fits: true, occupied: 2, available: 0});
  assert.deepEqual(assess(2, 1), {fits: false, occupied: 2, available: 0});
  assert.deepEqual(assess(0, 0), {fits: false, occupied: 2, available: 0});
  assert.deepEqual(assess(1, 0), {fits: false, occupied: 2, available: 0});
  assert.deepEqual(assess(null, Number.MAX_SAFE_INTEGER), {fits: true, occupied: 2, available: null});
  assert.deepEqual(assess(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
    {fits: false, occupied: 2, available: Number.MAX_SAFE_INTEGER - 2});
  assert.equal(assess(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 2).fits, true);
  assert.deepEqual(g.assessInventoryCapacity({...state, entries: []}, context, {maxEntries: 0}, 0),
    {fits: true, occupied: 0, available: 0});
  const result = assess(3, 1);
  assert.ok(Object.isFrozen(result));
  assert.throws(() => {result.available = 20;}, TypeError);
  assert.equal(g.validateInventoryState(state, context).entries[0].quantity, 9);
  assert.deepEqual(Object.keys(state), ['inventoryId', 'owner', 'entries']);
});

test('Inventory queries and capacity always validate complete canonical state before answering', () => {
  const {state, context} = fixture();
  const operations = [
    (s,c) => g.getInventoryEntry(s,c,'missing'),
    (s,c) => g.listInventoryEntries(s,c),
    (s,c) => g.hasInventoryItem(s,c,'missing'),
    (s,c) => g.assessInventoryCapacity(s,c,{maxEntries:null},0),
  ];
  const duplicate = {...state, entries: [state.entries[0], state.entries[0]]};
  for (const operation of operations) {
    assert.throws(() => operation({inventoryId:'partial'}, context), TypeError);
    assert.throws(() => operation(state, {items:[]}), /Unresolved/);
    assert.throws(() => operation(duplicate, context), /Duplicate.*instanceId/);
  }
});

test('Inventory capacity rejects malformed policies and unsafe counts without evaluating getters', () => {
  const {state, context} = fixture();
  let reads = 0;
  for (const policy of [null, {}, {maxEntries:undefined}, {maxEntries:1,slot:0},
    {get maxEntries(){reads++;return 3;}}, {maxEntries:3,[Symbol('bad')]:true},
    Object.assign(Object.create({bad:true}),{maxEntries:3})]) {
    assert.throws(() => g.assessInventoryCapacity(state,context,policy,0),TypeError);
  }
  for (const value of [-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER+1, '3', undefined]) {
    assert.throws(() => g.assessInventoryCapacity(state,context,{maxEntries:value},0),TypeError);
    assert.throws(() => g.assessInventoryCapacity(state,context,{maxEntries:null},value),TypeError);
  }
  assert.equal(reads,0);
  assert.deepEqual(g.assessInventoryCapacity(state,context,{maxEntries:3},0),
    {fits:true,occupied:2,available:1});
});
