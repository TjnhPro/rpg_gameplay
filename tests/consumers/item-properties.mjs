import assert from 'node:assert/strict';
import test from 'node:test';
import * as g from '@rpg/gameplay';

function contract(ids,title,run) {
  test('Item properties '+title,()=>{
    let assertions=0;
    const a=new Proxy(assert,{get(target,key){return (...args)=>{assertions++;return target[key](...args);};}});
    run(a);assert.ok(assertions>0,'Item property contract requires actual assertions');
    for(const id of ids.split(' '))console.log('ITEM_'+id+'_PASS');
  });
}
const definition=()=>g.createItemDefinition({definitionId:' D道 '},{categoryId:null,tagIds:[],rarityId:null,
  properties:{shared:'definition-only',charge:999}});
const before=()=>({instanceId:' I道 ',definitionId:' D道 ',properties:{charge:1,note:null}});
const yes={eligible:true},no={eligible:false};
function frozen(a,v){if(v!==null&&typeof v==='object'){a.equal(Object.isFrozen(v),true,'property deep freeze');for(const k of Object.keys(v))frozen(a,v[k]);}}
function expected(properties){return {status:'accepted',reason:'none',candidate:{instanceId:' I道 ',definitionId:' D道 ',properties}};}

contract('P01 P02 P03 P04 P05','read',a=>{
  const d=definition(),i=before();Object.assign(i.properties,{zero:0,off:false,empty:'',nested:{order:[{x:2},null]}});
  a.deepEqual(g.getItemInstanceProperty(d,i,'charge'),{found:true,value:1},'instance-only read');
  a.deepEqual(g.getItemInstanceProperty(d,i,'shared'),{found:false},'definition fallback forbidden');
  const absent=g.getItemInstanceProperty(d,i,'missing');a.deepEqual(absent,{found:false});a.equal(Object.hasOwn(absent,'value'),false);
  a.deepEqual(g.getItemInstanceProperty(d,i,'note'),{found:true,value:null},'present null');
  for(const [k,value]of [['zero',0],['off',false],['empty','']])a.deepEqual(g.getItemInstanceProperty(d,i,k),{found:true,value},'falsy remains present');
  const r=g.getItemInstanceProperty(d,i,'nested');a.deepEqual(r,{found:true,value:{order:[{x:2},null]}});
  a.notEqual(r.value,i.properties.nested);frozen(a,r);frozen(a,absent);
  i.properties.nested.order[0].x=8;a.deepEqual(r.value,{order:[{x:2},null]});
  a.throws(()=>{r.value.order[0].x=3;},TypeError);a.equal(Object.isFrozen(i.properties.nested),false);
  a.deepEqual(g.getItemInstanceProperty(d,i,'toString'),{found:false});
});

contract('P06','keys',a=>{
  const d=definition();let i=before();
  for(const key of ['__proto__','constructor','道','', ' ', '  padded ', '2','1']){
    const r=g.setItemInstanceProperty(d,i,key,{key},yes);
    a.equal(r.status,'accepted');a.equal(Object.hasOwn(r.candidate.properties,key),true,'safe own key');
    a.deepEqual(g.getItemInstanceProperty(d,r.candidate,key),{found:true,value:{key}});
    a.equal(Object.getPrototypeOf(r.candidate.properties),Object.prototype);i=r.candidate;
  }
  a.deepEqual(Object.keys(i.properties),['1','2','charge','note','__proto__','constructor','道','',' ','  padded '],'ECMAScript insertion order');
  const replaced=g.setItemInstanceProperty(d,i,'charge',0,yes);a.deepEqual(Object.keys(replaced.candidate.properties),Object.keys(i.properties));
  a.equal(Object.getPrototypeOf({}),Object.prototype);a.equal(Object.hasOwn(Object.prototype,'key'),false);
});

