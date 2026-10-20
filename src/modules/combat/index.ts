import {getEntity, type EntityCollection, type EntityLifeState, type EntityLifeStatus} from '../entity/index.js';

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

function readLife(input: unknown, expectedId: string): EntityLifeStatus {
  const life = dataFields(input, ['entityId', 'status']);
  const entityId = identifier(life.entityId);
  if (life.status !== 'alive' && life.status !== 'dead') throw new TypeError('Invalid entity life status');
  if (entityId !== expectedId) throw new TypeError('Context and life entity IDs must match');
  return life.status;
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
  const status = readLife(sourceLife, snapshot.sourceEntityId);
  const eligibility = dataFields(policy, ['eligible']);
  if (typeof eligibility.eligible !== 'boolean') throw new TypeError('Eligibility must be an explicit boolean');
  const reason: CombatAdmissionReason = source === undefined ? 'source_not_found'
    : status === 'dead' ? 'source_dead'
      : !eligibility.eligible ? 'source_ineligible' : 'none';
  return Object.freeze({context: snapshot, status: reason === 'none' ? 'admitted' : 'rejected', reason});
}

export type CombatTargetRelation = 'self' | 'ally' | 'enemy' | 'neutral';

/** Caller resolves relationships; exact IDs must agree with self/non-self. */
export interface CombatTargetPolicy {
  readonly relation: CombatTargetRelation;
  readonly allowedRelations: readonly CombatTargetRelation[];
  readonly allowedLifeStatuses: readonly EntityLifeStatus[];
}

export type CombatTargetValidationStatus = 'accepted' | 'rejected';
export type CombatTargetRejectionReason = 'none' | 'target_not_found'
  | 'relation_not_allowed' | 'target_life_not_allowed';

/** Evaluation diagnostics only, not an authorization or authoritative target state. */
export interface CombatTargetValidationResult {
  readonly context: CombatActionContext;
  readonly targetEntityId: string;
  readonly relation: CombatTargetRelation;
  readonly targetLifeStatus: EntityLifeStatus;
  readonly status: CombatTargetValidationStatus;
  readonly reason: CombatTargetRejectionReason;
}

function relationValue(input: unknown): CombatTargetRelation {
  if (input !== 'self' && input !== 'ally' && input !== 'enemy' && input !== 'neutral') {
    throw new TypeError('Invalid target relation');
  }
  return input;
}

function allowedValues<T extends string>(input: unknown, supported: readonly T[]): readonly T[] {
  if (!Array.isArray(input)) throw new TypeError('Expected a nonempty targeting policy array');
  const length = Object.getOwnPropertyDescriptor(input, 'length')?.value as number;
  const keys = Reflect.ownKeys(input);
  if (!length || length > supported.length || keys.length !== length + 1) {
    throw new TypeError('Invalid targeting policy array shape');
  }
  const values: T[] = [];
  for (let i = 0; i < length; i++) {
    const entry = Object.getOwnPropertyDescriptor(input, String(i));
    if (!entry || !('value' in entry) || !supported.includes(entry.value as T)
      || values.includes(entry.value as T)) throw new TypeError('Invalid or duplicate targeting policy entry');
    values.push(entry.value as T);
  }
  return Object.freeze(values);
}

/** Target-only evaluation after structural admitted/none precondition validation. */
export function evaluateCombatTargetValidation(
  admission: CombatAdmissionResult,
  entities: EntityCollection,
  targetLife: EntityLifeState,
  policy: CombatTargetPolicy,
): CombatTargetValidationResult {
  const receipt = dataFields(admission, ['context', 'status', 'reason']);
  if (receipt.status !== 'admitted' || receipt.reason !== 'none') {
    throw new TypeError('Target validation requires admitted/none');
  }
  const context = createCombatActionContext(receipt.context as CombatActionContext);
  const targetEntityId = context.target.entityId;
  const target = getEntity(entities, targetEntityId);
  const targetLifeStatus = readLife(targetLife, targetEntityId);
  const data = dataFields(policy, ['relation', 'allowedRelations', 'allowedLifeStatuses']);
  const relation = relationValue(data.relation);
  const relations = allowedValues(data.allowedRelations, ['self', 'ally', 'enemy', 'neutral'] as const);
  const statuses = allowedValues(data.allowedLifeStatuses, ['alive', 'dead'] as const);
  if ((context.sourceEntityId === targetEntityId) !== (relation === 'self')) {
    throw new TypeError('Target relation must agree with exact source/target IDs');
  }
  const reason: CombatTargetRejectionReason = target === undefined ? 'target_not_found'
    : !relations.includes(relation) ? 'relation_not_allowed'
      : !statuses.includes(targetLifeStatus) ? 'target_life_not_allowed' : 'none';
  return Object.freeze({context, targetEntityId, relation, targetLifeStatus,
    status: reason === 'none' ? 'accepted' : 'rejected', reason});
}
