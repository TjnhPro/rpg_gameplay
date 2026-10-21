/** Opaque content identity; lookup and catalog authority belong to L3/L4. */
export interface ItemDefinitionReference { readonly definitionId: string; }
export interface ItemInstanceInitialIdentity { readonly instanceId: string; }
export interface ItemInstanceReference {
  readonly instanceId: string;
  readonly definitionId: string;
}
export type ItemPropertyValue =
  | null | string | number | boolean
  | readonly ItemPropertyValue[]
  | {readonly [key: string]: ItemPropertyValue};
export interface ItemDefinitionContent {
  readonly categoryId: string | null;
  readonly tagIds: readonly string[];
  readonly rarityId: string | null;
  readonly properties: Readonly<Record<string, ItemPropertyValue>>;
}
export interface ItemDefinition extends ItemDefinitionContent {
  readonly definitionId: string;
}
export interface ItemInstanceInitialState {
  readonly instanceId: string;
  readonly properties: Readonly<Record<string, ItemPropertyValue>>;
}
export interface ItemInstanceState {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly properties: Readonly<Record<string, ItemPropertyValue>>;
}

// Reflection reads descriptors, never caller getters. JavaScript has no portable
// general Proxy detector; failed/trapping inspection is rejected as TypeError.
function inspect<T>(read: () => T): T {
  try { return read(); }
  catch (error) {
    if (error instanceof TypeError) throw error;
    throw new TypeError('Item data could not be inspected safely');
  }
}

function dataEntries(input: unknown, array = false): [string, unknown][] {
  if (typeof input !== 'object' || input === null || Array.isArray(input) !== array) {
    throw new TypeError('Expected an Item data record or dense array');
  }
  const prototype = Object.getPrototypeOf(input);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Item data must have a plain prototype');
  }
  return Reflect.ownKeys(input).map(key => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== 'string' || !descriptor || !('value' in descriptor)) {
      throw new TypeError('Item fields must be own string data properties');
    }
    return [key, descriptor.value as unknown];
  });
}

function fields(input: unknown, keys: readonly string[]): Record<string, unknown> {
  const entries = dataEntries(input);
  if (entries.length !== keys.length || entries.some(([key]) => !keys.includes(key))) {
    throw new TypeError('Missing or unknown Item fields');
  }
  return Object.fromEntries(entries);
}

function id(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError('Expected a nonblank Item ID');
  return value;
}
function nullableId(value: unknown): string | null { return value === null ? null : id(value); }

function denseValues(input: unknown): unknown[] {
  const entries = dataEntries(input, true);
  const length = entries.find(([key]) => key === 'length')?.[1];
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0
    || entries.length !== length + 1) throw new TypeError('Item arrays must be dense with no extra fields');
  const values = new Map(entries);
  const result: unknown[] = [];
  for (let index = 0; index < length; index++) {
    if (!values.has(String(index))) throw new TypeError('Item arrays must be dense with no extra fields');
    result.push(values.get(String(index)));
  }
  return result;
}

function copyValue(input: unknown, ancestors: Set<object>): ItemPropertyValue {
  if (input === null || typeof input === 'string' || typeof input === 'boolean') return input;
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input !== 'object' || input === null) throw new TypeError('Unsupported Item property value');
  if (ancestors.has(input)) throw new TypeError('Cyclic Item properties');
  ancestors.add(input);
  try {
    if (Array.isArray(input)) return Object.freeze(denseValues(input).map(value => copyValue(value, ancestors)));
    return copyDictionary(input, ancestors);
  } finally { ancestors.delete(input); }
}

function copyDictionary(input: unknown, ancestors: Set<object>): Readonly<Record<string, ItemPropertyValue>> {
  const result: Record<string, ItemPropertyValue> = {};
  for (const [key, value] of dataEntries(input)) {
    // Define rather than assign: __proto__, constructor and empty keys are data.
    Object.defineProperty(result, key, {value: copyValue(value, ancestors), enumerable: true});
  }
  return Object.freeze(result);
}
function properties(input: unknown): Readonly<Record<string, ItemPropertyValue>> {
  // Start through copyValue so a dictionary's own self-reference is detected.
  dataEntries(input);
  return copyValue(input, new Set()) as Readonly<Record<string, ItemPropertyValue>>;
}
function content(input: unknown): ItemDefinitionContent {
  const value = fields(input, ['categoryId', 'tagIds', 'rarityId', 'properties']);
  const categoryId = nullableId(value.categoryId);
  const tagIds = denseValues(value.tagIds).map(id);
  if (new Set(tagIds).size !== tagIds.length) throw new TypeError('Duplicate Item tag IDs');
  const rarityId = nullableId(value.rarityId);
  return {categoryId, tagIds: Object.freeze(tagIds), rarityId, properties: properties(value.properties)};
}

