import assert from 'node:assert/strict';
import test from 'node:test';
import * as g from '@rpg/gameplay';

function contract(ids,title,run){
  test('Item stack '+title,()=>{
    let assertions=0;
    const a=new Proxy(assert,{get(target,key){return(...args)=>{assertions++;return target[key](...args);};}});
    run(a);assert.ok(assertions>0,'Item stack contract requires actual assertions');
    for(const id of ids.split(' '))console.log('ITEM_'+id+'_PASS');
  });
}
const def=(definitionId=' D道 ',changes={})=>({definitionId,categoryId:'opaque',tagIds:['A','B'],rarityId:null,properties:{marker:'v1'},...changes});
const instance=(definitionId=' D道 ',instanceId='A',properties={grade:1,tag:null})=>({instanceId,definitionId,properties});
const yes={stackable:true},no={stackable:false};
const denied=reason=>({compatible:false,reason});
const allowed={compatible:true,reason:'none'};
const assess=(left,right,policy=yes)=>g.assessItemStackCompatibility(def(),instance(' D道 ','A',left),def(),instance(' D道 ','B',right),policy);

contract('S01 S02','policy',a=>{
  for(const stackable of [true,false]){
    const input={stackable},output=g.validateItemStackPolicy(input);
    a.deepEqual(output,{stackable});a.notEqual(output,input);a.equal(Object.isFrozen(output),true);
    input.stackable=!stackable;a.equal(output.stackable,stackable);a.equal(Object.isFrozen(input),false);
  }
  let calls=0;class Policy{stackable=true;}
  const accessor=Object.defineProperty({},'stackable',{get(){calls++;return true;}});
  for(const invalid of [null,[],{},new Policy(),Object.assign(Object.create({}),yes),Object.create(yes),
    {stackable:1},{stackable:'true'},{stackable:null},{stackable:true,extra:1},{stackable:true,[Symbol()]:1},accessor]){
    a.throws(()=>g.validateItemStackPolicy(invalid),TypeError);
    a.throws(()=>g.assessItemStackCompatibility(def(),instance(),def(),instance(' D道 ','B'),invalid),TypeError);
  }a.equal(calls,0);
  a.deepEqual(g.validateItemStackPolicy(Object.assign(Object.create(null),yes)),{stackable:true});
});

contract('S03 S04 S05 S07 S08 S24','priority',a=>{
  const d=def(),i=instance(),other=def('Other',{categoryId:'different'});
  const results=[
    [g.assessItemStackCompatibility(d,i,other,instance('Other','A',{x:9}),no),'same_instance'],
    [g.assessItemStackCompatibility(d,i,d,{...i},yes),'same_instance'],
    [g.assessItemStackCompatibility(d,i,other,instance('Other','B',{x:9}),no),'different_definition'],
    [g.assessItemStackCompatibility(d,i,def(' D道 ',{rarityId:'changed'}),instance(' D道 ','B',{x:9}),no),'definition_conflict'],
    [assess({x:1},{x:2},no),'not_stackable'],
    [assess({x:1},{x:2}),'different_properties'],
  ];
  for(const [result,reason]of results){
    a.deepEqual(result,denied(reason),'reason priority '+reason);a.deepEqual(Object.keys(result),['compatible','reason']);
    a.equal(Object.isFrozen(result),true);a.throws(()=>{result.reason='none';},TypeError);
  }
  const result=g.assessItemStackCompatibility(d,i,def(),instance(' D道 ','B',{tag:null,grade:1}),yes);
  a.deepEqual(result,allowed,'distinct equal instances');a.deepEqual(Object.keys(result),['compatible','reason']);a.equal(Object.isFrozen(result),true);
  a.deepEqual(g.assessItemStackCompatibility(def(' D '),instance(' D ','A'),def('D'),instance('D','B'),yes),denied('different_definition'),'exact definition identity');
  a.deepEqual(g.assessItemStackCompatibility(d,i,d,instance(' D道 ',' A '),yes),allowed,'instance identity not normalized');
});

contract('S06 S13','definition content',a=>{
  const left=def();
  for(const changes of [{categoryId:null},{categoryId:'OPAQUE'},{rarityId:'unknown'},
    {tagIds:['B','A']},{tagIds:['A']},{properties:{marker:'v2'}},{properties:{marker:'v1',extra:null}}]){
    const right=def(' D道 ',changes);
    a.deepEqual(g.assessItemStackCompatibility(left,instance(),right,instance(' D道 ','B'),yes),denied('definition_conflict'),'full definition content');
  }
  a.deepEqual(g.assessItemStackCompatibility(def(' D道 ',{properties:{a:1,b:{x:2,y:3}}}),instance(),
    def(' D道 ',{properties:{b:{y:3,x:2},a:1}}),instance(' D道 ','B'),yes),allowed,'definition record insertion order irrelevant');
});

