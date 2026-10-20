import {validateActorAIActionExecutionFeedback, type ActorAIActionExecutionFeedback,
  type ActorAIActionSelectionResult, type ActorAIActionIntent, type CombatDamageApplicationResult,
  type SkillActivationResult, type SkillExecutionOutcome, type EffectRestrictionAssessment} from '@rpg/gameplay';
declare const selection: ActorAIActionSelectionResult;
const report: ActorAIActionExecutionFeedback = {decisionId:'D',actorId:'A',actionKey:'attack',targetEntityId:'T',
  attemptId:'attempt',phase:'execution',status:'completed',reasonId:null};
const snapshot: ActorAIActionExecutionFeedback = validateActorAIActionExecutionFeedback(selection,report);
const intent: ActorAIActionIntent = snapshot; void intent;
if(snapshot.phase === 'admission') {const status:'rejected'=snapshot.status;const reason:string=snapshot.reasonId;void status;void reason;}
else if(snapshot.status === 'completed') {const reason:null=snapshot.reasonId;void reason;}
else {const status:'failed'=snapshot.status;const reason:string=snapshot.reasonId;void status;void reason;}
const rejected: ActorAIActionExecutionFeedback={...report,phase:'admission',status:'rejected',reasonId:'canonical_gate'};
const failed: ActorAIActionExecutionFeedback={...report,phase:'execution',status:'failed',reasonId:'dispatch_failed'};void rejected;void failed;
// @ts-expect-error Closed terminal phase/status contract.
const badPhase: ActorAIActionExecutionFeedback={...report,phase:'admission',status:'completed'};void badPhase;
// @ts-expect-error Completion requires null reason.
const badReason: ActorAIActionExecutionFeedback={...report,phase:'execution',status:'completed',reasonId:'accepted'};void badReason;
// @ts-expect-error No accepted terminal status.
const badStatus: ActorAIActionExecutionFeedback={...report,status:'accepted'};void badStatus;
// @ts-expect-error attemptId mandatory.
const missingAttempt: ActorAIActionExecutionFeedback={decisionId:'D',actorId:'A',actionKey:'x',targetEntityId:null,phase:'execution',status:'completed',reasonId:null};void missingAttempt;
// @ts-expect-error Immutable feedback.
snapshot.attemptId='changed';
// @ts-expect-error Scalar closed feedback, no damage or receipt authority.
const extra: ActorAIActionExecutionFeedback={...report,damage:20};void extra;
declare const combat: CombatDamageApplicationResult;
declare const activation: SkillActivationResult;
declare const outcome: SkillExecutionOutcome;
declare const restriction: EffectRestrictionAssessment;
if(activation.status === 'accepted') {const requestAttempt:string=activation.request.attemptId;void requestAttempt;}
if(combat.outcome === 'processed') {const damage:number=combat.appliedDamage;void damage;}
const terminalStatus:'completed'|'failed'=outcome.status;
const contribution:'allowed'|'blocked'=restriction.status;void terminalStatus;void contribution;
// @ts-expect-error Root-only package export.
import {} from '@rpg/gameplay/modules/actor-ai';
