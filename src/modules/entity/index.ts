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
