import assert from 'node:assert/strict';
import test from 'node:test';
import * as g from '@rpg/gameplay';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

function contract(ids, name, run) {
  test(name, () => {
    let assertions = 0;
    const checked = new Proxy(assert, {get(target, key) {return (...args) => {assertions++; return Reflect.get(target, key)(...args);};}});
    run(checked); assert.ok(assertions > 0, 'Closure contract requires actual assertions'); for(const id of ids.split(' '))console.log('ACTOR_AI_CLOSURE_'+id+'_PASS');
  });
}
const rules = [
  {ruleId:'magic',behaviorStateId:'engaged',actionKey:'magic',actionKind:'skill',targetMode:'current_target'},
  {ruleId:'attack',behaviorStateId:'engaged',actionKey:'attack',actionKind:'basic_attack',targetMode:'current_target'},
  {ruleId:'wait',behaviorStateId:'engaged',actionKey:'wait',actionKind:'wait',targetMode:'none'},
];
const facts = (...keys) => keys.map(actionKey => ({actionKey,status:'available',reasonId:null}));
const unavailable = actionKey => ({actionKey,status:'unavailable',reasonId:'caller-preflight'});
const targetPolicy = relation => ({relation,allowedRelations:['enemy'],allowedLifeStatuses:['alive']});
const healthPolicy = {resourceId:'health',minimum:0,maximum:100,currentAboveMaximum:'reject'};
const costs = {costs:[{resourceId:'mana',amount:25}],bounds:[{resourceId:'mana',minimum:0,maximum:100,currentAboveMaximum:'reject'}]};
function numerical(mode = 'landed') {
  return {hit:{dodgeChance:mode === 'dodge' ? .5 : 0,eligible:true,rule:{enabled:true,bounds:{min:0,max:1}}},
    critical:{chance:0,bonus:.5,eligible:false,rule:{enabled:true,bounds:{min:0,max:1}}},
    damage:{base:mode === 'zero' ? 0 : 20,rank:1,perRank:0,scaling:[],flat:{definition:0,additional:0,resolved:0},bonuses:[]},
    mitigation:{ruleKey:'none',rating:0,rule:{enabled:false,bounds:{min:0,max:1},levelScalingEnabled:false}}};
}
function baseFixture(kind = 'monster',actorId='Actor') {
  const actor=g.createEntity({id:actorId,kind}), target=g.createEntity({id:'Target',kind:'player'});
  const clock={time:1000,now(){return this.time;}}, calls={random:0}, context=g.createExecutionContext({clock,
    random:{next(){calls.random++; return .2;}}});
  const definition=g.createSkillDefinition({skillId:'spell'}), instance=g.createSkillInstance(definition,actor,{instanceId:'instance-1'});
  const lifecycle=g.createEffectLifecycleState(g.createEffectState(actor),context);
  const f={actor,target,clock,calls,context,definition,instance,
    entities:g.addEntity(g.addEntity(g.createEntityCollection(),actor),target),
    life:g.createEntityLifeState(actor,{status:'alive'}),targetLife:g.createEntityLifeState(target,{status:'alive'}),
    resources:g.createEntityResourceState(actor,{mana:{minimum:0,maximum:100,current:100}}),
    targetResources:g.createEntityResourceState(target,{health:{minimum:0,maximum:100,current:100}}),
    cooldown:g.createSkillCooldownState(instance),lifecycle,status:g.createEffectStatusState(lifecycle),
    ai:{...g.createActorAIState(actor,{profileId:'P'},{controller:'ai',behaviorStateId:'engaged'}),targetEntityId:target.id},
    bindings:{magic:{actionKind:'skill',instance},attack:{actionKind:'basic_attack'},wait:{actionKind:'wait'}},
    currentDecision:null,revision:0,attempts:new Set(),decisions:new Set(),events:[],feedback:[],supportCalls:[],dispatches:0};
  return f;
}
function select(f, decisionId='decision-1', configured=rules, availability=facts('attack')) {
  const context=g.createActorAIDecisionContext(f.ai,decisionId);
  const selection=g.evaluateActorAIActionSelection(f.ai,f.entities,context,{profileId:f.profile.profileId,rules:configured},g.createActorAIActionObservation(context,availability));
  f.currentDecision=decisionId;
  return {selection,revision:f.revision,stateToken:JSON.stringify(f.ai),timing:f.timing,life:f.life,due:f.due};
}
function terminal(f, selected, attemptId, phase, status, reasonId) {
  if(f.feedback.some(x=>x.attemptId===attemptId))throw new TypeError('L4 duplicate feedback');
  if(phase==='execution' && f.receipts.get(attemptId)!==status)throw new TypeError('L4 outcome provenance');
  const result=g.validateActorAIActionExecutionFeedback(selected,{...selected.decision.intent,attemptId,phase,status,reasonId});
  f.feedback.push(result); f.events.push('feedback:'+status); return result;
}
function combatPreflight(f, intent, actionId, eligible=true, relation='enemy') {
  const context=g.createCombatActionContext({actionId,actionType:'explicit-melee',sourceEntityId:intent.actorId,
    target:{kind:'entity',entityId:intent.targetEntityId}});
  f.events.push('combat_admission');
  const admission=g.evaluateCombatActionAdmission(context,f.entities,f.life,{eligible});
  if(admission.status !== 'admitted') return {reason:admission.reason};
  f.events.push('target');
  const validation=g.evaluateCombatTargetValidation(admission,f.entities,f.targetLife,targetPolicy(relation));
  if(validation.status !== 'accepted') return {reason:validation.reason};
  return {admission,validation};
}
function combatDispatch(f, checked, mode) {
  f.events.push('resolve');
  const attack=g.resolveCombatAttack(checked.admission,checked.validation,numerical(mode),f.context);
  f.events.push('damage');
  const application=g.applyCombatAttackDamage(attack,f.targetResources,f.targetLife,healthPolicy);
  if(application.resourceResult) f.targetResources=application.resourceResult.state;
  if(application.lifeResult) f.targetLife=application.lifeResult.state;
  return {attack,application};
}
// Deliberately test-local L4 composition. No production executor or retry loop.
function execute(f, bound, attemptId, options={}) {
  if(!bound)throw new TypeError('L4 missing turn');
  const selected=bound.selection;
  const intent=selected.decision.intent;
  if(!intent) throw new TypeError('L4 requires selected proposal');
  // Structural capture only, never published as a domain outcome. Validate before any candidate/commit.
  g.validateActorAIActionExecutionFeedback(selected,{...intent,attemptId,phase:'admission',status:'rejected',reasonId:'shape-check'});
  const binding=f.bindings[intent.actionKey];
  if(!binding || binding.actionKind !== selected.actionKind || (selected.actionKind === 'skill' && binding.instance !== f.instance)) throw new TypeError('L4 action binding');
  if(f.attempts.has(attemptId) || f.decisions.has(intent.decisionId)) throw new TypeError('L4 duplicate attempt/decision');
  f.attempts.add(attemptId); f.decisions.add(intent.decisionId);
  const rejected=reason=>({feedback:terminal(f,selected,attemptId,'admission','rejected',reason)});
  // Current authority and state, not the old proposal, decide whether dispatch is possible.
  if(f.ai.controller !== 'ai') return rejected('controller_changed');
  const lifeGate=g.evaluateActorAILifeGate(f.ai,f.entities,f.life);
  if(lifeGate.status!=='allowed')return rejected(lifeGate.reason);
  if(bound.timing!==f.timing || bound.life!==f.life)return rejected('stale_turn');
  if(intent.actorId !== f.actor.id || f.currentDecision !== intent.decisionId || bound.revision !== f.revision
    || bound.stateToken !== JSON.stringify(f.ai)) return rejected('stale_decision');
  if(selected.actionKind === 'skill' && intent.targetEntityId === f.actor.id) {
    if(!g.getEntity(f.entities,f.actor.id)) return rejected('actor_not_found');
  } else if(intent.targetEntityId !== f.ai.targetEntityId && intent.targetEntityId !== null) return rejected('stale_target');
  f.events.push('effect');
  const restriction=g.evaluateEffectRestrictionGate(f.lifecycle,f.status,{blockedByRestrictionIds:
    selected.actionKind === 'skill' ? ['deny-all','deny-magic'] : ['deny-all']});
  if(restriction.entityId !== intent.actorId) throw new TypeError('L4 restriction binding');
  if(restriction.status === 'blocked') return rejected('effect_blocked');
  if(selected.actionKind === 'basic_attack') {
    const checked=combatPreflight(f,intent,'combat-'+attemptId,options.eligible ?? true,options.relation ?? 'enemy');
    if(checked.reason) return rejected(checked.reason);
    const result=combatDispatch(f,checked,options.mode);
    f.timing=bound.due.state;f.receipts.set(attemptId,'completed');f.dispatches++;
    return {...result,feedback:terminal(f,selected,attemptId,'execution','completed',null)};
  }
  if(selected.actionKind === 'skill') {
    f.events.push('skill_admission');
    const admission=g.evaluateSkillActivationAdmission(f.definition,f.instance,intent.actorId,f.entities,f.life,
      {owned:options.owned ?? true,eligible:options.eligible ?? true,rank:{mode:'required',currentRank:options.rank ?? 2,minimumRank:2}});
    if(admission.status !== 'admitted') return rejected(admission.reason);
    f.events.push('costs');
    const payment=g.evaluateSkillResourceCosts(admission,f.resources,costs);
    if(payment.status !== 'payable') return rejected(payment.reason);
    f.events.push('cooldown');
    const ready=g.evaluateSkillCooldownReady(f.instance,f.cooldown,f.context);
    if(ready.status !== 'ready') return rejected(ready.reason);
    const self=intent.targetEntityId === f.actor.id;
    let checked;
    if(!self) {
      checked=combatPreflight(f,intent,'combat-'+attemptId,true,options.relation ?? 'enemy');
      if(checked.reason) return rejected(checked.reason);
    }
    const dispatch=self ? {kind:'caller'} : {kind:'combat',actionId:'combat-'+attemptId,actionType:'explicit-melee',targetEntityId:intent.targetEntityId};
    f.events.push('activation');
    const activation=g.activateSkill({instance:f.instance,admission,resourceState:f.resources,resourceCosts:costs,
      cooldownState:f.cooldown,cooldownConfig:{baseDurationMs:1000,effectiveCdr:.25},executionContext:f.context,
      intent:{attemptId,dispatch},executionPreflight:{kind:dispatch.kind,status:'accepted'}});
    if(activation.status !== 'accepted') return rejected(activation.reason);
    if(options.beforeCommit) options.beforeCommit(f);
    if(bound.revision !== f.revision || f.ai.controller !== 'ai' || bound.stateToken !== JSON.stringify(f.ai)) return rejected('stale_before_commit');
    // Accepted candidates become authoritative only here, through caller assignment.
    f.resources=activation.resources; f.cooldown=activation.cooldown; f.timing=bound.due.state;
    if(options.pending) return {activation,feedback:null};
    let result, report;
    try {
      f.dispatches++;
      if(options.failDispatch) throw new Error('caller dispatch failed');
      if(self) {f.supportCalls.push({actorId:intent.actorId,targetEntityId:intent.targetEntityId,attemptId});}
      else result=combatDispatch(f,checked,options.mode);
      report={status:'completed'};
    } catch(error) {if(error.message !== 'caller dispatch failed') throw error; report={status:'failed'};}
    const outcome=g.reportSkillExecutionOutcome(activation.request,report);
    f.receipts.set(attemptId,outcome.status);
    const feedback=terminal(f,selected,attemptId,'execution',outcome.status,outcome.status === 'failed' ? 'caller_dispatch_failed' : null);
    return {activation,outcome,feedback,...result};
  }
  // Explicit fixture receipt only; this does not implement World or movement.
  if(selected.actionKind!=='wait' && !f.world.accepted) return rejected('world_unavailable');
  f.timing=bound.due.state;f.receipts.set(attemptId,options.failDispatch?'failed':'completed');
  f.dispatches++; f.events.push('caller:'+selected.actionKind);
  return {feedback:terminal(f,selected,attemptId,'execution',options.failDispatch ? 'failed':'completed',options.failDispatch ? 'caller_failed':null)};
}
function addRestriction(f,instanceId,restrictionIds,durationMs=500) {
  const definition=g.createEffectDefinition({effectId:'opaque-effect'});
  const instance=g.createEffectInstance(definition,f.actor,{effectInstanceId:instanceId,source:{kind:'system',sourceId:'zone',sourceKey:instanceId}});
  const application=g.applyEffect(definition,{instance},f.lifecycle.effectState,f.entities,f.life,
    {sourceEligible:true,targetEligible:true,allowedTargetLifeStatuses:['alive']});
  const transition=g.startEffectLifetime(f.lifecycle,application,{mode:'timed',durationMs},f.context);
  const status=g.applyEffectStatusTransition(f.status,f.lifecycle,transition,{statusIds:[],restrictionIds});
  f.lifecycle=transition.state; f.status=status.state;
}
function owners(f) {return structuredClone({ai:f.ai,resources:f.resources,cooldown:f.cooldown,target:f.targetResources,
  life:f.life,targetLife:f.targetLife,lifecycle:f.lifecycle,status:f.status});}
