import {getEntity, type EntityCollection, type EntityLifeState} from '../entity/index.js';

/** Exact caller-owned actor reference; existence and targeting policy are external. */
export interface CombatEntityTarget {
  readonly kind: 'entity';
  readonly entityId: string;
}

/** Structural intent only; actionType does not imply supported execution. */
export interface CombatActionRequest {
  readonly actionId: string;
  readonly actionType: string;
  readonly sourceEntityId: string;
  readonly target: CombatEntityTarget;
}

/** Detached frozen intent, not an admission decision or execution receipt. */
export type CombatActionContext = CombatActionRequest;

function dataFields(input: unknown, required: readonly string[]): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('Expected a closed own-data record');
  }
  const keys = Reflect.ownKeys(input);
  if (required.some(key => !Object.hasOwn(input, key))
    || keys.some(key => typeof key !== 'string' || !required.includes(key))) {
    throw new TypeError('Missing, inherited or unknown Combat fields');
  }
  return Object.fromEntries(keys.map(key => {
    const field = Object.getOwnPropertyDescriptor(input, key);
    if (!field || !('value' in field)) throw new TypeError('Combat fields must be own data properties');
    return [key, field.value as unknown];
  }));
}

function identifier(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) throw new TypeError('Expected a nonblank Combat identifier');
  return input;
}

/** Capture one independent attempt without lookup, admission or gameplay effects. */
export function createCombatActionContext(request: CombatActionRequest): CombatActionContext {
  const data = dataFields(request, ['actionId', 'actionType', 'sourceEntityId', 'target']);
  const actionId = identifier(data.actionId);
  const actionType = identifier(data.actionType);
  const sourceEntityId = identifier(data.sourceEntityId);
  const target = dataFields(data.target, ['kind', 'entityId']);
  if (target.kind !== 'entity') throw new TypeError('Combat target kind must be entity');
  const entityId = identifier(target.entityId);
  return Object.freeze({actionId, actionType, sourceEntityId,
    target: Object.freeze({kind: 'entity' as const, entityId})});
}

/** Caller evaluates external conditions before supplying this explicit boolean. */
export interface CombatActorEligibilityPolicy {
  readonly eligible: boolean;
}

export type CombatAdmissionStatus = 'admitted' | 'rejected';
export type CombatAdmissionReason = 'none' | 'source_not_found' | 'source_dead' | 'source_ineligible';

/** Actor-stage evaluation only; not an execution token or durable reservation. */
export interface CombatAdmissionResult {
  readonly context: CombatActionContext;
  readonly status: CombatAdmissionStatus;
  readonly reason: CombatAdmissionReason;
}

/** Validate all inputs before evaluating source-only rejection priority. */
export function evaluateCombatActionAdmission(
  context: CombatActionContext,
  entities: EntityCollection,
  sourceLife: EntityLifeState,
  policy: CombatActorEligibilityPolicy,
): CombatAdmissionResult {
  const snapshot = createCombatActionContext(context);
  const source = getEntity(entities, snapshot.sourceEntityId);
  const life = dataFields(sourceLife, ['entityId', 'status']);
  const entityId = identifier(life.entityId);
  if (life.status !== 'alive' && life.status !== 'dead') throw new TypeError('Invalid source life status');
  if (entityId !== snapshot.sourceEntityId) throw new TypeError('Source and life entity IDs must match');
  const eligibility = dataFields(policy, ['eligible']);
  if (typeof eligibility.eligible !== 'boolean') throw new TypeError('Eligibility must be an explicit boolean');
  const reason: CombatAdmissionReason = source === undefined ? 'source_not_found'
    : life.status === 'dead' ? 'source_dead'
      : !eligibility.eligible ? 'source_ineligible' : 'none';
  return Object.freeze({context: snapshot, status: reason === 'none' ? 'admitted' : 'rejected', reason});
}
