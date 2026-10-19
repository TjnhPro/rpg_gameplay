import {
  calculateStats, prepareNumericalModifiers, normalizeResource,
  calculateResourceTransition, calculateResourceRegeneration,
  type NumericRule, type DerivedStatRule, type NumericalModifier,
  type PreparedStatCalculationInput,
  type ResourceNormalizationInput, type ResourceNormalizationResult,
  type ResourceTransitionInput, type ResourceTransitionResult, type ResourceRegenerationInput,
} from '@rpg/core/kernel';

/** Caller-supplied identity and classification, without game state or policy. */
export interface EntityDefinition {
  readonly id: string;
  readonly kind: string;
}

/** Detached immutable identity/classification data; no collection authority. */
export type EntitySnapshot = EntityDefinition;

/** Validates the closed two-field definition; never generates or normalizes IDs. */
export function createEntity(definition: EntityDefinition): EntitySnapshot {
  if (typeof definition !== 'object' || definition === null || Array.isArray(definition)) {
    throw new TypeError('Entity definition must be an object with id and kind');
  }
  const keys = Reflect.ownKeys(definition);
  if (keys.length !== 2 || !keys.includes('id') || !keys.includes('kind')) {
    throw new TypeError('Entity definition must contain exactly own id and kind fields');
  }
  const idField = Object.getOwnPropertyDescriptor(definition, 'id');
  const kindField = Object.getOwnPropertyDescriptor(definition, 'kind');
  if (!idField || !kindField || !('value' in idField) || !('value' in kindField)) {
    throw new TypeError('Entity id and kind must be data properties, not accessors');
  }
  const id: unknown = idField.value, kind: unknown = kindField.value;
  if (typeof id !== 'string' || id.trim().length === 0) throw new TypeError('Entity id must be a nonblank string');
  if (typeof kind !== 'string' || kind.trim().length === 0) throw new TypeError('Entity kind must be a nonblank string');
  return Object.freeze({id, kind});
}

/** Immutable membership in insertion order; no live storage or runtime authority. */
export interface EntityCollection {
  readonly entities: readonly EntitySnapshot[];
}

function makeCollection(entities: readonly EntitySnapshot[]): EntityCollection {
  return Object.freeze({entities: Object.freeze(entities)});
}

// Structural inputs are validated and detached too; never trust readonly types
// or return caller-owned entities/arrays. EC03 remains the sole entity validator.
function readCollection(collection: EntityCollection): readonly EntitySnapshot[] {
  if (typeof collection !== 'object' || collection === null || Array.isArray(collection)
    || Reflect.ownKeys(collection).length !== 1) {
    throw new TypeError('Entity collection must contain exactly own entities data');
  }
  const field = Object.getOwnPropertyDescriptor(collection, 'entities');
  if (!field || !('value' in field) || !Array.isArray(field.value)) {
    throw new TypeError('Entity collection entities must be an own data array');
  }
  const input: unknown[] = field.value;
  if (Reflect.ownKeys(input).length !== input.length + 1) {
    throw new TypeError('Entity collection must be a dense array without extra fields');
  }
  const entities: EntitySnapshot[] = [];
  const ids = new Set<string>();
  for (let index = 0; index < input.length; index++) {
    const item = Object.getOwnPropertyDescriptor(input, String(index));
    if (!item || !('value' in item)) throw new TypeError('Entity collection entries must be own data');
    const entity = createEntity(item.value as EntityDefinition);
    if (ids.has(entity.id)) throw new TypeError(`Duplicate entity ID '${entity.id}'`);
    ids.add(entity.id);
    entities.push(entity);
  }
  return Object.freeze(entities);
}

function requireEntityId(id: string): void {
  if (typeof id !== 'string' || id.trim().length === 0) throw new TypeError('Entity ID must be a nonblank string');
}

export function createEntityCollection(): EntityCollection {
  return makeCollection([]);
}

/** Append a validated detached snapshot; duplicates throw, never overwrite. */
export function addEntity(collection: EntityCollection, input: EntityDefinition): EntityCollection {
  const entities = readCollection(collection);
  const entity = createEntity(input);
  if (entities.some(existing => existing.id === entity.id)) throw new TypeError(`Duplicate entity ID '${entity.id}'`);
  return makeCollection([...entities, entity]);
}