function freezeCheck(assert,value) {if(value && typeof value === 'object'){assert.ok(Object.isFrozen(value));Object.values(value).forEach(v=>freezeCheck(assert,v));}}

// L3 examples only. Every fixture gets independent policy arrays unless explicitly shared.
function profile(mode='aggressive') {
 const start=mode==='guard'?'guarding':'idle';
 const states=mode==='passive'?['idle']:['idle','guarding','engaged','returning'];
 const rule=(ruleId,fromStateId,triggerId,toStateId,targetRequirement)=>({ruleId,fromStateId,triggerId,toStateId,targetRequirement});
 return {profileId:mode,start,behavior:{profileId:mode,stateIds:states,rules:mode==='passive'?[]:[
  rule('engage',start,mode==='guard'?'provoked':'target_acquired','engaged','present'),
  rule('loss','engaged','target_lost','returning','absent'),rule('leash','engaged','leash_exceeded','returning','absent'),
  rule('arrival','returning','return_completed',start,'absent')]},actions:[
  ...(mode==='passive'?[]:rules.slice(0,2)),
  ...(mode==='passive'?[]:[{ruleId:'approach',behaviorStateId:'engaged',actionKey:'approach',actionKind:'approach_target',targetMode:'current_target'},
   {ruleId:'return',behaviorStateId:'returning',actionKey:'home',actionKind:'return_home',targetMode:'none'}]),
  {ruleId:'idle-wait',behaviorStateId:start,actionKey:'wait',actionKind:'wait',targetMode:'none'}]};
}
function fixture(kind='monster',p=profile(),actorId='Actor') {
 const f=baseFixture(kind,actorId);f.profile=p;f.ai=g.createActorAIState(f.actor,{profileId:p.profileId},{controller:'ai',behaviorStateId:p.start});
 f.resources=g.createEntityResourceState(f.actor,{health:{minimum:0,maximum:100,current:100},mana:{minimum:0,maximum:100,current:100}});
 f.timing=g.createActorAIDecisionTimingState(f.ai,f.context);f.enabled=true;f.receipts=new Map();
 f.world={accepted:false,arrived:false,position:7};
 f.bindings.approach={actionKind:'approach_target'};f.bindings.home={actionKind:'return_home'};
 return f;
}
const perceptionPolicy={allowedRelationIds:['enemy'],allowedLifeStatuses:['alive'],requireVisible:true,requireInRange:true,requireReachable:true,allowSelf:false};
function observe(f,acquire=true,trigger='target_acquired',candidates=[{entityId:'Target',lifeStatus:f.targetLife.status,relationId:'enemy',visible:true,inRange:true,reachable:true}]) {
 const capture=g.createActorAIPerceptionSnapshot(f.ai,{observedAtMs:f.clock.time,candidates});
 const assessment=g.evaluateActorAIPerception(f.ai,f.entities,capture,perceptionPolicy);
 let target=null;
 if(acquire){target=g.evaluateActorAITargetSelection(f.ai,f.entities,assessment,{retention:'prefer_priority',preferredTargetIds:['Target']});if(target.state)f.ai=target.state;}
 const next=g.evaluateActorAIBehaviorTransition(f.ai,f.entities,g.createActorAIBehaviorObservation(f.ai,[trigger]),f.profile.behavior);
 f.ai=next.state;return {capture,assessment,target,next};
}
function propose(f,decisionId='D',configured=f.profile.actions,availability=facts('attack')) {
 if(!f.enabled || g.evaluateActorAILifeGate(f.ai,f.entities,f.life).status!=='allowed')return null;
 f.due=g.evaluateActorAIDecisionTiming(f.ai,f.entities,f.life,f.timing,{intervalMs:500},f.context);
 if(f.due.status!=='ready')return null;
 return select(f,decisionId,configured,availability);
}
function engaged(kind='monster'){const f=fixture(kind);observe(f);return f;}
function die(f){f.resources=g.transitionEntityResource(f.resources,'health',{operation:'decrease',amount:100,maximum:100,rule:{minimum:0,currentAboveMaximum:'reject',allowIncreaseFromMinimum:true}}).state;f.life=g.resolveEntityDefeat(f.life,f.resources,{resourceId:'health',minimum:0,maximum:100}).state;f.enabled=false;}
function revive(f){f.resources=g.transitionEntityResource(f.resources,'health',{operation:'increase',amount:40,maximum:100,rule:{minimum:0,currentAboveMaximum:'reject',allowIncreaseFromMinimum:true}}).state;f.life=g.reviveEntity(f.life,f.resources,{resourceId:'health',minimum:0,maximum:100}).state;}
function clearAndReturn(f,trigger='leash_exceeded') {
 const baseline=f.ai,clear=g.evaluateActorAIReset(f.ai,f.entities,f.life,f.profile.behavior,{reason:'disengage',resetBehaviorStateId:null});
 if(clear.status!=='applied' || f.ai!==baseline)return null;
 f.ai=clear.state;return observe(f,false,trigger,[]).next;
}
function arrive(f) {if(!f.world.arrived)throw new TypeError('L4 no arrival');return observe(f,false,'return_completed',[]).next;}
function commitCursor(f,staged){if(staged.baseline!==f.timing)return false;f.timing=staged.state;return true;}

