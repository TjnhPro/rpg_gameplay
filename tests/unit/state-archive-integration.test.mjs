import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../../dist/index.js';

// L3 facts are independent of the archive. This is an L4 fixture, not a restore API.
const definition={definitionId:'blade',categoryId:null,tagIds:[],rarityId:null,properties:{}};
const inventoryContext={items:[{definition,stackPolicy:{stackable:true},maxStackQuantity:10}]};
const equipmentContext={items:[{definition}]};
const owner={ownerKind:'player',ownerId:'p1'};
const expected={
  bag:{inventoryId:'bag',owner,entries:[{item:{instanceId:'bag-blade',definitionId:'blade',properties:{gems:[2]}},quantity:3}]},
  gear:{equipmentId:'gear',owner,entries:[{item:{instanceId:'gear-blade',definitionId:'blade',properties:{power:7}},slotIds:['hand']}]},
  wallet:{walletId:'wallet',owner,balances:[{currencyId:'gold',amount:23},{currencyId:'silver',amount:0}]},
  claim:{claimId:'claim',source:{kind:'encounter',id:'e1'},recipient:{kind:'player',id:'p1'},
    reward:{packageId:'reward',lines:[{lineId:'line',grantKindId:'currency',referenceId:'gold',amount:23}]},status:'claimed'},
};
const keys=[
  {moduleId:'inventory',stateKind:'inventory',stateId:'bag'},
  {moduleId:'equipment',stateKind:'equipment',stateId:'gear'},
  {moduleId:'currency',stateKind:'wallet',stateId:'wallet'},
  {moduleId:'reward',stateKind:'claim',stateId:'claim'},
];
const policy={supportedFormatVersions:[1],schemas:keys.map(({moduleId,stateKind})=>({moduleId,stateKind,supportedSchemaVersions:[1]})),requiredRecords:keys};
function snapshots() {
  return {bag:g.createInventoryState(expected.bag,inventoryContext),gear:g.createEquipmentState(expected.gear,equipmentContext),
    wallet:g.createCurrencyWalletState(expected.wallet),claim:g.createRewardClaimState(expected.claim)};
}
function archive() {
  const state=snapshots();
  return g.assembleGameplayStateArchive(1,Object.values(state).map((payload,i)=>({...keys[i],schemaVersion:1,payload})));
}
function frozen(value) {
  if(value!==null&&typeof value==='object') {assert.ok(Object.isFrozen(value));for(const child of Object.values(value))frozen(child);}
}
// All validation finishes before the single authoritative assignment. No operation,
// reward dispatch, event publication or clock callback is part of restoration.
function publish(holder,base,input,facts=inventoryContext) {
  const prepared=g.prepareGameplayStateRestore(input,policy);
  if(prepared.status!=='ready')return prepared.reason;
  const payloads=keys.map(key=>prepared.records.find(r=>r.moduleId===key.moduleId&&r.stateKind===key.stateKind&&r.stateId===key.stateId).payload);
  const next={bag:g.validateInventoryState(payloads[0],facts),gear:g.validateEquipmentState(payloads[1],equipmentContext),
    wallet:g.validateCurrencyWalletState(payloads[2]),claim:g.validateRewardClaimState(payloads[3])};
  assert.deepEqual([next.bag.inventoryId,next.gear.equipmentId,next.wallet.walletId,next.claim.claimId],keys.map(k=>k.stateId),'L4 record/payload identity binding');
  for(const value of [next.bag,next.gear,next.wallet])assert.deepEqual(value.owner,owner,'L4 current owner binding');
  assert.deepEqual(next.claim.recipient,{kind:'player',id:'p1'},'L4 recipient binding');
  const ids=[...next.bag.entries,...next.gear.entries].map(entry=>entry.item.instanceId);
  assert.equal(new Set(ids).size,ids.length,'L4 duplicate cross-storage Item');
  if(holder.current!==base)return 'stale';
  holder.current=Object.freeze(next);
  return 'published';
}

