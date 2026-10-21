import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import * as g from '@rpg/gameplay';

function contract(ids,title,run){
  test('Item closure '+title,()=>{
    let assertions=0;
    const a=new Proxy(assert,{get(target,key){return(...args)=>{assertions++;return target[key](...args);};}});
    run(a);assert.ok(assertions>0,'Item closure contract requires actual assertions');
    for(const id of ids.split(' '))console.log('ITEM_'+id+'_PASS');
  });
}
// Readers only: these are neither Inventory nor Equipment implementations.
const inventoryRead=(definition,instance)=>({definitionId:definition.definitionId,instanceId:instance.instanceId,properties:instance.properties});
const equipmentRead=(definition,instance)=>({categoryId:definition.categoryId,rarityId:definition.rarityId,tagIds:definition.tagIds,properties:instance.properties});
const content=()=>({categoryId:'opaque',tagIds:['b','a'],rarityId:null,properties:{defaultOnly:99,nested:{label:'definition'}}});
const initial=()=>({instanceId:' A道 ',properties:{charge:1,note:null,nested:{path:[1,2]}}});
const definition=()=>g.createItemDefinition({definitionId:' D道 '},content());
function flow(){
  const reference=g.createItemDefinitionReference({definitionId:' D道 '}),d=g.validateItemDefinition(g.createItemDefinition(reference,content()));
  const before=g.createItemInstance(d,initial()),validated=g.validateItemInstance(d,before);
  const instanceReference=g.createItemInstanceReference(reference,{instanceId:' A道 '});
  const checkedReference=g.validateItemInstanceReference(reference,instanceReference);
  const set=g.setItemInstanceProperty(d,before,'charge',2,{eligible:true});
  assert.equal(set.status,'accepted');
  const replaced=g.replaceItemInstanceProperties(d,g.validateItemInstance(d,set.candidate),{note:null,grade:3,nested:{a:1,b:[2,3]}},{eligible:true});
  assert.equal(replaced.status,'accepted');
  const candidate=g.validateItemInstance(d,replaced.candidate);
  const other=g.createItemInstance(d,{instanceId:'B',properties:{nested:{b:[2,3],a:1},grade:3,note:null}});
  return {reference,definition:d,instanceReference,checkedReference,before,validated,
    present:g.getItemInstanceProperty(d,before,'charge'),missing:g.getItemInstanceProperty(d,before,'defaultOnly'),
    explicitNull:g.getItemInstanceProperty(d,before,'note'),set,replaced,candidate,
    empty:g.replaceItemInstanceProperties(d,candidate,{},{eligible:true}),
    policy:g.validateItemStackPolicy({stackable:true}),
    compatible:g.assessItemStackCompatibility(d,candidate,d,other,{stackable:true}),
    inventory:inventoryRead(d,candidate),equipment:equipmentRead(d,candidate)};
}
// Independent handwritten values; no Item function computes the oracle.
const expectedBefore={instanceId:' A道 ',definitionId:' D道 ',properties:{charge:1,note:null,nested:{path:[1,2]}}};
const expectedCandidate={instanceId:' A道 ',definitionId:' D道 ',properties:{note:null,grade:3,nested:{a:1,b:[2,3]}}};
const expectedTrace={
  reference:{definitionId:' D道 '},
  definition:{definitionId:' D道 ',categoryId:'opaque',tagIds:['b','a'],rarityId:null,properties:{defaultOnly:99,nested:{label:'definition'}}},
  instanceReference:{instanceId:' A道 ',definitionId:' D道 '},checkedReference:{instanceId:' A道 ',definitionId:' D道 '},
  before:expectedBefore,validated:expectedBefore,present:{found:true,value:1},missing:{found:false},explicitNull:{found:true,value:null},
  set:{status:'accepted',reason:'none',candidate:{instanceId:' A道 ',definitionId:' D道 ',properties:{charge:2,note:null,nested:{path:[1,2]}}}},
  replaced:{status:'accepted',reason:'none',candidate:expectedCandidate},candidate:expectedCandidate,
  empty:{status:'accepted',reason:'none',candidate:{instanceId:' A道 ',definitionId:' D道 ',properties:{}}},
  policy:{stackable:true},compatible:{compatible:true,reason:'none'},
  inventory:{definitionId:' D道 ',instanceId:' A道 ',properties:{note:null,grade:3,nested:{a:1,b:[2,3]}}},
  equipment:{categoryId:'opaque',rarityId:null,tagIds:['b','a'],properties:{note:null,grade:3,nested:{a:1,b:[2,3]}}},
};
function frozen(a,value){
  if(value!==null&&typeof value==='object'){
    a.equal(Object.isFrozen(value),true,'deep frozen snapshot');
    for(const key of Object.keys(value))frozen(a,value[key]);
  }
}

