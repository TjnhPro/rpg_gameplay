import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as g from '../../dist/index.js';
function fixture() {
 const definition={definitionId:'ring',categoryId:'accessory',tagIds:[],rarityId:null,properties:{defaultOnly:9}};
 const context={items:[{definition}]};
 const entry=(instanceId,slotIds)=>({item:{instanceId,definitionId:'ring',properties:{nested:{values:[1,null]}}},slotIds});
 const state={equipmentId:' Gear ',owner:{ownerKind:'companion',ownerId:' C '},entries:[entry('r1',['Ring L']),entry('r2',['ring l'])]};
 return {definition,context,entry,state};
}
function frozen(value) {
 if(value!==null&&typeof value==='object') {assert.ok(Object.isFrozen(value));for(const child of Object.values(value))frozen(child);}
}
function invalid(state,context) {
 for(const action of [g.createEquipmentState,g.validateEquipmentState])assert.throws(()=>action(state,context),TypeError);
}

test('Equipment identity and neutral owners preserve exact strings; empty and ordered multi-slot snapshots',()=>{
 const {state,context,entry}=fixture();
 for(const owner of [null,{ownerKind:'player',ownerId:'p'},{ownerKind:'monster',ownerId:'m'},state.owner]) {
  const empty=g.createEquipmentState({equipmentId:'empty',owner,entries:[]},context);
  assert.deepEqual(empty,{equipmentId:'empty',owner,entries:[]});frozen(empty);
 }
 for(const action of [g.createEquipmentState,g.validateEquipmentState]) {
  assert.deepEqual(action(state,context),{equipmentId:' Gear ',owner:{ownerKind:'companion',ownerId:' C '},entries:[
   {item:{instanceId:'r1',definitionId:'ring',properties:{nested:{values:[1,null]}}},slotIds:['Ring L']},
   {item:{instanceId:'r2',definitionId:'ring',properties:{nested:{values:[1,null]}}},slotIds:['ring l']},
  ]});
  const multiple=action({...state,entries:[entry('two-hand',['hand_right','hand_left'])]},context);
  assert.deepEqual(multiple.entries[0].slotIds,['hand_right','hand_left']);
  assert.deepEqual(Object.keys(multiple),['equipmentId','owner','entries']);
  assert.deepEqual(Object.keys(multiple.entries[0]),['item','slotIds']);
  assert.equal(Object.hasOwn(multiple.entries[0].item.properties,'defaultOnly'),false);
 }
 for(const equipmentId of ['', ' ',3,null])invalid({...state,equipmentId},context);
 invalid({...state,owner:{ownerKind:'',ownerId:'x'}},context);
 invalid({...state,owner:{ownerKind:'x',ownerId:''}},context);
});

test('Equipment rejects duplicate instances and exact slot conflicts, including repeated slots in one entry',()=>{
 const {state,context,entry}=fixture();
 invalid({...state,entries:[entry('r1',['one']),entry('r1',['two'])]},context);
 invalid({...state,entries:[entry('r1',['one']),entry('r2',['one'])]},context);
 for(const slots of [[],['x','x'],['x',''],[' '],[1],new Array(1),Object.assign(['x'],{extra:1})]) {
  invalid({...state,entries:[entry('r1',slots)]},context);
 }
 // Opaque keys are data, never object-property lookup keys or fixed slot enums.
 const hostile=g.validateEquipmentState({...state,entries:[entry('__proto__',['__proto__','constructor'])]},context);
 assert.deepEqual(hostile.entries[0].slotIds,['__proto__','constructor']);
});

test('Equipment requires complete unique Item context and canonical instances, including unused definitions',()=>{
 const {state,context,definition}=fixture();
 invalid(state,{items:[]});invalid(state,{items:[context.items[0],context.items[0]]});
 invalid(state,{items:[context.items[0],{definition:{...definition,properties:{changed:1}}}]});
 invalid(state,{items:[{definition:{...definition,tagIds:['dup','dup']}}]});
 invalid({...state,entries:[{...state.entries[0],item:{...state.entries[0].item,definitionId:'forged'}}]},context);
 invalid({...state,entries:[{...state.entries[0],item:{...state.entries[0].item,instanceId:''}}]},context);
 const unused={definition:{...definition,definitionId:'unused'}};
 assert.deepEqual(g.validateEquipmentState(state,{items:[...context.items,unused]}),state);
 const cycle={};cycle.self=cycle;
 for(const properties of [cycle,{value:undefined},{value:Infinity}]) {
  invalid({...state,entries:[{...state.entries[0],item:{...state.entries[0].item,properties}}]},context);
 }
 const special=JSON.parse('{"__proto__":{"values":[1]},"constructor":2}');
 const captured=g.validateEquipmentState({...state,entries:[{...state.entries[0],item:{...state.entries[0].item,properties:special}}]},context);
 assert.deepEqual(captured.entries[0].item.properties,JSON.parse('{"__proto__":{"values":[1]},"constructor":2}'));
});

