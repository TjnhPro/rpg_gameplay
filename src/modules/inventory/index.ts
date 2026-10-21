import {validateItemDefinition, validateItemInstance, validateItemStackPolicy,
  type ItemDefinition, type ItemInstanceState, type ItemStackPolicy} from '../item/index.js';

export interface InventoryOwnerReference {
  readonly ownerKind: string;
  readonly ownerId: string;
}
export interface InventoryEntry {
  readonly item: ItemInstanceState;
  readonly quantity: number;
}
export interface InventoryState {
  readonly inventoryId: string;
  readonly owner: InventoryOwnerReference | null;
  readonly entries: readonly InventoryEntry[];
}
/** Caller-owned L3 facts; never embedded in InventoryState. */
export interface InventoryItemContext {
  readonly definition: ItemDefinition;
  readonly stackPolicy: ItemStackPolicy;
  readonly maxStackQuantity: number | null;
}
export interface InventoryValidationContext {
  readonly items: readonly InventoryItemContext[];
}
export type InventoryTransitionResult<TReason extends string> =
  | {readonly status: 'accepted'; readonly reason: 'none'; readonly candidate: InventoryState}
  | {readonly status: 'rejected'; readonly reason: TReason; readonly candidate: null};

// These helpers capture Inventory's closed records/arrays only. Item owns all
// definition/instance/property validation and recursive detached snapshots.
function dataEntries(input: unknown, array = false): [string, unknown][] {
  if (typeof input !== 'object' || input === null || Array.isArray(input) !== array) {
    throw new TypeError('Expected Inventory data record or dense array');
  }
  const prototype = Object.getPrototypeOf(input);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Inventory data must have a plain prototype');
  }
  return Reflect.ownKeys(input).map(key => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== 'string' || !descriptor || !('value' in descriptor)) {
      throw new TypeError('Inventory fields must be own string data properties');
    }
    return [key, descriptor.value as unknown];
  });
}
function fields(input: unknown, keys: readonly string[]): Record<string, unknown> {
  const entries = dataEntries(input);
  if (entries.length !== keys.length || entries.some(([key]) => !keys.includes(key))) {
    throw new TypeError('Missing or unknown Inventory fields');
  }
  return Object.fromEntries(entries);
}
function values(input: unknown): unknown[] {
  const entries = dataEntries(input, true), captured = new Map(entries);
  const length = captured.get('length');
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || entries.length !== length + 1) {
    throw new TypeError('Inventory arrays must be dense with no extra fields');
  }
  return Array.from({length}, (_, index) => {
    if (!captured.has(String(index))) throw new TypeError('Inventory array index missing');
    return captured.get(String(index));
  });
}
function id(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) throw new TypeError('Expected a nonblank Inventory ID');
  return input;
}
function quantity(input: unknown): number {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < 1) {
    throw new TypeError('Inventory quantity must be a positive safe integer');
  }
  return input;
}

/** Complete snapshot validation; no ID generation, catalog or authoritative commit. */
export function validateInventoryState(state: InventoryState, context: InventoryValidationContext): InventoryState {
  try {
    const input = fields(state, ['inventoryId', 'owner', 'entries']);
    const inventoryId = id(input.inventoryId);
    const ownerInput = input.owner === null ? null : fields(input.owner, ['ownerKind', 'ownerId']);
    const owner = ownerInput === null ? null : Object.freeze({ownerKind: id(ownerInput.ownerKind), ownerId: id(ownerInput.ownerId)});
    const items = new Map<string, InventoryItemContext>();
    for (const value of values(fields(context, ['items']).items)) {
      const fact = fields(value, ['definition', 'stackPolicy', 'maxStackQuantity']);
      const definition = validateItemDefinition(fact.definition as ItemDefinition);
      const stackPolicy = validateItemStackPolicy(fact.stackPolicy as ItemStackPolicy);
      const maxStackQuantity = fact.maxStackQuantity === null ? null : quantity(fact.maxStackQuantity);
      if (items.has(definition.definitionId)) throw new TypeError('Duplicate Inventory context definition');
      items.set(definition.definitionId, {definition, stackPolicy, maxStackQuantity});
    }
    const seen = new Set<string>();
    const entries = values(input.entries).map(value => {
      const entry = fields(value, ['item', 'quantity']);
      // Read only the lookup key without evaluating getters. Item's public
      // validator below owns the complete instance schema and binding check.
      const binding = typeof entry.item === 'object' && entry.item !== null
        ? Object.getOwnPropertyDescriptor(entry.item, 'definitionId') : undefined;
      if (!binding || !('value' in binding) || typeof binding.value !== 'string') {
        throw new TypeError('Inventory requires an own-data Item definitionId');
      }
      const fact = items.get(binding.value);
      if (!fact) throw new TypeError('Unresolved Inventory Item definition');
      const item = validateItemInstance(fact.definition, entry.item as ItemInstanceState);
      if (seen.has(item.instanceId)) throw new TypeError('Duplicate Inventory instanceId');
      seen.add(item.instanceId);
      const count = quantity(entry.quantity);
      if (!fact.stackPolicy.stackable && count !== 1) throw new TypeError('Nonstackable Inventory quantity must equal one');
      if (fact.maxStackQuantity !== null && count > fact.maxStackQuantity) throw new TypeError('Inventory quantity exceeds maximum');
      return Object.freeze({item, quantity: count});
    });
    return Object.freeze({inventoryId, owner, entries: Object.freeze(entries)});
  } catch (error) {
    if (error instanceof TypeError) throw error;
    throw new TypeError('Inventory data could not be inspected safely');
  }
}

/** Creation accepts an explicit complete snapshot, including hydrated entries. */
export function createInventoryState(input: InventoryState, context: InventoryValidationContext): InventoryState {
  return validateInventoryState(input, context);
}