contract('C01 C02 C04 C05 C06 C08 C18 C19','end to end',a=>{
  const trace=flow();a.deepEqual(trace,expectedTrace,'complete literal Item flow');
  a.notEqual(trace.validated,trace.before);a.notEqual(trace.validated.properties,trace.before.properties);
  a.notEqual(trace.instanceReference,trace.checkedReference);
  a.deepEqual(trace.before,expectedBefore,'old instance unchanged');
  a.equal(Object.hasOwn(trace.missing,'value'),false,'absent has no value');
  a.deepEqual(Object.keys(trace.candidate),['instanceId','definitionId','properties'],'no storage/quantity/slot fields');
});

contract('C03 C07','malformed and admission',a=>{
  const d=definition(),i=g.createItemInstance(d,initial());let calls=0;
  const getter=Object.defineProperty({},'bad',{get(){calls++;throw Error('getter ran');}}),cycle={};cycle.self=cycle;
  for(const invalid of ['', '   ',null,1])a.throws(()=>g.createItemDefinitionReference({definitionId:invalid}),TypeError);
  for(const metadata of [{...content(),tagIds:['x','x']},{...content(),categoryId:0},{...content(),rarityId:''}])a.throws(()=>g.createItemDefinition({definitionId:'D'},metadata),TypeError);
  for(const bad of [getter,cycle,[,1],new Date(),{[Symbol()]:1},{bad:undefined}]){
    a.throws(()=>g.setItemInstanceProperty(d,i,'x',bad,{eligible:false}),TypeError,'invalid despite false admission');
    a.throws(()=>g.replaceItemInstanceProperties(d,i,{nested:bad},{eligible:false}),TypeError);
    a.throws(()=>g.assessItemStackCompatibility(d,i,d,{...i,properties:{bad}},{stackable:false}),TypeError);
  }
  a.equal(calls,0,'getter never invoked');
  a.throws(()=>g.validateItemInstance(d,{...i,definitionId:'other'}),TypeError,'canonical binding');
  for(const result of [g.setItemInstanceProperty(d,i,'charge',2,{eligible:false}),g.replaceItemInstanceProperties(d,i,{},{eligible:false})]){
    a.deepEqual(result,{status:'rejected',reason:'ineligible',candidate:null},'false admission has no candidate');frozen(a,result);
  }
});

contract('C09 C10 C11','compatibility',a=>{
  const d=definition(),i=g.createItemInstance(d,initial());
  const j=g.createItemInstance(d,{instanceId:'B',properties:{nested:{path:[1,2]},note:null,charge:1}});
  a.deepEqual(g.assessItemStackCompatibility(d,i,d,j,{stackable:true}),{compatible:true,reason:'none'},'record insertion order irrelevant');
  const other=g.createItemDefinition({definitionId:'other'},content());
  for(const [right,rightInstance,policy,reason]of [
    [other,g.createItemInstance(other,{instanceId:' A道 ',properties:{}}),false,'same_instance'],
    [other,g.createItemInstance(other,{instanceId:'B',properties:{}}),false,'different_definition'],
    [{...d,rarityId:'conflict'},{...j,properties:{}},false,'definition_conflict'],
    [d,j,false,'not_stackable'],
    [d,{...j,properties:{charge:2}},true,'different_properties'],
    [d,{...j,properties:{charge:1,note:null,nested:{path:[2,1]}}},true,'different_properties'],
  ])a.deepEqual(g.assessItemStackCompatibility(d,i,right,rightInstance,{stackable:policy}),{compatible:false,reason},'compatibility reason '+reason);
  a.deepEqual(g.assessItemStackCompatibility(d,{...i,properties:{n:0}},d,{...j,properties:{n:-0}},{stackable:true}),{compatible:false,reason:'different_properties'});
});

