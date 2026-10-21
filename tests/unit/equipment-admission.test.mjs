import test from 'node:test';
import assert from 'node:assert/strict';
import {listEquippedEntries, getEquippedEntryBySlot, hasEquippedItem, assessEquipmentAdmission} from '../../dist/index.js';

function fixture() {
 const definition={definitionId:'ring',categoryId:null,tagIds:[],rarityId:null,properties:{}};
 const item=instanceId=>({instanceId,definitionId:'ring',properties:{gem:{values:[2]}}});
 const state={equipmentId:'gear',owner:null,entries:[
  {item:item(' First '),slotIds:['Right','Left']},{item:item('second'),slotIds:['ring']},
 ]};
 return {definition,context:{items:[{definition}]},item,state};
}
function frozen(value) {
 if(value!==null&&typeof value==='object'){assert.ok(Object.isFrozen(value));for(const child of Object.values(value))frozen(child);}
}

test('Equipment queries preserve exact ordered whole entries with deep isolation and no implicit membership',()=>{
 const {state,context}=fixture(),before=structuredClone(state);
 const expected=[
  {item:{instanceId:' First ',definitionId:'ring',properties:{gem:{values:[2]}}},slotIds:['Right','Left']},
  {item:{instanceId:'second',definitionId:'ring',properties:{gem:{values:[2]}}},slotIds:['ring']},
 ];
 assert.deepEqual(listEquippedEntries({...state,entries:[]},context),[]);
 const listed=listEquippedEntries(state,context),again=listEquippedEntries(state,context);
 assert.deepEqual(listed,expected);assert.notEqual(listed,again);assert.notEqual(listed[0],again[0]);frozen(listed);
 const right=getEquippedEntryBySlot(state,context,'Right'),left=getEquippedEntryBySlot(state,context,'Left');
 assert.deepEqual(right,expected[0]);assert.deepEqual(left,expected[0]);assert.notEqual(left,right);frozen(left);frozen(right);
 assert.equal(getEquippedEntryBySlot(state,context,'right'),null);assert.equal(getEquippedEntryBySlot(state,context,' Right '),null);
 assert.equal(hasEquippedItem(state,context,' First '),true);
 for(const missing of ['First','ring','Right','third'])assert.equal(hasEquippedItem(state,context,missing),false);
 assert.notEqual(listed[0].item.properties.gem.values,state.entries[0].item.properties.gem.values);
 assert.notEqual(left.item.properties.gem.values,state.entries[0].item.properties.gem.values);
 assert.throws(()=>listed.push(expected[0]),TypeError);assert.throws(()=>left.slotIds.push('bad'),TypeError);
 assert.throws(()=>right.item.properties.gem.values.push(3),TypeError);
 assert.deepEqual(state,before);assert.equal(Object.isFrozen(state.entries[0].item.properties.gem.values),false);
 state.entries[0].item.properties.gem.values[0]=99;state.entries[0].slotIds.push('later');
 assert.deepEqual(listed,expected);assert.deepEqual(left,expected[0]);
 for(const key of ['', ' ',3,null]) {
  assert.throws(()=>getEquippedEntryBySlot(before,context,key),TypeError);
  assert.throws(()=>hasEquippedItem(before,context,key),TypeError);
 }
});

