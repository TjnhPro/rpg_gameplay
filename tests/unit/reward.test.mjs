import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as g from '../../dist/index.js';

const bundle = () => ({packageId:'fixture-quest-001',lines:[
  {lineId:'line-item',grantKindId:'item',referenceId:'potion_hp',amount:3},
  {lineId:'line-exp',grantKindId:'experience',referenceId:'character_exp',amount:100},
]});
const claim = () => ({claimId:'claim-player-a-001',source:{kind:'quest',id:'quest-001'},
  recipient:{kind:'character',id:'character-a'},reward:bundle(),status:'available'});
const packages = [g.createRewardPackage,g.validateRewardPackage];
const claims = [g.createRewardClaimState,g.validateRewardClaimState];
function invalidPackage(input) {
  for(const action of packages)assert.throws(()=>action(input),TypeError);
  for(const action of claims)assert.throws(()=>action({...claim(),reward:input}),TypeError);
}
function invalidClaim(input) { for(const action of claims)assert.throws(()=>action(input),TypeError); }
function frozen(value) {
  if(value!==null&&typeof value==='object') {
    assert.ok(Object.isFrozen(value),'deep immutable Reward snapshot');
    for(const child of Object.values(value))frozen(child);
  }
}

test('RW01/RW02 exact ordered packages allow empty, repeated references and case-distinct line identities',()=>{
  for(const action of packages) {
    const empty=action({packageId:' Empty ',lines:[]});
    assert.deepEqual(empty,{packageId:' Empty ',lines:[]});frozen(empty);
    assert.deepEqual(action(bundle()),{packageId:'fixture-quest-001',lines:[
      {lineId:'line-item',grantKindId:'item',referenceId:'potion_hp',amount:3},
      {lineId:'line-exp',grantKindId:'experience',referenceId:'character_exp',amount:100},
    ]});
    assert.deepEqual(action({packageId:'__proto__',lines:[
      {lineId:'Line',grantKindId:' Kind ',referenceId:' Ref ',amount:0.25},
      {lineId:'line',grantKindId:' Kind ',referenceId:' Ref ',amount:0.25},
    ]}),{packageId:'__proto__',lines:[
      {lineId:'Line',grantKindId:' Kind ',referenceId:' Ref ',amount:0.25},
      {lineId:'line',grantKindId:' Kind ',referenceId:' Ref ',amount:0.25},
    ]});
    assert.deepEqual(action(Object.assign(Object.create(null),bundle())),bundle());
  }
  invalidPackage({...bundle(),lines:[bundle().lines[0],bundle().lines[0]]});
});

test('RW03/RW04 neutral references and explicit statuses capture separate claims without granting',()=>{
  for(const action of claims) {
    assert.deepEqual(action(claim()),{claimId:'claim-player-a-001',source:{kind:'quest',id:'quest-001'},
      recipient:{kind:'character',id:'character-a'},reward:{packageId:'fixture-quest-001',lines:[
        {lineId:'line-item',grantKindId:'item',referenceId:'potion_hp',amount:3},
        {lineId:'line-exp',grantKindId:'experience',referenceId:'character_exp',amount:100},
      ]},status:'available'});
    const shared=bundle(), first=action({...claim(),reward:shared}), second=action({...claim(),
      claimId:' Claim-B ',source:{kind:' Achievement ',id:' Badge '},
      recipient:{kind:' Account ',id:' Player-B '},reward:shared,status:'claimed'});
    assert.deepEqual(second,{claimId:' Claim-B ',source:{kind:' Achievement ',id:' Badge '},
      recipient:{kind:' Account ',id:' Player-B '},reward:bundle(),status:'claimed'});
    assert.notEqual(first.claimId,second.claimId);assert.deepEqual(first.reward,second.reward);
    assert.notEqual(first.reward,second.reward);assert.notEqual(first.reward.lines,second.reward.lines);
    assert.notEqual(first.reward.lines[0],second.reward.lines[0]);frozen(first);frozen(second);
    assert.deepEqual(action({...claim(),reward:{packageId:'no-op',lines:[]},status:'claimed'}).reward,
      {packageId:'no-op',lines:[]});
  }
  for(const status of ['pending','Available','',undefined,null,0])invalidClaim({...claim(),status});
});

