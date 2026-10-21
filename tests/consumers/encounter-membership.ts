import {
 createEncounterMembershipPolicy, createEncounterMembershipRequest, getEncounterParticipant,
 evaluateEncounterMembershipAdmission, applyEncounterMembershipChange,
 createEntityCollection, createEncounterState, createEncounterDefinitionReference,
 type EncounterMembershipOperation, type EncounterMembershipOpenStatus, type EncounterMembershipPolicy,
 type EncounterMembershipRequest, type EncounterMembershipRejectionReason,
 type EncounterMembershipAdmissionResult, type EncounterMembershipTransitionResult,
 type EncounterParticipantActivationFact, type EntityLifeStatus, type EncounterState,
} from '@rpg/gameplay';
const operation: EncounterMembershipOperation = 'join';
const open: EncounterMembershipOpenStatus = 'active';
const life: EntityLifeStatus = 'alive';
const fact: EncounterParticipantActivationFact = {entityId:'actor',life:{entityId:'actor',status:life},worldReady:true};
const policy: EncounterMembershipPolicy = createEncounterMembershipPolicy({joinAllowedStatuses:[open],leaveAllowedStatuses:[],changeSideAllowedStatuses:[],allowedJoinLifeStatuses:[life],requireWorldReadyOnJoin:true});
const request: EncounterMembershipRequest = createEncounterMembershipRequest({operation,encounterId:'fight',entityId:'actor',sideId:'team',readiness:fact});
const entities=createEntityCollection();
const state: EncounterState=createEncounterState(createEncounterDefinitionReference({definitionId:'content'}),{encounterId:'fight',sides:[],participants:[]},entities);
const admission: EncounterMembershipAdmissionResult=evaluateEncounterMembershipAdmission(state,entities,policy,request);
const result: EncounterMembershipTransitionResult=applyEncounterMembershipChange(state,entities,policy,request);
const member=getEncounterParticipant(state,entities,'actor');
if(member){const side:string=member.sideId;void side;
 // @ts-expect-error membership snapshots are readonly
 member.sideId='other';
}
// @ts-expect-error membership policy boolean is readonly
policy.requireWorldReadyOnJoin=false;
// @ts-expect-error membership policy lists are readonly
policy.joinAllowedStatuses.push('prepared');
// @ts-expect-error membership request is readonly
request.encounterId='other';
if(request.operation==='join'){
 const ready:boolean=request.readiness.worldReady;void ready;
 // @ts-expect-error nested canonical Life is readonly
 request.readiness.life.status='dead';
}
const leave:EncounterMembershipRequest={operation:'leave',encounterId:'fight',entityId:'actor'};
// @ts-expect-error leave cannot carry readiness
const badLeave:EncounterMembershipRequest={operation:'leave',encounterId:'fight',entityId:'actor',readiness:fact};
// @ts-expect-error transfer cannot carry readiness
const badTransfer:EncounterMembershipRequest={operation:'change_side',encounterId:'fight',entityId:'actor',sideId:'other',readiness:fact};
// @ts-expect-error join requires readiness
const badJoin:EncounterMembershipRequest={operation:'join',encounterId:'fight',entityId:'actor',sideId:'other'};
if(result.status==='applied'){
 const next:EncounterState=result.state;const reason:'none'=result.reason;void next;void reason;
 // @ts-expect-error applied cannot have null state
 const no:null=result.state;void no;
 // @ts-expect-error candidate roster is readonly
 result.state.participants.push({entityId:'other',sideId:'other'});
}else{
 const no:null=result.state;const reason:EncounterMembershipRejectionReason=result.reason;void no;void reason;
 // @ts-expect-error rejection cannot carry a state
 const next:EncounterState=result.state;void next;
}
if(admission.status==='admitted'){const reason:'none'=admission.reason;void reason;}else{const reason:EncounterMembershipRejectionReason=admission.reason;void reason;}
// @ts-expect-error admission is not a transition request token
applyEncounterMembershipChange(state,entities,policy,admission);
void [leave,badLeave,badTransfer,badJoin];
