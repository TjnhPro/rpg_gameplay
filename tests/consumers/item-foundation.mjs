import assert from 'node:assert/strict';
import test from 'node:test';
import * as g from '@rpg/gameplay';

function contract(ids, title, run) {
  test('Item foundation '+title, () => {
    let assertions = 0;
    const a = new Proxy(assert, {get(target, key) {return (...args) => {assertions++; return target[key](...args);};}});
    run(a);
    assert.ok(assertions > 0, 'Item contract requires actual assertions');
    for (const id of ids.split(' ')) console.log('ITEM_'+id+'_PASS');
  });
}
const reference = {definitionId:' Potion-Đạo '};
const content = () => ({categoryId:'unknown-category',tagIds:[' Rare ','rare','道'],rarityId:'unknown-rarity',
  properties:{amount:25,visuals:{tint:'red'},values:[null,false,0,'',-0]}});
const definition = () => g.createItemDefinition(reference,content());
const initial = () => ({instanceId:' Instance-Đạo ',properties:{quality:1,custom:{levels:[2,3]}}});
function frozen(a,value) {
  if (value !== null && typeof value === 'object') {
    a.equal(Object.isFrozen(value),true,'deep freeze');
    for (const key of Object.keys(value)) frozen(a,value[key]);
  }
}

contract('F01 F02','module and root',a=>{
  let registry=g.createModuleRegistry();
  registry=g.registerModule(registry,{id:'entity',optional:true,dependencies:[]});
  registry=g.registerModule(registry,{id:'item',optional:true,dependencies:[]});
  const selected=g.configureModules(registry,{enable:['item'],disable:['entity']});
  a.deepEqual(g.composeModules(registry,selected).moduleIds,['item']);
  a.equal(g.isModuleEnabled(selected,'entity'),false);
  a.deepEqual(g.configureModules(registry).enabledModuleIds,[]);
  a.deepEqual(Object.keys(g).filter(key=>key.includes('Item')).sort(),[
    'createItemDefinitionReference','createItemInstanceReference','validateItemInstanceReference',
    'createItemDefinition','validateItemDefinition','createItemInstance','validateItemInstance'].sort());
});

contract('F03 F04 F05','identity',a=>{
  const ref=g.createItemDefinitionReference(reference);
  a.deepEqual(ref,{definitionId:' Potion-Đạo '});a.notEqual(ref,reference);frozen(a,ref);
  const instance=g.createItemInstanceReference(ref,{instanceId:' Instance-Đạo '});
  a.deepEqual(instance,{instanceId:' Instance-Đạo ',definitionId:' Potion-Đạo '});frozen(a,instance);
  const next=g.validateItemInstanceReference(ref,instance);a.deepEqual(next,instance);a.notEqual(next,instance);
  a.throws(()=>g.validateItemInstanceReference(ref,{...instance,definitionId:'Potion-Đạo'}),TypeError,'exact reference binding');
  for(const value of ['', ' \t\n',null,undefined,1,false]) {
    a.throws(()=>g.createItemDefinitionReference({definitionId:value}),TypeError);
    a.throws(()=>g.createItemInstanceReference(ref,{instanceId:value}),TypeError);
    a.throws(()=>g.validateItemInstanceReference(ref,{...instance,instanceId:value}),TypeError);
  }
  let calls=0;
  const getter=Object.defineProperty({},'definitionId',{get(){calls++;throw Error('getter');}});
  for(const value of [null,[],{},Object.create({definitionId:'D'}),{...reference,extra:1},
    {...reference,[Symbol()]:1},Object.defineProperty({...reference},'extra',{value:1}),getter,new Date()])
    a.throws(()=>g.createItemDefinitionReference(value),TypeError);
  a.equal(calls,0,'reference getter never invoked');
  const nullRef=Object.assign(Object.create(null),reference);a.deepEqual(g.createItemDefinitionReference(nullRef),ref);
  a.throws(()=>g.createItemInstanceReference(definition(),{instanceId:'I'}),TypeError,'narrow reference is closed');
});

