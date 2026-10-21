import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolveEncounter} from '@rpg/gameplay';
import * as g from '@rpg/gameplay';

function contract(ids,name,run){test('Encounter closure '+name,()=>{
  let assertions=0;const checked=new Proxy(assert,{get(target,key){return (...args)=>{assertions++;return Reflect.get(target,key)(...args);};}});
  run(checked);assert.ok(assertions>0,'Encounter closure requires actual assertions');
  for(const id of ids.split(' ').filter(Boolean))console.log('ENCOUNTER_C'+id+'_PASS');
});}
const clone=structuredClone, token=JSON.stringify;
const win=(winnerSideIds=['party'],defeatedSideIds=['monsters'])=>({kind:'victory',winnerSideIds,defeatedSideIds});
const draw=()=>({kind:'draw',winnerSideIds:[],defeatedSideIds:[]});
const objective=(ruleId='capture',outcome=win(),whenStatus='succeeded')=>({ruleId,kind:'objective',objectiveId:'O',whenStatus,outcome});
function fixture(kinds=['player','monster']){
  const actors=kinds.map((kind,i)=>g.createEntity({id:['player-001','monster-001'][i]??'actor-'+i,kind}));
  const entities=actors.reduce((c,e)=>g.addEntity(c,e),g.createEntityCollection());
  const prepared=g.createEncounterState({definitionId:'forest-wolves'},{encounterId:'forest-001',sides:[{sideId:'party'},{sideId:'monsters'}],participants:actors.map((e,i)=>({entityId:e.id,sideId:i?'monsters':'party'}))},entities);
  const activation=g.activateEncounter(prepared,entities,{minimumParticipants:1,minimumOccupiedSides:1,requiredOccupiedSideIds:[],allowedLifeStatuses:['alive'],requireWorldReady:true},{encounterId:prepared.encounterId,participants:actors.map(e=>({entityId:e.id,life:g.createEntityLifeState(e,{status:'alive'}),worldReady:true}))});
  const state=activation.state;
  return {actors,entities,prepared,state,policy:{definitionId:'forest-wolves',rules:[{ruleId:'kill-enemies',kind:'side_elimination',contenderSideIds:['party','monsters'],zeroSurvivors:'pending'}]},observation:{encounterId:state.encounterId,participants:actors.map((e,i)=>({entityId:e.id,life:g.createEntityLifeState(e,{status:i?'dead':'alive'})})),objectives:[],continuation:'clear'},closure:{definitionId:'forest-wolves',cancelAllowedStatuses:['prepared','active']},request:{encounterId:state.encounterId,reasonId:' Abort Round '},disposition:null,revision:0};
}
const resolve=f=>resolveEncounter(f.state,f.entities,f.policy,f.observation);
const cancel=f=>g.cancelEncounter(f.state,f.entities,f.closure,f.request);
const record=(outcome=win(),ruleId='kill-enemies',encounterId='forest-001')=>({kind:'resolution',encounterId,definitionId:'forest-wolves',ruleId,outcome});
const cancellation=()=>({kind:'cancellation',encounterId:'forest-001',definitionId:'forest-wolves',reasonId:' Abort Round ',outcome:null});
const rejection=(reason)=>({status:'rejected',reason,encounterId:'forest-001',state:null,disposition:null});
function frozen(a,value){if(value&&typeof value==='object'){a.ok(Object.isFrozen(value),'deep frozen');for(const v of Object.values(value))frozen(a,v);}}
function stage(f,candidate){return {revision:f.revision,state:token(f.state),facts:token(f.observation),record:token(f.disposition),candidate};}
// Session-local authority fixture, deliberately separate from L2 production.
function commit(f,proposal,fail=false){
  if(proposal.revision!==f.revision||proposal.state!==token(f.state)||proposal.facts!==token(f.observation)||proposal.record!==token(f.disposition))return 'stale';
  const c=proposal.candidate;if(c.status==='rejected')return 'rejected';
  const allowed=(c.status==='resolved'&&f.state.status==='active')||(c.status==='cancelled'&&['prepared','active'].includes(f.state.status))||(c.status==='closed'&&f.state.status==='resolved');
  if(!allowed)return 'transition';
  if(f.disposition!==null&&token(c.disposition)!==token(f.disposition))return 'disposition';
  if(fail)throw new Error('L4 simulated atomic failure');
  Object.assign(f,{state:c.state,disposition:c.disposition,revision:f.revision+1});return 'accepted';
}
function authorizedHandoff(f,candidate){
  if(token(candidate.state)!==token(f.state)||token(candidate.disposition)!==token(f.disposition)||!['closed','cancelled'].includes(f.state.status))return null;
  return g.createEncounterCleanupHandoff(f.state,f.entities,f.disposition);
}