test('RW01–RW04 reject invalid identities and amounts without coercion or consumer-specific rounding',()=>{
  for(const value of ['', ' \t',null,undefined,4,{},1n]) {
    invalidPackage({...bundle(),packageId:value});invalidClaim({...claim(),claimId:value});
    for(const key of ['lineId','grantKindId','referenceId'])invalidPackage({
      ...bundle(),lines:[{...bundle().lines[0],[key]:value}],
    });
    for(const ref of ['source','recipient'])for(const key of ['kind','id'])invalidClaim({
      ...claim(),[ref]:{...claim()[ref],[key]:value},
    });
  }
  for(const amount of [0,-0,-1,NaN,Infinity,-Infinity,'3',null,undefined,1n]) {
    invalidPackage({...bundle(),lines:[{...bundle().lines[0],amount}]});
  }
  for(const amount of [Number.MIN_VALUE,0.25,Number.MAX_VALUE])for(const action of packages) {
    assert.deepEqual(action({packageId:'opaque',lines:[{lineId:'a',grantKindId:'future',referenceId:'x',amount}]}),
      {packageId:'opaque',lines:[{lineId:'a',grantKindId:'future',referenceId:'x',amount}]});
  }
});

test('Reward exact own-data records reject hostile shapes at every boundary without invoking getters',()=>{
  let reads=0;
  const boundaries=[
    [bundle(),invalidPackage],
    [bundle().lines[0],x=>invalidPackage({...bundle(),lines:[x]})],
    [claim(),invalidClaim],
    [claim().source,x=>invalidClaim({...claim(),source:x})],
    [claim().recipient,x=>invalidClaim({...claim(),recipient:x})],
  ];
  for(const [record,reject] of boundaries) {
    for(const key of Object.keys(record)) {
      const missing={...record};delete missing[key];reject(missing);
      reject(Object.assign(Object.create({[key]:record[key]}),missing));
      reject(Object.defineProperty({...record},key,{get(){reads++;throw Error('getter invoked');}}));
    }
    for(const extra of ['unknown','__proto__','constructor',Symbol('hidden')]) {
      reject(Object.defineProperty({...record},extra,{value:1}));
    }
    reject(Object.defineProperty({...record},'extra',{get(){reads++;return 1;}}));
    for(const input of [null,undefined,[],new Date(),new Map(),new Set(),()=>{},1n,
      Object.assign(Object.create({}),record)])reject(input);
    reject(new Proxy(record,{ownKeys(){throw Error('unsafe reflection');}}));
    const revoked=Proxy.revocable(record,{});revoked.revoke();reject(revoked.proxy);
  }
  assert.equal(reads,0);
});

test('Reward lines reject sparse, accessor, augmented and unusual arrays and cyclic data',()=>{
  let reads=0;
  const line=bundle().lines[0], getter=[line];
  Object.defineProperty(getter,'0',{get(){reads++;return line;}});
  const inherited=[line];Object.setPrototypeOf(inherited,Object.create(Array.prototype));
  const cycle=[];cycle.push(cycle);
  const revoked=Proxy.revocable([],{});revoked.revoke();
  for(const lines of [undefined,null,{},'lines',new Array(1),getter,inherited,cycle,revoked.proxy,
    Object.assign([line],{extra:1}),Object.assign([line],{[Symbol('x')]:1}),
    Object.defineProperty([line],'01',{value:line}),
    new Proxy([],{ownKeys(){throw Error('unsafe reflection');}})])invalidPackage({...bundle(),lines});
  const cyclicPackage=bundle();cyclicPackage.lines=[cyclicPackage];invalidPackage(cyclicPackage);
  const cyclicClaim=claim();cyclicClaim.reward=cyclicClaim;invalidClaim(cyclicClaim);
  const cyclicLine={...line};cyclicLine.referenceId=cyclicLine;invalidPackage({...bundle(),lines:[cyclicLine]});
  const cyclicReference={kind:'quest'};cyclicReference.id=cyclicReference;invalidClaim({...claim(),source:cyclicReference});
  assert.equal(reads,0);
});

