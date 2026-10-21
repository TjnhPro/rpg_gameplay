import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import * as g from '@rpg/gameplay';

function contract(ids,name,run){test('Continuity '+name,()=>{
  let assertions=0;const a=new Proxy(assert,{get(target,key){return (...args)=>{assertions++;return Reflect.get(target,key)(...args);};}});
  run(a);assert.ok(assertions>0,'Continuity requires actual assertions');
  for(const id of ids.split(' ').filter(Boolean))console.log('ENCOUNTER_T'+id+'_PASS');
});}
const token=JSON.stringify;
const ids=w=>w.state.participants.map(p=>p.entityId);
const memberPolicy=()=>({joinAllowedStatuses:['prepared','active'],leaveAllowedStatuses:['prepared','active'],changeSideAllowedStatuses:['prepared','active'],allowedJoinLifeStatuses:['alive'],requireWorldReadyOnJoin:true});
const completionPolicy=()=>({definitionId:'forest-waves',rules:[{ruleId:'last-standing',kind:'side_elimination',contenderSideIds:['party','enemies'],zeroSurvivors:'pending'}]});
const win={kind:'victory',winnerSideIds:['party'],defeatedSideIds:['enemies']};
function world(kinds=['player','monster','monster']){
  const w={entities:g.createEntityCollection(),actors:{},life:{},resources:{},ready:{},rev:0,lifeVersion:0,continuationVersion:0,objectiveVersion:0,controllerVersion:0,worldVersion:0,sideVersion:0,continuation:'clear',objectives:[],controller:'ai',disposition:null,events:[],cleanupReceipts:new Set(),calls:0};
  for(const [i,id] of ['hero','wolf1','wolf2'].entries()){
    const e=g.createEntity({id,kind:kinds[i]});w.actors[id]=e;w.entities=g.addEntity(w.entities,e);w.life[id]=g.createEntityLifeState(e,{status:'alive'});w.ready[id]=true;
    w.resources[id]=g.createEntityResourceState(e,{health:{minimum:0,maximum:id==='hero'?100:20,current:id==='hero'?100:20}});
  }
  w.state=g.createEncounterState({definitionId:'forest-waves'},{encounterId:'forest-EC1',sides:[{sideId:'party'},{sideId:'enemies'}],participants:[{entityId:'hero',sideId:'party'},{entityId:'wolf1',sideId:'enemies'}]},w.entities);
  w.policy=completionPolicy();return w;
}
// Authoritative state and generations exist only inside each L4 test session.
function observe(w){return g.createEncounterCompletionObservation({encounterId:w.state.encounterId,participants:w.state.participants.map(p=>({entityId:p.entityId,life:w.life[p.entityId]})),objectives:w.objectives,continuation:w.continuation});}
function assess(w,observation=observe(w)){return g.evaluateEncounterCompletion(w.state,w.entities,w.policy,observation);}
function activation(w){return g.activateEncounter(w.state,w.entities,{minimumParticipants:1,minimumOccupiedSides:2,requiredOccupiedSideIds:['party','enemies'],allowedLifeStatuses:['alive'],requireWorldReady:true},{encounterId:w.state.encounterId,participants:w.state.participants.map(p=>({entityId:p.entityId,life:w.life[p.entityId],worldReady:w.ready[p.entityId]}))});}
function request(w,operation,entityId='wolf2',sideId='enemies'){
  const common={operation,encounterId:w.state.encounterId,entityId};return operation==='join'?{...common,sideId,readiness:{entityId,life:w.life[entityId]??{entityId,status:'alive'},worldReady:w.ready[entityId]??true}}:operation==='change_side'?{...common,sideId}:common;
}
function membership(w,r,policy=memberPolicy()){return g.applyEncounterMembershipChange(w.state,w.entities,policy,r);}
function resolution(w){return g.resolveEncounter(w.state,w.entities,w.policy,observe(w));}
function cancellation(w){return g.cancelEncounter(w.state,w.entities,{definitionId:'forest-waves',cancelAllowedStatuses:['prepared','active']},{encounterId:w.state.encounterId,reasonId:'caller-abort'});}
function stage(w,candidate){
  g.validateEncounterState(w.state,w.entities);
  return {candidate,rev:w.rev,lifeVersion:w.lifeVersion,continuationVersion:w.continuationVersion,objectiveVersion:w.objectiveVersion,controllerVersion:w.controllerVersion,worldVersion:w.worldVersion,sideVersion:w.sideVersion};
}
function fresh(w,p){
  if(p.rev!==w.rev)return 'stale_revision';
  if(p.lifeVersion!==w.lifeVersion)return 'stale_life';
  if(p.continuationVersion!==w.continuationVersion)return 'stale_continuation';
  if(p.objectiveVersion!==w.objectiveVersion)return 'stale_objective';
  if(p.controllerVersion!==w.controllerVersion)return 'stale_controller';
  if(p.worldVersion!==w.worldVersion)return 'stale_world';
  if(p.sideVersion!==w.sideVersion)return 'stale_side';
  return null;
}
function commit(w,p,fail=false){
  const stale=fresh(w,p);if(stale)return stale;
  const c=p.candidate;if(!c.state)return 'rejected';
  const allowed=c.status==='activated'?w.state.status==='prepared':c.status==='applied'?['prepared','active'].includes(w.state.status):c.status==='resolved'?w.state.status==='active':c.status==='closed'?w.state.status==='resolved':c.status==='cancelled'?['prepared','active'].includes(w.state.status):false;
  if(!allowed)return 'terminal_guard';
  if(fail)throw new Error('atomic staging failure');
  const record=c.disposition??w.disposition;
  // One assignment is the fixture's single-process atomic seam, not durable storage.
  Object.assign(w,{state:c.state,disposition:record,rev:w.rev+1});return 'accepted';
}
function start(w){assert.equal(commit(w,stage(w,activation(w))),'accepted');return w;}
function change(w,operation,id='wolf2',side='enemies'){
  const result=membership(w,request(w,operation,id,side));assert.equal(commit(w,stage(w,result)),'accepted');
  if(operation==='change_side')w.sideVersion++;return result;
}
function continuation(w,value){w.continuation=value;w.continuationVersion++;}
function objective(w,status){w.objectives=[{objectiveId:'crystal',status}];w.objectiveVersion++;}
function revive(w,id){
  const maximum=id==='hero'?100:20;w.resources[id]=g.transitionEntityResource(w.resources[id],'health',{maximum,amount:10,operation:'increase',rule:{minimum:0,currentAboveMaximum:'reject',allowIncreaseFromMinimum:true}}).state;
  w.life[id]=g.reviveEntity(w.life[id],w.resources[id],{resourceId:'health',minimum:0,maximum}).state;w.lifeVersion++;
}
function hit(w,target='wolf1',mode='landed',roll=.8){
  const actor=target==='hero'?'wolf1':'hero';
  const context=g.createExecutionContext({clock:{now:()=>1000},random:{next(){w.calls++;return roll;}}});
  const action=g.createCombatActionContext({actionId:'explicit-hit',actionType:'basic_attack',sourceEntityId:actor,target:{kind:'entity',entityId:target}});
  const admission=g.evaluateCombatActionAdmission(action,w.entities,w.life[actor],{eligible:true});
  const validation=g.evaluateCombatTargetValidation(admission,w.entities,w.life[target],{relation:'enemy',allowedRelations:['enemy'],allowedLifeStatuses:['alive']});
  const attack=g.resolveCombatAttack(admission,validation,{hit:{dodgeChance:mode==='dodge'?.5:0,eligible:true,rule:{enabled:true,bounds:{min:0,max:1}}},critical:{chance:0,bonus:0,eligible:false,rule:{enabled:true,bounds:{min:0,max:1}}},damage:{base:mode==='zero'?0:target==='hero'?100:20,rank:1,perRank:0,scaling:[],flat:{definition:0,additional:0,resolved:0},bonuses:[]},mitigation:{ruleKey:'none',rating:0,rule:{enabled:false,bounds:{min:0,max:1},levelScalingEnabled:false}}},context);
  const applied=g.applyCombatAttackDamage(attack,w.resources[target],w.life[target],{resourceId:'health',minimum:0,maximum:target==='hero'?100:20,currentAboveMaximum:'reject'});
  if(applied.resourceResult){w.resources[target]=applied.resourceResult.state;w.life[target]=applied.lifeResult.state;w.lifeVersion++;}
  return applied;
}
function close(w){return g.closeEncounter(w.state,w.entities,w.disposition);}
function finish(w){assert.equal(commit(w,stage(w,resolution(w))),'accepted');assert.equal(commit(w,stage(w,close(w))),'accepted');return w;}
function cleanup(w,candidate={state:w.state,disposition:w.disposition},throwDispatcher=false){
  if(!['closed','cancelled'].includes(w.state.status)||token(candidate.state)!==token(w.state)||token(candidate.disposition)!==token(w.disposition))return 'unauthorized_cleanup';
  const handoff=g.createEncounterCleanupHandoff(w.state,w.entities,w.disposition),key=handoff.encounterId;
  if(w.cleanupReceipts.has(key))return 'duplicate_cleanup';
  if(throwDispatcher)throw new Error('caller cleanup failure');
  w.cleanupReceipts.add(key);w.events.push(['cleanup',...handoff.participantEntityIds]);return handoff;
}
function snapshot(w){return token({state:w.state,entities:w.entities,life:w.life,resources:w.resources,record:w.disposition,rev:w.rev,events:w.events,receipts:[...w.cleanupReceipts],controller:w.controller,ready:w.ready,continuation:w.continuation,objectives:w.objectives,versions:[w.lifeVersion,w.continuationVersion,w.objectiveVersion,w.controllerVersion,w.worldVersion,w.sideVersion],owners:w.owners});}
function frozen(a,value){if(value&&typeof value==='object'){a.ok(Object.isFrozen(value),'detached frozen');for(const v of Object.values(value))frozen(a,v);}}

