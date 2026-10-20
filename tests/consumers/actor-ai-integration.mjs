import assert from 'node:assert/strict';
import test from 'node:test';
import * as g from '@rpg/gameplay';

function contract(name, run) {
  test(name, () => {
    let assertions = 0;
    const checked = new Proxy(assert, {get(target, key) {return (...args) => {assertions++; return Reflect.get(target, key)(...args);};}});
    run(checked); assert.ok(assertions > 0, 'Integration contract requires actual assertions');
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
  const actor=g.createEntity({id:'Actor',kind}), target=g.createEntity({id:'Target',kind:'player'});
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
function propose(f, decisionId='decision-1', configured=rules, availability=facts('attack')) {
  const context=g.createActorAIDecisionContext(f.ai,decisionId);
  const selection=g.evaluateActorAIActionSelection(f.ai,f.entities,context,{profileId:'P',rules:configured},g.createActorAIActionObservation(context,availability));
  f.currentDecision=decisionId;
  return {selection,revision:f.revision,stateToken:JSON.stringify(f.ai)};
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
    f.dispatches++;
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
    f.resources=activation.resources; f.cooldown=activation.cooldown;
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

contract('integration C01-C04/C09/C28: canonical Attack, dodge, zero and defeat, same Player/Monster protocol', assert=>{
  for(const kind of ['monster','player']) for(const [mode,hp,damage,outcome,rolls] of [
    ['landed',80,20,'processed',0],['dodge',100,0,'dodged',1],['zero',100,0,'zero_damage',0]]) {
    const f=fixture(kind), bound=propose(f), before=structuredClone(f.ai), result=execute(f,bound,'attempt-1',{mode});
    assert.equal(result.application.outcome,outcome); assert.equal(result.application.appliedDamage,damage);
    assert.equal(g.getEntityResourceCurrent(f.targetResources,'health'),hp);
    assert.equal(result.feedback.status,'completed'); assert.equal(result.feedback.phase,'execution');
    assert.deepEqual(result.feedback,{decisionId:'decision-1',actorId:'Actor',actionKey:'attack',targetEntityId:'Target',attemptId:'attempt-1',phase:'execution',status:'completed',reasonId:null});
    assert.deepEqual(result.attack.context,{actionId:'combat-attempt-1',actionType:'explicit-melee',sourceEntityId:'Actor',target:{kind:'entity',entityId:'Target'}});
    assert.deepEqual(f.ai,before); assert.equal(f.calls.random,rolls); assert.equal(f.dispatches,1);
    if(mode==='landed') {assert.equal(result.application.lifeResult.state.status,'alive');assert.equal(result.application.resourceResult.transition.applied,20);}
    else {assert.equal(result.application.resourceResult,null);assert.equal(result.application.lifeResult,null);}
    freezeCheck(assert,result.feedback);
  }
  const f=fixture();f.targetResources=g.createEntityResourceState(f.target,{health:{minimum:0,maximum:100,current:10}});
  const result=execute(f,propose(f),'defeat');assert.equal(result.application.appliedDamage,10);
  assert.equal(result.application.lifeResult.outcome,'defeated');assert.equal(f.targetLife.status,'dead');assert.equal(f.targetResources.current.health,0);
  console.log('ACTOR_AI_INTEGRATION_COMBAT_PASS');
});

contract('integration C05-C08/C24-C25/C31/C39: canonical rejection stops later stages and commits nothing',assert=>{
  for(const [change,expected,stages] of [
    [f=>{f.life=g.createEntityLifeState(f.actor,{status:'dead'});},'source_dead',['effect','combat_admission']],
    [f=>{f.entities=g.removeEntity(f.entities,'Actor');},'source_not_found',['effect','combat_admission']],
    [f=>{f.targetLife=g.createEntityLifeState(f.target,{status:'dead'});},'target_life_not_allowed',['effect','combat_admission','target']],
    [f=>{f.entities=g.removeEntity(f.entities,'Target');},'target_not_found',['effect','combat_admission','target']],
  ]) {
    const f=fixture(), bound=propose(f);change(f);const before=owners(f), result=execute(f,bound,'rejected');
    assert.equal(result.feedback.reasonId,expected);assert.equal(result.feedback.phase,'admission');assert.equal(result.feedback.status,'rejected');
    assert.deepEqual(owners(f),before);assert.equal(f.dispatches,0);assert.deepEqual(f.events,[...stages,'feedback:rejected']);
  }
  for(const [options,reason] of [[{relation:'ally'},'relation_not_allowed'],[{eligible:false},'source_ineligible']]) {
    const f=fixture(), before=owners(f), result=execute(f,propose(f),'reject',options);
    assert.equal(result.feedback.reasonId,reason);assert.equal(f.events.includes('resolve'),false);assert.deepEqual(owners(f),before);
  }
  console.log('ACTOR_AI_INTEGRATION_REJECTIONS_PASS');
});

contract('integration C10/C15-C19/C29-C30/C32: Skill acceptance, actual dispatch, caller support, failure without refund',assert=>{
  for(const [self,failDispatch,pending] of [[false,false,false],[true,false,false],[false,true,false],[false,false,true]]) {
    const f=fixture('player'), configured=self ? [{...rules[0],targetMode:'self'}] : rules;
    const bound=propose(f,'decision-skill',configured,facts('magic')), beforeAI=structuredClone(f.ai);
    const result=execute(f,bound,'skill-attempt',{failDispatch,pending});
    assert.equal(result.activation.status,'accepted');assert.equal(result.activation.request.attemptId,'skill-attempt');
    assert.equal(result.activation.request.actorEntityId,'Actor');assert.notEqual(result.activation.request.attemptId,bound.selection.decision.intent.decisionId);
    assert.equal(f.resources.current.mana,75);assert.equal(f.cooldown.startedAtMs,1000);assert.equal(f.cooldown.readyAtMs,1750);
    assert.deepEqual(f.ai,beforeAI);
    if(pending){assert.equal(result.feedback,null);assert.deepEqual(f.feedback,[]);assert.equal(f.dispatches,0);assert.equal(f.targetResources.current.health,100);}
    else {
      assert.equal(result.outcome.status,failDispatch?'failed':'completed');assert.equal(result.feedback.status,result.outcome.status);
      assert.equal(result.feedback.reasonId,failDispatch?'caller_dispatch_failed':null);assert.equal(f.dispatches,1);
      assert.equal(f.targetResources.current.health,!self && !failDispatch?80:100);
      if(self){assert.equal(result.outcome.dispatchKind,'caller');assert.deepEqual(f.supportCalls,[{actorId:'Actor',targetEntityId:'Actor',attemptId:'skill-attempt'}]);}
      else if(!failDispatch){assert.equal(result.outcome.dispatchKind,'combat');assert.ok(f.events.indexOf('target')<f.events.indexOf('activation'));}
    }
    freezeCheck(assert,result.activation); if(result.outcome) freezeCheck(assert,result.outcome);
  }
  console.log('ACTOR_AI_INTEGRATION_SKILL_PASS');
});

contract('integration C11-C14/C16/C26/C47: real Skill gates deny without publication or dispatch',assert=>{
  for(const [setup,options,reason,last] of [
    [f=>{f.cooldown={...f.cooldown,startedAtMs:1000,readyAtMs:1750};},{},'cooldown_active','cooldown'],
    [f=>{f.resources=g.createEntityResourceState(f.actor,{mana:{minimum:0,maximum:100,current:10}});},{},'insufficient_resource','costs'],
    [()=>{},{owned:false},'skill_not_owned','skill_admission'],[()=>{},{rank:1},'skill_rank_too_low','skill_admission'],
    [f=>{f.life=g.createEntityLifeState(f.actor,{status:'dead'});},{},'actor_dead','skill_admission'],
    [f=>{f.targetLife=g.createEntityLifeState(f.target,{status:'dead'});},{},'target_life_not_allowed','target'],
    [f=>{f.entities=g.removeEntity(f.entities,'Target');},{},'target_not_found','target'],
  ]) {
    const f=fixture(), bound=propose(f,'D',rules,facts('magic'));setup(f);const before=owners(f);
    const result=execute(f,bound,'attempt',options);assert.equal(result.feedback.reasonId,reason);
    assert.equal(result.feedback.status,'rejected');assert.equal(f.events.at(-2),last);
    assert.equal(result.activation,undefined);assert.equal(f.dispatches,0);assert.deepEqual(owners(f),before);
  }
  const f=fixture(),bound=propose(f,'D',rules,facts('magic'));const before=owners(f);
  assert.throws(()=>execute(f,bound,'bad',{beforeCommit:x=>{x.revision++;throw new TypeError('candidate check');}}),TypeError);
  assert.deepEqual(owners(f),before);assert.equal(f.dispatches,0);assert.deepEqual(f.feedback,[]);
  for(const invalid of ['', ' ', null]) {const malformed=fixture(),b=propose(malformed),snap=owners(malformed);assert.throws(()=>execute(malformed,b,invalid),TypeError);assert.deepEqual(owners(malformed),snap);assert.equal(malformed.dispatches,0);}
  const unbound=fixture(),unknown=propose(unbound);delete unbound.bindings.attack;const snap=owners(unbound);assert.throws(()=>execute(unbound,unknown,'unknown'),TypeError);assert.deepEqual(owners(unbound),snap);
  console.log('ACTOR_AI_INTEGRATION_SKILL_REJECTIONS_PASS');
});

contract('integration C20-C27/C38: actual Effect lifecycle/status gates AND canonical owners, provenance and expiry',assert=>{
  for(const key of ['magic','attack']){
    const f=fixture(),bound=propose(f,'D',rules,facts(key));addRestriction(f,'stun',['deny-all']);
    const before=owners(f),result=execute(f,bound,'blocked');assert.equal(result.feedback.reasonId,'effect_blocked');
    assert.deepEqual(f.events,['effect','feedback:rejected']);assert.equal(f.dispatches,0);assert.deepEqual(owners(f),before);
  }
  const f=fixture(),bound=propose(f,'D',rules,facts('magic'));addRestriction(f,'silence',['deny-magic']);addRestriction(f,'second',['deny-magic','other']);
  const gate=g.evaluateEffectRestrictionGate(f.lifecycle,f.status,{blockedByRestrictionIds:['deny-magic']});
  assert.deepEqual(gate.matches,[{effectInstanceId:'silence',effectId:'opaque-effect',restrictionId:'deny-magic'},
    {effectInstanceId:'second',effectId:'opaque-effect',restrictionId:'deny-magic'}]);
  assert.deepEqual(g.listActiveEffectRestrictions(f.lifecycle,f.status),[...gate.matches,{effectInstanceId:'second',effectId:'opaque-effect',restrictionId:'other'}]);
  assert.equal(execute(f,bound,'silenced').feedback.reasonId,'effect_blocked');
  const attack=execute(f,propose(f,'new-attack',rules,[unavailable('magic'),...facts('attack')]),'attack');assert.equal(attack.feedback.status,'completed');
  f.clock.time=1500;const transition=g.advanceEffectLifecycle(f.lifecycle,f.context);
  const statuses=g.applyEffectStatusTransition(f.status,f.lifecycle,transition);f.lifecycle=transition.state;f.status=statuses.state;
  assert.equal(g.evaluateEffectRestrictionGate(f.lifecycle,f.status,{blockedByRestrictionIds:['deny-magic']}).status,'allowed');
  assert.equal(execute(f,propose(f,'after-expiry',rules,facts('magic')),'expired').feedback.status,'completed');
  const unrelated=fixture();addRestriction(unrelated,'opaque',['unrelated']);
  assert.equal(execute(unrelated,propose(unrelated),'unrelated').feedback.status,'completed');
  const malformed=fixture(),b=propose(malformed);malformed.status={...malformed.status,observedAtMs:999};const before=owners(malformed);
  assert.throws(()=>execute(malformed,b,'bad'),TypeError);assert.deepEqual(owners(malformed),before);assert.equal(malformed.dispatches,0);
  console.log('ACTOR_AI_INTEGRATION_EFFECT_PASS');
});

contract('integration C28-C36: feedback exact correlation, terminal discriminants, detached snapshot and trust boundary',assert=>{
  const f=fixture(),selection=propose(f).selection, original=structuredClone(selection);
  const report={...selection.decision.intent,attemptId:' attempt ',phase:'execution',status:'completed',reasonId:null};
  for(const terminal of [{phase:'execution',status:'completed',reasonId:null},{phase:'execution',status:'failed',reasonId:' failure '},
    {phase:'admission',status:'rejected',reasonId:'gate'}]) {
    const input={...report,...terminal},result=g.validateActorAIActionExecutionFeedback(selection,input);
    assert.deepEqual(result,input);assert.notEqual(result,input);freezeCheck(assert,result);input.actionKey='changed';assert.equal(result.actionKey,'attack');
  }
  for(const key of ['actorId','decisionId','actionKey','targetEntityId']) assert.throws(()=>g.validateActorAIActionExecutionFeedback(selection,{...report,[key]:'wrong'}),TypeError);
  for(const targetEntityId of [null,'target'])assert.throws(()=>g.validateActorAIActionExecutionFeedback(selection,{...report,targetEntityId}),TypeError);
  for(const value of ['', ' ', null, undefined, 1])assert.throws(()=>g.validateActorAIActionExecutionFeedback(selection,{...report,attemptId:value}),TypeError);
  for(const phase of ['admission','execution','pending'])for(const status of ['rejected','completed','failed','accepted'])for(const reasonId of [null,'reason',' ']) {
    const valid=(phase==='admission' && status==='rejected' && reasonId==='reason')
      ||(phase==='execution' && status==='failed' && reasonId==='reason')||(phase==='execution' && status==='completed' && reasonId===null);
    if(valid)assert.ok(g.validateActorAIActionExecutionFeedback(selection,{...report,phase,status,reasonId}));
    else assert.throws(()=>g.validateActorAIActionExecutionFeedback(selection,{...report,phase,status,reasonId}),TypeError);
  }
  for(const controller of ['ai','manual']) {
    const other=fixture();other.ai.controller=controller;
    assert.throws(()=>g.validateActorAIActionExecutionFeedback(propose(other,'no',[],[]).selection,report),TypeError);
  }
  // Pure validation deliberately accepts a repeated structurally valid report; L4 owns provenance/dedup.
  assert.deepEqual(g.validateActorAIActionExecutionFeedback(selection,report),g.validateActorAIActionExecutionFeedback(selection,report));
  assert.deepEqual(selection,original);assert.equal(f.dispatches,0);assert.equal(f.targetResources.current.health,100);
  console.log('ACTOR_AI_INTEGRATION_FEEDBACK_PASS');
});

contract('integration C33-C36/C47: complete closed own-data feedback and selection validation, no getters',assert=>{
  const f=fixture(),selected=structuredClone(propose(f).selection),report={...selected.decision.intent,attemptId:'A',phase:'execution',status:'completed',reasonId:null};
  selected.rejected=[{ruleId:'earlier',actionKey:'earlier',reason:'availability_missing'}];let getters=0;
  for(const [valid,invoke] of [[report,x=>g.validateActorAIActionExecutionFeedback(selected,x)],
    [selected,x=>g.validateActorAIActionExecutionFeedback(x,report)],
    [selected.decision,x=>g.validateActorAIActionExecutionFeedback({...selected,decision:x},report)],
    [selected.decision.intent,x=>g.validateActorAIActionExecutionFeedback({...selected,decision:{...selected.decision,intent:x}},report)],
    [selected.rejected[0],x=>g.validateActorAIActionExecutionFeedback({...selected,rejected:[x]},report)]]) {
    for(const bad of [null,undefined,[],1,{...valid,extra:1},{...valid,[Symbol()]:1}])assert.throws(()=>invoke(bad),TypeError);
    for(const key of Object.keys(valid)) {
      const missing={...valid};delete missing[key];const accessor={...valid};Object.defineProperty(accessor,key,{get(){getters++;return valid[key];}});
      assert.throws(()=>invoke(missing),TypeError);assert.throws(()=>invoke(Object.assign(Object.create({[key]:valid[key]}),missing)),TypeError);
      assert.throws(()=>invoke(accessor),TypeError);
    }
    assert.ok(invoke(Object.assign(Object.create(null),valid)));
  }
  const a=[selected.rejected[0]];Object.defineProperty(a,'0',{get(){getters++;return selected.rejected[0];}});
  for(const rejected of [new Array(1),a,Object.assign([],{extra:1}),Object.assign([],{[Symbol()]:1})]) assert.throws(()=>g.validateActorAIActionExecutionFeedback({...selected,rejected},report),TypeError);
  for(const bad of [{...selected,selectedRuleId:' '},{...selected,actionKind:'unknown'},{...selected,reason:'manual_control'},
    {...selected,decision:{...selected.decision,reason:'other'}},{...selected,decision:{...selected.decision,status:'no_action'}},
    {...selected,rejected:[{...selected.rejected[0],reason:'unknown'}]},{...selected,rejected:[...selected.rejected,...selected.rejected]},
    {...selected,rejected:[{...selected.rejected[0],ruleId:'attack'}]}])assert.throws(()=>g.validateActorAIActionExecutionFeedback(bad,report),TypeError);
  for(const kind of ['wait','return_home'])assert.throws(()=>g.validateActorAIActionExecutionFeedback({...selected,actionKind:kind},report),TypeError);
  assert.equal(getters,0);
  console.log('ACTOR_AI_INTEGRATION_VALIDATION_PASS');
});

contract('integration C08/C39-C40/C43/C47: current controller, target, decision and candidate freshness; local duplicate scope',assert=>{
  for(const [change,reason] of [[f=>{f.ai.controller='manual';},'controller_changed'],[f=>{f.ai.targetEntityId='Replacement';},'stale_decision'],
    [f=>{f.currentDecision='newer';},'stale_decision'],[f=>{f.revision++;},'stale_decision']]) {
    const f=fixture('player'),bound=propose(f,'D',rules,facts('magic'));change(f);const before=owners(f);
    const result=execute(f,bound,'stale');assert.equal(result.feedback.reasonId,reason);assert.equal(f.dispatches,0);assert.deepEqual(owners(f),before);
    assert.deepEqual(f.events,['feedback:rejected']);assert.equal(f.feedback.length,1);
  }
  const candidate=fixture(),bound=propose(candidate,'D',rules,facts('magic')),before=owners(candidate);
  assert.equal(execute(candidate,bound,'race',{beforeCommit:f=>{f.revision++;}}).feedback.reasonId,'stale_before_commit');
  assert.deepEqual(owners(candidate),before);assert.equal(candidate.dispatches,0);
  for(const key of ['attack','magic']) {
    const f=fixture(),b=propose(f,'D',rules,facts(key));execute(f,b,'once');const committed=owners(f),count=f.dispatches;
    assert.throws(()=>execute(f,b,'once'),/duplicate/);assert.throws(()=>execute(f,b,'different-attempt'),/duplicate/);
    assert.deepEqual(owners(f),committed);assert.equal(f.dispatches,count);assert.equal(f.feedback.length,1);
  }
  console.log('ACTOR_AI_INTEGRATION_FRESHNESS_PASS');
});

contract('integration C37-C45: explicit fresh fallback, failed dispatch no replay/refund, movement receipts and all actor kinds',assert=>{
  for(const kind of ['player','monster','pet','summon','npc']) {
    const f=fixture(kind),bound=propose(f,'D1',rules,facts('magic'));f.cooldown={...f.cooldown,startedAtMs:1000,readyAtMs:1750};
    assert.equal(execute(f,bound,'cooldown').feedback.reasonId,'cooldown_active');assert.equal(f.dispatches,0);
    const fresh=propose(f,'D2',rules,[unavailable('magic'),...facts('attack')]);assert.equal(fresh.selection.decision.intent.actionKey,'attack');
    assert.equal(execute(f,fresh,'fallback').feedback.status,'completed');assert.equal(f.dispatches,1);
  }
  const f=fixture(),bound=propose(f,'D1',rules,facts('attack'));addRestriction(f,'new-stun',['deny-all']);
  assert.equal(execute(f,bound,'blocked').feedback.reasonId,'effect_blocked');
  const wait=propose(f,'D2',rules,[unavailable('magic'),unavailable('attack'),...facts('wait')]);
  assert.equal(wait.selection.actionKind,'wait');assert.equal(f.dispatches,0); // Proposal cannot itself bypass fresh restriction.
  const none=propose(f,'D3',rules,rules.map(r=>unavailable(r.actionKey)));assert.equal(none.selection.decision.reason,'no_candidate');
  assert.equal(f.dispatches,0);assert.equal(f.feedback.length,1);
  const failed=fixture(),b=propose(failed,'D1',rules,facts('magic'));
  assert.equal(execute(failed,b,'failed',{failDispatch:true}).feedback.status,'failed');assert.equal(failed.dispatches,1);
  assert.equal(failed.resources.current.mana,75);assert.equal(failed.cooldown.readyAtMs,1750);assert.throws(()=>execute(failed,b,'retry'),/duplicate/);
  assert.equal(execute(failed,propose(failed,'D2',rules,[unavailable('magic'),...facts('attack')]),'new').feedback.status,'completed');
  assert.equal(failed.resources.current.mana,75);assert.equal(failed.dispatches,2);
  for(const [actionKind,targetMode] of [['approach_target','current_target'],['return_home','none'],['wait','none']]) {
    const movement=fixture(),configured=[{...rules[1],actionKind,targetMode}];movement.bindings.attack={actionKind};
    const r=execute(movement,propose(movement,'movement',configured,facts('attack')),'caller');
    assert.equal(r.feedback.status,'completed');assert.equal(movement.targetResources.current.health,100);assert.equal(movement.resources.current.mana,100);
    assert.deepEqual(movement.events,['effect','caller:'+actionKind,'feedback:completed']);
  }
  console.log('ACTOR_AI_INTEGRATION_FALLBACK_PASS');
});

contract('integration C46: independent literal deterministic event/outcome replay with explicit providers',assert=>{
  const old=[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval];let a,b;
  function session(){const f=fixture(),result=execute(f,propose(f),'attempt-1');const trace=[...f.events,f.targetResources.current.health,result.application.appliedDamage,result.feedback.status];
    assert.deepEqual(trace,['effect','combat_admission','target','resolve','damage','feedback:completed',80,20,'completed']);return {trace,result};}
  try{Date.now=Math.random=globalThis.setTimeout=globalThis.setInterval=()=>{throw Error('hidden provider');};a=session();b=session();}
  finally{[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval]=old;}
  assert.deepEqual(a,b);assert.notEqual(a.result.feedback,b.result.feedback);assert.notEqual(a.result.application,b.result.application);
  console.log('ACTOR_AI_INTEGRATION_REPLAY_PASS');
});
