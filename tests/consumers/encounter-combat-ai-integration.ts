import {createEncounterActionScopePolicy,createEncounterActionScopeRequest,evaluateEncounterActionScope,createEntityCollection,createEncounterState} from '@rpg/gameplay';
import type {EncounterActionTargetMode,EncounterSideMembershipRelation,EncounterActionScopePolicy,EncounterActionScopeRequest,EncounterActionScopeRejectionReason,EncounterActionScopeResult} from '@rpg/gameplay';
const mode:EncounterActionTargetMode='participant';const relation:EncounterSideMembershipRelation='other_side';
const p:EncounterActionScopePolicy=createEncounterActionScopePolicy({targetMode:mode,allowedSideRelations:[relation]});
const r:EncounterActionScopeRequest=createEncounterActionScopeRequest({encounterId:'E',actionId:'A',sourceEntityId:'S',targetEntityId:null});
const reason:EncounterActionScopeRejectionReason='target_required';void reason;
const entities=createEntityCollection();const state=createEncounterState({definitionId:'D'},{encounterId:'E',sides:[],participants:[]},entities);
const out:EncounterActionScopeResult=evaluateEncounterActionScope(state,entities,p,r);
if(out.status==='eligible'){const why:'none'=out.reason;const side:string=out.sourceSideId;void why;void side;}else{const why:EncounterActionScopeRejectionReason=out.reason;void why;}
// @ts-expect-error immutable policy
p.targetMode='none';
// @ts-expect-error immutable relation list
p.allowedSideRelations.push('self');
// @ts-expect-error immutable request
r.actionId='B';
// @ts-expect-error immutable result
out.sourceSideId='party';
// @ts-expect-error Combat relation is not Encounter membership
const bad:EncounterSideMembershipRelation='enemy';void bad;
// @ts-expect-error Encounter scope is not canonical admission
const admitted:'admitted'=out.status;void admitted;
// @ts-expect-error target ID is required even when null
createEncounterActionScopeRequest({encounterId:'E',actionId:'A',sourceEntityId:'S'});
// @ts-expect-error unknown result discriminant
const invalid:EncounterActionScopeResult={status:'completed',reason:'none'};void invalid;
