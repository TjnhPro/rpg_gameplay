import {createEntity, getEntity, type EntitySnapshot, type EntityCollection, type EntityLifeStatus} from '../entity/index.js';

/** Opaque reference only; L3 owns behavior content and policy. */
export interface ActorAIProfileReference { readonly profileId: string }
export type ActorAIControllerMode = 'manual' | 'ai';
export interface ActorAIInitialState {
  readonly controller: ActorAIControllerMode;
  readonly behaviorStateId: string;
}
/** Canonical AI data; L4 owns storage, controller authority and commit. */
export interface ActorAIState extends ActorAIInitialState {
  readonly actorId: string;
  readonly profileId: string;
  readonly targetEntityId: string | null;
}
export interface ActorAIDecisionContext {
  readonly decisionId: string;
  readonly actorId: string;
}
/** Structural proposal, never gameplay admission or execution evidence. */
export interface ActorAIActionIntent extends ActorAIDecisionContext {
  readonly actionKey: string;
  readonly targetEntityId: string | null;
}
export type ActorAIDecisionResult =
  | {readonly status: 'proposed'; readonly reason: 'none'; readonly intent: ActorAIActionIntent}
  | {readonly status: 'no_action'; readonly reason: 'manual_control' | 'no_candidate'; readonly intent: null};

function fields(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new TypeError('Expected closed Actor AI record');
  const own = Reflect.ownKeys(input);
  if (own.length !== keys.length || own.some(key => typeof key !== 'string' || !keys.includes(key))) {
    throw new TypeError('Unexpected Actor AI fields');
  }
  return Object.fromEntries(keys.map(key => {
    const field = Object.getOwnPropertyDescriptor(input, key);
    if (!field || !('value' in field)) throw new TypeError('Actor AI fields must be own data');
    return [key, field.value as unknown];
  }));
}
function id(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError('Expected nonblank Actor AI identity');
  return value;
}
function controller(value: unknown): ActorAIControllerMode {
  if (value !== 'manual' && value !== 'ai') throw new TypeError('Invalid Actor AI controller');
  return value;
}
function target(value: unknown): string | null { return value === null ? null : id(value); }
function stateSnapshot(input: ActorAIState): ActorAIState {
  const data = fields(input, ['actorId', 'profileId', 'controller', 'behaviorStateId', 'targetEntityId']);
  return Object.freeze({actorId: id(data.actorId), profileId: id(data.profileId), controller: controller(data.controller),
    behaviorStateId: id(data.behaviorStateId), targetEntityId: target(data.targetEntityId)});
}
function contextSnapshot(input: ActorAIDecisionContext): ActorAIDecisionContext {
  const data = fields(input, ['decisionId', 'actorId']);
  return Object.freeze({decisionId: id(data.decisionId), actorId: id(data.actorId)});
}
function intentSnapshot(input: ActorAIActionIntent): ActorAIActionIntent {
  const data = fields(input, ['decisionId', 'actorId', 'actionKey', 'targetEntityId']);
  return Object.freeze({decisionId: id(data.decisionId), actorId: id(data.actorId),
    actionKey: id(data.actionKey), targetEntityId: target(data.targetEntityId)});
}