test('ST16/ST17 actual multi-owner JSON roundtrip preserves literal state, links and claimed reward without execution',()=>{
  const captured=archive(),literal={formatVersion:1,records:Object.values(expected).map((payload,i)=>({...keys[i],schemaVersion:1,payload}))};
  assert.deepEqual(captured,literal);frozen(captured);
  const raw=JSON.parse(JSON.stringify(captured));
  assert.deepEqual(raw,literal);assert.equal(Object.getPrototypeOf(raw),Object.prototype);assert.equal(Object.isFrozen(raw),false);
  const checked=g.validateGameplayStateArchive(raw);assert.deepEqual(checked,literal);frozen(checked);
  const base=snapshots(),holder={current:base};
  assert.equal(publish(holder,base,checked),'published');assert.deepEqual(holder.current,expected);frozen(holder.current);
  assert.notEqual(holder.current.bag,raw.records[0].payload);
  assert.notEqual(holder.current.bag.entries[0].item.properties.gems,checked.records[0].payload.entries[0].item.properties.gems);
  assert.notEqual(holder.current.bag.entries[0].item.properties.gems,base.bag.entries[0].item.properties.gems);
  assert.notEqual(holder.current.bag.entries[0].item.properties.gems,raw.records[0].payload.entries[0].item.properties.gems);
  assert.notEqual(holder.current.gear.entries[0].slotIds,raw.records[1].payload.entries[0].slotIds);
  assert.notEqual(holder.current.wallet.balances,raw.records[2].payload.balances);
  assert.notEqual(holder.current.claim.reward.lines,raw.records[3].payload.reward.lines);
  raw.records[0].payload.entries[0].quantity=9;assert.deepEqual(holder.current,expected);
  // A separate explicit replay attempt remains rejected; restore itself never claims.
  assert.deepEqual(g.prepareRewardClaim(holder.current.claim,{eligible:true}),{status:'rejected',reason:'already_claimed',candidate:null,grants:[]});
});

test('ST18 incompatible, corrupt, missing/bad binding and duplicate cross-owner inputs never publish',()=>{
  const cases=[
    {edit:a=>{a.formatVersion=2;},reason:'unsupported_format'},
    {edit:a=>{a.records[0].schemaVersion=2;},reason:'unsupported_schema'},
    {edit:a=>{a.records.pop();},reason:'missing_required'},
    {edit:a=>{a.records[0].payload.entries[0].quantity=0;},error:TypeError},
    {edit:a=>{a.records[2].payload.balances[0].amount=-1;},error:TypeError},
    {edit:a=>{a.records[1].payload.entries[0].item.instanceId='bag-blade';},error:/duplicate cross-storage/},
    {edit:a=>{a.records[1].payload.owner.ownerId='other';},error:/owner binding/},
    {edit:a=>{a.records[3].payload.recipient.id='other';},error:/recipient binding/},
    {edit:a=>{a.records[2].payload.walletId='other';},error:/identity binding/},
    {edit:a=>{a.records[0].payload.entries[0].item.definitionId='missing';},error:TypeError},
    {edit:()=>{},facts:{items:[]},error:TypeError},
    {edit:a=>{a.records[0].payload.entries[0].item.properties.bad=undefined;},error:TypeError},
  ];
  for(const scenario of cases) {
    const input=JSON.parse(JSON.stringify(archive()));scenario.edit(input);
    const base=snapshots(),before=JSON.stringify(base),holder={current:base};
    if(scenario.error)assert.throws(()=>publish(holder,base,input,scenario.facts),scenario.error);
    else assert.equal(publish(holder,base,input),scenario.reason);
    assert.equal(holder.current,base);assert.equal(JSON.stringify(holder.current),before);
  }
  // Fail before JSON.stringify could silently discard this value.
  const bad=JSON.parse(JSON.stringify(archive()));bad.records[0].payload.entries[0].item.properties.bad=undefined;
  assert.throws(()=>g.validateGameplayStateArchive(bad),TypeError);
});

test('ST18/ST20 deterministic repeated validation and stale L4 baseline rejection',()=>{
  const input=JSON.parse(JSON.stringify(archive())),before=JSON.stringify(input);
  const first={current:snapshots()},second={current:snapshots()};
  assert.equal(publish(first,first.current,input),'published');assert.equal(publish(second,second.current,input),'published');
  assert.deepEqual(first.current,expected);assert.deepEqual(second.current,expected);assert.notEqual(first.current.bag,second.current.bag);
  assert.equal(JSON.stringify(input),before);
  const old=first.current,newer=snapshots();first.current=newer;
  assert.equal(publish(first,old,input),'stale');assert.equal(first.current,newer);assert.deepEqual(first.current,expected);
});
