import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../../dist/index.js';

const allowed={eligible:true};
const wallet=(gold=100)=>g.createCurrencyWalletState({walletId:'wallet-hero-1',
  owner:{ownerKind:'character',ownerId:'hero-1'},balances:[{currencyId:'gold',amount:gold},{currencyId:'gems',amount:5}]});
const base=()=>({wallet:wallet(),claim:g.createRewardClaimState({claimId:'claim-1',
  source:{kind:'quest',id:'q1'},recipient:{kind:'character',id:'hero-1'},status:'available',
  reward:g.createRewardPackage({packageId:'quest-gold',lines:[
    {lineId:'gold-grant',grantKindId:'currency',referenceId:'gold',amount:75}]})})});

// Test-local L3 facts and L4 orchestration, never a package API or durable store.
function planHandoff(input,policy,admission) {
  const claim=g.prepareRewardClaim(input.claim,admission);
  if(claim.status==='rejected') return {status:'rejected',reason:claim.reason};
  let candidate=input.wallet;
  for(const grant of claim.grants) {
    if(grant.grantKindId!=='currency' || !['gold','gems'].includes(grant.referenceId) ||
      !Number.isSafeInteger(grant.amount) || grant.amount<=0) return {status:'rejected',reason:'unsupported_grant'};
    const credit=g.creditCurrency(candidate,grant.referenceId,grant.amount,policy,admission);
    if(credit.status==='rejected') return {status:'rejected',reason:credit.reason};
    candidate=credit.candidate;
  }
  return {status:'accepted',candidate:{wallet:candidate,claim:claim.candidate}};
}
function handoff(holder,policy,admission=allowed,beforeAccept=()=>{}) {
  const input=holder.current;
  const proposal=planHandoff(input,policy,admission);
  if(proposal.status==='rejected') return proposal;
  beforeAccept();
  if(holder.current!==input || holder.current.wallet!==input.wallet || holder.current.claim!==input.claim) {
    return {status:'rejected',reason:'stale'};
  }
  holder.current=proposal.candidate;
  return {status:'accepted'};
}

test('CU11 Currency public-root flow 100 -> 150 -> 110 preserves the original and unrelated balance',()=>{
  const original=wallet();
  assert.equal(g.getCurrencyBalance(original,'gold'),100);
  const credit=g.creditCurrency(original,'gold',50,{maxBalance:300},allowed);
  assert.equal(credit.status,'accepted');assert.equal(g.getCurrencyBalance(credit.candidate,'gold'),150);
  assert.deepEqual(g.creditCurrency(original,'gold',50,{maxBalance:300},allowed),credit);
  const debit=g.debitCurrency(credit.candidate,'gold',40,allowed);
  assert.equal(debit.status,'accepted');
  assert.deepEqual(debit.candidate,{walletId:'wallet-hero-1',owner:{ownerKind:'character',ownerId:'hero-1'},
    balances:[{currencyId:'gold',amount:110},{currencyId:'gems',amount:5}]});
  assert.deepEqual(g.debitCurrency(debit.candidate,'gold',200,allowed),
    {status:'rejected',reason:'insufficient_balance',candidate:null});
  for(const candidate of [credit.candidate,debit.candidate]) {
    assert.equal(candidate.walletId,'wallet-hero-1');assert.deepEqual(candidate.owner,{ownerKind:'character',ownerId:'hero-1'});
    assert.equal(g.getCurrencyBalance(candidate,'gems'),5);
    assert.notEqual(candidate.owner,original.owner);assert.notEqual(candidate.balances[1],original.balances[1]);
    for(const value of [candidate,candidate.owner,candidate.balances,...candidate.balances]) assert.ok(Object.isFrozen(value));
  }
  assert.equal(g.getCurrencyBalance(original,'gold'),100);
  assert.equal(g.getCurrencyBalance(debit.candidate,'gold'),110);
});

test('CU12 real Reward intents and Currency candidates commit together; claimed replay cannot credit again',()=>{
  const input=base(),holder={current:input};
  const intent=g.prepareRewardClaim(input.claim,allowed);
  assert.equal(intent.status,'accepted');assert.equal(intent.candidate.status,'claimed');
  assert.deepEqual(intent.grants,[{lineId:'gold-grant',grantKindId:'currency',referenceId:'gold',amount:75}]);
  const first=planHandoff(input,{maxBalance:300},allowed),again=planHandoff(input,{maxBalance:300},allowed);
  assert.deepEqual(first,again);assert.notEqual(first.candidate.wallet,again.candidate.wallet);
  assert.equal(input.claim.status,'available');assert.equal(g.getCurrencyBalance(input.wallet,'gold'),100);
  assert.deepEqual(handoff(holder,{maxBalance:300}),{status:'accepted'});
  assert.equal(holder.current.claim.status,'claimed');
  assert.deepEqual(holder.current.wallet.balances,[{currencyId:'gold',amount:175},{currencyId:'gems',amount:5}]);
  assert.ok(Object.isFrozen(holder.current.claim));assert.ok(Object.isFrozen(holder.current.wallet));
  const committed=holder.current;
  assert.deepEqual(handoff(holder,{maxBalance:300}),{status:'rejected',reason:'already_claimed'});
  assert.equal(holder.current,committed);assert.equal(g.getCurrencyBalance(holder.current.wallet,'gold'),175);
});

test('CU13 cap, ineligible, overflow and later unsupported grant leave both authoritative inputs unchanged',()=>{
  const cap=base(),denied=base(),overflow={...base(),wallet:wallet(9007199254740991)},mixed=base();
  mixed.claim=g.createRewardClaimState({...mixed.claim,reward:{...mixed.claim.reward,lines:[...mixed.claim.reward.lines,
    {lineId:'unsupported',grantKindId:'item',referenceId:'potion',amount:1}]}});
  for(const [input,policy,admission,reason,expectedGold] of [
    [cap,{maxBalance:150},allowed,'balance_limit_exceeded',100],
    [denied,{maxBalance:300},{eligible:false},'ineligible',100],
    [overflow,{maxBalance:null},allowed,'amount_overflow',9007199254740991],
    [mixed,{maxBalance:300},allowed,'unsupported_grant',100]]) {
    const holder={current:input};
    assert.deepEqual(handoff(holder,policy,admission),{status:'rejected',reason});
    assert.equal(holder.current,input,'failed handoff must not commit claim or wallet');
    assert.equal(holder.current.claim.status,'available');
    assert.equal(g.getCurrencyBalance(holder.current.wallet,'gold'),expectedGold);
    assert.equal(g.getCurrencyBalance(holder.current.wallet,'gems'),5);
  }
});

test('CU13 local stale wallet or claim detection rejects the entire prepared proposal',()=>{
  for(const changed of ['wallet','claim']) {
    const input=base(),holder={current:input};
    const newer={...input,[changed]:changed==='wallet'?wallet(90):g.validateRewardClaimState(input.claim)};
    assert.deepEqual(handoff(holder,{maxBalance:300},allowed,()=>{holder.current=newer;}),{status:'rejected',reason:'stale'});
    assert.equal(holder.current,newer);assert.equal(holder.current.claim.status,'available');
    assert.equal(g.getCurrencyBalance(holder.current.wallet,'gold'),changed==='wallet'?90:100);
  }
});
