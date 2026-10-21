import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../../dist/index.js';
const yes={eligible:true}, no={eligible:false};
function fixture(maximum=20,stackable=true) {
  const definition={definitionId:'d',categoryId:null,tagIds:['usable'],rarityId:null,properties:{quality:{value:2}}};
  const context={items:[{definition,stackPolicy:{stackable},maxStackQuantity:maximum}]};
  const entry=(id,quantity)=>({item:{instanceId:id,definitionId:'d',properties:{durability:3,nested:{values:[1,'a']}}},quantity});
  const state={inventoryId:'bag',owner:{ownerKind:'chest',ownerId:'c'},entries:[entry('source',4),entry('destination',7)]};
  return {state,context,entry};
}
function reject(result,reason) {
  assert.deepEqual(result,{status:'rejected',reason,candidate:null});
  assert.ok(Object.isFrozen(result));
}
function frozen(value) {
  if(value!==null&&typeof value==='object') {
    assert.ok(Object.isFrozen(value)); for(const child of Object.values(value)) frozen(child);
  }
}

test('Inventory complete merge preserves destination, quantity, order, capacity and detached snapshots',()=>{
  for(const sourceFirst of [true,false]) {
    const {state,context,entry}=fixture();
    const [source,destination]=state.entries;
    state.entries=[entry('before',1),...(sourceFirst?[source,entry('middle',2),destination]:[destination,entry('middle',2),source]),entry('after',1)];
    const original=structuredClone(state), facts=structuredClone(context);
    const result=g.mergeInventoryEntries(state,context,'source','destination',yes);
    assert.equal(result.status,'accepted'); assert.equal(result.reason,'none');
    assert.deepEqual(Object.keys(result),['status','reason','candidate']);
    assert.deepEqual(result.candidate,{inventoryId:'bag',owner:{ownerKind:'chest',ownerId:'c'},entries:
      (sourceFirst?[['before',1],['middle',2],['destination',11],['after',1]]:[['before',1],['destination',11],['middle',2],['after',1]])
      .map(([id,quantity])=>({item:{instanceId:id,definitionId:'d',properties:{durability:3,nested:{values:[1,'a']}}},quantity}))});
    const survivor=result.candidate.entries.find(e=>e.item.instanceId==='destination');
    assert.deepEqual(survivor.item,destination.item); assert.notEqual(survivor.item,destination.item);
    assert.equal(result.candidate.entries.reduce((s,e)=>s+e.quantity,0),15);
    assert.deepEqual(g.assessInventoryCapacity(state,context,{maxEntries:5},1),{fits:false,occupied:5,available:0});
    assert.deepEqual(g.assessInventoryCapacity(result.candidate,context,{maxEntries:5},1),{fits:true,occupied:4,available:1});
    assert.deepEqual(g.mergeInventoryEntries(state,context,'source','destination',yes),result);
    assert.deepEqual(g.validateInventoryState(result.candidate,context),result.candidate);
    frozen(result); assert.deepEqual(state,original); assert.deepEqual(context,facts);
    state.entries[0].item.properties.nested.values[0]=99; state.owner.ownerId='changed';
    assert.deepEqual(result.candidate.entries[0].item.properties.nested.values,[1,'a']);
    assert.equal(result.candidate.owner.ownerId,'c');
    assert.throws(()=>survivor.item.properties.nested.values.push('bad'),TypeError);
    assert.equal(Object.isFrozen(state),false);
  }
});

test('Inventory merge has exact missing, same-instance and admission precedence',()=>{
  const {state,context}=fixture(); const original=structuredClone(state);
  reject(g.mergeInventoryEntries(state,context,'source','source',yes),'same_instance');
  for(const [s,d] of [['missing','destination'],['source','missing'],['missing','missing']]) {
    reject(g.mergeInventoryEntries(state,context,s,d,yes),'missing_entry');
    reject(g.mergeInventoryEntries(state,context,s,d,no),'ineligible');
  }
  reject(g.mergeInventoryEntries(state,context,'source','destination',no),'ineligible');
  assert.deepEqual(state,original);
});

