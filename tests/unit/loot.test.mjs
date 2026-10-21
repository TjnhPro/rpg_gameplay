import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as g from '../../dist/index.js';

const table = () => ({tableId:' Table ',noDropWeight:60,entries:[
  {entryId:'Choice',definitionId:'opaque',weight:30,quantity:2},
  {entryId:'choice',definitionId:'opaque',weight:10,quantity:1},
]});
const result = () => ({tableId:' Unresolved ',drops:[{entryId:'missing',definitionId:'unknown',quantity:2}]});
const tableActions = [g.createLootTableDefinition,g.validateLootTableDefinition];
function invalidTable(input) { for(const action of tableActions) assert.throws(()=>action(input),TypeError); }
function frozen(value) {
  if(value!==null&&typeof value==='object') {
    assert.ok(Object.isFrozen(value));for(const child of Object.values(value))frozen(child);
  }
}

test('Loot tables preserve exact identities, ordered choices and repeated opaque definition references',()=>{
  for(const action of tableActions) {
    const empty=action({tableId:' Empty ',entries:[],noDropWeight:1});
    assert.deepEqual(empty,{tableId:' Empty ',entries:[],noDropWeight:1});frozen(empty);
    assert.deepEqual(action(table()),{tableId:' Table ',noDropWeight:60,entries:[
      {entryId:'Choice',definitionId:'opaque',weight:30,quantity:2},
      {entryId:'choice',definitionId:'opaque',weight:10,quantity:1},
    ]});
    assert.equal(action({...table(),noDropWeight:0}).noDropWeight,0);
    const special=action({tableId:'__proto__',noDropWeight:0,entries:[
      {entryId:'constructor',definitionId:'__proto__',weight:1,quantity:1},
      {entryId:'__proto__',definitionId:'constructor',weight:1,quantity:1},
    ]});
    assert.equal(special.entries[1].entryId,'__proto__');
    assert.deepEqual(action(Object.assign(Object.create(null),table())),table());
  }
  for(const value of ['', ' \t',null,4,{},undefined]) {
    invalidTable({...table(),tableId:value});
    for(const key of ['entryId','definitionId'])invalidTable({...table(),entries:[{...table().entries[0],[key]:value}]});
  }
  invalidTable({...table(),entries:[table().entries[0],table().entries[0]]});
});

test('Loot safe integer bounds, positive total and overflow fail closed without normalization',()=>{
  const max=Number.MAX_SAFE_INTEGER;
  for(const value of [-1,0,0.5,NaN,Infinity,-Infinity,max+1,'1',null,undefined]) {
    for(const key of ['weight','quantity'])invalidTable({...table(),entries:[{...table().entries[0],[key]:value}]});
  }
  for(const noDropWeight of [-1,0.5,NaN,Infinity,max+1,'0',null,undefined])invalidTable({...table(),noDropWeight});
  invalidTable({tableId:'zero',entries:[],noDropWeight:0});
  invalidTable({...table(),noDropWeight:max});
  invalidTable({...table(),noDropWeight:0,entries:[
    {...table().entries[0],weight:max},{...table().entries[1],weight:1},
  ]});
  for(const action of tableActions) {
    assert.deepEqual(action({tableId:'max',entries:[],noDropWeight:max}),{tableId:'max',entries:[],noDropWeight:max});
    assert.deepEqual(action({tableId:'max',noDropWeight:0,entries:[
      {entryId:'one',definitionId:'unresolved',weight:max,quantity:max},
    ]}),{tableId:'max',noDropWeight:0,entries:[{entryId:'one',definitionId:'unresolved',weight:max,quantity:max}]});
  }
});

test('Loot results are structural ordered intents, allowing no drop and repeated selections without table binding',()=>{
  assert.deepEqual(g.validateLootRollResult({tableId:'no-catalog',drops:[]}),{tableId:'no-catalog',drops:[]});
  assert.deepEqual(g.validateLootRollResult({tableId:' Unresolved ',drops:[
    {entryId:'missing',definitionId:'unknown',quantity:2},
    {entryId:'missing',definitionId:'other',quantity:3},
  ]}),{tableId:' Unresolved ',drops:[
    {entryId:'missing',definitionId:'unknown',quantity:2},
    {entryId:'missing',definitionId:'other',quantity:3},
  ]});
  for(const value of ['', ' ',null,3]) {
    assert.throws(()=>g.validateLootRollResult({...result(),tableId:value}),TypeError);
    for(const key of ['entryId','definitionId'])assert.throws(()=>g.validateLootRollResult({
      ...result(),drops:[{...result().drops[0],[key]:value}],
    }),TypeError);
  }
  for(const quantity of [0,-1,0.1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'2']) {
    assert.throws(()=>g.validateLootRollResult({...result(),drops:[{...result().drops[0],quantity}]}),TypeError);
  }
  assert.equal(g.validateLootRollResult({...result(),drops:[{...result().drops[0],quantity:Number.MAX_SAFE_INTEGER}]}).drops[0].quantity,Number.MAX_SAFE_INTEGER);
});