contract('P07 P08 P09 P10 P11','set',a=>{
  const d=definition(),i=before(),payload={values:[2,{x:3}]};
  const r=g.setItemInstanceProperty(d,i,'charge',2,yes);
  a.deepEqual(r,expected({charge:2,note:null}),'set full candidate');
  a.deepEqual(i,{instanceId:' I道 ',definitionId:' D道 ',properties:{charge:1,note:null}},'source untouched');
  const added=g.setItemInstanceProperty(d,i,'new',payload,yes);a.deepEqual(added,expected({charge:1,note:null,new:{values:[2,{x:3}]}}));
  payload.values[1].x=9;a.deepEqual(added.candidate.properties.new,{values:[2,{x:3}]},'set payload detached');
  a.equal(Object.isFrozen(payload),false);a.equal(Object.isFrozen(i),false);
  a.notEqual(added.candidate.properties,i.properties);frozen(a,added);
  a.throws(()=>{added.candidate.properties.new.values[1].x=8;},TypeError);
  a.deepEqual(g.setItemInstanceProperty(d,i,'new',null,yes),expected({charge:1,note:null,new:null}),'set null is present');
  const same=g.setItemInstanceProperty(d,i,'charge',1,yes);a.deepEqual(same,expected({charge:1,note:null}));a.notEqual(same.candidate,i);
});

contract('P12 P13 P14','replace',a=>{
  const d=definition(),i=before(),map=JSON.parse('{"fresh":[true,0,{"x":2}],"__proto__":{"safe":true}}');
  const r=g.replaceItemInstanceProperties(d,i,map,yes);
  a.deepEqual(r,expected(JSON.parse('{"fresh":[true,0,{"x":2}],"__proto__":{"safe":true}}')),'entire replacement');
  a.equal(Object.hasOwn(r.candidate.properties,'charge'),false);a.equal(Object.hasOwn(r.candidate.properties,'shared'),false);
  a.equal(Object.getPrototypeOf(r.candidate.properties),Object.prototype);a.equal(Object.hasOwn(r.candidate.properties,'__proto__'),true);
  map.fresh[2].x=9;a.equal(r.candidate.properties.fresh[2].x,2,'replacement detached');frozen(a,r);
  a.throws(()=>{r.candidate.properties.fresh.push(8);},TypeError);
  a.deepEqual(g.replaceItemInstanceProperties(d,i,{},yes),expected({}),'clear instance only');
  a.deepEqual(i,before());a.equal(d.properties.shared,'definition-only');a.equal(Object.isFrozen(map),false);
});

contract('P15 P16','admission',a=>{
  const d=definition(),i=before(),rejection={status:'rejected',reason:'ineligible',candidate:null};
  const r=g.setItemInstanceProperty(d,i,'x',1,no);a.deepEqual(r,rejection,'rejection has no candidate');frozen(a,r);
  a.deepEqual(g.replaceItemInstanceProperties(d,i,{x:1},no),rejection);
  a.throws(()=>g.setItemInstanceProperty(d,i,'x',{nested:undefined},no),TypeError,'invalid before rejection');
  a.throws(()=>g.replaceItemInstanceProperties(d,i,{nested:{bad:NaN}},no),TypeError,'invalid replacement before rejection');
  a.deepEqual(i,before());a.notEqual(r,g.setItemInstanceProperty(d,i,'x',1,no));
});

