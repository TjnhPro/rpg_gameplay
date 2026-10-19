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

/** Explicit signed change; an optional cap belongs to this operation only. */
export interface ExperienceAdjustment {
  readonly delta: number;
  readonly maximumExperience?: number;
}

export interface ExperienceTransition {
  readonly entityId: string;
  readonly before: number;
  readonly after: number;
  readonly requestedDelta: number;
  readonly appliedDelta: number;
  readonly limited: boolean;
}

export interface ExperienceTransitionResult {
  readonly state: ProgressionState;
  readonly transition: ExperienceTransition;
}

function dataFields(input: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('Expected a closed own-data record');
  }
  const keys = Reflect.ownKeys(input);
  if (required.some(key => !Object.hasOwn(input, key))
    || keys.some(key => typeof key !== 'string' || (!required.includes(key) && !optional.includes(key)))
    || optional.some(key => key in input && !Object.hasOwn(input, key))) {
    throw new TypeError('Missing, inherited or unknown fields');
  }
  return Object.fromEntries(keys.map(key => {
    const field = Object.getOwnPropertyDescriptor(input, key);
    if (!field || !('value' in field)) throw new TypeError('Fields must be own data properties, not accessors');
    return [key, field.value as unknown];
  }));
}

function finite(input: unknown): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) throw new TypeError('Expected a finite number');
  return input;
}

// Shared PG03 numerical validation for creation and every transition boundary.
function progressionValues(input: Record<string, unknown>): ProgressionInitialState {
  const level = input.level, experience = input.experience;
  if (typeof level !== 'number' || !Number.isSafeInteger(level) || level < 1) {
    throw new TypeError('Progression level must be a positive safe integer');
  }
  if (typeof experience !== 'number' || !Number.isFinite(experience) || experience < 0) {
    throw new TypeError('Progression experience must be a finite nonnegative number');
  }
  return {level, experience};
}

function readState(input: ProgressionState): ProgressionState {
  const data = dataFields(input, ['entityId', 'level', 'experience']);
  const entityId = data.entityId;
  if (typeof entityId !== 'string' || !entityId.trim()) throw new TypeError('Progression entityId must be a nonblank string');
  return {entityId, ...progressionValues(data)};
}

/** Capture an independent immutable snapshot; no advancement or membership IO. */
export function createProgressionState(entity: EntitySnapshot, initialState: ProgressionInitialState): ProgressionState {
  const entityId = createEntity(entity).id;
  return Object.freeze({entityId, ...progressionValues(dataFields(initialState, ['level', 'experience']))});
}

/** Canonical recorded-scalar transition; level and identity are preserved. */
export function adjustExperience(state: ProgressionState, adjustment: ExperienceAdjustment): ExperienceTransitionResult {
  const current = readState(state);
  const input = dataFields(adjustment, ['delta'], ['maximumExperience']);
  const delta = finite(input.delta);
  const maximum = Object.hasOwn(input, 'maximumExperience') ? finite(input.maximumExperience) : undefined;
  const before = current.experience;
  if (maximum !== undefined && (maximum < 0 || maximum < before)) {
    throw new TypeError('Maximum experience must be nonnegative and at least current experience');
  }
  const requested = before + delta;
  const limited = requested < 0 || (maximum !== undefined && requested > maximum);
  // A finite explicit cap also bounds intermediate positive addition overflow.
  const after = requested < 0 ? 0 : maximum !== undefined && requested > maximum ? maximum : requested;
  if (!Number.isFinite(after)) throw new TypeError('Experience adjustment overflow');
  return Object.freeze({
    state: Object.freeze({...current, experience: after}),
    transition: Object.freeze({entityId: current.entityId, before, after,
      requestedDelta: delta, appliedDelta: after - before, limited}),
  });
}

/** Nonnegative convenience wrapper; all updates use adjustExperience. */
export function gainExperience(state: ProgressionState, amount: number,
  policy?: Omit<ExperienceAdjustment, 'delta'>): ExperienceTransitionResult {
  const delta = finite(amount);
  if (delta < 0) throw new TypeError('Experience gain must be nonnegative');
  const options = policy === undefined ? {} : dataFields(policy, [], ['maximumExperience']);
  return adjustExperience(state, {...options, delta});
}
