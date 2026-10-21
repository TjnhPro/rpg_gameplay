import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import * as g from '@rpg/gameplay';

function contract(ids,name,run){test('Final Encounter '+name,()=>{
  let assertions=0;const a=new Proxy(assert,{get(target,key){return (...args)=>{assertions++;return Reflect.get(target,key)(...args);};}});
  run(a);assert.ok(assertions>0,'Final Encounter requires actual assertions');
  for(const id of ids.split(' ').filter(Boolean))console.log('ENCOUNTER_E'+id+'_PASS');
});}
const token=JSON.stringify;
const ids=w=>w.state.participants.map(p=>p.entityId);
const memberPolicy=()=>({joinAllowedStatuses:['prepared','active'],leaveAllowedStatuses:['prepared','active'],changeSideAllowedStatuses:['prepared','active'],allowedJoinLifeStatuses:['alive'],requireWorldReadyOnJoin:true});
const completionPolicy=()=>({definitionId:'forest-patrol',rules:[{ruleId:'last-standing',kind:'side_elimination',contenderSideIds:['party','enemies'],zeroSurvivors:'pending'}]});
const win={kind:'victory',winnerSideIds:['party'],defeatedSideIds:['enemies']};
function world(kinds=['player','monster','monster']){
  const w={entities:g.createEntityCollection(),actors:{},life:{},resources:{},ready:{},rev:0,lifeVersion:0,continuationVersion:0,objectiveVersion:0,controllerVersion:0,worldVersion:0,sideVersion:0,continuation:'clear',objectives:[],controller:'ai',disposition:null,events:[],cleanupReceipts:new Set(),calls:0};
  for(const [i,id] of ['player-001','wolf-001','wolf-002'].entries()){
    const e=g.createEntity({id,kind:kinds[i]});w.actors[id]=e;w.entities=g.addEntity(w.entities,e);w.life[id]=g.createEntityLifeState(e,{status:'alive'});w.ready[id]=true;
    w.resources[id]=g.createEntityResourceState(e,{health:{minimum:0,maximum:id==='player-001'?100:20,current:id==='player-001'?100:20}});
  }
  w.state=g.createEncounterState({definitionId:'forest-patrol'},{encounterId:'forest-fight-001',sides:[{sideId:'party'},{sideId:'enemies'}],participants:[{entityId:'player-001',sideId:'party'},{entityId:'wolf-001',sideId:'enemies'}]},w.entities);
  w.policy=completionPolicy();w.dispatches=0;w.combatReceipts=[];w.turns=[];w.decisions=new Set();w.attempts=new Set();return w;
}
// Authoritative state and generations exist only inside each L4 test session.
function observe(w){return g.createEncounterCompletionObservation({encounterId:w.state.encounterId,participants:w.state.participants.map(p=>({entityId:p.entityId,life:w.life[p.entityId]})),objectives:w.objectives,continuation:w.continuation});}
function assess(w,observation=observe(w)){return g.evaluateEncounterCompletion(w.state,w.entities,w.policy,observation);}
function activation(w){return g.activateEncounter(w.state,w.entities,{minimumParticipants:1,minimumOccupiedSides:2,requiredOccupiedSideIds:['party','enemies'],allowedLifeStatuses:['alive'],requireWorldReady:true},{encounterId:w.state.encounterId,participants:w.state.participants.map(p=>({entityId:p.entityId,life:w.life[p.entityId],worldReady:w.ready[p.entityId]}))});}
function request(w,operation,entityId='wolf-002',sideId='enemies'){
  const common={operation,encounterId:w.state.encounterId,entityId};return operation==='join'?{...common,sideId,readiness:{entityId,life:w.life[entityId]??{entityId,status:'alive'},worldReady:w.ready[entityId]??true}}:operation==='change_side'?{...common,sideId}:common;
}
function membership(w,r,policy=memberPolicy()){return g.applyEncounterMembershipChange(w.state,w.entities,policy,r);}
function resolution(w){return g.resolveEncounter(w.state,w.entities,w.policy,observe(w));}
function cancellation(w){return g.cancelEncounter(w.state,w.entities,{definitionId:'forest-patrol',cancelAllowedStatuses:['prepared','active']},{encounterId:w.state.encounterId,reasonId:'caller-abort'});}
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
function change(w,operation,id='wolf-002',side='enemies'){
  const result=membership(w,request(w,operation,id,side));assert.equal(commit(w,stage(w,result)),'accepted');
  if(operation==='change_side')w.sideVersion++;return result;
}
function continuation(w,value){w.continuation=value;w.continuationVersion++;}
function objective(w,status){w.objectives=[{objectiveId:'crystal',status}];w.objectiveVersion++;}
function revive(w,id){
  const maximum=id==='player-001'?100:20;w.resources[id]=g.transitionEntityResource(w.resources[id],'health',{maximum,amount:10,operation:'increase',rule:{minimum:0,currentAboveMaximum:'reject',allowIncreaseFromMinimum:true}}).state;
  w.life[id]=g.reviveEntity(w.life[id],w.resources[id],{resourceId:'health',minimum:0,maximum}).state;w.lifeVersion++;
}
function hit(w,target='wolf-001',mode='landed',roll=.8){
  const actor=target==='player-001'?'wolf-001':'player-001';
  const context=g.createExecutionContext({clock:{now:()=>1000},random:{next(){w.calls++;return roll;}}});
  const action=g.createCombatActionContext({actionId:'explicit-hit',actionType:'basic_attack',sourceEntityId:actor,target:{kind:'entity',entityId:target}});
  const admission=g.evaluateCombatActionAdmission(action,w.entities,w.life[actor],{eligible:true});
  const validation=g.evaluateCombatTargetValidation(admission,w.entities,w.life[target],{relation:'enemy',allowedRelations:['enemy'],allowedLifeStatuses:['alive']});
  const attack=g.resolveCombatAttack(admission,validation,{hit:{dodgeChance:mode==='dodge'?.5:0,eligible:true,rule:{enabled:true,bounds:{min:0,max:1}}},critical:{chance:0,bonus:0,eligible:false,rule:{enabled:true,bounds:{min:0,max:1}}},damage:{base:mode==='zero'?0:target==='player-001'?100:20,rank:1,perRank:0,scaling:[],flat:{definition:0,additional:0,resolved:0},bonuses:[]},mitigation:{ruleKey:'none',rating:0,rule:{enabled:false,bounds:{min:0,max:1},levelScalingEnabled:false}}},context);
  const applied=g.applyCombatAttackDamage(attack,w.resources[target],w.life[target],{resourceId:'health',minimum:0,maximum:target==='player-001'?100:20,currentAboveMaximum:'reject'});
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
function snapshot(w){return token({state:w.state,entities:w.entities,life:w.life,resources:w.resources,record:w.disposition,rev:w.rev,events:w.events,receipts:[...w.cleanupReceipts],controller:w.controller,ready:w.ready,continuation:w.continuation,objectives:w.objectives,versions:[w.lifeVersion,w.continuationVersion,w.objectiveVersion,w.controllerVersion,w.worldVersion,w.sideVersion],owners:w.owners,dispatches:w.dispatches,combatReceipts:w.combatReceipts,turns:w.turns,decisions:[...w.decisions],attempts:[...w.attempts],calls:w.calls});}
function frozen(a,value){if(value&&typeof value==='object'){a.ok(Object.isFrozen(value),'detached frozen');for(const v of Object.values(value))frozen(a,v);}}

const player='player-001',wolf='wolf-001',reinforcement='wolf-002';
const currentScope=(w,actor=player,target=wolf)=>g.evaluateEncounterActionScope(w.state,w.entities,
  {targetMode:'participant',allowedSideRelations:['other_side']},
  {encounterId:w.state.encounterId,actionId:'explicit-action',sourceEntityId:actor,targetEntityId:target});
// Test-only caller dispatch: Encounter is advisory; canonical owners still admit/execute.
function dispatch(w,actor=player,target=wolf,{mode='landed',eligible=true}={}){
  const scope=currentScope(w,actor,target);if(scope.status!=='eligible')return scope.reason;
  const action=g.createCombatActionContext({actionId:'turn-'+w.dispatches,actionType:'basic_attack',sourceEntityId:actor,target:{kind:'entity',entityId:target}});
  const admission=g.evaluateCombatActionAdmission(action,w.entities,w.life[actor],{eligible});
  if(admission.status!=='admitted')return admission.reason;
  const validation=g.evaluateCombatTargetValidation(admission,w.entities,w.life[target],{relation:'enemy',allowedRelations:['enemy'],allowedLifeStatuses:['alive']});
  if(validation.status!=='accepted')return validation.reason;
  const context=g.createExecutionContext({clock:{now:()=>1000},random:{next(){w.calls++;return .2;}}});
  const attack=g.resolveCombatAttack(admission,validation,{hit:{dodgeChance:mode==='dodge'?.5:0,eligible:true,rule:{enabled:true,bounds:{min:0,max:1}}},critical:{chance:0,bonus:0,eligible:false,rule:{enabled:true,bounds:{min:0,max:1}}},damage:{base:mode==='zero'?0:target===player?100:20,rank:1,perRank:0,scaling:[],flat:{definition:0,additional:0,resolved:0},bonuses:[]},mitigation:{ruleKey:'none',rating:0,rule:{enabled:false,bounds:{min:0,max:1},levelScalingEnabled:false}}},context);
  const applied=g.applyCombatAttackDamage(attack,w.resources[target],w.life[target],{resourceId:'health',minimum:0,maximum:target===player?100:20,currentAboveMaximum:'reject'});
  if(applied.resourceResult){w.resources[target]=applied.resourceResult.state;w.life[target]=applied.lifeResult.state;w.lifeVersion++;}
  w.combatReceipts.push([admission.status,validation.status,applied.appliedDamage]);w.dispatches++;return applied;
}
function effectOwner(w,actor=player){const clock={time:1000,now(){return this.time;}};const context=g.createExecutionContext({clock});const lifecycle=g.createEffectLifecycleState(g.createEffectState(w.actors[actor]),context);return {clock,context,lifecycle,status:g.createEffectStatusState(lifecycle)};}
function restrict(w,o,actor=player){
  const definition=g.createEffectDefinition({effectId:'silence'}),instance=g.createEffectInstance(definition,w.actors[actor],{effectInstanceId:'silence-1',source:{kind:'system',sourceId:'fixture',sourceKey:'silence'}});
  const applied=g.applyEffect(definition,{instance},o.lifecycle.effectState,w.entities,w.life[actor],{sourceEligible:true,targetEligible:true,allowedTargetLifeStatuses:['alive']});
  const transition=g.startEffectLifetime(o.lifecycle,applied,{mode:'timed',durationMs:500},o.context);
  o.status=g.applyEffectStatusTransition(o.status,o.lifecycle,transition,{statusIds:[],restrictionIds:['silenced']}).state;o.lifecycle=transition.state;
}
function skillOwner(w,actor=player){const effect=effectOwner(w,actor),definition=g.createSkillDefinition({skillId:'support'}),instance=g.createSkillInstance(definition,w.actors[actor],{instanceId:'support-1'});return {...effect,definition,instance,resources:g.createEntityResourceState(w.actors[actor],{mana:{minimum:0,maximum:100,current:100}}),cooldown:g.createSkillCooldownState(instance),feedback:[]};}
function proposal(w,actor=player,kind='skill',self=false,decisionId='decision-1'){
  const ai={...g.createActorAIState(w.actors[actor],{profileId:'guard'},{controller:'ai',behaviorStateId:'engaged'}),targetEntityId:self?actor:wolf};
  const context=g.createActorAIDecisionContext(ai,decisionId);
  const selection=g.evaluateActorAIActionSelection(ai,w.entities,context,{profileId:'guard',rules:[{ruleId:'available',behaviorStateId:'engaged',actionKey:'selected',actionKind:kind,targetMode:self?'self':'current_target'}]},g.createActorAIActionObservation(context,[{actionKey:'selected',status:'available',reasonId:null}]));
  return {ai,selection,actor,rev:w.rev};
}
function activateSupport(w,o,p){
  if(w.controller!=='ai')return 'manual_control';
  const intent=p.selection.decision.intent;
  const scope=g.evaluateEncounterActionScope(w.state,w.entities,{targetMode:'participant',allowedSideRelations:['self','other_side']},{encounterId:w.state.encounterId,actionId:intent.decisionId,sourceEntityId:p.actor,targetEntityId:intent.targetEntityId});
  if(scope.status!=='eligible')return scope.reason;
  const restriction=g.evaluateEffectRestrictionGate(o.lifecycle,o.status,{blockedByRestrictionIds:['silenced']});
  if(restriction.status==='blocked')return 'effect_blocked';
  const admission=g.evaluateSkillActivationAdmission(o.definition,o.instance,p.actor,w.entities,w.life[p.actor],{owned:true,eligible:true,rank:{mode:'not_required'}});
  const result=g.activateSkill({instance:o.instance,admission,resourceState:o.resources,resourceCosts:{costs:[{resourceId:'mana',amount:25}],bounds:[{resourceId:'mana',minimum:0,maximum:100,currentAboveMaximum:'reject'}]},cooldownState:o.cooldown,cooldownConfig:{baseDurationMs:1000,effectiveCdr:.25},executionContext:o.context,intent:{attemptId:'support-attempt',dispatch:{kind:'caller'}},executionPreflight:{kind:'caller',status:'accepted'}});
  if(result.status==='accepted'){o.resources=result.resources;o.cooldown=result.cooldown;}
  return result;
}
function feedback(o,p,result,status){const outcome=g.reportSkillExecutionOutcome(result.request,{status});const value=g.validateActorAIActionExecutionFeedback(p.selection,{...p.selection.decision.intent,attemptId:'support-attempt',phase:'execution',status:outcome.status,reasonId:status==='failed'?'caller_failed':null});o.feedback.push(value);return value;}
function executeSelectedAttack(w,o,p){
  if(w.controller !== 'ai')return 'manual_control';
  if(p.rev !== w.rev)return 'stale_decision';
  const intent=p.selection.decision.intent;
  if(g.evaluateActorAILifeGate(p.ai,w.entities,w.life[intent.actorId]).status!=='allowed')return 'life_blocked';
  if(g.evaluateEffectRestrictionGate(o.lifecycle,o.status,{blockedByRestrictionIds:['silenced']}).status!=='allowed')return 'effect_blocked';
  const result=dispatch(w,intent.actorId,intent.targetEntityId);
  if(typeof result==='string')return result;
  o.feedback.push(g.validateActorAIActionExecutionFeedback(p.selection,{...intent,attemptId:'attack-1',phase:'execution',status:'completed',reasonId:null}));return result;
}
function turn(w,actor,target){w.turns.push(actor);return dispatch(w,actor,target);}
function freshDecision(w,decisionId,attemptId){if(w.decisions.has(decisionId))return 'duplicate_decision';if(w.attempts.has(attemptId))return 'duplicate_attempt';w.decisions.add(decisionId);w.attempts.add(attemptId);return 'accepted';}
function e2e(mode='landed'){
  const w=world(),trace=[['prepared',ids(w)]];start(w);trace.push(['active',w.rev]);
  const r=dispatch(w,player,wolf,{mode});trace.push(['combat',r.appliedDamage,w.resources[wolf].current.health,w.life[wolf].status,w.state.status]);
  const assessment=assess(w);trace.push(['assessment',assessment.status,assessment.reason]);
  if(assessment.status==='resolvable'){finish(w);const handoff=cleanup(w);trace.push(['closed',w.rev,w.disposition.outcome,handoff.participantEntityIds,w.events.length]);}
  return {w,trace};
}
// Authored literal numerical/semantic oracle, not generated from an execution.
const pveLiteral=[['prepared',[player,wolf]],['active',1],['combat',20,0,'dead','active'],['assessment','resolvable','rule_matched'],['closed',3,win,[player,wolf],1]];
contract('01 03 05 06 07 10 11 12 13 16 17 18 19','pve',a=>{
  const w=world();frozen(a,w.state);a.deepEqual(Object.keys(w.state),['encounterId','definitionId','status','sides','participants']);a.deepEqual(ids(w),[player,wolf]);
  const entities=token(w.entities),state=token(w.state),candidate=activation(w);a.equal(candidate.status,'activated','N01 canonical activation');a.equal(token(w.state),state);a.equal(token(w.entities),entities);start(w);
  const before=token(w.state);a.equal(currentScope(w).status,'eligible');a.equal(w.dispatches,0);a.equal(w.resources[wolf].current.health,20);
  a.equal(dispatch(w).appliedDamage,20);a.deepEqual(w.combatReceipts,[['admitted','accepted',20]],'N04 canonical receipts');a.equal(w.resources[wolf].current.health,0);a.equal(w.life[wolf].status,'dead');a.equal(w.life[player].status,'alive');a.equal(token(w.state),before,'N05 no automatic victory');a.equal(w.disposition,null);a.deepEqual(w.events,[]);
  const r=resolution(w);a.deepEqual(r.disposition.outcome,win);frozen(a,r);a.equal(w.state.status,'active');a.equal(commit(w,stage(w,r)),'accepted');a.equal(w.state.status,'resolved');a.equal(w.disposition.kind,'resolution');const c=close(w);a.equal(c.status,'closed');a.equal(commit(w,stage(w,c)),'accepted');const h=g.createEncounterCleanupHandoff(w.state,w.entities,w.disposition);frozen(a,h);a.deepEqual(h.participantEntityIds,[player,wolf]);a.deepEqual(w.events,[]);a.deepEqual(e2e().trace,pveLiteral);console.log('ENCOUNTER_FINAL_PVE_PASS');
});
contract('02 04 08 09 14 15 25 28','rejected-paths',a=>{
  const opaque=g.createEncounterState({definitionId:' D Đ '},{encounterId:' E Ω ',sides:[{sideId:' A '},{sideId:'b'}],participants:[{entityId:player,sideId:' A '}]},world().entities);a.equal(opaque.encounterId,' E Ω ');a.equal(opaque.definitionId,' D Đ ');a.equal(opaque.participants[0].sideId,' A ');
  const unready=world();unready.ready[wolf]=false;a.equal(activation(unready).status,'rejected','N01 activation readiness');a.equal(unready.state.status,'prepared');
  const prepared=world();hit(prepared);a.equal(assess(prepared).reason,'encounter_not_active');
  for(const [mode,outcome] of [['dodge','dodged'],['zero','zero_damage']]){const w=start(world()),r=dispatch(w,player,wolf,{mode});a.equal(r.outcome,outcome);a.equal(r.appliedDamage,0);a.equal(w.resources[wolf].current.health,20);a.equal(w.life[wolf].status,'alive');a.equal(assess(w).status,'pending');a.equal(w.disposition,null);}
  const w=start(world());dispatch(w);const observation=observe(w);a.equal(assess(w,{...observation,participants:[observation.participants[0]]}).reason,'participant_fact_missing','N06 missing Life blocks');
  for(const [source,target,reason] of [[reinforcement,wolf,'source_not_participant'],[player,reinforcement,'target_not_participant']]){const live=start(world()),before=snapshot(live);a.equal(dispatch(live,source,target),reason,'N02 outsider scope');a.equal(snapshot(live),before);a.equal(live.dispatches,0);}
  const deny=start(world()),before=snapshot(deny);a.equal(dispatch(deny,player,wolf,{eligible:false}),'source_ineligible','N04 canonical denial');a.equal(snapshot(deny),before);a.equal(deny.dispatches,0);
});
contract('20 21 22 23 24 27 55 56 58','skill-effect-ai',a=>{
  const w=start(world()),o=skillOwner(w),p=proposal(w);a.equal(p.selection.status,'selected');a.equal(w.dispatches,0);a.equal(o.feedback.length,0);
  const accepted=activateSupport(w,o,p);a.equal(accepted.status,'accepted');a.equal(o.resources.current.mana,75);a.equal(o.cooldown.readyAtMs,1750);a.deepEqual(o.feedback,[],'N08 accepted is not completed');a.equal(w.state.status,'active');
  const failed=feedback(o,p,accepted,'failed');a.equal(failed.status,'failed');a.equal(failed.phase,'execution');a.equal(o.resources.current.mana,75);a.equal(o.cooldown.readyAtMs,1750);a.equal(w.resources[wolf].current.health,20);
  a.equal(g.evaluateSkillCooldownReady(o.instance,o.cooldown,o.context).status,'active');o.clock.time=1750;a.equal(g.evaluateSkillCooldownReady(o.instance,o.cooldown,o.context).status,'ready');
  const restricted=start(world()),ro=skillOwner(restricted),rp=proposal(restricted);restrict(restricted,ro);const before=token(ro);a.equal(activateSupport(restricted,ro,rp),'effect_blocked','N07 fresh restriction');a.equal(token(ro),before);a.equal(restricted.dispatches,0);
  ro.clock.time=1500;const expiry=g.advanceEffectLifecycle(ro.lifecycle,ro.context);ro.status=g.applyEffectStatusTransition(ro.status,ro.lifecycle,expiry).state;ro.lifecycle=expiry.state;a.equal(g.evaluateEffectRestrictionGate(ro.lifecycle,ro.status,{blockedByRestrictionIds:['silenced']}).status,'allowed');a.equal(restricted.state.status,'active');
  const manual=start(world()),mo=skillOwner(manual),mp=proposal(manual);manual.controller='manual';const unchanged=token(mo);a.equal(activateSupport(manual,mo,mp),'manual_control','N09 current controller');a.equal(token(mo),unchanged);a.equal(manual.dispatches,0);a.equal(dispatch(manual).appliedDamage,20);a.deepEqual(mo.feedback,[]);
  const pet=start(world(['player','monster','pet']));change(pet,'join',reinforcement,'party');const po=skillOwner(pet,reinforcement),pp=proposal(pet,reinforcement,'skill',true),self=activateSupport(pet,po,pp);a.equal(self.status,'accepted');a.equal(pp.selection.decision.intent.targetEntityId,reinforcement);a.equal(feedback(po,pp,self,'completed').status,'completed');a.equal(pet.resources[wolf].current.health,20);
  const manualActor=g.createActorAIState(pet.actors[player],{profileId:'guard'},{controller:'manual',behaviorStateId:'engaged'});a.equal(g.evaluateActorAILifeGate(manualActor,pet.entities,pet.life[player]).reason,'manual_control');a.equal(pp.ai.controller,'ai');a.deepEqual(pet.state.participants.filter(p=>p.sideId==='party').map(p=>p.entityId),[player,reinforcement]);a.equal(dispatch(pet,player,wolf).appliedDamage,20);a.equal(manualActor.controller,'manual');a.equal(pp.ai.controller,'ai');
  // One complete L4 composition: self Skill, timed Effect, AI-selected canonical
  // Combat, explicit completion, terminal pair and cleanup. None auto-executes.
  const combined=start(world()),co=skillOwner(combined),support=proposal(combined,player,'skill',true,'support-D');
  const paid=activateSupport(combined,co,support);a.equal(feedback(co,support,paid,'completed').status,'completed');restrict(combined,co);co.clock.time=1500;
  const expired=g.advanceEffectLifecycle(co.lifecycle,co.context);co.status=g.applyEffectStatusTransition(co.status,co.lifecycle,expired).state;co.lifecycle=expired.state;
  const selected=proposal(combined,player,'basic_attack',false,'attack-D');a.equal(executeSelectedAttack(combined,co,selected).appliedDamage,20);
  a.deepEqual([co.resources.current.mana,co.cooldown.readyAtMs,co.lifecycle.effectState.instances.length,combined.life[wolf].status,combined.state.status,co.feedback.map(f=>[f.decisionId,f.status])],[75,1750,0,'dead','active',[['support-D','completed'],['attack-D','completed']]]);
  const owners=token(co);combined.owners=co;finish(combined);a.deepEqual(cleanup(combined).participantEntityIds,[player,wolf]);a.equal(token(co),owners);a.equal(combined.state.status,'closed');
  const cancelled=start(world());a.equal(commit(cancelled,stage(cancelled,cancellation(cancelled))),'accepted');a.equal(cancelled.disposition.kind,'cancellation');a.equal(cancelled.disposition.outcome,null);
});
contract('26 49 50 51 72','current-turn-authority',a=>{
  const leave=start(world()),old=currentScope(leave);a.equal(old.status,'eligible');change(leave,'leave',wolf);const before=snapshot(leave);a.equal(dispatch(leave),'target_not_participant','N10 departed target');a.equal(snapshot(leave),before);a.equal(leave.dispatches,0);
  const source=start(world());change(source,'leave',player);a.equal(turn(source,player,wolf),'source_not_participant','N22 queued leaver');a.equal(source.dispatches,0);
  const dead=start(world());hit(dead,player);const hp=dead.resources[wolf].current.health;a.equal(turn(dead,player,wolf),'source_dead','N21 queued dead');a.equal(dead.resources[wolf].current.health,hp);a.equal(dead.dispatches,0);
  const target=start(world());hit(target);a.equal(dispatch(target),'target_life_not_allowed');a.equal(target.dispatches,0);
  const side=start(world());change(side,'change_side',wolf,'party');a.equal(dispatch(side),'side_relation_not_allowed','N03 current side');a.equal(side.dispatches,0);
  const same=start(world()),p=stage(same,{state:same.state,status:'applied'}),shape=token(same.state);change(same,'leave',wolf);change(same,'join',wolf);a.equal(token(same.state),shape);a.equal(commit(same,p),'stale_revision','N26 same-shape freshness');
});
contract('29 30 31 32 33 34','waves',a=>{
  const w=start(world());dispatch(w);continuation(w,'pending');a.equal(assess(w).reason,'continuation_pending','N11 pending barrier');a.equal(resolution(w).state,null);a.equal(w.disposition,null);a.deepEqual(ids(w),[player,wolf]);a.equal(g.hasEntity(w.entities,reinforcement),true);a.equal(currentScope(w,player,reinforcement).reason,'target_not_participant');
  continuation(w,'clear');const stale=stage(w,resolution(w)),old=observe(w);continuation(w,'pending');a.equal(commit(w,stale),'stale_continuation','N27 new pending invalidates clear');
  change(w,'join');a.deepEqual(ids(w),[player,wolf,reinforcement],'N12 explicit reinforcement');a.equal(g.getEncounterParticipant(w.state,w.entities,reinforcement).sideId,'enemies');continuation(w,'clear');a.equal(assess(w,old).reason,'participant_fact_missing','N13 fresh wave facts');a.equal(assess(w).reason,'no_completion_condition_met');a.equal(dispatch(w,player,reinforcement).appliedDamage,20);a.equal(w.life[reinforcement].status,'dead');a.equal(w.state.status,'active');continuation(w,'pending');a.equal(assess(w).status,'pending','N14 explicit final clear');continuation(w,'clear');a.equal(assess(w).status,'resolvable');finish(w);a.equal(w.state.status,'closed');console.log('ENCOUNTER_FINAL_WAVE_PASS');
});
contract('35 36 37 38 44','objective-policy',a=>{
  const w=start(world());dispatch(w);w.policy={definitionId:'forest-patrol',rules:[{ruleId:'boss',kind:'objective',objectiveId:'crystal',whenStatus:'succeeded',outcome:win}]};objective(w,'pending');a.equal(assess(w).status,'pending','N15 required objective');objective(w,'succeeded');a.deepEqual(assess(w).outcome,win);a.equal(assess(w).ruleId,'boss');
  w.policy.rules.push({ruleId:'draw',kind:'objective',objectiveId:'crystal',whenStatus:'succeeded',outcome:{kind:'draw',winnerSideIds:[],defeatedSideIds:[]}});a.equal(assess(w).ruleId,'boss','N16 first matching priority');w.policy.rules.reverse();a.equal(assess(w).outcome.kind,'draw');
  const sides=[{sideId:' Guild Ω '},{sideId:'pet allies'},{sideId:'NPC Allies'}],custom=g.createEncounterState({definitionId:'custom'},{encounterId:'custom-E',sides,participants:[{entityId:player,sideId:' Guild Ω '},{entityId:wolf,sideId:'pet allies'},{entityId:reinforcement,sideId:'NPC Allies'}]},w.entities);a.deepEqual(custom.sides,sides);
  const active=g.activateEncounter(custom,w.entities,{minimumParticipants:1,minimumOccupiedSides:1,requiredOccupiedSideIds:[],allowedLifeStatuses:['alive','dead'],requireWorldReady:false},{encounterId:custom.encounterId,participants:custom.participants.map(p=>({entityId:p.entityId,life:w.life[p.entityId],worldReady:true}))}).state;
  const policy={definitionId:'custom',rules:[{ruleId:'coalition',kind:'objective',objectiveId:'boss',whenStatus:'succeeded',outcome:{kind:'victory',winnerSideIds:[' Guild Ω ','pet allies'],defeatedSideIds:['NPC Allies']}}]};const r=g.resolveEncounter(active,w.entities,policy,{encounterId:active.encounterId,participants:active.participants.map(p=>({entityId:p.entityId,life:w.life[p.entityId]})),objectives:[{objectiveId:'boss',status:'succeeded'}],continuation:'clear'});a.deepEqual(r.disposition.outcome.winnerSideIds,[' Guild Ω ','pet allies']);a.equal('rewards' in r.disposition,false);
});
function dungeon(){const room=start(world()),boss=world();boss.state=g.createEncounterState({definitionId:'forest-patrol'},{encounterId:'crypt-boss-001',sides:boss.state.sides,participants:[{entityId:reinforcement,sideId:'enemies'}]},boss.entities);return {dungeonId:'crypt-dungeon-001',room,boss};}
contract('39 40 41 42 43','dungeon',a=>{
  const {room,boss}=dungeon(),bossBefore=snapshot(boss);dispatch(room);finish(room);a.equal(room.state.status,'closed');a.equal(boss.state.status,'prepared','N18 no auto activation');a.equal(snapshot(boss),bossBefore);a.notEqual(room.state.encounterId,boss.state.encounterId);a.notEqual(room.cleanupReceipts,boss.cleanupReceipts,'N17 independent ledgers');a.equal(boss.disposition,null);a.equal(room.disposition.kind,'resolution');a.equal(currentScope(room,player,reinforcement).reason,'encounter_not_active');
  const fresh=dungeon();a.equal(dispatch(fresh.room,player,reinforcement),'target_not_participant','N19 foreign dungeon target');a.equal(fresh.room.dispatches,0);const b=snapshot(fresh.boss);change(fresh.room,'leave',wolf);change(fresh.room,'join',wolf);a.equal(snapshot(fresh.boss),b);
  a.equal(commit(boss,stage(boss,cancellation(boss))),'accepted');a.equal(boss.state.status,'cancelled');a.equal(boss.disposition.kind,'cancellation');a.equal(room.state.status,'closed');a.equal(room.disposition.kind,'resolution');console.log('ENCOUNTER_FINAL_DUNGEON_PASS');
});
function turns(order){const w=start(world()),trace=[];for(const actor of order){const target=actor===player?wolf:player;const result=turn(w,actor,target);trace.push([actor,typeof result==='string'?result:result.appliedDamage]);if(typeof result!=='string'&&assess(w).status==='resolvable')finish(w);}return {w,trace};}
contract('45 46 47 48 52 53 54 57','turns',a=>{
  const idle=start(world());a.deepEqual(idle.turns,[],'N20 external turns only');a.equal(idle.dispatches,0);const p=proposal(idle,player,'basic_attack');a.equal(p.selection.status,'selected');a.equal(idle.dispatches,0);a.equal(turn(idle,player,wolf).appliedDamage,20);a.deepEqual(idle.turns,[player]);
  const expected=[[player,20],[wolf,'encounter_not_active']],one=turns([player,wolf]),two=turns([player,wolf]);a.deepEqual(one.trace,expected);a.deepEqual(two.trace,expected);a.equal(one.w.dispatches,1,'N23 terminal blocks queued turn');a.equal(one.w.state.status,'closed');a.equal(one.w.resources[player].current.health,100);
  const reverse=turns([wolf,player]);a.deepEqual(reverse.trace,[[wolf,100],[player,'encounter_not_active']]);a.equal(reverse.w.disposition.outcome.winnerSideIds[0],'enemies');a.notDeepEqual(reverse.trace,expected);
  const draw=start(world());draw.policy={definitionId:'forest-patrol',rules:[{ruleId:'turn-limit',kind:'objective',objectiveId:'crystal',whenStatus:'succeeded',outcome:{kind:'draw',winnerSideIds:[],defeatedSideIds:[]}}]};objective(draw,'succeeded');const r=resolution(draw);a.deepEqual(r.disposition.outcome,{kind:'draw',winnerSideIds:[],defeatedSideIds:[]},'N24 exact draw arrays');finish(draw);a.equal(turn(draw,player,wolf),'encounter_not_active');
  const cancelled=start(world());a.equal(commit(cancelled,stage(cancelled,cancellation(cancelled))),'accepted');a.equal(turn(cancelled,wolf,player),'encounter_not_active');a.equal(cancelled.disposition.outcome,null);a.deepEqual(Object.keys(one.w.state),['encounterId','definitionId','status','sides','participants']);console.log('ENCOUNTER_FINAL_TURN_PASS');
});
contract('59 60','module-composition',a=>{
  const registry=['entity','progression','combat','skill','effect','actor-ai','encounter'].reduce((r,id)=>g.registerModule(r,{id,optional:true,dependencies:id==='entity'?[]:['entity']}),g.createModuleRegistry());
  a.deepEqual(g.composeModules(registry,g.configureModules(registry,{enable:['entity','encounter']})).moduleIds,['entity','encounter']);a.deepEqual(g.composeModules(registry,g.configureModules(registry,{enable:['entity','combat','skill','effect','actor-ai','encounter']})).moduleIds,['entity','combat','skill','effect','actor-ai','encounter']);a.equal(e2e().w.state.status,'closed');
});
contract('68','immutable-inputs',a=>{
  const w=world(),copy=token(w.state),validated=g.validateEncounterState(w.state,w.entities);frozen(a,validated);a.notEqual(validated.participants,w.state.participants,'N32 detached roster');a.throws(()=>validated.participants.push({entityId:reinforcement,sideId:'enemies'}),TypeError);a.equal(token(w.state),copy);let getters=0;a.throws(()=>g.createEncounterDefinitionReference({get definitionId(){getters++;return 'D';}}),TypeError);a.equal(getters,0);
});
contract('69 70 71','literal-replay',a=>{
  const one=e2e(),two=e2e();a.deepEqual(one.trace,pveLiteral);a.deepEqual(two.trace,pveLiteral);a.notEqual(one.w,two.w);a.notEqual(one.w.cleanupReceipts,two.w.cleanupReceipts);a.notEqual(one.w.life,two.w.life);
  const dodge=e2e('dodge');a.deepEqual(dodge.trace,[['prepared',[player,wolf]],['active',1],['combat',0,20,'alive','active'],['assessment','pending','no_completion_condition_met']]);a.notDeepEqual(dodge.trace,pveLiteral);a.equal(dodge.w.calls,1);
  const original=[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval],trap=()=>{throw new Error('N31 hidden provider');};try{Date.now=trap;Math.random=trap;globalThis.setTimeout=trap;globalThis.setInterval=trap;a.deepEqual(e2e().trace,pveLiteral);}finally{[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval]=original;}
  console.log('ENCOUNTER_FINAL_REPLAY_SEMANTIC_SHA256 '+createHash('sha256').update(token(pveLiteral)).digest('hex'));
});
contract('73','terminal-atomic-cleanup',a=>{
  const w=start(world());dispatch(w);const r=stage(w,resolution(w)),before=snapshot(w);a.throws(()=>commit(w,r,true),/atomic staging failure/);a.equal(snapshot(w),before,'N28 atomic status disposition');
  const closed=g.closeEncounter(r.candidate.state,w.entities,r.candidate.disposition);a.equal(cleanup(w,closed),'unauthorized_cleanup','N29 no premature World work');a.equal(w.events.length,0);
  a.equal(commit(w,r),'accepted');const freshCancel=cancellation(start(world()));a.equal(commit(w,stage(w,freshCancel)),'terminal_guard','N25 terminal independent guard');a.equal(commit(w,stage(w,close(w))),'accepted');const first=cleanup(w);a.deepEqual(first.participantEntityIds,[player,wolf]);a.equal(cleanup(w),'duplicate_cleanup','N30 no double cleanup');a.equal(w.events.length,1);
  const ledger=start(world()),firstDecision=proposal(ledger,player,'basic_attack',false,'D1'),nextDecision=proposal(ledger,player,'basic_attack',false,'D2');
  a.equal(currentScope(ledger).status,'eligible');a.equal(g.evaluateActorAILifeGate(firstDecision.ai,ledger.entities,ledger.life[player]).status,'allowed');a.equal(firstDecision.rev,ledger.rev);a.equal(nextDecision.rev,ledger.rev);a.equal(firstDecision.selection.status,'selected');a.equal(nextDecision.selection.status,'selected');
  a.equal(freshDecision(ledger,firstDecision.selection.decision.intent.decisionId,'A1'),'accepted');a.equal(freshDecision(ledger,firstDecision.selection.decision.intent.decisionId,'A2'),'duplicate_decision','independent duplicate decision');a.equal(freshDecision(ledger,nextDecision.selection.decision.intent.decisionId,'A1'),'duplicate_attempt','independent duplicate attempt');a.equal(ledger.decisions.size,1);a.equal(ledger.attempts.size,1);
  console.log('ENCOUNTER_FINAL_TERMINAL_PASS');
});
contract('52','terminal-alive-turn',a=>{
  const w=start(world());a.equal(commit(w,stage(w,cancellation(w))),'accepted');a.equal(w.life[player].status,'alive');a.equal(w.life[wolf].status,'alive');a.equal(turn(w,player,wolf),'encounter_not_active','N23 alive terminal turn');a.equal(w.dispatches,0);a.equal(w.resources[wolf].current.health,20);
});
