import {validateItemDefinition, validateItemInstance,
  type ItemDefinition, type ItemInstanceState} from '../item/index.js';

export interface EquipmentOwnerReference {
  readonly ownerKind: string;
  readonly ownerId: string;
}
export interface EquippedEntry {
  readonly item: ItemInstanceState;
  readonly slotIds: readonly string[];
}
export interface EquipmentState {
  readonly equipmentId: string;
  readonly owner: EquipmentOwnerReference | null;
  readonly entries: readonly EquippedEntry[];
}
export interface EquipmentItemContext { readonly definition: ItemDefinition; }
export interface EquipmentValidationContext { readonly items: readonly EquipmentItemContext[]; }

// Capture Equipment structure only. Item owns all definition/instance schemas,
// nested property validation and detached Item snapshots.
function dataEntries(input: unknown, array = false): [string, unknown][] {
  if (typeof input !== 'object' || input === null || Array.isArray(input) !== array) {
    throw new TypeError('Expected Equipment data record or dense array');
  }
  const prototype = Object.getPrototypeOf(input);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Equipment data must have a plain prototype');
  }
  return Reflect.ownKeys(input).map(key => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== 'string' || !descriptor || !('value' in descriptor)) {
      throw new TypeError('Equipment requires own string data properties');
    }
    return [key, descriptor.value as unknown];
  });
}
function fields(input: unknown, keys: readonly string[]): Record<string, unknown> {
  const entries = dataEntries(input);
  if (entries.length !== keys.length || entries.some(([key]) => !keys.includes(key))) {
    throw new TypeError('Missing or unknown Equipment fields');
  }
  return Object.fromEntries(entries);
}
function values(input: unknown): unknown[] {
  const entries = dataEntries(input, true), captured = new Map(entries);
  const length = captured.get('length');
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || entries.length !== length + 1) {
    throw new TypeError('Equipment arrays must be dense with no extra fields');
  }
  return Array.from({length}, (_, index) => {
    if (!captured.has(String(index))) throw new TypeError('Equipment array index missing');
    return captured.get(String(index));
  });
}
function id(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) throw new TypeError('Expected nonblank Equipment ID');
  return input;
}

/** Validate supplied occupancy, without authorizing an equip or storage transfer. */
export function validateEquipmentState(state: EquipmentState, context: EquipmentValidationContext): EquipmentState {
  try {
    const input = fields(state, ['equipmentId', 'owner', 'entries']);
    const equipmentId = id(input.equipmentId);
    const ownerInput = input.owner === null ? null : fields(input.owner, ['ownerKind', 'ownerId']);
    const owner = ownerInput === null ? null : Object.freeze({ownerKind: id(ownerInput.ownerKind), ownerId: id(ownerInput.ownerId)});
    const definitions = new Map<string, ItemDefinition>();
    for (const value of values(fields(context, ['items']).items)) {
      const fact = fields(value, ['definition']);
      const definition = validateItemDefinition(fact.definition as ItemDefinition);
      if (definitions.has(definition.definitionId)) throw new TypeError('Duplicate Equipment context definition');
      definitions.set(definition.definitionId, definition);
    }
    const instances = new Set<string>(), occupied = new Set<string>();
    const entries = values(input.entries).map(value => {
      const entry = fields(value, ['item', 'slotIds']);
      // Capture only the lookup key; canonical Item validation checks full binding.
      const binding = typeof entry.item === 'object' && entry.item !== null
        ? Object.getOwnPropertyDescriptor(entry.item, 'definitionId') : undefined;
      if (!binding || !('value' in binding) || typeof binding.value !== 'string') {
        throw new TypeError('Equipment requires own-data Item definitionId');
      }
      const definition = definitions.get(binding.value);
      if (!definition) throw new TypeError('Unresolved Equipment Item definition');
      const item = validateItemInstance(definition, entry.item as ItemInstanceState);
      if (instances.has(item.instanceId)) throw new TypeError('Duplicate Equipment instanceId');
      instances.add(item.instanceId);
      const slotIds = values(entry.slotIds).map(id);
      if (slotIds.length === 0) throw new TypeError('Equipment entry requires occupied slots');
      for (const slotId of slotIds) {
        if (occupied.has(slotId)) throw new TypeError('Equipment slot occupied more than once');
        occupied.add(slotId);
      }
      return Object.freeze({item, slotIds: Object.freeze(slotIds)});
    });
    return Object.freeze({equipmentId, owner, entries: Object.freeze(entries)});
  } catch (error) {
    if (error instanceof TypeError) throw error;
    throw new TypeError('Equipment data could not be inspected safely');
  }
}

/** Snapshot construction also supports explicit nonempty rehydrated data. */
export function createEquipmentState(input: EquipmentState, context: EquipmentValidationContext): EquipmentState {
  return validateEquipmentState(input, context);
}
