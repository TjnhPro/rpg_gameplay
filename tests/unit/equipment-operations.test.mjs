import test from 'node:test';
import assert from 'node:assert/strict';
import {equipEquipmentItem,unequipEquipmentItem,replaceEquipmentItem,validateEquipmentState,
 getEquippedEntryBySlot,hasEquippedItem,assessEquipmentAdmission} from '../../dist/index.js';

function fixture() {
 const context={items:[{definition:{definitionId:'gear',categoryId:null,tagIds:[],rarityId:null,properties:{defaultOnly:9}}}]};
 const item=instanceId=>({instanceId,definitionId:'gear',properties:{gem:{values:[2]}}});
 const state={equipmentId:' Gear ',owner:{ownerKind:'companion',ownerId:' C '},entries:[
  {item:item('amulet'),slotIds:['neck']},{item:item('old'),slotIds:['left','right']},{item:item('ring'),slotIds:['ring']},
 ]};
 return {context,item,state};
}
function frozen(value) {
 if(value!==null&&typeof value==='object'){assert.ok(Object.isFrozen(value));for(const child of Object.values(value))frozen(child);}
}
function accepted(result,context) {
 assert.equal(result.status,'accepted');assert.equal(result.reason,'none');
 assert.deepEqual(Object.keys(result),['status','reason','candidate','released']);frozen(result);
 assert.deepEqual(validateEquipmentState(result.candidate,context),result.candidate);
 return result.candidate;
}
function rejected(result,reason) {
 assert.deepEqual(result,{status:'rejected',reason,candidate:null,released:null});frozen(result);
}

test('Equipment equip appends exact canonical snapshots and delegates all denial precedence to admission',()=>{
 const {state,context,item}=fixture();
 for(const owner of [null,{ownerKind:'monster',ownerId:'m'},state.owner]) {
  const empty={equipmentId:' Gear ',owner,entries:[]},target=item('sword'),slots=['weapon_main'];
  const result=equipEquipmentItem(empty,context,target,slots,{eligible:true});
  const candidate=accepted(result,context);
  assert.deepEqual(result,{status:'accepted',reason:'none',candidate:{equipmentId:' Gear ',owner,entries:[
   {item:{instanceId:'sword',definitionId:'gear',properties:{gem:{values:[2]}}},slotIds:['weapon_main']},
  ]},released:null});
  const appended=equipEquipmentItem(candidate,context,item('second'),['other_left','other_right'],{eligible:true});
  accepted(appended,context);
  assert.deepEqual(appended.candidate.entries,[
   {item:{instanceId:'sword',definitionId:'gear',properties:{gem:{values:[2]}}},slotIds:['weapon_main']},
   {item:{instanceId:'second',definitionId:'gear',properties:{gem:{values:[2]}}},slotIds:['other_left','other_right']},
  ]);
  assert.equal(appended.released,null);assert.deepEqual(empty.entries,[]);assert.equal(Object.isFrozen(target),false);
 }
 for(const [target,slots,eligible,reason] of [
  [item('old'),['ring'],false,'already_equipped'],[item('old'),['free'],true,'already_equipped'],
  [item('new'),['free','right'],false,'slot_occupied'],[item('new'),['left','free'],true,'slot_occupied'],
  [item('new'),['free'],false,'ineligible'],
 ]) {
  assert.deepEqual(assessEquipmentAdmission(state,context,target,slots,{eligible}),{allowed:false,reason});
  const first=equipEquipmentItem(state,context,target,slots,{eligible});rejected(first,reason);
  assert.notEqual(first,equipEquipmentItem(state,context,target,slots,{eligible}));
 }
});

test('Equipment unequip releases the full detached Item and every occupied slot while preserving other order',()=>{
 const {state,context}=fixture(),before=structuredClone(state);
 const result=unequipEquipmentItem(state,context,'old',{eligible:true}),candidate=accepted(result,context);
 assert.deepEqual(result,{status:'accepted',reason:'none',candidate:{equipmentId:' Gear ',owner:{ownerKind:'companion',ownerId:' C '},entries:[
  {item:{instanceId:'amulet',definitionId:'gear',properties:{gem:{values:[2]}}},slotIds:['neck']},
  {item:{instanceId:'ring',definitionId:'gear',properties:{gem:{values:[2]}}},slotIds:['ring']},
 ]},released:{instanceId:'old',definitionId:'gear',properties:{gem:{values:[2]}}}});
 assert.equal(getEquippedEntryBySlot(candidate,context,'left'),null);assert.equal(getEquippedEntryBySlot(candidate,context,'right'),null);
 assert.equal(hasEquippedItem(candidate,context,'old'),false);
 assert.notEqual(result.released,state.entries[1].item);
 for(const [key,eligible,reason] of [['old',false,'ineligible'],['missing',false,'not_equipped'],[' Old ',true,'not_equipped']]) {
  rejected(unequipEquipmentItem(state,context,key,{eligible}),reason);
 }
 assert.deepEqual(state,before);
});