contract('E01 E02 E03 E04 E05 E06 E07 E08 E15','closure: complete monster perception through canonical combat/feedback, exact stage ownership',a=>{
 const f=fixture(),before=owners(f),o=observe(f);
 a.deepEqual(o.assessment.eligible.map(x=>x.entityId),['Target']);a.deepEqual(o.assessment.excluded,[]);
 a.equal(o.target.reason,'acquired');a.equal(o.target.state.targetEntityId,'Target');freezeCheck(a,o.target);a.notEqual(f.ai,before.ai);
 a.equal(o.next.status,'transitioned');a.equal(f.ai.behaviorStateId,'engaged');a.equal(f.dispatches,0);
 a.equal(f.targetResources.current.health,100);a.deepEqual(f.resources,before.resources);a.deepEqual(f.lifecycle,before.lifecycle);
 const b=propose(f),snapshot=owners(f);a.equal(b.selection.decision.intent.actionKey,'attack');a.equal(b.selection.decision.intent.decisionId,'D');
 const r=execute(f,b,'A');a.equal(r.attack.outcome,'landed');a.equal(r.application.appliedDamage,20);a.equal(f.targetResources.current.health,80);a.equal(f.targetLife.status,'alive');
 a.deepEqual(r.feedback,{decisionId:'D',actorId:'Actor',actionKey:'attack',targetEntityId:'Target',attemptId:'A',phase:'execution',status:'completed',reasonId:null});
 a.deepEqual(f.events,['effect','combat_admission','target','resolve','damage','feedback:completed']);
 a.deepEqual(f.ai,snapshot.ai);a.deepEqual(f.resources,snapshot.resources);a.deepEqual(f.cooldown,snapshot.cooldown);a.deepEqual(f.lifecycle,snapshot.lifecycle);a.deepEqual(f.status,snapshot.status);
 const invalid={...b.selection.decision.intent,attemptId:'bad',phase:'execution',status:'completed',reasonId:null};
 for(const key of ['actorId','decisionId','actionKey','targetEntityId'])a.throws(()=>g.validateActorAIActionExecutionFeedback(b.selection,{...invalid,[key]:'wrong'}),TypeError);
 a.equal(f.timing.nextEligibleAtMs,1500);a.equal(propose(f,'too-soon'),null);
});
contract('E09 E10 E23 E30 E31','closure: real Skill admission/payment/cooldown/dispatch, pending vs failed, self support',a=>{
 for(const [kind,self,pending,failed] of [['monster',false,false,false],['pet',true,false,false],['player',false,true,false],['player',false,false,true]]){
  const f=engaged(kind),configured=self?[{...rules[0],targetMode:'self'}]:f.profile.actions;
  const b=propose(f,'skill',configured,facts('magic'));a.equal(b.selection.actionKind,'skill');if(self)a.equal(b.selection.decision.intent.targetEntityId,'Actor');
  const r=execute(f,b,'S',{pending,failDispatch:failed});a.equal(r.activation.status,'accepted');a.equal(f.resources.current.mana,75);a.equal(f.cooldown.readyAtMs,1750);
  a.equal(r.activation.request.dispatch.kind,self?'caller':'combat');a.equal(f.targetResources.current.health,!self&&!pending&&!failed?80:100);
  if(pending){a.equal(r.feedback,null);a.deepEqual(f.feedback,[]);a.equal(f.dispatches,0);}
  else{a.equal(r.outcome.status,failed?'failed':'completed');a.equal(r.feedback.status,r.outcome.status);a.equal(f.dispatches,1);}
  if(failed){a.throws(()=>terminal(f,b.selection,'S-forged','execution','completed',null),/provenance/);a.equal(propose(f,'retry'),null);a.equal(f.resources.current.mana,75);a.equal(f.cooldown.readyAtMs,1750);}
 }
});
contract('E09','closure: fresh Skill admission resource and cooldown reject without payment or dispatch',a=>{
 for(const options of [{owned:false},{rank:1},{eligible:false}]){const f=engaged(),b=propose(f,'S',f.profile.actions,facts('magic'));const r=execute(f,b,'S',options);a.equal(r.feedback.status,'rejected');a.equal(f.resources.current.mana,100);a.equal(f.dispatches,0);}
 const f=engaged(),b=propose(f,'poor',f.profile.actions,facts('magic'));f.resources=g.transitionEntityResource(f.resources,'mana',{operation:'decrease',amount:90,maximum:100,rule:{minimum:0,currentAboveMaximum:'reject',allowIncreaseFromMinimum:true}}).state;
 a.equal(execute(f,b,'poor').feedback.status,'rejected');a.equal(f.resources.current.mana,10);a.equal(f.dispatches,0);
 const c=engaged();execute(c,propose(c,'first',c.profile.actions,facts('magic')),'paid');c.clock.time=1500;
 a.equal(execute(c,propose(c,'second',c.profile.actions,facts('magic')),'not-ready').feedback.status,'rejected');a.equal(c.resources.current.mana,75);a.equal(c.dispatches,1);
});
contract('E11 E36','closure: actual Effect status AND canonical gates, fresh restrictions override availability and expire',a=>{
 const f=engaged(),b=propose(f,'magic',f.profile.actions,facts('magic'));addRestriction(f,'silence',['deny-magic']);
 const gate=g.evaluateEffectRestrictionGate(f.lifecycle,f.status,{blockedByRestrictionIds:['deny-magic']});a.equal(gate.status,'blocked');a.equal(gate.matches[0].restrictionId,'deny-magic');
 a.equal(execute(f,b,'blocked').feedback.reasonId,'effect_blocked');a.equal(f.resources.current.mana,100);a.equal(f.dispatches,0);
 a.equal(execute(f,propose(f,'attack'),'allowed').feedback.status,'completed');a.equal(f.targetResources.current.health,80);
 f.clock.time=1500;const t=g.advanceEffectLifecycle(f.lifecycle,f.context);f.status=g.applyEffectStatusTransition(f.status,f.lifecycle,t).state;f.lifecycle=t.state;
 a.equal(g.evaluateEffectRestrictionGate(f.lifecycle,f.status,{blockedByRestrictionIds:['deny-magic']}).status,'allowed');
 a.equal(execute(f,propose(f,'after',f.profile.actions,facts('magic')),'after').outcome.status,'completed');
 const x=engaged(),s=propose(x);addRestriction(x,'stun',['deny-all']);a.equal(execute(x,s,'stunned').feedback.reasonId,'effect_blocked');a.equal(x.targetResources.current.health,100);
 const y=engaged();a.equal(execute(y,propose(y),'ineligible',{eligible:false}).feedback.reasonId,'source_ineligible');a.equal(y.dispatches,0);
});
contract('E12 E13 E18 E19 E40','closure: aggressive loss and Guard provocation/leash/real caller arrival remain separate',a=>{
 for(const mode of ['aggressive','guard']){
  const f=fixture('npc',profile(mode));observe(f,true,'target_acquired');a.equal(f.ai.behaviorStateId,mode==='guard'?'guarding':'engaged');
  if(mode==='guard'){observe(f,true,'provoked');a.equal(f.ai.behaviorStateId,'engaged');a.equal(clearAndReturn(f).status,'transitioned');}
  else{f.targetLife=g.createEntityLifeState(f.target,{status:'dead'});const lost=observe(f,true,'target_lost');a.equal(lost.target.reason,'target_lost');a.equal(lost.target.lossReason,'target_life_not_allowed');}
  a.equal(f.ai.behaviorStateId,'returning');a.equal(f.ai.targetEntityId,null);a.throws(()=>arrive(f),/arrival/);
  a.equal(observe(f,false,'none',[]).next.status,'unchanged');a.equal(f.world.position,7);
  const b=propose(f,'home',f.profile.actions,facts('home'));a.equal(b.selection.actionKind,'return_home');a.equal(execute(f,b,'no-world').feedback.reasonId,'world_unavailable');a.equal(f.world.position,7);
  f.world.accepted=true;const r=execute(f,propose(f,'home-again',f.profile.actions,facts('home')),'world-receipt');a.equal(r.feedback.status,'completed');a.equal(f.ai.behaviorStateId,'returning');
  // Explicit caller-owned movement receipt; no L2 movement/pathfinding implementation.
  f.world.position=0;f.world.arrived=true;a.equal(arrive(f).state.behaviorStateId,mode==='guard'?'guarding':'idle');a.equal(f.world.position,0);
 }
});
contract('E16 E17 E20 E21 E24 E25','closure: L3 Passive/Aggressive/Guard and cross-kind identity/perception/behavior/action',a=>{
 const shared=profile('passive');let prior;
 for(const kind of ['npc','caller-custom']){const f=fixture(kind,shared,'actor-'+kind);observe(f,false);a.equal(f.ai.targetEntityId,null);a.equal(f.ai.behaviorStateId,'idle');a.equal(propose(f,'wait',shared.actions,facts('wait')).selection.actionKind,'wait');a.equal(propose(f,'none',shared.actions,[]).selection.status,'no_action');a.equal(f.dispatches,0);freezeCheck(a,f.ai);if(prior){a.notEqual(f.ai,prior);a.notEqual(f.ai.actorId,prior.actorId);}prior=f.ai;}
 a.equal(Object.isFrozen(shared),false);
 for(const kind of ['player','monster','npc','pet','summon','custom']){const f=engaged(kind);a.equal(f.actor.kind,kind);a.equal(f.ai.actorId,'Actor');a.equal(f.ai.targetEntityId,'Target');a.equal(f.ai.behaviorStateId,'engaged');a.equal(propose(f).selection.actionKind,'basic_attack');die(f);a.equal(propose(f),null);}
 const sameFacts=[];for(const mode of ['passive','aggressive','guard']){const f=fixture('monster',profile(mode));observe(f);sameFacts.push(f.ai.behaviorStateId);}a.deepEqual(sameFacts,['idle','engaged','guarding']);
});
contract('E14 E22 E29 E33 E34 E35','closure: canonical gate races, malformed/stale World and decision timing fail closed',a=>{
 for(const [mutate,reason] of [[f=>{f.ai={...f.ai,controller:'manual'};},'controller_changed'],[die,'actor_dead'],[f=>{f.targetLife=g.createEntityLifeState(f.target,{status:'dead'});},'target_life_not_allowed'],[f=>{f.entities=g.removeEntity(f.entities,'Target');},'target_not_found']]){
  const f=engaged(),b=propose(f);mutate(f);const before=owners(f),cursor=f.timing;rcheck(execute(f,b,'raced'));
  function rcheck(r){a.equal(r.feedback.reasonId,reason);a.equal(r.feedback.status,'rejected');a.equal(f.dispatches,0);a.equal(f.targetResources.current.health,100);a.equal(f.timing,cursor);a.deepEqual(owners(f),before);}
 }
 const f=engaged();execute(f,propose(f),'first');for(const [now,status] of [[1200,'not_due'],[999,'blocked'],[1500,'ready'],[2300,'ready']]){f.clock.time=now;const r=g.evaluateActorAIDecisionTiming(f.ai,f.entities,f.life,f.timing,{intervalMs:500},f.context);a.equal(r.status,status);if(now===999)a.equal(r.reason,'time_regressed');if(now===2300)a.equal(r.state.nextEligibleAtMs,2800);}
 const d=engaged();die(d);a.equal(propose(d),null);const m=engaged();m.ai={...m.ai,controller:'manual'};a.equal(propose(m),null);
 const x=engaged();x.clock.time=2**54;a.equal(g.evaluateActorAIDecisionTiming(x.ai,x.entities,x.life,x.timing,{intervalMs:1},x.context).reason,'time_unrepresentable');
 a.equal(g.evaluateActorAIDecisionTiming(m.ai,m.entities,m.life,m.timing,{intervalMs:0},m.context).reason,'manual_control');
});
contract('E28 E37 E38 E41','closure: stable target/action/FSM priority and local attempt/feedback/timing ledgers',a=>{
 const f=engaged(),b=propose(f);execute(f,b,'one');const before=owners(f);a.throws(()=>execute(f,b,'one'),/duplicate/);a.throws(()=>terminal(f,b.selection,'one','execution','completed',null),/duplicate/);a.deepEqual(owners(f),before);a.equal(f.dispatches,1);
 const x=engaged(),baseline=x.timing,r1=g.evaluateActorAIDecisionTiming(x.ai,x.entities,x.life,baseline,{intervalMs:500},x.context),r2=g.evaluateActorAIDecisionTiming(x.ai,x.entities,x.life,baseline,{intervalMs:500},x.context);
 a.equal(commitCursor(x,{baseline,state:r1.state}),true);a.equal(commitCursor(x,{baseline,state:r2.state}),false);
 const p=engaged(),both=propose(p,'ordered',p.profile.actions,facts('magic','attack'));a.equal(both.selection.decision.intent.actionKey,'magic');
 const onlyApproach=propose(p,'approach',p.profile.actions,facts('approach'));a.equal(onlyApproach.selection.actionKind,'approach_target');
 const none=propose(p,'none',p.profile.actions,[]);a.equal(none.selection.status,'no_action');a.throws(()=>execute(p,none,'nothing'),TypeError);a.equal(p.dispatches,0);a.deepEqual(p.feedback,[]);
 const z=fixture();z.profile.behavior.rules.splice(1,0,{ruleId:'second',fromStateId:'idle',triggerId:'target_acquired',toStateId:'returning',targetRequirement:'present'});a.equal(observe(z).next.state.behaviorStateId,'engaged');
 const t=fixture();t.entities=g.addEntity(t.entities,{id:'Alpha',kind:'npc'});const facts2=['Target','Alpha'].map(entityId=>({entityId,lifeStatus:'alive',relationId:'enemy',visible:true,inRange:true,reachable:true}));const o=observe(t,false,'none',facts2);a.equal(g.evaluateActorAITargetSelection(t.ai,t.entities,o.assessment,{retention:'prefer_priority',preferredTargetIds:['Alpha','Target']}).selectedTargetEntityId,'Alpha');
});
contract('E39','closure: canonical revival and explicit AI reset/reactivation, no policy defaults',a=>{
 const f=engaged();die(f);a.equal(g.evaluateActorAIReset(f.ai,f.entities,f.life,f.profile.behavior,{reason:'respawn',resetBehaviorStateId:'idle'}).status,'rejected');revive(f);a.equal(f.life.status,'alive');a.equal(f.resources.current.health,40);a.equal(propose(f),null);
 f.ai=g.evaluateActorAIReset(f.ai,f.entities,f.life,f.profile.behavior,{reason:'respawn',resetBehaviorStateId:'idle'}).state;a.equal(f.ai.targetEntityId,null);a.equal(f.ai.controller,'ai');a.equal(f.enabled,false);
 f.timing=g.createActorAIDecisionTimingState(f.ai,f.context);f.enabled=true;observe(f);a.equal(propose(f).selection.actionKind,'basic_attack');
});
contract('E26 E27 E32','closure: independent full semantic replay, explicit changed RNG and literal oracle',a=>{
 function replay(mode='landed'){const f=engaged(),b=propose(f),r=execute(f,b,'A',{mode});const trace=[['Actor','D','A','Target','engaged','attack',r.application.appliedDamage,f.targetResources.current.health,r.feedback.status,1500]];f.clock.time=1500;const next=propose(f,'D2');trace.push([1500,next.due.state.nextEligibleAtMs,f.resources.current.mana,f.cooldown.readyAtMs,f.lifecycle.effectState.instances.length]);return {f,trace};}
 const expected=[['Actor','D','A','Target','engaged','attack',20,80,'completed',1500],[1500,2000,100,null,0]];
 const old=[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval];let x,y;
 try{Date.now=Math.random=globalThis.setTimeout=globalThis.setInterval=()=>{throw Error('hidden provider');};x=replay();y=replay();}finally{[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval]=old;}
 a.deepEqual(x.trace,expected);a.deepEqual(y.trace,expected);for(const key of ['ai','resources','life','targetLife','cooldown','lifecycle','status','profile','context','timing','attempts'])a.notEqual(x.f[key],y.f[key]);a.notEqual(x.f.profile.actions,y.f.profile.actions);a.equal(Object.isFrozen(x.f.profile.actions),false);freezeCheck(a,x.f.ai);freezeCheck(a,x.f.timing);
 const dodge=replay('dodge');a.deepEqual(dodge.trace[0],['Actor','D','A','Target','engaged','attack',0,100,'completed',1500]);a.notDeepEqual(dodge.trace,expected);a.equal(dodge.f.calls.random,1);
 const zero=replay('zero');a.equal(zero.f.targetResources.current.health,100);a.equal(zero.f.feedback[0].status,'completed');
 console.log('ACTOR_AI_CLOSURE_REPLAY_SHA256 '+createHash('sha256').update(JSON.stringify(x.trace)).digest('hex'));
});
contract('E44 E45 E49 E50 E53 E55','closure: optional Entity-only vs full composition, same root/headless data surface',a=>{
 const definitions=JSON.parse(readFileSync(new URL('./actor-ai-modules.json',import.meta.url),'utf8')).modules;
 const registry=definitions.reduce(g.registerModule,g.createModuleRegistry());
 for(const enable of [['entity','actor-ai'],['entity','combat','skill','effect','actor-ai']]){const cfg=g.configureModules(registry,{enable});a.deepEqual(g.composeModules(registry,cfg).moduleIds,enable);a.equal(g.isModuleEnabled(cfg,'combat'),enable.includes('combat'));const f=engaged();a.equal(propose(f).selection.actionKind,'basic_attack');}
 for(const data of [{text:'A'},{position:[2,3]},{position:[2,3,4],projection:'isometric'}]){const before=structuredClone(data),f=engaged();observe(f);a.equal(propose(f).selection.status,'selected');a.deepEqual(data,before);}
 a.deepEqual(Object.keys(g).filter(name=>name.includes('ActorAI')).sort(), ["createActorAIProfileReference","createActorAIState","validateActorAIState","createActorAIDecisionContext","createActorAIActionIntent","validateActorAIDecisionResult","createActorAIPerceptionSnapshot","validateActorAIPerceptionSnapshot","evaluateActorAIPerception","evaluateActorAITargetSelection","createActorAIBehaviorPolicy","createActorAIBehaviorObservation","evaluateActorAIBehaviorTransition","createActorAIActionSelectionPolicy","createActorAIActionObservation","evaluateActorAIActionSelection","validateActorAIActionExecutionFeedback","evaluateActorAILifeGate","evaluateActorAIReset","createActorAIDecisionTimingState","evaluateActorAIDecisionTiming"].sort());a.equal('runAI' in g,false);a.equal('AIManager' in g,false);
});


