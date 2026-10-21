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