function combatDefeat(f,context=g.createExecutionContext({clock:{now:()=>1000},random:{next:()=>.5}})){
  const actor=f.actors[0],target=f.actors[1];
  const action=g.createCombatActionContext({actionId:'hit',actionType:'explicit',sourceEntityId:actor.id,target:{kind:'entity',entityId:target.id}}),ca=g.evaluateCombatActionAdmission(action,f.entities,f.observation.participants[0].life,{eligible:true});
  const validation=g.evaluateCombatTargetValidation(ca,f.entities,g.createEntityLifeState(target,{status:'alive'}),{relation:'enemy',allowedRelations:['enemy'],allowedLifeStatuses:['alive']});
  const attack=g.resolveCombatAttack(ca,validation,{hit:{dodgeChance:0,eligible:true,rule:{enabled:true,bounds:{min:0,max:1}}},critical:{chance:0,bonus:0,eligible:false,rule:{enabled:true,bounds:{min:0,max:1}}},damage:{base:20,rank:1,perRank:0,scaling:[],flat:{definition:0,additional:0,resolved:0},bonuses:[]},mitigation:{ruleKey:'none',rating:0,rule:{enabled:false,bounds:{min:0,max:1},levelScalingEnabled:false}}},context);
  const applied=g.applyCombatAttackDamage(attack,g.createEntityResourceState(target,{health:{minimum:0,maximum:20,current:20}}),g.createEntityLifeState(target,{status:'alive'}),{resourceId:'health',minimum:0,maximum:20,currentAboveMaximum:'reject'});f.observation.participants[1].life=applied.lifeResult.state;
  return {attack,applied};
}