contract('C12 C13','isolation',a=>{
  const input=content(),seed=initial(),d=g.createItemDefinition({definitionId:' D道 '},input),i=g.createItemInstance(d,seed);
  const value={values:[4]},replacement={nested:{values:[8]}};
  const set=g.setItemInstanceProperty(d,i,'extra',value,{eligible:true});
  const replaced=g.replaceItemInstanceProperties(d,i,replacement,{eligible:true});
  input.tagIds.push('later');input.properties.nested.label='changed';seed.properties.nested.path[0]=9;
  value.values[0]=99;replacement.nested.values.push(9);
  a.deepEqual(d,{definitionId:' D道 ',categoryId:'opaque',tagIds:['b','a'],rarityId:null,properties:{defaultOnly:99,nested:{label:'definition'}}},'definition detached');
  a.deepEqual(i,expectedBefore,'instance detached');
  a.deepEqual(set,{status:'accepted',reason:'none',candidate:{instanceId:' A道 ',definitionId:' D道 ',properties:{charge:1,note:null,nested:{path:[1,2]},extra:{values:[4]}}}},'set payload detached');
  a.deepEqual(replaced,{status:'accepted',reason:'none',candidate:{instanceId:' A道 ',definitionId:' D道 ',properties:{nested:{values:[8]}}}},'replacement detached');
  for(const caller of [input,input.tagIds,input.properties.nested,seed,seed.properties.nested.path,value,value.values,replacement.nested.values])a.equal(Object.isFrozen(caller),false,'caller remains mutable');
  const {inventory,equipment,...snapshots}=flow();
  for(const snapshot of [d,i,set,replaced,...Object.values(snapshots)])frozen(a,snapshot);
  // Reader envelopes belong to this fixture; handed-off Item values remain frozen.
  frozen(a,inventory.properties);frozen(a,equipment.properties);frozen(a,equipment.tagIds);
  a.throws(()=>{set.candidate.properties.extra.values.push(5);},TypeError,'snapshot mutation blocked');
});

contract('C14','replay',a=>{
  const first=flow(),second=flow();a.deepEqual(first,expectedTrace,'first independent full trace');a.deepEqual(second,expectedTrace,'second independent full trace');
  a.notEqual(first.definition,second.definition);a.notEqual(first.candidate.properties,second.candidate.properties);
  const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
  a.equal(hash(first),hash(expectedTrace));a.equal(hash(second),hash(expectedTrace));
  console.log('ITEM_CLOSURE_REPLAY_SHA256 '+hash(expectedTrace));
});

function profile(a,fixture){
  const d=g.createItemDefinition({definitionId:fixture.id},fixture.content);
  const i=g.createItemInstance(d,{instanceId:fixture.instanceId,properties:fixture.properties});
  a.deepEqual(d,fixture.expectedDefinition,'profile definition');a.deepEqual(i,fixture.expectedInstance,'profile instance');
  a.deepEqual(g.getItemInstanceProperty(d,i,'payload'),{found:true,value:fixture.properties.payload},'profile inspect');
  a.deepEqual(g.getItemInstanceProperty(d,i,'absent'),{found:false});
  const proposed=g.setItemInstanceProperty(d,i,'reviewed',true,{eligible:true});
  a.deepEqual(proposed,fixture.expectedProposal,'profile candidate');
  const other=g.createItemInstance(d,{instanceId:fixture.instanceId+'-other',properties:fixture.properties});
  a.deepEqual(g.assessItemStackCompatibility(d,i,d,other,{stackable:fixture.stackable}),fixture.expectedCompatibility);
  a.deepEqual(inventoryRead(d,i),fixture.expectedInstance,'profile read handoff');
  a.throws(()=>g.validateItemInstance(d,{...i,sourceType:'profile'}),TypeError,'profile invalid shape');
}

contract('C15','Text RPG',a=>{
  profile(a,{id:'text-potion',instanceId:'text-A',content:{categoryId:'consumable',tagIds:[],rarityId:null,properties:{description:'opaque text'}},properties:{payload:'sealed'},stackable:true,
    expectedDefinition:{definitionId:'text-potion',categoryId:'consumable',tagIds:[],rarityId:null,properties:{description:'opaque text'}},
    expectedInstance:{instanceId:'text-A',definitionId:'text-potion',properties:{payload:'sealed'}},
    expectedProposal:{status:'accepted',reason:'none',candidate:{instanceId:'text-A',definitionId:'text-potion',properties:{payload:'sealed',reviewed:true}}},expectedCompatibility:{compatible:true,reason:'none'}});
  const quest=g.createItemDefinition({definitionId:'text-quest'},{categoryId:'quest',tagIds:['story'],rarityId:null,properties:{title:'Letter'}});
  a.deepEqual(equipmentRead(quest,g.createItemInstance(quest,{instanceId:'letter-A',properties:{read:false}})),{categoryId:'quest',rarityId:null,tagIds:['story'],properties:{read:false}});
});