contract('S09 S10 S11 S12','nested equality',a=>{
  const left=JSON.parse('{"__proto__":{"safe":true},"constructor":{"x":1},"道":{"b":[1,null],"a":false},"2":0,"":null}');
  const right=JSON.parse('{"":null,"2":0,"道":{"a":false,"b":[1,null]},"constructor":{"x":1},"__proto__":{"safe":true}}');
  a.deepEqual(assess(left,right),allowed,'record insertion order irrelevant');
  a.deepEqual(assess({a:[1,2]},{a:[2,1]}),denied('different_properties'),'array order meaningful');
  a.deepEqual(g.assessItemStackCompatibility(def(' D道 ',{properties:{a:[1,2]}}),instance(),def(' D道 ',{properties:{a:[2,1]}}),instance(' D道 ','B'),yes),denied('definition_conflict'));
  a.deepEqual(assess({n:0},{n:-0}),denied('different_properties'),'Object.is negative zero');
  a.deepEqual(g.assessItemStackCompatibility(def(' D道 ',{properties:{n:-0}}),instance(),def(' D道 ',{properties:{n:0}}),instance(' D道 ','B'),yes),denied('definition_conflict'));
  for(const [x,y]of [[0,false],[1,'1'],[null,''],['a','A'],[{a:null},{b:null}],[[1],{'0':1}],[[],{}]])a.deepEqual(assess({value:x},{value:y}),denied('different_properties'));
  a.deepEqual(assess({a:1},{a:1,b:null}),denied('different_properties'));
  a.deepEqual(assess({n:-0},{n:-0}),allowed);a.equal(Object.getPrototypeOf(left),Object.prototype);
  a.equal(Object.hasOwn(left,'__proto__'),true);a.equal(Object.hasOwn(Object.prototype,'safe'),false);
});

contract('S14','full validation',a=>{
  // Each of the five positions must still validate behind an earlier refusal.
  const base=()=>[def(),instance(),def('Other'),instance('Other','A'),no];
  const mutations=[
    [0,d=>({...d,properties:{bad:undefined}})],
    [1,i=>({...i,extra:1})],
    [2,d=>({...d,properties:{nested:Infinity}})],
    [3,i=>({...i,properties:{bad:undefined}})],
    [4,()=>({stackable:'false'})],
  ];
  for(const [index,change]of mutations){const args=base();args[index]=change(args[index]);a.throws(()=>g.assessItemStackCompatibility(...args),TypeError,'all operands before refusal');}
  const d=def();a.throws(()=>g.assessItemStackCompatibility(d,instance(),d,instance(' D道 ','B',{bad:undefined}),no),TypeError,'invalid under nonstackable');
});

contract('S15 S16','binding and safety',a=>{
  const d=def();let calls=0;const cycle={};cycle.self=cycle;
  const accessor=Object.defineProperty({},'x',{get(){calls++;return 1;}});
  for(const value of [cycle,[,1],accessor,{[Symbol()]:1},new Date(),Object.create({}),()=>1]){
    for(const side of ['left','right']){
      const args=[d,instance(),d,instance(' D道 ','B'),no],index=side==='left'?1:3;
      args[index]={...args[index],properties:{nested:value}};
      a.throws(()=>g.assessItemStackCompatibility(...args),TypeError,'safe operand');
      const definitionIndex=side==='left'?0:2;args[index]=index===1?instance():instance(' D道 ','B');args[definitionIndex]={...d,properties:{nested:value}};
      a.throws(()=>g.assessItemStackCompatibility(...args),TypeError);
    }
  }
  a.throws(()=>g.assessItemStackCompatibility(d,instance('wrong'),d,instance(' D道 ','B'),no),TypeError,'canonical binding');
  a.throws(()=>g.assessItemStackCompatibility(d,instance(),d,instance('wrong','B'),no),TypeError,'canonical binding');
  const top=Object.defineProperty({...instance()},'properties',{get(){calls++;return {};}});
  a.throws(()=>g.assessItemStackCompatibility(d,top,d,instance(' D道 ','B'),yes),TypeError);
  a.equal(calls,0);
});

contract('S17 S18 S19','immutability and replay',a=>{
  const left=def(' D道 ',{properties:{nested:{x:[1]}}}),right=def(' D道 ',{properties:{nested:{x:[1]}}});
  const i=instance(' D道 ','A',{nested:{x:[2]}}),j=instance(' D道 ','B',{nested:{x:[2]}});
  const result=g.assessItemStackCompatibility(left,i,right,j,yes);a.deepEqual(result,allowed);
  for(const v of [left,left.properties.nested.x,right,i,i.properties.nested.x,j])a.equal(Object.isFrozen(v),false,'caller untouched');
  left.properties.nested.x.push(9);i.properties.nested.x[0]=7;a.deepEqual(result,allowed);
  a.throws(()=>{result.compatible=false;},TypeError,'immutable result');
  const replay=()=>g.assessItemStackCompatibility(def(),instance(),def(),instance(' D道 ','B'),{stackable:true});
  const one=replay(),two=replay();a.deepEqual(one,allowed);a.deepEqual(two,allowed);a.notEqual(one,two);
});

contract('S20 S21','composition and profiles',a=>{
  a.deepEqual(Object.keys(g).filter(k=>k.includes('Item')).sort(),['createItemDefinitionReference','createItemInstanceReference','validateItemInstanceReference','createItemDefinition','validateItemDefinition','createItemInstance','validateItemInstance','getItemInstanceProperty','setItemInstanceProperty','replaceItemInstanceProperties','validateItemStackPolicy','assessItemStackCompatibility'].sort());
  let r=g.createModuleRegistry();r=g.registerModule(r,{id:'entity',optional:true,dependencies:[]});r=g.registerModule(r,{id:'item',optional:true,dependencies:[]});
  a.deepEqual(g.composeModules(r,g.configureModules(r,{enable:['item'],disable:['entity']})).moduleIds,['item']);
  for(const props of [{text:{description:'opaque'}},{sprite2d:{frame:0}},{view25d:{angle:30}}, {unique:true,quantity:999}])a.deepEqual(assess(props,structuredClone(props)),allowed,'no inferred game policy');
});
