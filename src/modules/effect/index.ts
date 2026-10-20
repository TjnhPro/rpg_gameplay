import {createEntity, getEntity, type EntitySnapshot, type EntityCollection,
  type EntityLifeState, type EntityLifeStatus} from '../entity/index.js';
import {readExecutionTime, type GameplayExecutionContext} from '../../foundation/execution/index.js';

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

export type EffectDuration =
  | {readonly mode: 'timed'; readonly durationMs: number}
  | {readonly mode: 'persistent'};
/** Timing references only; the embedded EffectState remains the sole instance collection. */
export interface EffectLifetimeState {
  readonly effectInstanceId: string;
  readonly mode: 'timed' | 'persistent';
  readonly startedAtMs: number;
  readonly expiresAtMs: number | null;
}
export interface EffectLifecycleState {
  readonly effectState: EffectState;
  readonly lifetimes: readonly EffectLifetimeState[];
  readonly observedAtMs: number;
}
export type EffectRemovalReason = 'explicit' | 'dispel' | 'target_defeated' | 'source_removed' | 'session_cleanup';
export type EffectLifecycleEvent =
  | {readonly type: 'started'; readonly effectInstanceId: string; readonly effectId: string;
      readonly targetEntityId: string; readonly atMs: number}
  | {readonly type: 'expired'; readonly effectInstanceId: string; readonly effectId: string;
      readonly targetEntityId: string; readonly atMs: number}
  | {readonly type: 'removed'; readonly effectInstanceId: string; readonly effectId: string;
      readonly targetEntityId: string; readonly atMs: number; readonly reason: EffectRemovalReason};
export type EffectLifecycleStartResult =
  | {readonly status: 'started'; readonly reason: 'none'; readonly state: EffectLifecycleState;
      readonly events: readonly EffectLifecycleEvent[]}
  | {readonly status: 'rejected'; readonly reason: 'application_rejected' | 'stale_application'
      | 'lifecycle_not_advanced' | 'time_regressed'; readonly state: null; readonly events: readonly []};
export type EffectLifecycleTransitionResult =
  | {readonly status: 'applied'; readonly reason: 'none'; readonly state: EffectLifecycleState;
      readonly events: readonly EffectLifecycleEvent[]}
  | {readonly status: 'rejected'; readonly reason: 'effect_not_found' | 'time_regressed';
      readonly state: null; readonly events: readonly []};

function lifecycleTime(input: unknown): number {
  if (typeof input !== 'number' || !Number.isFinite(input) || input < 0) {
    throw new TypeError('Expected finite nonnegative lifecycle milliseconds');
  }
  return input;
}

function lifecycleArray(input: unknown): unknown[] {
  if (!Array.isArray(input) || Reflect.ownKeys(input).length !== input.length + 1) {
    throw new TypeError('Expected dense own-data lifecycle array');
  }
  const result: unknown[] = [];
  for (let index = 0; index < input.length; index++) {
    const field = Object.getOwnPropertyDescriptor(input, String(index));
    if (!field || !('value' in field)) throw new TypeError('Expected own-data lifetime entry');
    result.push(field.value);
  }
  return result;
}

function lifecycleSnapshot(input: EffectLifecycleState): EffectLifecycleState {
  const data = effectFields(input, ['effectState', 'lifetimes', 'observedAtMs']);
  const effectState = validateEffectState(data.effectState as EffectState);
  const observedAtMs = lifecycleTime(data.observedAtMs);
  const entries = lifecycleArray(data.lifetimes);
  if (entries.length !== effectState.instances.length) throw new TypeError('Lifetime membership mismatch');
  const lifetimes = entries.map((entry, index): EffectLifetimeState => {
    const fields = effectFields(entry, ['effectInstanceId', 'mode', 'startedAtMs', 'expiresAtMs']);
    const effectInstanceId = effectId(fields.effectInstanceId);
    const startedAtMs = lifecycleTime(fields.startedAtMs);
    if (effectInstanceId !== effectState.instances[index]!.effectInstanceId || startedAtMs > observedAtMs) {
      throw new TypeError('Lifetime identity/order/start mismatch');
    }
    if (fields.mode === 'persistent' && fields.expiresAtMs === null) {
      return Object.freeze({effectInstanceId, mode: 'persistent', startedAtMs, expiresAtMs: null});
    }
    const expiresAtMs = lifecycleTime(fields.expiresAtMs);
    if (fields.mode !== 'timed' || expiresAtMs <= startedAtMs || expiresAtMs <= observedAtMs) {
      throw new TypeError('Invalid active lifetime mode/expiry');
    }
    return Object.freeze({effectInstanceId, mode: 'timed', startedAtMs, expiresAtMs});
  });
  return Object.freeze({effectState, lifetimes: Object.freeze(lifetimes), observedAtMs});
}

