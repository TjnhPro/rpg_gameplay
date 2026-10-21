import {
 createItemDefinition,createItemInstance,createEquipmentState,validateEquipmentState,
 listEquippedEntries,getEquippedEntryBySlot,hasEquippedItem,assessEquipmentAdmission,
 equipEquipmentItem,unequipEquipmentItem,replaceEquipmentItem,
 createInventoryState,removeInventoryEntry,addInventoryEntry,
 createEntity,createEntityAttributeState,calculateEntityStats,
 type EquipmentOwnerReference,type EquippedEntry,type EquipmentState,
 type EquipmentItemContext,type EquipmentValidationContext,type EquipmentAdmission,
 type EquipmentAdmissionResult,type EquipmentMutationReason,type EquipmentMutationResult,
 type ItemInstanceState,type EntityStatConfiguration,
} from '@rpg/gameplay';
import type {NumericalModifier} from '@rpg/core/kernel';

const definition=createItemDefinition({definitionId:'blade'},
 {categoryId:null,tagIds:[],rarityId:null,properties:{}});
const item=createItemInstance(definition,{instanceId:'A',properties:{flatPower:5}});
const replacement=createItemInstance(definition,{instanceId:'B',properties:{flatPower:9}});
const owner:EquipmentOwnerReference={ownerKind:'player',ownerId:'reader'};
const fact:EquipmentItemContext={definition};
const context:EquipmentValidationContext={items:[fact]};
const empty:EquipmentState=validateEquipmentState(createEquipmentState({equipmentId:'gear',owner,entries:[]},context),context);
const admission:EquipmentAdmission={eligible:true};
const assessment:EquipmentAdmissionResult=assessEquipmentAdmission(empty,context,item,['main'],admission);
if(assessment.allowed) {const reason:'none'=assessment.reason;void reason;}
const result:EquipmentMutationResult=equipEquipmentItem(empty,context,item,['main'],admission);
if(result.status==='accepted') {
 const state:EquipmentState=result.candidate;
 const released:ItemInstanceState|null=result.released;
 const entries:readonly EquippedEntry[]=listEquippedEntries(state,context);
 const entry:EquippedEntry|null=getEquippedEntryBySlot(state,context,'main');
 const present:boolean=hasEquippedItem(state,context,'A');
 const replace:EquipmentMutationResult=replaceEquipmentItem(state,context,'A',replacement,['main'],admission);
 const remove:EquipmentMutationResult=unequipEquipmentItem(state,context,'A',admission);
 // @ts-expect-error membership is readonly
 state.entries.push({item,slotIds:['x']});
 if(entry) {
  // @ts-expect-error occupied slots are readonly
  entry.slotIds.push('x');
 }
 // @ts-expect-error released result is readonly
 result.released=null;
 const bagContext={items:[{definition,stackPolicy:{stackable:false},maxStackQuantity:null}]};
 const bag=createInventoryState({inventoryId:'bag',owner,entries:[{item,quantity:1}]},bagContext);
 const source=removeInventoryEntry(bag,bagContext,'A',admission);
 if(remove.status==='accepted'&&remove.released!==null&&source.status==='accepted') {
  addInventoryEntry(source.candidate,bagContext,{item:remove.released,quantity:1},{maxEntries:1},admission);
 }
 void entries;void present;void replace;void released;
} else {
 const candidate:null=result.candidate,released:null=result.released;
 const reason:EquipmentMutationReason=result.reason;
 // @ts-expect-error rejection cannot expose a candidate
 result.candidate.entries;
 // @ts-expect-error rejection cannot release an Item
 result.released.instanceId;
 void candidate;void released;void reason;
}
// @ts-expect-error rejection never releases an Item
const invalid:EquipmentMutationResult={status:'rejected',reason:'ineligible',candidate:null,released:item};
const modifier:NumericalModifier={identity:{source:'l3-fixture',sourceInstanceId:'A',id:'power'},
 target:'power',operation:'add_flat',value:5,enabled:true};
const rule={default:0,bounds:{},enabled:true};
const configuration:EntityStatConfiguration={attributeOrder:['strength'],statOrder:['power'],
 attributeRules:{strength:rule},attributeBaselines:{strength:0},baseStats:{power:5},
 rules:{power:{...rule,default:5,scaling:[{attribute:'strength',coefficient:2,enabled:true}],training:0}},
 flatContributions:{},modifiers:[modifier]};
calculateEntityStats(createEntityAttributeState(createEntity({id:'reader',kind:'player'}),{strength:10}),configuration);
void invalid;
