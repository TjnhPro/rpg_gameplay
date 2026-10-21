import assert from 'node:assert/strict';
import test from 'node:test';
import * as g from '@rpg/gameplay';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

function contract(ids,name,run){test('Encounter '+name,()=>{
 let assertions=0;
 const a=new Proxy(assert,{get(target,key){return (...args)=>{assertions++;return Reflect.get(target,key)(...args);};}});
 run(a);assert.ok(assertions>0,'Encounter requires actual assertions');
 for(const id of ids.split(' '))console.log('ENCOUNTER_'+id+'_PASS');
});}
const reference=()=>({definitionId:'forest-wolves'});
const initial=()=>({encounterId:'forest-fight-001',sides:[{sideId:'party'},{sideId:'enemies'}],participants:[{entityId:'player-001',sideId:'party'},{entityId:'monster-001',sideId:'enemies'}]});
const entities=()=>[{id:'player-001',kind:'player'},{id:'monster-001',kind:'monster'}].reduce(g.addEntity,g.createEntityCollection());
const create=(input=initial(),collection=entities())=>g.createEncounterState(reference(),input,collection);
const expected={encounterId:'forest-fight-001',definitionId:'forest-wolves',status:'prepared',sides:[{sideId:'party'},{sideId:'enemies'}],participants:[{entityId:'player-001',sideId:'party'},{entityId:'monster-001',sideId:'enemies'}]};
const invalid=(a,run,message,assertion)=>a.throws(run,{name:'TypeError',...(message?{message}: {})},assertion);
const freeze=(a,value)=>{a.equal(Object.isFrozen(value),true,'Encounter snapshot must be frozen');if(value&&typeof value==='object')for(const child of Object.values(value))if(child&&typeof child==='object')freeze(a,child);};

