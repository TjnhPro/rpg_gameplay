import {createInventoryState, validateInventoryState, createItemDefinition, createItemInstance,
  type InventoryOwnerReference, type InventoryEntry, type InventoryState,
  type InventoryItemContext, type InventoryValidationContext, type InventoryTransitionResult} from '@rpg/gameplay';

const definition = createItemDefinition({definitionId: 'd'},
  {categoryId: null, tagIds: [], rarityId: null, properties: {}});
const item = createItemInstance(definition, {instanceId: 'i', properties: {}});
const owner: InventoryOwnerReference = {ownerKind: 'bank', ownerId: 'b'};
const entry: InventoryEntry = {item, quantity: 1};
const fact: InventoryItemContext = {definition, stackPolicy: {stackable: false}, maxStackQuantity: null};
const context: InventoryValidationContext = {items: [fact]};
const state: InventoryState = createInventoryState({inventoryId: 'bag', owner, entries: [entry]}, context);
const validated: InventoryState = validateInventoryState(state, context);
// @ts-expect-error Inventory identity is readonly
validated.inventoryId = 'other';
// @ts-expect-error entries are readonly, not a mutable array
validated.entries.push(entry);
// @ts-expect-error Entry quantity is readonly
validated.entries[0]!.quantity = 2;
// @ts-expect-error Item properties remain canonical and readonly
validated.entries[0]!.item.properties.quality = 3;
// @ts-expect-error owner identity is readonly
owner.ownerId = 'other';
// @ts-expect-error policy context has explicit maximum, never an omitted default
const incomplete: InventoryItemContext = {definition, stackPolicy: {stackable: true}};

function narrow(result: InventoryTransitionResult<'full' | 'ineligible'>): InventoryState | null {
  if (result.status === 'accepted') {
    const reason: 'none' = result.reason;
    void reason;
    return result.candidate;
  }
  const reason: 'full' | 'ineligible' = result.reason;
  const absent: null = result.candidate;
  void reason;
  return absent;
}
// @ts-expect-error rejection cannot carry a state candidate
const invalid: InventoryTransitionResult<'full'> = {status: 'rejected', reason: 'full', candidate: state};
void [narrow, invalid, incomplete];