// Snapshot every caller-owned commit surface, including ledgers and stage counters.
function commitEvidence(f) {
 return structuredClone({owners:owners(f),timing:f.timing,feedback:f.feedback,events:f.events,
  attempts:[...f.attempts],decisions:[...f.decisions],receipts:[...f.receipts],
  dispatches:f.dispatches,support:f.supportCalls,random:f.calls.random,world:f.world});
}
function readyDuplicate(a,duplicate) {
 const f=engaged();
 const first=propose(f,'decision-used',f.profile.actions,facts('magic'));
 a.equal(execute(f,first,'attempt-used').feedback.status,'completed');
 a.equal(f.decisions.has('decision-used'),true);a.equal(f.attempts.has('attempt-used'),true);
 f.clock.time=2000;
 const decisionId=duplicate==='decision'?'decision-used':'decision-new';
 const attemptId=duplicate==='attempt'?'attempt-used':'attempt-new';
 const fresh=propose(f,decisionId,f.profile.actions,facts('magic'));
 a.equal(fresh.selection.decision.intent.decisionId,decisionId);
 a.equal(fresh.selection.decision.intent.actorId,'Actor');a.equal(fresh.selection.decision.intent.targetEntityId,'Target');
 a.equal(fresh.timing,f.timing);a.equal(fresh.life,f.life);a.equal(fresh.stateToken,JSON.stringify(f.ai));
 a.equal(fresh.revision,f.revision);a.equal(f.currentDecision,decisionId);
 a.equal(fresh.due.status,'ready');a.equal(fresh.due.state.nextEligibleAtMs,2500);
 a.equal(fresh.due.state.observedAtMs,2000);a.notEqual(fresh.due.state,f.timing);
 a.equal(f.ai.controller,'ai');a.equal(f.life.status,'alive');a.equal(f.targetLife.status,'alive');
 a.equal(g.evaluateEffectRestrictionGate(f.lifecycle,f.status,{blockedByRestrictionIds:['deny-all','deny-magic']}).status,'allowed');
 const admission=g.evaluateSkillActivationAdmission(f.definition,f.instance,'Actor',f.entities,f.life,
  {owned:true,eligible:true,rank:{mode:'required',currentRank:2,minimumRank:2}});
 a.equal(admission.status,'admitted');a.equal(g.evaluateSkillResourceCosts(admission,f.resources,costs).status,'payable');
 a.equal(g.evaluateSkillCooldownReady(f.instance,f.cooldown,f.context).status,'ready');
 const combat=g.evaluateCombatActionAdmission(g.createCombatActionContext({actionId:'preflight',actionType:'explicit-melee',sourceEntityId:'Actor',target:{kind:'entity',entityId:'Target'}}),f.entities,f.life,{eligible:true});
 a.equal(combat.status,'admitted');a.equal(g.evaluateCombatTargetValidation(combat,f.entities,f.targetLife,targetPolicy('enemy')).status,'accepted');
 a.equal(f.decisions.has(decisionId),duplicate==='decision');a.equal(f.attempts.has(attemptId),duplicate==='attempt');
 a.equal(f.feedback.some(x=>x.attemptId===attemptId),duplicate==='attempt');
 a.deepEqual([f.targetResources.current.health,f.resources.current.mana,f.cooldown.readyAtMs,f.timing.observedAtMs,f.timing.nextEligibleAtMs,f.dispatches,f.feedback.length],
  [80,75,1750,1000,1500,1,1]);
 return {f,fresh,attemptId};
}
contract('E37','closure FIX01 duplicate_attempt: fresh decision rejects at exact ledger before any second commit',a=>{
 const {f,fresh,attemptId}=readyDuplicate(a,'attempt'),before=commitEvidence(f);
 a.throws(()=>execute(f,fresh,attemptId),{name:'TypeError',message:'L4 duplicate attempt/decision'},'FIX01 duplicate_attempt ledger must reject before second commit');
 a.deepEqual(commitEvidence(f),before,'FIX01 duplicate_attempt no payment/damage/cooldown/timing/feedback/stage delta');
 console.log('ACTOR_AI_FIX01_DUPLICATE_ATTEMPT_PASS');
});
contract('E37','closure FIX01 duplicate_decision: fresh ready proposal with unused attempt rejects solely at ledger',a=>{
 const {f,fresh,attemptId}=readyDuplicate(a,'decision'),before=commitEvidence(f);
 a.equal(attemptId,'attempt-new');a.equal(f.feedback.some(x=>x.attemptId===attemptId),false);
 a.throws(()=>execute(f,fresh,attemptId),{name:'TypeError',message:'L4 duplicate attempt/decision'},'FIX01 duplicate_decision ledger must reject before second commit');
 a.deepEqual(commitEvidence(f),before,'FIX01 duplicate_decision no payment/damage/cooldown/timing/feedback/stage delta');
 console.log('ACTOR_AI_FIX01_DUPLICATE_DECISION_PASS');
});
contract('E37 E38','closure FIX01 independent duplicate feedback and stale timing reject at their own boundaries',a=>{
 const f=engaged(),b=propose(f,'feedback');execute(f,b,'feedback-used');const before=commitEvidence(f);
 a.throws(()=>terminal(f,b.selection,'feedback-used','execution','completed',null),{name:'TypeError',message:'L4 duplicate feedback'});
 a.deepEqual(commitEvidence(f),before);
 const x=engaged(),old=propose(x,'timing-only');
 a.equal(commitCursor(x,{baseline:x.timing,state:old.due.state}),true);const cursor=x.timing;
 a.equal(x.attempts.size,0);a.equal(x.decisions.size,0);a.equal(x.feedback.length,0);
 const result=execute(x,old,'unused-timing-attempt');
 a.equal(result.feedback.status,'rejected');a.equal(result.feedback.reasonId,'stale_turn');
 a.equal(x.timing,cursor);a.deepEqual([x.targetResources.current.health,x.resources.current.mana,x.cooldown.readyAtMs,x.dispatches],[100,100,null,0]);
 console.log('ACTOR_AI_FIX01_FEEDBACK_TIMING_PASS');
});
