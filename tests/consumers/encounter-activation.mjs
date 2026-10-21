import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import * as g from '@rpg/gameplay';
import {activateEncounter} from '@rpg/gameplay';

function contract(ids,name,run){test('Activation '+name,()=>{
 let assertions=0;
 const a=new Proxy(assert,{get(target,key){return (...args)=>{assertions++;return Reflect.get(target,key)(...args);};}});
 run(a);assert.ok(assertions>0,'Activation requires actual assertions');
 for(const id of ids.split(' '))console.log('ENCOUNTER_A'+id+'_PASS');
});}
const initial=()=>({encounterId:'forest-fight-001',sides:[{sideId:'party'},{sideId:'enemies'}],participants:[{entityId:'player-001',sideId:'party'},{entityId:'monster-001',sideId:'enemies'}]});
const entities=()=>[{id:'player-001',kind:'player'},{id:'monster-001',kind:'monster'}].reduce(g.addEntity,g.createEntityCollection());
const state=(input=initial(),collection=entities())=>g.createEncounterState({definitionId:'forest-wolves'},input,collection);
const policy=()=>({requiredOccupiedSideIds:['party','enemies'],minimumParticipants:2,minimumOccupiedSides:2,allowedLifeStatuses:['alive'],requireWorldReady:true});
const observation=()=>({encounterId:'forest-fight-001',participants:initial().participants.map(p=>({entityId:p.entityId,life:g.createEntityLifeState(g.getEntity(entities(),p.entityId),{status:'alive'}),worldReady:true}))});
const assess=(s=state(),p=policy(),o=observation(),e=entities())=>g.evaluateEncounterActivationAdmission(s,e,p,o);
const start=(s=state(),p=policy(),o=observation(),e=entities())=>activateEncounter(s,e,p,o);
const literal={encounterId:'forest-fight-001',definitionId:'forest-wolves',status:'active',sides:[{sideId:'party'},{sideId:'enemies'}],participants:[{entityId:'player-001',sideId:'party'},{entityId:'monster-001',sideId:'enemies'}]};
const rejection=(reason,sideId=null,entityId=null)=>({status:'rejected',reason,encounterId:'forest-fight-001',sideId,entityId});
const invalid=(a,fn,message)=>a.throws(fn,{name:'TypeError'},message);
const frozen=(a,x)=>{a.equal(Object.isFrozen(x),true,'activation deep freeze');for(const v of Object.values(x))if(v&&typeof v==='object')frozen(a,v);};

