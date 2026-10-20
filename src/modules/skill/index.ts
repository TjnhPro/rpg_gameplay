import {createEntity, getEntity, type EntitySnapshot, type EntityCollection, type EntityLifeState} from '../entity/index.js';

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

/** Explicit caller assessment; ranked values come from canonical Progression. */
export type SkillRankAdmissionPolicy =
  | {readonly mode: 'not_required'}
  | {readonly mode: 'required'; readonly currentRank: number | null; readonly minimumRank: number};

export interface SkillAdmissionPolicy {
  readonly owned: boolean;
  readonly eligible: boolean;
  readonly rank: SkillRankAdmissionPolicy;
}

export type SkillAdmissionStatus = 'admitted' | 'rejected';
export type SkillAdmissionReason = 'none' | 'actor_not_found' | 'actor_dead' | 'skill_not_owned'
  | 'skill_rank_unregistered' | 'skill_rank_too_low' | 'actor_ineligible';

/** Availability assessment only; never an execution receipt or authorization token. */
export interface SkillAdmissionResult {
  readonly instanceId: string;
  readonly skillId: string;
  readonly actorEntityId: string;
  readonly status: SkillAdmissionStatus;
  readonly reason: SkillAdmissionReason;
}

function admissionFields(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('Expected a closed Skill admission record');
  }
  const ownKeys = Reflect.ownKeys(input);
  if (ownKeys.length !== keys.length || keys.some(key => !Object.hasOwn(input, key))) {
    throw new TypeError('Missing or unknown Skill admission fields');
  }
  return Object.fromEntries(ownKeys.map(key => {
    const field = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== 'string' || !keys.includes(key) || !field || !('value' in field)) {
      throw new TypeError('Skill admission fields must be own string data properties');
    }
    return [key, field.value as unknown];
  }));
}

function admissionId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('Expected a nonblank Skill admission ID');
  return value;
}

function rankPolicy(input: unknown): SkillRankAdmissionPolicy {
  // Inspect the discriminant without invoking an accessor, then validate the exact variant.
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('Expected a Skill rank admission policy');
  }
  const mode = Object.getOwnPropertyDescriptor(input, 'mode');
  if (!mode || !('value' in mode)) throw new TypeError('Rank mode must be own data');
  if (mode.value === 'not_required') {
    admissionFields(input, ['mode']);
    return {mode: 'not_required'};
  }
  if (mode.value !== 'required') throw new TypeError('Unsupported Skill rank mode');
  const data = admissionFields(input, ['mode', 'currentRank', 'minimumRank']);
  const currentRank = data.currentRank, minimumRank = data.minimumRank;
  if ((currentRank !== null && (typeof currentRank !== 'number' || !Number.isSafeInteger(currentRank) || currentRank < 0))
    || typeof minimumRank !== 'number' || !Number.isSafeInteger(minimumRank) || minimumRank < 1) {
    throw new TypeError('Expected nonnegative current rank or null and positive minimum rank, all safe integers');
  }
  return {mode: 'required', currentRank, minimumRank};
}

/** Validate the entire invocation before deterministic Skill-stage rejection. No transitions. */
export function evaluateSkillActivationAdmission(
  definition: SkillDefinition,
  instance: SkillInstanceState,
  actorEntityId: string,
  entities: EntityCollection,
  actorLife: EntityLifeState,
  policy: SkillAdmissionPolicy,
): SkillAdmissionResult {
  const skillId = createSkillDefinition(definition).skillId;
  const data = admissionFields(instance, ['instanceId', 'skillId', 'entityId']);
  const instanceId = admissionId(data.instanceId);
  const instanceSkillId = admissionId(data.skillId), boundEntityId = admissionId(data.entityId);
  const actorId = admissionId(actorEntityId);
  if (instanceSkillId !== skillId) throw new TypeError('Definition and instance skill IDs must match');
  const actor = getEntity(entities, actorId);
  const life = admissionFields(actorLife, ['entityId', 'status']);
  if (![Object.prototype, null].includes(Object.getPrototypeOf(actorLife))
    || admissionId(life.entityId) !== actorId || (life.status !== 'alive' && life.status !== 'dead')) {
    throw new TypeError('Life snapshot must match actor ID and have alive/dead status');
  }
  const assessment = admissionFields(policy, ['owned', 'eligible', 'rank']);
  if (typeof assessment.owned !== 'boolean' || typeof assessment.eligible !== 'boolean') {
    throw new TypeError('Ownership and eligibility must be explicit booleans');
  }
  const rank = rankPolicy(assessment.rank);
  const reason: SkillAdmissionReason = actor === undefined ? 'actor_not_found'
    : life.status === 'dead' ? 'actor_dead'
      : boundEntityId !== actorId || !assessment.owned ? 'skill_not_owned'
        : rank.mode === 'required' && rank.currentRank === null ? 'skill_rank_unregistered'
          : rank.mode === 'required' && rank.currentRank !== null && rank.currentRank < rank.minimumRank ? 'skill_rank_too_low'
            : !assessment.eligible ? 'actor_ineligible' : 'none';
  return Object.freeze({instanceId, skillId, actorEntityId: actorId,
    status: reason === 'none' ? 'admitted' : 'rejected', reason});
}
