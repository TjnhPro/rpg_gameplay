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

export type ActorAIActionKind = 'basic_attack' | 'skill' | 'approach_target' | 'return_home' | 'wait';
export type ActorAIActionTargetMode = 'current_target' | 'self' | 'none';
export interface ActorAIActionRule {
  readonly ruleId: string;
  readonly behaviorStateId: string;
  readonly actionKey: string;
  readonly actionKind: ActorAIActionKind;
  readonly targetMode: ActorAIActionTargetMode;
}
/** L3 order is the sole priority; action keys are opaque L4 bindings. */
export interface ActorAIActionSelectionPolicy {
  readonly profileId: string;
  readonly rules: readonly ActorAIActionRule[];
}
export type ActorAIActionAvailability =
  | {readonly actionKey: string; readonly status: 'available'; readonly reasonId: null}
  | {readonly actionKey: string; readonly status: 'unavailable'; readonly reasonId: string};
/** Advisory L4 facts for one request, never canonical admission evidence. */
export interface ActorAIActionObservation extends ActorAIDecisionContext {
  readonly availability: readonly ActorAIActionAvailability[];
}
export type ActorAIActionRuleRejectionReason = 'availability_missing' | 'action_unavailable' | 'target_missing';
export interface ActorAIActionRuleRejection {
  readonly ruleId: string;
  readonly actionKey: string;
  readonly reason: ActorAIActionRuleRejectionReason;
}
export interface ActorAIActionSelectionResult {
  readonly status: 'selected' | 'no_action';
  readonly reason: 'rule_selected' | 'no_candidate' | 'manual_control';
  readonly selectedRuleId: string | null;
  readonly actionKind: ActorAIActionKind | null;
  readonly decision: ActorAIDecisionResult;
  readonly rejected: readonly ActorAIActionRuleRejection[];
}

