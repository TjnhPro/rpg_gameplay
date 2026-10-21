import test from 'node:test';
import assert from 'node:assert/strict';
import {createItemDefinition,createItemInstance,createEquipmentState,validateEquipmentState,
 createInventoryState} from '@rpg/gameplay';

test('installed root Equipment preserves canonical Item data and independent slot storage',()=>{
 const definition=createItemDefinition({definitionId:'blade'},
  {categoryId:'weapon',tagIds:[],rarityId:null,properties:{defaultOnly:9}});
 const initial={instanceId:'blade-1',properties:{affix:{values:[2]}}};
 const item=createItemInstance(definition,initial),context={items:[{definition}]};
 const input={equipmentId:'gear',owner:{ownerKind:'companion',ownerId:'c'},entries:[{item,slotIds:['left','right']}]};
 const output=createEquipmentState(input,context);
 assert.deepEqual(output,{equipmentId:'gear',owner:{ownerKind:'companion',ownerId:'c'},entries:[
  {item:{instanceId:'blade-1',definitionId:'blade',properties:{affix:{values:[2]}}},slotIds:['left','right']},
 ]});
 assert.deepEqual(validateEquipmentState(output,context),output);
 const empty=createEquipmentState({equipmentId:'empty',owner:null,entries:[]},{items:[]});
 assert.deepEqual(empty,{equipmentId:'empty',owner:null,entries:[]});
 const inventory=createInventoryState({inventoryId:'bag',owner:null,entries:[{item,quantity:1}]},
  {items:[{definition,stackPolicy:{stackable:false},maxStackQuantity:null}]});
 assert.deepEqual(inventory.entries[0].item,output.entries[0].item);
 assert.notEqual(inventory.entries[0].item,output.entries[0].item);
 assert.deepEqual(Object.keys(output.entries[0]),['item','slotIds']);
 assert.equal(Object.hasOwn(output.entries[0].item.properties,'defaultOnly'),false);
 initial.properties.affix.values[0]=99;input.entries[0].slotIds.push('later');input.owner.ownerId='changed';
 assert.deepEqual(output.entries[0].slotIds,['left','right']);
 assert.deepEqual(output.entries[0].item.properties.affix.values,[2]);assert.equal(output.owner.ownerId,'c');
 assert.ok(Object.isFrozen(output));assert.ok(Object.isFrozen(output.entries[0].item.properties.affix.values));
 assert.throws(()=>output.entries[0].slotIds.push('bad'),TypeError);
 assert.throws(()=>validateEquipmentState({...input,entries:[{item,slotIds:['x']},{item:{...item,instanceId:'b'},slotIds:['x']}]},context),TypeError);
});
