import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '@rpg/gameplay';

// L3 data fixtures only. No game loop, persistence, Item store or policy defaults.
const profiles=[
  {label:'Text RPG',inventoryId:'text-bag',owner:null,definitionId:'tonic',uniqueId:'letter',
    categoryId:'consumable',tagIds:['text'],rarityId:'common',instanceProperties:{batch:{values:['t',1]}}},
  {label:'RPG 2D',inventoryId:'sprite-bag',owner:{ownerKind:'character',ownerId:'sprite-1'},definitionId:'flask',uniqueId:'blade',
    categoryId:'supply',tagIds:['2d','portable'],rarityId:'uncommon',instanceProperties:{durability:8,affixes:['blue']}},
  {label:'RPG 2.5D',inventoryId:'isometric-chest',owner:{ownerKind:'chest',ownerId:'chest-9'},definitionId:'crystal',uniqueId:'key',
    categoryId:'material',tagIds:['isometric'],rarityId:null,instanceProperties:{quality:{grade:3},bound:false}},
];
const yes={eligible:true},no={eligible:false},capacity={maxEntries:3};
function fixture(profile=profiles[0]) {
  const definition=g.createItemDefinition({definitionId:profile.definitionId},{categoryId:profile.categoryId,
    tagIds:profile.tagIds,rarityId:profile.rarityId,properties:{definitionOnly:{defaultValue:99}}});
  const unique=g.createItemDefinition({definitionId:profile.uniqueId},{categoryId:'unique',tagIds:[],rarityId:null,properties:{}});
  const initial={instanceId:'A',properties:structuredClone(profile.instanceProperties)};
  const a=g.createItemInstance(definition,initial);
  const b=g.createItemInstance(definition,{instanceId:'B',properties:structuredClone(profile.instanceProperties)});
  const sword=g.createItemInstance(unique,{instanceId:'unique',properties:{inscription:['kept']}});
  const context={items:[{definition,stackPolicy:{stackable:true},maxStackQuantity:9},
    {definition:unique,stackPolicy:{stackable:false},maxStackQuantity:null}]};
  const input={inventoryId:profile.inventoryId,owner:structuredClone(profile.owner),entries:[]};
  return {definition,unique,a,b,sword,context,input,initial};
}
function accepted(result) {
  assert.equal(result.status,'accepted');assert.equal(result.reason,'none');
  assert.deepEqual(Object.keys(result),['status','reason','candidate']);assert.ok(Object.isFrozen(result));
  return result.candidate;
}
function denied(result,reason) {
  assert.deepEqual(result,{status:'rejected',reason,candidate:null});assert.ok(Object.isFrozen(result));
}
function frozen(value) {
  if(value!==null&&typeof value==='object') {
    assert.ok(Object.isFrozen(value));for(const child of Object.values(value))frozen(child);
  }
}
function lifecycle(profile) {
  const f=fixture(profile),{a,b,sword,context,input}=f;
  const empty=g.createInventoryState(input,context);
  const one=accepted(g.addInventoryEntry(empty,context,{item:a,quantity:3},capacity,yes));
  const two=accepted(g.addInventoryEntry(one,context,{item:b,quantity:2},capacity,yes));
  const three=accepted(g.addInventoryEntry(two,context,{item:sword,quantity:1},capacity,yes));
  const adjusted=accepted(g.adjustInventoryQuantity(three,context,'A',2,yes));
  const merged=accepted(g.mergeInventoryEntries(adjusted,context,'B','A',yes));
  const zero=accepted(g.adjustInventoryQuantity(merged,context,'A',-7,yes));
  const removed=accepted(g.removeInventoryEntry(zero,context,'unique',yes));
  const trace=[empty,one,two,three,adjusted,merged,zero,removed];
  // Handwritten oracle: no result from a production operation supplies expected data.
  const expectedA={instanceId:'A',definitionId:profile.definitionId,properties:structuredClone(profile.instanceProperties)};
  const expectedB={instanceId:'B',definitionId:profile.definitionId,properties:structuredClone(profile.instanceProperties)};
  const expectedUnique={instanceId:'unique',definitionId:profile.uniqueId,properties:{inscription:['kept']}};
  const oracle=[[],[{item:expectedA,quantity:3}],
    [{item:expectedA,quantity:3},{item:expectedB,quantity:2}],
    [{item:expectedA,quantity:3},{item:expectedB,quantity:2},{item:expectedUnique,quantity:1}],
    [{item:expectedA,quantity:5},{item:expectedB,quantity:2},{item:expectedUnique,quantity:1}],
    [{item:expectedA,quantity:7},{item:expectedUnique,quantity:1}],
    [{item:expectedUnique,quantity:1}],[]];
  const totals=[0,3,5,6,8,8,1,0],available=[3,2,1,0,0,1,2,3];
  for(const [index,state] of trace.entries()) {
    assert.deepEqual(state,{inventoryId:profile.inventoryId,owner:profile.owner,entries:oracle[index]});
    assert.deepEqual(g.validateInventoryState(state,context),state);frozen(state);
    assert.deepEqual(g.listInventoryEntries(state,context),oracle[index]);
    assert.equal(state.entries.reduce((sum,entry)=>sum+entry.quantity,0),totals[index]);
    assert.deepEqual(g.assessInventoryCapacity(state,context,capacity,1),
      {fits:index!==3&&index!==4,occupied:oracle[index].length,available:available[index]});
  }
  assert.equal(g.getInventoryEntry(empty,context,'A'),null);assert.equal(g.hasInventoryItem(empty,context,'A'),false);
  assert.deepEqual(g.getInventoryEntry(adjusted,context,'A'),{item:expectedA,quantity:5});
  assert.equal(g.hasInventoryItem(merged,context,'B'),false);
  assert.equal(g.hasInventoryItem(merged,context,'A'),true);
  assert.equal(g.getItemInstanceProperty(f.definition,a,'definitionOnly').found,false);
  assert.deepEqual(g.validateItemInstance(f.definition,a),expectedA);
  const queried=g.getInventoryEntry(merged,context,'A');
  assert.notEqual(queried.item,merged.entries[0].item);frozen(queried);
  assert.throws(()=>queried.item.properties.changed=1,TypeError);
  const prior=structuredClone(three);
  denied(g.addInventoryEntry(three,context,{item:a,quantity:1},capacity,yes),'already_present');
  denied(g.addInventoryEntry(three,context,{item:{...a,instanceId:'extra'},quantity:1},capacity,yes),'capacity_exceeded');
  assert.deepEqual(three,prior);
  assert.deepEqual(input,{inventoryId:profile.inventoryId,owner:profile.owner,entries:[]});
  assert.equal(Object.isFrozen(input),false);assert.equal(Object.isFrozen(f.initial.properties),false);
  // Mutate caller originals after the complete trace; snapshots must remain independent.
  f.initial.properties.changed='caller';input.entries.push({item:a,quantity:8});
  if(input.owner)input.owner.ownerId='changed';
  assert.deepEqual(one.entries[0].item,expectedA);assert.deepEqual(empty.entries,[]);
  assert.deepEqual(empty.owner,profile.owner);
  return trace;
}
for(const profile of profiles) test(`installed ${profile.label}: exact complete Inventory lifecycle and deterministic replay`,()=>{
  assert.deepEqual(lifecycle(profile),lifecycle(profile));
});