function actionRule(input: unknown): ActorAIActionRule {
  const data = fields(input, ['ruleId', 'behaviorStateId', 'actionKey', 'actionKind', 'targetMode']);
  const kind = data.actionKind, mode = data.targetMode;
  if (!((kind === 'basic_attack' || kind === 'approach_target') && mode === 'current_target')
    && !(kind === 'skill' && (mode === 'current_target' || mode === 'self'))
    && !((kind === 'return_home' || kind === 'wait') && mode === 'none')) {
    throw new TypeError('Invalid Actor AI action kind/target mode');
  }
  return Object.freeze({ruleId: id(data.ruleId), behaviorStateId: id(data.behaviorStateId),
    actionKey: id(data.actionKey), actionKind: kind as ActorAIActionKind, targetMode: mode as ActorAIActionTargetMode});
}
export function createActorAIActionSelectionPolicy(input: ActorAIActionSelectionPolicy): ActorAIActionSelectionPolicy {
  const data = fields(input, ['profileId', 'rules']), profileId = id(data.profileId);
  const rules = perceptionArray(data.rules, actionRule), seen = new Set<string>();
  for (const rule of rules) {
    if (seen.has(rule.ruleId)) throw new TypeError('Duplicate Actor AI action rule');
    seen.add(rule.ruleId);
    const binding = rules.find(other => other.actionKey === rule.actionKey);
    if (binding && (binding.actionKind !== rule.actionKind || binding.targetMode !== rule.targetMode)) {
      throw new TypeError('Inconsistent Actor AI action binding');
    }
  }
  return Object.freeze({profileId, rules});
}
function actionObservation(input: unknown): ActorAIActionObservation {
  const data = fields(input, ['actorId', 'decisionId', 'availability']);
  const actorId = id(data.actorId), decisionId = id(data.decisionId), seen = new Set<string>();
  const availability = perceptionArray(data.availability, value => {
    const fact = fields(value, ['actionKey', 'status', 'reasonId']), actionKey = id(fact.actionKey);
    if (seen.has(actionKey)) throw new TypeError('Duplicate Actor AI action availability');
    seen.add(actionKey);
    if (fact.status === 'available' && fact.reasonId === null) {
      return Object.freeze({actionKey, status: 'available' as const, reasonId: null});
    }
    if (fact.status !== 'unavailable') throw new TypeError('Invalid Actor AI action availability');
    return Object.freeze({actionKey, status: 'unavailable' as const, reasonId: id(fact.reasonId)});
  });
  return Object.freeze({actorId, decisionId, availability});
}
export function createActorAIActionObservation(context: ActorAIDecisionContext,
  availability: readonly ActorAIActionAvailability[]): ActorAIActionObservation {
  return actionObservation({...contextSnapshot(context), availability});
}
/** Pure proposal only. L4 revalidates canonical admission and owns execution. */
export function evaluateActorAIActionSelection(state: ActorAIState, entities: EntityCollection,
  context: ActorAIDecisionContext, policy: ActorAIActionSelectionPolicy,
  observation: ActorAIActionObservation): ActorAIActionSelectionResult {
  const current = validateActorAIState(state, entities), correlation = contextSnapshot(context);
  const rules = createActorAIActionSelectionPolicy(policy), observed = actionObservation(observation);
  if (current.actorId !== correlation.actorId || observed.actorId !== current.actorId
    || observed.decisionId !== correlation.decisionId) throw new TypeError('Actor AI action correlation mismatch');
  if (rules.profileId !== current.profileId) throw new TypeError('Actor AI action profile mismatch');
  if (current.controller === 'manual') {
    return Object.freeze({status: 'no_action', reason: 'manual_control', selectedRuleId: null, actionKind: null,
      decision: validateActorAIDecisionResult(current, correlation,
        {status: 'no_action', reason: 'manual_control', intent: null}), rejected: Object.freeze([])});
  }
  const rejected: ActorAIActionRuleRejection[] = [];
  for (const rule of rules.rules) {
    if (rule.behaviorStateId !== current.behaviorStateId) continue;
    const fact = observed.availability.find(value => value.actionKey === rule.actionKey);
    const reason = rule.targetMode === 'current_target' && current.targetEntityId === null ? 'target_missing'
      : !fact ? 'availability_missing' : fact.status === 'unavailable' ? 'action_unavailable' : null;
    if (reason) {
      rejected.push(Object.freeze({ruleId: rule.ruleId, actionKey: rule.actionKey, reason}));
      continue;
    }
    const intent = createActorAIActionIntent(correlation, {actionKey: rule.actionKey,
      targetEntityId: rule.targetMode === 'current_target' ? current.targetEntityId
        : rule.targetMode === 'self' ? current.actorId : null});
    const decision = validateActorAIDecisionResult(current, correlation, {status: 'proposed', reason: 'none', intent});
    return Object.freeze({status: 'selected', reason: 'rule_selected', selectedRuleId: rule.ruleId,
      actionKind: rule.actionKind, decision, rejected: Object.freeze(rejected)});
  }
  return Object.freeze({status: 'no_action', reason: 'no_candidate', selectedRuleId: null, actionKind: null,
    decision: validateActorAIDecisionResult(current, correlation,
      {status: 'no_action', reason: 'no_candidate', intent: null}), rejected: Object.freeze(rejected)});
}

/** Caller report only: correlation is not execution proof or duplicate prevention. */
export type ActorAIActionExecutionFeedback = ActorAIActionIntent & {readonly attemptId: string} & (
  | {readonly phase: 'admission'; readonly status: 'rejected'; readonly reasonId: string}
  | {readonly phase: 'execution'; readonly status: 'completed'; readonly reasonId: null}
  | {readonly phase: 'execution'; readonly status: 'failed'; readonly reasonId: string}
);

