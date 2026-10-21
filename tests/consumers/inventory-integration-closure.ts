import {createItemDefinition,createItemInstance,createInventoryState,validateInventoryState,
  addInventoryEntry,adjustInventoryQuantity,mergeInventoryEntries,removeInventoryEntry,
  getInventoryEntry,listInventoryEntries,hasInventoryItem,assessInventoryCapacity,
  type InventoryState,type InventoryValidationContext,type InventoryEntry,
  type InventoryMergeReason,type InventoryMutationReason,type InventoryTransitionResult,
  type ItemInstanceState} from '@rpg/gameplay';
const definition=createItemDefinition({definitionId:'d'},
  {categoryId:null,tagIds:[],rarityId:null,properties:{}});
const item=createItemInstance(definition,{instanceId:'a',properties:{nested:[1]}});
const context:InventoryValidationContext={items:[{definition,stackPolicy:{stackable:true},maxStackQuantity:9}]};
const empty:InventoryState=createInventoryState({inventoryId:'bag',owner:null,entries:[]},context);
const result:InventoryTransitionResult<InventoryMutationReason>=addInventoryEntry(empty,context,{item,quantity:3},{maxEntries:3},{eligible:true});
if(result.status==='accepted') {
  const snapshot:InventoryState=validateInventoryState(result.candidate,context);
  const adjusted=adjustInventoryQuantity(snapshot,context,'a',2,{eligible:true});
  const merged:InventoryTransitionResult<InventoryMergeReason>=mergeInventoryEntries(snapshot,context,'b','a',{eligible:true});
  const removed=removeInventoryEntry(snapshot,context,'a',{eligible:true});
  const entry:InventoryEntry|null=getInventoryEntry(snapshot,context,'a');
  const list:readonly InventoryEntry[]=listInventoryEntries(snapshot,context);
  const present:boolean=hasInventoryItem(snapshot,context,'a');
  const fits:boolean=assessInventoryCapacity(snapshot,context,{maxEntries:3},1).fits;
  if(entry) {
    const handoff:ItemInstanceState=entry.item;
    // @ts-expect-error immutable Item snapshot
    handoff.properties.other=1;
    // @ts-expect-error immutable quantity
    entry.quantity=5;
  }
  // @ts-expect-error immutable membership
  list.push({item,quantity:1});
  // @ts-expect-error no slots or new state shape
  snapshot.slots=[];
  if(merged.status==='accepted') {
    const reason:'none'=merged.reason;const state:InventoryState=merged.candidate;void[reason,state];
  } else {
    const absent:null=merged.candidate;const reason:InventoryMergeReason=merged.reason;void[absent,reason];
    // @ts-expect-error rejection cannot be used as a full state
    const invalid:InventoryState=merged.candidate;
    void invalid;
  }
  void[adjusted,removed,present,fits];
}
// @ts-expect-error explicit admission required
mergeInventoryEntries(empty,context,'b','a');
// @ts-expect-error closed reasons exclude partial merge
const invalidReason:InventoryMergeReason='partial_merge';
void invalidReason;
