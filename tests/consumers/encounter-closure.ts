import {createEntityCollection,createEncounterState,createEncounterClosurePolicy,resolveEncounter,closeEncounter,
  cancelEncounter,createEncounterCleanupHandoff,type EncounterDispositionRecord,type EncounterResolutionTransitionResult,
  type EncounterCloseTransitionResult,type EncounterClosurePolicy,type EncounterCancellationRequest,
  type EncounterCancellationTransitionResult,type EncounterCleanupHandoff,type EncounterResolutionOutcome,
  type EncounterStatus,type EncounterCompletionAssessment} from '@rpg/gameplay';
const entities=createEntityCollection(),state=createEncounterState({definitionId:'D'},{encounterId:'E',sides:[],participants:[]},entities);
const policy:EncounterClosurePolicy=createEncounterClosurePolicy({definitionId:'D',cancelAllowedStatuses:['prepared','active']});
const request:EncounterCancellationRequest={encounterId:'E',reasonId:'abort'};
const r:EncounterResolutionTransitionResult=resolveEncounter(state,entities,{definitionId:'D',rules:[]},{encounterId:'E',participants:[],objectives:[],continuation:'clear'});
const d:EncounterDispositionRecord=r.status==='resolved'?r.disposition:{kind:'cancellation',encounterId:'E',definitionId:'D',reasonId:'abort',outcome:null};
const c:EncounterCloseTransitionResult=closeEncounter(state,entities,d),x:EncounterCancellationTransitionResult=cancelEncounter(state,entities,policy,request);
const h:EncounterCleanupHandoff=createEncounterCleanupHandoff(state,entities,d);
if(r.status==='rejected'){const n:null=r.state,n2:null=r.disposition;void [n,n2];}else{const status:EncounterStatus=r.state.status;void status;}
if(d.kind==='resolution'){const outcome:EncounterResolutionOutcome=d.outcome,rule:string=d.ruleId;void [outcome,rule];}else{const outcome:null=d.outcome,reason:string=d.reasonId;void [outcome,reason];}
// @ts-expect-error immutable cleanup references
h.participantEntityIds.push('actor');
// @ts-expect-error readonly cancellation reason
request.reasonId='changed';
// @ts-expect-error closure policy cannot allow terminal status
createEncounterClosurePolicy({definitionId:'D',cancelAllowedStatuses:['closed']});
// @ts-expect-error cancellation disposition must not contain outcome
const bad:EncounterDispositionRecord={kind:'cancellation',encounterId:'E',definitionId:'D',reasonId:'R',outcome:{kind:'draw',winnerSideIds:[],defeatedSideIds:[]}};
// @ts-expect-error pending is not a close result discriminant
const badClose:EncounterCloseTransitionResult={status:'pending',reason:'none',encounterId:'E',state:null,disposition:null};
// @ts-expect-error a cached assessment is not an observation
resolveEncounter(state,entities,{definitionId:'D',rules:[]},{} as EncounterCompletionAssessment);
// @ts-expect-error readonly disposition identity
d.encounterId='other';
void [c,x,bad,badClose];
