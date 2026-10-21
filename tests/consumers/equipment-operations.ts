import {createItemDefinition,createItemInstance,createEquipmentState,equipEquipmentItem,
 unequipEquipmentItem,replaceEquipmentItem,type EquipmentMutationReason,type EquipmentMutationResult,
 type EquipmentState,type ItemInstanceState} from '@rpg/gameplay';
const definition=createItemDefinition({definitionId:'d'},{categoryId:null,tagIds:[],rarityId:null,properties:{}});
const context={items:[{definition}]},item=createItemInstance(definition,{instanceId:'i',properties:{}});
const state=createEquipmentState({equipmentId:'e',owner:null,entries:[]},context);
const result:EquipmentMutationResult=equipEquipmentItem(state,context,item,['left'],{eligible:true});
if(result.status==='accepted') {
 const candidate:EquipmentState=result.candidate;
 const released:ItemInstanceState|null=result.released;
 const reason:'none'=result.reason;
 // @ts-expect-error candidate membership is readonly
 candidate.entries.push({item,slotIds:['x']});
 // @ts-expect-error accepted result is readonly
 result.released=null;
 if(released) {
  // @ts-expect-error released Item properties remain readonly
  released.properties.changed=2;
 }
 void reason;
} else {
 const candidate:null=result.candidate,released:null=result.released;
 const reason:EquipmentMutationReason=result.reason;
 // @ts-expect-error rejected candidate is null
 result.candidate.equipmentId;
 // @ts-expect-error rejected released Item is null
 result.released.instanceId;
 void candidate;void released;void reason;
}
const removed:EquipmentMutationResult=unequipEquipmentItem(state,context,'i',{eligible:true});
const replaced:EquipmentMutationResult=replaceEquipmentItem(state,context,'i',item,['right'],{eligible:true});
// @ts-expect-error rejection can never release an Item
const invalid:EquipmentMutationResult={status:'rejected',reason:'ineligible',candidate:null,released:item};
// @ts-expect-error no implicit eligibility
unequipEquipmentItem(state,context,'i');
// @ts-expect-error replacement slots must be string IDs
replaceEquipmentItem(state,context,'i',item,[1],{eligible:true});
void removed;void replaced;void invalid;
