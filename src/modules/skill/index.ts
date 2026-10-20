import {calculateCooldownDurationMs} from '@rpg/core/kernel';
import {readExecutionTime, type GameplayExecutionContext} from '../../foundation/execution/index.js';
import {createEntity, getEntity, getEntityResourceCurrent, transitionEntityResource,
  type EntitySnapshot, type EntityCollection, type EntityLifeState,
  type EntityResourceState, type EntityResourceTransitionResult} from '../entity/index.js';

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

/** Caller-resolved costs and live bounds; no formula, default resource or policy. */
export interface SkillResourceCost {
  readonly resourceId: string;
  readonly amount: number;
}
export interface SkillResourceCostBounds {
  readonly resourceId: string;
  readonly minimum: number;
  readonly maximum: number;
  readonly currentAboveMaximum: 'allow' | 'reject';
}
export interface SkillResourceCostRequest {
  readonly costs: readonly SkillResourceCost[];
  readonly bounds: readonly SkillResourceCostBounds[];
}
export type SkillResourceCostStatus = 'payable' | 'rejected';
export type SkillResourceCostRejectionReason = 'none' | 'resource_not_found' | 'insufficient_resource';
export interface SkillResourceCostAssessment {
  readonly instanceId: string;
  readonly skillId: string;
  readonly entityId: string;
  readonly status: SkillResourceCostStatus;
  readonly reason: SkillResourceCostRejectionReason;
  readonly rejectedResourceId: string | null;
}
/** Canonical diagnostics only; interim candidate states are never exposed. */
export type SkillResourceCostApplicationResult =
  | {readonly status: 'applied'; readonly reason: 'none'; readonly assessment: SkillResourceCostAssessment;
      readonly state: EntityResourceState;
      readonly transitions: readonly EntityResourceTransitionResult['transition'][]}
  | {readonly status: 'rejected'; readonly reason: Exclude<SkillResourceCostRejectionReason, 'none'>;
      readonly assessment: SkillResourceCostAssessment; readonly state: null; readonly transitions: readonly []};

function costArray(input: unknown): unknown[] {
  if (!Array.isArray(input) || Reflect.ownKeys(input).length !== input.length + 1) {
    throw new TypeError('Expected dense cost arrays without extra properties');
  }
  return Array.from({length: input.length}, (_, index) => {
    const field = Object.getOwnPropertyDescriptor(input, String(index));
    if (!field || !('value' in field)) throw new TypeError('Cost entries must be own data');
    return field.value as unknown;
  });
}

function costNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected a finite cost number');
  return value;
}

