import test from 'node:test';
import assert from 'node:assert/strict';

// Shared evidence only: direct runner supplies built root; installed runner supplies
// the physically installed root. No production coordinator or test-local calculator.
export function equipmentIntegrationTests(g) {
 const yes={eligible:true};
 const profiles=[
  {name:'Text',owner:{ownerKind:'player',ownerId:'reader'},slot:'weapon_main'},
  {name:'2D',owner:{ownerKind:'companion',ownerId:'sprite'},slot:'grip/left'},
  {name:'2.5D',owner:{ownerKind:'monster',ownerId:'agent'},slot:'socket:primary'},
 ];
 function setup(profile=profiles[0],stackable=false) {
  const definition=g.createItemDefinition({definitionId:'blade'},
   {categoryId:null,tagIds:[],rarityId:null,properties:{catalogOnly:77}});
  const a=g.createItemInstance(definition,{instanceId:'sword-A',properties:{flatPower:5,gem:{values:[2]}}});
  const b=g.createItemInstance(definition,{instanceId:'sword-B',properties:{flatPower:9,gem:{values:[3]}}});
  const context={items:[{definition}]};
  const inventoryContext={items:[{definition,stackPolicy:{stackable},maxStackQuantity:stackable?10:null}]};
  const empty=g.createEquipmentState({equipmentId:'gear',owner:profile.owner,entries:[]},context);
  const bag=entries=>g.createInventoryState({inventoryId:'bag',owner:profile.owner,entries},inventoryContext);
  return {a,b,context,inventoryContext,empty,bag};
 }
 const itemA={instanceId:'sword-A',definitionId:'blade',properties:{flatPower:5,gem:{values:[2]}}};
 const itemB={instanceId:'sword-B',definitionId:'blade',properties:{flatPower:9,gem:{values:[3]}}};
 function frozen(value) {
  if(value!==null&&typeof value==='object') {assert.ok(Object.isFrozen(value));for(const child of Object.values(value))frozen(child);}
 }
 function accepted(result) {assert.equal(result.status,'accepted');assert.equal(result.reason,'none');frozen(result);return result.candidate;}
 function reject(result,reason) {assert.deepEqual(result,{status:'rejected',reason,candidate:null,released:null});frozen(result);}
 function unique(pair) {
  const ids=[...pair.bag.entries.map(e=>e.item.instanceId),...pair.gear.entries.map(e=>e.item.instanceId)];
  assert.equal(new Set(ids).size,ids.length,'L4 cross-storage uniqueness');
 }

 test('EQ16/EQ19 installed-compatible lifecycle: literal full traces, profiles, rejections and immutable replay',()=>{
  for(const profile of profiles) {
   const run=()=>{
    const {a,b,context,empty}=setup(profile),slot=profile.slot;
    assert.deepEqual(g.listEquippedEntries(empty,context),[]);
    assert.equal(g.getEquippedEntryBySlot(empty,context,slot),null);
    assert.deepEqual(g.assessEquipmentAdmission(empty,context,a,[slot],yes),{allowed:true,reason:'none'});
    const equip=g.equipEquipmentItem(empty,context,a,[slot],yes),one=accepted(equip);
    assert.deepEqual(g.listEquippedEntries(one,context),[{item:itemA,slotIds:[slot]}]);
    const queried=g.getEquippedEntryBySlot(one,context,slot);
    assert.deepEqual(queried,{item:itemA,slotIds:[slot]});assert.notEqual(queried,one.entries[0]);
    assert.equal(g.hasEquippedItem(one,context,'sword-A'),true);
    const replace=g.replaceEquipmentItem(one,context,'sword-A',b,[slot],yes),two=accepted(replace);
    const unequip=g.unequipEquipmentItem(two,context,'sword-B',yes),none=accepted(unequip);
    const trace=[empty,equip,replace,unequip];
    assert.deepEqual(trace,[
     {equipmentId:'gear',owner:profile.owner,entries:[]},
     {status:'accepted',reason:'none',candidate:{equipmentId:'gear',owner:profile.owner,entries:[{item:itemA,slotIds:[slot]}]},released:null},
     {status:'accepted',reason:'none',candidate:{equipmentId:'gear',owner:profile.owner,entries:[{item:itemB,slotIds:[slot]}]},released:itemA},
     {status:'accepted',reason:'none',candidate:{equipmentId:'gear',owner:profile.owner,entries:[]},released:itemB},
    ]);
    for(const state of [empty,one,two,none])assert.deepEqual(g.validateEquipmentState(state,context),state);
    frozen(queried);assert.throws(()=>queried.slotIds.push('x'),TypeError);
    assert.notEqual(replace.released,a);assert.notEqual(replace.released.properties.gem,a.properties.gem);
    assert.throws(()=>replace.released.properties.gem.values.push(8),TypeError);
    reject(g.equipEquipmentItem(one,context,a,['free'],yes),'already_equipped');
    reject(g.equipEquipmentItem(one,context,b,[slot],yes),'slot_occupied');
    reject(g.equipEquipmentItem(one,context,b,['free',slot],yes),'slot_occupied');
    reject(g.equipEquipmentItem(empty,context,a,[slot],{eligible:false}),'ineligible');
    reject(g.replaceEquipmentItem(one,context,'missing',b,[slot],yes),'not_equipped');
    reject(g.unequipEquipmentItem(one,context,'missing',yes),'not_equipped');
    assert.throws(()=>g.equipEquipmentItem(one,context,{...b,definitionId:'missing'},[slot],{eligible:false}),TypeError);
    assert.throws(()=>g.validateEquipmentState({...one,entries:[one.entries[0],{item:b,slotIds:[slot,'other']}]},context),TypeError);
    const multi=accepted(g.equipEquipmentItem(empty,context,a,['left','right'],yes));
    assert.deepEqual(multi.entries,[{item:itemA,slotIds:['left','right']}]);
    assert.deepEqual(accepted(g.unequipEquipmentItem(multi,context,'sword-A',yes)).entries,[]);
    return trace;
   };
   const first=run(),second=run();assert.deepEqual(first,second);assert.notEqual(first[1].candidate,second[1].candidate);
  }
  // Mutable caller data must remain mutable; neither returned state nor release aliases it.
  const {context,empty}=setup(),raw=structuredClone(itemA),slots=['raw'];
  const equipped=accepted(g.equipEquipmentItem(empty,context,raw,slots,yes));
  const removed=g.unequipEquipmentItem(equipped,context,'sword-A',yes);accepted(removed);
  assert.equal(Object.isFrozen(raw.properties.gem.values),false);
  raw.properties.gem.values[0]=90;slots[0]='changed';
  assert.deepEqual(equipped.entries,[{item:itemA,slotIds:['raw']}]);assert.deepEqual(removed.released,itemA);
 });

 test('EQ17 L4 two-candidate handoff: exact quantity-one identity, stale/rejected/full-bag rollback, no split',()=>{
  const {a,b,context,inventoryContext,empty,bag}=setup();
  let current=Object.freeze({bag:bag([{item:a,quantity:1}]),gear:empty});
  const initial=current;
  // Fixture-local single publication. It proves no DB/durable/distributed transaction.
  const publish=(base,bagResult,gearResult)=>{
   if(current!==base||bagResult.status!=='accepted'||gearResult.status!=='accepted')return false;
   const next=Object.freeze({bag:bagResult.candidate,gear:gearResult.candidate});unique(next);current=next;return true;
  };
  const member=g.getInventoryEntry(initial.bag,inventoryContext,'sword-A');
  assert.equal(member.quantity,1);assert.deepEqual(member.item,itemA);
  assert.deepEqual(initial.bag.owner,initial.gear.owner);assert.equal(g.hasEquippedItem(initial.gear,context,'sword-A'),false);
  const stageEquip=(base,facts,admission)=>{
   const source=g.getInventoryEntry(base.bag,facts,'sword-A');
   if(source===null||source.quantity!==1)return {reason:'quantity_not_one'};
   assert.deepEqual(base.bag.owner,base.gear.owner);
   assert.equal(g.hasEquippedItem(base.gear,context,source.item.instanceId),false);
   return {remove:g.removeInventoryEntry(base.bag,facts,source.item.instanceId,yes),
    equip:g.equipEquipmentItem(base.gear,context,source.item,['weapon_main'],admission)};
  };
  const staged=stageEquip(initial,inventoryContext,{eligible:false}),remove=staged.remove,denied=staged.equip;
  assert.equal(remove.status,'accepted');reject(denied,'ineligible');
  assert.equal(publish(initial,remove,denied),false);assert.equal(current,initial);
  const equip=stageEquip(initial,inventoryContext,yes).equip;
  assert.equal(current,initial);assert.deepEqual(initial.bag.entries,[{item:itemA,quantity:1}]);
  assert.equal(publish(initial,remove,equip),true);const equipped=current;unique(equipped);
  assert.deepEqual(equipped,{bag:{inventoryId:'bag',owner:profiles[0].owner,entries:[]},
   gear:{equipmentId:'gear',owner:profiles[0].owner,entries:[{item:itemA,slotIds:['weapon_main']}]}});
  assert.equal(Object.hasOwn(equipped.gear.entries[0],'quantity'),false);
  assert.equal(publish(initial,remove,equip),false);assert.equal(current,equipped,'stale baseline cannot publish');
  const unequip=g.unequipEquipmentItem(equipped.gear,context,'sword-A',yes);accepted(unequip);assert.deepEqual(unequip.released,itemA);
  const entry={item:unequip.released,quantity:1};
  const full=g.addInventoryEntry(equipped.bag,inventoryContext,entry,{maxEntries:0},yes);
  assert.deepEqual(full,{status:'rejected',reason:'capacity_exceeded',candidate:null});
  assert.equal(publish(equipped,full,unequip),false);assert.equal(current,equipped);unique(current);
  const no=g.addInventoryEntry(equipped.bag,inventoryContext,entry,{maxEntries:1},{eligible:false});
  assert.equal(no.reason,'ineligible');assert.equal(publish(equipped,no,unequip),false);assert.equal(current,equipped);
  // A physically occupied bag also denies return without dropping the equipped sword.
  current=Object.freeze({bag:bag([{item:b,quantity:1}]),gear:equipped.gear});const occupied=current;
  const capacity=g.addInventoryEntry(occupied.bag,inventoryContext,entry,{maxEntries:1},yes);
  assert.equal(capacity.reason,'capacity_exceeded');assert.equal(publish(occupied,capacity,unequip),false);assert.equal(current,occupied);
  current=equipped;
  const returned=g.addInventoryEntry(equipped.bag,inventoryContext,entry,{maxEntries:1},yes);
  assert.equal(publish(equipped,returned,unequip),true);assert.deepEqual(current,initial);unique(current);
  assert.deepEqual(initial.bag.entries,[{item:itemA,quantity:1}]);assert.deepEqual(initial.gear.entries,[]);
  // A valid stack is representable but L4 refuses wholesale equip; no split/new ID.
  const stacked=setup(profiles[0],true),stack=stacked.bag([{item:stacked.a,quantity:2}]);
  const stackPair={bag:stack,gear:stacked.empty};
  assert.deepEqual(stageEquip(stackPair,stacked.inventoryContext,yes),{reason:'quantity_not_one'});
  assert.deepEqual(stack.entries,[{item:itemA,quantity:2}]);assert.deepEqual(stacked.empty.entries,[]);
 });

 test('EQ17 safe cross-storage replacement stages released Item admission and conserves both identities',()=>{
  const {a,b,context,inventoryContext,empty,bag}=setup();
  const initial={bag:bag([{item:b,quantity:1}]),gear:accepted(g.equipEquipmentItem(empty,context,a,['weapon_main'],yes))};
  const run=maxEntries=>{
   let current=initial;
   const replacement=g.getInventoryEntry(initial.bag,inventoryContext,'sword-B');assert.equal(replacement.quantity,1);
   const removed=g.removeInventoryEntry(initial.bag,inventoryContext,'sword-B',yes);const stagedBag=accepted(removed);
   const swap=g.replaceEquipmentItem(initial.gear,context,'sword-A',replacement.item,['weapon_main'],yes);accepted(swap);
   assert.deepEqual(swap.released,itemA);
   const returned=g.addInventoryEntry(stagedBag,inventoryContext,{item:swap.released,quantity:1},{maxEntries},yes);
   if(returned.status==='accepted')current=Object.freeze({bag:returned.candidate,gear:swap.candidate});
   unique(current);return {current,returned};
  };
  const failed=run(0);assert.equal(failed.returned.reason,'capacity_exceeded');assert.equal(failed.current,initial);
  assert.deepEqual(initial.bag.entries,[{item:itemB,quantity:1}]);assert.deepEqual(initial.gear.entries,[{item:itemA,slotIds:['weapon_main']}]);
  const success=run(1);assert.equal(success.returned.status,'accepted');
  assert.deepEqual(success.current,{bag:{inventoryId:'bag',owner:profiles[0].owner,entries:[{item:itemA,quantity:1}]},
   gear:{equipmentId:'gear',owner:profiles[0].owner,entries:[{item:itemB,slotIds:['weapon_main']}]}});
 });

 test('EQ18 canonical Entity/Core stats: explicit L3 Item mapping yields 25→30→34→25 without Equipment arithmetic',()=>{
  const run=()=>{
   const {a,b,context,empty}=setup(),actor=g.createEntity({id:'reader',kind:'player'});
   const attributes=g.createEntityAttributeState(actor,{strength:10}),before=structuredClone(attributes);
   const rule={default:0,bounds:{},enabled:true};
   const configuration={attributeOrder:['strength'],statOrder:['power'],attributeRules:{strength:rule},attributeBaselines:{strength:0},
    baseStats:{power:5},rules:{power:{...rule,default:5,scaling:[{attribute:'strength',coefficient:2,enabled:true}],training:0}},flatContributions:{},modifiers:[]};
   // L3 maps a chosen literal property; this is not a generic stat/property engine.
   const calculate=gear=>{
    const modifiers=g.listEquippedEntries(gear,context).map(({item})=>({
     identity:{source:'l3-equipment-fixture',sourceInstanceId:item.instanceId,id:'power'},
     target:'power',operation:'add_flat',value:item.properties.flatPower,enabled:true,
    }));
    return g.calculateEntityStats(attributes,{...configuration,modifiers});
   };
   const trace=[calculate(empty)];
   const one=accepted(g.equipEquipmentItem(empty,context,a,['weapon_main'],yes));trace.push(calculate(one));
   const two=accepted(g.replaceEquipmentItem(one,context,'sword-A',b,['weapon_main'],yes));trace.push(calculate(two));
   const none=accepted(g.unequipEquipmentItem(two,context,'sword-B',yes));trace.push(calculate(none));
   assert.deepEqual(trace,[
    {entityId:'reader',effectiveAttributes:{strength:10},stats:{power:25}},
    {entityId:'reader',effectiveAttributes:{strength:10},stats:{power:30}},
    {entityId:'reader',effectiveAttributes:{strength:10},stats:{power:34}},
    {entityId:'reader',effectiveAttributes:{strength:10},stats:{power:25}},
   ]);
   trace.forEach(frozen);assert.deepEqual(attributes,before);assert.deepEqual(configuration.modifiers,[]);return trace;
  };
  assert.deepEqual(run(),run());
 });
}