export function createActorAIProfileReference(input: ActorAIProfileReference): ActorAIProfileReference {
  return Object.freeze({profileId: id(fields(input, ['profileId']).profileId)});
}
/** Canonical Entity validation, no kind whitelist or initial target selection. */
export function createActorAIState(actor: EntitySnapshot, profile: ActorAIProfileReference,
  initial: ActorAIInitialState): ActorAIState {
  const entity = createEntity(actor), reference = createActorAIProfileReference(profile);
  const data = fields(initial, ['controller', 'behaviorStateId']);
  return Object.freeze({actorId: entity.id, profileId: reference.profileId, controller: controller(data.controller),
    behaviorStateId: id(data.behaviorStateId), targetEntityId: null});
}
/** Actor existence only; target references may be stale and are not eligibility evidence. */
export function validateActorAIState(state: ActorAIState, entities: EntityCollection): ActorAIState {
  const current = stateSnapshot(state);
  if (!getEntity(entities, current.actorId)) throw new TypeError('Unknown Actor AI actor');
  return current;
}
export function createActorAIDecisionContext(state: ActorAIState, decisionId: string): ActorAIDecisionContext {
  return Object.freeze({decisionId: id(decisionId), actorId: stateSnapshot(state).actorId});
}
export function createActorAIActionIntent(context: ActorAIDecisionContext,
  input: {readonly actionKey: string; readonly targetEntityId: string | null}): ActorAIActionIntent {
  const current = contextSnapshot(context), data = fields(input, ['actionKey', 'targetEntityId']);
  return Object.freeze({...current, actionKey: id(data.actionKey), targetEntityId: target(data.targetEntityId)});
}
/** Consistency validation only: no evaluator, feedback processing or state mutation. */
export function validateActorAIDecisionResult(state: ActorAIState, context: ActorAIDecisionContext,
  result: ActorAIDecisionResult): ActorAIDecisionResult {
  const current = stateSnapshot(state), correlation = contextSnapshot(context);
  const data = fields(result, ['status', 'reason', 'intent']);
  if (current.actorId !== correlation.actorId) throw new TypeError('Actor AI context binding mismatch');
  if (data.status === 'proposed' && data.reason === 'none') {
    const intent = intentSnapshot(data.intent as ActorAIActionIntent);
    if (current.controller !== 'ai' || intent.actorId !== current.actorId || intent.decisionId !== correlation.decisionId) {
      throw new TypeError('Invalid Actor AI proposal binding or controller');
    }
    return Object.freeze({status: 'proposed', reason: 'none', intent});
  }
  const reason = current.controller === 'manual' ? 'manual_control' : 'no_candidate';
  if (data.status !== 'no_action' || data.intent !== null || data.reason !== reason) {
    throw new TypeError('Invalid Actor AI decision result');
  }
  return Object.freeze({status: 'no_action', reason, intent: null});
}

/** L4 observations, not proof of current World truth or action admission. */
export interface ActorAIPerceivedEntity {
  readonly entityId: string;
  readonly relationId: string;
  readonly lifeStatus: EntityLifeStatus;
  readonly visible: boolean;
  readonly inRange: boolean;
  readonly reachable: boolean;
}
export interface ActorAIPerceptionSnapshot {
  readonly actorId: string;
  readonly observedAtMs: number;
  readonly candidates: readonly ActorAIPerceivedEntity[];
}
/** Explicit L3 membership/boolean gates; empty allowed lists permit nobody. */
export interface ActorAIPerceptionPolicy {
  readonly allowedRelationIds: readonly string[];
  readonly allowedLifeStatuses: readonly EntityLifeStatus[];
  readonly requireVisible: boolean;
  readonly requireInRange: boolean;
  readonly requireReachable: boolean;
  readonly allowSelf: boolean;
}
export type ActorAIPerceptionExclusionReason =
  | 'entity_not_found' | 'self_not_allowed' | 'target_life_not_allowed' | 'relation_not_allowed'
  | 'target_not_visible' | 'target_out_of_range' | 'target_not_reachable';
export interface ActorAIPerceptionExclusion {
  readonly entityId: string;
  readonly reason: ActorAIPerceptionExclusionReason;
}
export interface ActorAIPerceptionAssessment {
  readonly actorId: string;
  readonly observedAtMs: number;
  readonly status: 'candidates_available' | 'no_candidates';
  readonly reason: 'none' | 'no_perceived_entities' | 'no_eligible_candidates';
  readonly eligible: readonly ActorAIPerceivedEntity[];
  readonly excluded: readonly ActorAIPerceptionExclusion[];
}

function perceptionBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new TypeError('Expected Actor AI boolean fact/policy');
  return value;
}
function perceptionLife(value: unknown): EntityLifeStatus {
  if (value !== 'alive' && value !== 'dead') throw new TypeError('Invalid observed Entity Life status');
  return value;
}
function perceptionTime(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError('Invalid Actor AI observation time');
  return value;
}
function perceptionArray<T>(input: unknown, capture: (value: unknown) => T): readonly T[] {
  if (!Array.isArray(input) || Reflect.ownKeys(input).length !== input.length + 1) {
    throw new TypeError('Expected dense Actor AI data array without extra fields');
  }
  const values: T[] = [];
  for (let index = 0; index < input.length; index++) {
    const field = Object.getOwnPropertyDescriptor(input, String(index));
    if (!field || !('value' in field)) throw new TypeError('Actor AI array entries must be own data');
    values.push(capture(field.value));
  }
  return Object.freeze(values);
}
function perceivedEntity(input: unknown): ActorAIPerceivedEntity {
  const data = fields(input, ['entityId', 'relationId', 'lifeStatus', 'visible', 'inRange', 'reachable']);
  return Object.freeze({entityId: id(data.entityId), relationId: id(data.relationId), lifeStatus: perceptionLife(data.lifeStatus),
    visible: perceptionBoolean(data.visible), inRange: perceptionBoolean(data.inRange), reachable: perceptionBoolean(data.reachable)});
}
function perceptionSnapshot(input: unknown): ActorAIPerceptionSnapshot {
  const data = fields(input, ['actorId', 'observedAtMs', 'candidates']);
  const actorId = id(data.actorId), observedAtMs = perceptionTime(data.observedAtMs);
  const seen = new Set<string>();
  const candidates = perceptionArray(data.candidates, value => {
    const candidate = perceivedEntity(value);
    if (seen.has(candidate.entityId)) throw new TypeError('Duplicate perceived Entity ID');
    seen.add(candidate.entityId);
    return candidate;
  });
  return Object.freeze({actorId, observedAtMs, candidates});
}
function perceptionPolicy(input: ActorAIPerceptionPolicy): ActorAIPerceptionPolicy {
  const data = fields(input, ['allowedRelationIds', 'allowedLifeStatuses', 'requireVisible', 'requireInRange', 'requireReachable', 'allowSelf']);
  return Object.freeze({allowedRelationIds: perceptionArray(data.allowedRelationIds, id),
    allowedLifeStatuses: perceptionArray(data.allowedLifeStatuses, perceptionLife), requireVisible: perceptionBoolean(data.requireVisible),
    requireInRange: perceptionBoolean(data.requireInRange), requireReachable: perceptionBoolean(data.requireReachable),
    allowSelf: perceptionBoolean(data.allowSelf)});
}
function bindPerception(actorId: string, snapshot: ActorAIPerceptionSnapshot): void {
  if (snapshot.actorId !== actorId) throw new TypeError('Actor AI perception binding mismatch');
}

/** Capture caller facts/order/time; never query World or acquire a target. */
export function createActorAIPerceptionSnapshot(state: ActorAIState,
  input: {readonly observedAtMs: number; readonly candidates: readonly ActorAIPerceivedEntity[]}): ActorAIPerceptionSnapshot {
  const current = stateSnapshot(state), data = fields(input, ['observedAtMs', 'candidates']);
  return perceptionSnapshot({actorId: current.actorId, observedAtMs: data.observedAtMs, candidates: data.candidates});
}
export function validateActorAIPerceptionSnapshot(state: ActorAIState,
  perception: ActorAIPerceptionSnapshot): ActorAIPerceptionSnapshot {
  const current = stateSnapshot(state), snapshot = perceptionSnapshot(perception);
  bindPerception(current.actorId, snapshot);
  return snapshot;
}
/** Advisory eligibility only; L4 owns fact freshness and gameplay execution. */
export function evaluateActorAIPerception(state: ActorAIState, entities: EntityCollection,
  perception: ActorAIPerceptionSnapshot, policy: ActorAIPerceptionPolicy): ActorAIPerceptionAssessment {
  const current = validateActorAIState(state, entities);
  const snapshot = perceptionSnapshot(perception), rules = perceptionPolicy(policy);
  bindPerception(current.actorId, snapshot);
  const eligible: ActorAIPerceivedEntity[] = [], excluded: ActorAIPerceptionExclusion[] = [];
  for (const candidate of snapshot.candidates) {
    let reason: ActorAIPerceptionExclusionReason | undefined;
    if (!getEntity(entities, candidate.entityId)) reason = 'entity_not_found';
    else if (!rules.allowSelf && candidate.entityId === current.actorId) reason = 'self_not_allowed';
    else if (!rules.allowedLifeStatuses.includes(candidate.lifeStatus)) reason = 'target_life_not_allowed';
    else if (!rules.allowedRelationIds.includes(candidate.relationId)) reason = 'relation_not_allowed';
    else if (rules.requireVisible && !candidate.visible) reason = 'target_not_visible';
    else if (rules.requireInRange && !candidate.inRange) reason = 'target_out_of_range';
    else if (rules.requireReachable && !candidate.reachable) reason = 'target_not_reachable';
    if (reason === undefined) eligible.push(candidate);
    else excluded.push(Object.freeze({entityId: candidate.entityId, reason}));
  }
  return Object.freeze({actorId: current.actorId, observedAtMs: snapshot.observedAtMs,
    status: eligible.length > 0 ? 'candidates_available' : 'no_candidates',
    reason: eligible.length > 0 ? 'none' : snapshot.candidates.length === 0 ? 'no_perceived_entities' : 'no_eligible_candidates',
    eligible: Object.freeze(eligible), excluded: Object.freeze(excluded)});
}

