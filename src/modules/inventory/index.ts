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

export interface InventoryCapacityPolicy {
  readonly maxEntries: number | null;
}
export type InventoryCapacityAssessment = {
  readonly fits: boolean;
  readonly occupied: number;
  readonly available: number | null;
};

/** Exact lookup over a newly validated, detached snapshot. */
export function getInventoryEntry(state: InventoryState, context: InventoryValidationContext, instanceId: string): InventoryEntry | null {
  const snapshot = validateInventoryState(state, context);
  const key = id(instanceId);
  return snapshot.entries.find(entry => entry.item.instanceId === key) ?? null;
}

export function listInventoryEntries(state: InventoryState, context: InventoryValidationContext): readonly InventoryEntry[] {
  return validateInventoryState(state, context).entries;
}

export function hasInventoryItem(state: InventoryState, context: InventoryValidationContext, instanceId: string): boolean {
  return getInventoryEntry(state, context, instanceId) !== null;
}

function entryCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError('Inventory entry count must be a nonnegative safe integer');
  }
  return value;
}

/** Advisory L3 entry-count policy; never changes or invalidates the state. */
export function assessInventoryCapacity(state: InventoryState, context: InventoryValidationContext,
  policy: InventoryCapacityPolicy, additionalEntries: number): InventoryCapacityAssessment {
  const snapshot = validateInventoryState(state, context);
  const additional = entryCount(additionalEntries);
  let maximum: number | null;
  try {
    const input = fields(policy, ['maxEntries']);
    maximum = input.maxEntries === null ? null : entryCount(input.maxEntries);
  } catch (error) {
    if (error instanceof TypeError) throw error;
    throw new TypeError('Inventory capacity policy could not be inspected safely');
  }
  const occupied = snapshot.entries.length;
  const available = maximum === null ? null : Math.max(maximum - occupied, 0);
  // Compare remaining capacity instead of adding two potentially large integers.
  const fits = maximum === null || (occupied <= maximum && additional <= maximum - occupied);
  return Object.freeze({fits, occupied, available});
}

export interface InventoryOperationAdmission { readonly eligible: boolean; }
export type InventoryMutationReason =
  | 'ineligible' | 'already_present' | 'missing_entry' | 'capacity_exceeded'
  | 'quantity_underflow' | 'stack_limit_exceeded' | 'quantity_not_allowed';

function inspectMutation<T>(read: () => T): T {
  try { return read(); }
  catch (error) {
    if (error instanceof TypeError) throw error;
    throw new TypeError('Inventory operation data could not be inspected safely');
  }
}
function eligibleOperation(admission: InventoryOperationAdmission): boolean {
  const eligible = fields(admission, ['eligible']).eligible;
  if (typeof eligible !== 'boolean') throw new TypeError('Inventory admission requires explicit boolean eligibility');
  return eligible;
}
// State validation has already checked the complete context. Capture the relevant
// facts through Item's public validators; never define another Item schema.
function mutationFacts(context: InventoryValidationContext, definitionId: string): InventoryItemContext {
  for (const value of values(fields(context, ['items']).items)) {
    const fact = fields(value, ['definition', 'stackPolicy', 'maxStackQuantity']);
    const definition = validateItemDefinition(fact.definition as ItemDefinition);
    if (definition.definitionId === definitionId) {
      return {definition, stackPolicy: validateItemStackPolicy(fact.stackPolicy as ItemStackPolicy),
        maxStackQuantity: fact.maxStackQuantity === null ? null : quantity(fact.maxStackQuantity)};
    }
  }
  throw new TypeError('Unresolved Inventory Item definition');
}
function quantityRejection(count: number, fact: InventoryItemContext): InventoryMutationReason | null {
  if (!fact.stackPolicy.stackable && count !== 1) return 'quantity_not_allowed';
  if (fact.maxStackQuantity !== null && count > fact.maxStackQuantity) return 'stack_limit_exceeded';
  return null;
}
function denied(reason: InventoryMutationReason): InventoryTransitionResult<InventoryMutationReason> {
  return Object.freeze({status: 'rejected', reason, candidate: null});
}
function acceptedMutation(state: InventoryState, context: InventoryValidationContext): InventoryTransitionResult<InventoryMutationReason> {
  return Object.freeze({status: 'accepted', reason: 'none', candidate: validateInventoryState(state, context)});
}

