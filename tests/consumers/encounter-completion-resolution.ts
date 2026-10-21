import {createEntity,createEntityCollection,addEntity,createEntityLifeState,createEncounterState,
  createEncounterCompletionPolicy,createEncounterCompletionObservation,evaluateEncounterCompletion,
  type EncounterParticipantLifeFact,type EncounterObjectiveStatus,type EncounterObjectiveFact,type EncounterContinuation,
  type EncounterCompletionObservation,type EncounterVictoryOutcomeTemplate,type EncounterDrawOutcomeTemplate,
  type EncounterOutcomeTemplate,type EncounterCompletionRule,type EncounterCompletionPolicy,type EncounterResolutionOutcome,
  type EncounterCompletionPendingReason,type EncounterCompletionAssessment} from '@rpg/gameplay';
const entity=createEntity({id:'A',kind:'custom'}),entities=addEntity(createEntityCollection(),entity);
const life:EncounterParticipantLifeFact={entityId:entity.id,life:createEntityLifeState(entity,{status:'alive'})};
const status:EncounterObjectiveStatus='succeeded',fact:EncounterObjectiveFact={objectiveId:'O',status};
const continuation:EncounterContinuation='clear';
const observation:EncounterCompletionObservation=createEncounterCompletionObservation({encounterId:'E',participants:[life],objectives:[fact],continuation});
const win:EncounterVictoryOutcomeTemplate={kind:'victory',winnerSideIds:['one'],defeatedSideIds:[]};
const draw:EncounterDrawOutcomeTemplate={kind:'draw',winnerSideIds:[],defeatedSideIds:[]};
const template:EncounterOutcomeTemplate=Math.random()?win:draw;
const rule:EncounterCompletionRule={ruleId:'R',kind:'objective',objectiveId:'O',whenStatus:'succeeded',outcome:template};
const policy:EncounterCompletionPolicy=createEncounterCompletionPolicy({definitionId:'D',rules:[rule,{ruleId:'S',kind:'side_elimination',contenderSideIds:['one','two'],zeroSurvivors:'draw'}]});
const state=createEncounterState({definitionId:'D'},{encounterId:'E',sides:[{sideId:'one'},{sideId:'two'}],participants:[{entityId:'A',sideId:'one'}]},entities);
const result:EncounterCompletionAssessment=evaluateEncounterCompletion(state,entities,policy,observation);
if(result.status==='resolvable'){
  const reason:'rule_matched'=result.reason,id:string=result.ruleId,missing:null=result.participantEntityId;
  const outcome:EncounterResolutionOutcome=result.outcome;
  if(outcome.kind==='draw'){const empty:readonly []=outcome.winnerSideIds;void empty;}
  // @ts-expect-error immutable outcome sides
  outcome.winnerSideIds.push('third');
  void [reason,id,missing];
}else{
  const reason:EncounterCompletionPendingReason=result.reason,id:null=result.ruleId,outcome:null=result.outcome;void [reason,id,outcome];
}
// @ts-expect-error readonly observation continuation
observation.continuation='pending';
// @ts-expect-error required continuation
createEncounterCompletionObservation({encounterId:'E',participants:[],objectives:[]});
// @ts-expect-error invalid completion assessment status
const badStatus:EncounterCompletionAssessment={status:'resolved',reason:'rule_matched',encounterId:'E',ruleId:'R',participantEntityId:null,outcome:win};
// @ts-expect-error no encounter-global defeat kind
const badKind:EncounterOutcomeTemplate={kind:'defeat',winnerSideIds:[],defeatedSideIds:[]};
// @ts-expect-error pending cannot select an objective rule
const badRule:EncounterCompletionRule={ruleId:'R',kind:'objective',objectiveId:'O',whenStatus:'pending',outcome:win};
// @ts-expect-error victory requires defeated list even if empty
const missingOutcome:EncounterOutcomeTemplate={kind:'victory',winnerSideIds:['one']};
void [badStatus,badKind,badRule,missingOutcome];