/** L3 preferences; L4 resolves World-dependent ranking into explicit IDs. */
export interface ActorAITargetSelectionPolicy {
  readonly retention: 'retain_if_eligible' | 'prefer_priority';
  readonly preferredTargetIds: readonly string[];
}
export type ActorAITargetLossReason = 'not_perceived' | ActorAIPerceptionExclusionReason;
export type ActorAITargetSelectionResult =
  | {readonly status: 'selected'; readonly reason: 'acquired' | 'retained' | 'switched';
      readonly previousTargetEntityId: string | null; readonly selectedTargetEntityId: string;
      readonly lossReason: ActorAITargetLossReason | null; readonly state: ActorAIState}
  | {readonly status: 'no_target'; readonly reason: 'no_candidates' | 'target_lost';
      readonly previousTargetEntityId: string | null; readonly selectedTargetEntityId: null;
      readonly lossReason: ActorAITargetLossReason | null; readonly state: ActorAIState}
  | {readonly status: 'blocked'; readonly reason: 'manual_control';
      readonly previousTargetEntityId: string | null; readonly selectedTargetEntityId: null;
      readonly lossReason: null; readonly state: null};

function perceptionExclusion(input: unknown): ActorAIPerceptionExclusion {
  const data = fields(input, ['entityId', 'reason']);
  const reasons: readonly ActorAIPerceptionExclusionReason[] = ['entity_not_found', 'self_not_allowed', 'target_life_not_allowed',
    'relation_not_allowed', 'target_not_visible', 'target_out_of_range', 'target_not_reachable'];
  if (!reasons.some(reason => reason === data.reason)) throw new TypeError('Invalid Actor AI perception exclusion');
  return Object.freeze({entityId: id(data.entityId), reason: data.reason as ActorAIPerceptionExclusionReason});
}
/** Structural integrity only; no re-filtering or claim of fresh World evidence. */
function perceptionAssessment(input: ActorAIPerceptionAssessment): ActorAIPerceptionAssessment {
  const data = fields(input, ['actorId', 'observedAtMs', 'status', 'reason', 'eligible', 'excluded']);
  const actorId = id(data.actorId), observedAtMs = perceptionTime(data.observedAtMs);
  const eligible = perceptionArray(data.eligible, perceivedEntity), excluded = perceptionArray(data.excluded, perceptionExclusion);
  const seen = new Set<string>();
  for (const candidate of [...eligible, ...excluded]) {
    if (seen.has(candidate.entityId)) throw new TypeError('Duplicate assessed Entity ID');
    seen.add(candidate.entityId);
  }
  const status = eligible.length > 0 ? 'candidates_available' : 'no_candidates';
  const reason = eligible.length > 0 ? 'none' : excluded.length > 0 ? 'no_eligible_candidates' : 'no_perceived_entities';
  if (data.status !== status || data.reason !== reason) throw new TypeError('Inconsistent Actor AI perception outcome');
  return Object.freeze({actorId, observedAtMs, status, reason, eligible, excluded});
}
function targetSelectionPolicy(input: ActorAITargetSelectionPolicy): ActorAITargetSelectionPolicy {
  const data = fields(input, ['retention', 'preferredTargetIds']);
  if (data.retention !== 'retain_if_eligible' && data.retention !== 'prefer_priority') {
    throw new TypeError('Invalid Actor AI target retention');
  }
  const seen = new Set<string>();
  const preferredTargetIds = perceptionArray(data.preferredTargetIds, value => {
    const preferred = id(value);
    if (seen.has(preferred)) throw new TypeError('Duplicate preferred Entity ID');
    seen.add(preferred);
    return preferred;
  });
  return Object.freeze({retention: data.retention, preferredTargetIds});
}