test('Equipment replacement preserves the original position, returns old Item and cannot steal other occupancy',()=>{
 const {state,context,item}=fixture(),before=structuredClone(state);
 for(const slots of [['left','right'],['right']]) {
  const result=replaceEquipmentItem(state,context,'old',item('new'),slots,{eligible:true}),candidate=accepted(result,context);
  assert.deepEqual(result,{status:'accepted',reason:'none',candidate:{equipmentId:' Gear ',owner:{ownerKind:'companion',ownerId:' C '},entries:[
   {item:{instanceId:'amulet',definitionId:'gear',properties:{gem:{values:[2]}}},slotIds:['neck']},
   {item:{instanceId:'new',definitionId:'gear',properties:{gem:{values:[2]}}},slotIds:slots.length===1?['right']:['left','right']},
   {item:{instanceId:'ring',definitionId:'gear',properties:{gem:{values:[2]}}},slotIds:['ring']},
  ]},released:{instanceId:'old',definitionId:'gear',properties:{gem:{values:[2]}}}});
  assert.equal(getEquippedEntryBySlot(candidate,context,'left')===null,slots.length===1);
  assert.equal(hasEquippedItem(candidate,context,'old'),false);assert.equal(hasEquippedItem(candidate,context,'new'),true);
 }
 for(const [key,target,slots,eligible,reason] of [
  ['missing',item('missing'),['ring'],false,'not_equipped'],
  ['old',{...item('old'),properties:{changed:9}},['ring'],false,'same_instance'],
  ['old',item('ring'),['ring'],false,'already_equipped'],
  ['old',item('new'),['right','ring'],false,'slot_occupied'],
  ['old',item('new'),['ring','right'],true,'slot_occupied'],
  ['old',item('new'),['right'],false,'ineligible'],
 ])rejected(replaceEquipmentItem(state,context,key,target,slots,{eligible}),reason);
 assert.deepEqual(state,before);
});

test('All Equipment operations validate full structure before any rejection and never execute getters',()=>{
 const {state,context,item}=fixture();let reads=0;
 const actions=(s,c,a)=>[
  ()=>equipEquipmentItem(s,c,item('old'),['left'],a),()=>unequipEquipmentItem(s,c,'missing',a),
  ()=>replaceEquipmentItem(s,c,'missing',item('new'),['left'],a),
 ];
 for(const s of [{...state,entries:[state.entries[0],state.entries[0]]},
  {...state,entries:[state.entries[0],{...state.entries[1],slotIds:['neck']}]},
  {...state,entries:[state.entries[0],{...state.entries[1],item:{...item('old'),properties:{bad:Infinity}}}]}]) {
  for(const action of actions(s,context,{eligible:false}))assert.throws(action,TypeError);
 }
 for(const c of [{items:[]},{items:[...context.items,...context.items]},
  {items:[...context.items,{definition:{...context.items[0].definition,definitionId:'unused',properties:{bad:undefined}}}]}]) {
  for(const action of actions(state,c,{eligible:false}))assert.throws(action,TypeError);
 }
 const cycle={};cycle.self=cycle;
 for(const target of [{...item('old'),definitionId:'missing'},{...item('old'),instanceId:''},
  {...item('old'),properties:{bad:Infinity}},{...item('old'),properties:cycle},
  {...item('old'),get definitionId(){reads++;return 'gear';}},
  {...item('old'),properties:{get bad(){reads++;return 2;}}}]) {
  assert.throws(()=>equipEquipmentItem(state,context,target,['left'],{eligible:false}),TypeError);
  assert.throws(()=>replaceEquipmentItem(state,context,'missing',target,['left'],{eligible:false}),TypeError);
 }
 const accessor=[];Object.defineProperty(accessor,'0',{get(){reads++;return 'left';}});
 for(const slots of [[],['left','left'],[''],[' '],new Array(1),accessor,Object.assign(['left'],{extra:true})]) {
  assert.throws(()=>equipEquipmentItem(state,context,item('old'),slots,{eligible:false}),TypeError);
  assert.throws(()=>replaceEquipmentItem(state,context,'missing',item('new'),slots,{eligible:false}),TypeError);
 }
 for(const admission of [undefined,null,{}, {eligible:1},{eligible:true,extra:1},
  {eligible:false,[Symbol('extra')]:1},Object.create({eligible:false}),{get eligible(){reads++;return false;}}]) {
  for(const action of actions(state,context,admission))assert.throws(action,TypeError);
 }
 for(const key of ['', ' ', 3, null]) {
  assert.throws(()=>unequipEquipmentItem(state,context,key,{eligible:false}),TypeError);
  assert.throws(()=>replaceEquipmentItem(state,context,key,item('new'),['free'],{eligible:false}),TypeError);
 }
 assert.equal(reads,0);
});

test('Equipment candidates and released Items are deterministic detached immutable data; callers remain mutable',()=>{
 const {state,context,item}=fixture(),target=item('new'),slots=['right'],before=structuredClone(state),targetBefore=structuredClone(target);
 const calls=[()=>equipEquipmentItem(state,context,target,['free'],{eligible:true}),
  ()=>unequipEquipmentItem(state,context,'old',{eligible:true}),
  ()=>replaceEquipmentItem(state,context,'old',target,slots,{eligible:true})];
 const results=calls.map(call=>{const first=call(),second=call();accepted(first,context);
  assert.deepEqual(first,second);assert.notEqual(first,second);assert.notEqual(first.candidate,second.candidate);
  if(first.released){assert.notEqual(first.released,second.released);assert.notEqual(first.released.properties.gem.values,state.entries[1].item.properties.gem.values);}
  assert.notEqual(first.candidate.entries[0].item.properties.gem.values,state.entries[0].item.properties.gem.values);
  assert.throws(()=>first.candidate.entries.push({}),TypeError);
  assert.throws(()=>{first.candidate.owner.ownerId='bad';},TypeError);
  if(first.released)assert.throws(()=>first.released.properties.gem.values.push(9),TypeError);
  return first;});
 assert.deepEqual(state,before);assert.deepEqual(target,targetBefore);assert.deepEqual(slots,['right']);
 assert.equal(Object.isFrozen(state.entries[1].item.properties.gem.values),false);assert.equal(Object.isFrozen(context.items[0].definition),false);
 const saved=structuredClone(results);
 state.entries[0].item.properties.gem.values[0]=88;state.entries[1].item.properties.gem.values[0]=99;
 target.properties.gem.values[0]=77;slots.push('later');state.owner.ownerId='changed';
 assert.deepEqual(results,saved);
});
