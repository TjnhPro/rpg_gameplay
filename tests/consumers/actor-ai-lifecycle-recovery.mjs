import assert from 'node:assert/strict';
import test from 'node:test';
import * as g from '@rpg/gameplay';
function contract(name,run){test(name,()=>{let count=0;const checked=new Proxy(assert,{get(t,k){return(...args)=>{count++;return Reflect.get(t,k)(...args);};}});run(checked);assert.ok(count>0,'Lifecycle requires actual assertions');});}
const behavior={profileId:'P',stateIds:['engaged','idle','guarding','returning'],rules:[
  {ruleId:'leash',fromStateId:'engaged',triggerId:'leash_exceeded',toStateId:'returning',targetRequirement:'absent'},
  {ruleId:'disengage',fromStateId:'engaged',triggerId:'disengage_requested',toStateId:'returning',targetRequirement:'absent'},
  {ruleId:'arrival',fromStateId:'returning',triggerId:'return_completed',toStateId:'guarding',targetRequirement:'absent'}]};
const lifePolicy={resourceId:'health',minimum:0,maximum:100};
const bounds={minimum:0,currentAboveMaximum:'reject',allowIncreaseFromMinimum:true};
const actionRules=[{ruleId:'attack',behaviorStateId:'engaged',actionKey:'attack',actionKind:'basic_attack',targetMode:'current_target'}];
const available=[{actionKey:'attack',status:'available',reasonId:null}];
function fixture(kind='monster',controller='ai'){
 const actor=g.createEntity({id:'Actor',kind}),target=g.createEntity({id:'Target',kind:'player'});
 const clock={time:1000,samples:0,now(){this.samples++;return this.time;}};
 const context=g.createExecutionContext({clock,random:{next(){return .2;}}});
 const f={actor,target,clock,context,entities:g.addEntity(g.addEntity(g.createEntityCollection(),actor),target),
  ai:{...g.createActorAIState(actor,{profileId:'P'},{controller,behaviorStateId:'engaged'}),targetEntityId:'Target'},
  life:g.createEntityLifeState(actor,{status:'alive'}),targetLife:g.createEntityLifeState(target,{status:'alive'}),
  resources:g.createEntityResourceState(actor,{health:{minimum:0,maximum:100,current:100},mana:{minimum:0,maximum:100,current:100}}),
  targetResources:g.createEntityResourceState(target,{health:{minimum:0,maximum:100,current:100}}),
  timing:null,enabled:true,dispatches:0,attempts:new Set(),feedback:[],world:{position:7},events:[]};
 f.timing=g.createActorAIDecisionTimingState(f.ai,f.context);return f;
}
const gate=f=>g.evaluateActorAILifeGate(f.ai,f.entities,f.life);
const timing=(f,cursor=f.timing,intervalMs=500)=>g.evaluateActorAIDecisionTiming(f.ai,f.entities,f.life,cursor,{intervalMs},f.context);
const reset=(f,reason='session_reset',destination='idle',policy=behavior)=>g.evaluateActorAIReset(f.ai,f.entities,f.life,policy,{reason,resetBehaviorStateId:destination});
function die(f){f.resources=g.transitionEntityResource(f.resources,'health',{operation:'decrease',amount:100,maximum:100,rule:bounds}).state;f.life=g.resolveEntityDefeat(f.life,f.resources,lifePolicy).state;f.enabled=false;}
function revive(f){f.resources=g.transitionEntityResource(f.resources,'health',{operation:'increase',amount:40,maximum:100,rule:bounds}).state;f.life=g.reviveEntity(f.life,f.resources,lifePolicy).state;}
const owners=f=>structuredClone({ai:f.ai,life:f.life,resources:f.resources,target:f.targetResources,targetLife:f.targetLife,timing:f.timing,world:f.world});
function frozen(a,x){if(x&&typeof x==='object'){a.ok(Object.isFrozen(x));for(const v of Object.values(x))frozen(a,v);}}
function propose(f,id='D',rules=actionRules,facts=available){
 if(!f.enabled || gate(f).status !== 'allowed')return null;
 const due=timing(f);if(due.status !== 'ready')return null;
 const context=g.createActorAIDecisionContext(f.ai,id);
 const selection=g.evaluateActorAIActionSelection(f.ai,f.entities,context,{profileId:'P',rules},g.createActorAIActionObservation(context,facts));
 return {selection,due,ai:f.ai,timing:f.timing,life:f.life};
}
function publishTiming(f,staged){if(staged.baseline !== f.timing)return false;f.timing=staged.result.state;return true;}
function feedback(f,bound,attemptId,phase,status,reasonId){const result=g.validateActorAIActionExecutionFeedback(bound.selection,{...bound.selection.decision.intent,attemptId,phase,status,reasonId});f.feedback.push(result);return result;}
function dispatch(f,bound,attemptId,mode='landed'){
 if(!bound || bound.selection.status !== 'selected')throw new TypeError('L4 selected proposal required');
 if(f.attempts.has(attemptId))throw new TypeError('L4 duplicate');
 f.attempts.add(attemptId);
 const current=gate(f);
 if(current.status !== 'allowed')return feedback(f,bound,attemptId,'admission','rejected',current.reason);
 if(bound.ai !== f.ai || bound.timing !== f.timing || bound.life !== f.life)throw new TypeError('L4 stale turn');
 const intent=bound.selection.decision.intent;
 const action=g.createCombatActionContext({actionId:'combat-'+attemptId,actionType:'melee',sourceEntityId:intent.actorId,target:{kind:'entity',entityId:intent.targetEntityId}});
 const admission=g.evaluateCombatActionAdmission(action,f.entities,f.life,{eligible:true});
 if(admission.status !== 'admitted')return feedback(f,bound,attemptId,'admission','rejected',admission.reason);
 const validation=g.evaluateCombatTargetValidation(admission,f.entities,f.targetLife,{relation:'enemy',allowedRelations:['enemy'],allowedLifeStatuses:['alive']});
 if(validation.status !== 'accepted')return feedback(f,bound,attemptId,'admission','rejected',validation.reason);
 f.timing=bound.due.state;
 const hit=g.resolveCombatAttack(admission,validation,{hit:{dodgeChance:mode==='dodge'?.5:0,eligible:true,rule:{enabled:true,bounds:{min:0,max:1}}},
  critical:{chance:0,bonus:.5,eligible:false,rule:{enabled:true,bounds:{min:0,max:1}}},damage:{base:mode==='zero'?0:20,rank:1,perRank:0,scaling:[],flat:{definition:0,additional:0,resolved:0},bonuses:[]},
  mitigation:{ruleKey:'none',rating:0,rule:{enabled:false,bounds:{min:0,max:1},levelScalingEnabled:false}}},f.context);
 const result=g.applyCombatAttackDamage(hit,f.targetResources,f.targetLife,{...lifePolicy,currentAboveMaximum:'reject'});
 if(result.resourceResult)f.targetResources=result.resourceResult.state;if(result.lifeResult)f.targetLife=result.lifeResult.state;
 f.dispatches++;return {result,feedback:feedback(f,bound,attemptId,'execution','completed',null)};
}
function disengage(f,trigger,policy=behavior,between=()=>{}){
 const baseline={ai:f.ai,life:f.life};if(gate(f).status !== 'allowed')return null;
 const cleared=reset(f,'disengage',null,policy);
 between(f);
 if(gate(f).status !== 'allowed' || f.ai !== baseline.ai || f.life !== baseline.life)return null;
 const transitioned=g.evaluateActorAIBehaviorTransition(cleared.state,f.entities,g.createActorAIBehaviorObservation(cleared.state,[trigger]),policy);
 if(gate(f).status !== 'allowed' || f.ai !== baseline.ai || f.life !== baseline.life)return null;
 f.ai=transitioned.state;return transitioned;
}
contract('lifecycle L01-L06/L08/L40/L50: Life gate precedes timing/proposal, exact precedence and dispatch recheck',a=>{
 for(const controller of ['ai','manual'])for(const status of ['alive','dead']){
  const f=fixture('player',controller);f.life=g.createEntityLifeState(f.actor,{status});const before=owners(f),calls=f.clock.samples;
  const reason=status==='dead'?'actor_dead':controller==='manual'?'manual_control':'none';
  a.deepEqual(gate(f),{status:reason==='none'?'allowed':'blocked',reason,actorId:'Actor'});a.deepEqual(owners(f),before);
  if(reason!=='none'){a.deepEqual(timing(f),{status:'blocked',reason,state:null});a.equal(propose(f),null);a.equal(f.clock.samples,calls);}
  frozen(a,gate(f));
 }
 const f=fixture(),b=propose(f);die(f);const cursor=f.timing;const result=dispatch(f,b,'pending');
 a.equal(result.reasonId,'actor_dead');a.equal(f.dispatches,0);a.equal(f.targetResources.current.health,100);a.equal(f.timing,cursor);
 for(const state of [f.ai,{...f.ai,controller:'manual'}]){
  a.throws(()=>g.evaluateActorAILifeGate(state,f.entities,{entityId:'Other',status:'dead'}),TypeError);
  a.throws(()=>g.evaluateActorAILifeGate(state,g.createEntityCollection(),f.life),TypeError);
  a.throws(()=>g.evaluateActorAILifeGate(state,{},f.life),TypeError);
 }
 console.log('ACTOR_AI_LIFECYCLE_LIFE_PASS');
});
contract('lifecycle L10-L19: canonical death/revival separate from explicit reset and activation',a=>{
 const f=fixture(),initialAI=structuredClone(f.ai),initialTiming=f.timing;const trace=[];
 a.equal(timing(f).status,'ready');f.clock.time=1100;die(f);trace.push([1100,f.life.status,f.resources.current.health]);
 f.clock.time=1200;a.equal(gate(f).reason,'actor_dead');a.equal(propose(f),null);trace.push([1200,'actor_dead']);
 f.clock.time=1300;for(const reason of ['respawn','session_reset','disengage'])a.deepEqual(reset(f,reason,reason==='disengage'?null:'idle'),{status:'rejected',reason:'actor_dead',action:reason,state:null});
 trace.push([1300,'rejected']);f.clock.time=2000;revive(f);a.equal(f.life.status,'alive');a.equal(f.resources.current.health,40);
 a.equal(f.enabled,false);a.equal(propose(f),null);a.deepEqual(f.ai,initialAI);a.equal(f.timing,initialTiming);trace.push([2000,'alive',40]);
 const before=owners(f),candidate=reset(f,'respawn');a.deepEqual(candidate.state,{actorId:'Actor',profileId:'P',controller:'ai',behaviorStateId:'idle',targetEntityId:null});
 a.deepEqual(owners(f),before);f.ai=candidate.state;f.timing=g.createActorAIDecisionTimingState(f.ai,f.context);f.enabled=true;
 trace.push([2000,f.ai.behaviorStateId,f.ai.targetEntityId,f.timing.nextEligibleAtMs]);
 a.deepEqual(trace,[[1100,'dead',0],[1200,'actor_dead'],[1300,'rejected'],[2000,'alive',40],[2000,'idle',null,2000]]);frozen(a,candidate);
 for(const controller of ['ai','manual']){
  const x=fixture('player',controller),old=owners(x),r=reset(x);a.equal(r.state.controller,controller);a.equal(r.state.profileId,'P');a.equal(r.state.actorId,'Actor');a.equal(r.state.targetEntityId,null);a.equal(r.state.behaviorStateId,'idle');a.deepEqual(owners(x),old);
  const detached=structuredClone(x.ai),captured=g.evaluateActorAIReset(detached,x.entities,x.life,behavior,{reason:'session_reset',resetBehaviorStateId:'guarding'});detached.profileId='changed';a.equal(captured.state.profileId,'P');frozen(a,captured);
  if(controller==='manual'){x.ai=r.state;a.equal(propose(x),null);}
 }
 console.log('ACTOR_AI_LIFECYCLE_RESET_PASS');
});
contract('lifecycle L07/L27/L48: current target dies, canonical perception excludes and existing selector loses/reacquires',a=>{
 const f=fixture(),bound=propose(f);f.targetResources=g.transitionEntityResource(f.targetResources,'health',{operation:'decrease',amount:100,maximum:100,rule:bounds}).state;
 f.targetLife=g.resolveEntityDefeat(f.targetLife,f.targetResources,lifePolicy).state;
 const before=owners(f),result=dispatch(f,bound,'dead-target');a.equal(result.reasonId,'target_life_not_allowed');a.deepEqual(owners(f),before);a.equal(f.dispatches,0);
 const perceive=candidates=>g.evaluateActorAIPerception(f.ai,f.entities,g.createActorAIPerceptionSnapshot(f.ai,{observedAtMs:1200,candidates}),{allowedRelationIds:['enemy'],allowedLifeStatuses:['alive'],requireVisible:true,requireInRange:true,requireReachable:true,allowSelf:false});
 const fact=(entityId,lifeStatus)=>({entityId,lifeStatus,relationId:'enemy',visible:true,inRange:true,reachable:true});
 const observed=perceive([fact('Target',f.targetLife.status)]);a.deepEqual(observed.excluded,[{entityId:'Target',reason:'target_life_not_allowed'}]);
 const lost=g.evaluateActorAITargetSelection(f.ai,f.entities,observed,{retention:'retain_if_eligible',preferredTargetIds:[]});a.equal(lost.reason,'target_lost');a.equal(lost.state.targetEntityId,null);a.equal(lost.lossReason,'target_life_not_allowed');
 f.entities=g.addEntity(f.entities,{id:'Replacement',kind:'custom'});const fresh=g.evaluateActorAITargetSelection(f.ai,f.entities,perceive([fact('Target','dead'),fact('Replacement','alive')]),{retention:'prefer_priority',preferredTargetIds:['Replacement']});
 a.equal(fresh.reason,'switched');a.equal(fresh.state.targetEntityId,'Replacement');a.equal(f.targetLife.status,'dead');
 f.ai=lost.state;a.equal(reset(f,'disengage',null).state.targetEntityId,null);
 console.log('ACTOR_AI_LIFECYCLE_TARGET_PASS');
});
contract('lifecycle L14-L15/L20-L29/L51: staged disengage and existing FSM, explicit World arrival, no partial commit',a=>{
 for(const trigger of ['leash_exceeded','disengage_requested']){
  const f=fixture(),before=owners(f);const clear=reset(f,'disengage',null);a.equal(clear.state.behaviorStateId,'engaged');a.equal(clear.state.targetEntityId,null);a.deepEqual(owners(f),before);
  f.clock.time=1500;const result=disengage(f,trigger);a.equal(result.status,'transitioned');a.equal(f.ai.behaviorStateId,'returning');a.equal(f.ai.targetEntityId,null);a.deepEqual(f.world,before.world);a.deepEqual(f.resources,before.resources);
  const waiting=g.evaluateActorAIBehaviorTransition(f.ai,f.entities,g.createActorAIBehaviorObservation(f.ai,[]),behavior);a.equal(waiting.status,'unchanged');a.equal(waiting.state.behaviorStateId,'returning');
  const returning=[{ruleId:'home',behaviorStateId:'returning',actionKey:'home',actionKind:'return_home',targetMode:'none'}];f.clock.time=1600;
  const proposed=propose(f,'return',returning,[{actionKey:'home',status:'available',reasonId:null}]);a.equal(proposed.selection.actionKind,'return_home');a.equal(f.dispatches,0);a.equal(f.world.position,7);
  f.clock.time=2000;const arrival=g.evaluateActorAIBehaviorTransition(f.ai,f.entities,g.createActorAIBehaviorObservation(f.ai,['return_completed']),behavior);a.equal(arrival.state.behaviorStateId,'guarding');a.equal(arrival.triggerId,'return_completed');a.equal(f.world.position,7);
  const again=reset(f,'disengage',null);a.deepEqual(again.state,f.ai);a.notEqual(again.state,f.ai);
 }
 const f=fixture(),unmatched=disengage(f,'unknown');a.equal(unmatched.status,'unchanged');a.equal(f.ai.behaviorStateId,'engaged');a.equal(f.ai.targetEntityId,null);
 const manual=fixture('player','manual'),old=owners(manual);a.equal(disengage(manual,'leash_exceeded'),null);a.deepEqual(owners(manual),old);
 const dying=fixture(),ai=dying.ai;a.equal(disengage(dying,'leash_exceeded',behavior,die),null);a.equal(dying.ai,ai);a.equal(dying.ai.targetEntityId,'Target');
 const malformed=fixture(),snap=owners(malformed);a.throws(()=>disengage(malformed,'leash_exceeded',behavior,x=>{x.entities=g.createEntityCollection();}),TypeError);a.deepEqual(owners(malformed),snap);
 console.log('ACTOR_AI_LIFECYCLE_DISENGAGE_PASS');
});
contract('lifecycle L30-L43: exact Foundation cadence samples, monotonicity, late turn and representability',a=>{
 const f=fixture();a.equal(f.clock.samples,1);a.deepEqual(f.timing,{actorId:'Actor',observedAtMs:1000,nextEligibleAtMs:1000});
 const before=owners(f),one=timing(f);a.equal(f.clock.samples,2);a.deepEqual(one,{status:'ready',reason:'none',state:{actorId:'Actor',observedAtMs:1000,nextEligibleAtMs:1500}});a.deepEqual(owners(f),before);f.timing=one.state;
 for(const [time,status,reason,next] of [[1000,'not_due','interval_active',null],[1200,'not_due','interval_active',null],[999,'blocked','time_regressed',null],[1500,'ready','none',2000],[2300,'ready','none',2800]]){
  f.clock.time=time;const samples=f.clock.samples,result=timing(f);a.equal(f.clock.samples,samples+1);a.equal(result.status,status);a.equal(result.reason,reason);a.deepEqual(result.state,next===null?null:{actorId:'Actor',observedAtMs:time,nextEligibleAtMs:next});if(result.state)f.timing=result.state;frozen(a,result);
 }
 const zero=fixture();a.deepEqual(timing(zero,zero.timing,0).state,zero.timing);a.equal(timing(zero,zero.timing,0).status,'ready');a.equal(zero.dispatches,0);
 for(const time of [Number.MAX_VALUE,2**54]){const x=fixture();x.clock.time=time;const samples=x.clock.samples;const result=timing(x,x.timing,1);a.deepEqual(result,{status:'blocked',reason:'time_unrepresentable',state:null});a.equal(x.clock.samples,samples+1);}
 const x=fixture(),input={...x.timing},r=timing(x,input);input.actorId='changed';input.nextEligibleAtMs=99;a.equal(r.state.actorId,'Actor');a.equal(r.state.nextEligibleAtMs,1500);frozen(a,r);
 const old=[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval];try{Date.now=Math.random=globalThis.setTimeout=globalThis.setInterval=()=>{throw Error('hidden provider');};a.equal(timing(x).status,'ready');a.equal(g.createActorAIDecisionTimingState(x.ai,x.context).observedAtMs,1000);}finally{[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval]=old;}
 console.log('ACTOR_AI_LIFECYCLE_TIMING_PASS');
});
contract('lifecycle L41/L49/L54: L4 timing/state baseline prevents duplicate or canceled turn commits',a=>{
 const f=fixture(),baseline=f.timing,first={baseline,result:timing(f)},second={baseline,result:timing(f)};
 a.equal(first.result.status,'ready');a.equal(second.result.status,'ready');a.equal(publishTiming(f,first),true);a.equal(publishTiming(f,second),false);a.equal(f.timing.nextEligibleAtMs,1500);
 const x=fixture('player'),b=propose(x),cursor=x.timing;x.clock.time=1001;x.ai={...x.ai,controller:'manual'};x.clock.time=1002;
 const result=dispatch(x,b,'canceled');a.equal(result.reasonId,'manual_control');a.equal(x.timing,cursor);a.equal(x.dispatches,0);a.equal(x.targetResources.current.health,100);
 const y=fixture(),b1=propose(y,'D1'),b2=propose(y,'D2');dispatch(y,b1,'first');a.throws(()=>dispatch(y,b2,'second'),/stale/);const before=owners(y);a.throws(()=>dispatch(y,b1,'first'),/duplicate/);a.deepEqual(owners(y),before);a.equal(y.dispatches,1);a.equal(y.feedback.length,1);
 console.log('ACTOR_AI_LIFECYCLE_FRESHNESS_PASS');
});
contract('lifecycle L44-L47/L53-L55: actual Combat/Skill terminal continuity, no automatic retry/refund or fabricated Wait',a=>{
 for(const [mode,hp,damage] of [['landed',80,20],['dodge',100,0],['zero',100,0]]){
  const f=fixture(),b=propose(f);const result=dispatch(f,b,'attempt',mode);a.equal(result.feedback.status,'completed');a.equal(result.result.appliedDamage,damage);a.equal(f.targetResources.current.health,hp);a.equal(propose(f,'too-soon'),null);a.equal(f.dispatches,1);
  a.throws(()=>g.validateActorAIActionExecutionFeedback(b.selection,{...result.feedback,decisionId:'wrong'}),TypeError);
 }
 const f=fixture(),b=propose(f),definition=g.createSkillDefinition({skillId:'spell'}),instance=g.createSkillInstance(definition,f.actor,{instanceId:'spell-1'});
 const admission=g.evaluateSkillActivationAdmission(definition,instance,'Actor',f.entities,f.life,{owned:true,eligible:true,rank:{mode:'required',currentRank:2,minimumRank:2}});
 const costs={costs:[{resourceId:'mana',amount:25}],bounds:[{resourceId:'mana',minimum:0,maximum:100,currentAboveMaximum:'reject'}]};
 const selection=g.evaluateActorAIActionSelection(f.ai,f.entities,g.createActorAIDecisionContext(f.ai,'skill-decision'),{profileId:'P',rules:[{...actionRules[0],actionKey:'magic',actionKind:'skill'}]},g.createActorAIActionObservation(g.createActorAIDecisionContext(f.ai,'skill-decision'),[{actionKey:'magic',status:'available',reasonId:null}]));
 const activation=g.activateSkill({instance,admission,resourceState:f.resources,resourceCosts:costs,cooldownState:g.createSkillCooldownState(instance),cooldownConfig:{baseDurationMs:1000,effectiveCdr:.25},executionContext:f.context,intent:{attemptId:'skill-attempt',dispatch:{kind:'caller'}},executionPreflight:{kind:'caller',status:'accepted'}});
 a.equal(activation.status,'accepted');a.deepEqual(f.feedback,[]);a.equal(f.dispatches,0);
 f.resources=activation.resources;f.cooldown=activation.cooldown;f.timing=b.due.state;
 const outcome=(()=>{f.dispatches++;try{throw Error('delivery failed');}catch{return g.reportSkillExecutionOutcome(activation.request,{status:'failed'});}})();
 const terminal=feedback(f,{selection},'skill-attempt','execution',outcome.status,'delivery_failed');
 a.equal(terminal.status,'failed');a.equal(f.dispatches,1);a.equal(f.resources.current.mana,75);a.equal(f.cooldown.readyAtMs,1750);a.equal(f.targetResources.current.health,100);a.equal(propose(f,'immediate'),null);
 f.clock.time=1500;const fresh=propose(f,'new-decision');a.equal(fresh.selection.decision.intent.actionKey,'attack');a.equal(f.dispatches,1);a.equal(dispatch(f,fresh,'new-attempt').feedback.status,'completed');a.equal(f.resources.current.mana,75);a.equal(f.cooldown.readyAtMs,1750);
 const no=fixture(),none=propose(no,'none',[],[]);a.equal(none.selection.status,'no_action');a.equal(no.dispatches,0);a.deepEqual(no.feedback,[]);a.throws(()=>dispatch(no,none,'fake'),TypeError);
 const wait=propose(no,'wait',[{...actionRules[0],actionKind:'wait',targetMode:'none'}]);a.equal(wait.selection.actionKind,'wait');a.equal(no.dispatches,0);a.deepEqual(no.feedback,[]);
 console.log('ACTOR_AI_LIFECYCLE_CONTINUITY_PASS');
});
contract('lifecycle L09/L29: dead AI leaves canonical periodic Effects, resources and opaque World untouched',a=>{
 const f=fixture();let lifecycle=g.createEffectLifecycleState(g.createEffectState(f.actor),f.context),periodic=g.createEffectPeriodicState(lifecycle);
 for(const [i,kind] of ['dot','hot'].entries()){
  const definition=g.createEffectDefinition({effectId:kind}),instance=g.createEffectInstance(definition,f.actor,{effectInstanceId:kind,source:{kind:'system',sourceId:'S',sourceKey:String(i)}});
  const applied=g.applyEffect(definition,{instance},lifecycle.effectState,f.entities,f.life,{sourceEligible:true,targetEligible:true,allowedTargetLifeStatuses:['alive']});
  const next=g.startEffectLifetime(lifecycle,applied,{mode:'timed',durationMs:5000},f.context);
  const result=g.applyEffectPeriodicTransition(periodic,lifecycle,next,{mode:'periodic',kind,intervalMs:1000,resourceId:'health'});a.equal(result.status,'applied');lifecycle=next.state;periodic=result.state;
 }
 die(f);const before=structuredClone({lifecycle,periodic,owners:owners(f)});a.equal(gate(f).reason,'actor_dead');a.equal(timing(f).reason,'actor_dead');a.equal(reset(f,'respawn').state,null);
 a.deepEqual({lifecycle,periodic,owners:owners(f)},before);a.equal(lifecycle.effectState.instances.length,2);a.equal(periodic.entries.length,2);a.equal(f.world.position,7);
 console.log('ACTOR_AI_LIFECYCLE_OWNERS_PASS');
});
contract('lifecycle L16-L18/L36/L39/L47: closed own-data validation precedes dead/manual no-op, no getters',a=>{
 const f=fixture();let reads=0;
 const checks=[
  [f.ai,x=>g.evaluateActorAILifeGate(x,f.entities,f.life)],
  [f.life,x=>g.evaluateActorAILifeGate(f.ai,f.entities,x)],
  [f.timing,x=>g.evaluateActorAIDecisionTiming(f.ai,f.entities,f.life,x,{intervalMs:500},f.context)],
  [{intervalMs:500},x=>g.evaluateActorAIDecisionTiming(f.ai,f.entities,f.life,f.timing,x,f.context)],
  [{reason:'session_reset',resetBehaviorStateId:'idle'},x=>g.evaluateActorAIReset(f.ai,f.entities,f.life,behavior,x)],
  [behavior,x=>g.evaluateActorAIReset(f.ai,f.entities,f.life,x,{reason:'session_reset',resetBehaviorStateId:'idle'})]];
 for(const [valid,invoke] of checks){
  for(const bad of [null,undefined,[],1,{...valid,extra:1},{...valid,[Symbol()]:1},Object.assign(Object.create({extra:1}),valid)])a.throws(()=>invoke(bad),TypeError);
  for(const key of Object.keys(valid)){
   const missing={...valid};delete missing[key];const accessor={...valid};Object.defineProperty(accessor,key,{get(){reads++;return valid[key];}});
   a.throws(()=>invoke(missing),TypeError);a.throws(()=>invoke(accessor),TypeError);a.throws(()=>invoke(Object.assign(Object.create({[key]:valid[key]}),missing)),TypeError);
  }
  a.ok(invoke(Object.assign(Object.create(null),valid)));
 }
 for(const controller of ['ai','manual'])for(const status of ['alive','dead']){
  f.ai={...f.ai,controller};f.life=g.createEntityLifeState(f.actor,{status});const count=f.clock.samples;
  for(const intervalMs of [-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1,'500',null])a.throws(()=>timing(f,f.timing,intervalMs),TypeError);
  for(const cursor of [{...f.timing,actorId:'Other'},{...f.timing,observedAtMs:-1},{...f.timing,nextEligibleAtMs:999},{...f.timing,nextEligibleAtMs:Infinity}])a.throws(()=>timing(f,cursor),TypeError);
  for(const [reason,destination] of [['unknown','idle'],['respawn',null],['session_reset','unknown'],['disengage','idle']])a.throws(()=>reset(f,reason,destination),TypeError);
  a.throws(()=>reset(f,'respawn','idle',{...behavior,profileId:'wrong'}),TypeError);
  a.throws(()=>g.evaluateActorAIReset(f.ai,f.entities,{...f.life,entityId:'wrong'},behavior,{reason:'respawn',resetBehaviorStateId:'idle'}),TypeError);
  a.equal(f.clock.samples,count);
 }
 a.equal(reads,0);a.throws(()=>g.createActorAIDecisionTimingState(f.ai,{}),TypeError);
 const x=fixture();for(const value of [-1,NaN,Infinity]){x.clock.time=value;a.throws(()=>timing(x),TypeError);a.throws(()=>g.createActorAIDecisionTimingState(x.ai,x.context),TypeError);}
 console.log('ACTOR_AI_LIFECYCLE_VALIDATION_PASS');
});
contract('lifecycle L28: one generic flow across Player/Monster/NPC/Pet/Summon/Companion/custom, immutable snapshots',a=>{
 for(const kind of ['player','monster','npc','pet','summon','companion','caller-custom']){
  const f=fixture(kind),original=owners(f);a.equal(gate(f).status,'allowed');a.equal(timing(f).status,'ready');a.deepEqual(owners(f),original);
  const result=disengage(f,'leash_exceeded');a.equal(result.state.behaviorStateId,'returning');a.equal(result.state.targetEntityId,null);a.equal(result.state.actorId,'Actor');a.equal(result.state.profileId,'P');frozen(a,result);
  const captured=reset(f,'session_reset','guarding');a.equal(captured.state.controller,'ai');a.equal(captured.state.behaviorStateId,'guarding');a.equal(f.actor.kind,kind);a.equal(f.dispatches,0);
 }
 console.log('ACTOR_AI_LIFECYCLE_ACTORS_PASS');
});
contract('lifecycle L52: independent literal replay, detached sessions with no wall time/random/timers',a=>{
 function replay(){const f=fixture(),trace=[];const bound=propose(f);trace.push([1000,bound.due.state.nextEligibleAtMs,bound.selection.status]);const result=dispatch(f,bound,'A');trace.push([1000,result.feedback.status,f.targetResources.current.health]);
 f.clock.time=1100;die(f);trace.push([1100,gate(f).reason]);f.clock.time=2000;revive(f);trace.push([2000,f.enabled,reset(f,'respawn').state.targetEntityId]);
 f.ai=reset(f,'respawn').state;f.timing=g.createActorAIDecisionTimingState(f.ai,f.context);f.enabled=true;trace.push([2000,f.ai.behaviorStateId,f.timing.nextEligibleAtMs]);
 a.deepEqual(trace,[[1000,1500,'selected'],[1000,'completed',80],[1100,'actor_dead'],[2000,false,null],[2000,'idle',2000]]);return {trace,ai:f.ai,timing:f.timing};}
 const old=[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval];let first,second;
 try{Date.now=Math.random=globalThis.setTimeout=globalThis.setInterval=()=>{throw Error('hidden provider');};first=replay();second=replay();}finally{[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval]=old;}
 a.deepEqual(first,second);a.notEqual(first.ai,second.ai);a.notEqual(first.timing,second.timing);frozen(a,first.ai);frozen(a,first.timing);
 console.log('ACTOR_AI_LIFECYCLE_REPLAY_PASS');
});