export function createItemDefinitionReference(reference: ItemDefinitionReference): ItemDefinitionReference {
  return inspect(() => Object.freeze({definitionId: id(fields(reference, ['definitionId']).definitionId)}));
}
export function createItemInstanceReference(
  definition: ItemDefinitionReference, initial: ItemInstanceInitialIdentity,
): ItemInstanceReference {
  return inspect(() => {
    const definitionId = createItemDefinitionReference(definition).definitionId;
    return Object.freeze({instanceId: id(fields(initial, ['instanceId']).instanceId), definitionId});
  });
}
export function validateItemInstanceReference(
  definition: ItemDefinitionReference, instance: ItemInstanceReference,
): ItemInstanceReference {
  return inspect(() => {
    const reference = createItemDefinitionReference(definition);
    const value = fields(instance, ['instanceId', 'definitionId']);
    const instanceId = id(value.instanceId), definitionId = id(value.definitionId);
    if (definitionId !== reference.definitionId) throw new TypeError('Item definition binding mismatch');
    return Object.freeze({instanceId, definitionId});
  });
}
export function createItemDefinition(
  reference: ItemDefinitionReference, input: ItemDefinitionContent,
): ItemDefinition {
  return inspect(() => {
    const definitionId = createItemDefinitionReference(reference).definitionId;
    return Object.freeze({definitionId, ...content(input)});
  });
}
export function validateItemDefinition(definition: ItemDefinition): ItemDefinition {
  return inspect(() => {
    const value = fields(definition, ['definitionId', 'categoryId', 'tagIds', 'rarityId', 'properties']);
    const definitionId = id(value.definitionId);
    const {categoryId, tagIds, rarityId, properties: ownProperties} = value;
    return Object.freeze({definitionId, ...content({categoryId, tagIds, rarityId, properties: ownProperties})});
  });
}
export function createItemInstance(definition: ItemDefinition, initial: ItemInstanceInitialState): ItemInstanceState {
  return inspect(() => {
    const definitionId = validateItemDefinition(definition).definitionId;
    const value = fields(initial, ['instanceId', 'properties']);
    return Object.freeze({instanceId: id(value.instanceId), definitionId, properties: properties(value.properties)});
  });
}
export function validateItemInstance(definition: ItemDefinition, instance: ItemInstanceState): ItemInstanceState {
  return inspect(() => {
    const reference = validateItemDefinition(definition);
    const value = fields(instance, ['instanceId', 'definitionId', 'properties']);
    const instanceId = id(value.instanceId), definitionId = id(value.definitionId);
    if (definitionId !== reference.definitionId) throw new TypeError('Item definition binding mismatch');
    return Object.freeze({instanceId, definitionId, properties: properties(value.properties)});
  });
}

export type ItemPropertyReadResult =
  | {readonly found: false}
  | {readonly found: true; readonly value: ItemPropertyValue};
export interface ItemPropertyOperationAdmission { readonly eligible: boolean; }
export type ItemPropertyOperationResult =
  | {readonly status: 'accepted'; readonly reason: 'none'; readonly candidate: ItemInstanceState}
  | {readonly status: 'rejected'; readonly reason: 'ineligible'; readonly candidate: null};

function propertyKey(key: unknown): string {
  if (typeof key !== 'string') throw new TypeError('Expected an Item property key string');
  return key;
}
function eligible(admission: ItemPropertyOperationAdmission): boolean {
  const value = fields(admission, ['eligible']).eligible;
  if (typeof value !== 'boolean') throw new TypeError('Expected boolean Item property admission');
  return value;
}

