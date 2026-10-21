import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {evaluateEncounterActionScope} from '@rpg/gameplay';
import * as g from '@rpg/gameplay';

function contract(ids, name, run) {
  test('Encounter integration '+name, () => {
    let assertions = 0;
    const checked = new Proxy(assert, {get(target, key) {return (...args) => {assertions++; return Reflect.get(target, key)(...args);};}});
    run(checked); assert.ok(assertions > 0, 'Encounter integration requires actual assertions'); for(const id of ids.split(' '))console.log('ENCOUNTER_I'+id+'_PASS');
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
function fixture(kind = 'monster') {
  const actor=g.createEntity({id:'monster-001',kind}), target=g.createEntity({id:'player-001',kind:'player'});
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
  f.entities=g.addEntity(g.addEntity(f.entities,{id:'Ally',kind:'custom'}),{id:'Outsider',kind:'npc'});
  const prepared=g.createEncounterState({definitionId:'forest-wolves'},{encounterId:'forest-fight-001',sides:[{sideId:'enemies'},{sideId:'party'}],participants:[{entityId:actor.id,sideId:'enemies'},{entityId:target.id,sideId:'party'},{entityId:'Ally',sideId:'enemies'}]},f.entities);
  f.encounter=g.activateEncounter(prepared,f.entities,{minimumParticipants:1,minimumOccupiedSides:1,requiredOccupiedSideIds:[],allowedLifeStatuses:['alive'],requireWorldReady:true},{encounterId:prepared.encounterId,participants:prepared.participants.map(p=>({entityId:p.entityId,life:{entityId:p.entityId,status:'alive'},worldReady:true}))}).state;
  f.timing=g.createActorAIDecisionTimingState(f.ai,f.context);f.currentSelection=null;
  return f;
}
function propose(f, decisionId='decision-1', configured=rules, availability=facts('attack')) {
  if(g.evaluateActorAILifeGate(f.ai,f.entities,f.life).status !== 'allowed')return null;
  const due=g.evaluateActorAIDecisionTiming(f.ai,f.entities,f.life,f.timing,{intervalMs:500},f.context);if(due.status !== 'ready')return null;
  const context=g.createActorAIDecisionContext(f.ai,decisionId);
  const selection=g.evaluateActorAIActionSelection(f.ai,f.entities,context,{profileId:'P',rules:configured},g.createActorAIActionObservation(context,availability));
  f.currentDecision=decisionId;f.currentSelection=selection;
  return {selection,revision:f.revision,stateToken:JSON.stringify(f.ai),timing:f.timing,due,encounter:f.encounter};
}
function terminal(f, selected, attemptId, phase, status, reasonId) {
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
  const validation=g.evaluateCombatTargetValidation(admission,f.entities,f.targetLife,{...targetPolicy(relation),allowedRelations:f.allowedCombatRelations ?? ['enemy']});
  if(validation.status !== 'accepted') return {reason:validation.reason};
  return {admission,validation};
}
function combatDispatch(f, checked, mode) {
  f.events.push('resolve');
  const attack=g.resolveCombatAttack(checked.admission,checked.validation,numerical(mode),f.context);
  f.events.push('damage');
  const application=g.applyCombatAttackDamage(attack,f.targetResources,f.targetLife,healthPolicy);
  if(freshScope(f,f.executing).status !== 'eligible' || f.executing.revision !== f.revision || g.evaluateActorAILifeGate(f.ai,f.entities,f.life).status !== 'allowed')return {stale:true};
  if(application.resourceResult) f.targetResources=application.resourceResult.state;
  if(application.lifeResult) f.targetLife=application.lifeResult.state;
  return {attack,application};
}
// Deliberately test-local L4 composition. No production executor or retry loop.
function execute(f, bound, attemptId, options={}) {
  const selected=bound.selection;
  if(selected !== f.currentSelection)throw new TypeError('L4 exact current proposal');
  const intent=selected.decision.intent;
  if(!intent) throw new TypeError('L4 requires selected proposal');
  // Structural capture only, never published as a domain outcome. Validate before any candidate/commit.
  g.validateActorAIActionExecutionFeedback(selected,{...intent,attemptId,phase:'admission',status:'rejected',reasonId:'shape-check'});
  const binding=f.bindings[intent.actionKey];
  if(!binding || binding.actionKind !== selected.actionKind || (selected.actionKind === 'skill' && binding.instance !== f.instance)) throw new TypeError('L4 action binding');
  if(f.attempts.has(attemptId) || f.decisions.has(intent.decisionId)) throw new TypeError('L4 duplicate attempt/decision');
  f.attempts.add(attemptId); f.decisions.add(intent.decisionId);
  const rejected=reason=>({feedback:terminal(f,selected,attemptId,'admission','rejected',reason)});
  const scope=freshScope(f,bound);
  if(scope.status !== 'eligible')return rejected(scope.reason);
  const lifeGate=g.evaluateActorAILifeGate(f.ai,f.entities,f.life);if(lifeGate.status !== 'allowed')return rejected(lifeGate.reason);
  const due=g.evaluateActorAIDecisionTiming(f.ai,f.entities,f.life,f.timing,{intervalMs:500},f.context);
  if(due.status !== 'ready' || bound.timing !== f.timing)return rejected('stale_timing');
  // Current authority and state, not the old proposal, decide whether dispatch is possible.
  if(f.ai.controller !== 'ai') return rejected('controller_changed');
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
  f.executing=bound;
  if(selected.actionKind === 'basic_attack') {
    const checked=combatPreflight(f,intent,'combat-'+attemptId,options.eligible ?? true,options.relation ?? 'enemy');
    if(checked.reason) return rejected(checked.reason);
    const result=combatDispatch(f,checked,options.mode);
    if(result.stale)return rejected('stale_before_commit');
    f.timing=bound.due.state;f.dispatches++;
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
    const self=intent.targetEntityId === f.actor.id || binding.dispatchKind === 'caller';
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
    if(freshScope(f,bound).status !== 'eligible' || bound.revision !== f.revision || f.ai.controller !== 'ai' || bound.stateToken !== JSON.stringify(f.ai)) return rejected('stale_before_commit');
    // Accepted candidates become authoritative only here, through caller assignment.
    f.resources=activation.resources; f.cooldown=activation.cooldown;f.timing=bound.due.state;
    if(options.pending) return {activation,feedback:null};
    let result, report;
    try {
      f.dispatches++;
      if(options.failDispatch) throw new Error('caller dispatch failed');
      if(self) {f.supportCalls.push({actorId:intent.actorId,targetEntityId:intent.targetEntityId,attemptId});}
      else {result=combatDispatch(f,checked,options.mode);if(result.stale)throw new Error('caller dispatch failed');}
      report={status:'completed'};
    } catch(error) {if(error.message !== 'caller dispatch failed') throw error; report={status:'failed'};}
    const outcome=g.reportSkillExecutionOutcome(activation.request,report);
    const feedback=terminal(f,selected,attemptId,'execution',outcome.status,outcome.status === 'failed' ? 'caller_dispatch_failed' : null);
    return {activation,outcome,feedback,...result};
  }
  // Explicit fixture receipt only; this does not implement World or movement.
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


const targeted=(relations=['other_side'])=>({targetMode:'participant',allowedSideRelations:relations});
const targetless=()=>({targetMode:'none',allowedSideRelations:[]});
const request=(sourceEntityId='monster-001',targetEntityId='player-001',actionId='action-1',encounterId='forest-fight-001')=>({encounterId,actionId,sourceEntityId,targetEntityId});
const scope=(f,r=request(),p=targeted(),state=f.encounter)=>evaluateEncounterActionScope(state,f.entities,p,r);
function freshScope(f,bound){const intent=bound.selection.decision.intent;return scope(f,request(intent.actorId,intent.targetEntityId,intent.decisionId),f.bindings[intent.actionKey].scopePolicy ?? (intent.targetEntityId===null?targetless():targeted(intent.targetEntityId===intent.actorId?['self']:['other_side'])));}
const membership={joinAllowedStatuses:['active'],leaveAllowedStatuses:['active'],changeSideAllowedStatuses:['active'],allowedJoinLifeStatuses:['alive'],requireWorldReadyOnJoin:true};
function change(f,operation,entityId,sideId){const r={operation,encounterId:f.encounter.encounterId,entityId,...(sideId?{sideId}:{}),...(operation==='join'?{readiness:{entityId,life:{entityId,status:'alive'},worldReady:true}}:{})};return g.applyEncounterMembershipChange(f.encounter,f.entities,membership,r);}
const snapshot=f=>structuredClone({encounter:f.encounter,...owners(f),timing:f.timing,dispatches:f.dispatches,random:f.calls.random});
const frozen=(a,v)=>{a.equal(Object.isFrozen(v),true,'scope deep freeze');for(const x of Object.values(v))if(x&&typeof x==='object')frozen(a,x);};
contract('01 02 03 04 05 06 07 11 12 52','scope: exact precedence and inactive diagnostics',a=>{
 const f=fixture(),r=request('Outsider',null),no=targetless();
 const expected=(reason,sourceSideId=null,targetSideId=null,sideRelation=null,req=r)=>({status:'rejected',reason,...req,sourceSideId,targetSideId,sideRelation});
 a.deepEqual(scope(f,request(f.actor.id,null),no),{status:'eligible',reason:'none',...request(f.actor.id,null),sourceSideId:'enemies',targetSideId:null,sideRelation:null});
 for(const status of ['prepared','resolved','closed','cancelled']){const s={...f.encounter,status};a.deepEqual(scope(f,r,no,s),expected('encounter_not_active'),'inactive scope exact diagnostic');a.equal(s.status,status);}
 a.deepEqual(scope(f,r,no),expected('source_not_participant'),'source scope exact diagnostic');
 const empty={...f.encounter,participants:[]};a.deepEqual(scope(f,r,no,empty),expected('source_not_participant'));a.equal(empty.status,'active');
 const b={...f.encounter,encounterId:'B',participants:[{entityId:'Outsider',sideId:'party'}]};a.equal(scope(f,request(f.actor.id,null,'D','B'),no,b).reason,'source_not_participant');
 for(const bad of [{...f.encounter,participants:[...f.encounter.participants,f.encounter.participants[0]]},{...f.encounter,sides:[]},{...f.encounter,status:'invented'},{...f.encounter,participants:[{entityId:'absent',sideId:'party'}]}])a.throws(()=>scope(f,r,no,bad),TypeError);
 a.throws(()=>evaluateEncounterActionScope({...f.encounter,status:'closed'},{},no,r),TypeError);
});
contract('08 09 10 26','membership: staged join leave and transfer authority',a=>{
 const f=fixture(),before=snapshot(f),r=request('Outsider',null),candidate=change(f,'join','Outsider','enemies');a.equal(candidate.status,'applied');
 a.equal(scope(f,r,targetless()).reason,'source_not_participant');a.deepEqual(snapshot(f),before);
 f.encounter=candidate.state;a.equal(scope(f,r,targetless()).status,'eligible');a.equal(g.listEntities(f.entities).length,4);
 f.encounter=change(f,'leave','Outsider').state;a.equal(scope(f,r,targetless()).reason,'source_not_participant');a.deepEqual(f.life,before.life);
 a.equal(scope(f).sideRelation,'other_side');f.encounter=change(f,'change_side',f.target.id,'enemies').state;
 a.equal(scope(f).reason,'side_relation_not_allowed');a.equal(scope(f,request(),targeted(['same_side'])).sideRelation,'same_side');
});
contract('13 14 15 16 17 18 19 20 21 22 23 24','relations: exact mappings target modes and cross encounter',a=>{
 const f=fixture();a.equal(scope(f).sideRelation,'other_side');
 a.equal(scope(f,request(f.actor.id,f.actor.id),targeted(['self'])).sideRelation,'self','self exact relation');
 a.equal(scope(f,request(f.actor.id,'Ally'),targeted(['same_side'])).sideRelation,'same_side','same side exact relation');
 for(const [r,p,reason,targetSideId,sideRelation] of [
  [request(),targeted(['same_side']),'side_relation_not_allowed','party','other_side'],
  [request(f.actor.id,f.actor.id),targeted(),'side_relation_not_allowed','enemies','self'],
  [request(f.actor.id,'Ally'),targeted(),'side_relation_not_allowed','enemies','same_side'],
  [request(f.actor.id,'Outsider'),targeted(),'target_not_participant',null,null],
  [request(f.actor.id,'unknown'),targeted(),'target_not_participant',null,null],
  [request(f.actor.id,null),targeted(),'target_required',null,null],
  [request(),targetless(),'unexpected_target',null,null]]){
  const rejected=scope(f,r,p);frozen(a,rejected);a.deepEqual(rejected,{status:'rejected',reason,...r,sourceSideId:'enemies',targetSideId,sideRelation},reason+' exact diagnostic');
 }
 const no=scope(f,request(f.actor.id,null),targetless());a.equal(no.status,'eligible');a.equal(f.dispatches,0);a.equal(f.supportCalls.length,0);
 const b={...f.encounter,encounterId:'B',participants:[{entityId:'Outsider',sideId:'party'}]};a.equal(g.getEncounterParticipant(b,f.entities,'Outsider').entityId,'Outsider');
});
contract('25 27 28 29 30 31 32 33','combat: real canonical admission resolution and non-events',a=>{
 for(const [mode,hp,outcome] of [['landed',80,'processed'],['dodge',100,'dodged'],['zero',100,'zero_damage']]){
  const f=fixture(),result=execute(f,propose(f),'attempt',{mode});a.equal(result.application.outcome,outcome);a.equal(f.targetResources.current.health,hp,'literal canonical HP');a.equal(f.targetLife.status,'alive');a.equal(result.feedback.status,'completed');a.equal(result.feedback.phase,'execution');a.ok(f.events.includes('combat_admission'));a.ok(f.events.includes('target'));a.ok(f.events.includes('resolve'));a.equal(result.application.appliedDamage,100-hp);
 }
 for(const [setup,options,reason] of [[()=>{},{relation:'ally'},'relation_not_allowed'],[f=>{f.life=g.createEntityLifeState(f.actor,{status:'dead'});},{},'actor_dead'],[f=>{f.targetLife=g.createEntityLifeState(f.target,{status:'dead'});},{},'target_life_not_allowed']]){
  const f=fixture(),b=propose(f);setup(f);const before=snapshot(f);a.equal(scope(f).status,'eligible');const result=execute(f,b,'reject',options);
  a.equal(result.feedback.reasonId,reason,'canonical Combat rejection remains binding');a.deepEqual(snapshot(f),before);a.equal(f.events.includes('resolve'),false);
 }
 const f=fixture(),b=propose(f);f.encounter=change(f,'leave',f.target.id).state;const before=snapshot(f);const result=execute(f,b,'cross');a.equal(result.feedback.reasonId,'target_not_participant');a.deepEqual(snapshot(f),before);a.deepEqual(f.events,['feedback:rejected']);
});
contract('34 35 36 37 38 39 49','skill: real owner rank resource cooldown and pending terminal provenance',a=>{
 for(const [setup,opts,reason] of [[()=>{},{owned:false},'skill_not_owned'],[()=>{},{rank:1},'skill_rank_too_low'],[f=>{f.resources=g.createEntityResourceState(f.actor,{mana:{minimum:0,maximum:100,current:10}});},{},'insufficient_resource'],[f=>{f.cooldown={...f.cooldown,startedAtMs:1000,readyAtMs:1750};},{},'cooldown_active']]){
  const f=fixture(),b=propose(f,'D',rules,facts('magic'));setup(f);const before=snapshot(f);a.equal(scope(f).status,'eligible');const result=execute(f,b,'reject',opts);a.equal(result.feedback.reasonId,reason,'canonical Skill rejection remains binding');a.equal(result.activation,undefined);a.deepEqual(snapshot(f),before);
 }
 for(const self of [false,true]){
  const f=fixture(),b=propose(f,'D',self?[{...rules[0],targetMode:'self'}]:rules,facts('magic'));const result=execute(f,b,'pending',{pending:true});
  a.equal(result.activation.status,'accepted');a.equal(result.feedback,null,'pending has no terminal feedback');a.deepEqual(f.feedback,[],'pending exact feedback provenance');a.equal(f.dispatches,0);a.equal(f.resources.current.mana,75);a.equal(f.cooldown.readyAtMs,1750);a.equal(f.targetResources.current.health,100);
  const outcome=g.reportSkillExecutionOutcome(result.activation.request,{status:'failed'});const feedback=terminal(f,b.selection,'pending','execution',outcome.status,'dispatch_failed');
  a.deepEqual(feedback,{decisionId:'D',actorId:f.actor.id,actionKey:'magic',targetEntityId:self?f.actor.id:f.target.id,attemptId:'pending',phase:'execution',status:'failed',reasonId:'dispatch_failed'});a.equal(f.resources.current.mana,75);a.equal(f.cooldown.readyAtMs,1750);a.equal(f.dispatches,0);
 }
 const self=fixture(),s=execute(self,propose(self,'self',[{...rules[0],targetMode:'self'}],facts('magic')),'support');a.equal(s.outcome.status,'completed');a.deepEqual(self.supportCalls,[{actorId:self.actor.id,targetEntityId:self.actor.id,attemptId:'support'}]);
 const party=fixture();party.ai={...party.ai,targetEntityId:'Ally'};party.bindings.magic={...party.bindings.magic,dispatchKind:'caller',scopePolicy:targeted(['same_side'])};
 const support=execute(party,propose(party,'party',rules,facts('magic')),'party-support');
 a.equal(support.activation.request.dispatch.kind,'caller');a.equal(support.outcome.status,'completed');a.equal(party.resources.current.mana,75);
 a.deepEqual(party.supportCalls,[{actorId:party.actor.id,targetEntityId:'Ally',attemptId:'party-support'}]);a.equal(party.targetResources.current.health,100);
 for(const skill of [false,true]){const f=fixture(),b=propose(f,'D',rules,facts(skill?'magic':'attack'));addRestriction(f,'silence',['deny-all']);const before=snapshot(f);a.equal(scope(f).status,'eligible');a.equal(execute(f,b,'blocked').feedback.reasonId,'effect_blocked','Effect AND gate');a.deepEqual(snapshot(f),before);}
 const f=fixture(),b=propose(f,'D',rules,facts('magic'));a.equal(g.evaluateEffectRestrictionGate(f.lifecycle,f.status,{blockedByRestrictionIds:['deny-all']}).status,'allowed');f.encounter=change(f,'leave',f.actor.id).state;const before=snapshot(f);a.equal(execute(f,b,'scope-reject').feedback.reasonId,'source_not_participant');a.deepEqual(snapshot(f),before);a.equal(f.events.includes('activation'),false);
});
contract('40 41 42 47 48','AI: actual proposals current controller life cadence and exact binding',a=>{
 const f=fixture(),before=snapshot(f),b=propose(f);a.equal(b.selection.status,'selected');a.deepEqual(snapshot(f),before);a.equal(f.dispatches,0);a.deepEqual(f.feedback,[]);
 const intent=b.selection.decision.intent,r=request(intent.actorId,intent.targetEntityId,intent.decisionId);a.equal(scope(f,r).actionId,'decision-1');
 const fake={...b,selection:structuredClone(b.selection)};a.throws(()=>execute(f,fake,'forged'),/exact current proposal/);a.equal(f.attempts.size,0);
 for(const changed of ['manual','dead','timing','target','decision']){
  const x=fixture(),p=propose(x);if(changed==='manual')x.ai={...x.ai,controller:'manual'};if(changed==='dead')x.life=g.createEntityLifeState(x.actor,{status:'dead'});if(changed==='timing')x.timing=g.evaluateActorAIDecisionTiming(x.ai,x.entities,x.life,x.timing,{intervalMs:500},x.context).state;if(changed==='target')x.ai={...x.ai,targetEntityId:'Ally'};if(changed==='decision')x.currentDecision='different';const snap=snapshot(x);
  const result=execute(x,p,'stale');a.equal(result.feedback.phase,'admission');a.equal(result.feedback.status,'rejected');a.deepEqual(snapshot(x),snap);a.equal(x.dispatches,0);
 }
 const manual=fixture();manual.ai={...manual.ai,controller:'manual'};a.equal(propose(manual),null);a.equal(scope(manual).status,'eligible');
});
contract('43 44 45 46','freshness: target leave source leave side switch and inactive at dispatch',a=>{
 for(const [kind,reason] of [['target','target_not_participant'],['source','source_not_participant'],['side','side_relation_not_allowed'],['inactive','encounter_not_active']]){
  const f=fixture(),b=propose(f);a.equal(freshScope(f,b).status,'eligible');
  if(kind==='target')f.encounter=change(f,'leave',f.target.id).state;
  if(kind==='source')f.encounter=change(f,'leave',f.actor.id).state;
  if(kind==='side')f.encounter=change(f,'change_side',f.target.id,'enemies').state;
  if(kind==='inactive')f.encounter={...f.encounter,status:'closed'};
  const before=snapshot(f),result=execute(f,b,'stale');a.equal(result.feedback.reasonId,reason,'fresh '+kind+' scope rejects');a.deepEqual(snapshot(f),before);a.deepEqual(f.events,['feedback:rejected']);
 }
 // A provider can reenter while a canonical candidate is calculated: no partial HP commit.
 const f=fixture(),b=propose(f);f.context=g.createExecutionContext({clock:f.clock,random:{next(){f.encounter=change(f,'leave',f.target.id).state;return .2;}}});
 const result=execute(f,b,'reentrant',{mode:'dodge'});a.equal(result.feedback.reasonId,'stale_before_commit');a.equal(f.targetResources.current.health,100);a.equal(f.dispatches,0);a.equal(f.timing,b.timing);
 const x=fixture(),p=propose(x,'D',rules,facts('magic')),resources=x.resources,cooldown=x.cooldown;const rejected=execute(x,p,'candidate',{beforeCommit:f=>{f.encounter=change(f,'leave',f.target.id).state;}});a.equal(rejected.feedback.reasonId,'stale_before_commit');a.equal(x.resources,resources);a.equal(x.cooldown,cooldown);
});
contract('50','duplicate: same attempt and distinct attempt same decision commit once',a=>{
 for(const skill of [false,true]){
  const f=fixture(),b=propose(f,'D',rules,facts(skill?'magic':'attack'));execute(f,b,'A');const before=snapshot(f),feedback=structuredClone(f.feedback);
  // Keep current cadence fresh so removal of the ledger cannot be masked by timing.
  f.clock.time=1500;const fresh={...b,timing:f.timing,due:g.evaluateActorAIDecisionTiming(f.ai,f.entities,f.life,f.timing,{intervalMs:500},f.context)};
  for(const attempt of ['A','B'])a.throws(()=>execute(f,fresh,attempt),/L4 duplicate attempt\/decision/,'duplicate ledger must block');
  a.deepEqual(snapshot(f),before,'duplicate cannot write snapshot twice');a.deepEqual(f.feedback,feedback);a.equal(f.dispatches,1);a.equal(f.targetResources.current.health,80);a.equal(f.resources.current.mana,skill?75:100);
 }
});
contract('51','minimal: Encounter Entity Combat without AI enabled',a=>{
 const registry=JSON.parse(readFileSync(new URL('./encounter-modules.json',import.meta.url))).modules.reduce(g.registerModule,g.createModuleRegistry());
 const composition=ids=>g.composeModules(registry,g.configureModules(registry,{enable:ids}));
 a.deepEqual(composition(['entity','encounter']).moduleIds,['entity','encounter']);
 a.deepEqual(composition(['entity','combat','skill','effect','actor-ai','encounter']).moduleIds,['entity','combat','skill','effect','actor-ai','encounter']);
 const runtime=g.createGameplayRuntime(composition(['entity','combat','encounter']));
 a.ok(runtime);const f=fixture();const admission=g.evaluateCombatActionAdmission(g.createCombatActionContext({actionId:'manual',actionType:'melee',sourceEntityId:f.actor.id,target:{kind:'entity',entityId:f.target.id}}),f.entities,f.life,{eligible:scope(f).status==='eligible'});
 const target=g.evaluateCombatTargetValidation(admission,f.entities,f.targetLife,targetPolicy('enemy'));const attack=g.resolveCombatAttack(admission,target,numerical(),f.context);const result=g.applyCombatAttackDamage(attack,f.targetResources,f.targetLife,healthPolicy);a.equal(result.resourceResult.state.current.health,80);
});
contract('53 54 56 57','structural: closed data exact IDs detach frozen precedence',a=>{
 const f=fixture(),r=request(),p=targeted(),s=structuredClone(f.encounter),before=JSON.stringify({r,p,s,e:f.entities});const result=scope(f,r,p,s);const captured=g.createEncounterActionScopePolicy(p),bound=g.createEncounterActionScopeRequest(r);frozen(a,result);frozen(a,captured);frozen(a,bound);a.equal(JSON.stringify({r,p,s,e:f.entities}),before,'scope never mutates inputs');a.equal(Object.isFrozen(r),false);a.equal(Object.isFrozen(p.allowedSideRelations),false);a.equal(Object.isFrozen(s),false);p.allowedSideRelations[0]='self';r.actionId='changed';a.equal(captured.allowedSideRelations[0],'other_side');a.equal(bound.actionId,'action-1');a.equal(result.actionId,'action-1');a.notEqual(scope(f),scope(f));
 a.deepEqual(scope(f,request(),targeted(['self','other_side'])),scope(f,request(),targeted(['other_side','self'])));
 a.throws(()=>scope(f,{...request(),encounterId:'B'}),TypeError,'scope binding must throw');
 for(const bad of [[],{}, {...request(),extra:1},{...request(),[Symbol('extra')]:true},Object.assign(Object.create({parent:1}),request()),{...request(),actionId:' '}])a.throws(()=>scope(f,bad),TypeError,'scope closed request validation');
 let getters=0;const accessor={...request()};Object.defineProperty(accessor,'actionId',{get(){getters++;return 'action-1';},enumerable:true});a.throws(()=>scope(f,accessor),TypeError,'scope accessor must throw');a.equal(getters,0,'scope getters not invoked');
 for(const bad of [targeted([]),targeted(['self','self']),targeted(['enemy']),{targetMode:'none',allowedSideRelations:['self']},{...targeted(),extra:1},{...targeted(),[Symbol('extra')]:true},Object.assign(Object.create({x:1}),targeted()),{targetMode:'any',allowedSideRelations:[]}])a.throws(()=>scope(f,request(),bad),TypeError,'scope policy must throw');
 const sparse=Array(1);a.throws(()=>g.createEncounterActionScopePolicy(targeted(sparse)),TypeError);const arr=['self'];Object.defineProperty(arr,'0',{get(){getters++;return 'self';}});a.throws(()=>g.createEncounterActionScopePolicy(targeted(arr)),TypeError);a.equal(getters,0);
 for(const bad of [accessor,{...request(),encounterId:'wrong'}])a.throws(()=>scope(f,bad,targeted(),{...f.encounter,status:'closed'}),TypeError);
 const ids=request(f.actor.id,null,' Action Key ');a.equal(scope(f,ids,targetless()).actionId,' Action Key ');
});
contract('55','replay: literal independent sessions explicit randomness no implicit providers',a=>{
 const replay=()=>{const f=fixture(),scopeResult=scope(f),r=execute(f,propose(f),'A');return [scopeResult.status,scopeResult.sideRelation,r.application.appliedDamage,f.targetResources.current.health,f.targetLife.status,r.feedback.phase,r.feedback.status,f.resources.current.mana,f.timing.nextEligibleAtMs];};
 const literal=['eligible','other_side',20,80,'alive','execution','completed',100,1500],one=replay(),two=replay();a.deepEqual(one,literal);a.deepEqual(two,literal);const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');a.equal(hash(one),hash(literal));a.equal(hash(two),hash(literal));console.log('ENCOUNTER_INTEGRATION_REPLAY_SHA256 '+hash(literal));
 for(const roll of [.2,.8]){const f=fixture();f.context=g.createExecutionContext({clock:f.clock,random:{next(){return roll;}}});a.equal(scope(f).sideRelation,'other_side');const out=execute(f,propose(f),'rng',{mode:'dodge'});a.equal(out.application.appliedDamage,roll===.2?0:20);}
 const f=fixture(),saved=[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval,globalThis.setImmediate];const cryptoDescriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');const fail=()=>{throw new Error('hidden provider');};try{Date.now=fail;Math.random=fail;globalThis.setTimeout=fail;globalThis.setInterval=fail;globalThis.setImmediate=fail;Object.defineProperty(globalThis,'crypto',{configurable:true,value:{randomUUID:fail}});a.equal(scope(f).status,'eligible');}finally{[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval,globalThis.setImmediate]=saved;if(cryptoDescriptor)Object.defineProperty(globalThis,'crypto',cryptoDescriptor);else delete globalThis.crypto;}
});