contract('01 02 03 04 05 06 07 08','creation: canonical prepared roster',a=>{
 a.deepEqual(state(),{encounterId:'forest-fight-001',definitionId:'forest-wolves',status:'prepared',sides:[{sideId:'party'},{sideId:'enemies'}],participants:[{entityId:'player-001',sideId:'party'},{entityId:'monster-001',sideId:'enemies'}]});
 const x=state(),y=state({...initial(),encounterId:'second'});a.equal(y.definitionId,'forest-wolves');a.notEqual(x.sides,y.sides);
 a.deepEqual(assess(state({...initial(),participants:[]}),policy(),{...observation(),participants:[]}),rejection('insufficient_participants'));
 a.deepEqual(assess(state({...initial(),participants:[initial().participants[0]]}),{...policy(),minimumParticipants:1,minimumOccupiedSides:1}, {...observation(),participants:[observation().participants[0]]}),rejection('required_side_unoccupied','enemies'));
 for(const kind of ['npc','pet','summon','custom']){const e=g.addEntity(g.createEntityCollection(),{id:'X',kind});const s=state({encounterId:'forest-fight-001',sides:[{sideId:'solo'}],participants:[{entityId:'X',sideId:'solo'}]},e);const o={encounterId:s.encounterId,participants:[{entityId:'X',life:g.createEntityLifeState(g.getEntity(e,'X'),{status:'alive'}),worldReady:true}]};a.equal(assess(s,{...policy(),requiredOccupiedSideIds:[],minimumParticipants:1,minimumOccupiedSides:1},o,e).status,'admitted');a.equal(g.listEntities(e).length,1);}
 invalid(a,()=>state({...initial(),status:'active'}));
 a.equal(g.createEncounterState({definitionId:'unknown-content'},initial(),entities()).definitionId,'unknown-content');
 const e=entities(),before=JSON.stringify(e);start(state(initial(),e),policy(),observation(),e);a.equal(JSON.stringify(e),before);
});
contract('09 11 12 13 14 15 16 17','observations: closed canonical Life binding',a=>{
 const input=observation(),out=g.createEncounterActivationObservation(input);a.deepEqual(out,{encounterId:'forest-fight-001',participants:[{entityId:'player-001',life:{entityId:'player-001',status:'alive'},worldReady:true},{entityId:'monster-001',life:{entityId:'monster-001',status:'alive'},worldReady:true}]});frozen(a,out);a.notEqual(out.participants[0].life,input.participants[0].life);
 invalid(a,()=>g.createEncounterActivationObservation({...input,participants:[input.participants[0],input.participants[0]]}));
 invalid(a,()=>assess(state(),policy(),{...input,participants:[...input.participants,{entityId:'foreign',life:{entityId:'foreign',status:'alive'},worldReady:true}]}));
 invalid(a,()=>g.createEncounterActivationObservation({...input,participants:[{...input.participants[0],life:{entityId:'other',status:'alive'}}]}));
 invalid(a,()=>assess(state(),policy(),{...input,encounterId:'other'}),'observation binding must throw');
 for(const worldReady of ['true',1,0,null])invalid(a,()=>g.createEncounterActivationObservation({...input,participants:[{...input.participants[0],worldReady}]}));
 for(const life of [{entityId:'player-001',status:'unknown'},{entityId:'player-001'},{entityId:'player-001',status:'alive',hp:1}])invalid(a,()=>g.createEncounterActivationObservation({...input,participants:[{...input.participants[0],life}]}));
 invalid(a,()=>assess(state(),policy(),input,g.removeEntity(entities(),'player-001')));
});
contract('10 18 29','missing: stage precedence and roster diagnostic',a=>{
 const o=observation();o.participants[0].life={entityId:'player-001',status:'dead'};o.participants.pop();
 a.deepEqual(assess(state(),policy(),o),rejection('participant_fact_missing','enemies','monster-001'),'missing fact exact diagnostic');
 a.deepEqual(assess(state(),policy(),{...o,participants:[]}),rejection('participant_fact_missing','party','player-001'));
 const both=observation();both.participants.forEach(f=>{f.life={entityId:f.entityId,status:'dead'};});
 a.deepEqual(assess(state(),policy(),both),rejection('participant_life_not_allowed','party','player-001'));both.participants.reverse();a.deepEqual(assess(state(),policy(),both),rejection('participant_life_not_allowed','party','player-001'));
});
contract('19 20 21 22 23 24 31','policy: explicit participant and occupied-side minima',a=>{
 a.deepEqual(assess(),{status:'admitted',reason:'none',encounterId:'forest-fight-001',sideId:null,entityId:null});
 a.deepEqual(assess(state(),{...policy(),minimumParticipants:3}),rejection('insufficient_participants'));
 const s=state({...initial(),participants:initial().participants.map(p=>({...p,sideId:'party'}))});
 a.deepEqual(assess(s),rejection('insufficient_occupied_sides'),'occupied not declared oracle');
 a.deepEqual(assess(s,{...policy(),minimumOccupiedSides:1,requiredOccupiedSideIds:[]}),{status:'admitted',reason:'none',encounterId:'forest-fight-001',sideId:null,entityId:null});
 for(const requiredOccupiedSideIds of [['absent','enemies'],['enemies','absent']])a.deepEqual(assess(s,{...policy(),minimumOccupiedSides:1,requiredOccupiedSideIds}),rejection('required_side_unoccupied',requiredOccupiedSideIds[0]));
});
contract('25 26 27 28 30','readiness: Life precedes World without mutation',a=>{
 const o=observation();o.participants[0].worldReady=false;o.participants[1].life={entityId:'monster-001',status:'dead'};
 a.deepEqual(assess(state(),policy(),o),rejection('participant_life_not_allowed','enemies','monster-001'),'life exact diagnostic before world');
 a.deepEqual(assess(state(),{...policy(),allowedLifeStatuses:['dead','alive']},o),rejection('participant_world_not_ready','party','player-001'),'world exact diagnostic');
 a.equal(assess(state(),{...policy(),allowedLifeStatuses:['dead','alive'],requireWorldReady:false},o).status,'admitted');a.equal(o.participants[1].life.status,'dead');
 const out=start(state(),{...policy(),allowedLifeStatuses:['dead','alive'],requireWorldReady:false},o);a.equal(out.status,'activated');a.equal(o.participants[1].life.status,'dead');
});
contract('32 33 34','malformed: required policy and own-data schemas',a=>{
 for(const patch of [{requiredOccupiedSideIds:['party','party']},{requiredOccupiedSideIds:[' ']},{allowedLifeStatuses:[]},{allowedLifeStatuses:['alive','alive']},{allowedLifeStatuses:['unknown']},{requireWorldReady:1}])invalid(a,()=>g.createEncounterActivationPolicy({...policy(),...patch}));
 for(const key of ['minimumParticipants','minimumOccupiedSides'])for(const value of [0,-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'2'])invalid(a,()=>g.createEncounterActivationPolicy({...policy(),[key]:value}));
 for(const key of Object.keys(policy())){const p=policy();delete p[key];invalid(a,()=>g.createEncounterActivationPolicy(p));}
 invalid(a,()=>g.createEncounterActivationPolicy({...policy(),extra:true}));
 let calls=0;const p=policy();Object.defineProperty(p,'requireWorldReady',{get(){calls++;return true;}});invalid(a,()=>g.createEncounterActivationPolicy(p));
 const o=observation();Object.defineProperty(o.participants[0],'worldReady',{get(){calls++;return true;}});invalid(a,()=>g.createEncounterActivationObservation(o));a.equal(calls,0);
 for(const key of ['requiredOccupiedSideIds','allowedLifeStatuses'])for(const list of [new Array(1),Object.assign([],{extra:1})])invalid(a,()=>g.createEncounterActivationPolicy({...policy(),[key]:list}));
 invalid(a,()=>g.createEncounterActivationObservation({...observation(),participants:new Array(1)}));
 const pInput=policy(),captured=g.createEncounterActivationPolicy(pInput);frozen(a,captured);a.equal(Object.isFrozen(pInput),false);pInput.allowedLifeStatuses.push('dead');pInput.requiredOccupiedSideIds.reverse();a.deepEqual(captured,policy());
});
contract('35 36 41 42','candidate: literal detached active snapshot',a=>{
 const s=JSON.parse(JSON.stringify(state())),o=observation(),p=policy(),before=JSON.stringify({s,o,p});const out=start(s,p,o);
 a.deepEqual(out,{status:'activated',reason:'none',encounterId:'forest-fight-001',state:literal},'active literal oracle');frozen(a,out);a.equal(JSON.stringify({s,o,p}),before);a.equal(Object.isFrozen(s),false);a.equal(Object.isFrozen(s.participants[0]),false);a.equal(Object.isFrozen(o),false);
 a.notEqual(out.state.sides,s.sides);a.notEqual(out.state.participants[0],s.participants[0]);a.deepEqual({...out.state,status:'prepared'},s);
 const second=start(s,p,o);a.deepEqual(out,second);a.notEqual(out.state,second.state);a.notEqual(out.state.sides,second.state.sides);
 s.sides[0].sideId='changed';s.participants[0].entityId='changed';o.participants[0].worldReady=false;p.requiredOccupiedSideIds.length=0;a.deepEqual(out.state,literal);a.throws(()=>out.state.participants.push({entityId:'x',sideId:'x'}),TypeError);
});
contract('37 38 39 45','terminal: structural checks before domain rejection',a=>{
 for(const status of ['active','resolved','closed','cancelled']){
  const s={...state(),status};a.deepEqual(assess(s),rejection('not_prepared'),'terminal cannot restart');a.deepEqual(start(s),{status:'rejected',reason:'not_prepared',encounterId:'forest-fight-001',state:null});
  invalid(a,()=>start({...s,extra:true}));invalid(a,()=>start(s,{...policy(),minimumParticipants:0}),'terminal policy still validated');
  invalid(a,()=>start(s,policy(),{...observation(),encounterId:'other'}),'terminal observation still validated');
  invalid(a,()=>start(s,policy(),{...observation(),participants:[{entityId:'foreign',life:{entityId:'foreign',status:'alive'},worldReady:true}]}));
 }
});
contract('40 43 44','diagnostics: all seven exact reasons and no admission token',a=>{
 const missing={...observation(),participants:[]},dead=observation(),world=observation();dead.participants[0].life={entityId:'player-001',status:'dead'};world.participants[0].worldReady=false;
 const cases=[[{...state(),status:'active'},policy(),observation(),rejection('not_prepared')],[state(),{...policy(),minimumParticipants:3},observation(),rejection('insufficient_participants')],[state(),{...policy(),minimumOccupiedSides:3},observation(),rejection('insufficient_occupied_sides')],[state(),{...policy(),requiredOccupiedSideIds:['absent']},observation(),rejection('required_side_unoccupied','absent')],[state(),policy(),missing,rejection('participant_fact_missing','party','player-001')],[state(),policy(),dead,rejection('participant_life_not_allowed','party','player-001')],[state(),policy(),world,rejection('participant_world_not_ready','party','player-001')]];
 for(const [s,p,o,expected] of cases){a.deepEqual(assess(s,p,o),expected,'exact admission diagnostics');a.deepEqual(start(s,p,o),{status:'rejected',reason:expected.reason,encounterId:'forest-fight-001',state:null},'rejected transition exact null state');}
 invalid(a,()=>start(assess()));const o=observation();a.equal(assess(state(),policy(),o).status,'admitted');o.participants=[];a.equal(start(state(),policy(),o).reason,'participant_fact_missing');
});
contract('46','replay: independent sessions literal oracle',a=>{
 const x=start(),y=start();a.deepEqual(x,{status:'activated',reason:'none',encounterId:'forest-fight-001',state:literal});a.deepEqual(y,{status:'activated',reason:'none',encounterId:'forest-fight-001',state:literal});a.notEqual(x.state,y.state);a.notEqual(x.state.participants,y.state.participants);
 console.log('ENCOUNTER_ACTIVATION_REPLAY_SHA256 '+createHash('sha256').update(JSON.stringify(x)).digest('hex'));
});
contract('47 48','providers: no hidden time randomness or execution',a=>{
 const s=state(),e=entities(),p=policy(),o=observation(),before=JSON.stringify({s,e,p,o}),saved=[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval,globalThis.crypto];
 const forbidden=()=>{throw Error('hidden provider called');};
 try{Date.now=forbidden;Math.random=forbidden;globalThis.setTimeout=forbidden;globalThis.setInterval=forbidden;Object.defineProperty(globalThis,'crypto',{configurable:true,value:{randomUUID:forbidden}});a.equal(activateEncounter(s,e,p,o).status,'activated');a.equal(g.evaluateEncounterActivationAdmission(s,e,p,o).status,'admitted');}
 finally{[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval]=saved;Object.defineProperty(globalThis,'crypto',{configurable:true,value:saved[4]});}
 a.equal(JSON.stringify({s,e,p,o}),before);a.equal(typeof randomUUID,'function');
 const runtime=readFileSync(new URL('./node_modules/@rpg/gameplay/dist/modules/encounter/index.js',import.meta.url),'utf8');a.deepEqual([...runtime.matchAll(/from ['"]([^'"]+)['"]/g)].map(m=>m[1]),['../entity/index.js']);a.doesNotMatch(runtime,/Date\.now|Math\.random|setTimeout|setInterval|randomUUID|process\.|fetch\(|class |new WeakMap|from ['"](?:node:|@rpg\/core)/);
 const definitions=JSON.parse(readFileSync(new URL('./encounter-modules.json',import.meta.url),'utf8')).modules;a.deepEqual(definitions.find(d=>d.id==='encounter'),{id:'encounter',optional:true,dependencies:['entity']},'activation exact Entity dependency');
});
