import {createLootTableDefinition,rollLootTable,validateLootRollResult,createItemDefinition,
 createItemInstance,createInventoryState,addInventoryEntry,listInventoryEntries,
 type LootRollResult,type InventoryValidationContext,type InventoryState} from '@rpg/gameplay';

const table=createLootTableDefinition({tableId:'strict',noDropWeight:0,
 entries:[{entryId:'p',definitionId:'potion',weight:1,quantity:2}]});
const result:LootRollResult=validateLootRollResult(rollLootTable(table,0.60));
const definition=createItemDefinition({definitionId:'potion'},
 {categoryId:null,tagIds:[],rarityId:null,properties:{}});
const context:InventoryValidationContext={items:[{definition,stackPolicy:{stackable:true},maxStackQuantity:10}]};
const empty=createInventoryState({inventoryId:'bag',owner:null,entries:[]},context);
const drop=result.drops[0];
if(drop) {
 const item=createItemInstance(definition,{instanceId:'caller-id',properties:{}});
 const added=addInventoryEntry(empty,context,{item,quantity:drop.quantity},{maxEntries:1},{eligible:true});
 if(added.status==='accepted') {
  const state:InventoryState=added.candidate;
  const entries=listInventoryEntries(state,context);
  // @ts-expect-error Inventory snapshot membership is readonly.
  entries.push({item,quantity:1});
 } else {
  const absent:null=added.candidate;void absent;
 }
 // @ts-expect-error Selected intent quantity is readonly.
 drop.quantity=3;
 // @ts-expect-error Inventory requires caller admission.
 addInventoryEntry(empty,context,{item,quantity:2},{maxEntries:1});
}
// @ts-expect-error Sample cannot be an implicit provider.
rollLootTable(table,()=>0.60);
// @ts-expect-error Structural intents cannot be used as Item instances.
createInventoryState({inventoryId:'bad',owner:null,entries:[{item:result.drops[0],quantity:2}]},context);
