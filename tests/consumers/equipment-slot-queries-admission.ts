import {createItemDefinition,createItemInstance,createEquipmentState,listEquippedEntries,
 getEquippedEntryBySlot,hasEquippedItem,assessEquipmentAdmission,
 type EquipmentAdmission,type EquipmentAdmissionResult,type EquippedEntry} from '@rpg/gameplay';
const definition=createItemDefinition({definitionId:'d'},{categoryId:null,tagIds:[],rarityId:null,properties:{}});
const item=createItemInstance(definition,{instanceId:'i',properties:{}}),context={items:[{definition}]};
const state=createEquipmentState({equipmentId:'e',owner:null,entries:[]},context);
const admission:EquipmentAdmission={eligible:true};
const entries:readonly EquippedEntry[]=listEquippedEntries(state,context);
const entry:EquippedEntry|null=getEquippedEntryBySlot(state,context,'left');
const has:boolean=hasEquippedItem(state,context,'i');
const result:EquipmentAdmissionResult=assessEquipmentAdmission(state,context,item,['left','right'],admission);
if(result.allowed) {const reason:'none'=result.reason;void reason;}
else {const reason:'already_equipped'|'slot_occupied'|'ineligible'=result.reason;void reason;}
// @ts-expect-error admission is readonly
admission.eligible=false;
// @ts-expect-error list is readonly
entries.push({item,slotIds:['x']});
// @ts-expect-error lookup returns readonly occupied slots
entry?.slotIds.push('x');
// @ts-expect-error closed discriminated result
const invalid:EquipmentAdmissionResult={allowed:true,reason:'ineligible'};
// @ts-expect-error result is readonly
result.allowed=false;
// @ts-expect-error explicit admission required
assessEquipmentAdmission(state,context,item,['left']);
// @ts-expect-error eligible is a boolean fact
assessEquipmentAdmission(state,context,item,['left'],{eligible:1});
void invalid;void has;
