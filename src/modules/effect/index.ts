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

function lifecycleSnapshot(input: EffectLifecycleState, allowPendingExpiry = false): EffectLifecycleState {
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
    if (fields.mode !== 'timed' || expiresAtMs <= startedAtMs || (!allowPendingExpiry && expiresAtMs <= observedAtMs)) {
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
  return startLifetimeAtTime(current, accepted, timing, now);
}

function startLifetimeAtTime(current: EffectLifecycleState, accepted: EffectApplyResult,
  timing: EffectDuration, now: number): EffectLifecycleStartResult {
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

export interface EffectStackGroupKey {
  readonly targetEntityId: string;
  readonly effectId: string;
  readonly sourceKey: string;
}
/** Derived view, never an additional active instance collection or policy store. */
export interface EffectStackGroupView {
  readonly key: EffectStackGroupKey;
  readonly source: EffectSourceReference;
  readonly instanceIds: readonly string[];
  readonly stackCount: number;
}
export type EffectStackPolicy =
  | {readonly mode: 'refresh'; readonly maxStacks: 1}
  | {readonly mode: 'stack'; readonly maxStacks: number};
export type EffectStackRejectionReason = 'application_rejected' | 'stale_application'
  | 'lifecycle_not_advanced' | 'time_regressed' | 'pending_expiry' | 'source_identity_conflict'
  | 'group_policy_conflict' | 'max_stacks_reached' | 'duration_mode_conflict'
  | 'persistent_already_present' | 'effect_not_found' | 'not_timed' | 'group_not_found' | 'insufficient_stacks';
export type EffectStackAdmissionResult =
  | {readonly status: 'admitted'; readonly reason: 'none'; readonly operation: 'add' | 'refresh'; readonly group: EffectStackGroupKey}
  | {readonly status: 'rejected'; readonly reason: EffectStackRejectionReason; readonly operation: null; readonly group: EffectStackGroupKey};
export interface EffectStackConsumeRequest {readonly group: EffectStackGroupKey; readonly count: number}
export interface EffectStackConsumedEvent {
  readonly type: 'stack-consumed';
  readonly group: EffectStackGroupKey;
  readonly consumedInstanceIds: readonly string[];
  readonly remainingStacks: number;
  readonly atMs: number;
}
export type EffectStackEvent = EffectLifecycleEvent | EffectStackConsumedEvent
  | {readonly type: 'refreshed'; readonly effectInstanceId: string; readonly effectId: string;
      readonly targetEntityId: string; readonly atMs: number; readonly expiresAtMs: number};
export type EffectStackMutationResult =
  | {readonly status: 'applied'; readonly reason: 'none'; readonly action: 'added' | 'refreshed' | 'consumed' | 'group_removed';
      readonly state: EffectLifecycleState; readonly events: readonly EffectStackEvent[]}
  | {readonly status: 'rejected'; readonly reason: EffectStackRejectionReason; readonly state: null; readonly events: readonly []};

function stackKey(input: unknown): EffectStackGroupKey {
  const fields = effectFields(input, ['targetEntityId', 'effectId', 'sourceKey']);
  return Object.freeze({targetEntityId: effectId(fields.targetEntityId), effectId: effectId(fields.effectId),
    sourceKey: effectId(fields.sourceKey)});
}
function instanceGroup(instance: EffectInstanceState): EffectStackGroupKey {
  return Object.freeze({targetEntityId: instance.targetEntityId, effectId: instance.effectId, sourceKey: instance.source.sourceKey});
}
function sameGroup(left: EffectStackGroupKey, right: EffectStackGroupKey): boolean {
  return left.targetEntityId === right.targetEntityId && left.effectId === right.effectId && left.sourceKey === right.sourceKey;
}
function stackGroups(current: EffectLifecycleState): readonly EffectStackGroupView[] {
  const groups: {key: EffectStackGroupKey; source: EffectSourceReference; instanceIds: string[]}[] = [];
  for (const instance of current.effectState.instances) {
    const key = instanceGroup(instance), existing = groups.find(group => sameGroup(group.key, key));
    if (existing) {
      if (existing.source.kind !== instance.source.kind || existing.source.sourceId !== instance.source.sourceId) {
        throw new TypeError('Conflicting origins in existing Effect stack group');
      }
      existing.instanceIds.push(instance.effectInstanceId);
    } else groups.push({key, source: instance.source, instanceIds: [instance.effectInstanceId]});
  }
  return Object.freeze(groups.map(group => Object.freeze({...group, instanceIds: Object.freeze(group.instanceIds),
    stackCount: group.instanceIds.length})));
}
function stackSnapshot(input: EffectLifecycleState): EffectLifecycleState {
  // Stack boundaries report due membership as pending_expiry; EF11–EF15 remain strict.
  const current = lifecycleSnapshot(input, true);
  stackGroups(current);
  return current;
}
function stackPositiveInteger(input: unknown): number {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input <= 0) throw new TypeError('Expected positive safe stack integer');
  return input;
}
function stackPolicy(input: EffectStackPolicy): EffectStackPolicy {
  const fields = effectFields(input, ['mode', 'maxStacks']);
  const maxStacks = stackPositiveInteger(fields.maxStacks);
  if (fields.mode === 'refresh' && maxStacks === 1) return Object.freeze({mode: 'refresh', maxStacks: 1});
  if (fields.mode === 'stack') return Object.freeze({mode: 'stack', maxStacks});
  throw new TypeError('Invalid Effect stack policy');
}
function stackExpiry(duration: EffectDuration, now: number): number | null {
  if (duration.mode === 'persistent') return null;
  const expiry = now + duration.durationMs;
  if (!Number.isFinite(expiry) || expiry <= now) throw new TypeError('Unrepresentable Effect expiry');
  return expiry;
}
function stackTimeRejection(current: EffectLifecycleState, now: number): EffectStackRejectionReason | null {
  return now < current.observedAtMs ? 'time_regressed' : now > current.observedAtMs ? 'lifecycle_not_advanced'
    : current.lifetimes.some(lifetime => lifetime.expiresAtMs !== null && lifetime.expiresAtMs <= now) ? 'pending_expiry' : null;
}
function stackRejected(reason: EffectStackRejectionReason): EffectStackMutationResult {
  return Object.freeze({status: 'rejected', reason, state: null, events: Object.freeze([] as const)});
}
function resolveStackAdmission(lifecycle: EffectLifecycleState, application: EffectApplyResult,
  duration: EffectDuration, policy: EffectStackPolicy, context: GameplayExecutionContext) {
  const current = stackSnapshot(lifecycle), accepted = applicationSnapshot(application);
  const timing = durationSnapshot(duration), selection = stackPolicy(policy), now = readExecutionTime(context);
  const expiry = stackExpiry(timing, now), incoming = accepted.admission.request.instance, key = instanceGroup(incoming);
  const group = stackGroups(current).find(view => sameGroup(view.key, key));
  const anchorId = group?.instanceIds[0];
  const anchor = current.lifetimes.find(lifetime => lifetime.effectInstanceId === anchorId);
  const reason: EffectStackRejectionReason | null = accepted.status === 'rejected' ? 'application_rejected'
    : accepted.state.entityId !== current.effectState.entityId
      || accepted.state.instances.length !== current.effectState.instances.length + 1
      || current.effectState.instances.some((instance, index) => !sameEffectInstance(instance, accepted.state.instances[index]!))
      ? 'stale_application' : stackTimeRejection(current, now)
        ?? (group && (group.source.kind !== incoming.source.kind || group.source.sourceId !== incoming.source.sourceId)
          ? 'source_identity_conflict'
          : group && selection.mode === 'refresh' && group.stackCount > 1 ? 'group_policy_conflict'
            : anchor && selection.mode === 'refresh' && anchor.mode !== timing.mode ? 'duration_mode_conflict'
              : anchor && selection.mode === 'refresh' && anchor.mode === 'persistent' ? 'persistent_already_present'
                : group && selection.mode === 'stack' && group.stackCount >= selection.maxStacks ? 'max_stacks_reached' : null);
  const admission: EffectStackAdmissionResult = reason === null
    ? Object.freeze({status: 'admitted', reason: 'none', operation: group && selection.mode === 'refresh' ? 'refresh' : 'add', group: key})
    : Object.freeze({status: 'rejected', reason, operation: null, group: key});
  return {current, accepted, timing, now, expiry, anchorId, admission};
}

/** Exact D06 membership in first-appearance order; no time reads or retained lookup. */
export function inspectEffectStackGroups(lifecycle: EffectLifecycleState): readonly EffectStackGroupView[] {
  return stackGroups(stackSnapshot(lifecycle));
}

/** Assessment only; caller supplies current EF09 receipt and explicit L3 policy. */
export function evaluateEffectStackAdmission(lifecycle: EffectLifecycleState, application: EffectApplyResult,
  duration: EffectDuration, policy: EffectStackPolicy, context: GameplayExecutionContext): EffectStackAdmissionResult {
  return resolveStackAdmission(lifecycle, application, duration, policy, context).admission;
}

function refreshStack(current: EffectLifecycleState, id: string, now: number, expiry: number): EffectStackMutationResult {
  const index = current.effectState.instances.findIndex(instance => instance.effectInstanceId === id);
  const instance = current.effectState.instances[index]!;
  const lifetimes = current.lifetimes.map((lifetime, position) => position !== index ? lifetime
    : Object.freeze({...lifetime, expiresAtMs: Math.max(lifetime.expiresAtMs!, expiry)}));
  const state = lifecycleSnapshot({...current, lifetimes});
  const event: EffectStackEvent = Object.freeze({type: 'refreshed', effectInstanceId: id, effectId: instance.effectId,
    targetEntityId: instance.targetEntityId, atMs: now, expiresAtMs: state.lifetimes[index]!.expiresAtMs!});
  return Object.freeze({status: 'applied', reason: 'none', action: 'refreshed', state, events: Object.freeze([event])});
}

/** One canonical admission path; additions delegate to EF12 without another caller clock read. */
export function applyEffectStack(lifecycle: EffectLifecycleState, application: EffectApplyResult,
  duration: EffectDuration, policy: EffectStackPolicy, context: GameplayExecutionContext): EffectStackMutationResult {
  const resolved = resolveStackAdmission(lifecycle, application, duration, policy, context);
  const {current, accepted, timing, now, expiry, anchorId, admission} = resolved;
  if (admission.status === 'rejected') return stackRejected(admission.reason);
  if (admission.operation === 'refresh') return refreshStack(current, anchorId!, now, expiry!);
  // EF12 owns actual append and lifetime association. Captured time is already Foundation-validated.
  const started = startLifetimeAtTime(current, accepted, timing, now);
  if (started.status !== 'started') throw new TypeError('Admitted stack could not start');
  return Object.freeze({status: 'applied', reason: 'none', action: 'added', state: started.state, events: started.events});
}

/** Renew one timed lifetime, retaining original instance, start and every other deadline. */
export function refreshEffectStackLifetime(lifecycle: EffectLifecycleState, effectInstanceId: string,
  duration: EffectDuration, context: GameplayExecutionContext): EffectStackMutationResult {
  const current = stackSnapshot(lifecycle), id = effectId(effectInstanceId), timing = durationSnapshot(duration);
  const now = readExecutionTime(context), expiry = stackExpiry(timing, now);
  const timeReason = stackTimeRejection(current, now);
  if (timeReason) return stackRejected(timeReason);
  const lifetime = current.lifetimes.find(entry => entry.effectInstanceId === id);
  if (!lifetime) return stackRejected('effect_not_found');
  if (lifetime.mode !== 'timed' || timing.mode !== 'timed') return stackRejected('not_timed');
  return refreshStack(current, id, now, expiry!);
}

function orderedStackIds(current: EffectLifecycleState, group: EffectStackGroupView): readonly string[] {
  return current.lifetimes.filter(lifetime => group.instanceIds.includes(lifetime.effectInstanceId))
    .sort((left, right) => (left.expiresAtMs === null ? (right.expiresAtMs === null ? 0 : 1)
      : right.expiresAtMs === null ? -1 : left.expiresAtMs - right.expiresAtMs)
      || (left.effectInstanceId < right.effectInstanceId ? -1 : left.effectInstanceId > right.effectInstanceId ? 1 : 0))
    .map(lifetime => lifetime.effectInstanceId);
}
function withoutStackIds(current: EffectLifecycleState, ids: readonly string[]): EffectLifecycleState {
  return lifecycleSnapshot({effectState: {entityId: current.effectState.entityId,
    instances: current.effectState.instances.filter(instance => !ids.includes(instance.effectInstanceId))},
    lifetimes: current.lifetimes.filter(lifetime => !ids.includes(lifetime.effectInstanceId)), observedAtMs: current.observedAtMs});
}

/** Exact-N atomic membership consumption at observed time; no fake removal reason or clock. */
export function consumeEffectStacks(lifecycle: EffectLifecycleState, request: EffectStackConsumeRequest): EffectStackMutationResult {
  const current = stackSnapshot(lifecycle), fields = effectFields(request, ['group', 'count']);
  const key = stackKey(fields.group), count = stackPositiveInteger(fields.count);
  const timeReason = stackTimeRejection(current, current.observedAtMs);
  if (timeReason) return stackRejected(timeReason);
  const group = stackGroups(current).find(view => sameGroup(view.key, key));
  if (!group) return stackRejected('group_not_found');
  if (count > group.stackCount) return stackRejected('insufficient_stacks');
  const ids = Object.freeze(orderedStackIds(current, group).slice(0, count));
  const state = withoutStackIds(current, ids);
  const event: EffectStackConsumedEvent = Object.freeze({type: 'stack-consumed', group: key,
    consumedInstanceIds: ids, remainingStacks: group.stackCount - count, atMs: current.observedAtMs});
  return Object.freeze({status: 'applied', reason: 'none', action: 'consumed', state, events: Object.freeze([event])});
}

/** Coordinate the existing single-removal owner in deterministic order; no extra terminal semantics. */
export function removeEffectStackGroup(lifecycle: EffectLifecycleState, group: EffectStackGroupKey,
  reason: EffectRemovalReason): EffectStackMutationResult {
  const current = stackSnapshot(lifecycle), key = stackKey(group);
  if (!(['explicit', 'dispel', 'target_defeated', 'source_removed', 'session_cleanup'] as readonly unknown[]).includes(reason)) {
    throw new TypeError('Invalid Effect removal reason');
  }
  const timeReason = stackTimeRejection(current, current.observedAtMs);
  if (timeReason) return stackRejected(timeReason);
  const found = stackGroups(current).find(view => sameGroup(view.key, key));
  if (!found) return stackRejected('group_not_found');
  let state = current;
  const events: EffectLifecycleEvent[] = [];
  for (const id of orderedStackIds(current, found)) {
    const removed = removeEffectLifetime(state, id, reason);
    if (removed.status !== 'applied') throw new TypeError('Group membership could not be removed');
    state = removed.state;
    events.push(...removed.events);
  }
  return Object.freeze({status: 'applied', reason: 'none', action: 'group_removed', state, events: Object.freeze(events)});
}
