import {createEncounterActivationPolicy,createEncounterActivationObservation,evaluateEncounterActivationAdmission,activateEncounter,
 createEncounterState,createEntityCollection,addEntity,createEntityLifeState,createEntity,
 type EncounterParticipantActivationFact,type EncounterActivationObservation,type EncounterActivationPolicy,
 type EncounterActivationRejectionReason,type EncounterActivationAdmissionResult,type EncounterActivationTransitionResult} from '@rpg/gameplay';
const entity=createEntity({id:'X',kind:'custom'}),entities=addEntity(createEntityCollection(),entity);
const state=createEncounterState({definitionId:'D'},{encounterId:'E',sides:[{sideId:'S'}],participants:[{entityId:'X',sideId:'S'}]},entities);
const fact:EncounterParticipantActivationFact={entityId:'X',life:createEntityLifeState(entity,{status:'alive'}),worldReady:true};
const policy:EncounterActivationPolicy=createEncounterActivationPolicy({requiredOccupiedSideIds:[],minimumParticipants:1,minimumOccupiedSides:1,allowedLifeStatuses:['alive','dead'],requireWorldReady:false});
const observation:EncounterActivationObservation=createEncounterActivationObservation({encounterId:'E',participants:[fact]});
const admission:EncounterActivationAdmissionResult=evaluateEncounterActivationAdmission(state,entities,policy,observation);
const transition:EncounterActivationTransitionResult=activateEncounter(state,entities,policy,observation);
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
const reasons:Equal<EncounterActivationRejectionReason,'not_prepared'|'insufficient_participants'|'insufficient_occupied_sides'|'required_side_unoccupied'|'participant_fact_missing'|'participant_life_not_allowed'|'participant_world_not_ready'>=true;
const admissionKeys:Equal<keyof EncounterActivationAdmissionResult,'status'|'reason'|'encounterId'|'sideId'|'entityId'>=true;
const transitionKeys:Equal<keyof EncounterActivationTransitionResult,'status'|'reason'|'encounterId'|'state'>=true;
void reasons;void admissionKeys;void transitionKeys;
// @ts-expect-error Activation policy is readonly in actual installed declarations.
policy.requireWorldReady=true;
// @ts-expect-error Readonly nested policy list.
policy.allowedLifeStatuses.push('alive');
// @ts-expect-error Readonly observation fact.
observation.participants[0]!.worldReady=false;
// @ts-expect-error Canonical Life is readonly.
fact.life.status='dead';
// @ts-expect-error Admission has no candidate state.
admission.state;
if(transition.status==='activated'){
 const reason:'none'=transition.reason;void reason;
 // @ts-expect-error Candidate nested roster remains readonly.
 transition.state.participants[0]!.sideId='other';
}else{const empty:null=transition.state;void empty;}
// @ts-expect-error No admission token overload.
activateEncounter(admission);
// @ts-expect-error All policy fields mandatory.
createEncounterActivationPolicy({minimumParticipants:1});
// @ts-expect-error No hidden package subpath.
import {} from '@rpg/gameplay/modules/encounter';
