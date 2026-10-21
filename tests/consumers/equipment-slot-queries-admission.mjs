import test from 'node:test';
import assert from 'node:assert/strict';
import {createItemDefinition,createItemInstance,createEquipmentState,createInventoryState,
 listEquippedEntries,getEquippedEntryBySlot,hasEquippedItem,assessEquipmentAdmission} from '@rpg/gameplay';

test('installed root Equipment queries and advisory admission compose with canonical Items without moving storage',()=>{
 const definition=createItemDefinition({definitionId:'blade'},{categoryId:null,tagIds:[],rarityId:null,properties:{}});
 const item=createItemInstance(definition,{instanceId:'blade-1',properties:{power:2}}),context={items:[{definition}]};
 const equipment=createEquipmentState({equipmentId:'gear',owner:null,entries:[]},context);
 const inventory=createInventoryState({inventoryId:'bag',owner:null,entries:[{item,quantity:1}]},
  {items:[{definition,stackPolicy:{stackable:false},maxStackQuantity:null}]});
 assert.deepEqual(listEquippedEntries(equipment,context),[]);
 assert.deepEqual(assessEquipmentAdmission(equipment,context,inventory.entries[0].item,['left','right'],{eligible:true}),{allowed:true,reason:'none'});
 assert.equal(hasEquippedItem(equipment,context,'blade-1'),false);assert.equal(getEquippedEntryBySlot(equipment,context,'left'),null);
 const loaded=createEquipmentState({...equipment,entries:[{item,slotIds:['left','right']}]},context);
 const expected={item:{instanceId:'blade-1',definitionId:'blade',properties:{power:2}},slotIds:['left','right']};
 assert.deepEqual(listEquippedEntries(loaded,context),[expected]);
 assert.deepEqual(getEquippedEntryBySlot(loaded,context,'right'),expected);
 assert.equal(hasEquippedItem(loaded,context,'blade-1'),true);
 assert.deepEqual(assessEquipmentAdmission(loaded,context,item,['left'],{eligible:false}),{allowed:false,reason:'already_equipped'});
 assert.deepEqual(assessEquipmentAdmission(loaded,context,{...item,instanceId:'new'},['free','right'],{eligible:false}),{allowed:false,reason:'slot_occupied'});
 assert.deepEqual(assessEquipmentAdmission(loaded,context,{...item,instanceId:'new'},['free'],{eligible:false}),{allowed:false,reason:'ineligible'});
 assert.throws(()=>assessEquipmentAdmission(loaded,context,{...item,properties:{bad:Infinity}},['free'],{eligible:false}),TypeError);
 const entry=getEquippedEntryBySlot(loaded,context,'left');assert.ok(Object.isFrozen(entry.item.properties));
 assert.notEqual(entry.item,loaded.entries[0].item);assert.throws(()=>entry.slotIds.push('x'),TypeError);
 assert.deepEqual(inventory.entries,[{item:{instanceId:'blade-1',definitionId:'blade',properties:{power:2}},quantity:1}]);
 assert.deepEqual(equipment.entries,[]);
});
