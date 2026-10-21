import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeInventoryEntries,assessInventoryCapacity} from '@rpg/gameplay';

test('installed Inventory complete merge preserves destination and rejects property loss',()=>{
  const context={items:[{definition:{definitionId:'d',categoryId:null,tagIds:[],rarityId:null,properties:{}},
    stackPolicy:{stackable:true},maxStackQuantity:11}]};
  const entry=(instanceId,quantity)=>({item:{instanceId,definitionId:'d',properties:{affix:{values:[2]}}},quantity});
  const state={inventoryId:'bag',owner:null,entries:[entry('source',4),entry('destination',7)]};
  const original=structuredClone(state);
  const result=mergeInventoryEntries(state,context,'source','destination',{eligible:true});
  assert.deepEqual(result,{status:'accepted',reason:'none',candidate:{inventoryId:'bag',owner:null,entries:[
    {item:{instanceId:'destination',definitionId:'d',properties:{affix:{values:[2]}}},quantity:11},
  ]}});
  assert.deepEqual(assessInventoryCapacity(result.candidate,context,{maxEntries:2},1),{fits:true,occupied:1,available:1});
  assert.deepEqual(state,original); assert.ok(Object.isFrozen(result));
  assert.throws(()=>result.candidate.entries[0].item.properties.affix.values.push(3),TypeError);
  state.entries[0].item.properties.affix.values[0]=3;
  assert.deepEqual(result.candidate.entries[0].item.properties.affix.values,[2]);
  assert.deepEqual(mergeInventoryEntries(state,context,'source','destination',{eligible:true}),
    {status:'rejected',reason:'item_incompatible',candidate:null});
});