/** Pure selection candidate; L4 revalidates freshness/controller and commits. */
export function evaluateActorAITargetSelection(state: ActorAIState, entities: EntityCollection,
  perception: ActorAIPerceptionAssessment, policy: ActorAITargetSelectionPolicy): ActorAITargetSelectionResult {
  const current = validateActorAIState(state, entities), assessment = perceptionAssessment(perception);
  if (assessment.actorId !== current.actorId) throw new TypeError('Actor AI assessment binding mismatch');
  const rules = targetSelectionPolicy(policy), previousTargetEntityId = current.targetEntityId;
  if (current.controller === 'manual') {
    return Object.freeze({status: 'blocked', reason: 'manual_control', previousTargetEntityId,
      selectedTargetEntityId: null, lossReason: null, state: null});
  }
  const eligibleIds = assessment.eligible.map(candidate => candidate.entityId);
  const previousEligible = previousTargetEntityId !== null && eligibleIds.includes(previousTargetEntityId);
  const lossReason = previousTargetEntityId === null || previousEligible ? null
    : assessment.excluded.find(candidate => candidate.entityId === previousTargetEntityId)?.reason ?? 'not_perceived';
  const preferred = rules.preferredTargetIds.find(candidate => eligibleIds.includes(candidate));
  // String comparison is locale-independent UTF-16 lexical order, not localeCompare.
  const fallback = eligibleIds.reduce<string | null>((best, candidate) => best === null || candidate < best ? candidate : best, null);
  const selectedTargetEntityId = rules.retention === 'retain_if_eligible' && previousEligible
    ? previousTargetEntityId : preferred ?? fallback;
  const next = Object.freeze({...current, targetEntityId: selectedTargetEntityId});
  if (selectedTargetEntityId === null) {
    return Object.freeze({status: 'no_target', reason: previousTargetEntityId === null ? 'no_candidates' : 'target_lost',
      previousTargetEntityId, selectedTargetEntityId, lossReason, state: next});
  }
  return Object.freeze({status: 'selected', reason: previousTargetEntityId === null ? 'acquired'
    : previousTargetEntityId === selectedTargetEntityId ? 'retained' : 'switched',
    previousTargetEntityId, selectedTargetEntityId, lossReason, state: next});
}

export type ActorAIBehaviorTargetRequirement = 'any' | 'present' | 'absent';
export interface ActorAIBehaviorRule {
  readonly ruleId: string;
  readonly fromStateId: string;
  readonly triggerId: string;
  readonly toStateId: string;
  readonly targetRequirement: ActorAIBehaviorTargetRequirement;
}
/** L3-owned opaque state identities and ordered first-match rules. */
export interface ActorAIBehaviorPolicy {
  readonly profileId: string;
  readonly stateIds: readonly string[];
  readonly rules: readonly ActorAIBehaviorRule[];
}
/** Explicit L4 facts; capture neither generates nor subscribes to events. */
export interface ActorAIBehaviorObservation {
  readonly actorId: string;
  readonly triggerIds: readonly string[];
}
export type ActorAIBehaviorTransitionResult =
  | {readonly status: 'transitioned'; readonly reason: 'rule_matched';
      readonly ruleId: string; readonly triggerId: string;
      readonly previousBehaviorStateId: string; readonly nextBehaviorStateId: string; readonly state: ActorAIState}
  | {readonly status: 'unchanged'; readonly reason: 'no_trigger' | 'no_matching_rule' | 'same_state';
      readonly ruleId: string | null; readonly triggerId: string | null;
      readonly previousBehaviorStateId: string; readonly nextBehaviorStateId: string; readonly state: ActorAIState}
  | {readonly status: 'blocked'; readonly reason: 'manual_control'; readonly ruleId: null; readonly triggerId: null;
      readonly previousBehaviorStateId: string; readonly nextBehaviorStateId: null; readonly state: null};

