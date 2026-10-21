import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../../dist/index.js';

const claim = (status='available') => ({claimId:'claim-0001',source:{kind:'quest',id:'quest-0001'},
  recipient:{kind:'character',id:'hero-0001'},reward:{packageId:'fixture-completion',lines:[
    {lineId:'i',grantKindId:'item',referenceId:'potion',amount:3},
    {lineId:'x',grantKindId:'experience',referenceId:'character_exp',amount:100},
  ]},status});
const accepted = () => ({status:'accepted',reason:'none',candidate:{
  claimId:'claim-0001',source:{kind:'quest',id:'quest-0001'},recipient:{kind:'character',id:'hero-0001'},
  reward:{packageId:'fixture-completion',lines:[
    {lineId:'i',grantKindId:'item',referenceId:'potion',amount:3},
    {lineId:'x',grantKindId:'experience',referenceId:'character_exp',amount:100},
  ]},status:'claimed'},grants:[
    {lineId:'i',grantKindId:'item',referenceId:'potion',amount:3},
    {lineId:'x',grantKindId:'experience',referenceId:'character_exp',amount:100},
  ]});
function frozen(value) {
  if(value!==null&&typeof value==='object') {
    assert.ok(Object.isFrozen(value),'deep immutable claim plan');for(const child of Object.values(value))frozen(child);
  }
}
function detached(a,b) {
  if(a!==null&&typeof a==='object') {
    assert.notEqual(a,b,'independent snapshot identity');for(const key of Object.keys(a))detached(a[key],b[key]);
  }
}

test('RW06/RW08 inspected snapshots and eligible Item+EXP plan preserve complete literal data without committing',()=>{
  for(const status of ['available','claimed']) {
    const inspected=g.validateRewardClaimState(claim(status));
    assert.deepEqual(inspected,{claimId:'claim-0001',source:{kind:'quest',id:'quest-0001'},
      recipient:{kind:'character',id:'hero-0001'},reward:{packageId:'fixture-completion',lines:[
        {lineId:'i',grantKindId:'item',referenceId:'potion',amount:3},
        {lineId:'x',grantKindId:'experience',referenceId:'character_exp',amount:100},
      ]},status});frozen(inspected);
  }
  const input=claim(),plan=g.prepareRewardClaim(input,{eligible:true});
  assert.deepEqual(plan,accepted());frozen(plan);
  assert.deepEqual(Object.keys(plan).sort(),['candidate','grants','reason','status']);
  assert.deepEqual(input,claim());assert.equal(input.status,'available');
  assert.deepEqual(g.validateRewardClaimState(plan.candidate),accepted().candidate);
  detached(plan.candidate,input);detached(plan.grants,input.reward.lines);
  detached(plan.grants,plan.candidate.reward.lines);
  const second=g.prepareRewardClaim({...claim(),reward:input.reward,claimId:'claim-0002',recipient:{kind:'account',id:'other'}},{eligible:true});
  assert.deepEqual(second,{...accepted(),candidate:{...accepted().candidate,claimId:'claim-0002',recipient:{kind:'account',id:'other'}}});
  detached(second.candidate.reward,plan.candidate.reward);
  const opaque=g.prepareRewardClaim({...claim(),reward:{packageId:'opaque',lines:[
    {lineId:'z',grantKindId:'future',referenceId:' X ',amount:0.25},
    {lineId:'a',grantKindId:'future',referenceId:' X ',amount:0.5},
  ]}},{eligible:true});
  assert.deepEqual(opaque.grants,[{lineId:'z',grantKindId:'future',referenceId:' X ',amount:0.25},
    {lineId:'a',grantKindId:'future',referenceId:' X ',amount:0.5}]);
  let registry=g.createModuleRegistry();registry=g.registerModule(registry,{id:'reward',optional:true,dependencies:[]});
  assert.deepEqual(g.composeModules(registry,g.configureModules(registry,{enable:['reward']})).moduleIds,['reward']);
  assert.deepEqual(g.prepareRewardClaim(claim(),{eligible:true}),accepted());
  const empty=g.prepareRewardClaim({...claim(),reward:{packageId:'no-op',lines:[]}},{eligible:true});
  assert.deepEqual(empty,{status:'accepted',reason:'none',candidate:{...claim('claimed'),reward:{packageId:'no-op',lines:[]}},grants:[]});
  frozen(empty);assert.notEqual(empty.grants,empty.candidate.reward.lines);
});

test('RW07/RW09/RW10 rejection priority and duplicate supplied snapshot return exact candidate-free results',()=>{
  for(const [status,eligible,reason] of [['available',false,'ineligible'],['claimed',true,'already_claimed'],['claimed',false,'already_claimed']]) {
    const input=claim(status),admission={eligible},first=g.prepareRewardClaim(input,admission),second=g.prepareRewardClaim(input,admission);
    assert.deepEqual(first,{status:'rejected',reason,candidate:null,grants:[]});frozen(first);
    assert.deepEqual(Object.keys(first).sort(),['candidate','grants','reason','status']);
    assert.deepEqual(second,{status:'rejected',reason,candidate:null,grants:[]});detached(second,first);
    assert.deepEqual(input,claim(status));assert.deepEqual(admission,{eligible});
    assert.throws(()=>first.grants.push({}),TypeError);assert.throws(()=>{first.candidate=claim();},TypeError);
  }
  const planned=g.prepareRewardClaim(claim(),{eligible:true});
  assert.deepEqual(g.prepareRewardClaim(planned.candidate,{eligible:true}),
    {status:'rejected',reason:'already_claimed',candidate:null,grants:[]});
});