function durationSnapshot(input: EffectDuration): EffectDuration {
  // Inspect the discriminator without invoking caller accessors, then enforce its exact schema.
  if (typeof input !== 'object' || input === null) throw new TypeError('Expected Effect duration');
  const mode = Object.getOwnPropertyDescriptor(input, 'mode');
  if (!mode || !('value' in mode)) throw new TypeError('Expected own-data duration mode');
  if (mode.value === 'persistent') {
    effectFields(input, ['mode']);
    return Object.freeze({mode: 'persistent'});
  }
  const fields = effectFields(input, ['mode', 'durationMs']);
  if (fields.mode !== 'timed' || typeof fields.durationMs !== 'number'
    || !Number.isFinite(fields.durationMs) || fields.durationMs <= 0) throw new TypeError('Invalid timed duration');
  return Object.freeze({mode: 'timed', durationMs: fields.durationMs});
}

function sameEffectInstance(left: EffectInstanceState, right: EffectInstanceState): boolean {
  return left.effectInstanceId === right.effectInstanceId && left.effectId === right.effectId
    && left.targetEntityId === right.targetEntityId && left.source.kind === right.source.kind
    && left.source.sourceId === right.source.sourceId && left.source.sourceKey === right.source.sourceKey;
}

function applicationSnapshot(input: EffectApplyResult): EffectApplyResult {
  const data = effectFields(input, ['status', 'reason', 'admission', 'state']);
  const assessment = effectFields(data.admission, ['request', 'status', 'reason']);
  const request = effectFields(assessment.request, ['instance']);
  const instance = instanceSnapshot(request.instance);
  const reasons: readonly EffectApplyAdmissionReason[] = ['source_not_found', 'target_not_found',
    'target_life_not_allowed', 'source_ineligible', 'target_ineligible', 'instance_already_present'];
  if (data.status === 'rejected' && data.state === null && assessment.status === 'rejected'
    && data.reason === assessment.reason && reasons.includes(data.reason as EffectApplyAdmissionReason)) {
    const reason = data.reason as Exclude<EffectApplyAdmissionReason, 'none'>;
    return Object.freeze({status: 'rejected', reason, state: null,
      admission: Object.freeze({request: Object.freeze({instance}), status: 'rejected', reason})});
  }
  if (data.status !== 'applied' || data.reason !== 'none'
    || assessment.status !== 'admitted' || assessment.reason !== 'none') throw new TypeError('Invalid Effect application result');
  const state = validateEffectState(data.state as EffectState);
  const last = state.instances[state.instances.length - 1];
  if (!last || !sameEffectInstance(last, instance)) throw new TypeError('Application request/candidate mismatch');
  return Object.freeze({status: 'applied', reason: 'none', state,
    admission: Object.freeze({request: Object.freeze({instance}), status: 'admitted', reason: 'none'})});
}

function lifecycleEvent(type: 'started' | 'expired', instance: EffectInstanceState, atMs: number): EffectLifecycleEvent {
  return Object.freeze({type, effectInstanceId: instance.effectInstanceId, effectId: instance.effectId,
    targetEntityId: instance.targetEntityId, atMs});
}

/** Empty initialization only: never invent timing history for structural instances. */
export function createEffectLifecycleState(state: EffectState, context: GameplayExecutionContext): EffectLifecycleState {
  const effectState = validateEffectState(state);
  const observedAtMs = readExecutionTime(context);
  if (effectState.instances.length) throw new TypeError('Lifecycle initialization requires empty EffectState');
  return Object.freeze({effectState, lifetimes: Object.freeze([]), observedAtMs});
}

