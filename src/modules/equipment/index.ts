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

export interface EquipmentAdmission { readonly eligible: boolean; }
export type EquipmentAdmissionResult =
  | { readonly allowed: true; readonly reason: 'none' }
  | { readonly allowed: false; readonly reason: 'already_equipped' | 'slot_occupied' | 'ineligible' };

export function listEquippedEntries(state: EquipmentState, context: EquipmentValidationContext): readonly EquippedEntry[] {
  return validateEquipmentState(state, context).entries;
}

export function getEquippedEntryBySlot(state: EquipmentState, context: EquipmentValidationContext,
  slotId: string): EquippedEntry | null {
  const snapshot = validateEquipmentState(state, context), key = id(slotId);
  return snapshot.entries.find(entry => entry.slotIds.includes(key)) ?? null;
}

export function hasEquippedItem(state: EquipmentState, context: EquipmentValidationContext, instanceId: string): boolean {
  const snapshot = validateEquipmentState(state, context), key = id(instanceId);
  return snapshot.entries.some(entry => entry.item.instanceId === key);
}

/** Advisory only: validates current data and a separate request, never reserves slots. */
export function assessEquipmentAdmission(state: EquipmentState, context: EquipmentValidationContext,
  item: ItemInstanceState, slotIds: readonly string[], admission: EquipmentAdmission): EquipmentAdmissionResult {
  try {
    const snapshot = validateEquipmentState(state, context);
    // Reuse Foundation's exact Item binding and slot constraints in isolation from
    // current occupancy. A collision with current state is a denial, not malformed data.
    const request = validateEquipmentState({equipmentId: snapshot.equipmentId, owner: null,
      entries: [{item, slotIds}]}, context).entries[0]!;
    const {eligible} = fields(admission, ['eligible']);
    if (typeof eligible !== 'boolean') throw new TypeError('Equipment admission requires a boolean eligible fact');
    if (snapshot.entries.some(entry => entry.item.instanceId === request.item.instanceId)) {
      return Object.freeze({allowed: false, reason: 'already_equipped'});
    }
    if (snapshot.entries.some(entry => entry.slotIds.some(slot => request.slotIds.includes(slot)))) {
      return Object.freeze({allowed: false, reason: 'slot_occupied'});
    }
    if (!eligible) return Object.freeze({allowed: false, reason: 'ineligible'});
    return Object.freeze({allowed: true, reason: 'none'});
  } catch (error) {
    if (error instanceof TypeError) throw error;
    throw new TypeError('Equipment admission data could not be inspected safely');
  }
}

export type EquipmentMutationReason = 'ineligible' | 'already_equipped' | 'slot_occupied' | 'not_equipped' | 'same_instance';
export type EquipmentMutationResult =
  | { readonly status: 'accepted'; readonly reason: 'none'; readonly candidate: EquipmentState;
      readonly released: ItemInstanceState | null }
  | { readonly status: 'rejected'; readonly reason: EquipmentMutationReason; readonly candidate: null; readonly released: null };

function inspectEquipmentMutation(action: () => EquipmentMutationResult): EquipmentMutationResult {
  try { return action(); }
  catch (error) {
    if (error instanceof TypeError) throw error;
    throw new TypeError('Equipment mutation data could not be inspected safely');
  }
}
function equipmentEligibility(admission: EquipmentAdmission): boolean {
  const {eligible} = fields(admission, ['eligible']);
  if (typeof eligible !== 'boolean') throw new TypeError('Equipment admission requires a boolean eligible fact');
  return eligible;
}
function rejectedEquipmentMutation(reason: EquipmentMutationReason): EquipmentMutationResult {
  return Object.freeze({status: 'rejected', reason, candidate: null, released: null});
}
function acceptedEquipmentMutation(candidate: EquipmentState, context: EquipmentValidationContext,
  released: ItemInstanceState | null): EquipmentMutationResult {
  return Object.freeze({status: 'accepted', reason: 'none', candidate: validateEquipmentState(candidate, context), released});
}

/** Append admitted occupancy; caller still owns entitlement and cross-storage commit. */
export function equipEquipmentItem(state: EquipmentState, context: EquipmentValidationContext,
  item: ItemInstanceState, slotIds: readonly string[], admission: EquipmentAdmission): EquipmentMutationResult {
  return inspectEquipmentMutation(() => {
    const snapshot = validateEquipmentState(state, context);
    const assessment = assessEquipmentAdmission(snapshot, context, item, slotIds, admission);
    if (!assessment.allowed) return rejectedEquipmentMutation(assessment.reason);
    return acceptedEquipmentMutation({...snapshot, entries: [...snapshot.entries, {item, slotIds}]}, context, null);
  });
}

/** Remove local membership and release its canonical Item without deleting it. */
export function unequipEquipmentItem(state: EquipmentState, context: EquipmentValidationContext,
  instanceId: string, admission: EquipmentAdmission): EquipmentMutationResult {
  return inspectEquipmentMutation(() => {
    const snapshot = validateEquipmentState(state, context), key = id(instanceId);
    const eligible = equipmentEligibility(admission);
    const entry = snapshot.entries.find(value => value.item.instanceId === key);
    if (!entry) return rejectedEquipmentMutation('not_equipped');
    if (!eligible) return rejectedEquipmentMutation('ineligible');
    return acceptedEquipmentMutation({...snapshot, entries: snapshot.entries.filter(value => value.item.instanceId !== key)},
      context, entry.item);
  });
}

/** Replace one position only; the old Item is returned for explicit caller placement. */
export function replaceEquipmentItem(state: EquipmentState, context: EquipmentValidationContext,
  replacedInstanceId: string, replacementItem: ItemInstanceState, replacementSlotIds: readonly string[],
  admission: EquipmentAdmission): EquipmentMutationResult {
  return inspectEquipmentMutation(() => {
    const snapshot = validateEquipmentState(state, context), key = id(replacedInstanceId);
    // Validate the full request independently of current occupancy, even for missing/denied targets.
    const request = validateEquipmentState({equipmentId: snapshot.equipmentId, owner: null,
      entries: [{item: replacementItem, slotIds: replacementSlotIds}]}, context).entries[0]!;
    const eligible = equipmentEligibility(admission);
    const previous = snapshot.entries.find(entry => entry.item.instanceId === key);
    if (!previous) return rejectedEquipmentMutation('not_equipped');
    if (request.item.instanceId === key) return rejectedEquipmentMutation('same_instance');
    const remaining = snapshot.entries.filter(entry => entry.item.instanceId !== key);
    // Only the explicitly replaced entry releases its occupancy for this assessment.
    const assessment = assessEquipmentAdmission({...snapshot, entries: remaining}, context,
      request.item, request.slotIds, {eligible});
    if (!assessment.allowed) return rejectedEquipmentMutation(assessment.reason);
    return acceptedEquipmentMutation({...snapshot,
      entries: snapshot.entries.map(entry => entry.item.instanceId === key ? request : entry)}, context, previous.item);
  });
}