contract('01 13 15 17 18','resolve',a=>{
  const f=fixture(),before=clone(f),r=resolve(f);
  a.equal(r.status,'resolved');a.equal(r.reason,'none');a.equal(r.encounterId,'forest-001');
  a.deepEqual(r.disposition,record(),'N13 side outcome');a.deepEqual(Object.keys(r.state),['encounterId','definitionId','status','sides','participants'],'N12 five fields');
  a.deepEqual(r.state,{...f.state,status:'resolved'},'N11 roster unchanged');a.deepEqual(Object.keys(r.disposition),['kind','encounterId','definitionId','ruleId','outcome']);a.deepEqual(f,before);
  const other=fixture();other.state={...other.state,encounterId:'other'};other.observation.encounterId='other';a.equal(resolve(other).disposition.encounterId,'other');
  f.observation.participants.reverse();a.deepEqual(resolve(f),r);frozen(a,r);
});
contract('02 03 04 05 14 21','objectives',a=>{
  const f=fixture();f.policy.rules=[objective('first'),objective('second',draw())];f.observation.objectives=[{objectiveId:'O',status:'succeeded'}];
  a.deepEqual(resolve(f).disposition,record(win(),'first'),'N10 first rule');
  f.policy.rules=[objective('failure',win(['monsters'],['party']),'failed')];f.observation.objectives[0].status='failed';a.deepEqual(resolve(f).disposition,record(win(['monsters'],['party']),'failure'));
  f.policy.rules=[objective('draw',draw(),'failed')];a.deepEqual(resolve(f).disposition,record(draw(),'draw'));
  f.state={...f.state,sides:[{sideId:'alpha'},{sideId:'beta'},{sideId:'gamma'}],participants:f.state.participants.map((p,i)=>({...p,sideId:i?'gamma':'alpha'}))};
  f.policy.rules=[objective('coalition',win(['beta','alpha'],['gamma']),'failed')];a.deepEqual(resolve(f).disposition.outcome,win(['beta','alpha'],['gamma']));
});
contract('06 07 08 09 10 11 12','pending',a=>{
  const f=fixture(),before=clone(f);f.observation.continuation='pending';a.deepEqual(resolve(f),rejection('continuation_pending'),'N07 continuation');
  f.observation.continuation='clear';f.observation.participants.pop();a.deepEqual(resolve(f),rejection('participant_fact_missing'),'N08 missing Life');
  const no=fixture();no.policy.rules=[];a.deepEqual(resolve(no),rejection('no_completion_condition_met'));
  for(const status of ['prepared','resolved','closed','cancelled']){no.state={...no.state,status};a.deepEqual(resolve(no),rejection('encounter_not_active'),'terminal resolution '+status);}
  a.deepEqual(before.state,fixture().state);
});
contract('16 20','fresh',a=>{
  const f=fixture(),old=resolve(f);
  a.throws(()=>resolveEncounter(f.state,f.entities,f.policy,{status:'resolvable',reason:'rule_matched',encounterId:f.state.encounterId,ruleId:'forged',participantEntityId:null,outcome:win()}),{name:'TypeError'},'cached assessment is not observation');f.observation.participants[1].life={entityId:'monster-001',status:'alive'};
  a.deepEqual(resolve(f),rejection('no_completion_condition_met'),'N09 re-evaluate current facts');a.deepEqual(old.disposition,record());
  const one=fixture(),two=fixture(),r1=resolve(one),r2=resolve(two);a.deepEqual(r1,r2);a.notEqual(r1,r2);a.notEqual(r1.state,r2.state);a.notEqual(r1.disposition.outcome.winnerSideIds,r2.disposition.outcome.winnerSideIds);
  one.policy.rules=[objective()];one.observation.objectives=[{objectiveId:'O',status:'succeeded'}];const captured=resolve(one);one.policy.rules[0].outcome.winnerSideIds[0]='monsters';a.deepEqual(captured.disposition,record(win(),'capture'));a.equal(Object.isFrozen(one.policy.rules[0].outcome.winnerSideIds),false);frozen(a,captured);
});
contract('19 22 23 34 35','record-validation',a=>{
  const f=fixture(),r=resolve(f),close=d=>g.closeEncounter(r.state,f.entities,d);
  for(const outcome of [win(['party'],['party']),win(['party','party'],[]),win([],['monsters']),{kind:'draw',winnerSideIds:['party'],defeatedSideIds:[]}])a.throws(()=>close({...record(),outcome}),{name:'TypeError'},'N14 invalid outcome');
  a.throws(()=>g.closeEncounter({...r.state,status:'closed'},f.entities,record(win(['unknown'],[]))),{name:'TypeError',message:/disposition side/},'N14 unknown side');
  for(const delta of [{encounterId:'foreign'},{definitionId:'foreign'}])a.throws(()=>close({...record(),...delta}),{name:'TypeError',message:/identity mismatch/},'N22 disposition binding');
  const opaque=fixture();opaque.state={...opaque.state,sides:[{sideId:' Party '},{sideId:'MONSTERS'}],participants:opaque.state.participants.map((p,i)=>({...p,sideId:i?'MONSTERS':' Party '}))};opaque.policy.rules=[{...opaque.policy.rules[0],contenderSideIds:[' Party ','MONSTERS']}];a.deepEqual(resolve(opaque).disposition.outcome,win([' Party '],['MONSTERS']));
});
contract('27 36 37','close',a=>{
  const f=fixture(),r=resolve(f),before=clone(r),c=g.closeEncounter(r.state,f.entities,r.disposition);
  a.deepEqual(c,{status:'closed',reason:'none',encounterId:'forest-001',state:{...r.state,status:'closed'},disposition:record()},'N18 preserve close record');
  a.notEqual(c.disposition,r.disposition);a.notEqual(c.disposition.outcome,r.disposition.outcome);a.deepEqual(r,before);frozen(a,c);
  a.deepEqual(g.closeEncounter(c.state,f.entities,c.disposition),rejection('already_terminal'),'N17 second close');
});
contract('29 30 31 32 33','close-gates',a=>{
  const f=fixture();for(const status of ['active','prepared','closed','cancelled']){
    const expected=['closed','cancelled'].includes(status)?'already_terminal':'encounter_not_resolved';
    a.deepEqual(g.closeEncounter({...f.state,status},f.entities,record()),rejection(expected),'close guard '+status);
  }
  a.throws(()=>g.closeEncounter({...f.state,status:'resolved'},f.entities,cancellation()),{name:'TypeError',message:/requires resolution/});
  a.deepEqual(g.closeEncounter(f.prepared,f.entities,cancellation()),rejection('encounter_not_resolved'));
});
contract('39 40 41 42 43 47 48 49 52','cancellation',a=>{
  const f=fixture(),before=clone(f);for(const status of ['prepared','active']){
    f.state={...before.state,status};const r=cancel(f);a.equal(r.disposition.outcome,null,'N21 cancellation no outcome');a.deepEqual(r,{status:'cancelled',reason:'none',encounterId:'forest-001',state:{...f.state,status:'cancelled'},disposition:cancellation()});
    a.deepEqual(Object.keys(r.disposition),['kind','encounterId','definitionId','reasonId','outcome']);a.equal(r.disposition.outcome,null,'N21 cancellation no outcome');frozen(a,r);
    f.closure.cancelAllowedStatuses=[status==='prepared'?'active':'prepared'];a.deepEqual(cancel(f),rejection('cancellation_not_allowed'),'N20 policy denied');f.closure.cancelAllowedStatuses=[];a.deepEqual(cancel(f),rejection('cancellation_not_allowed'));f.closure.cancelAllowedStatuses=['prepared','active'];
  }
  f.state={...f.prepared,participants:[]};a.deepEqual(cancel(f).state.participants,[]);
  a.throws(()=>g.createEncounterClosurePolicy({...f.closure,cancelAllowedStatuses:['active','active']}),{name:'TypeError',message:/Duplicate/});
  const input=clone(f.closure),captured=g.createEncounterClosurePolicy(input);input.cancelAllowedStatuses.reverse();a.deepEqual(captured.cancelAllowedStatuses,['prepared','active']);a.equal(Object.isFrozen(input.cancelAllowedStatuses),false);frozen(a,captured);
});
contract('44 45 46','cancel-finalized',a=>{
  const f=fixture();for(const status of ['resolved','closed','cancelled']){f.state={...f.state,status};a.deepEqual(cancel(f),rejection('already_finalized'),'N19 finalized '+status);}
});
contract('53 54 60 61 62 63','handoff',a=>{
  const f=fixture(),r=resolve(f),c=g.closeEncounter(r.state,f.entities,r.disposition),before=clone(f);let calls=0;globalThis.__encounterClosureDispatch=()=>{calls++;};
  try{
    const h=g.createEncounterCleanupHandoff(c.state,f.entities,c.disposition);a.deepEqual(h,{encounterId:'forest-001',terminalStatus:'closed',dispositionKind:'resolution',participantEntityIds:['player-001','monster-001']},'N25 roster order');a.equal(calls,0,'N24 no World cleanup');frozen(a,h);
    const cancelled=cancel(f);a.deepEqual(g.createEncounterCleanupHandoff(cancelled.state,f.entities,cancelled.disposition),{encounterId:'forest-001',terminalStatus:'cancelled',dispositionKind:'cancellation',participantEntityIds:['player-001','monster-001']});
    a.deepEqual(g.createEncounterCleanupHandoff({...cancelled.state,participants:[]},f.entities,cancelled.disposition).participantEntityIds,[]);
    a.deepEqual(g.createEncounterCleanupHandoff({...c.state,participants:[...c.state.participants].reverse()},f.entities,c.disposition).participantEntityIds,['monster-001','player-001'],'N25 roster order');
    const dispatch=handoff=>{a.deepEqual(handoff.participantEntityIds,['player-001','monster-001']);throw new Error('L4 cleanup failed');};a.throws(()=>dispatch(h),/L4 cleanup failed/);a.equal(c.state.status,'closed');a.deepEqual(f,before);
  }finally{delete globalThis.__encounterClosureDispatch;}
});
contract('55 56 57 58 59','handoff-gates',a=>{
  const f=fixture();for(const status of ['prepared','active','resolved'])a.throws(()=>g.createEncounterCleanupHandoff({...f.state,status},f.entities,record()),{name:'TypeError',message:/not terminal/},'N23 early cleanup '+status);
  for(const [status,d] of [['closed',cancellation()],['cancelled',record()]])a.throws(()=>g.createEncounterCleanupHandoff({...f.state,status},f.entities,d),{name:'TypeError',message:/terminal disposition mismatch/});
});
contract('24 25 26 28 38 50 69','authority',a=>{
  const f=fixture(),r=resolve(f),p=stage(f,r),q=stage(f,cancel(f)),before=clone(f);a.throws(()=>commit(f,p,true),/atomic failure/);a.deepEqual(f,before);
  const premature=g.closeEncounter(r.state,f.entities,r.disposition);a.equal(authorizedHandoff(f,premature),null,'candidate not authority');a.equal(commit(f,stage(f,premature)),'transition');
  a.equal(commit(f,p),'accepted');a.equal(commit(f,q),'stale');a.deepEqual(f.disposition,record());
  const closed=g.closeEncounter(f.state,f.entities,f.disposition);a.equal(commit(f,stage(f,closed)),'accepted');a.deepEqual(authorizedHandoff(f,closed).participantEntityIds,['player-001','monster-001']);

  const cancelled=fixture(),cp=stage(cancelled,cancel(cancelled)),rp=stage(cancelled,resolve(cancelled));a.equal(commit(cancelled,cp),'accepted');a.equal(commit(cancelled,rp),'stale');a.deepEqual(cancelled.disposition,cancellation());
  const uncommitted=fixture(),candidate=cancel(uncommitted);a.equal(authorizedHandoff(uncommitted,candidate),null);a.equal(uncommitted.disposition,null);
});
contract('','duplicate',a=>{
  const f=fixture(),r=resolve(f);a.equal(commit(f,stage(f,r)),'accepted');
  const c=g.closeEncounter(f.state,f.entities,f.disposition);a.equal(commit(f,stage(f,c)),'accepted');
  a.equal(commit(f,stage(f,r)),'transition','N30 independent duplicate terminal guard');a.equal(f.state.status,'closed');
});
contract('','stale',a=>{
  for(const operation of ['join','leave','change_side','wave','life']){
    const f=fixture(),p=stage(f,resolve(f));
    if(operation==='wave')f.observation.continuation='pending';else if(operation==='life')f.observation.participants[1].life={entityId:'monster-001',status:'alive'};
    else{
      const policy={joinAllowedStatuses:['active'],leaveAllowedStatuses:['active'],changeSideAllowedStatuses:['active'],allowedJoinLifeStatuses:['alive'],requireWorldReadyOnJoin:false};
      const request={encounterId:f.state.encounterId,operation,entityId:'monster-001'};
      if(operation==='join'){const actor=g.createEntity({id:'reinforcement',kind:'custom'});f.entities=g.addEntity(f.entities,actor);Object.assign(request,{entityId:actor.id,sideId:'monsters',readiness:{entityId:actor.id,life:g.createEntityLifeState(actor,{status:'alive'}),worldReady:false}});}
      if(operation==='change_side')request.sideId='party';
      const changed=g.applyEncounterMembershipChange(f.state,f.entities,policy,request);a.equal(changed.status,'applied');f.state=changed.state;
    }
    a.equal(commit(f,p),'stale','N26 stale '+operation);a.equal(f.disposition,null);
  }
  const f=fixture();a.equal(commit(f,stage(f,resolve(f))),'accepted');const c=stage(f,g.closeEncounter(f.state,f.entities,f.disposition));f.state={...f.state,participants:f.state.participants.slice(0,1)};a.equal(commit(f,c),'stale','stale close roster');
});
contract('64 65','replay',a=>{
  function session(kinds){const f=fixture(kinds),active=f.state,{applied}=combatDefeat(f);a.equal(applied.resourceResult.state.current.health,0);a.equal(applied.lifeResult.state.status,'dead');const r=resolve(f);a.equal(commit(f,stage(f,r)),'accepted');const c=g.closeEncounter(f.state,f.entities,f.disposition);a.equal(commit(f,stage(f,c)),'accepted');const h=authorizedHandoff(f,c);const other=fixture(kinds),cancelled=cancel(other);a.equal(commit(other,stage(other,cancelled)),'accepted');return {active,r,c,h,cancelled,applied};}
  const one=session(['player','monster']),two=session(['player','monster']),three=session(['pet','summon']),four=session(['custom','player']);
  const literal=['active','resolved','closed','kill-enemies','victory',['party'],['monsters'],['player-001','monster-001'],'cancelled',' Abort Round ',0,'dead'];
  const trace=s=>[s.active.status,s.r.state.status,s.c.state.status,s.c.disposition.ruleId,s.c.disposition.outcome.kind,s.c.disposition.outcome.winnerSideIds,s.c.disposition.outcome.defeatedSideIds,s.h.participantEntityIds,s.cancelled.state.status,s.cancelled.disposition.reasonId,s.applied.resourceResult.state.current.health,s.applied.lifeResult.state.status];
  for(const value of [one,two,three,four]){a.deepEqual(trace(value),literal);frozen(a,value.r);frozen(a,value.c);frozen(a,value.h);}
  a.notEqual(one.r.state,two.r.state);a.notEqual(one.c.disposition.outcome.winnerSideIds,two.c.disposition.outcome.winnerSideIds);console.log('ENCOUNTER_CLOSURE_REPLAY_SHA256 '+createHash('sha256').update(token(literal)).digest('hex'));
});
contract('51 66','noninterference',a=>{
  const f=fixture(),actor=f.actors[0],target=f.actors[1],context=g.createExecutionContext({clock:{now:()=>1000},random:{next:()=>.5}});
  const definition=g.createSkillDefinition({skillId:'spell'}),instance=g.createSkillInstance(definition,actor,{instanceId:'I'}),admission=g.evaluateSkillActivationAdmission(definition,instance,actor.id,f.entities,f.observation.participants[0].life,{owned:true,eligible:true,rank:{mode:'not_required'}});
  const activation=g.activateSkill({instance,admission,resourceState:g.createEntityResourceState(actor,{mana:{minimum:0,maximum:100,current:100}}),resourceCosts:{costs:[{resourceId:'mana',amount:25}],bounds:[{resourceId:'mana',minimum:0,maximum:100,currentAboveMaximum:'reject'}]},cooldownState:g.createSkillCooldownState(instance),cooldownConfig:{baseDurationMs:1000,effectiveCdr:.25},executionContext:context,intent:{attemptId:'A',dispatch:{kind:'caller'}},executionPreflight:{kind:'caller',status:'accepted'}});
  a.equal(activation.resources.current.mana,75);a.equal(activation.cooldown.readyAtMs,1750);
  const {attack,applied}=combatDefeat(f,context);a.equal(applied.lifeResult.state.status,'dead');a.equal(applied.resourceResult.state.current.health,0);
  const effects=g.createEffectLifecycleState(g.createEffectState(actor),context),statuses=g.createEffectStatusState(effects),ai=g.createActorAIState(actor,{profileId:'P'},{controller:'ai',behaviorStateId:'engaged'}),timing=g.createActorAIDecisionTimingState(ai,context);
  const owners={activation,attack,applied,effects,statuses,gate:g.evaluateEffectRestrictionGate(effects,statuses,{blockedByRestrictionIds:['stun']}),ai,timing,entities:f.entities,world:{despawn:0,rewards:0,effectClears:0}},before=clone(owners);
  const r=resolve(f),c=g.closeEncounter(r.state,f.entities,r.disposition);g.createEncounterCleanupHandoff(c.state,f.entities,c.disposition);const cancelled=cancel(f);g.createEncounterCleanupHandoff(cancelled.state,f.entities,cancelled.disposition);a.deepEqual(owners,before);a.equal(activation.resources.current.mana,75);a.equal(f.state.status,'active');
});
contract('70','providers',a=>{
  const f=fixture(),saved=[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval,globalThis.crypto?.randomUUID];const trap=()=>{throw new Error('forbidden closure provider');};
  try{Date.now=trap;Math.random=trap;globalThis.setTimeout=trap;globalThis.setInterval=trap;if(globalThis.crypto)globalThis.crypto.randomUUID=trap;const r=resolve(f),c=g.closeEncounter(r.state,f.entities,r.disposition);a.equal(g.createEncounterCleanupHandoff(c.state,f.entities,c.disposition).terminalStatus,'closed');a.equal(cancel(f).status,'cancelled');f.observation.continuation='pending';a.deepEqual(resolve(f),rejection('continuation_pending'));}
  finally{[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval]=saved;if(globalThis.crypto)globalThis.crypto.randomUUID=saved[4];}
});
contract('67','installed',a=>{
  const manifest=JSON.parse(readFileSync(new URL('./node_modules/@rpg/gameplay/package.json',import.meta.url)));a.deepEqual(manifest.exports,{'.':{types:'./dist/index.d.ts',import:'./dist/index.js'}});
  const registry=[{id:'entity',optional:true,dependencies:[]},{id:'encounter',optional:true,dependencies:['entity']}].reduce(g.registerModule,g.createModuleRegistry());a.deepEqual(g.composeModules(registry,g.configureModules(registry,{enable:['entity','encounter']})).moduleIds,['entity','encounter']);const f=fixture(),r=resolve(f),c=g.closeEncounter(r.state,f.entities,r.disposition);a.equal(g.createEncounterCleanupHandoff(c.state,f.entities,c.disposition).terminalStatus,'closed');f.state=f.prepared;a.equal(cancel(f).status,'cancelled');
});
contract('','structural',a=>{
  const f=fixture();let reads=0;const get=()=>{reads++;return 'bad';};
  for(const input of [null,[],Object.create(f.closure),{...f.closure,extra:1},{...f.closure,[Symbol()]:1},{...f.closure,cancelAllowedStatuses:[,]},{...f.closure,cancelAllowedStatuses:['closed']},{...f.closure,get definitionId(){return get();}}])a.throws(()=>g.createEncounterClosurePolicy(input),{name:'TypeError'});
  for(const request of [{...f.request,reasonId:' '},{...f.request,outcome:draw()},{...f.request,get reasonId(){return get();}},{...f.request,encounterId:'foreign'}])a.throws(()=>g.cancelEncounter({...f.state,status:'closed'},f.entities,f.closure,request),{name:'TypeError'});
  a.throws(()=>g.cancelEncounter(f.state,f.entities,{...f.closure,definitionId:'foreign'},f.request),{name:'TypeError'});
  const r=resolve(f);for(const d of [{...record(),reasonId:'extra'},{...record(),get ruleId(){return get();}},{...record(),outcome:{...win(),get winnerSideIds(){return get();}}},{...cancellation(),outcome:draw()}])a.throws(()=>g.closeEncounter({...r.state,status:'closed'},f.entities,d),{name:'TypeError'});
  const malformed={...f.policy,rules:[{...objective(),whenStatus:'pending'}]};a.throws(()=>resolveEncounter({...f.state,status:'closed'},f.entities,malformed,f.observation),{name:'TypeError'});a.equal(reads,0);
  a.throws(()=>g.createEncounterCleanupHandoff({...r.state,status:'closed'},g.removeEntity(f.entities,'monster-001'),r.disposition),{name:'TypeError'});
});
