import {createEntity, getEntity, type EntitySnapshot, type EntityCollection,
  type EntityLifeState, type EntityLifeStatus} from '../entity/index.js';

/** Caller-resolved origin identity; neither existence nor application permission. */
export type EffectSourceReference =
  | {readonly kind: 'entity'; readonly sourceId: string; readonly sourceKey: string}
  | {readonly kind: 'system'; readonly sourceId: string; readonly sourceKey: string};

/** Reusable identity only; concrete content belongs to L3. */
export interface EffectDefinition {readonly effectId: string}
export interface EffectInstanceInitialState {
  readonly effectInstanceId: string;
  readonly source: EffectSourceReference;
}
/** Structural association only, without applied/active/lifecycle semantics. */
export interface EffectInstanceState {
  readonly effectInstanceId: string;
  readonly effectId: string;
  readonly source: EffectSourceReference;
  readonly targetEntityId: string;
}
/** Caller-owned ordered structural snapshots; not an active Effect store. */
export interface EffectState {
  readonly entityId: string;
  readonly instances: readonly EffectInstanceState[];
}

function effectFields(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('Expected a closed Effect record');
  }
  const ownKeys = Reflect.ownKeys(input);
  if (ownKeys.length !== keys.length || keys.some(key => !Object.hasOwn(input, key))) {
    throw new TypeError('Missing or unknown Effect fields');
  }
  return Object.fromEntries(ownKeys.map(key => {
    const field = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== 'string' || !keys.includes(key) || !field || !('value' in field)) {
      throw new TypeError('Effect fields must be own string data properties');
    }
    return [key, field.value as unknown];
  }));
}

function effectId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('Expected a nonblank Effect identity');
  return value;
}

function sourceSnapshot(input: unknown): EffectSourceReference {
  const data = effectFields(input, ['kind', 'sourceId', 'sourceKey']);
  if (data.kind !== 'entity' && data.kind !== 'system') throw new TypeError('Invalid Effect source kind');
  return Object.freeze({kind: data.kind, sourceId: effectId(data.sourceId), sourceKey: effectId(data.sourceKey)});
}

function instanceSnapshot(input: unknown): EffectInstanceState {
  const data = effectFields(input, ['effectInstanceId', 'effectId', 'source', 'targetEntityId']);
  return Object.freeze({effectInstanceId: effectId(data.effectInstanceId),
    effectId: createEffectDefinition({effectId: data.effectId as string}).effectId,
    source: sourceSnapshot(data.source), targetEntityId: effectId(data.targetEntityId)});
}

/** Capture exact caller identity without mutating/freezing the input. */
export function createEffectDefinition(definition: EffectDefinition): EffectDefinition {
  const data = effectFields(definition, ['effectId']);
  return Object.freeze({effectId: effectId(data.effectId)});
}

/** Reuse canonical Entity identity validation; never apply or insert an Effect. */
export function createEffectInstance(definition: EffectDefinition, target: EntitySnapshot,
  initial: EffectInstanceInitialState): EffectInstanceState {
  const identity = createEffectDefinition(definition).effectId;
  const targetEntityId = createEntity(target).id;
  const data = effectFields(initial, ['effectInstanceId', 'source']);
  return instanceSnapshot({effectInstanceId: data.effectInstanceId, effectId: identity,
    source: data.source, targetEntityId});
}

/** Empty structural association; no default instances or implicit application. */
export function createEffectState(target: EntitySnapshot): EffectState {
  return Object.freeze({entityId: createEntity(target).id, instances: Object.freeze([])});
}

/** Validate/detach the entire ordered value; no catalog lookup or active authority. */
export function validateEffectState(state: EffectState): EffectState {
  const data = effectFields(state, ['entityId', 'instances']);
  const entityId = effectId(data.entityId), input = data.instances;
  if (!Array.isArray(input) || Reflect.ownKeys(input).length !== input.length + 1) {
    throw new TypeError('Expected a dense Effect instance array without extra fields');
  }
  const instances: EffectInstanceState[] = [], ids = new Set<string>();
  for (let index = 0; index < input.length; index++) {
    const field = Object.getOwnPropertyDescriptor(input, String(index));
    if (!field || !('value' in field)) throw new TypeError('Effect array entries must be own data');
    const instance = instanceSnapshot(field.value);
    if (instance.targetEntityId !== entityId) throw new TypeError('Effect target must match state Entity');
    if (ids.has(instance.effectInstanceId)) throw new TypeError('Duplicate Effect instance ID');
    ids.add(instance.effectInstanceId);
    instances.push(instance);
  }
  return Object.freeze({entityId, instances: Object.freeze(instances)});
}