test('Reward preparation validates all state before policy or admission inspection',()=>{
  const line=claim().reward.lines[0],missing=claim();delete missing.source;
  const badLine={...claim(),reward:{packageId:'fixture-completion',lines:[{...line,amount:0}]}};
  const duplicate={...claim(),reward:{packageId:'fixture-completion',lines:[line,line]}};
  const malformed=[missing,badLine,duplicate,{...claim(),status:'pending'},
    {...claim(),recipient:{kind:'character',id:''}}, {...claim(),reward:{packageId:'p',lines:[{...line,extra:1}]}},
    {...claim(),reward:{packageId:'p',lines:new Array(1)}}];
  let reads=0;
  const hostile=Object.defineProperty(claim().reward.lines[0],'amount',{get(){reads++;throw Error('getter called');}});
  malformed.push({...claim(),reward:{packageId:'p',lines:[hostile]}});
  for(const state of malformed) {
    for(const eligible of [false,true])assert.throws(()=>g.prepareRewardClaim(state,{eligible}),TypeError);
    // A claimed status must never short circuit malformed nested content.
    if(state.status!=='pending')assert.throws(()=>g.prepareRewardClaim({...state,status:'claimed'},{eligible:false}),TypeError);
    const admission=new Proxy({eligible:false},{ownKeys(){reads++;return ['eligible'];}});
    assert.throws(()=>g.prepareRewardClaim(state,admission),TypeError);
  }
  assert.equal(reads,0,'state validation precedes admission inspection and never invokes getters');
});

test('Reward admission requires exactly one own-data boolean even on already-claimed snapshots',()=>{
  let reads=0;
  const getter=Object.defineProperty({},'eligible',{get(){reads++;throw Error('getter called');}});
  const extraGetter=Object.defineProperty({eligible:true},'extra',{get(){reads++;return 1;}});
  const revoked=Proxy.revocable({},{});revoked.revoke();
  for(const admission of [null,undefined,{},[],new Date(),()=>true,{eligible:undefined},{eligible:0},
    {eligible:'true'},{eligible:null},{eligible:true,extra:1},{eligible:true,[Symbol('hidden')]:1},
    Object.create({eligible:true}),Object.assign(Object.create({}),{eligible:true}),getter,extraGetter,revoked.proxy,
    new Proxy({eligible:true},{ownKeys(){throw Error('reflection failure');}})]) {
    for(const status of ['available','claimed'])assert.throws(()=>g.prepareRewardClaim(claim(status),admission),TypeError);
  }
  assert.equal(reads,0);
  assert.deepEqual(g.prepareRewardClaim(claim(),Object.assign(Object.create(null),{eligible:true})),accepted());
});

test('Reward candidate and intents remain independently frozen and detached from caller mutations',()=>{
  const input=claim(),admission={eligible:true},plan=g.prepareRewardClaim(input,admission);
  frozen(plan);assert.equal(Object.isFrozen(input),false);assert.equal(Object.isFrozen(admission),false);
  input.source.id='edited';input.recipient.id='edited';input.reward.lines[0].amount=999;
  input.reward.lines.reverse();input.status='claimed';admission.eligible=false;
  assert.deepEqual(plan,accepted());
  for(const mutate of [()=>{plan.candidate.status='available';},()=>{plan.candidate.source.id='edited';},
    ()=>{plan.candidate.recipient.kind='edited';},()=>{plan.candidate.reward.lines[0].amount=0;},
    ()=>plan.candidate.reward.lines.pop(),()=>plan.grants.reverse(),()=>{plan.grants[0].referenceId='edited';}]) {
    assert.throws(mutate,TypeError);
  }
  assert.deepEqual(plan,accepted());
});

test('Reward deterministic planning can repeat the same available input without implicit providers or global ledger',()=>{
  const input=g.createRewardClaimState(claim()),random=Math.random,now=Date.now;
  const descriptor=Object.getOwnPropertyDescriptor(globalThis.crypto,'randomUUID');
  try {
    Math.random=()=>{throw Error('implicit RNG');};Date.now=()=>{throw Error('implicit clock');};
    Object.defineProperty(globalThis.crypto,'randomUUID',{configurable:true,value:()=>{throw Error('implicit ID');}});
    const first=g.prepareRewardClaim(input,{eligible:true}),second=g.prepareRewardClaim(input,{eligible:true});
    assert.deepEqual(first,accepted());assert.deepEqual(second,accepted());detached(first,second);
    frozen(first);frozen(second);assert.deepEqual(input,claim());
    // Caller-owned authoritative state must advance before duplicate detection applies.
    assert.deepEqual(g.prepareRewardClaim(first.candidate,{eligible:false}),
      {status:'rejected',reason:'already_claimed',candidate:null,grants:[]});
  } finally {
    Math.random=random;Date.now=now;
    if(descriptor)Object.defineProperty(globalThis.crypto,'randomUUID',descriptor);else delete globalThis.crypto.randomUUID;
  }
});