/** Bind a value-validated EF09 candidate to the exact current canonical baseline. */
export function startEffectLifetime(lifecycle: EffectLifecycleState, application: EffectApplyResult,
  duration: EffectDuration, context: GameplayExecutionContext): EffectLifecycleStartResult {
  const current = lifecycleSnapshot(lifecycle), accepted = applicationSnapshot(application);
  const timing = durationSnapshot(duration), now = readExecutionTime(context);
  const expiresAtMs = timing.mode === 'persistent' ? null : now + timing.durationMs;
  if (expiresAtMs !== null && (!Number.isFinite(expiresAtMs) || expiresAtMs <= now)) {
    throw new TypeError('Unrepresentable Effect expiry');
  }
  // Complete contract validation, including clock and arithmetic, precedes normal rejection.
  const rejection = now < current.observedAtMs ? 'time_regressed'
    : now > current.observedAtMs ? 'lifecycle_not_advanced'
      : accepted.status === 'rejected' ? 'application_rejected'
        : accepted.state.entityId !== current.effectState.entityId
          || accepted.state.instances.length !== current.effectState.instances.length + 1
          || current.effectState.instances.some((instance, index) => !sameEffectInstance(instance, accepted.state.instances[index]!))
          ? 'stale_application' : null;
  if (rejection !== null) return Object.freeze({status: 'rejected', reason: rejection, state: null, events: Object.freeze([] as const)});
  // The rejected branch above establishes this, but retain TypeScript's discriminant here.
  if (accepted.status !== 'applied') throw new TypeError('Expected applied candidate');
  const instance = accepted.admission.request.instance;
  const lifetime: EffectLifetimeState = Object.freeze({effectInstanceId: instance.effectInstanceId,
    mode: timing.mode, startedAtMs: now, expiresAtMs});
  const state = lifecycleSnapshot({effectState: accepted.state,
    lifetimes: [...current.lifetimes, lifetime], observedAtMs: now});
  return Object.freeze({status: 'started', reason: 'none', state,
    events: Object.freeze([lifecycleEvent('started', instance, now)])});
}

/** Expiration boundary only; future due periodic intent must be processed by L4 first (D15). */
export function advanceEffectLifecycle(lifecycle: EffectLifecycleState,
  context: GameplayExecutionContext): EffectLifecycleTransitionResult {
  const current = lifecycleSnapshot(lifecycle), now = readExecutionTime(context);
  if (now < current.observedAtMs) {
    return Object.freeze({status: 'rejected', reason: 'time_regressed', state: null, events: Object.freeze([] as const)});
  }
  const due = current.lifetimes.filter(lifetime => lifetime.expiresAtMs !== null && lifetime.expiresAtMs <= now);
  due.sort((a, b) => a.expiresAtMs! - b.expiresAtMs!
    || (a.effectInstanceId < b.effectInstanceId ? -1 : a.effectInstanceId > b.effectInstanceId ? 1 : 0));
  const expired = new Set(due.map(lifetime => lifetime.effectInstanceId));
  const instances = current.effectState.instances.filter(instance => !expired.has(instance.effectInstanceId));
  const state = lifecycleSnapshot({effectState: {entityId: current.effectState.entityId, instances},
    lifetimes: current.lifetimes.filter(lifetime => !expired.has(lifetime.effectInstanceId)), observedAtMs: now});
  const events = due.map(lifetime => lifecycleEvent('expired',
    current.effectState.instances[current.lifetimes.indexOf(lifetime)]!, lifetime.expiresAtMs!));
  return Object.freeze({status: 'applied', reason: 'none', state, events: Object.freeze(events)});
}

/** One explicit removal at observedAtMs, with no clock, death listener or cascade. */
export function removeEffectLifetime(lifecycle: EffectLifecycleState, effectInstanceId: string,
  reason: EffectRemovalReason): EffectLifecycleTransitionResult {
  const current = lifecycleSnapshot(lifecycle), id = effectId(effectInstanceId);
  if (!(['explicit', 'dispel', 'target_defeated', 'source_removed', 'session_cleanup'] as readonly unknown[]).includes(reason)) {
    throw new TypeError('Invalid Effect removal reason');
  }
  const index = current.effectState.instances.findIndex(instance => instance.effectInstanceId === id);
  if (index === -1) return Object.freeze({status: 'rejected', reason: 'effect_not_found', state: null, events: Object.freeze([] as const)});
  const instance = current.effectState.instances[index]!;
  const state = lifecycleSnapshot({effectState: {entityId: current.effectState.entityId,
    instances: current.effectState.instances.filter((_, position) => position !== index)},
    lifetimes: current.lifetimes.filter((_, position) => position !== index), observedAtMs: current.observedAtMs});
  const event: EffectLifecycleEvent = Object.freeze({type: 'removed', effectInstanceId: id, effectId: instance.effectId,
    targetEntityId: instance.targetEntityId, atMs: current.observedAtMs, reason});
  return Object.freeze({status: 'applied', reason: 'none', state, events: Object.freeze([event])});
}