contract('P17 P18','binding and admission',a=>{
  const d=definition(),i=before(),mismatch={...i,definitionId:'other'};
  let calls=0;const accessor=Object.defineProperty({},'eligible',{get(){calls++;return true;}});
  const invalid=[{},null,[],{eligible:1},{eligible:'false'},{eligible:true,extra:1},{eligible:true,[Symbol()]:1},accessor,Object.assign(Object.create({}),yes)];
  for(const admission of invalid){
    a.throws(()=>g.setItemInstanceProperty(d,i,'x',1,admission),TypeError);
    a.throws(()=>g.replaceItemInstanceProperties(d,i,{},admission),TypeError);
  }a.equal(calls,0);
  for(const current of [mismatch,{...i,extra:1},{...i,properties:{bad:undefined}}]){
    a.throws(()=>g.getItemInstanceProperty(d,current,'charge'),TypeError,'canonical instance binding');
    a.throws(()=>g.setItemInstanceProperty(d,current,'x',1,no),TypeError,'canonical instance binding');
    a.throws(()=>g.replaceItemInstanceProperties(d,current,{},no),TypeError,'canonical instance binding');
  }
  for(const bad of [{...d,extra:1},{...d,properties:{bad:undefined}},{...d,tagIds:['T','T']}]){
    a.throws(()=>g.getItemInstanceProperty(bad,i,'x'),TypeError);
    a.throws(()=>g.setItemInstanceProperty(bad,i,'x',1,no),TypeError);
    a.throws(()=>g.replaceItemInstanceProperties(bad,i,{},no),TypeError);
  }
});

contract('P19','structural safety',a=>{
  const d=definition(),i=before();let calls=0;
  const accessor=Object.defineProperty({},'x',{get(){calls++;return 1;}}),cycle={};cycle.self=cycle;
  const values=[cycle,accessor,[,1],Object.assign([1],{extra:2}),{[Symbol()]:1},new Date(),Object.create({}),Infinity,undefined,()=>1,1n];
  for(const value of values){
    a.throws(()=>g.setItemInstanceProperty(d,i,'x',value,no),TypeError,'recursive value guard');
    a.throws(()=>g.replaceItemInstanceProperties(d,i,{nested:value},no),TypeError);
  }
  for(const key of [undefined,null,1,{},Symbol(),{toString(){calls++;return 'x';}}]){
    a.throws(()=>g.getItemInstanceProperty(d,i,key),TypeError);a.throws(()=>g.setItemInstanceProperty(d,i,key,1,no),TypeError);
  }
  for(const map of [[],null,undefined,new Date(),Object.create({}),accessor])a.throws(()=>g.replaceItemInstanceProperties(d,i,map,no),TypeError);
  a.equal(calls,0);a.equal(Object.isFrozen(i.properties),false);
  const nullMap=Object.assign(Object.create(null),{x:[-0]});const r=g.replaceItemInstanceProperties(d,i,nullMap,yes);
  a.deepEqual(r,expected({x:[-0]}));a.equal(Object.is(r.candidate.properties.x[0],-0),true);
});

contract('P20 P22 P23','replay and composition',a=>{
  const run=()=>g.setItemInstanceProperty(definition(),before(),'x',{nested:[null,false]},yes);
  const one=run(),two=run();a.deepEqual(one,two);a.notEqual(one,two);a.notEqual(one.candidate,two.candidate);a.notEqual(one.candidate.properties.x,two.candidate.properties.x);
  let registry=g.createModuleRegistry();registry=g.registerModule(registry,{id:'entity',optional:true,dependencies:[]});registry=g.registerModule(registry,{id:'item',optional:true,dependencies:[]});
  a.deepEqual(g.composeModules(registry,g.configureModules(registry,{enable:['item'],disable:['entity']})).moduleIds,['item']);
  for(const data of [{text:{description:'opaque'}},{sprite2d:{frame:0}},{view25d:{angle:30}}]){
    a.deepEqual(g.replaceItemInstanceProperties(definition(),before(),data,yes),expected(data));
  }
  a.deepEqual(Object.keys(g).filter(k=>k.includes('Item')).sort(),['createItemDefinitionReference','createItemInstanceReference','validateItemInstanceReference','createItemDefinition','validateItemDefinition','createItemInstance','validateItemInstance','getItemInstanceProperty','setItemInstanceProperty','replaceItemInstanceProperties','validateItemStackPolicy','assessItemStackCompatibility'].sort());
});
