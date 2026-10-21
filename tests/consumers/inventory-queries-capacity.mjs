import test from 'node:test';
import assert from 'node:assert/strict';
import {createInventoryState, listInventoryEntries, getInventoryEntry,
  hasInventoryItem, assessInventoryCapacity} from '@rpg/gameplay';

test('installed Inventory root queries and capacity preserve canonical snapshots', () => {
  const context = {items: [{definition: {definitionId:'d',categoryId:null,tagIds:[],rarityId:null,properties:{}},
    stackPolicy:{stackable:true},maxStackQuantity:null}]};
  const state = createInventoryState({inventoryId:'bag',owner:null,entries:[
    {item:{instanceId:'a',definitionId:'d',properties:{nested:[1]}},quantity:9},
    {item:{instanceId:'b',definitionId:'d',properties:{}},quantity:1},
  ]},context);
  const list = listInventoryEntries(state,context);
  assert.notEqual(list,state.entries);
  assert.deepEqual(list.map(entry=>entry.item.instanceId),['a','b']);
  assert.equal(getInventoryEntry(state,context,'a').quantity,9);
  assert.equal(getInventoryEntry(state,context,'A'),null);
  assert.equal(hasInventoryItem(state,context,'b'),true);
  assert.deepEqual(assessInventoryCapacity(state,context,{maxEntries:3},1),{fits:true,occupied:2,available:1});
  assert.deepEqual(assessInventoryCapacity(state,context,{maxEntries:3},2),{fits:false,occupied:2,available:1});
  assert.deepEqual(assessInventoryCapacity(state,context,{maxEntries:null},0),{fits:true,occupied:2,available:null});
  assert.throws(()=>list[0].item.properties.nested.push(2),TypeError);
  assert.throws(()=>listInventoryEntries({...state,entries:[state.entries[0],state.entries[0]]},context),TypeError);
});
