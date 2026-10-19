import {createEntity, type EntitySnapshot} from '../entity/index.js';

/** Explicit initial values; no starting level, EXP curve or cap is supplied. */
export interface ProgressionInitialState {
  readonly level: number;
  readonly experience: number;
}

/** Recorded EXP only: cumulative vs level-local semantics are not defined here. */
export interface ProgressionState {
  readonly entityId: string;
  readonly level: number;
  readonly experience: number;
}

/** Capture an independent immutable snapshot; no advancement or membership IO. */
export function createProgressionState(entity: EntitySnapshot, initialState: ProgressionInitialState): ProgressionState {
  const entityId = createEntity(entity).id;
  if (typeof initialState !== 'object' || initialState === null || Array.isArray(initialState)) {
    throw new TypeError('Progression initial state must be an object with level and experience');
  }
  const keys = Reflect.ownKeys(initialState);
  if (keys.length !== 2 || !keys.includes('level') || !keys.includes('experience')) {
    throw new TypeError('Progression initial state must contain exactly own level and experience fields');
  }
  const levelField = Object.getOwnPropertyDescriptor(initialState, 'level');
  const experienceField = Object.getOwnPropertyDescriptor(initialState, 'experience');
  if (!levelField || !experienceField || !('value' in levelField) || !('value' in experienceField)) {
    throw new TypeError('Progression fields must be data properties, not accessors');
  }
  const level: unknown = levelField.value, experience: unknown = experienceField.value;
  if (typeof level !== 'number' || !Number.isSafeInteger(level) || level < 1) {
    throw new TypeError('Progression level must be a positive safe integer');
  }
  if (typeof experience !== 'number' || !Number.isFinite(experience) || experience < 0) {
    throw new TypeError('Progression experience must be a finite nonnegative number');
  }
  return Object.freeze({entityId, level, experience});
}