/** Exact ID lookup; a valid unknown ID returns undefined. */
export function getEntity(collection: EntityCollection, entityId: string): EntitySnapshot | undefined {
  requireEntityId(entityId);
  return readCollection(collection).find(entity => entity.id === entityId);
}

export function hasEntity(collection: EntityCollection, entityId: string): boolean {
  return getEntity(collection, entityId) !== undefined;
}

/** Frozen ordered enumeration, never a writable caller-owned array. */
export function listEntities(collection: EntityCollection): readonly EntitySnapshot[] {
  return readCollection(collection);
}

/** Remove exactly one existing ID; preserve relative order and the old version. */
export function removeEntity(collection: EntityCollection, entityId: string): EntityCollection {
  requireEntityId(entityId);
  const entities = readCollection(collection);
  if (!entities.some(entity => entity.id === entityId)) throw new TypeError(`Unknown entity ID '${entityId}'`);
  return makeCollection(entities.filter(entity => entity.id !== entityId));
}

/** Full same-ID replacement in place; never upsert, rename or partial merge. */
export function replaceEntity(collection: EntityCollection, input: EntityDefinition): EntityCollection {
  const entities = readCollection(collection);
  const replacement = createEntity(input);
  if (!entities.some(entity => entity.id === replacement.id)) throw new TypeError(`Unknown entity ID '${replacement.id}'`);
  return makeCollection(entities.map(entity => entity.id === replacement.id ? replacement : entity));
}

/** Separate immutable base state associated by exact Entity ID, not membership. */
export interface EntityAttributeState {
  readonly entityId: string;
  readonly baseAttributes: Readonly<Record<string, number>>;
}

/** Caller owns schema/policy; numerical rule types and semantics belong to Kernel. */
export type EntityStatConfiguration = Omit<PreparedStatCalculationInput, 'attributeBases'> & {
  readonly modifiers: readonly NumericalModifier[];
};

/** Detached numeric projection; no mutable Kernel diagnostics or cached state. */
export interface EntityStatSnapshot {
  readonly entityId: string;
  readonly effectiveAttributes: Readonly<Record<string, number>>;
  readonly stats: Readonly<Record<string, number>>;
}

// Read descriptors rather than invoking getters. Restrict boundary records to
// ordinary/null prototypes; Object.fromEntries preserves even __proto__ as data.
function dataRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError('Expected an own-data record');
  }
  return Object.fromEntries(Reflect.ownKeys(input).map(key => {
    const field = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== 'string' || !field || !('value' in field)) {
      throw new TypeError('Record fields must be own string data properties');
    }
    return [key, field.value as unknown];
  }));
}

function fields(input: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  const record = dataRecord(input);
  if (required.some(key => !Object.hasOwn(record, key))
    || Object.keys(record).some(key => !required.includes(key) && !optional.includes(key))) {
    throw new TypeError('Missing or unknown configuration fields');
  }
  return record;
}

function identifier(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) throw new TypeError('Expected a nonblank identifier');
  return input;
}

function finite(input: unknown): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) throw new TypeError('Expected a finite number');
  return input;
}

function flag(input: unknown): boolean {
  if (typeof input !== 'boolean') throw new TypeError('Expected a boolean');
  return input;
}

function dataArray(input: unknown): unknown[] {
  if (!Array.isArray(input) || Reflect.ownKeys(input).length !== input.length + 1) {
    throw new TypeError('Expected a dense own-data array without extra fields');
  }
  return Array.from({length: input.length}, (_, index) => {
    const field = Object.getOwnPropertyDescriptor(input, String(index));
    if (!field || !('value' in field)) throw new TypeError('Array entries must be own data');
    return field.value as unknown;
  });
}

function numericMap(input: unknown): Readonly<Record<string, number>> {
  return Object.freeze(Object.fromEntries(Object.entries(dataRecord(input))
    .map(([key, value]) => [identifier(key), finite(value)])));
}

function attributeState(input: EntityAttributeState): EntityAttributeState {
  const state = fields(input, ['entityId', 'baseAttributes']);
  return Object.freeze({entityId: identifier(state.entityId), baseAttributes: numericMap(state.baseAttributes)});
}

export function createEntityAttributeState(entity: EntitySnapshot, baseAttributes: Readonly<Record<string, number>>): EntityAttributeState {
  return Object.freeze({entityId: createEntity(entity).id, baseAttributes: numericMap(baseAttributes)});
}

export function getEntityBaseAttributes(state: EntityAttributeState): Readonly<Record<string, number>> {
  return attributeState(state).baseAttributes;
}