test('Inventory merge delegates different definitions, nested properties and stack policy to Item',()=>{
  for(const kind of ['definition','properties','not_stackable']) {
    const {state,context}=fixture(20,kind!=='not_stackable');
    if(kind==='definition') {
      context.items.push({...context.items[0],definition:{...context.items[0].definition,definitionId:'other'}});
      state.entries[1].item.definitionId='other';
    }
    if(kind==='properties') state.entries[1].item.properties.nested.values[0]=2;
    if(kind==='not_stackable') state.entries.forEach(e=>e.quantity=1);
    const a=context.items[0],b=context.items.at(-1);
    assert.deepEqual(g.assessItemStackCompatibility(a.definition,state.entries[0].item,b.definition,state.entries[1].item,b.stackPolicy),
      {compatible:false,reason:kind==='definition'?'different_definition':kind==='properties'?'different_properties':'not_stackable'});
    const original=structuredClone(state);
    reject(g.mergeInventoryEntries(state,context,'source','destination',yes),'item_incompatible');
    assert.deepEqual(state,original);
  }
  // Item supports hostile string keys without prototype lookup or loss of data.
  const {state,context}=fixture();
  state.entries[0].item.properties=JSON.parse('{"__proto__":{"x":1},"constructor":[2]}');
  state.entries[1].item.properties=JSON.parse('{"constructor":[2],"__proto__":{"x":1}}');
  const result=g.mergeInventoryEntries(state,context,'source','destination',yes);
  assert.equal(result.status,'accepted');
  assert.deepEqual(result.candidate.entries[0].item.properties,JSON.parse('{"constructor":[2],"__proto__":{"x":1}}'));
});

test('Inventory merge refuses complete over-cap and unsafe sums without remainder or source mutation',()=>{
  for(const [cap,source,destination,accepted] of [[11,4,7,true],[10,4,7,false],
    [null,1,Number.MAX_SAFE_INTEGER-1,true],[null,2,Number.MAX_SAFE_INTEGER-1,false],
    [null,Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,false]]) {
    const {state,context}=fixture(cap); state.entries[0].quantity=source; state.entries[1].quantity=destination;
    const original=structuredClone(state), result=g.mergeInventoryEntries(state,context,'source','destination',yes);
    if(accepted) {
      assert.equal(result.status,'accepted'); assert.equal(result.candidate.entries.length,1);
      assert.equal(result.candidate.entries[0].quantity,cap===11?11:Number.MAX_SAFE_INTEGER);
    } else reject(result,'stack_limit_exceeded');
    assert.deepEqual(state,original);
  }
});

test('Inventory merge validates complete structure before denial and never evaluates getters',()=>{
  const {state,context}=fixture(); let reads=0;
  const action=(s,c,source='source',destination='destination',admission=no)=>g.mergeInventoryEntries(s,c,source,destination,admission);
  for(const s of [{...state,entries:[state.entries[0],state.entries[0]]},{...state,extra:1},
    Object.assign(Object.create({}),state),{...state,entries:[{...state.entries[0],quantity:0}]},
    {...state,entries:[{...state.entries[0],item:{...state.entries[0].item,definitionId:'unresolved'}}]},
    {...state,get entries(){reads++;return[];}}]) assert.throws(()=>action(s,context),TypeError);
  for(const c of [{items:[]},{...context,extra:1},{items:[{...context.items[0],maxStackQuantity:0}]},
    {get items(){reads++;return context.items;}}]) assert.throws(()=>action(state,c),TypeError);
  for(const bad of ['', ' ',null,1,{},Symbol('id')]) {
    assert.throws(()=>action(state,context,bad),TypeError);
    assert.throws(()=>action(state,context,'source',bad),TypeError);
  }
  for(const a of [{},{eligible:1},{eligible:false,extra:1},{eligible:false,[Symbol('x')]:1},
    {get eligible(){reads++;return false;}},Object.assign(Object.create({}),no)]) {
    assert.throws(()=>action(state,context,'source','destination',a),TypeError);
  }
  const cyclic={}; cyclic.self=cyclic;
  for(const properties of [cyclic,{get nested(){reads++;return 1;}}]) {
    assert.throws(()=>action({...state,entries:[{...state.entries[0],item:{...state.entries[0].item,properties}}]},context),TypeError);
  }
  assert.equal(reads,0);
  assert.deepEqual(state.entries.map(e=>e.quantity),[4,7]);
});

test('Inventory rejects conflicting duplicate context before merge; Item reports definition_conflict',()=>{
  const {state,context}=fixture();
  const left=context.items[0], right={...left,definition:{...left.definition,properties:{quality:{value:99}}}};
  assert.deepEqual(g.assessItemStackCompatibility(left.definition,state.entries[0].item,
    right.definition,state.entries[1].item,left.stackPolicy),{compatible:false,reason:'definition_conflict'});
  const conflicting={items:[left,right]}, original=structuredClone(state);
  assert.throws(()=>g.validateInventoryState(state,conflicting),{name:'TypeError',message:'Duplicate Inventory context definition'});
  for(const admission of [yes,no]) assert.throws(()=>g.mergeInventoryEntries(state,conflicting,'source','destination',admission),
    {name:'TypeError',message:'Duplicate Inventory context definition'});
  assert.deepEqual(state,original);
});