/** Capture terminal feedback without execution, state mutation, retry or receipt verification. */
export function validateActorAIActionExecutionFeedback(selection: ActorAIActionSelectionResult,
  feedback: ActorAIActionExecutionFeedback): ActorAIActionExecutionFeedback {
  const selected = fields(selection, ['status', 'reason', 'selectedRuleId', 'actionKind', 'decision', 'rejected']);
  if (selected.status !== 'selected' || selected.reason !== 'rule_selected') {
    throw new TypeError('Feedback requires selected Actor AI proposal');
  }
  const selectedRuleId = id(selected.selectedRuleId);
  if (!['basic_attack', 'skill', 'approach_target', 'return_home', 'wait'].includes(selected.actionKind as string)) {
    throw new TypeError('Invalid selected Actor AI action kind');
  }
  const decision = fields(selected.decision, ['status', 'reason', 'intent']);
  if (decision.status !== 'proposed' || decision.reason !== 'none') throw new TypeError('Feedback requires proposed intent');
  const intent = intentSnapshot(decision.intent as ActorAIActionIntent);
  if ((selected.actionKind === 'return_home' || selected.actionKind === 'wait') !== (intent.targetEntityId === null)) {
    throw new TypeError('Invalid selected Actor AI target binding');
  }
  const seen = new Set<string>();
  perceptionArray(selected.rejected, value => {
    const rejection = fields(value, ['ruleId', 'actionKey', 'reason']), ruleId = id(rejection.ruleId);
    id(rejection.actionKey);
    if (ruleId === selectedRuleId || seen.has(ruleId)
      || !['availability_missing', 'action_unavailable', 'target_missing'].includes(rejection.reason as string)) {
      throw new TypeError('Invalid Actor AI rejection diagnostic');
    }
    seen.add(ruleId);
    return ruleId;
  });
  const data = fields(feedback, ['decisionId', 'actorId', 'actionKey', 'targetEntityId', 'attemptId', 'phase', 'status', 'reasonId']);
  const report = {decisionId: id(data.decisionId), actorId: id(data.actorId), actionKey: id(data.actionKey),
    targetEntityId: target(data.targetEntityId), attemptId: id(data.attemptId)};
  if (report.actorId !== intent.actorId || report.decisionId !== intent.decisionId
    || report.actionKey !== intent.actionKey || report.targetEntityId !== intent.targetEntityId) {
    throw new TypeError('Actor AI feedback correlation mismatch');
  }
  if (data.phase === 'execution' && data.status === 'completed' && data.reasonId === null) {
    return Object.freeze({...report, phase: 'execution', status: 'completed', reasonId: null});
  }
  if (data.phase === 'admission' && data.status === 'rejected') {
    return Object.freeze({...report, phase: 'admission', status: 'rejected', reasonId: id(data.reasonId)});
  }
  if (data.phase === 'execution' && data.status === 'failed') {
    return Object.freeze({...report, phase: 'execution', status: 'failed', reasonId: id(data.reasonId)});
  }
  throw new TypeError('Invalid Actor AI terminal feedback');
}
import {readExecutionTime, type GameplayExecutionContext} from '../../foundation/execution/index.js';
import type {EntityLifeState} from '../entity/index.js';

export type ActorAILifeGateResult =
  | {readonly status: 'allowed'; readonly reason: 'none'; readonly actorId: string}
  | {readonly status: 'blocked'; readonly reason: 'actor_dead' | 'manual_control'; readonly actorId: string};
export type ActorAIResetReason = 'respawn' | 'session_reset' | 'disengage';
export interface ActorAIResetRequest {
  readonly reason: ActorAIResetReason;
  readonly resetBehaviorStateId: string | null;
}
export type ActorAIResetResult =
  | {readonly status: 'applied'; readonly reason: 'none'; readonly action: ActorAIResetReason; readonly state: ActorAIState}
  | {readonly status: 'rejected'; readonly reason: 'actor_dead'; readonly action: ActorAIResetReason; readonly state: null};
export interface ActorAIDecisionTimingState {
  readonly actorId: string;
  readonly observedAtMs: number;
  readonly nextEligibleAtMs: number;
}
export interface ActorAIDecisionTimingPolicy {readonly intervalMs: number}
export type ActorAIDecisionTimingResult =
  | {readonly status: 'ready'; readonly reason: 'none'; readonly state: ActorAIDecisionTimingState}
  | {readonly status: 'not_due'; readonly reason: 'interval_active'; readonly state: null}
  | {readonly status: 'blocked'; readonly reason: 'manual_control' | 'actor_dead' | 'time_regressed' | 'time_unrepresentable'; readonly state: null};