/** Replace one existing key without calculation, schema edits or membership IO. */
export function setEntityBaseAttribute(state: EntityAttributeState, attributeId: string, value: number): EntityAttributeState {
  const captured = attributeState(state);
  const key = identifier(attributeId);
  const next = finite(value);
  if (!Object.hasOwn(captured.baseAttributes, key)) throw new TypeError(`Unknown attribute '${key}'`);
  return Object.freeze({entityId: captured.entityId,
    baseAttributes: Object.freeze({...captured.baseAttributes, [key]: next})});
}

function orderedIds(input: unknown): readonly string[] {
  const ids = dataArray(input).map(identifier);
  if (new Set(ids).size !== ids.length) throw new TypeError('Duplicate ordered identifier');
  return ids;
}

function orderedMap<T>(input: unknown, order: readonly string[], read: (value: unknown) => T, complete = true): Readonly<Record<string, T>> {
  const record = dataRecord(input);
  if (Object.keys(record).some(key => !order.includes(key))
    || (complete && order.some(key => !Object.hasOwn(record, key)))) {
    throw new TypeError('Map keys must match the supplied order');
  }
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, read(value)]));
}

function numericRule(input: unknown, derived = false): NumericRule {
  const rule = fields(input, derived ? ['default', 'bounds', 'enabled', 'scaling', 'training'] : ['default', 'bounds', 'enabled'], ['precision']);
  const bounds = fields(rule.bounds, [], ['min', 'max']);
  const min = Object.hasOwn(bounds, 'min') ? finite(bounds.min) : undefined;
  const max = Object.hasOwn(bounds, 'max') ? finite(bounds.max) : undefined;
  if (min !== undefined && max !== undefined && min > max) throw new TypeError('Inverted numeric bounds');
  let precision: NumericRule['precision'];
  if (Object.hasOwn(rule, 'precision')) {
    const value = fields(rule.precision, ['decimalPlaces']).decimalPlaces;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100) {
      throw new TypeError('Precision decimalPlaces must be an integer from 0 to 100');
    }
    precision = {decimalPlaces: value};
  }
  return {default: finite(rule.default), enabled: flag(rule.enabled),
    bounds: {...(min === undefined ? {} : {min}), ...(max === undefined ? {} : {max})},
    ...(precision === undefined ? {} : {precision})};
}

function derivedRule(input: unknown, attributes: readonly string[]): DerivedStatRule {
  const rule = fields(input, ['default', 'bounds', 'enabled', 'scaling', 'training'], ['precision']);
  const scaling = dataArray(rule.scaling).map(value => {
    const term = fields(value, ['attribute', 'coefficient', 'enabled']);
    const attribute = identifier(term.attribute);
    if (!attributes.includes(attribute)) throw new TypeError('Unknown scaling attribute');
    return {attribute, coefficient: finite(term.coefficient), enabled: flag(term.enabled)};
  });
  return {...numericRule(input, true), scaling, training: finite(rule.training)};
}

function numericalModifier(input: unknown, targets: readonly string[]): NumericalModifier {
  const modifier = fields(input, ['identity', 'target', 'operation', 'value', 'enabled']);
  const identity = fields(modifier.identity, ['source', 'sourceInstanceId', 'id']);
  const target = identifier(modifier.target);
  const operation = modifier.operation;
  if (!targets.includes(target)) throw new TypeError('Unknown modifier target');
  if (operation !== 'add_flat' && operation !== 'add_percent' && operation !== 'add_percentage_points') {
    throw new TypeError('Unknown numerical modifier operation');
  }
  return {identity: {source: identifier(identity.source), sourceInstanceId: identifier(identity.sourceInstanceId), id: identifier(identity.id)},
    target, operation, value: finite(modifier.value), enabled: flag(modifier.enabled)};
}