function resolveResourceCosts(admission: SkillAdmissionResult, resources: EntityResourceState,
  request: SkillResourceCostRequest): SkillResourceCostApplicationResult {
  const receipt = admissionFields(admission, ['instanceId', 'skillId', 'actorEntityId', 'status', 'reason']);
  const instanceId = admissionId(receipt.instanceId), skillId = admissionId(receipt.skillId);
  const entityId = admissionId(receipt.actorEntityId);
  if (receipt.status !== 'admitted' || receipt.reason !== 'none') {
    throw new TypeError('Resource costs require an admitted Skill assessment');
  }
  const input = admissionFields(request, ['costs', 'bounds']);
  const costs = costArray(input.costs).map(value => {
    const data = admissionFields(value, ['resourceId', 'amount']);
    const resourceId = admissionId(data.resourceId), amount = costNumber(data.amount);
    if (amount < 0) throw new TypeError('Cost amount must be nonnegative');
    return {resourceId, amount};
  });
  const bounds = new Map<string, SkillResourceCostBounds>();
  for (const value of costArray(input.bounds)) {
    const data = admissionFields(value, ['resourceId', 'minimum', 'maximum', 'currentAboveMaximum']);
    const resourceId = admissionId(data.resourceId);
    const minimum = costNumber(data.minimum), maximum = costNumber(data.maximum);
    const currentAboveMaximum = data.currentAboveMaximum;
    if (minimum > maximum || (currentAboveMaximum !== 'allow' && currentAboveMaximum !== 'reject')
      || bounds.has(resourceId)) throw new TypeError('Invalid or duplicate cost bounds');
    bounds.set(resourceId, {resourceId, minimum, maximum, currentAboveMaximum});
  }
  if (new Set(costs.map(cost => cost.resourceId)).size !== costs.length || bounds.size !== costs.length
    || costs.some(cost => !bounds.has(cost.resourceId))) throw new TypeError('Costs and bounds must match one-to-one');

  // Canonical lookup validates the entire Entity state even for free requests.
  // The fallback is only a lookup key, never a default resource or numerical operation.
  getEntityResourceCurrent(resources, costs[0]?.resourceId ?? entityId);
  if (resources.entityId !== entityId) throw new TypeError('Admission and Resource Entity IDs must match');
  // Copy already Entity-validated own data, including nonenumerable resource keys.
  // No second Resource validator, normalization or mutation of caller-owned objects.
  let state: EntityResourceState = Object.freeze({entityId, current: Object.freeze(Object.fromEntries(
    Object.getOwnPropertyNames(resources.current).map(key => [key, resources.current[key]!])))});
  const transitions: EntityResourceTransitionResult['transition'][] = [];
  const assessment = (reason: SkillResourceCostRejectionReason, rejectedResourceId: string | null): SkillResourceCostAssessment =>
    Object.freeze({instanceId, skillId, entityId, status: reason === 'none' ? 'payable' : 'rejected', reason, rejectedResourceId});
  for (const cost of costs) {
    let reason: Exclude<SkillResourceCostRejectionReason, 'none'> | undefined;
    if (getEntityResourceCurrent(state, cost.resourceId) === undefined) reason = 'resource_not_found';
    else if (cost.amount !== 0) {
      const bound = bounds.get(cost.resourceId)!; // Validated one-to-one above.
      const result = transitionEntityResource(state, cost.resourceId, {
        maximum: bound.maximum, amount: cost.amount, operation: 'decrease',
        rule: {minimum: bound.minimum, currentAboveMaximum: bound.currentAboveMaximum, allowIncreaseFromMinimum: false},
      });
      if (result.transition.applied !== cost.amount) reason = 'insufficient_resource';
      else {state = result.state; transitions.push(result.transition);}
    }
    if (reason !== undefined) return Object.freeze({status: 'rejected', reason,
      assessment: assessment(reason, cost.resourceId), state: null, transitions: Object.freeze([] as const)});
  }
  return Object.freeze({status: 'applied', reason: 'none', assessment: assessment('none', null),
    state, transitions: Object.freeze(transitions)});
}

/** Trial canonical transitions only; payable is a snapshot, never a reservation. */
export function evaluateSkillResourceCosts(admission: SkillAdmissionResult, resources: EntityResourceState,
  request: SkillResourceCostRequest): SkillResourceCostAssessment {
  return resolveResourceCosts(admission, resources, request).assessment;
}

/** Re-evaluate supplied current resources; return one final all-or-nothing candidate. */
export function applySkillResourceCosts(admission: SkillAdmissionResult, resources: EntityResourceState,
  request: SkillResourceCostRequest): SkillResourceCostApplicationResult {
  return resolveResourceCosts(admission, resources, request);
}

/** Independent candidate snapshot; the caller owns authoritative commit and time origin. */
export interface SkillCooldownState {
  readonly instanceId: string;
  readonly skillId: string;
  readonly entityId: string;
  readonly startedAtMs: number | null;
  readonly readyAtMs: number | null;
}
export interface SkillCooldownConfiguration {
  readonly baseDurationMs: number;
  readonly effectiveCdr: number;
}
export type SkillCooldownStatus = 'ready' | 'active';
export type SkillCooldownReason = 'none' | 'cooldown_active';
export interface SkillCooldownAssessment {
  readonly instanceId: string;
  readonly skillId: string;
  readonly entityId: string;
  readonly observedAtMs: number;
  readonly readyAtMs: number | null;
  readonly remainingMs: number;
  readonly status: SkillCooldownStatus;
  readonly reason: SkillCooldownReason;
}
export type SkillCooldownStartResult =
  | {readonly status: 'started'; readonly reason: 'none'; readonly assessment: SkillCooldownAssessment;
      readonly durationMs: number; readonly state: SkillCooldownState}
  | {readonly status: 'rejected'; readonly reason: 'cooldown_active'; readonly assessment: SkillCooldownAssessment;
      readonly durationMs: null; readonly state: null};