contract('F06 F07 F08','definition and keys',a=>{
  const data=content(),result=g.createItemDefinition(reference,data);
  a.deepEqual(result,{definitionId:' Potion-Đạo ',categoryId:'unknown-category',tagIds:[' Rare ','rare','道'],
    rarityId:'unknown-rarity',properties:{amount:25,visuals:{tint:'red'},values:[null,false,0,'',-0]}});
  a.equal(Object.is(result.properties.values[4],-0),true);
  const dangerous=JSON.parse('{"":"empty","__proto__":{"polluted":true},"constructor":false,"toString":null,"2":2,"道":[0]}');
  const nullMap=Object.assign(Object.create(null),dangerous);
  const safe=g.createItemDefinition(reference,{categoryId:null,tagIds:[],rarityId:null,properties:nullMap});
  a.deepEqual(safe.properties,JSON.parse('{"":"empty","__proto__":{"polluted":true},"constructor":false,"toString":null,"2":2,"道":[0]}'),'dangerous own keys preserved');
  a.equal(Object.hasOwn(safe.properties,'__proto__'),true);a.equal(Object.getPrototypeOf(safe.properties),Object.prototype);
  a.equal(Object.prototype.polluted,undefined);frozen(a,safe);
  const shared={value:3};const aliases=g.createItemDefinition(reference,{...content(),properties:{left:shared,right:shared}});
  a.deepEqual(aliases.properties,{left:{value:3},right:{value:3}});a.notEqual(aliases.properties.left,aliases.properties.right);
  for(const bad of [undefined,'',0,'  ']) for(const field of ['categoryId','rarityId'])
    a.throws(()=>g.createItemDefinition(reference,{...content(),[field]:bad}),TypeError);
  const extra=['a'];extra.extra=1;
  for(const tags of [undefined,null,['a','a'],[''],['a',1],Array(1),extra])
    a.throws(()=>g.createItemDefinition(reference,{...content(),tagIds:tags}),TypeError);
  a.throws(()=>g.validateItemDefinition({...result,extra:1}),TypeError);
});

contract('F09','hostile data',a=>{
  let calls=0;const accessor=Object.defineProperty({},'x',{get(){calls++;return 'unsafe';}});
  const arrayAccessor=Object.defineProperty([1],'0',{get(){calls++;return 1;}});
  const cycle={};cycle.self=cycle;const arrayCycle=[];arrayCycle.push(arrayCycle);
  const extra=[1];extra.extra=2;const symbolArray=[1];symbolArray[Symbol()]=2;
  class Custom {x=1;}
  const bad=[undefined,NaN,Infinity,-Infinity,1n,()=>1,Symbol(),new Date(),new Map(),new Set(),/x/,new Custom(),
    accessor,arrayAccessor,cycle,arrayCycle,Array(2),extra,symbolArray,{[Symbol()]:1},Object.create({inherited:1})];
  for(const value of bad) {
    a.throws(()=>g.createItemDefinition(reference,{...content(),properties:{nested:value}}),TypeError,'hostile recursive properties');
    a.throws(()=>g.createItemInstance(definition(),{instanceId:'I',properties:{nested:value}}),TypeError);
    a.throws(()=>g.validateItemInstance(definition(),{instanceId:'I',definitionId:reference.definitionId,properties:{nested:value}}),TypeError);
  }
  for(const properties of [null,[],undefined,new Custom()])a.throws(()=>g.createItemDefinition(reference,{...content(),properties}),TypeError);
  for(const trap of ['ownKeys','getOwnPropertyDescriptor','getPrototypeOf']) {
    const proxy=new Proxy({...reference},{[trap](){throw new Error('hostile trap');}});
    a.throws(()=>g.createItemDefinitionReference(proxy),TypeError);
  }
  const revoked=Proxy.revocable({},{});revoked.revoke();a.throws(()=>g.createItemDefinitionReference(revoked.proxy),TypeError);
  const noGet=new Proxy({...reference},{get(){calls++;throw Error('unsafe get');}});
  a.deepEqual(g.createItemDefinitionReference(noGet),reference);
  const full=definition();for(const key of Object.keys(full)) {
    const hostile=Object.defineProperty({...full},key,{get(){calls++;throw Error('getter');}});
    a.throws(()=>g.validateItemDefinition(hostile),TypeError);
    a.throws(()=>g.createItemInstance(hostile,initial()),TypeError,'complete definition validation');
    a.throws(()=>g.validateItemInstance(hostile,{instanceId:'I',definitionId:reference.definitionId,properties:{}}),TypeError);
  }
  a.equal(calls,0,'data getters never invoked');
});

contract('F10 F11 F12 F18','instance binding',a=>{
  const def=definition(),one=g.createItemInstance(def,initial());
  a.deepEqual(one,{instanceId:' Instance-Đạo ',definitionId:' Potion-Đạo ',properties:{quality:1,custom:{levels:[2,3]}}},'instance own properties only');
  const two=g.createItemInstance(def,{instanceId:'second',properties:{quality:1}});
  a.deepEqual(two,{instanceId:'second',definitionId:' Potion-Đạo ',properties:{quality:1}});a.notEqual(one.properties,two.properties);
  a.deepEqual(g.createItemInstance(def,initial()),one,'repeated IDs are structurally permitted');
  a.throws(()=>g.validateItemInstance(def,{...one,definitionId:'other'}),TypeError,'exact instance binding');
  a.throws(()=>g.createItemInstance({definitionId:'D'},initial()),TypeError);
  a.throws(()=>g.createItemInstance({...def,properties:{invalid:undefined}},initial()),TypeError);
  for(const field of ['quantity','ownerId','slot','store','maxStack']) {
    a.equal(Object.hasOwn(def,field),false);a.equal(Object.hasOwn(one,field),false);
    a.throws(()=>g.validateItemInstance(def,{...one,[field]:1}),TypeError);
    a.throws(()=>g.createItemInstance(def,{...initial(),[field]:1}),TypeError);
  }
  a.throws(()=>g.validateItemInstance(def,{instanceId:'I',properties:{}}),TypeError);
});