/** Append supplied membership only; caller owns Item entitlement and commits. */
export function addInventoryEntry(state: InventoryState, context: InventoryValidationContext,
  entry: InventoryEntry, capacity: InventoryCapacityPolicy,
  admission: InventoryOperationAdmission): InventoryTransitionResult<InventoryMutationReason> {
  return inspectMutation(() => {
    const snapshot = validateInventoryState(state, context);
    const input = fields(entry, ['item', 'quantity']);
    const count = quantity(input.quantity);
    const binding = typeof input.item === 'object' && input.item !== null
      ? Object.getOwnPropertyDescriptor(input.item, 'definitionId') : undefined;
    if (!binding || !('value' in binding) || typeof binding.value !== 'string') {
      throw new TypeError('Inventory requires an own-data Item definitionId');
    }
    const fact = mutationFacts(context, binding.value);
    const item = validateItemInstance(fact.definition, input.item as ItemInstanceState);
    const assessment = assessInventoryCapacity(snapshot, context, capacity, 1);
    const eligible = eligibleOperation(admission);
    if (!eligible) return denied('ineligible');
    if (snapshot.entries.some(value => value.item.instanceId === item.instanceId)) return denied('already_present');
    if (!assessment.fits) return denied('capacity_exceeded');
    const reason = quantityRejection(count, fact);
    if (reason) return denied(reason);
    return acceptedMutation({...snapshot, entries: [...snapshot.entries, {item, quantity: count}]}, context);
  });
}

/** Remove membership, never delete Item existence from any external authority. */
export function removeInventoryEntry(state: InventoryState, context: InventoryValidationContext,
  instanceId: string, admission: InventoryOperationAdmission): InventoryTransitionResult<InventoryMutationReason> {
  return inspectMutation(() => {
    const snapshot = validateInventoryState(state, context);
    const key = id(instanceId), eligible = eligibleOperation(admission);
    if (!eligible) return denied('ineligible');
    if (!snapshot.entries.some(entry => entry.item.instanceId === key)) return denied('missing_entry');
    return acceptedMutation({...snapshot, entries: snapshot.entries.filter(entry => entry.item.instanceId !== key)}, context);
  });
}

/** Signed safe-integer bookkeeping; zero quantity retires membership. */
export function adjustInventoryQuantity(state: InventoryState, context: InventoryValidationContext,
  instanceId: string, delta: number, admission: InventoryOperationAdmission): InventoryTransitionResult<InventoryMutationReason> {
  return inspectMutation(() => {
    const snapshot = validateInventoryState(state, context);
    const key = id(instanceId);
    if (!Number.isSafeInteger(delta) || delta === 0) throw new TypeError('Inventory delta must be a nonzero safe integer');
    const eligible = eligibleOperation(admission);
    if (!eligible) return denied('ineligible');
    const entry = snapshot.entries.find(value => value.item.instanceId === key);
    if (!entry) return denied('missing_entry');
    if (delta < -entry.quantity) return denied('quantity_underflow');
    // Never calculate an unsafe positive sum. The safe integer ceiling is the
    // implicit structural stack ceiling even when L3 supplies no lower cap.
    if (delta > Number.MAX_SAFE_INTEGER - entry.quantity) return denied('stack_limit_exceeded');
    const count = entry.quantity + delta;
    if (count !== 0) {
      const reason = quantityRejection(count, mutationFacts(context, entry.item.definitionId));
      if (reason) return denied(reason);
    }
    const entries = snapshot.entries.flatMap(value => value.item.instanceId !== key
      ? [value] : count === 0 ? [] : [{item: value.item, quantity: count}]);
    return acceptedMutation({...snapshot, entries}, context);
  });
}