/** Validate/capture first, then delegate every numerical operation to Kernel. */
export function calculateEntityStats(state: EntityAttributeState, configuration: EntityStatConfiguration): EntityStatSnapshot {
  const captured = attributeState(state);
  const config = fields(configuration, ['attributeOrder', 'statOrder', 'attributeRules', 'attributeBaselines',
    'baseStats', 'rules', 'flatContributions', 'modifiers'], ['transforms']);
  const attributeOrder = orderedIds(config.attributeOrder), statOrder = orderedIds(config.statOrder);
  if (attributeOrder.some(key => statOrder.includes(key))) throw new TypeError('Attribute/stat target collision');
  const attributeBases = orderedMap(captured.baseAttributes, attributeOrder, finite);
  const attributeRules = orderedMap(config.attributeRules, attributeOrder, value => numericRule(value));
  const attributeBaselines = orderedMap(config.attributeBaselines, attributeOrder, finite);
  const rules = orderedMap(config.rules, statOrder, value => derivedRule(value, attributeOrder));
  const baseStats = orderedMap(config.baseStats, statOrder, finite, false);
  const flatContributions = orderedMap(config.flatContributions, statOrder, finite, false);
  const transforms = Object.hasOwn(config, 'transforms') ? orderedMap(config.transforms, statOrder, value => {
    if (typeof value !== 'function') throw new TypeError('Stat transform must be a function');
    // A JS callback can violate its numeric return type (including a Promise or
    // mutable object). Reject it without coercion or rewriting Kernel results.
    return (input: number) => finite(value(input));
  }, false) : undefined;
  const modifiers = dataArray(config.modifiers).map(value => numericalModifier(value, [...attributeOrder, ...statOrder]));
  const resolver = prepareNumericalModifiers(modifiers);
  const result = calculateStats({attributeOrder, statOrder, attributeBases, attributeRules, attributeBaselines,
    baseStats, rules, flatContributions, ...(transforms === undefined ? {} : {transforms})}, resolver);
  // Copy Kernel values verbatim; no arithmetic, fallback, rounding or repair.
  return Object.freeze({entityId: captured.entityId,
    effectiveAttributes: Object.freeze({...result.attributes}), stats: Object.freeze({...result.values})});
}

/** Current values only; bounds and policy are supplied at each operation. */
export interface EntityResourceState {
  readonly entityId: string;
  readonly current: Readonly<Record<string, number>>;
}
export type EntityResourceDefinition = Omit<ResourceNormalizationInput, 'resource'>;
export type EntityResourceBounds = Omit<ResourceNormalizationInput, 'resource' | 'current'>;
export type EntityResourceTransitionInput = Omit<ResourceTransitionInput, 'resource' | 'current'>;
export type EntityResourceRegenerationInput = Omit<ResourceRegenerationInput, 'resource' | 'current'>;
export interface EntityResourceNormalizationResult {
  readonly state: EntityResourceState;
  readonly calculation: Readonly<ResourceNormalizationResult>;
}
export interface EntityResourceTransitionResult {
  readonly state: EntityResourceState;
  readonly transition: Readonly<ResourceTransitionResult>;
}

function resourceState(input: EntityResourceState): EntityResourceState {
  const state = fields(input, ['entityId', 'current']);
  return Object.freeze({entityId: identifier(state.entityId), current: numericMap(state.current)});
}

function resourceBounds(input: Record<string, unknown>): EntityResourceBounds {
  const minimum = finite(input.minimum), maximum = finite(input.maximum);
  if (minimum > maximum) throw new TypeError('Inverted resource bounds');
  return {minimum, maximum};
}

function resourceCurrent(state: EntityResourceState, key: string): number {
  if (!Object.hasOwn(state.current, key)) throw new TypeError(`Unknown resource '${key}'`);
  return state.current[key]!; // Validated finite map and own-key check above.
}

function nextResource(state: EntityResourceState, key: string, after: number): EntityResourceState {
  return Object.freeze({entityId: state.entityId, current: Object.freeze({...state.current, [key]: after})});
}

/** Capture the complete definition set before publishing any normalized state. */
export function createEntityResourceState(entity: EntitySnapshot,
  definitions: Readonly<Record<string, EntityResourceDefinition>>): EntityResourceState {
  const entityId = createEntity(entity).id;
  const captured = Object.entries(dataRecord(definitions)).map(([key, value]) => {
    const resource = identifier(key);
    const definition = fields(value, ['minimum', 'maximum'], ['current']);
    const bounds = resourceBounds(definition);
    return {resource, ...bounds,
      ...(Object.hasOwn(definition, 'current') ? {current: finite(definition.current)} : {})};
  });
  return Object.freeze({entityId, current: Object.freeze(Object.fromEntries(captured.map(input =>
    [input.resource, normalizeResource(input).after])))});
}