test('Equipment rejects hostile closed structures without invoking getters or freezing callers',()=>{
 const {state,context}=fixture();let reads=0;
 const badArray=[];Object.defineProperty(badArray,'0',{get(){reads++;return state.entries[0];}});
 const read=()=>{reads++;return 'ring';};
 for(const value of [{...state,quantity:1},{...state,[Symbol('extra')]:1},
  Object.assign(Object.create({}),state),{...state,get entries(){reads++;return[];}},
  {...state,entries:badArray},{...state,entries:new Array(1)},
  {...state,owner:{get ownerKind(){reads++;return 'x';},ownerId:'x'}},
  {...state,entries:[{...state.entries[0],quantity:1}]},
  {...state,entries:[{...state.entries[0],get slotIds(){reads++;return ['x'];}}]},
  {...state,entries:[{...state.entries[0],item:{...state.entries[0].item,get definitionId(){return read();}}}]},
  {...state,entries:[{...state.entries[0],item:{...state.entries[0].item,properties:{get x(){return read();}}}}]}]) {
  invalid(value,context);
 }
 for(const value of [{...context,extra:1},{get items(){reads++;return context.items;}},
  {items:[{...context.items[0],extra:1}]},
  {items:[{definition:{...context.items[0].definition,get categoryId(){return read();}}}]}])invalid(state,value);
 const revoked=Proxy.revocable({},{});revoked.revoke();invalid(revoked.proxy,context);
 assert.equal(reads,0);assert.equal(Object.isFrozen(state),false);
});

test('Equipment returns fresh deeply detached frozen snapshots and repeatable validation',()=>{
 const {state,context}=fixture(), original=structuredClone(state),facts=structuredClone(context);
 const first=g.createEquipmentState(state,context),second=g.validateEquipmentState(first,context);
 assert.deepEqual(second,first);assert.deepEqual(g.createEquipmentState(state,context),first);
 assert.notEqual(first,second);assert.notEqual(first.entries[0].item,second.entries[0].item);
 assert.notEqual(first.entries[0].item.properties.nested.values,state.entries[0].item.properties.nested.values);
 frozen(first);frozen(second);assert.deepEqual(state,original);assert.deepEqual(context,facts);
 state.entries[0].item.properties.nested.values[0]=99;state.entries[0].slotIds.push('new');state.owner.ownerId='changed';
 assert.deepEqual(first.entries[0].item.properties.nested.values,[1,null]);
 assert.deepEqual(first.entries[0].slotIds,['Ring L']);assert.equal(first.owner.ownerId,' C ');
 assert.throws(()=>first.entries[0].slotIds.push('bad'),TypeError);
 assert.throws(()=>first.entries[0].item.properties.nested.values.push(2),TypeError);
 assert.equal(Object.isFrozen(state.entries[0].item.properties.nested.values),false);
 assert.equal(Object.isFrozen(context.items[0].definition),false);
});

test('Equipment optional graph uses only Item; existing Inventory-only composition stays intact',()=>{
 const declarations=JSON.parse(readFileSync(new URL('../../harness/modules.json',import.meta.url))).modules;
 assert.deepEqual(declarations.find(x=>x.id==='equipment'),{id:'equipment',optional:true,dependencies:['item']});
 assert.deepEqual(declarations.find(x=>x.id==='item'),{id:'item',optional:true,dependencies:[]});
 let registry=g.createModuleRegistry();for(const d of declarations)registry=g.registerModule(registry,d);
 const compose=enable=>g.composeModules(registry,g.configureModules(registry,{enable})).moduleIds;
 assert.deepEqual(compose([]),[]);assert.deepEqual(compose(['item']),['item']);
 assert.deepEqual(compose(['item','inventory']),['item','inventory']);
 assert.deepEqual(compose(['equipment','item']),['item','equipment']);
 assert.throws(()=>compose(['equipment']),/dependency/);assert.throws(()=>compose(['inventory']),/dependency/);
 assert.throws(()=>compose(['inventory','equipment']),/dependency/);
});
