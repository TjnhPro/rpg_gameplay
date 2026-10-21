import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as g from '@rpg/gameplay';
import {applyEncounterMembershipChange} from '@rpg/gameplay';

function contract(ids,name,run){test('Membership '+name,()=>{
 let assertions=0;
 const a=new Proxy(assert,{get(target,key){return (...args)=>{assertions++;return Reflect.get(target,key)(...args);};}});
 run(a);assert.ok(assertions>0,'Membership requires actual assertions');
 for(const id of ids.split(' '))console.log('ENCOUNTER_M'+id+'_PASS');
});}
const entities=()=>[{id:'player-001',kind:'player'},{id:'monster-001',kind:'monster'},{id:'monster-002',kind:'monster'}].reduce(g.addEntity,g.createEntityCollection());
const literal={encounterId:'forest-fight-001',definitionId:'forest-wolves',status:'active',sides:[{sideId:'party'},{sideId:'enemies'}],participants:[{entityId:'player-001',sideId:'party'},{entityId:'monster-001',sideId:'enemies'}]};
const state=()=>JSON.parse(JSON.stringify(literal));
const policy=()=>({joinAllowedStatuses:['prepared','active'],leaveAllowedStatuses:['prepared','active'],changeSideAllowedStatuses:['prepared','active'],allowedJoinLifeStatuses:['alive'],requireWorldReadyOnJoin:true});
const join=(entityId='monster-002',sideId='enemies')=>({operation:'join',encounterId:'forest-fight-001',entityId,sideId,readiness:{entityId,life:{entityId,status:'alive'},worldReady:true}});
const leave=(entityId='monster-001')=>({operation:'leave',encounterId:'forest-fight-001',entityId});
const transfer=(entityId='monster-001',sideId='party')=>({operation:'change_side',encounterId:'forest-fight-001',entityId,sideId});
const assess=(r=join(),s=state(),p=policy(),e=entities())=>g.evaluateEncounterMembershipAdmission(s,e,p,r);
const apply=(r=join(),s=state(),p=policy(),e=entities())=>applyEncounterMembershipChange(s,e,p,r);
const rejected=(reason,operation='join',entityId='monster-002',previousSideId=null,sideId='enemies')=>({status:'rejected',reason,operation,encounterId:'forest-fight-001',entityId,previousSideId,sideId});
const invalid=(a,fn,message)=>a.throws(fn,{name:'TypeError'},message);
const frozen=(a,x)=>{a.equal(Object.isFrozen(x),true,'membership deep freeze');for(const v of Object.values(x))if(v&&typeof v==='object')frozen(a,v);};
const joined={status:'applied',reason:'none',operation:'join',encounterId:'forest-fight-001',entityId:'monster-002',previousSideId:null,sideId:'enemies',state:{encounterId:'forest-fight-001',definitionId:'forest-wolves',status:'active',sides:[{sideId:'party'},{sideId:'enemies'}],participants:[{entityId:'player-001',sideId:'party'},{entityId:'monster-001',sideId:'enemies'},{entityId:'monster-002',sideId:'enemies'}]}};