contract('01 02 03 04 05','canonical-life',a=>{
  const w=start(world()),before=token(w.state);a.deepEqual(observe(w).participants,[{entityId:'hero',life:{entityId:'hero',status:'alive'}},{entityId:'wolf1',life:{entityId:'wolf1',status:'alive'}}]);
  a.equal(w.resources.hero.current.health,100);a.equal(w.resources.wolf1.current.health,20);a.equal(assess(w).reason,'no_completion_condition_met');
  const dodge=hit(w,'wolf1','dodge',.2);a.equal(dodge.appliedDamage,0);a.equal(w.life.wolf1.status,'alive');a.equal(w.resources.wolf1.current.health,20);
  a.equal(hit(w,'wolf1','zero').appliedDamage,0);a.equal(w.life.wolf1.status,'alive');a.equal(hit(w).appliedDamage,20);a.equal(w.resources.wolf1.current.health,0);a.equal(w.life.wolf1.status,'dead');a.equal(token(w.state),before,'N06 dead member retained');a.deepEqual(ids(w),['hero','wolf1']);
  const resourceOnly=start(world());resourceOnly.resources.wolf1=g.transitionEntityResource(resourceOnly.resources.wolf1,'health',{maximum:20,operation:'decrease',amount:20,rule:{minimum:0,currentAboveMaximum:'reject',allowIncreaseFromMinimum:false}}).state;
  a.equal(resourceOnly.resources.wolf1.current.health,0);a.equal(resourceOnly.life.wolf1.status,'alive');a.equal(assess(resourceOnly).reason,'no_completion_condition_met','resource value does not replace canonical Life');
});
contract('06 07 08 09 10 11 13 14','life-validation',a=>{
  const w=start(world());hit(w);const before=snapshot(w),o=observe(w),r=assess(w);a.deepEqual(r,{status:'resolvable',reason:'rule_matched',encounterId:'forest-EC1',ruleId:'last-standing',participantEntityId:null,outcome:win});
  a.deepEqual(assess(w,{...o,participants:[...o.participants].reverse()}),r);
  const three=start(world());change(three,'join');const incomplete=observe(three),facts=incomplete.participants.filter(p=>p.entityId!=='hero');
  a.deepEqual(assess(three,{...incomplete,participants:facts}),assess(three,{...incomplete,participants:[...facts].reverse()}));a.equal(assess(three,{...incomplete,participants:facts}).participantEntityId,'hero','N01 missing Life canonical order');
  for(const participants of [[],[o.participants[1]]]){const result=assess(w,{...o,participants});a.equal(result.reason,'participant_fact_missing','N01 missing Life');a.equal(result.participantEntityId,'hero');}
  a.deepEqual(assess(w),r);a.deepEqual(assess(w),r);a.equal(w.calls,0,'fresh observations do not consume providers');
  a.throws(()=>assess(w,{...o,participants:[...o.participants,o.participants[0]]}),{name:'TypeError',message:/Duplicate/},'N02 duplicate Life');
  a.throws(()=>assess(w,{...o,continuation:'pending',participants:[...o.participants,{entityId:'wolf2',life:w.life.wolf2}]}),{name:'TypeError',message:/Foreign/},'N03 foreign Life');
  a.throws(()=>assess(w,{...o,participants:[{entityId:'hero',life:w.life.wolf1}]}),{name:'TypeError',message:/identity/});
  a.throws(()=>g.validateEncounterState(w.state,g.removeEntity(w.entities,'wolf1')),{name:'TypeError'});a.equal(snapshot(w),before);
  let reads=0;a.throws(()=>assess(w,{...o,participants:[{entityId:'hero',get life(){reads++;return w.life.hero;}}]}),{name:'TypeError'});a.equal(reads,0);
});
contract('15 16 17 24','continuation',a=>{
  const w=start(world());hit(w);continuation(w,'pending');a.equal(assess(w).reason,'continuation_pending','N04 pending barrier');
  w.policy={definitionId:'forest-waves',rules:[{ruleId:'objective',kind:'objective',objectiveId:'crystal',whenStatus:'succeeded',outcome:win}]};objective(w,'succeeded');a.equal(assess(w).reason,'continuation_pending');
  const rejected=resolution(w);a.equal(rejected.reason,'continuation_pending');a.equal(rejected.state,null);a.equal(rejected.disposition,null);a.equal(w.state.status,'active');
  continuation(w,'clear');w.policy={definitionId:'forest-waves',rules:[]};a.equal(assess(w).reason,'no_completion_condition_met','N05 clear requires rule');
  w.policy=completionPolicy();change(w,'join');a.equal(assess(w).reason,'no_completion_condition_met');
});
contract('18 19 20 21 22 23 25 28','reinforcement',a=>{
  const w=start(world());hit(w);continuation(w,'pending');a.deepEqual(ids(w),['hero','wolf1']);a.equal(g.hasEntity(w.entities,'wolf2'),true);const r=request(w,'join'),before=snapshot(w),c=membership(w,r);
  a.equal(c.status,'applied');a.deepEqual(c.state.participants.map(p=>p.entityId),['hero','wolf1','wolf2']);a.equal(snapshot(w),before);
  a.equal(membership(w,r,{...memberPolicy(),joinAllowedStatuses:['prepared']}).reason,'operation_not_allowed','N09 join policy');
  a.equal(membership(w,{...r,readiness:{...r.readiness,life:{entityId:'wolf2',status:'dead'}}}).reason,'join_life_not_allowed','N10 dead join');
  a.equal(membership(w,{...r,readiness:{...r.readiness,worldReady:false}}).reason,'join_world_not_ready','N11 World readiness');
  a.equal(membership(w,request(w,'join','absent')).reason,'entity_not_found','N08 identity');
  a.equal(commit(w,stage(w,c)),'accepted');a.equal(membership(w,r).reason,'already_participating','N12 duplicate');hit(w,'wolf2');continuation(w,'clear');a.deepEqual(assess(w).outcome,win);const end=resolution(w);a.equal(end.status,'resolved');a.equal(w.state.status,'active');a.equal(w.events.length,0);a.equal(w.disposition,null);
});
contract('26','empty-side',a=>{const w=start(world());change(w,'leave','wolf1');a.equal(w.state.status,'active');a.equal(assess(w).reason,'no_completion_condition_met','N07 empty side');change(w,'leave','hero');a.deepEqual(ids(w),[]);a.equal(assess(w).status,'pending');});
contract('29 30 31 32 33 34 40','leave-rejoin',a=>{
  const w=start(world()),life=token(w.life.hero),resources=token(w.resources.hero);change(w,'leave','hero');a.deepEqual(ids(w),['wolf1'],'N13 no auto rejoin');a.equal(token(w.life.hero),life);a.equal(token(w.resources.hero),resources);a.equal(w.controller,'ai','N14 no controller takeover');
  const r=request(w,'join','hero','party');a.equal(membership(w,r,{...memberPolicy(),joinAllowedStatuses:[]}).reason,'operation_not_allowed');a.equal(membership(w,{...r,sideId:'absent'}).reason,'side_not_found');
  change(w,'join','hero','party');a.deepEqual(ids(w),['wolf1','hero']);a.equal(membership(w,r).reason,'already_participating');change(w,'change_side','hero','enemies');a.deepEqual(w.state.participants,[{entityId:'wolf1',sideId:'enemies'},{entityId:'hero',sideId:'enemies'}]);
});
contract('12 35 36 37 38 42','revival',a=>{
  const w=start(world());hit(w);const p=stage(w,resolution(w)),before=token(w.state);revive(w,'wolf1');a.equal(w.life.wolf1.status,'alive','N16 fresh canonical revival');a.equal(commit(w,p),'stale_life');a.equal(assess(w).status,'pending');a.equal(token(w.state),before);
  hit(w);change(w,'leave','wolf1');a.equal(w.life.wolf1.status,'dead');a.equal(membership(w,request(w,'join','wolf1')).reason,'join_life_not_allowed');revive(w,'wolf1');a.deepEqual(ids(w),['hero']);change(w,'join','wolf1');a.deepEqual(ids(w),['hero','wolf1']);hit(w);finish(w);const terminal=token(w.state);revive(w,'wolf1');a.equal(token(w.state),terminal);
});
contract('41','terminal-membership',a=>{
  const w=start(world());hit(w);const resolved=resolution(w);a.equal(commit(w,stage(w,resolved)),'accepted');const closed=close(w),cancelled=cancellation(start(world()));
  for(const state of [resolved.state,closed.state,cancelled.state])for(const operation of ['join','leave','change_side']){const current={...w,state};a.equal(membership(current,request(current,operation,operation==='join'?'wolf2':'hero')).reason,'encounter_not_open','N15 terminal membership');a.equal(state.status,current.state.status);}
});
contract('27 39 43 45 46 47 49 50 56','races',a=>{
  const scenarios=[
    ['revision',w=>change(w,'join'),'stale_revision'],
    ['life',w=>revive(w,'wolf1'),'stale_life'],
    ['continuation',w=>continuation(w,'pending'),'stale_continuation'],
    ['objective',w=>objective(w,'succeeded'),'stale_objective'],
    ['world',w=>{w.ready.hero=false;w.worldVersion++;},'stale_world'],
    ['side',w=>{change(w,'change_side','hero','enemies');},'stale_side'],
  ];
  for(const [name,mutate,expected] of scenarios){const w=start(world());hit(w);const p=stage(w,resolution(w));mutate(w);if(name==='side')p.rev=w.rev;const before=snapshot(w);a.equal(commit(w,p),expected,'N'+({revision:'17',life:'18',continuation:'19',objective:'20',side:'21',world:'39'}[name])+' isolated '+name);a.equal(snapshot(w),before);}
  for(const fact of ['life','world']){const w=start(world());change(w,'leave','hero');const p=stage(w,membership(w,request(w,'join','hero','party')));if(fact==='life')hit(w,'hero');else{w.ready.hero=false;w.worldVersion++;}const before=snapshot(w);a.equal(commit(w,p),'stale_'+fact);a.deepEqual(ids(w),['wolf1']);a.equal(snapshot(w),before);}
  {const w=world(),p=stage(w,activation(w));change(w,'join');a.equal(commit(w,p),'stale_revision');a.equal(w.state.status,'prepared');}
  {const w=start(world()),p=stage(w,cancellation(w));change(w,'join');a.equal(commit(w,p),'stale_revision');a.equal(w.disposition,null);}
});
contract('44 48 51','dispatch',a=>{
  for(const fault of ['leave','death','controller']){
    const w=start(world()),ai=g.createActorAIState(w.actors.hero,{profileId:'guard'},{controller:'ai',behaviorStateId:'engaged'});const context=g.createActorAIDecisionContext(ai,'decision-1');
    const selection=g.evaluateActorAIActionSelection({...ai,targetEntityId:'wolf1'},w.entities,context,{profileId:'guard',rules:[{ruleId:'hit',behaviorStateId:'engaged',actionKey:'hit',actionKind:'basic_attack',targetMode:'current_target'}]},g.createActorAIActionObservation(context,[{actionKey:'hit',status:'available',reasonId:null}]));a.equal(selection.status,'selected');
    const p=stage(w,{state:w.state});if(fault==='leave')change(w,'leave','hero');if(fault==='death')hit(w,'hero');if(fault==='controller'){w.controller='manual';w.controllerVersion++;}
    const before=snapshot(w),reason=fresh(w,p);if(reason===null){hit(w);w.events.push(['dispatch']);}
    a.equal(reason,{leave:'stale_revision',death:'stale_life',controller:'stale_controller'}[fault],'N22 current dispatch '+fault);a.equal(snapshot(w),before,'no stale cost/damage/feedback');
  }
});
contract('52 53','terminal-races',a=>{
  for(const order of ['resolve','cancel']){const w=start(world());hit(w);const r=stage(w,resolution(w)),c=stage(w,cancellation(w));a.equal(commit(w,order==='resolve'?r:c),'accepted');const other=order==='resolve'?c:r;other.rev=w.rev;a.equal(commit(w,other),'terminal_guard','N24 independent terminal pair');a.equal(w.disposition.kind,order==='resolve'?'resolution':'cancellation');}
  const w=start(world());hit(w);const staged=stage(w,resolution(w)),before=snapshot(w);a.throws(()=>commit(w,staged,true),/atomic staging failure/);a.equal(snapshot(w),before,'N23 atomic pair');a.equal(commit(w,staged),'accepted');a.equal(w.state.status,'resolved');a.equal(w.disposition.kind,'resolution');
  const c=stage(w,close(w));a.equal(commit(w,c),'accepted');a.equal(commit(w,c),'stale_revision');
});
contract('54 55','cleanup',a=>{
  const w=start(world());hit(w);const r=resolution(w),c=g.closeEncounter(r.state,w.entities,r.disposition);a.equal(cleanup(w,c),'unauthorized_cleanup','N25 before terminal commit');a.deepEqual(w.events,[]);
  finish(w);a.throws(()=>cleanup(w,undefined,true),/caller cleanup failure/);a.equal(w.state.status,'closed');a.equal(w.cleanupReceipts.size,0);const first=cleanup(w);a.deepEqual(first.participantEntityIds,['hero','wolf1']);a.equal(cleanup(w),'duplicate_cleanup','N26 one cleanup receipt');a.equal(w.events.length,1);a.equal(w.cleanupReceipts.size,1);a.equal(g.hasEntity(w.entities,'wolf1'),true);
});
function replay(finalContinuation='clear',roll=.8){
  const w=world(),trace=[];trace.push(['prepared',w.rev,ids(w)]);start(w);trace.push(['active',w.rev]);hit(w);trace.push(['death1',w.resources.wolf1.current.health,w.life.wolf1.status]);continuation(w,'pending');trace.push(['barrier',assess(w).reason,resolution(w).state]);
  continuation(w,'clear');const old=stage(w,resolution(w));continuation(w,'pending');change(w,'join');trace.push(['join',w.rev,ids(w),commit(w,old)]);
  change(w,'leave','hero');trace.push(['leave',ids(w),w.life.hero.status]);change(w,'join','hero','party');trace.push(['rejoin',ids(w)]);
  revive(w,'wolf1');trace.push(['revive',w.life.wolf1.status,w.resources.wolf1.current.health]);hit(w);hit(w,'wolf2','dodge',roll);continuation(w,finalContinuation);const end=assess(w);trace.push(['assessment',end.status,end.reason]);
  if(end.status==='resolvable'){finish(w);const h=cleanup(w);trace.push(['closed',w.rev,w.disposition.outcome,h.participantEntityIds,w.events.length]);}
  return {w,trace};
}
const literal=[['prepared',0,['hero','wolf1']],['active',1],['death1',0,'dead'],['barrier','continuation_pending',null],['join',2,['hero','wolf1','wolf2'],'stale_revision'],['leave',['wolf1','wolf2'],'alive'],['rejoin',['wolf1','wolf2','hero']],['revive','alive',10],['assessment','resolvable','rule_matched'],['closed',6,win,['wolf1','wolf2','hero'],1]];
contract('57 58 59 61','replay',a=>{
  const one=replay(),two=replay();a.deepEqual(one.trace,literal,'N28 independent literal trace');a.deepEqual(two.trace,literal);a.notEqual(one.w,two.w,'N28 independent sessions');a.notEqual(one.w.life,two.w.life);a.notEqual(one.w.cleanupReceipts,two.w.cleanupReceipts,'N28 independent ledgers');
  const pending=replay('pending');a.deepEqual(pending.trace.slice(0,8),literal.slice(0,8));a.deepEqual(pending.trace[8],['assessment','pending','continuation_pending']);a.equal(pending.w.state.status,'active');
  const dodge=replay('clear',.2);a.deepEqual(dodge.trace[8],['assessment','pending','no_completion_condition_met']);a.equal(dodge.w.resources.wolf2.current.health,20);a.equal(dodge.w.life.wolf2.status,'alive');a.equal(one.w.resources.wolf2.current.health,0);a.equal(one.w.calls,1);a.equal(dodge.w.calls,1);
  console.log('ENCOUNTER_CONTINUITY_REPLAY_SHA256 '+createHash('sha256').update(token(literal)).digest('hex'));
});
contract('60 62','policy-snapshots',a=>{
  const w=start(world());hit(w);objective(w,'succeeded');const outcome={kind:'draw',winnerSideIds:[],defeatedSideIds:[]},rule={ruleId:'objective-first',kind:'objective',objectiveId:'crystal',whenStatus:'succeeded',outcome};w.policy.rules.unshift(rule);a.equal(assess(w).ruleId,'objective-first');w.policy.rules.reverse();a.equal(assess(w).ruleId,'last-standing');
  const p=resolution(w);frozen(a,p);const original=token(p);w.policy.rules.length=0;w.objectives[0].status='failed';a.equal(token(p),original);a.equal(Object.isFrozen(w.policy),false);a.deepEqual(Object.keys(p.state),['encounterId','definitionId','status','sides','participants']);
});
contract('63','providers',a=>{
  const old=[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval],trap=()=>{throw new Error('N27 hidden provider');};
  try{Date.now=trap;Math.random=trap;globalThis.setTimeout=trap;globalThis.setInterval=trap;a.deepEqual(replay().trace,literal);const w=start(world());continuation(w,'pending');a.equal(assess(w).reason,'continuation_pending');a.equal(commit(w,stage(w,cancellation(w))),'accepted');a.equal(cleanup(w).terminalStatus,'cancelled');}
  finally{[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval]=old;}
});
contract('64 65 67','optional-profile',a=>{
  for(const kinds of [['player','monster','npc'],['pet','summon','custom']]){const w=start(world(kinds));a.deepEqual(ids(w),['hero','wolf1']);const r=g.createModuleRegistry(),registry=[{id:'entity',optional:true,dependencies:[]},{id:'encounter',optional:true,dependencies:['entity']}].reduce(g.registerModule,r);a.deepEqual(g.composeModules(registry,g.configureModules(registry,{enable:['entity','encounter']})).moduleIds,['entity','encounter']);const before=token(w.entities);continuation(w,'pending');a.equal(resolution(w).reason,'continuation_pending');a.equal(token(w.entities),before);}
});
contract('66','full-profile',a=>{
  const w=start(world()),actor=w.actors.hero,context=g.createExecutionContext({clock:{now:()=>1000}}),definition=g.createSkillDefinition({skillId:'spell'}),instance=g.createSkillInstance(definition,actor,{instanceId:'spell-1'});
  const admission=g.evaluateSkillActivationAdmission(definition,instance,actor.id,w.entities,w.life.hero,{owned:true,eligible:true,rank:{mode:'not_required'}});
  const skill=g.activateSkill({instance,admission,resourceState:g.createEntityResourceState(actor,{mana:{minimum:0,maximum:100,current:100}}),resourceCosts:{costs:[{resourceId:'mana',amount:25}],bounds:[{resourceId:'mana',minimum:0,maximum:100,currentAboveMaximum:'reject'}]},cooldownState:g.createSkillCooldownState(instance),cooldownConfig:{baseDurationMs:1000,effectiveCdr:.25},executionContext:context,intent:{attemptId:'attempt-1',dispatch:{kind:'caller'}},executionPreflight:{kind:'caller',status:'accepted'}});
  const effect=g.createEffectLifecycleState(g.createEffectState(actor),context),status=g.createEffectStatusState(effect),ai=g.createActorAIState(actor,{profileId:'guard'},{controller:'ai',behaviorStateId:'engaged'}),owners={skill,effect,status,ai},before=token(owners);w.owners=owners;a.equal(skill.resources.current.mana,75);a.equal(skill.cooldown.readyAtMs,1750);hit(w);const staged=stage(w,resolution(w));continuation(w,'pending');const rejectedBefore=snapshot(w);a.equal(commit(w,staged),'stale_continuation');a.equal(snapshot(w),rejectedBefore,'full owner snapshot preserved on stale rejection');change(w,'join');hit(w,'wolf2');continuation(w,'clear');finish(w);cleanup(w);a.equal(token(owners),before);a.equal(w.state.status,'closed');
});