contract('F01 F02 F03 F04 F05 F06 F11','identity: exact bytes, no global uniqueness',a=>{
 for(const id of ['fight-001','Fight-001',' fight-001 '])a.equal(create({...initial(),encounterId:id}).encounterId,id);
 for(const id of ['', ' \t',null,42,undefined])invalid(a,()=>create({...initial(),encounterId:id}));
 const r=reference(),x=g.createEncounterState(r,initial(),entities()),y=g.createEncounterState(r,{...initial(),encounterId:'second'},entities());
 a.equal(x.definitionId,'forest-wolves');a.equal(y.definitionId,'forest-wolves');a.notEqual(x.encounterId,y.encounterId);a.notEqual(x.sides,y.sides);
 a.deepEqual(create(),create());a.notEqual(create(),create());a.equal(Object.isFrozen(r),false);
});
contract('F07 F08 F09 F10','definition: closed descriptor capture',a=>{
 const input={definitionId:' unknown L3 '},out=g.createEncounterDefinitionReference(input);a.deepEqual(out,{definitionId:' unknown L3 '});a.notEqual(input,out);freeze(a,out);input.definitionId='changed';a.equal(out.definitionId,' unknown L3 ');
 for(const input of [{},{definitionId:''},{definitionId:'  '},{definitionId:2},{definitionId:'d',content:[]}])invalid(a,()=>g.createEncounterDefinitionReference(input));
 let calls=0;invalid(a,()=>g.createEncounterDefinitionReference({get definitionId(){calls++;return 'd';}}),/own data/,'definition accessor must reject');a.equal(calls,0);
});
contract('F12 F13 F14 F15','prepared: literal roster and no activation',a=>{
 a.deepEqual(create(),expected,'prepared literal oracle');
 a.deepEqual(create({encounterId:'empty',sides:[],participants:[]}),{encounterId:'empty',definitionId:'forest-wolves',status:'prepared',sides:[],participants:[]});
 a.deepEqual(create({encounterId:'one',sides:[{sideId:'solo'}],participants:[]}).sides,[{sideId:'solo'}]);
 invalid(a,()=>create({...initial(),status:'active'}),/unknown fields/);
});
contract('F16 F17 F19','status: structural vocabulary and closed state',a=>{
 for(const status of ['prepared','active','resolved','closed','cancelled']){const state=g.validateEncounterState({...expected,status},entities());a.equal(state.status,status);a.deepEqual(Object.keys(state),['encounterId','definitionId','status','sides','participants']);}
 for(const status of ['running','',null,1])invalid(a,()=>g.validateEncounterState({...expected,status},entities()),/Unknown Encounter status/,'unknown status must reject');
 for(const key of ['outcome','winner','waveId','timestamp','metadata'])invalid(a,()=>g.validateEncounterState({...expected,[key]:{}},entities()),/unknown fields/,'state unknown field must reject');
});
contract('F21 F23 F24 F25','sides: generic ordering and unique IDs',a=>{
 const input={...initial(),sides:[{sideId:'C'},{sideId:'A'},{sideId:'B'}],participants:[{entityId:'player-001',sideId:'A'},{entityId:'monster-001',sideId:'A'}]};
 a.deepEqual(create(input).sides,[{sideId:'C'},{sideId:'A'},{sideId:'B'}]);a.deepEqual(create(input).participants,input.participants);
 invalid(a,()=>create({...initial(),sides:[{sideId:'party'},{sideId:'enemies'},{sideId:'party'}]}),/Duplicate Encounter side ID/,'duplicate side must reject');
});
contract('F26 F27','participants: unique canonical ID across sides',a=>{
 for(const sideId of ['party','enemies'])invalid(a,()=>create({...initial(),participants:[...initial().participants,{entityId:'player-001',sideId}]}),/Duplicate Encounter participant Entity ID/,'duplicate participant must reject');
});
contract('F22 F28 F29 F30 F31','membership: canonical Entity and side links, no Life policy',a=>{
 invalid(a,()=>create({...initial(),participants:[{entityId:'absent',sideId:'party'}]}),/Unknown canonical Encounter Entity/,'unknown canonical Entity must reject');
 invalid(a,()=>create({...initial(),participants:[{entityId:'player-001',sideId:'absent'}]}),/Unknown Encounter participant side/);
 for(const kind of ['player','monster','npc','pet','summon','caller-custom']){
  const entity=g.createEntity({id:'X',kind}),collection=g.addEntity(g.createEntityCollection(),entity),life=g.createEntityLifeState(entity,{status:'dead'});
  const input={encounterId:'x',sides:[{sideId:'generic'}],participants:[{entityId:'X',sideId:'generic'}]};
  const before=JSON.stringify({collection,life});a.equal(create(input,collection).participants[0].entityId,'X');a.equal(create({...input,encounterId:'y'},collection).participants[0].entityId,'X');a.equal(JSON.stringify({collection,life}),before);
 }
});
contract('F32 F33 F34','closed: all record levels reject inherited/symbol/accessor data',a=>{
 const side={sideId:'s'},participant={entityId:'e',sideId:'s'};a.deepEqual(g.createEncounterSide(side),side);a.deepEqual(g.createEncounterParticipant(participant),participant);a.notEqual(g.createEncounterSide(side),side);a.notEqual(g.createEncounterParticipant(participant),participant);freeze(a,g.createEncounterSide(side));freeze(a,g.createEncounterParticipant(participant));a.equal(Object.isFrozen(side),false);a.equal(Object.isFrozen(participant),false);
 for(const input of [null,[],Object.create({sideId:'s'}),{sideId:'s',unknown:true},{sideId:'s',[Symbol('x')]:1}])invalid(a,()=>g.createEncounterSide(input));
 let calls=0;
 const bad={get sideId(){calls++;return 'party';}};
 invalid(a,()=>create({...initial(),sides:[bad,{sideId:'enemies'}]}),/own data/,'nested accessor must reject');a.equal(calls,0);
 const badParticipant={...initial().participants[0]};Object.defineProperty(badParticipant,'entityId',{get(){calls++;return 'player-001';}});
 invalid(a,()=>create({...initial(),participants:[badParticipant]}));a.equal(calls,0);
 const aggregate={...initial()};Object.defineProperty(aggregate,'sides',{get(){calls++;return initial().sides;}});invalid(a,()=>create(aggregate));a.equal(calls,0);
});
contract('F35 F38','arrays: reject unsafe shapes and always validate canonical collection',a=>{
 for(const key of ['sides','participants']){
  const sparse=new Array(1),extra=Object.assign([],{polluted:true}),symbol=[];symbol[Symbol('x')]=1;
  const inherited=[];Object.setPrototypeOf(inherited,{0:{sideId:'x'},length:1});
  const getter=[];Object.defineProperty(getter,0,{get(){throw Error('array getter invoked');},configurable:true});
  for(const input of [sparse,extra,symbol,inherited,getter])invalid(a,()=>create({...initial(),[key]:input}));
 }
 for(const collection of [{},{entities:[{id:'x',kind:'custom'}, {id:'x',kind:'custom'}]},{entities:new Array(1)}])invalid(a,()=>create({encounterId:'empty',sides:[],participants:[]},collection));
 const state=create();invalid(a,()=>g.validateEncounterState(state,g.removeEntity(entities(),'player-001')),/Unknown canonical Encounter Entity/);
});
contract('F18 F20 F36 F37','snapshots: deeply frozen, detached, caller preserved',a=>{
 const input=initial(),r=reference(),collection=entities(),before=JSON.stringify(collection);const out=g.createEncounterState(r,input,collection);freeze(a,out);
 const again=g.validateEncounterState(out,collection);a.deepEqual(again,expected);a.notEqual(again,out);a.notEqual(again.participants[0],out.participants[0]);
 a.equal(Object.isFrozen(input),false);a.equal(Object.isFrozen(input.sides),false);a.equal(Object.isFrozen(input.participants[0]),false);
 input.sides[0].sideId='changed';input.participants.reverse();input.participants[0].entityId='changed';r.definitionId='changed';a.deepEqual(out,expected);a.equal(JSON.stringify(collection),before);
 a.throws(()=>{out.sides[0].sideId='changed';},TypeError);a.throws(()=>out.participants.push({entityId:'x',sideId:'party'}),TypeError);
});
contract('F39 F40 F41','composition: exact optional Entity-only dependency',a=>{
 const definitions=JSON.parse(readFileSync(new URL('./encounter-modules.json',import.meta.url),'utf8')).modules;
 a.deepEqual(definitions.find(d=>d.id==='encounter'),{id:'encounter',optional:true,dependencies:['entity']},'Encounter exact dependency oracle');
 const registry=definitions.reduce(g.registerModule,g.createModuleRegistry());
 a.deepEqual(g.composeModules(registry,g.configureModules(registry,{enable:['entity','encounter']})).moduleIds,['entity','encounter']);
 a.throws(()=>g.composeModules(registry,g.configureModules(registry,{enable:['encounter']})),/entity/);
 a.deepEqual(g.composeModules(registry,g.configureModules(registry,{})).moduleIds,[]);
 a.deepEqual(g.composeModules(registry,g.configureModules(registry,{enable:['entity']})).moduleIds,['entity']);
});
contract('F42 F43 F44','replay: literal independent sessions, hidden providers forbidden',a=>{
 const prior=[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval,globalThis.crypto];let calls=0,x,y;
 const fail=()=>{calls++;throw Error('hidden provider');};
 try{Date.now=Math.random=globalThis.setTimeout=globalThis.setInterval=fail;Object.defineProperty(globalThis,'crypto',{value:{randomUUID:fail},configurable:true});x=create();y=create();}
 finally{[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval]=prior;Object.defineProperty(globalThis,'crypto',{value:prior[4],configurable:true});}
 a.equal(calls,0);a.deepEqual(x,expected);a.deepEqual(y,expected);a.notEqual(x,y);a.notEqual(x.sides,y.sides);a.notEqual(x.participants[0],y.participants[0]);
 console.log('ENCOUNTER_REPLAY_SHA256 '+createHash('sha256').update(JSON.stringify(x)).digest('hex'));
});
