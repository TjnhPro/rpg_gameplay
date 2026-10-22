import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../../dist/index.js';

const record=(payload=null)=>({moduleId:'currency',stateKind:'wallet',stateId:'w1',schemaVersion:1,payload});
const capture=g.validateGameplayStateArchive;
const wallet=()=>({walletId:'w1',balances:[{currencyId:'gold',amount:15}],owner:null});
function frozen(value) {
  if(value!==null && typeof value==='object') {
    assert.ok(Object.isFrozen(value));
    for(const child of Object.values(value)) frozen(child);
  }
}

test('ST01/ST04 complete archive is a detached deep frozen portable snapshot with exact JSON fidelity',()=>{
  const payload=wallet(),input={formatVersion:1,records:[record(payload)]},result=capture(input);
  const expected={formatVersion:1,records:[{moduleId:'currency',stateKind:'wallet',stateId:'w1',schemaVersion:1,
    payload:{walletId:'w1',balances:[{currencyId:'gold',amount:15}],owner:null}}]};
  assert.deepEqual(result,expected);assert.deepEqual(JSON.parse(JSON.stringify(result)),expected);frozen(result);
  assert.notEqual(result,input);assert.notEqual(result.records,input.records);assert.notEqual(result.records[0],input.records[0]);
  assert.notEqual(result.records[0].payload,payload);assert.notEqual(result.records[0].payload.balances[0],payload.balances[0]);
  const again=capture(result);assert.deepEqual(again,expected);assert.notEqual(again.records[0].payload,result.records[0].payload);
  payload.balances[0].amount=999;input.records.reverse();assert.deepEqual(result,expected);
  assert.equal(Object.isFrozen(payload),false);
  assert.throws(()=>{result.records[0].payload.balances[0].amount=1;},TypeError);
  assert.deepEqual(capture({formatVersion:4,records:[]}),{formatVersion:4,records:[]});
});

test('ST02/ST03 exact triple identity, ordering and independent positive schema labels without catalog lookup',()=>{
  const life={moduleId:'entity',stateKind:'life',stateId:'p1',schemaVersion:2,payload:{status:'opaque'}};
  const resource={moduleId:'entity',stateKind:'resource',stateId:'p1',schemaVersion:9,payload:{health:10}};
  const result=capture({formatVersion:7,records:[resource,life]});
  assert.deepEqual(result,{formatVersion:7,records:[
    {moduleId:'entity',stateKind:'resource',stateId:'p1',schemaVersion:9,payload:{health:10}},
    {moduleId:'entity',stateKind:'life',stateId:'p1',schemaVersion:2,payload:{status:'opaque'}}]});
  assert.throws(()=>capture({formatVersion:1,records:[life,{...life,payload:null}]}),TypeError);
  const opaque={moduleId:' Future ',stateKind:'any/kind',stateId:' P1 ',schemaVersion:9007199254740991,payload:['x',true,0,1.5,null]};
  assert.deepEqual(g.validateGameplayStateRecord(opaque),opaque);
  assert.doesNotThrow(()=>capture({formatVersion:1,records:[life,{...life,moduleId:'Entity'},
    {...life,stateId:' p1 '},{...life,stateKind:'life '},opaque]}));
  for(const version of [0,-1,1.5,NaN,Infinity,9007199254740992,'1']) {
    assert.throws(()=>g.validateGameplayStateRecord({...record(),schemaVersion:version}),TypeError);
    assert.throws(()=>capture({formatVersion:version,records:[]}),TypeError);
  }
  for(const field of ['moduleId','stateKind','stateId']) assert.throws(()=>g.validateGameplayStateRecord({...record(),[field]:' '}),TypeError);
});