contract('C16','RPG 2D',a=>{
  profile(a,{id:'2d-weapon',instanceId:'weapon-A',content:{categoryId:'weapon',tagIds:['sword'],rarityId:'opaque-blue',properties:{sprite:{frame:4}}},properties:{payload:{durability:7,marks:['x','y']}},stackable:false,
    expectedDefinition:{definitionId:'2d-weapon',categoryId:'weapon',tagIds:['sword'],rarityId:'opaque-blue',properties:{sprite:{frame:4}}},
    expectedInstance:{instanceId:'weapon-A',definitionId:'2d-weapon',properties:{payload:{durability:7,marks:['x','y']}}},
    expectedProposal:{status:'accepted',reason:'none',candidate:{instanceId:'weapon-A',definitionId:'2d-weapon',properties:{payload:{durability:7,marks:['x','y']},reviewed:true}}},expectedCompatibility:{compatible:false,reason:'not_stackable'}});
  const armor=g.createItemDefinition({definitionId:'2d-armor'},{categoryId:'armor',tagIds:[],rarityId:null,properties:{atlas:'body'}});
  a.deepEqual(equipmentRead(armor,g.createItemInstance(armor,{instanceId:'armor-A',properties:{wear:2}})),{categoryId:'armor',rarityId:null,tagIds:[],properties:{wear:2}});
});

contract('C17','RPG 25D',a=>{
  profile(a,{id:'25d-material',instanceId:'ore-A',content:{categoryId:'material',tagIds:['ore','metal'],rarityId:'opaque',properties:{view:{angle:30},attributes:{grade:[1,2]}}},properties:{payload:{batch:{name:'道',quality:2}}},stackable:true,
    expectedDefinition:{definitionId:'25d-material',categoryId:'material',tagIds:['ore','metal'],rarityId:'opaque',properties:{view:{angle:30},attributes:{grade:[1,2]}}},
    expectedInstance:{instanceId:'ore-A',definitionId:'25d-material',properties:{payload:{batch:{name:'道',quality:2}}}},
    expectedProposal:{status:'accepted',reason:'none',candidate:{instanceId:'ore-A',definitionId:'25d-material',properties:{payload:{batch:{name:'道',quality:2}},reviewed:true}}},expectedCompatibility:{compatible:true,reason:'none'}});
  const gear=g.createItemDefinition({definitionId:'25d-gear'},{categoryId:'equipment',tagIds:['opaque'],rarityId:null,properties:{view:{mesh:'fixture'}}});
  a.deepEqual(equipmentRead(gear,g.createItemInstance(gear,{instanceId:'gear-A',properties:{tint:{r:1}}})),{categoryId:'equipment',rarityId:null,tagIds:['opaque'],properties:{tint:{r:1}}});
});

contract('C20','source neutral',a=>{
  const d=definition();
  const inputs=[{source:'loot-fixture',initial:{instanceId:'source-A',properties:{grade:2}}},{source:'reward-fixture',initial:{instanceId:'source-A',properties:{grade:2}}}];
  for(const input of inputs){
    const result=g.createItemInstance(d,input.initial);
    a.deepEqual(result,{instanceId:'source-A',definitionId:' D道 ',properties:{grade:2}},'same factory regardless of external source');
    a.deepEqual(Object.keys(result),['instanceId','definitionId','properties']);
    for(const forbidden of ['sourceType','rewardId','lootContext','ownerId','equipped','location','quantity'])a.equal(Object.hasOwn(result,forbidden),false);
    a.throws(()=>g.createItemInstance(d,{...input.initial,sourceType:input.source}),TypeError);
  }
  // Repeated caller IDs are structurally valid; they are not global uniqueness proof.
  a.deepEqual(g.createItemInstance(d,inputs[0].initial),g.createItemInstance(d,inputs[1].initial));
});

contract('C21 C24','composition and inventory',a=>{
  const itemNames=['createItemDefinitionReference','createItemInstanceReference','validateItemInstanceReference','createItemDefinition','validateItemDefinition','createItemInstance','validateItemInstance','getItemInstanceProperty','setItemInstanceProperty','replaceItemInstanceProperties','validateItemStackPolicy','assessItemStackCompatibility'];
  a.deepEqual(Object.keys(g).filter(name=>name.includes('Item')).sort(),itemNames.sort(),'exact Item runtime names');
  let r=g.createModuleRegistry();r=g.registerModule(r,{id:'entity',optional:true,dependencies:[]});r=g.registerModule(r,{id:'item',optional:true,dependencies:[]});
  a.deepEqual(g.composeModules(r,g.configureModules(r,{enable:['item'],disable:['entity']})).moduleIds,['item']);
  a.deepEqual(g.composeModules(r,g.configureModules(r,{enable:['entity'],disable:['item']})).moduleIds,['entity']);
  a.deepEqual(g.composeModules(r,g.configureModules(r)).moduleIds,[]);
});