export function getItemInstanceProperty(
  definition: ItemDefinition, instance: ItemInstanceState, key: string,
): ItemPropertyReadResult {
  return inspect(() => {
    const current = validateItemInstance(definition, instance);
    const name = propertyKey(key);
    return Object.freeze(Object.hasOwn(current.properties, name)
      ? {found: true, value: current.properties[name]!} : {found: false});
  });
}

export function setItemInstanceProperty(
  definition: ItemDefinition, instance: ItemInstanceState, key: string,
  value: ItemPropertyValue, admission: ItemPropertyOperationAdmission,
): ItemPropertyOperationResult {
  return inspect(() => {
    const current = validateItemInstance(definition, instance);
    const name = propertyKey(key);
    const captured = copyValue(value, new Set());
    const allowed = eligible(admission);
    if (!allowed) return Object.freeze({status: 'rejected', reason: 'ineligible', candidate: null});
    const next = {...current.properties};
    Object.defineProperty(next, name, {value: captured, enumerable: true, configurable: true, writable: true});
    const candidate = validateItemInstance(definition, {...current, properties: next});
    return Object.freeze({status: 'accepted', reason: 'none', candidate});
  });
}

export function replaceItemInstanceProperties(
  definition: ItemDefinition, instance: ItemInstanceState,
  replacement: Readonly<Record<string, ItemPropertyValue>>, admission: ItemPropertyOperationAdmission,
): ItemPropertyOperationResult {
  return inspect(() => {
    const current = validateItemInstance(definition, instance);
    const captured = properties(replacement);
    const allowed = eligible(admission);
    if (!allowed) return Object.freeze({status: 'rejected', reason: 'ineligible', candidate: null});
    const candidate = validateItemInstance(definition, {...current, properties: captured});
    return Object.freeze({status: 'accepted', reason: 'none', candidate});
  });
}

export interface ItemStackPolicy { readonly stackable: boolean; }
export type ItemStackCompatibilityResult =
  | {readonly compatible: true; readonly reason: 'none'}
  | {readonly compatible: false; readonly reason:
      'same_instance' | 'different_definition' | 'definition_conflict' | 'not_stackable' | 'different_properties'};

export function validateItemStackPolicy(policy: ItemStackPolicy): ItemStackPolicy {
  return inspect(() => {
    const stackable = fields(policy, ['stackable']).stackable;
    if (typeof stackable !== 'boolean') throw new TypeError('Expected boolean Item stack policy');
    return Object.freeze({stackable});
  });
}

// Only canonical captured Item values reach this comparison. Record insertion
// order is irrelevant; array order and Object.is scalar equality are exact.
function equalItemValue(left: ItemPropertyValue, right: ItemPropertyValue): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((value, index) => equalItemValue(value, right[index]!));
  }
  const a = left as Readonly<Record<string, ItemPropertyValue>>;
  const b = right as Readonly<Record<string, ItemPropertyValue>>;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length
    && keys.every(key => Object.hasOwn(b, key) && equalItemValue(a[key]!, b[key]!));
}

export function assessItemStackCompatibility(
  leftDefinition: ItemDefinition, leftInstance: ItemInstanceState,
  rightDefinition: ItemDefinition, rightInstance: ItemInstanceState, policy: ItemStackPolicy,
): ItemStackCompatibilityResult {
  return inspect(() => {
    const left = validateItemDefinition(leftDefinition);
    const right = validateItemDefinition(rightDefinition);
    const a = validateItemInstance(left, leftInstance);
    const b = validateItemInstance(right, rightInstance);
    const validatedPolicy = validateItemStackPolicy(policy);
    if (a.instanceId === b.instanceId) return Object.freeze({compatible: false, reason: 'same_instance'});
    if (left.definitionId !== right.definitionId) return Object.freeze({compatible: false, reason: 'different_definition'});
    if (left.categoryId !== right.categoryId || left.rarityId !== right.rarityId
      || !equalItemValue(left.tagIds, right.tagIds) || !equalItemValue(left.properties, right.properties)) {
      return Object.freeze({compatible: false, reason: 'definition_conflict'});
    }
    if (!validatedPolicy.stackable) return Object.freeze({compatible: false, reason: 'not_stackable'});
    if (!equalItemValue(a.properties, b.properties)) return Object.freeze({compatible: false, reason: 'different_properties'});
    return Object.freeze({compatible: true, reason: 'none'});
  });
}
