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

function positiveLevel(input: unknown): number {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < 1) {
    throw new TypeError('Progression level must be a positive safe integer');
  }
  return input;
}

// Shared PG03 numerical validation for creation and every transition boundary.
function progressionValues(input: Record<string, unknown>): ProgressionInitialState {
  const level = positiveLevel(input.level), experience = input.experience;
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

/** Interpretation is explicit per call; caller maintains lifecycle consistency. */
export type ExperienceMode = 'cumulative' | 'level-local';

export interface LevelRequirement {
  readonly toLevel: number;
  readonly requiredExperience: number;
  readonly eligible: boolean;
}

export interface LevelAdvancementPolicy {
  readonly experienceMode: ExperienceMode;
  readonly maxLevel: number;
  readonly targetLevel: number;
  readonly requirements: readonly LevelRequirement[];
}

export type LevelAdvancementBlockReason = 'none' | 'target_reached' | 'max_level'
  | 'insufficient_experience' | 'condition_not_met';

export interface LevelAdvancementAssessment {
  readonly entityId: string;
  readonly beforeLevel: number;
  readonly projectedLevel: number;
  readonly targetLevel: number;
  readonly beforeExperience: number;
  readonly projectedExperience: number;
  readonly levelsGained: number;
  readonly experienceConsumed: number;
  readonly advancedLevels: readonly number[];
  readonly blockedAtLevel?: number;
  readonly reason: LevelAdvancementBlockReason;
}

export interface LevelAdvancementResult {
  readonly state: ProgressionState;
  readonly transition: LevelAdvancementAssessment;
}

/** Validate/capture the complete request before evaluating any successful prefix. */
function resolveLevelAdvancement(state: ProgressionState, policy: LevelAdvancementPolicy): LevelAdvancementAssessment {
  const current = readState(state);
  const input = dataFields(policy, ['experienceMode', 'maxLevel', 'targetLevel', 'requirements']);
  const mode = input.experienceMode;
  if (mode !== 'cumulative' && mode !== 'level-local') throw new TypeError('Explicit experience mode required');
  const maximum = positiveLevel(input.maxLevel), target = positiveLevel(input.targetLevel);
  if (maximum < current.level || target < current.level || target > maximum) {
    throw new TypeError('Advancement requires current level <= target level <= maximum level');
  }
  const list = input.requirements;
  if (!Array.isArray(list) || list.length !== target - current.level
    || Reflect.ownKeys(list).length !== list.length + 1) {
    throw new TypeError('Requirements must be a dense complete array without extra fields');
  }
  const requirements: LevelRequirement[] = [];
  let previousThreshold = 0;
  for (let index = 0; index < list.length; index++) {
    const field = Object.getOwnPropertyDescriptor(list, String(index));
    if (!field || !('value' in field)) throw new TypeError('Requirements must be own data entries');
    const item = dataFields(field.value, ['toLevel', 'requiredExperience', 'eligible']);
    const toLevel = positiveLevel(item.toLevel), requiredExperience = finite(item.requiredExperience);
    if (toLevel !== current.level + index + 1 || requiredExperience < 0
      || (mode === 'cumulative' && requiredExperience < previousThreshold)
      || typeof item.eligible !== 'boolean') {
      throw new TypeError('Invalid ordered level requirement');
    }
    previousThreshold = requiredExperience;
    requirements.push({toLevel, requiredExperience, eligible: item.eligible});
  }

  let level = current.level, experience = current.experience;
  let reason: LevelAdvancementBlockReason = level === maximum ? 'max_level'
    : level === target ? 'target_reached' : 'none';
  let blockedAtLevel: number | undefined;
  const advancedLevels: number[] = [];
  for (const requirement of requirements) {
    if (!requirement.eligible || experience < requirement.requiredExperience) {
      reason = requirement.eligible ? 'insufficient_experience' : 'condition_not_met';
      blockedAtLevel = requirement.toLevel;
      break;
    }
    if (mode === 'level-local') experience -= requirement.requiredExperience;
    if (!Number.isFinite(experience) || experience < 0) throw new TypeError('Invalid advancement experience');
    level = requirement.toLevel;
    advancedLevels.push(level);
  }
  return Object.freeze({entityId: current.entityId, beforeLevel: current.level,
    projectedLevel: level, targetLevel: target, beforeExperience: current.experience,
    projectedExperience: experience, levelsGained: level - current.level,
    experienceConsumed: current.experience - experience,
    advancedLevels: Object.freeze(advancedLevels),
    ...(blockedAtLevel === undefined ? {} : {blockedAtLevel}), reason});
}

/** Dry-run projection through the same resolver used by explicit advancement. */
export function evaluateLevelAdvancement(state: ProgressionState, policy: LevelAdvancementPolicy): LevelAdvancementAssessment {
  return resolveLevelAdvancement(state, policy);
}

/** Return an independent immutable snapshot; no rewards, events or implicit IO. */
export function advanceProgressionLevel(state: ProgressionState, policy: LevelAdvancementPolicy): LevelAdvancementResult {
  const transition = resolveLevelAdvancement(state, policy);
  return Object.freeze({state: Object.freeze({entityId: transition.entityId,
    level: transition.projectedLevel, experience: transition.projectedExperience}), transition});
}
