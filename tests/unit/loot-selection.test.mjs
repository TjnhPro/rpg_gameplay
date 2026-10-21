import test from 'node:test';
import assert from 'node:assert/strict';
import {rollLootTable,createLootTableDefinition,validateLootTableDefinition,validateLootRollResult} from '../../dist/index.js';

const table=()=>({tableId:'fixture',noDropWeight:60,entries:[
  {entryId:'p',definitionId:'potion',weight:30,quantity:2},
  {entryId:'s',definitionId:'sword',weight:10,quantity:1},
]});
const none={tableId:'fixture',drops:[]};
const potion={tableId:'fixture',drops:[{entryId:'p',definitionId:'potion',quantity:2}]};
const sword={tableId:'fixture',drops:[{entryId:'s',definitionId:'sword',quantity:1}]};

test('Loot selection uses literal half-open bucket boundaries and adjacent representable samples',()=>{
  for(const [sample,expected] of [
    [0,none],[Number.MIN_VALUE,none],[0.59,none],[0.5999999999999999,none],
    [0.60,potion],[0.6000000000000001,potion],[0.89,potion],[0.8999999999999999,potion],
    [0.90,sword],[0.9000000000000001,sword],[0.99,sword],[0.9999999999999999,sword],
  ])assert.deepEqual(rollLootTable(table(),sample),expected,`sample ${sample}`);
  const reversed={...table(),entries:[...table().entries].reverse()};
  assert.deepEqual(rollLootTable(reversed,0.60),sword);
  assert.deepEqual(rollLootTable(reversed,0.70),potion);
  // Total8, exact binary fractions: no-drop ticket0, first ticket1, second tickets2..7.
  const ratio={tableId:'ratio',noDropWeight:1,entries:[
    {entryId:'small',definitionId:'shared',weight:1,quantity:2},
    {entryId:'large',definitionId:'shared',weight:6,quantity:7},
  ]};
  assert.deepEqual(rollLootTable(ratio,0),{tableId:'ratio',drops:[]});
  assert.deepEqual(rollLootTable(ratio,0.125),{tableId:'ratio',drops:[{entryId:'small',definitionId:'shared',quantity:2}]});
  for(const sample of [0.25,0.375,0.5,0.625,0.75,0.875]) {
    assert.deepEqual(rollLootTable(ratio,sample),{tableId:'ratio',drops:[{entryId:'large',definitionId:'shared',quantity:7}]});
  }
});

test('Loot selection rejects invalid samples after complete canonical table validation',()=>{
  let reads=0;
  for(const sample of [-1,-0.01,1,1.01,NaN,Infinity,-Infinity,'0.2',null,undefined,()=>{reads++;return 0;},
    {valueOf(){reads++;return 0;}}])assert.throws(()=>rollLootTable(table(),sample),/Loot sample/);
  const hostile={...table(),get entries(){reads++;return [];}};
  for(const bad of [hostile,{...table(),entries:[table().entries[0],{...table().entries[1],quantity:0}]},
    {...table(),entries:[table().entries[0],table().entries[0]]},
    {...table(),noDropWeight:Number.MAX_SAFE_INTEGER}]) {
    let canonical;
    try {validateLootTableDefinition(bad);} catch(error) {canonical=error;}
    assert.ok(canonical instanceof TypeError);
    for(const sample of [0,NaN])assert.throws(()=>rollLootTable(bad,sample),error=>error instanceof TypeError&&error.message===canonical.message);
  }
  assert.equal(reads,0);
});

test('Loot selection resolves no-drop-only and disabled no-drop with safe large final buckets',()=>{
  const only={tableId:'only',entries:[],noDropWeight:Number.MAX_SAFE_INTEGER};
  const real={tableId:'real',noDropWeight:0,entries:[{entryId:'one',definitionId:'opaque',weight:1,quantity:2}]};
  for(const sample of [0,Number.MIN_VALUE,0.5,0.9999999999999999]) {
    assert.deepEqual(rollLootTable(only,sample),{tableId:'only',drops:[]});
    assert.deepEqual(rollLootTable(real,sample),{tableId:'real',drops:[{entryId:'one',definitionId:'opaque',quantity:2}]});
  }
  const large={tableId:'large',noDropWeight:Number.MAX_SAFE_INTEGER-1,entries:[
    {entryId:'last',definitionId:'last',weight:1,quantity:Number.MAX_SAFE_INTEGER},
  ]};
  assert.deepEqual(rollLootTable(large,0),{tableId:'large',drops:[]});
  assert.deepEqual(rollLootTable(large,0.9999999999999999),{tableId:'large',drops:[
    {entryId:'last',definitionId:'last',quantity:Number.MAX_SAFE_INTEGER},
  ]});
  assert.deepEqual(rollLootTable({...real,entries:[{...real.entries[0],weight:Number.MAX_SAFE_INTEGER}]},0.9999999999999999),
    {tableId:'real',drops:[{entryId:'one',definitionId:'opaque',quantity:2}]});
});

test('Loot selection is replayable without implicit RNG, clock or caller provider calls',()=>{
  const random=Math.random,now=Date.now;
  let calls=0;
  try {
    Math.random=()=>{calls++;throw new Error('implicit RNG');};
    Date.now=()=>{calls++;throw new Error('implicit clock');};
    for(const sample of [0,0.60,0.90]) {
      const first=rollLootTable(table(),sample),second=rollLootTable(table(),sample);
      assert.deepEqual(second,first);assert.notEqual(second,first);assert.notEqual(second.drops,first.drops);
    }
    assert.deepEqual(rollLootTable(table(),0.60),potion);
    assert.equal(calls,0);
  } finally {Math.random=random;Date.now=now;}
});

test('Loot selection returns detached deeply frozen exact results and leaves caller data mutable',()=>{
  const input=table(),before=structuredClone(input);
  const result=rollLootTable(input,0.60),second=rollLootTable(input,0.60);
  assert.deepEqual(result,potion);assert.deepEqual(validateLootRollResult(result),potion);
  assert.deepEqual(input,before);
  assert.equal(Object.isFrozen(input),false);assert.equal(Object.isFrozen(input.entries),false);
  assert.equal(Object.isFrozen(input.entries[0]),false);
  assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(result.drops));assert.ok(Object.isFrozen(result.drops[0]));
  assert.notEqual(result.drops[0],input.entries[0]);assert.notEqual(result.drops[0],second.drops[0]);
  assert.deepEqual(Reflect.ownKeys(result),['tableId','drops']);
  assert.deepEqual(Reflect.ownKeys(result.drops[0]),['entryId','definitionId','quantity']);
  assert.throws(()=>{result.drops[0].quantity=9;},TypeError);assert.throws(()=>result.drops.push({}),TypeError);
  input.entries[0].quantity=99;input.entries[0].definitionId='changed';input.tableId='changed';
  assert.deepEqual(result,potion);
  assert.deepEqual(rollLootTable(createLootTableDefinition(before),0.60),potion);
  const noDrop=rollLootTable(before,0);assert.deepEqual(noDrop,none);
  assert.ok(Object.isFrozen(noDrop));assert.ok(Object.isFrozen(noDrop.drops));
});
