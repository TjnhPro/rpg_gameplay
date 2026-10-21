import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../../dist/index.js';

const yes = {eligible:true}, no = {eligible:false}, unlimited = {maxEntries:null};
function fixture() {
  const definition = {definitionId:'potion',categoryId:'consumable',tagIds:['usable'],rarityId:'plain',properties:{kind:'heal'}};
  const sword = {...definition,definitionId:'sword',categoryId:'weapon'};
  const context = {items:[
    {definition,stackPolicy:{stackable:true},maxStackQuantity:9},
    {definition:sword,stackPolicy:{stackable:false},maxStackQuantity:null},
  ]};
  const entry = {item:{instanceId:'p1',definitionId:'potion',properties:{nested:{values:[1]}}},quantity:4};
  const state = {inventoryId:'bag',owner:{ownerKind:'chest',ownerId:'c'},entries:[]};
  return {state,context,entry};
}
function accepted(result) {
  assert.equal(result.status,'accepted'); assert.equal(result.reason,'none');
  assert.deepEqual(Object.keys(result),['status','reason','candidate']);
  assert.ok(Object.isFrozen(result));
  return result.candidate;
}
function rejected(result,reason) {
  assert.deepEqual(result,{status:'rejected',reason,candidate:null});
  assert.ok(Object.isFrozen(result));
}

test('Inventory add appends explicit canonical Items as detached immutable candidates', () => {
  const {state,context,entry}=fixture();
  const first=accepted(g.addInventoryEntry(state,context,entry,unlimited,yes));
  assert.deepEqual(first,{inventoryId:'bag',owner:{ownerKind:'chest',ownerId:'c'},entries:[
    {item:{instanceId:'p1',definitionId:'potion',properties:{nested:{values:[1]}}},quantity:4},
  ]});
  const second=accepted(g.addInventoryEntry(first,context,{item:{instanceId:'s1',definitionId:'sword',properties:{}},quantity:1},unlimited,yes));
  assert.deepEqual(second.entries.map(e=>e.item.instanceId),['p1','s1']);
  const sameDefinition=accepted(g.addInventoryEntry(first,context,{...entry,item:{...entry.item,instanceId:'p2'}},unlimited,yes));
  assert.deepEqual(sameDefinition.entries.map(e=>[e.item.instanceId,e.quantity]),[['p1',4],['p2',4]]);
  assert.deepEqual(state.entries,[]);
  entry.item.properties.nested.values[0]=99; state.owner.ownerId='changed';
  assert.deepEqual(first.entries[0].item.properties.nested.values,[1]);
  assert.equal(first.owner.ownerId,'c');
  for(const value of [first,first.owner,first.entries,first.entries[0],first.entries[0].item,
    first.entries[0].item.properties,first.entries[0].item.properties.nested.values]) assert.ok(Object.isFrozen(value));
  assert.throws(()=>first.entries[0].item.properties.nested.values.push(2),TypeError);
  assert.equal(Object.isFrozen(entry),false);
  assert.deepEqual(g.validateInventoryState(first,context),first);
});

test('Inventory add distinguishes policy rejections from structural failures without mutation', () => {
  const {state,context,entry}=fixture();
  const full={...state,entries:[entry]}, original=structuredClone(full);
  rejected(g.addInventoryEntry(full,context,entry,unlimited,yes),'already_present');
  rejected(g.addInventoryEntry(full,context,{...entry,item:{...entry.item,instanceId:'p2'}},{maxEntries:1},yes),'capacity_exceeded');
  rejected(g.addInventoryEntry(state,context,entry,{maxEntries:0},yes),'capacity_exceeded');
  const sword={item:{instanceId:'s1',definitionId:'sword',properties:{}},quantity:2};
  rejected(g.addInventoryEntry(state,context,sword,unlimited,yes),'quantity_not_allowed');
  rejected(g.addInventoryEntry(state,context,{...entry,quantity:10},unlimited,yes),'stack_limit_exceeded');
  assert.equal(accepted(g.addInventoryEntry(state,context,{...entry,quantity:9},{maxEntries:1},yes)).entries[0].quantity,9);
  rejected(g.addInventoryEntry(state,context,sword,unlimited,no),'ineligible');
  assert.deepEqual(full,original);
});

test('Inventory remove and quantity changes preserve order and retire only zero membership', () => {
  const {state,context,entry}=fixture();
  const other=id=>({...entry,item:{...entry.item,instanceId:id}});
  const source={...state,entries:[other('before'),entry,other('after')]};
  const original=structuredClone(source);
  for(const [delta,expected] of [[3,7],[-3,1]]) {
    const result=accepted(g.adjustInventoryQuantity(source,context,'p1',delta,yes));
    assert.deepEqual(result.entries.map(e=>[e.item.instanceId,e.quantity]),[['before',4],['p1',expected],['after',4]]);
    assert.notEqual(result.entries[0].item.properties,source.entries[0].item.properties);
    assert.deepEqual(result.entries[1].item,entry.item);
  }
  const zero=accepted(g.adjustInventoryQuantity(source,context,'p1',-4,yes));
  const removed=accepted(g.removeInventoryEntry(source,context,'p1',yes));
  assert.deepEqual(zero.entries.map(e=>e.item.instanceId),['before','after']);
  assert.deepEqual(removed,zero);
  assert.deepEqual(entry.item,{instanceId:'p1',definitionId:'potion',properties:{nested:{values:[1]}}});
  assert.deepEqual(accepted(g.removeInventoryEntry({...state,entries:[entry]},context,'p1',yes)).entries,[]);
  rejected(g.removeInventoryEntry(source,context,'missing',yes),'missing_entry');
  rejected(g.adjustInventoryQuantity(source,context,'missing',1,yes),'missing_entry');
  rejected(g.adjustInventoryQuantity(source,context,'p1',-5,yes),'quantity_underflow');
  rejected(g.adjustInventoryQuantity(source,context,'p1',6,yes),'stack_limit_exceeded');
  rejected(g.removeInventoryEntry(source,context,'p1',no),'ineligible');
  rejected(g.adjustInventoryQuantity(source,context,'p1',1,no),'ineligible');
  assert.deepEqual(source,original);
});

