import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../../dist/index.js';

const wallet = () => ({walletId:'bag-gold-1',owner:{ownerKind:'character',ownerId:'hero-1'},
  balances:[{currencyId:'gold',amount:100},{currencyId:'gems',amount:5},{currencyId:'silver',amount:0}]});
const validate = g.validateCurrencyWalletState;

test('CU01–CU03 exact ordered multi-currency snapshot preserves explicit zero and independent wallet identity', () => {
  const result=g.createCurrencyWalletState(wallet());
  assert.deepEqual(result,{walletId:'bag-gold-1',owner:{ownerKind:'character',ownerId:'hero-1'},
    balances:[{currencyId:'gold',amount:100},{currencyId:'gems',amount:5},{currencyId:'silver',amount:0}]});
  assert.deepEqual(Reflect.ownKeys(result),['walletId','owner','balances']);
  assert.deepEqual(Reflect.ownKeys(result.balances[0]),['currencyId','amount']);
  assert.deepEqual(validate(result),result);
  const empty=g.createCurrencyWalletState({walletId:'system-vault',owner:null,balances:[]});
  assert.deepEqual(empty,{walletId:'system-vault',owner:null,balances:[]});
  const second=validate({...wallet(),walletId:'vault-2'});
  assert.equal(second.owner.ownerId,'hero-1');assert.equal(second.walletId,'vault-2');
  const opaque=validate({walletId:' Wallet ',owner:{ownerKind:'guild',ownerId:'g'},
    balances:[{currencyId:'Gold',amount:0},{currencyId:'gold',amount:1},
      {currencyId:' gold ',amount:2},{currencyId:'__proto__',amount:Number.MAX_SAFE_INTEGER}]});
  assert.deepEqual(opaque.balances,[{currencyId:'Gold',amount:0},{currencyId:'gold',amount:1},
    {currencyId:' gold ',amount:2},{currencyId:'__proto__',amount:9007199254740991}]);
  assert.equal(opaque.walletId,' Wallet ');
});

test('CU04 duplicate currency and invalid integer units fail instead of coercion or rounding', () => {
  for(const capture of [g.createCurrencyWalletState,validate]) {
    assert.throws(()=>capture({...wallet(),balances:[{currencyId:'gold',amount:0},{currencyId:'gold',amount:1}]}),TypeError);
    for(const amount of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'100',null]) {
      assert.throws(()=>capture({...wallet(),balances:[{currencyId:'gold',amount}]}),TypeError);
    }
    for(const invalid of ['', '  ',null,1]) {
      assert.throws(()=>capture({...wallet(),walletId:invalid}),TypeError);
      assert.throws(()=>capture({...wallet(),owner:{ownerKind:invalid,ownerId:'a'}}),TypeError);
      assert.throws(()=>capture({...wallet(),owner:{ownerKind:'a',ownerId:invalid}}),TypeError);
      assert.throws(()=>capture({...wallet(),balances:[{currencyId:invalid,amount:1}]}),TypeError);
    }
  }
});

test('CU04 captures detached deeply frozen data without freezing or retaining caller objects', () => {
  const input=wallet(),result=g.createCurrencyWalletState(input),again=validate(result);
  for(const captured of [result,again]) {
    for(const value of [captured,captured.owner,captured.balances,...captured.balances]) {
      assert.ok(Object.isFrozen(value),'deeply frozen Currency snapshot');
    }
    assert.notEqual(captured,input);assert.notEqual(captured.owner,input.owner);
    assert.notEqual(captured.balances,input.balances);assert.notEqual(captured.balances[0],input.balances[0]);
  }
  assert.notEqual(again,result);assert.notEqual(again.balances[0],result.balances[0]);
  input.owner.ownerId='mutated';input.balances[0].amount=999;input.balances.reverse();
  assert.deepEqual(result,wallet());assert.deepEqual(again,wallet());
  assert.equal(Object.isFrozen(input.owner),false);
  assert.throws(()=>{result.balances[0].amount=1;},TypeError);
  assert.throws(()=>result.balances.push({currencyId:'injected',amount:0}),TypeError);
  assert.throws(()=>{result.owner.ownerId='other';},TypeError);
});

test('CU04 closed own-data records and dense arrays reject hostile shapes without invoking getters', () => {
  let calls=0;
  const accessor={...wallet()};Object.defineProperty(accessor,'walletId',{get(){calls++;return 'hidden';}});
  const balance={currencyId:'gold',get amount(){calls++;return 1;}};
  const array=[];Object.defineProperty(array,'0',{get(){calls++;return {currencyId:'gold',amount:1};}});
  const cyclic=wallet();cyclic.balances=[cyclic];
  for(const input of [null,[],{...wallet(),extra:true},{walletId:'w',balances:[]},
    accessor,Object.assign(Object.create({inherited:true}),wallet()),
    {...wallet(),[Symbol('extra')]:1},{...wallet(),owner:{ownerKind:'guild',ownerId:'g',extra:1}},
    {...wallet(),owner:Object.create({ownerKind:'guild',ownerId:'g'})},
    {...wallet(),balances:[balance]},{...wallet(),balances:array},{...wallet(),balances:new Array(1)},
    {...wallet(),balances:Object.assign([],{extra:1})},
    {...wallet(),balances:[{currencyId:'gold',amount:1,extra:true}]},
    {...wallet(),balances:[{currencyId:'gold',amount:1,[Symbol('extra')]:1}]},cyclic]) {
    assert.throws(()=>validate(input),TypeError);
  }
  const revoked=Proxy.revocable(wallet(),{});revoked.revoke();
  assert.throws(()=>validate(revoked.proxy),TypeError);
  for(const trap of ['getPrototypeOf','ownKeys','getOwnPropertyDescriptor']) {
    assert.throws(()=>validate(new Proxy(wallet(),{[trap](){throw new Error('trap');}})),TypeError);
  }
  const arraySubclass=new (class extends Array {})();
  assert.throws(()=>validate({...wallet(),balances:arraySubclass}),TypeError);
  const plain=Object.assign(Object.create(null),{walletId:'null-prototype',owner:null,
    balances:[Object.assign(Object.create(null),{currencyId:'constructor',amount:0})]});
  assert.deepEqual(validate(plain),{walletId:'null-prototype',owner:null,balances:[{currencyId:'constructor',amount:0}]});
  assert.equal(calls,0);
});

test('CU05 optional Currency composition and deterministic capture need no implicit providers', () => {
  let registry=g.createModuleRegistry();
  registry=g.registerModule(registry,{id:'currency',optional:true,dependencies:[]});
  assert.deepEqual(g.composeModules(registry,g.configureModules(registry,{enable:[]})).moduleIds,[]);
  assert.deepEqual(g.composeModules(registry,g.configureModules(registry,{enable:['currency']})).moduleIds,['currency']);
  const random=Math.random,now=Date.now;
  try {
    Math.random=()=>{throw new Error('implicit RNG');};Date.now=()=>{throw new Error('implicit clock');};
    assert.deepEqual(g.createCurrencyWalletState(wallet()),wallet());
    assert.deepEqual(validate(wallet()),wallet());
  } finally {Math.random=random;Date.now=now;}
});
