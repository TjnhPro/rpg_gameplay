import {createEntityCollection,createEntity,addEntity,createEntityLifeState,createEncounterState,
  createEncounterCompletionObservation,evaluateEncounterCompletion,resolveEncounter,
  createEncounterMembershipPolicy,applyEncounterMembershipChange,activateEncounter,
  closeEncounter,cancelEncounter,createEncounterCleanupHandoff,
  type EncounterState,type EncounterCompletionObservation,type EncounterDispositionRecord,
  type EncounterMembershipRequest,type EncounterCompletionAssessment} from '@rpg/gameplay';
const entity=createEntity({id:'hero',kind:'custom'}),entities=addEntity(createEntityCollection(),entity),life=createEntityLifeState(entity,{status:'alive'});
const state:EncounterState=createEncounterState({definitionId:'D'},{encounterId:'E',sides:[{sideId:'party'}],participants:[{entityId:'hero',sideId:'party'}]},entities);
const observation:EncounterCompletionObservation=createEncounterCompletionObservation({encounterId:'E',participants:[{entityId:'hero',life}],objectives:[],continuation:'pending'});
const policy={definitionId:'D',rules:[]} as const;
const assessment:EncounterCompletionAssessment=evaluateEncounterCompletion(state,entities,policy,observation);
const activation=activateEncounter(state,entities,{minimumParticipants:1,minimumOccupiedSides:1,requiredOccupiedSideIds:[],allowedLifeStatuses:['alive'],requireWorldReady:true},{encounterId:'E',participants:[{entityId:'hero',life,worldReady:true}]});
const membershipPolicy=createEncounterMembershipPolicy({joinAllowedStatuses:['active'],leaveAllowedStatuses:['active'],changeSideAllowedStatuses:['active'],allowedJoinLifeStatuses:['alive'],requireWorldReadyOnJoin:true});
const request:EncounterMembershipRequest={operation:'leave',encounterId:'E',entityId:'hero'};
const change=applyEncounterMembershipChange(state,entities,membershipPolicy,request);
if(change.status==='rejected'){const nothing:null=change.state;void nothing;}
const result=resolveEncounter(state,entities,policy,observation);
if(result.status==='resolved'){
  const record:EncounterDispositionRecord=result.disposition,closed=closeEncounter(result.state,entities,record);
  if(closed.status==='closed')createEncounterCleanupHandoff(closed.state,entities,closed.disposition);
}
const cancelled=cancelEncounter(state,entities,{definitionId:'D',cancelAllowedStatuses:['prepared']},{encounterId:'E',reasonId:'abort'});
// @ts-expect-error no wave field in the five-field Encounter state
state.waveIndex=1;
// @ts-expect-error no mutable continuation in detached observation
observation.continuation='clear';
// @ts-expect-error roster is immutable
state.participants.push({entityId:'other',sideId:'party'});
// @ts-expect-error observation Life discriminant must be canonical
createEncounterCompletionObservation({encounterId:'E',participants:[{entityId:'hero',life:{entityId:'hero',status:'revived'}}],objectives:[],continuation:'clear'});
// @ts-expect-error cached assessment is not a current observation
resolveEncounter(state,entities,policy,assessment);
void [activation,cancelled];