test('ST04 portable dictionaries preserve dangerous own keys and duplicate shared data without aliasing',()=>{
  const dictionary=Object.create(null);
  Object.defineProperty(dictionary,'__proto__',{value:{polluted:true},enumerable:true});
  dictionary.constructor='inert';dictionary.nested=[null,false,'text',0,-1,1.25,Number.MAX_VALUE];
  const shared={value:3};dictionary.left=shared;dictionary.right=shared;
  const result=g.validateGameplayStateRecord(record(dictionary));
  assert.equal(Object.getPrototypeOf(result.payload),Object.prototype);
  assert.ok(Object.hasOwn(result.payload,'__proto__'));
  assert.deepEqual(result.payload.__proto__,{polluted:true});assert.equal({}.polluted,undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(result.payload)),JSON.parse('{"__proto__":{"polluted":true},"constructor":"inert","nested":[null,false,"text",0,-1,1.25,1.7976931348623157e308],"left":{"value":3},"right":{"value":3}}'));
  assert.notEqual(result.payload.left,result.payload.right);assert.notEqual(result.payload.left,shared);frozen(result);
});

test('ST04 rejects lossy/nonportable data and hostile structures without getters or caller mutation',()=>{
  let calls=0;
  const accessor={get value(){calls++;return 1;}};
  const hidden=Object.defineProperty({},'hidden',{value:1});
  const cycle={};cycle.self=cycle;
  const arrayCycle=[];arrayCycle.push(arrayCycle);
  const indexGetter=[];Object.defineProperty(indexGetter,'0',{enumerable:true,get(){calls++;return 1;}});
  const inherited=Object.create({value:1});inherited.own=2;
  const invalid=[undefined,1n,Symbol('value'),()=>{},NaN,Infinity,-Infinity,-0,new Date(),new Map(),new Set(),
    new Uint8Array([1]),new Number(1),Object.create({}),inherited,accessor,hidden,{[Symbol('key')]:1},
    {nested:[undefined]},cycle,arrayCycle,new Array(1),indexGetter,Object.assign([],{extra:1}),
    new (class extends Array {})()];
  for(const payload of invalid) {
    const input={...record(),payload}; // Preserve explicit undefined instead of the fixture default.
    assert.throws(()=>g.validateGameplayStateRecord(input),TypeError);
    assert.throws(()=>capture({formatVersion:1,records:[input]}),TypeError);
  }
  for(const input of [{...record(),extra:1},{moduleId:'a'},
    {...record(),get payload(){calls++;return null;}},Object.create(record()),
    Object.defineProperty(record(),'stateId',{enumerable:false})]) {
    assert.throws(()=>g.validateGameplayStateRecord(input),TypeError);
  }
  for(const input of [null,{formatVersion:1,records:new Array(1)},{formatVersion:1,records:[],extra:1},
    {get formatVersion(){calls++;return 1;},records:[]}]) assert.throws(()=>capture(input),TypeError);
  const revoked=Proxy.revocable({},{});revoked.revoke();
  assert.throws(()=>g.validateGameplayStateRecord(record(revoked.proxy)),TypeError);
  for(const trap of ['getPrototypeOf','ownKeys','getOwnPropertyDescriptor']) {
    const proxy=new Proxy({x:1},{[trap](){throw new Error('inspection trap');}});
    assert.throws(()=>g.validateGameplayStateRecord(record(proxy)),TypeError);
  }
  assert.equal(calls,0);assert.equal(cycle.self,cycle);assert.equal(Object.isFrozen(cycle),false);
});

test('ST05 archive module is optional and structural acceptance does not validate or execute owner behavior',()=>{
  const registry=g.registerModule(g.createModuleRegistry(),{id:'state-archive',optional:true,dependencies:[]});
  assert.deepEqual(g.composeModules(registry,g.configureModules(registry,{enable:[]})).moduleIds,[]);
  assert.deepEqual(g.composeModules(registry,g.configureModules(registry,{enable:['state-archive']})).moduleIds,['state-archive']);
  const opaque=record({notAWallet:true});
  assert.deepEqual(g.validateGameplayStateRecord(opaque),opaque);
  assert.throws(()=>g.validateCurrencyWalletState(opaque.payload),TypeError);
});
