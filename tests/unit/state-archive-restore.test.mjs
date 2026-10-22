import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareGameplayStateRestore as prepare, validateCurrencyWalletState} from '../../dist/index.js';

const walletKey={moduleId:'currency',stateKind:'wallet',stateId:'w1'};
const archive=()=>({formatVersion:1,records:[
  {moduleId:'entity',stateKind:'life',stateId:'p1',schemaVersion:1,payload:{status:'alive'}},
  {...walletKey,schemaVersion:2,payload:{balances:[{currencyId:'gold',amount:15}]}}
]});
const policy=()=>({supportedFormatVersions:[1],schemas:[
  {moduleId:'entity',stateKind:'life',supportedSchemaVersions:[1]},
  {moduleId:'currency',stateKind:'wallet',supportedSchemaVersions:[2]}
],requiredRecords:[{...walletKey}]});
function frozen(value) {
  if(value!==null && typeof value==='object') {
    assert.ok(Object.isFrozen(value));for(const child of Object.values(value)) frozen(child);
  }
}

test('ST11/ST12/ST14 explicit mixed owner versions produce detached frozen handoff without domain restoration',()=>{
  const source=archive(),support=policy(),result=prepare(source,support);
  const expected={status:'ready',reason:'none',records:[
    {moduleId:'entity',stateKind:'life',stateId:'p1',schemaVersion:1,payload:{status:'alive'}},
    {moduleId:'currency',stateKind:'wallet',stateId:'w1',schemaVersion:2,
      payload:{balances:[{currencyId:'gold',amount:15}]}}
  ]};
  assert.deepEqual(result,expected);assert.deepEqual(prepare(source,support),expected);frozen(result);
  assert.notEqual(result.records,source.records);
  assert.notEqual(result.records[1].payload.balances[0],source.records[1].payload.balances[0]);
  source.records[1].payload.balances[0].amount=999;source.records.reverse();
  support.schemas[1].supportedSchemaVersions[0]=3;support.requiredRecords.length=0;
  assert.deepEqual(result,expected);assert.equal(Object.isFrozen(source),false);assert.equal(Object.isFrozen(support),false);
  assert.throws(()=>{result.records[1].payload.balances[0].amount=0;},TypeError);
  // Metadata support does not make this deliberately incomplete payload a valid wallet.
  assert.throws(()=>validateCurrencyWalletState(result.records[1].payload),TypeError);
  assert.deepEqual(prepare({formatVersion:1,records:[]},
    {supportedFormatVersions:[1],schemas:[],requiredRecords:[]}),{status:'ready',reason:'none',records:[]});
});

test('ST13 exact required identities reject absence without creating or returning partial state',()=>{
  const source=archive(),support=policy();support.requiredRecords[0].stateId='w2';
  const before=structuredClone(source),result=prepare(source,support);
  assert.deepEqual(result,{status:'rejected',reason:'missing_required',records:null});frozen(result);
  assert.deepEqual(source,before);
  support.requiredRecords=[];
  assert.equal(prepare(source,support).status,'ready'); // Supported kinds need not require every possible ID.
  support.schemas.push({moduleId:'currency',stateKind:'reserve',supportedSchemaVersions:[2]});
  support.requiredRecords=[{...walletKey,stateKind:'reserve'}];
  assert.deepEqual(prepare(source,support),{status:'rejected',reason:'missing_required',records:null});
});

test('ST15 compatibility rejections are all-or-nothing with format then kind then schema then required priority',()=>{
  const source=archive(),support=policy();
  support.requiredRecords[0].stateId='missing';
  source.records[0].schemaVersion=9;
  source.records.push({moduleId:'future',stateKind:'opaque',stateId:'x',schemaVersion:1,payload:null});
  source.formatVersion=2;
  assert.deepEqual(prepare(source,support),{status:'rejected',reason:'unsupported_format',records:null});
  source.formatVersion=1;
  assert.deepEqual(prepare(source,support),{status:'rejected',reason:'unknown_state_kind',records:null});
  source.records.pop();
  assert.deepEqual(prepare(source,support),{status:'rejected',reason:'unsupported_schema',records:null});
  source.records[0].schemaVersion=1;
  assert.deepEqual(prepare(source,support),{status:'rejected',reason:'missing_required',records:null});
  const exact=archive();exact.records[1].stateKind='Wallet';
  assert.deepEqual(prepare(exact,policy()),{status:'rejected',reason:'unknown_state_kind',records:null});
});