test('installed integration rejects malformed Items and unsafe/policy transitions without partial mutation',()=>{
  const {definition,a,b,sword,context,input}=fixture();let reads=0;
  const empty=g.createInventoryState(input,context);
  const state=g.createInventoryState({...input,entries:[{item:a,quantity:3},{item:b,quantity:2}]},context);
  const original=structuredClone(state);
  assert.throws(()=>g.validateItemInstance(definition,{...a,definitionId:'wrong'}),TypeError);
  assert.throws(()=>g.addInventoryEntry(empty,context,{item:{...a,definitionId:'wrong'},quantity:1},capacity,no),TypeError);
  assert.throws(()=>g.validateInventoryState({...input,entries:[{item:a,quantity:1},{item:a,quantity:1}]},context),TypeError);
  const cycle={};cycle.self=cycle;
  for(const properties of [cycle,{nested:undefined},{get nested(){reads++;return 1;}}]) {
    assert.throws(()=>g.addInventoryEntry(empty,context,{item:{...a,properties},quantity:1},capacity,no),TypeError);
  }
  assert.equal(reads,0);
  denied(g.addInventoryEntry(empty,context,{item:sword,quantity:2},capacity,yes),'quantity_not_allowed');
  denied(g.addInventoryEntry(empty,context,{item:a,quantity:10},capacity,yes),'stack_limit_exceeded');
  denied(g.adjustInventoryQuantity(state,context,'A',7,yes),'stack_limit_exceeded');
  denied(g.adjustInventoryQuantity(state,context,'A',-4,yes),'quantity_underflow');
  denied(g.mergeInventoryEntries(state,context,'B','A',no),'ineligible');
  const different=g.createInventoryState({...input,entries:[{item:a,quantity:3},
    {item:{...b,properties:{durability:2}},quantity:2}]},context);
  const before=structuredClone(different);
  denied(g.mergeInventoryEntries(different,context,'B','A',yes),'item_incompatible');
  assert.deepEqual(different,before);
  const policyFalse={items:[{...context.items[0],stackPolicy:{stackable:false}}]};
  const singles=g.createInventoryState({...input,entries:[{item:a,quantity:1},{item:b,quantity:1}]},policyFalse);
  denied(g.mergeInventoryEntries(singles,policyFalse,'B','A',yes),'item_incompatible');
  const noCap={items:[{...context.items[0],maxStackQuantity:null}]};
  const huge=g.createInventoryState({...input,entries:[{item:a,quantity:Number.MAX_SAFE_INTEGER},{item:b,quantity:1}]},noCap);
  denied(g.mergeInventoryEntries(huge,noCap,'B','A',yes),'stack_limit_exceeded');
  denied(g.adjustInventoryQuantity(huge,noCap,'A',1,yes),'stack_limit_exceeded');
  assert.equal(huge.entries[0].quantity,Number.MAX_SAFE_INTEGER);assert.deepEqual(state,original);
  const hostile=JSON.parse('{"__proto__":{"nested":[1]},"constructor":2}');
  const captured=g.addInventoryEntry(empty,context,{item:{...a,properties:hostile},quantity:1},capacity,yes);
  const snapshot=accepted(captured);hostile.__proto__.nested.push(3);
  assert.deepEqual(snapshot.entries[0].item.properties,JSON.parse('{"__proto__":{"nested":[1]},"constructor":2}'));
  frozen(snapshot);
});