function cooldownIdentity(instance: SkillInstanceState): SkillInstanceState {
  const data = admissionFields(instance, ['instanceId', 'skillId', 'entityId']);
  return {instanceId: admissionId(data.instanceId), skillId: admissionId(data.skillId), entityId: admissionId(data.entityId)};
}

function cooldownTime(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError('Cooldown time must be finite and nonnegative');
  }
  return value;
}

function cooldownSnapshot(instance: SkillInstanceState, state: SkillCooldownState): SkillCooldownState {
  const identity = cooldownIdentity(instance);
  const data = admissionFields(state, ['instanceId', 'skillId', 'entityId', 'startedAtMs', 'readyAtMs']);
  if (data.instanceId !== identity.instanceId || data.skillId !== identity.skillId || data.entityId !== identity.entityId) {
    throw new TypeError('Cooldown and instance identities must match');
  }
  if (data.startedAtMs === null && data.readyAtMs === null) return {...identity, startedAtMs: null, readyAtMs: null};
  const startedAtMs = cooldownTime(data.startedAtMs), readyAtMs = cooldownTime(data.readyAtMs);
  if (readyAtMs < startedAtMs) throw new TypeError('Cooldown ready time precedes start');
  return {...identity, startedAtMs, readyAtMs};
}

function cooldownAssessment(state: SkillCooldownState, now: number): SkillCooldownAssessment {
  if (state.startedAtMs !== null && now < state.startedAtMs) throw new TypeError('Cooldown clock precedes start');
  const active = state.readyAtMs !== null && now < state.readyAtMs;
  return Object.freeze({instanceId: state.instanceId, skillId: state.skillId, entityId: state.entityId,
    observedAtMs: now, readyAtMs: state.readyAtMs, remainingMs: active ? state.readyAtMs! - now : 0,
    status: active ? 'active' : 'ready', reason: active ? 'cooldown_active' : 'none'});
}

/** Capture identity only; no provider reads, generated IDs or numerical calculation. */
export function createSkillCooldownState(instance: SkillInstanceState): SkillCooldownState {
  return Object.freeze({...cooldownIdentity(instance), startedAtMs: null, readyAtMs: null});
}

/** Observe once through Foundation; expiration never mutates stored timestamps. */
export function evaluateSkillCooldownReady(instance: SkillInstanceState, state: SkillCooldownState,
  context: GameplayExecutionContext): SkillCooldownAssessment {
  const snapshot = cooldownSnapshot(instance, state);
  return cooldownAssessment(snapshot, readExecutionTime(context));
}

/** Return a candidate only; active reuse never refreshes, pays costs or activates. */
export function startSkillCooldown(instance: SkillInstanceState, state: SkillCooldownState,
  context: GameplayExecutionContext, config: SkillCooldownConfiguration): SkillCooldownStartResult {
  const snapshot = cooldownSnapshot(instance, state);
  const data = admissionFields(config, ['baseDurationMs', 'effectiveCdr']);
  const baseDurationMs = cooldownTime(data.baseDurationMs), effectiveCdr = cooldownTime(data.effectiveCdr);
  if (effectiveCdr > 1) throw new TypeError('Effective cooldown reduction must be in [0,1]');
  // Validate every supplied record before consulting the provider or rejecting active reuse.
  const now = readExecutionTime(context), assessment = cooldownAssessment(snapshot, now);
  if (assessment.status === 'active') return Object.freeze({status: 'rejected', reason: 'cooldown_active',
    assessment, durationMs: null, state: null});
  const durationMs = calculateCooldownDurationMs(baseDurationMs, effectiveCdr);
  const readyAtMs = now + durationMs;
  if (!Number.isFinite(readyAtMs) || (durationMs > 0 && readyAtMs <= now)) {
    throw new TypeError('Cooldown ready time cannot be represented');
  }
  return Object.freeze({status: 'started', reason: 'none', assessment, durationMs,
    state: Object.freeze({instanceId: snapshot.instanceId, skillId: snapshot.skillId, entityId: snapshot.entityId,
      startedAtMs: now, readyAtMs})});
}
