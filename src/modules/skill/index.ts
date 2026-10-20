import {createEntity, type EntitySnapshot} from '../entity/index.js';

/** Reusable identity only; concrete skill content and policies belong to L3. */
export interface SkillDefinition {
  readonly skillId: string;
}

/** Explicit caller identity; no generated ID or global uniqueness authority. */
export interface SkillInstanceInitialState {
  readonly instanceId: string;
}

/** Structural association, not learning, ownership authorization or activation. */
export interface SkillInstanceState {
  readonly instanceId: string;
  readonly skillId: string;
  readonly entityId: string;
}

function identityField(input: unknown, key: string): string {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError(`Skill record must contain exactly own ${key} data`);
  }
  const keys = Reflect.ownKeys(input);
  if (keys.length !== 1 || keys[0] !== key) {
    throw new TypeError(`Skill record must contain exactly own ${key} data`);
  }
  const field = Object.getOwnPropertyDescriptor(input, key);
  if (!field || !('value' in field)) throw new TypeError(`Skill ${key} must be a data property`);
  const value: unknown = field.value;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`Skill ${key} must be a nonblank string`);
  }
  return value;
}

/** Validate a closed identity record and return a detached immutable snapshot. */
export function createSkillDefinition(definition: SkillDefinition): SkillDefinition {
  return Object.freeze({skillId: identityField(definition, 'skillId')});
}

/** Capture three exact identities using canonical Entity validation; no state IO. */
export function createSkillInstance(
  definition: SkillDefinition,
  entity: EntitySnapshot,
  initial: SkillInstanceInitialState,
): SkillInstanceState {
  const skillId = createSkillDefinition(definition).skillId;
  const entityId = createEntity(entity).id;
  const instanceId = identityField(initial, 'instanceId');
  return Object.freeze({instanceId, skillId, entityId});
}