contract('01 02 03 10 12','join: literal append and generic actor kinds',a=>{
 a.deepEqual(apply(),joined,'join literal append');
 for(const kind of ['player','monster','npc','pet','summon','companion','custom']){
  const e=g.addEntity(entities(),{id:'kind-actor',kind}),r=join('kind-actor');
  const result=apply(r,state(),policy(),e);a.deepEqual(result.state.participants,[{entityId:'player-001',sideId:'party'},{entityId:'monster-001',sideId:'enemies'},{entityId:'kind-actor',sideId:'enemies'}]);a.equal(g.getEntity(e,'kind-actor').kind,kind);
 }
 a.deepEqual(apply(join(),{...state(),status:'prepared'}),{...joined,state:{...joined.state,status:'prepared'}});
 const r=join();r.readiness.life.status='dead';const before=JSON.stringify(r);a.equal(apply(r,state(),{...policy(),allowedJoinLifeStatuses:['dead']}).status,'applied');a.equal(JSON.stringify(r),before);
 r.readiness.worldReady=false;a.equal(apply(r,state(),{...policy(),allowedJoinLifeStatuses:['dead'],requireWorldReadyOnJoin:false}).status,'applied');
});
contract('05 06 07 45','duplicate: exact precedence and no implicit transfer',a=>{
 for(const side of ['enemies','party'])a.deepEqual(assess(join('monster-001',side)),rejected('already_participating','join','monster-001','enemies',side),'duplicate join exact diagnostic');
 const r=join('monster-001','absent');r.readiness.life.status='dead';r.readiness.worldReady=false;
 a.deepEqual(assess(r),rejected('side_not_found','join','monster-001','enemies','absent'),'side before duplicate Life World');
 a.deepEqual(apply(join('monster-002','absent')),{...rejected('side_not_found','join','monster-002',null,'absent'),state:null});a.deepEqual(state().sides,[{sideId:'party'},{sideId:'enemies'}]);
});
contract('08','canonical: new missing Entity is eligibility rejection',a=>{
 const e=entities(),before=JSON.stringify(e),r=join('not-in-collection');
 a.deepEqual(assess(r,state(),policy(),e),rejected('entity_not_found','join','not-in-collection',null,'enemies'),'missing canonical join exact diagnostic');
 a.deepEqual(apply(r,state(),policy(),e),{...rejected('entity_not_found','join','not-in-collection',null,'enemies'),state:null});a.equal(JSON.stringify(e),before);
});
contract('09 11','eligibility: independent Life and World gates',a=>{
 const dead=join();dead.readiness.life.status='dead';a.deepEqual(assess(dead),rejected('join_life_not_allowed'),'join Life exact diagnostic');
 const world=join();world.readiness.worldReady=false;a.deepEqual(assess(world),rejected('join_world_not_ready'),'join World exact diagnostic');
 dead.readiness.worldReady=false;a.deepEqual(assess(dead),rejected('join_life_not_allowed'),'Life before World');
});
contract('04 23 32 36','operation: explicit deny lists across all operations',a=>{
 for(const [r,key] of [[join(),'joinAllowedStatuses'],[leave(),'leaveAllowedStatuses'],[transfer(),'changeSideAllowedStatuses']]){
  for(const statuses of [[],['prepared']]){
   const p={...policy(),[key]:statuses};a.deepEqual(g.createEncounterMembershipPolicy(p),p);
   const expected=rejected('operation_not_allowed',r.operation,r.entityId,r.operation==='join'?null:'enemies',r.operation==='leave'?null:r.sideId);
   a.deepEqual(assess(r,state(),p),expected,'operation policy exact diagnostic');a.deepEqual(apply(r,state(),p),{...expected,state:null});
  }
 }
});
contract('15 24','terminal: all operations and statuses reject without candidate',a=>{
 for(const status of ['resolved','closed','cancelled'])for(const r of [join(),leave(),transfer()]){
  const expected=rejected('encounter_not_open',r.operation,r.entityId,r.operation==='join'?null:'enemies',r.operation==='leave'?null:r.sideId);
  a.deepEqual(assess(r,{...state(),status}),expected,'terminal membership exact diagnostic');a.deepEqual(apply(r,{...state(),status}),{...expected,state:null});
 }
});
contract('16 17 18 19 20 22','leave: exact removal order and empty active',a=>{
 const s=joined.state;const expected={status:'applied',reason:'none',operation:'leave',encounterId:'forest-fight-001',entityId:'monster-001',previousSideId:'enemies',sideId:null,state:{encounterId:'forest-fight-001',definitionId:'forest-wolves',status:'active',sides:[{sideId:'party'},{sideId:'enemies'}],participants:[{entityId:'player-001',sideId:'party'},{entityId:'monster-002',sideId:'enemies'}]}};
 a.deepEqual(apply(leave(),s),expected,'leave exact ordered roster');
 const one=apply(leave());a.deepEqual(one.state,{...literal,participants:[{entityId:'player-001',sideId:'party'}]});
 const empty=apply(leave('player-001'),one.state);a.deepEqual(empty.state,{...literal,participants:[]},'last leave preserves empty active');a.deepEqual(g.validateEncounterState(empty.state,entities()),empty.state);
 a.deepEqual(apply(leave('player-001'),empty.state),{...rejected('participant_not_found','leave','player-001',null,null),state:null});
 a.equal(apply(leave(),{...state(),status:'prepared'}).state.status,'prepared');
});
contract('21 30 47','missing: exact leave and transfer diagnostics',a=>{
 for(const r of [leave('monster-002'),transfer('monster-002')]){
  const expected=rejected('participant_not_found',r.operation,'monster-002',null,r.operation==='leave'?null:'party');
  a.deepEqual(assess(r),expected,'missing member exact diagnostic');a.deepEqual(apply(r),{...expected,state:null});
 }
 a.equal(assess(transfer('monster-002','absent')).reason,'participant_not_found');
});
contract('26 27 28 33 34 35','transfer: literal in-place replacement and independent lookup',a=>{
 const e=entities(),before=JSON.stringify(e),s=state(),member=g.getEncounterParticipant(s,e,'monster-001');a.deepEqual(member,{entityId:'monster-001',sideId:'enemies'});frozen(a,member);a.notEqual(member,s.participants[1]);a.equal(g.getEncounterParticipant(s,e,'absent'),null);
 const expected={status:'applied',reason:'none',operation:'change_side',encounterId:'forest-fight-001',entityId:'monster-002',previousSideId:'enemies',sideId:'party',state:{encounterId:'forest-fight-001',definitionId:'forest-wolves',status:'active',sides:[{sideId:'party'},{sideId:'enemies'}],participants:[{entityId:'player-001',sideId:'party'},{entityId:'monster-001',sideId:'enemies'},{entityId:'monster-002',sideId:'party'}]}};
 const changed=apply(transfer('monster-002'),apply().state,policy(),e);a.deepEqual(changed,expected,'transfer exact in-place roster');
 a.deepEqual(apply(leave('monster-002'),changed.state).state,literal);a.equal(JSON.stringify(e),before);
 a.deepEqual(apply(transfer(),{...state(),status:'prepared'}).state,{...literal,status:'prepared',participants:[{entityId:'player-001',sideId:'party'},{entityId:'monster-001',sideId:'party'}]});
});
contract('29 31','destination: transfer missing side and same side reject',a=>{
 a.deepEqual(assess(transfer('monster-001','absent')),rejected('side_not_found','change_side','monster-001','enemies','absent'),'transfer missing side exact diagnostic');
 a.deepEqual(assess(transfer('monster-001','enemies')),rejected('already_on_side','change_side','monster-001','enemies','enemies'),'transfer same side exact diagnostic');
});
contract('13 14 25 43','binding: exact requests before terminal domain checks',a=>{
 const wrongEncounter={...join(),encounterId:'other'};invalid(a,()=>apply(wrongEncounter,{...state(),status:'closed'}),'membership Encounter binding must throw');
 const wrongReady=join();wrongReady.readiness.entityId='other';wrongReady.readiness.life.entityId='other';invalid(a,()=>apply(wrongReady),'membership readiness binding must throw');
 const wrongLife=join();wrongLife.readiness.life.entityId='other';invalid(a,()=>apply(wrongLife),'membership Life binding must throw');
 for(const key of Object.keys(join())){const r=join();delete r[key];invalid(a,()=>apply(r));}
 for(const extra of [{sideId:'party'},{readiness:join().readiness},{life:join().readiness.life}])invalid(a,()=>apply({...leave(),...extra}));
 invalid(a,()=>apply({...transfer(),readiness:join().readiness}));invalid(a,()=>apply({...join(),operation:'JOIN'}));
 for(const readiness of [null,{}, {...join().readiness,worldReady:'true'},{...join().readiness,life:{entityId:'monster-002',status:'unknown'}}])invalid(a,()=>apply({...join(),readiness}));
});
contract('37 38 39 40 41 42 44','schema: full own-data validation without getters',a=>{
 for(const key of ['joinAllowedStatuses','leaveAllowedStatuses','changeSideAllowedStatuses'])for(const list of [['active','active'],['closed'],['resolved'],['cancelled'],['unknown'],[1],new Array(1),Object.assign([],{extra:1})])invalid(a,()=>apply(join(),{...state(),status:'closed'},{...policy(),[key]:list}));
 for(const list of [[],['alive','alive'],['unknown'],[1]])invalid(a,()=>g.createEncounterMembershipPolicy({...policy(),allowedJoinLifeStatuses:list}));
 for(const value of [1,'true',null,undefined])invalid(a,()=>g.createEncounterMembershipPolicy({...policy(),requireWorldReadyOnJoin:value}));
 for(const key of Object.keys(policy())){const p=policy();delete p[key];invalid(a,()=>g.createEncounterMembershipPolicy(p));}
 invalid(a,()=>apply(join(),{...state(),participants:[literal.participants[0],literal.participants[0]]}));invalid(a,()=>apply(join(),{...state(),participants:[{entityId:'player-001',sideId:'absent'}]}));
 invalid(a,()=>apply(join(),state(),policy(),g.removeEntity(entities(),'player-001')));invalid(a,()=>g.getEncounterParticipant(state(),g.removeEntity(entities(),'player-001'),'absent'));invalid(a,()=>g.getEncounterParticipant(state(),entities(),' '));
 let calls=0;
 for(const [factory,value,key] of [[g.createEncounterMembershipRequest,join(),'operation'],[g.createEncounterMembershipRequest,join(),'readiness'],[g.createEncounterMembershipPolicy,policy(),'joinAllowedStatuses']]){
  Object.defineProperty(value,key,{get(){calls++;throw Error('getter executed');}});invalid(a,()=>factory(value));
 }
 const r=join();Object.defineProperty(r.readiness.life,'status',{get(){calls++;throw Error('getter executed');}});invalid(a,()=>apply(r));
 for(const factory of [g.createEncounterMembershipRequest,g.createEncounterMembershipPolicy]){
  const base=factory===g.createEncounterMembershipRequest?join():policy();invalid(a,()=>factory({...base,[Symbol('extra')]:true}));invalid(a,()=>factory(Object.assign(Object.create({}),base)));invalid(a,()=>factory({...base,extra:true}));
 }
 const indexed=policy();Object.defineProperty(indexed.joinAllowedStatuses,'0',{get(){calls++;throw Error('getter executed');}});invalid(a,()=>g.createEncounterMembershipPolicy(indexed));a.equal(calls,0);
});
contract('46 48 49 50','candidate: frozen detachment replay and fresh recomputation',a=>{
 const s=state(),p=policy(),r=join(),e=entities(),before=JSON.stringify({s,p,r,e});const out=apply(r,s,p,e);a.deepEqual(out,joined);frozen(a,out);const admission=assess(r,s,p,e);a.deepEqual(admission,{status:'admitted',reason:'none',operation:'join',encounterId:'forest-fight-001',entityId:'monster-002',previousSideId:null,sideId:'enemies'});frozen(a,admission);
 a.equal(JSON.stringify({s,p,r,e}),before);a.equal(Object.isFrozen(s),false);a.equal(Object.isFrozen(p),false);a.equal(Object.isFrozen(r.readiness.life),false);a.notEqual(out.state.sides,s.sides);a.notEqual(out.state.participants[0],s.participants[0]);
 const capturedPolicy=g.createEncounterMembershipPolicy(p),capturedRequest=g.createEncounterMembershipRequest(r);frozen(a,capturedPolicy);frozen(a,capturedRequest);a.notEqual(capturedRequest.readiness.life,r.readiness.life);a.notEqual(capturedPolicy.joinAllowedStatuses,p.joinAllowedStatuses);
 r.readiness.worldReady=false;p.joinAllowedStatuses.length=0;s.participants[0].entityId='changed';s.sides.reverse();a.deepEqual(out,joined,'membership detached caller mutation');a.deepEqual(capturedPolicy,policy());a.deepEqual(capturedRequest,join());
 const second=apply();a.deepEqual(second,joined);a.notEqual(second.state,out.state);a.notEqual(second.state.participants,out.state.participants);
 invalid(a,()=>apply(admission),'membership forged admission request must throw');
 const fresh=join();a.equal(assess(fresh).status,'admitted');fresh.readiness.worldReady=false;a.deepEqual(apply(fresh),{...rejected('join_world_not_ready'),state:null},'membership transition rechecks fresh inputs');
 a.equal(apply(join(),out.state).reason,'already_participating');a.equal(apply(transfer('monster-001','party'),apply(transfer()).state).reason,'already_on_side');
 console.log('ENCOUNTER_MEMBERSHIP_REPLAY_SHA256 '+createHash('sha256').update(JSON.stringify([out,apply(transfer('monster-002'),out.state),apply(leave('monster-002'),out.state)])).digest('hex'));
});
contract('51 52 53','providers: pure operations and exact optional dependency graph',a=>{
 const s=state(),e=entities(),p=policy(),r=join(),before=JSON.stringify({s,e,p,r}),saved=[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval,globalThis.crypto];let calls=0;
 const forbidden=()=>{calls++;throw Error('hidden provider called');};
 try{Date.now=forbidden;Math.random=forbidden;globalThis.setTimeout=forbidden;globalThis.setInterval=forbidden;Object.defineProperty(globalThis,'crypto',{configurable:true,value:{randomUUID:forbidden}});a.deepEqual(applyEncounterMembershipChange(s,e,p,r),joined);a.equal(g.evaluateEncounterMembershipAdmission(s,e,p,r).status,'admitted');}
 finally{[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval]=saved;Object.defineProperty(globalThis,'crypto',{configurable:true,value:saved[4]});}
 a.equal(calls,0);a.equal(JSON.stringify({s,e,p,r}),before);
 const runtime=readFileSync(new URL('./node_modules/@rpg/gameplay/dist/modules/encounter/index.js',import.meta.url),'utf8');a.deepEqual([...runtime.matchAll(/from ['"]([^'"]+)['"]/g)].map(m=>m[1]),['../entity/index.js']);a.doesNotMatch(runtime,/Date\.now|Math\.random|setTimeout|setInterval|randomUUID|process\.|fetch\(|class |new WeakMap/);
 const definitions=JSON.parse(readFileSync(new URL('./encounter-modules.json',import.meta.url),'utf8')).modules;a.deepEqual(definitions.find(d=>d.id==='encounter'),{id:'encounter',optional:true,dependencies:['entity']},'membership exact Entity dependency');
 const registry=definitions.reduce(g.registerModule,g.createModuleRegistry());const selected=ids=>g.composeModules(registry,g.configureModules(registry,{enable:ids}));
 a.deepEqual(selected(['entity','encounter']).moduleIds,['entity','encounter']);
 a.deepEqual(selected(['entity','progression','combat','skill','effect','actor-ai','encounter']).moduleIds,['entity','progression','combat','skill','effect','actor-ai','encounter']);
});