test('Equipment admission checks complete multi-slot collisions and exact deterministic denial priority without writes',()=>{
 const {state,context,item,definition}=fixture(),before=structuredClone(state);
 const assess=(target,slots,eligible,s=state,c=context)=>assessEquipmentAdmission(s,c,target,slots,{eligible});
 const cases=[
  [item(' First '),['Right'],false,{allowed:false,reason:'already_equipped'}],
  [item(' First '),['free'],true,{allowed:false,reason:'already_equipped'}],
  [item('third'),['free','Left'],false,{allowed:false,reason:'slot_occupied'}],
  [item('third'),['Left','free'],true,{allowed:false,reason:'slot_occupied'}],
  [item('third'),['free'],false,{allowed:false,reason:'ineligible'}],
  [item('third'),['free'],true,{allowed:true,reason:'none'}],
  [item('third'),['newLeft','newRight'],true,{allowed:true,reason:'none'}],
 ];
 for(const [target,slots,eligible,expected] of cases) {
  const targetBefore=structuredClone(target),slotsBefore=slots.slice();
  const first=assess(target,slots,eligible),second=assess(target,slots,eligible);
  assert.deepEqual(first,expected);assert.notEqual(first,second);frozen(first);
  assert.deepEqual(Object.keys(first),['allowed','reason']);assert.throws(()=>{first.allowed=!first.allowed;},TypeError);
  assert.deepEqual(target,targetBefore);assert.deepEqual(slots,slotsBefore);assert.equal(Object.isFrozen(slots),false);
 }
 for(const owner of [null,{ownerKind:'monster',ownerId:'m'},{ownerKind:'companion',ownerId:'c'}]) {
  assert.deepEqual(assess(item('third'),['x'],true,{...state,owner,entries:[]}),{allowed:true,reason:'none'});
 }
 const extra={definition:{...definition,definitionId:'unused'}};
 assert.deepEqual(assess(item('third'),['ring'],false,state,{items:[extra,...context.items]}),{allowed:false,reason:'slot_occupied'});
 assert.deepEqual(assess(item('third'),['ring'],false,state,{items:[...context.items,extra]}),{allowed:false,reason:'slot_occupied'});
 assert.deepEqual(state,before);
 // Successful assessments never reserve, add an entry, or change incoming Items.
 const target=item('third'),saved=structuredClone(target),slots=['free'];
 assert.deepEqual(assess(target,slots,true),{allowed:true,reason:'none'});
 assert.deepEqual(target,saved);assert.deepEqual(slots,['free']);assert.equal(Object.isFrozen(target.properties.gem.values),false);
 assert.equal(hasEquippedItem(state,context,'third'),false);assert.equal(getEquippedEntryBySlot(state,context,'free'),null);
});

test('Every Equipment read and admission validates complete state/context before a result or ordinary denial',()=>{
 const {state,context,item,definition}=fixture();
 const actions=(s,c)=>[
  ()=>listEquippedEntries(s,c),()=>getEquippedEntryBySlot(s,c,'Right'),()=>hasEquippedItem(s,c,' First '),
  ()=>assessEquipmentAdmission(s,c,item(' First '),['Right'],{eligible:false}),
 ];
 for(const broken of [
  {...state,entries:[state.entries[0],{...state.entries[1],item:state.entries[0].item}]},
  {...state,entries:[state.entries[0],{...state.entries[1],slotIds:['Left']}]},
  {...state,entries:[state.entries[0],{...state.entries[1],item:{...state.entries[1].item,properties:{bad:Infinity}}}]},
 ])for(const action of actions(broken,context))assert.throws(action,TypeError);
 for(const c of [{items:[]},{items:[...context.items,...context.items]},
  {items:[...context.items,{definition:{...definition,definitionId:'unused',properties:{bad:undefined}}}]}]) {
  for(const action of actions(state,c))assert.throws(action,TypeError);
 }
});

test('Equipment admission rejects malformed full targets, slots and closed facts before denial without getters',()=>{
 const {state,context,item}=fixture();let reads=0;
 const assess=(target,slots=['free'],admission={eligible:false})=>assessEquipmentAdmission(state,context,target,slots,admission);
 const cycle={};cycle.self=cycle;
 for(const target of [{...item(' First '),definitionId:'unknown'}, {...item(' First '),instanceId:''},
  {...item(' First '),properties:{bad:Infinity}},{...item(' First '),properties:cycle},
  {...item(' First '),get definitionId(){reads++;return 'ring';}},
  {...item(' First '),properties:{get bad(){reads++;return 1;}}}])assert.throws(()=>assess(target),TypeError);
 const sparse=new Array(1),accessor=[];Object.defineProperty(accessor,'0',{get(){reads++;return 'free';}});
 for(const slots of [[],['x','x'],['x',''],[' '],[null],sparse,accessor,Object.assign(['x'],{extra:true})]) {
  assert.throws(()=>assess(item(' First '),slots),TypeError);
 }
 for(const fact of [undefined,null,{}, {eligible:1},{eligible:'false'},{eligible:false,extra:1},
  {eligible:true,[Symbol('extra')]:1},Object.create({eligible:false}),
  {get eligible(){reads++;return false;}}]) {
  assert.throws(()=>assessEquipmentAdmission(state,context,item(' First '),['Right'],fact),TypeError);
 }
 const proxy=new Proxy({eligible:true},{ownKeys(){throw new Error('reflection refused');}});
 assert.throws(()=>assess(item('third'),['free'],proxy),TypeError);
 assert.equal(reads,0);
});