/** Unknown valid IDs are absent, never inherited or implicitly initialized. */
export function getEntityResourceCurrent(state: EntityResourceState, resourceId: string): number | undefined {
  const key = identifier(resourceId), captured = resourceState(state);
  return Object.hasOwn(captured.current, key) ? captured.current[key] : undefined;
}

export function normalizeEntityResource(state: EntityResourceState, resourceId: string,
  bounds: EntityResourceBounds): EntityResourceNormalizationResult {
  const captured = resourceState(state), resource = identifier(resourceId);
  const current = resourceCurrent(captured, resource);
  const input = resourceBounds(fields(bounds, ['minimum', 'maximum']));
  const calculation = Object.freeze({...normalizeResource({resource, current, ...input})});
  return Object.freeze({state: nextResource(captured, resource, calculation.after), calculation});
}

export function transitionEntityResource(state: EntityResourceState, resourceId: string,
  options: EntityResourceTransitionInput): EntityResourceTransitionResult {
  const captured = resourceState(state), resource = identifier(resourceId);
  const current = resourceCurrent(captured, resource);
  const input = fields(options, ['maximum', 'amount', 'operation', 'rule']);
  const rule = fields(input.rule, ['minimum', 'currentAboveMaximum', 'allowIncreaseFromMinimum']);
  const bounds = resourceBounds({minimum: rule.minimum, maximum: input.maximum});
  const amount = finite(input.amount), operation = input.operation;
  if (amount < 0 || current < bounds.minimum) throw new TypeError('Invalid resource transition preconditions');
  if (operation !== 'increase' && operation !== 'decrease') throw new TypeError('Invalid resource operation');
  const policy = rule.currentAboveMaximum;
  if (policy !== 'allow' && policy !== 'reject') throw new TypeError('Invalid above-maximum policy');
  const transition = Object.freeze({...calculateResourceTransition({resource, current, maximum: bounds.maximum,
    amount, operation, rule: {minimum: bounds.minimum, currentAboveMaximum: policy,
      allowIncreaseFromMinimum: flag(rule.allowIncreaseFromMinimum)}})});
  return Object.freeze({state: nextResource(captured, resource, transition.after), transition});
}

export function regenerateEntityResource(state: EntityResourceState, resourceId: string,
  options: EntityResourceRegenerationInput): EntityResourceTransitionResult {
  const captured = resourceState(state), resource = identifier(resourceId);
  const current = resourceCurrent(captured, resource);
  // Inspect only eligibility before Kernel's early no-op. Ignored numeric fields
  // need not be valid (or even readable); never normalize an ineligible resource.
  if (typeof options !== 'object' || options === null || Array.isArray(options)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) {
    throw new TypeError('Expected regeneration options');
  }
  const keys = ['minimum', 'maximum', 'ratePerSecond', 'elapsedSeconds', 'eligible', 'precision'];
  if (Reflect.ownKeys(options).some(key => typeof key !== 'string' || !keys.includes(key))) {
    throw new TypeError('Unknown regeneration fields');
  }
  const descriptor = Object.getOwnPropertyDescriptor(options, 'eligible');
  if (!descriptor || !('value' in descriptor)) throw new TypeError('Eligibility must be own data');
  const eligible = flag(descriptor.value);
  let input: ResourceRegenerationInput;
  if (!eligible) {
    // Kernel returns before reading the remaining required fields. The public
    // type retains its canonical contract; this deliberate partial input avoids
    // fabricated bounds/rate/time/precision in the no-op branch.
    input = {resource, current, eligible} as ResourceRegenerationInput;
  } else {
    const config = fields(options, keys);
    const bounds = resourceBounds(config);
    const ratePerSecond = finite(config.ratePerSecond), elapsedSeconds = finite(config.elapsedSeconds);
    const decimalPlaces = fields(config.precision, ['decimalPlaces']).decimalPlaces;
    if (ratePerSecond < 0 || elapsedSeconds < 0 || current < bounds.minimum || current > bounds.maximum) {
      throw new TypeError('Invalid regeneration preconditions');
    }
    if (typeof decimalPlaces !== 'number' || !Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 100) {
      throw new TypeError('Precision decimalPlaces must be an integer from 0 to 100');
    }
    input = {resource, current, ...bounds, ratePerSecond, elapsedSeconds, eligible, precision: {decimalPlaces}};
  }
  const transition = Object.freeze({...calculateResourceRegeneration(input)});
  return Object.freeze({state: nextResource(captured, resource, transition.after), transition});
}