test('installed Foundation represents future handoffs as data without implementing split, transfer or Equipment',()=>{
  const {definition,a,b,context,input}=fixture();
  // Hand-authored representability witnesses, not operations or authoritative commits.
  const two=g.validateInventoryState({...input,entries:[{item:a,quantity:2},{item:b,quantity:3}]},context);
  assert.deepEqual(two.entries.map(e=>[e.item.instanceId,e.quantity]),[['A',2],['B',3]]);
  const outgoing=g.validateInventoryState({...input,entries:[]},context);
  const incoming=g.validateInventoryState({inventoryId:'stash',owner:{ownerKind:'account',ownerId:'account-1'},
    entries:[{item:a,quantity:5}]},context);
  assert.deepEqual(outgoing.entries,[]);assert.equal(incoming.entries[0].item.instanceId,'A');
  const handedOff=g.getInventoryEntry(incoming,context,'A').item;
  assert.deepEqual(Object.keys(handedOff),['instanceId','definitionId','properties']);frozen(handedOff);
  assert.deepEqual(Object.keys(incoming),['inventoryId','owner','entries']);
  assert.deepEqual(Object.keys(incoming.entries[0]),['item','quantity']);
  assert.equal(g.getItemInstanceProperty(definition,handedOff,'definitionOnly').found,false);
  // Presentation can consume identity without an Inventory slot/renderer or new module.
  assert.equal(handedOff.definitionId,'tonic');assert.equal(Object.hasOwn(incoming,'slots'),false);
});
