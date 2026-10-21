import {mergeInventoryEntries,type InventoryState,type InventoryValidationContext,
  type InventoryMergeReason,type InventoryTransitionResult} from '@rpg/gameplay';
const state:InventoryState={inventoryId:'bag',owner:null,entries:[]};
const context:InventoryValidationContext={items:[]};
const result:InventoryTransitionResult<InventoryMergeReason>=mergeInventoryEntries(state,context,'s','d',{eligible:true});
if(result.status==='accepted') {
  const candidate:InventoryState=result.candidate;
  const reason:'none'=result.reason;
  // @ts-expect-error snapshot membership is immutable
  candidate.entries.pop();
  // @ts-expect-error candidate identity is immutable
  candidate.inventoryId='changed';
  void reason;
} else {
  const absent:null=result.candidate;
  const reason:InventoryMergeReason=result.reason;
  void [absent,reason];
}
// @ts-expect-error admission is explicit
mergeInventoryEntries(state,context,'s','d');
// @ts-expect-error no unapproved split outcome
const reason:InventoryMergeReason='partial_merge';
// @ts-expect-error rejected outcome cannot carry state
const invalid:InventoryTransitionResult<InventoryMergeReason>={status:'rejected',reason:'missing_entry',candidate:state};
void [reason,invalid];
