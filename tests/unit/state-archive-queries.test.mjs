import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleGameplayStateArchive as assemble, getGameplayStateRecord as get,
  listGameplayStateRecords as list} from '../../dist/index.js';

const records=()=>[
  {moduleId:'entity',stateKind:'life',stateId:'p1',schemaVersion:2,payload:{status:'alive'}},
  {moduleId:'inventory',stateKind:'bag',stateId:'bag-1',schemaVersion:1,payload:{entries:[]}},
  {moduleId:'currency',stateKind:'wallet',stateId:'w1',schemaVersion:3,
    payload:{balances:[{currencyId:'gold',amount:15}]}}
];
const expected={formatVersion:7,records:[
  {moduleId:'entity',stateKind:'life',stateId:'p1',schemaVersion:2,payload:{status:'alive'}},
  {moduleId:'inventory',stateKind:'bag',stateId:'bag-1',schemaVersion:1,payload:{entries:[]}},
  {moduleId:'currency',stateKind:'wallet',stateId:'w1',schemaVersion:3,
    payload:{balances:[{currencyId:'gold',amount:15}]}}
]};
const key={moduleId:'inventory',stateKind:'bag',stateId:'bag-1'};
function frozen(value) {
  if(value!==null && typeof value==='object') {
    assert.ok(Object.isFrozen(value));
    for(const child of Object.values(value)) frozen(child);
  }
}

test('ST06 explicit assembly preserves complete caller order and independent version labels',()=>{
  const input=records(),archive=assemble(7,input);
  assert.deepEqual(archive,expected);frozen(archive);
  assert.notEqual(archive.records,input);assert.notEqual(archive.records[0],input[0]);
  assert.deepEqual(assemble(7,records()),expected);
  assert.deepEqual(assemble(1,[]),{formatVersion:1,records:[]});
  assert.throws(()=>assemble(1,[input[0],input[0]]),TypeError);
  assert.throws(()=>assemble(0,[]),TypeError);
});

test('ST07 exact lookup distinguishes kinds and modules, with null only for valid absence',()=>{
  const archive=assemble(1,[
    {moduleId:'entity',stateKind:'life',stateId:'p1',schemaVersion:1,payload:'alive'},
    {moduleId:'entity',stateKind:'resource',stateId:'p1',schemaVersion:1,payload:{health:10}},
    {moduleId:'other',stateKind:'resource',stateId:'p1',schemaVersion:1,payload:{health:20}}
  ]);
  assert.deepEqual(get(archive,{moduleId:'entity',stateKind:'resource',stateId:'p1'}),
    {moduleId:'entity',stateKind:'resource',stateId:'p1',schemaVersion:1,payload:{health:10}});
  assert.equal(get(archive,{moduleId:'entity',stateKind:'life',stateId:'p1'}).payload,'alive');
  assert.deepEqual(get({formatVersion:7,records:records()},key),expected.records[1]);
  assert.equal(get({formatVersion:7,records:records()},{...key,stateKind:'equipment'}),null);
  assert.equal(get(archive,{moduleId:'Entity',stateKind:'resource',stateId:'p1'}),null);
  assert.equal(get(archive,{moduleId:'entity',stateKind:'resource',stateId:' p1 '}),null);
  assert.equal(get(assemble(1,[]),key),null);
});

test('ST08/ST09 listing and lookup are deterministic frozen snapshots isolated from mutable inputs',()=>{
  const input=records(),raw={formatVersion:7,records:input},archive=assemble(7,input);
  const listed=list(raw),found=get(raw,{moduleId:'currency',stateKind:'wallet',stateId:'w1'});
  assert.deepEqual(listed,expected.records);assert.deepEqual(list(raw),expected.records);
  assert.deepEqual(found,expected.records[2]);frozen(listed);frozen(found);
  assert.notEqual(listed,input);assert.notEqual(listed[2].payload,input[2].payload);
  assert.notEqual(found.payload.balances[0],input[2].payload.balances[0]);
  input[2].payload.balances[0].amount=999;input.reverse();
  assert.deepEqual(archive,expected);assert.deepEqual(listed,expected.records);
  assert.deepEqual(found,expected.records[2]);assert.deepEqual(list(archive),expected.records);
  assert.deepEqual(get(archive,{moduleId:'currency',stateKind:'wallet',stateId:'w1'}),expected.records[2]);
  assert.equal(Object.isFrozen(input),false);assert.equal(Object.isFrozen(input[0].payload),false);
  assert.throws(()=>{listed.push(found);},TypeError);
  assert.throws(()=>{found.payload.balances[0].amount=2;},TypeError);
});

test('ST10 queries reject malformed keys and the entire invalid archive even beyond a matching record',()=>{
  let calls=0;
  const raw={formatVersion:7,records:records()};
  for(const invalid of [null,{}, {...key,stateId:' '},{...key,extra:1},Object.create(key),
    {...key,get stateKind(){calls++;return 'bag';}}, {...key,[Symbol('key')]:true}]) {
    assert.throws(()=>get(raw,invalid),TypeError);
  }
  const revoked=Proxy.revocable(key,{});revoked.revoke();
  assert.throws(()=>get(raw,revoked.proxy),TypeError);
  for(const invalid of [null,{...raw,formatVersion:0},
    {...raw,records:[raw.records[1],raw.records[1]]},
    {...raw,records:[raw.records[1],{...raw.records[2],payload:{nested:undefined}}]},
    {...raw,records:[raw.records[1],{...raw.records[2],get payload(){calls++;return null;}}]}]) {
    assert.throws(()=>get(invalid,key),TypeError);
    assert.throws(()=>get(invalid,{...key,stateId:'missing'}),TypeError);
    assert.throws(()=>list(invalid),TypeError);
  }
  assert.equal(calls,0);assert.deepEqual(raw,expected);assert.equal(Object.isFrozen(raw.records),false);
});
