import {addInventoryEntry,removeInventoryEntry,adjustInventoryQuantity,
  type InventoryOperationAdmission,type InventoryMutationReason,type InventoryTransitionResult,
  type InventoryState,type InventoryValidationContext,type InventoryEntry} from '@rpg/gameplay';
const state:InventoryState={inventoryId:'bag',owner:null,entries:[]};
const context:InventoryValidationContext={items:[]};
const entry:InventoryEntry={item:{instanceId:'i',definitionId:'d',properties:{}},quantity:4};
const admission:InventoryOperationAdmission={eligible:true};
const added:InventoryTransitionResult<InventoryMutationReason>=addInventoryEntry(state,context,entry,{maxEntries:null},admission);
const removed:InventoryTransitionResult<InventoryMutationReason>=removeInventoryEntry(state,context,'i',admission);
const adjusted:InventoryTransitionResult<InventoryMutationReason>=adjustInventoryQuantity(state,context,'i',1,admission);
if(added.status==='accepted') {
  const reason:'none'=added.reason;
  const candidate:InventoryState=added.candidate;
  // @ts-expect-error immutable candidate
  candidate.entries.push(entry);
  void reason;
} else {
  const absent:null=added.candidate;
  const reason:InventoryMutationReason=added.reason;
  void [absent,reason];
}
// @ts-expect-error admission must be explicit
addInventoryEntry(state,context,entry,{maxEntries:null});
// @ts-expect-error no default eligibility
const missing:InventoryOperationAdmission={};
// @ts-expect-error immutable admission
admission.eligible=false;
// @ts-expect-error rejected outcome cannot carry candidate
const invalid:InventoryTransitionResult<InventoryMutationReason>={status:'rejected',reason:'ineligible',candidate:state};
// @ts-expect-error closed reason union
const wrong:InventoryMutationReason='overflow';
void [removed,adjusted,missing,invalid,wrong];
