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