contract('F13 F14 F15','isolation',a=>{
  const data=content(),seed=initial(),def=g.createItemDefinition(reference,data),instance=g.createItemInstance(def,seed);
  const revalidated=g.validateItemDefinition(def),checked=g.validateItemInstance(def,instance);
  a.deepEqual(revalidated,def);a.notEqual(revalidated,def);a.notEqual(revalidated.tagIds,def.tagIds);a.notEqual(revalidated.properties.visuals,def.properties.visuals);
  a.deepEqual(checked,instance);a.notEqual(checked,instance);a.notEqual(checked.properties.custom,instance.properties.custom);
  data.properties.visuals.tint='blue';data.tagIds.push('later');seed.properties.custom.levels.push(9);
  a.equal(def.properties.visuals.tint,'red','detached definition');a.deepEqual(def.tagIds,[' Rare ','rare','道']);
  a.deepEqual(instance.properties.custom.levels,[2,3],'detached instance');
  a.equal(Object.isFrozen(data),false);a.equal(Object.isFrozen(data.properties.visuals),false);a.equal(Object.isFrozen(seed.properties.custom.levels),false);
  frozen(a,def);frozen(a,instance);frozen(a,revalidated);frozen(a,checked);
  a.throws(()=>{def.properties.visuals.tint='other';},TypeError);a.throws(()=>instance.properties.custom.levels.push(4),TypeError);
  a.equal(def.properties.visuals.tint,'red');a.deepEqual(instance.properties.custom.levels,[2,3]);
});

contract('F16','replay',a=>{
  const clock=Date.now,random=Math.random;
  try {
    Date.now=()=>{throw Error('ambient time');};Math.random=()=>{throw Error('ambient RNG');};
    const left=g.createItemInstance(definition(),initial()),right=g.createItemInstance(definition(),initial());
    a.deepEqual(left,right);a.notEqual(left,right);a.notEqual(left.properties,right.properties);
    a.deepEqual(Object.keys(left),['instanceId','definitionId','properties']);
    a.deepEqual(Object.keys(left.properties),['quality','custom']);
  } finally {Date.now=clock;Math.random=random;}
});

contract('F17 F19','future data probes',a=>{
  // Test-local shapes only; these do not implement any future owner or policy.
  const cases=[
    ['potion','consumable',['healing'],{amount:25},{quality:1}],
    ['sword','weapon',['unique'],{model:'sword'},{durability:17,refine:{level:2}}],
    ['ore','material',['stack-candidate'],{material:'iron'},{}],
    ['quest','quest',['bound'],{quest:'Q'},{binding:'caller-policy'}],
    ['affix',null,[],{}, {affixes:[{key:'opaque',value:3}]}],
    ['Text',null,[],{glyph:'!'},{label:'text'}],
    ['2D',null,[],{sprite:'opaque'},{tint:'blue'}],
    ['2.5D',null,[],{mesh:'opaque'},{view:{angle:2}}],
  ];
  for(const [definitionId,categoryId,tagIds,props,own] of cases) {
    const def=g.createItemDefinition({definitionId},{categoryId,tagIds,rarityId:null,properties:props});
    const state=g.createItemInstance(def,{instanceId:definitionId+'-1',properties:own});
    a.deepEqual(def,{definitionId,categoryId,tagIds,rarityId:null,properties:props});
    a.deepEqual(state,{instanceId:definitionId+'-1',definitionId,properties:own});
    // Future storage/content selection holds the same detached instance.
    const inventoryInput={item:state,quantity:2},equipmentInput={slotId:'caller-slot',item:state};
    a.equal(inventoryInput.item.instanceId,equipmentInput.item.instanceId);
    a.deepEqual(Object.keys(state),['instanceId','definitionId','properties']);
    a.deepEqual(g.createItemInstance(def,{instanceId:'explicit-loot-or-reward',properties:{}}),
      {instanceId:'explicit-loot-or-reward',definitionId,properties:{}});
  }
});