/** Source-agnostic application boundary; identity is carried only by the instance. */
export interface EffectApplyRequest {readonly instance: EffectInstanceState}
/** Explicit caller assessments, not credentials or durable authorization. */
export interface EffectApplyPolicy {
  readonly sourceEligible: boolean;
  readonly targetEligible: boolean;
  readonly allowedTargetLifeStatuses: readonly EntityLifeStatus[];
}
export type EffectApplyAdmissionStatus = 'admitted' | 'rejected';
export type EffectApplyAdmissionReason = 'none' | 'source_not_found' | 'target_not_found'
  | 'target_life_not_allowed' | 'source_ineligible' | 'target_ineligible' | 'instance_already_present';
export interface EffectApplyAdmissionResult {
  readonly request: EffectApplyRequest;
  readonly status: EffectApplyAdmissionStatus;
  readonly reason: EffectApplyAdmissionReason;
}
/** Appended structural candidate only; caller retains freshness and commit authority. */
export type EffectApplyResult =
  | {readonly status: 'applied'; readonly reason: 'none'; readonly admission: EffectApplyAdmissionResult;
      readonly state: EffectState}
  | {readonly status: 'rejected'; readonly reason: Exclude<EffectApplyAdmissionReason, 'none'>;
      readonly admission: EffectApplyAdmissionResult; readonly state: null};

function applyPolicySnapshot(policy: EffectApplyPolicy): EffectApplyPolicy {
  const data = effectFields(policy, ['sourceEligible', 'targetEligible', 'allowedTargetLifeStatuses']);
  if (typeof data.sourceEligible !== 'boolean' || typeof data.targetEligible !== 'boolean') {
    throw new TypeError('Effect eligibility requires explicit booleans');
  }
  const input = data.allowedTargetLifeStatuses;
  if (!Array.isArray(input) || !input.length || input.length > 2
    || Reflect.ownKeys(input).length !== input.length + 1) {
    throw new TypeError('Expected nonempty unique own-data life statuses');
  }
  const statuses: EntityLifeStatus[] = [];
  for (let index = 0; index < input.length; index++) {
    const field = Object.getOwnPropertyDescriptor(input, String(index));
    if (!field || !('value' in field) || (field.value !== 'alive' && field.value !== 'dead')
      || statuses.includes(field.value)) throw new TypeError('Invalid or duplicate allowed life status');
    statuses.push(field.value as EntityLifeStatus);
  }
  return Object.freeze({sourceEligible: data.sourceEligible, targetEligible: data.targetEligible,
    allowedTargetLifeStatuses: Object.freeze(statuses)});
}

/** Validate the entire context before selecting an ordinary rejection; never apply. */
export function evaluateEffectApplyAdmission(definition: EffectDefinition, request: EffectApplyRequest,
  state: EffectState, entities: EntityCollection, targetLife: EntityLifeState,
  policy: EffectApplyPolicy): EffectApplyAdmissionResult {
  const identity = createEffectDefinition(definition);
  const data = effectFields(request, ['instance']);
  const instance = instanceSnapshot(data.instance);
  const current = validateEffectState(state);
  const life = effectFields(targetLife, ['entityId', 'status']);
  const lifeEntityId = effectId(life.entityId);
  if (life.status !== 'alive' && life.status !== 'dead') throw new TypeError('Invalid Entity life status');
  const eligibility = applyPolicySnapshot(policy);
  if (identity.effectId !== instance.effectId || current.entityId !== instance.targetEntityId
    || lifeEntityId !== instance.targetEntityId) throw new TypeError('Effect application identity mismatch');
  // getEntity validates the complete canonical collection, even when the target is missing.
  const target = getEntity(entities, instance.targetEntityId);
  // A system source is never looked up as an Entity or represented by a fake Entity.
  const sourceMissing = instance.source.kind === 'entity'
    && getEntity(entities, instance.source.sourceId) === undefined;
  const reason: EffectApplyAdmissionReason = sourceMissing ? 'source_not_found'
    : target === undefined ? 'target_not_found'
      : !eligibility.allowedTargetLifeStatuses.includes(life.status) ? 'target_life_not_allowed'
        : !eligibility.sourceEligible ? 'source_ineligible'
          : !eligibility.targetEligible ? 'target_ineligible'
            : current.instances.some(item => item.effectInstanceId === instance.effectInstanceId)
              ? 'instance_already_present' : 'none';
  return Object.freeze({request: Object.freeze({instance}), status: reason === 'none' ? 'admitted' : 'rejected', reason});
}

/** Reevaluate admission from current caller inputs; no receipt bypass or automatic commit. */
export function applyEffect(definition: EffectDefinition, request: EffectApplyRequest,
  state: EffectState, entities: EntityCollection, targetLife: EntityLifeState,
  policy: EffectApplyPolicy): EffectApplyResult {
  const admission = evaluateEffectApplyAdmission(definition, request, state, entities, targetLife, policy);
  if (admission.reason !== 'none') {
    return Object.freeze({status: 'rejected', reason: admission.reason, admission, state: null});
  }
  const current = validateEffectState(state);
  const candidate = validateEffectState({entityId: current.entityId,
    instances: [...current.instances, admission.request.instance]});
  return Object.freeze({status: 'applied', reason: 'none', admission, state: candidate});
}