function behaviorIds(input: unknown): readonly string[] {
  const seen = new Set<string>();
  return perceptionArray(input, value => {
    const identity = id(value);
    if (seen.has(identity)) throw new TypeError('Duplicate Actor AI behavior identity');
    seen.add(identity);
    return identity;
  });
}
function behaviorRule(input: unknown): ActorAIBehaviorRule {
  const data = fields(input, ['ruleId', 'fromStateId', 'triggerId', 'toStateId', 'targetRequirement']);
  if (data.targetRequirement !== 'any' && data.targetRequirement !== 'present' && data.targetRequirement !== 'absent') {
    throw new TypeError('Invalid Actor AI behavior target requirement');
  }
  return Object.freeze({ruleId: id(data.ruleId), fromStateId: id(data.fromStateId), triggerId: id(data.triggerId),
    toStateId: id(data.toStateId), targetRequirement: data.targetRequirement});
}
export function createActorAIBehaviorPolicy(input: ActorAIBehaviorPolicy): ActorAIBehaviorPolicy {
  const data = fields(input, ['profileId', 'stateIds', 'rules']);
  const profileId = id(data.profileId), stateIds = behaviorIds(data.stateIds);
  const rules = perceptionArray(data.rules, behaviorRule), ruleIds = new Set<string>();
  for (const rule of rules) {
    if (ruleIds.has(rule.ruleId)) throw new TypeError('Duplicate Actor AI behavior rule');
    ruleIds.add(rule.ruleId);
    if (!stateIds.includes(rule.fromStateId) || !stateIds.includes(rule.toStateId)) {
      throw new TypeError('Unknown Actor AI behavior rule state');
    }
  }
  return Object.freeze({profileId, stateIds, rules});
}
function behaviorObservation(input: unknown): ActorAIBehaviorObservation {
  const data = fields(input, ['actorId', 'triggerIds']);
  return Object.freeze({actorId: id(data.actorId), triggerIds: behaviorIds(data.triggerIds)});
}
export function createActorAIBehaviorObservation(state: ActorAIState, triggerIds: readonly string[]): ActorAIBehaviorObservation {
  const current = stateSnapshot(state);
  return behaviorObservation({actorId: current.actorId, triggerIds});
}
/** Behavior decision only. L4 validates current authority and commits; no execution. */
export function evaluateActorAIBehaviorTransition(state: ActorAIState, entities: EntityCollection,
  observation: ActorAIBehaviorObservation, policy: ActorAIBehaviorPolicy): ActorAIBehaviorTransitionResult {
  const current = validateActorAIState(state, entities), rules = createActorAIBehaviorPolicy(policy);
  const observed = behaviorObservation(observation), previousBehaviorStateId = current.behaviorStateId;
  if (rules.profileId !== current.profileId) throw new TypeError('Actor AI behavior profile mismatch');
  if (!rules.stateIds.includes(previousBehaviorStateId)) throw new TypeError('Unknown current Actor AI behavior state');
  if (observed.actorId !== current.actorId) throw new TypeError('Actor AI behavior observation binding mismatch');
  if (current.controller === 'manual') {
    return Object.freeze({status: 'blocked', reason: 'manual_control', ruleId: null, triggerId: null,
      previousBehaviorStateId, nextBehaviorStateId: null, state: null});
  }
  const matched = rules.rules.find(rule => rule.fromStateId === previousBehaviorStateId
    && observed.triggerIds.includes(rule.triggerId)
    && (rule.targetRequirement === 'any'
      || (rule.targetRequirement === 'present' ? current.targetEntityId !== null : current.targetEntityId === null)));
  const nextBehaviorStateId = matched?.toStateId ?? previousBehaviorStateId;
  const next = Object.freeze({...current, behaviorStateId: nextBehaviorStateId});
  if (nextBehaviorStateId !== previousBehaviorStateId && matched) {
    return Object.freeze({status: 'transitioned', reason: 'rule_matched', ruleId: matched.ruleId, triggerId: matched.triggerId,
      previousBehaviorStateId, nextBehaviorStateId, state: next});
  }
  return Object.freeze({status: 'unchanged', reason: matched ? 'same_state'
    : observed.triggerIds.length === 0 ? 'no_trigger' : 'no_matching_rule',
    ruleId: matched?.ruleId ?? null, triggerId: matched?.triggerId ?? null, previousBehaviorStateId, nextBehaviorStateId, state: next});
}
