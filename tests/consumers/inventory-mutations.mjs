import test from 'node:test';
import assert from 'node:assert/strict';
import {createInventoryState, addInventoryEntry, removeInventoryEntry, adjustInventoryQuantity} from '@rpg/gameplay';

test('installed root Inventory mutations return reviewable candidates without committing source',()=>{
  const context={items:[{definition:{definitionId:'d',categoryId:null,tagIds:[],rarityId:null,properties:{}},
    stackPolicy:{stackable:true},maxStackQuantity:9}]};
  const state=createInventoryState({inventoryId:'bag',owner:null,entries:[]},context);
  const entry={item:{instanceId:'i',definitionId:'d',properties:{tag:['x']}},quantity:4};
  const added=addInventoryEntry(state,context,entry,{maxEntries:1},{eligible:true});
  assert.deepEqual(added,{status:'accepted',reason:'none',candidate:{inventoryId:'bag',owner:null,entries:[
    {item:{instanceId:'i',definitionId:'d',properties:{tag:['x']}},quantity:4},
  ]}});
  assert.deepEqual(adjustInventoryQuantity(added.candidate,context,'i',3,{eligible:true}).candidate.entries.map(e=>e.quantity),[7]);
  assert.deepEqual(adjustInventoryQuantity(added.candidate,context,'i',-4,{eligible:true}).candidate.entries,[]);
  assert.deepEqual(removeInventoryEntry(added.candidate,context,'i',{eligible:true}).candidate.entries,[]);
  assert.deepEqual(addInventoryEntry(added.candidate,context,entry,{maxEntries:1},{eligible:true}),
    {status:'rejected',reason:'already_present',candidate:null});
  assert.deepEqual(adjustInventoryQuantity(added.candidate,context,'i',1,{eligible:false}),
    {status:'rejected',reason:'ineligible',candidate:null});
  assert.deepEqual(state.entries,[]);
  assert.ok(Object.isFrozen(added));
  assert.throws(()=>added.candidate.entries[0].item.properties.tag.push('bad'),TypeError);
});
