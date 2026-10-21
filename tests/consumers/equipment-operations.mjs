import test from 'node:test';
import assert from 'node:assert/strict';
import {createItemDefinition,createItemInstance,createEquipmentState,equipEquipmentItem,unequipEquipmentItem,
 replaceEquipmentItem,validateEquipmentState,getEquippedEntryBySlot} from '@rpg/gameplay';

test('installed root Equipment operations produce safe complete candidates and return released Items without commits',()=>{
 const definition=createItemDefinition({definitionId:'blade'},{categoryId:null,tagIds:[],rarityId:null,properties:{}});
 const context={items:[{definition}]};
 const old=createItemInstance(definition,{instanceId:'old',properties:{rank:1}});
 const replacement=createItemInstance(definition,{instanceId:'new',properties:{rank:2}});
 const initial=createEquipmentState({equipmentId:'gear',owner:null,entries:[]},context);
 const equipped=equipEquipmentItem(initial,context,old,['left','right'],{eligible:true});
 assert.deepEqual(equipped,{status:'accepted',reason:'none',candidate:{equipmentId:'gear',owner:null,entries:[
  {item:{instanceId:'old',definitionId:'blade',properties:{rank:1}},slotIds:['left','right']},
 ]},released:null});
 const replaced=replaceEquipmentItem(equipped.candidate,context,'old',replacement,['right'],{eligible:true});
 assert.deepEqual(replaced,{status:'accepted',reason:'none',candidate:{equipmentId:'gear',owner:null,entries:[
  {item:{instanceId:'new',definitionId:'blade',properties:{rank:2}},slotIds:['right']},
 ]},released:{instanceId:'old',definitionId:'blade',properties:{rank:1}}});
 assert.equal(getEquippedEntryBySlot(replaced.candidate,context,'left'),null);
 assert.notEqual(replaced.released,old);assert.ok(Object.isFrozen(replaced.released.properties));
 const removed=unequipEquipmentItem(replaced.candidate,context,'new',{eligible:true});
 assert.deepEqual(removed,{status:'accepted',reason:'none',candidate:{equipmentId:'gear',owner:null,entries:[]},
  released:{instanceId:'new',definitionId:'blade',properties:{rank:2}}});
 for(const result of [equipped,replaced,removed]) {
  assert.ok(Object.isFrozen(result));assert.deepEqual(validateEquipmentState(result.candidate,context),result.candidate);
 }
 assert.deepEqual(initial.entries,[]);assert.deepEqual(equipped.candidate.entries[0].slotIds,['left','right']);
 assert.deepEqual(equipEquipmentItem(replaced.candidate,context,old,['free','right'],{eligible:false}),
  {status:'rejected',reason:'slot_occupied',candidate:null,released:null});
 assert.deepEqual(replaceEquipmentItem(equipped.candidate,context,'old',old,['left'],{eligible:false}),
  {status:'rejected',reason:'same_instance',candidate:null,released:null});
 assert.throws(()=>replaceEquipmentItem(initial,context,'missing',{...old,properties:{bad:Infinity}},['left'],{eligible:false}),TypeError);
});