test('Reward creation and revalidation detach and deep freeze every nested snapshot without freezing inputs',()=>{
  for(const action of [...packages,...claims]) {
    const isClaim=claims.includes(action), input=isClaim?claim():bundle(), expected=structuredClone(input);
    const first=action(input), second=action(first);
    assert.deepEqual(input,expected);assert.deepEqual(first,expected);assert.deepEqual(second,expected);
    function detached(a,b) {
      if(a!==null&&typeof a==='object') {
        assert.notEqual(a,b);for(const key of Object.keys(a))detached(a[key],b[key]);
      }
    }
    detached(first,input);detached(second,first);frozen(first);frozen(second);
    const raw=isClaim?input.reward:input, snapshot=isClaim?first.reward:first;
    assert.equal(Object.isFrozen(input),false);assert.equal(Object.isFrozen(raw.lines),false);
    assert.equal(Object.isFrozen(raw.lines[0]),false);
    raw.packageId='edited catalog';raw.lines[0].amount=999;raw.lines.push({...raw.lines[0]});
    if(isClaim) {
      assert.equal(Object.isFrozen(input.source),false);input.source.id='changed';input.recipient.id='changed';
      assert.throws(()=>{first.source.id='changed';},TypeError);
      assert.throws(()=>{first.recipient.kind='changed';},TypeError);
      assert.throws(()=>{first.status='claimed';},TypeError);
    }
    assert.throws(()=>{snapshot.packageId='changed';},TypeError);
    assert.throws(()=>snapshot.lines.push({}),TypeError);
    assert.throws(()=>{snapshot.lines[0].amount=99;},TypeError);
    assert.deepEqual(first,expected);assert.deepEqual(second,expected);
    assert.equal(JSON.stringify(first),JSON.stringify(expected));
  }
});

test('Reward deterministic snapshots use no implicit clock, RNG or ID provider',()=>{
  const random=Math.random, now=Date.now, cryptoRandom=Object.getOwnPropertyDescriptor(globalThis.crypto,'randomUUID');
  try {
    Math.random=()=>{throw Error('implicit RNG');};Date.now=()=>{throw Error('implicit clock');};
    Object.defineProperty(globalThis.crypto,'randomUUID',{configurable:true,value:()=>{throw Error('implicit ID');}});
    for(const action of packages)assert.deepEqual(action(bundle()),action(bundle()));
    for(const action of claims)assert.deepEqual(action(claim()),action(claim()));
  } finally {
    Math.random=random;Date.now=now;
    if(cryptoRandom)Object.defineProperty(globalThis.crypto,'randomUUID',cryptoRandom);
    else delete globalThis.crypto.randomUUID;
  }
});

test('RW05 Reward is optional and independent with neither, Item-only or Progression-only compositions',()=>{
  const declarations=JSON.parse(readFileSync(new URL('../../harness/modules.json',import.meta.url))).modules;
  assert.deepEqual(declarations.find(x=>x.id==='reward'),{id:'reward',optional:true,dependencies:[]});
  let registry=g.createModuleRegistry();for(const declaration of declarations)registry=g.registerModule(registry,declaration);
  const compose=enable=>g.composeModules(registry,g.configureModules(registry,{enable})).moduleIds;
  assert.deepEqual(compose([]),[]);assert.deepEqual(compose(['reward']),['reward']);
  assert.deepEqual(compose(['item','reward']),['item','reward']);
  assert.deepEqual(compose(['entity','progression','reward']),['entity','progression','reward']);
  assert.deepEqual(compose(['item']),['item']);
  for(const enable of [[],['item'],['entity','progression']]) {
    compose(enable);assert.deepEqual(g.validateRewardPackage({packageId:'no-runtime',lines:[]}),{packageId:'no-runtime',lines:[]});
  }
});