test('Loot closed records reject unexpected/inherited/symbol/accessor fields at every record boundary without getter calls',()=>{
  let reads=0;
  const boundaries=[
    [table(),x=>invalidTable(x)],
    [table().entries[0],x=>invalidTable({...table(),entries:[x]})],
    [result(),x=>assert.throws(()=>g.validateLootRollResult(x),TypeError)],
    [result().drops[0],x=>assert.throws(()=>g.validateLootRollResult({...result(),drops:[x]}),TypeError)],
  ];
  for(const [record,reject] of boundaries) {
    const key=Object.keys(record)[0];
    const missing={...record};delete missing[key];reject(missing);
    const inherited=Object.assign(Object.create({[key]:record[key]}),missing);reject(inherited);
    reject(Object.assign(Object.create({}),record));
    for(const extra of ['unexpected','__proto__','constructor','prototype',Symbol('hidden')]) {
      reject(Object.defineProperty({...record},extra,{value:1}));
    }
    reject(Object.defineProperty({...record},key,{get(){reads++;throw Error('getter invoked');}}));
    reject(Object.defineProperty({...record},'extra',{get(){reads++;return 1;}}));
    reject(null);reject([]);reject(new Date());
  }
  assert.equal(reads,0);assert.equal(Object.hasOwn(Object.prototype,'unexpected'),false);
});

test('Loot arrays reject holes, extra keys, accessors, unsupported prototypes, cycles and unsafe inspection',()=>{
  let reads=0;
  for(const [element,wrap,reject] of [
    [table().entries[0],x=>({...table(),entries:x}),invalidTable],
    [result().drops[0],x=>({...result(),drops:x}),x=>assert.throws(()=>g.validateLootRollResult(x),TypeError)],
  ]) {
    const getter=[element];Object.defineProperty(getter,'0',{get(){reads++;return element;}});
    const inherited=[element];Object.setPrototypeOf(inherited,Object.create(Array.prototype));
    const cyclic=[];cyclic.push(cyclic);
    for(const array of [undefined,null,{},new Array(1),getter,inherited,cyclic,
      Object.assign([element],{extra:1}),Object.assign([element],{[Symbol('extra')]:1}),
      Object.defineProperty([element],'01',{value:element})])reject(wrap(array));
    const cyclicRecord={...element};cyclicRecord.definitionId=cyclicRecord;reject(wrap([cyclicRecord]));
    const revoked=Proxy.revocable([],{});revoked.revoke();reject(wrap(revoked.proxy));
    reject(wrap(new Proxy([],{ownKeys(){throw new Error('inspection failure');}})));
  }
  const cycle=table();cycle.entries=[cycle];invalidTable(cycle);
  const revoked=Proxy.revocable({},{});revoked.revoke();invalidTable(revoked.proxy);
  assert.throws(()=>g.validateLootRollResult(revoked.proxy),TypeError);
  assert.equal(reads,0);
});

test('Loot snapshots are fresh recursively frozen detached data; callers remain mutable and untouched',()=>{
  for(const [input,action,key] of [[table(),g.createLootTableDefinition,'entries'],
    [table(),g.validateLootTableDefinition,'entries'],[result(),g.validateLootRollResult,'drops']]) {
    const original=structuredClone(input), first=action(input), second=action(first);
    assert.deepEqual(input,original);assert.deepEqual(second,first);
    for(const snapshot of [first,second]) {
      frozen(snapshot);assert.notEqual(snapshot,input);assert.notEqual(snapshot[key],input[key]);
      assert.notEqual(snapshot[key][0],input[key][0]);
      assert.throws(()=>snapshot[key].push({}),TypeError);
      assert.throws(()=>{snapshot[key][0].quantity=99;},TypeError);
    }
    assert.notEqual(first,second);assert.notEqual(first[key],second[key]);assert.notEqual(first[key][0],second[key][0]);
    assert.equal(Object.isFrozen(input),false);assert.equal(Object.isFrozen(input[key]),false);
    assert.equal(Object.isFrozen(input[key][0]),false);
    input.tableId='changed';input[key][0].quantity=99;input[key].push({...input[key][0]});
    assert.deepEqual(first,original);
  }
});

test('Loot is optional with no dependencies and does not change disabled or sibling compositions',()=>{
  const declarations=JSON.parse(readFileSync(new URL('../../harness/modules.json',import.meta.url))).modules;
  assert.deepEqual(declarations.find(x=>x.id==='loot'),{id:'loot',optional:true,dependencies:[]});
  let registry=g.createModuleRegistry();for(const declaration of declarations)registry=g.registerModule(registry,declaration);
  const compose=enable=>g.composeModules(registry,g.configureModules(registry,{enable})).moduleIds;
  assert.deepEqual(compose([]),[]);assert.deepEqual(compose(['loot']),['loot']);
  assert.deepEqual(compose(['item','inventory','equipment']),['item','inventory','equipment']);
  assert.deepEqual(compose(['loot','equipment','item']),['item','equipment','loot']);
});