test('Inventory quantity enforces nonstackability and overflow without unsafe arithmetic', () => {
  const {state,context,entry}=fixture();
  const sword={...state,entries:[{item:{instanceId:'s1',definitionId:'sword',properties:{}},quantity:1}]};
  rejected(g.adjustInventoryQuantity(sword,context,'s1',1,yes),'quantity_not_allowed');
  assert.deepEqual(accepted(g.adjustInventoryQuantity(sword,context,'s1',-1,yes)).entries,[]);
  const noCap={items:[{...context.items[0],maxStackQuantity:null}]};
  const huge={...state,entries:[{...entry,quantity:Number.MAX_SAFE_INTEGER-1}]};
  const edge=accepted(g.adjustInventoryQuantity(huge,noCap,'p1',1,yes));
  assert.equal(edge.entries[0].quantity,Number.MAX_SAFE_INTEGER);
  rejected(g.adjustInventoryQuantity(huge,noCap,'p1',2,yes),'stack_limit_exceeded');
  rejected(g.adjustInventoryQuantity(edge,noCap,'p1',Number.MAX_SAFE_INTEGER,yes),'stack_limit_exceeded');
  assert.deepEqual(accepted(g.adjustInventoryQuantity(edge,noCap,'p1',-Number.MAX_SAFE_INTEGER,yes)).entries,[]);
  // Capacity applies to new membership, not an existing quantity change.
  assert.equal(g.assessInventoryCapacity({...state,entries:[entry]},context,{maxEntries:1},1).fits,false);
  assert.equal(accepted(g.adjustInventoryQuantity({...state,entries:[entry]},context,'p1',3,yes)).entries[0].quantity,7);
});

test('Inventory mutation validates all structural inputs before admission and never invokes getters', () => {
  const {state,context,entry}=fixture(); let reads=0;
  const source={...state,entries:[entry]};
  const actions=[
    (s,c,a)=>g.addInventoryEntry(s,c,entry,unlimited,a),
    (s,c,a)=>g.removeInventoryEntry(s,c,'p1',a),
    (s,c,a)=>g.adjustInventoryQuantity(s,c,'p1',1,a),
  ];
  for(const action of actions) {
    assert.throws(()=>action({inventoryId:'partial'},context,no),TypeError);
    assert.throws(()=>action(source,{items:[]},no),TypeError);
    assert.throws(()=>action({...source,entries:[entry,entry]},context,no),TypeError);
    for(const admission of [{},{eligible:1},{eligible:true,extra:1},
      {get eligible(){reads++;return false;}},{eligible:false,[Symbol('bad')]:1}]) {
      assert.throws(()=>action(source,context,admission),TypeError);
    }
  }
  for(const quantity of [0,-1,0.5,Number.MAX_SAFE_INTEGER+1,NaN,Infinity,'4']) {
    assert.throws(()=>g.addInventoryEntry(state,context,{...entry,quantity},unlimited,no),TypeError);
  }
  const badItem={...entry.item}; Object.defineProperty(badItem,'definitionId',{get(){reads++;return'potion';}});
  const cycle={}; cycle.self=cycle;
  for(const item of [badItem,{...entry.item,definitionId:'missing'},
    {...entry.item,properties:cycle},{...entry.item,properties:{get x(){reads++;return 1;}}},
    {...entry.item,extra:1}]) {
    assert.throws(()=>g.addInventoryEntry(state,context,{item,quantity:4},unlimited,no),TypeError);
  }
  assert.throws(()=>g.addInventoryEntry(state,context,{...entry,slot:0},unlimited,no),TypeError);
  assert.throws(()=>g.addInventoryEntry(state,context,entry,{maxEntries:-1},no),TypeError);
  assert.throws(()=>g.addInventoryEntry(state,context,entry,{get maxEntries(){reads++;return 1;}},no),TypeError);
  for(const delta of [0,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'1']) {
    assert.throws(()=>g.adjustInventoryQuantity(source,context,'p1',delta,no),TypeError);
  }
  assert.throws(()=>g.removeInventoryEntry(source,context,' ',no),TypeError);
  assert.throws(()=>g.adjustInventoryQuantity(source,context,' ',1,no),TypeError);
  assert.equal(reads,0);
  assert.equal(entry.quantity,4); assert.deepEqual(state.entries,[]);
});