function actorLifeStatus(state: ActorAIState, input: EntityLifeState): EntityLifeStatus {
  const data = fields(input, ['entityId', 'status']);
  if (id(data.entityId) !== state.actorId) throw new TypeError('Actor AI Life binding mismatch');
  return perceptionLife(data.status);
}
/** Read-only current facts, never a durable execution authorization. */
export function evaluateActorAILifeGate(state: ActorAIState, entities: EntityCollection,
  actorLife: EntityLifeState): ActorAILifeGateResult {
  const current = validateActorAIState(state, entities), life = actorLifeStatus(current, actorLife);
  if (life === 'dead') return Object.freeze({status: 'blocked', reason: 'actor_dead', actorId: current.actorId});
  if (current.controller === 'manual') return Object.freeze({status: 'blocked', reason: 'manual_control', actorId: current.actorId});
  return Object.freeze({status: 'allowed', reason: 'none', actorId: current.actorId});
}
/** Explicit metadata maintenance only; Entity revival and authoritative commit belong to L4. */
export function evaluateActorAIReset(state: ActorAIState, entities: EntityCollection, actorLife: EntityLifeState,
  behaviorPolicy: ActorAIBehaviorPolicy, request: ActorAIResetRequest): ActorAIResetResult {
  const current = validateActorAIState(state, entities), life = actorLifeStatus(current, actorLife);
  const rules = createActorAIBehaviorPolicy(behaviorPolicy), data = fields(request, ['reason', 'resetBehaviorStateId']);
  if (rules.profileId !== current.profileId || !rules.stateIds.includes(current.behaviorStateId)) {
    throw new TypeError('Actor AI reset behavior binding mismatch');
  }
  const action = data.reason;
  if (action !== 'respawn' && action !== 'session_reset' && action !== 'disengage') throw new TypeError('Invalid Actor AI reset reason');
  const destination = action === 'disengage' ? current.behaviorStateId : id(data.resetBehaviorStateId);
  if ((action === 'disengage' && data.resetBehaviorStateId !== null) || !rules.stateIds.includes(destination)) {
    throw new TypeError('Invalid Actor AI reset destination');
  }
  if (life === 'dead') return Object.freeze({status: 'rejected', reason: 'actor_dead', action, state: null});
  return Object.freeze({status: 'applied', reason: 'none', action,
    state: Object.freeze({...current, behaviorStateId: destination, targetEntityId: null})});
}
function timingSnapshot(input: ActorAIDecisionTimingState): ActorAIDecisionTimingState {
  const data = fields(input, ['actorId', 'observedAtMs', 'nextEligibleAtMs']);
  const observedAtMs = perceptionTime(data.observedAtMs), nextEligibleAtMs = perceptionTime(data.nextEligibleAtMs);
  if (nextEligibleAtMs < observedAtMs) throw new TypeError('Invalid Actor AI timing order');
  return Object.freeze({actorId: id(data.actorId), observedAtMs, nextEligibleAtMs});
}
/** Initialization does not consume a turn, enable AI or schedule work. */
export function createActorAIDecisionTimingState(state: ActorAIState, context: GameplayExecutionContext): ActorAIDecisionTimingState {
  const current = stateSnapshot(state), now = readExecutionTime(context);
  return Object.freeze({actorId: current.actorId, observedAtMs: now, nextEligibleAtMs: now});
}
/** One caller-invoked cadence evaluation; L4 owns cursor storage/freshness/commit. */
export function evaluateActorAIDecisionTiming(state: ActorAIState, entities: EntityCollection, actorLife: EntityLifeState,
  timing: ActorAIDecisionTimingState, policy: ActorAIDecisionTimingPolicy, context: GameplayExecutionContext): ActorAIDecisionTimingResult {
  const gate = evaluateActorAILifeGate(state, entities, actorLife), cursor = timingSnapshot(timing);
  const data = fields(policy, ['intervalMs']), intervalMs = data.intervalMs;
  if (cursor.actorId !== gate.actorId) throw new TypeError('Actor AI timing binding mismatch');
  if (typeof intervalMs !== 'number' || !Number.isSafeInteger(intervalMs) || intervalMs < 0) throw new TypeError('Invalid Actor AI decision interval');
  if (gate.status === 'blocked') return Object.freeze({status: 'blocked', reason: gate.reason, state: null});
  const now = readExecutionTime(context);
  if (now < cursor.observedAtMs) return Object.freeze({status: 'blocked', reason: 'time_regressed', state: null});
  if (now < cursor.nextEligibleAtMs) return Object.freeze({status: 'not_due', reason: 'interval_active', state: null});
  const nextEligibleAtMs = now + intervalMs;
  if (!Number.isFinite(nextEligibleAtMs) || (intervalMs > 0 && nextEligibleAtMs <= now)) {
    return Object.freeze({status: 'blocked', reason: 'time_unrepresentable', state: null});
  }
  return Object.freeze({status: 'ready', reason: 'none', state: Object.freeze({actorId: cursor.actorId, observedAtMs: now, nextEligibleAtMs})});
}