test('ST15 policy is closed dense own data with unique positive versions, kinds and declared required keys',()=>{
  const valid=policy(),schema=valid.schemas[0];
  const invalid=[null,{}, {...valid,extra:true},Object.create(valid),
    {...valid,supportedFormatVersions:[]}, {...valid,supportedFormatVersions:[1,1]},
    {...valid,supportedFormatVersions:[0]}, {...valid,supportedFormatVersions:[1.5]},
    {...valid,supportedFormatVersions:[Number.MAX_SAFE_INTEGER+1]},
    {...valid,schemas:[schema,schema]}, {...valid,schemas:[{...schema,extra:1}]},
    {...valid,schemas:[{...schema,moduleId:' '}]}, {...valid,schemas:[{...schema,supportedSchemaVersions:[]}]},
    {...valid,schemas:[{...schema,supportedSchemaVersions:[1,1]}]},
    {...valid,schemas:[{...schema,supportedSchemaVersions:[Infinity]}]},
    {...valid,schemas:new Array(1)}, {...valid,requiredRecords:new Array(1)},
    {...valid,requiredRecords:[walletKey,walletKey]},
    {...valid,requiredRecords:[{...walletKey,stateId:' '}]},
    {...valid,requiredRecords:[{...walletKey,stateKind:'undeclared'}]},
    {...valid,requiredRecords:[{...walletKey,extra:1}]}];
  for(const input of invalid) {
    assert.throws(()=>prepare(archive(),input),TypeError);
    assert.throws(()=>prepare({...archive(),formatVersion:2},input),TypeError);
  }
  // Exact identities are not joined with delimiters or normalized.
  assert.equal(prepare({formatVersion:1,records:[]},{supportedFormatVersions:[2,1],schemas:[
    {moduleId:'a/b',stateKind:'c',supportedSchemaVersions:[2,1]},
    {moduleId:'a',stateKind:'b/c',supportedSchemaVersions:[1]}
  ],requiredRecords:[]}).status,'ready');
});

test('ST15 full structural validation precedes typed rejection and never invokes policy or payload getters',()=>{
  let calls=0;
  const valid=policy(),schema=valid.schemas[0];
  const getterPolicy={...valid,get requiredRecords(){calls++;return [];}};
  const hidden=Object.defineProperty(policy(),'schemas',{enumerable:false});
  const getterVersions=[1];Object.defineProperty(getterVersions,'0',{enumerable:true,get(){calls++;return 1;}});
  const badPolicies=[getterPolicy,hidden,{...valid,[Symbol('hidden')]:1},
    {...valid,schemas:[{...schema,get supportedSchemaVersions(){calls++;return [1];}}]},
    {...valid,supportedFormatVersions:getterVersions}];
  const revoked=Proxy.revocable({},{});revoked.revoke();badPolicies.push(revoked.proxy);
  badPolicies.push(new Proxy(valid,{ownKeys(){throw new Error('trap');}}));
  for(const input of badPolicies) assert.throws(()=>prepare({...archive(),formatVersion:2},input),TypeError);
  const badArchive={formatVersion:2,records:[...archive().records,
    {moduleId:'future',stateKind:'x',stateId:'x',schemaVersion:1,get payload(){calls++;return null;}}]};
  assert.throws(()=>prepare(badArchive,valid),TypeError);
  assert.throws(()=>prepare({formatVersion:2,records:[...archive().records,archive().records[0]]},valid),TypeError);
  assert.equal(calls,0);
});
