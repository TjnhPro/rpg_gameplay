import {getInventoryEntry, listInventoryEntries, hasInventoryItem, assessInventoryCapacity,
  type InventoryState, type InventoryValidationContext, type InventoryEntry,
  type InventoryCapacityPolicy, type InventoryCapacityAssessment} from '@rpg/gameplay';
const state: InventoryState = {inventoryId:'bag', owner:null, entries:[]};
const context: InventoryValidationContext = {items:[]};
const policy: InventoryCapacityPolicy = {maxEntries:null};
const list: readonly InventoryEntry[] = listInventoryEntries(state,context);
const found: InventoryEntry | null = getInventoryEntry(state,context,'a');
const present: boolean = hasInventoryItem(state,context,'a');
const assessment: InventoryCapacityAssessment = assessInventoryCapacity(state,context,policy,0);
const available: number | null = assessment.available;
// @ts-expect-error immutable assessment
assessment.fits = false;
// @ts-expect-error immutable list
list.push({item:{instanceId:'a',definitionId:'d',properties:{}},quantity:1});
// @ts-expect-error policy has no omitted default maximum
const omitted: InventoryCapacityPolicy = {};
// @ts-expect-error explicit counts are numeric
assessInventoryCapacity(state,context,policy,'1');
if(found) {
  // @ts-expect-error detached entry remains readonly
  found.quantity = 2;
}
void [present,available,omitted];
