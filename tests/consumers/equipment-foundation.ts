import {createItemDefinition,createItemInstance,createEquipmentState,validateEquipmentState,
 type EquipmentOwnerReference,type EquippedEntry,type EquipmentState,type EquipmentItemContext,
 type EquipmentValidationContext,type ItemInstanceState} from '@rpg/gameplay';
const definition=createItemDefinition({definitionId:'d'},{categoryId:null,tagIds:[],rarityId:null,properties:{}});
const item=createItemInstance(definition,{instanceId:'a',properties:{}});
const owner:EquipmentOwnerReference={ownerKind:'companion',ownerId:'c'};
const entry:EquippedEntry={item,slotIds:['left','right']};
const fact:EquipmentItemContext={definition};
const context:EquipmentValidationContext={items:[fact]};
const state:EquipmentState=createEquipmentState({equipmentId:'gear',owner,entries:[entry]},context);
const snapshot:EquipmentState=validateEquipmentState(state,context);
const canonicalItem:ItemInstanceState=snapshot.entries[0]!.item;
// @ts-expect-error immutable identity
snapshot.equipmentId='changed';
// @ts-expect-error immutable membership
snapshot.entries.push(entry);
// @ts-expect-error immutable occupied slots
snapshot.entries[0]!.slotIds.push('new');
// @ts-expect-error canonical Item properties remain readonly
canonicalItem.properties.changed=1;
// @ts-expect-error immutable neutral owner
owner.ownerId='changed';
// @ts-expect-error no quantity in Equipment
const invalidEntry:EquippedEntry={item,slotIds:['x'],quantity:1};
// @ts-expect-error explicit context required
createEquipmentState(state);
void invalidEntry;
