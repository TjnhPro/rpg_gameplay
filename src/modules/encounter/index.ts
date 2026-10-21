import {getEntity, listEntities, type EntityCollection, type EntityLifeState, type EntityLifeStatus} from '../entity/index.js';

/** Opaque L3 content reference; no catalog lookup or content ownership. */
export interface EncounterDefinitionReference { readonly definitionId: string; }
/** Membership grouping only, not a Combat relation or actor-kind policy. */
export interface EncounterSide { readonly sideId: string; }
/** Structural reference, not admission or authoritative World membership. */
export interface EncounterParticipant { readonly entityId: string; readonly sideId: string; }
export type EncounterStatus = 'prepared' | 'active' | 'resolved' | 'closed' | 'cancelled';
export interface EncounterInitialState {
  readonly encounterId: string;
  readonly sides: readonly EncounterSide[];
  readonly participants: readonly EncounterParticipant[];
}
/** Five-field structural snapshot; lifecycle provenance and outcomes are external. */
export interface EncounterState {
  readonly encounterId: string;
  readonly definitionId: string;
  readonly status: EncounterStatus;
  readonly sides: readonly EncounterSide[];
  readonly participants: readonly EncounterParticipant[];
}

function fields(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError('Encounter requires a plain own-data record');
  }
  const own = Reflect.ownKeys(input);
  if (own.length !== keys.length || own.some(key => typeof key !== 'string' || !keys.includes(key))) {
    throw new TypeError('Encounter missing or unknown fields');
  }
  return Object.fromEntries(keys.map(key => {
    const field = Object.getOwnPropertyDescriptor(input, key);
    if (!field || !('value' in field)) throw new TypeError('Encounter fields must be own data, not accessors');
    return [key, field.value as unknown];
  }));
}
function id(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) throw new TypeError('Encounter ID must be a nonblank string');
  return input;
}
function array(input: unknown): unknown[] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype
    || Reflect.ownKeys(input).length !== input.length + 1) {
    throw new TypeError('Encounter requires a dense proper array without extra fields');
  }
  return Array.from({length: input.length}, (_, index) => {
    const field = Object.getOwnPropertyDescriptor(input, String(index));
    if (!field || !('value' in field)) throw new TypeError('Encounter array entries must be own data');
    return field.value as unknown;
  });
}
export function createEncounterDefinitionReference(input: EncounterDefinitionReference): EncounterDefinitionReference {
  const value = fields(input, ['definitionId']);
  return Object.freeze({definitionId: id(value.definitionId)});
}
export function createEncounterSide(input: EncounterSide): EncounterSide {
  const value = fields(input, ['sideId']);
  return Object.freeze({sideId: id(value.sideId)});
}
export function createEncounterParticipant(input: EncounterParticipant): EncounterParticipant {
  const value = fields(input, ['entityId', 'sideId']);
  return Object.freeze({entityId: id(value.entityId), sideId: id(value.sideId)});
}
function capture(data: Record<string, unknown>, entities: EntityCollection): EncounterState {
  // Canonical validation is mandatory even for an empty Encounter roster.
  listEntities(entities);
  const encounterId = id(data.encounterId), definitionId = id(data.definitionId);
  const status = data.status;
  if (typeof status !== 'string' || !['prepared', 'active', 'resolved', 'closed', 'cancelled'].includes(status)) {
    throw new TypeError('Unknown Encounter status');
  }
  const sides = array(data.sides).map(value => createEncounterSide(value as EncounterSide));
  const participants = array(data.participants).map(value => createEncounterParticipant(value as EncounterParticipant));
  const sideIds = new Set<string>(), entityIds = new Set<string>();
  for (const side of sides) {
    if (sideIds.has(side.sideId)) throw new TypeError('Duplicate Encounter side ID');
    sideIds.add(side.sideId);
  }
  for (const participant of participants) {
    if (entityIds.has(participant.entityId)) throw new TypeError('Duplicate Encounter participant Entity ID');
    entityIds.add(participant.entityId);
    if (!sideIds.has(participant.sideId)) throw new TypeError('Unknown Encounter participant side');
    if (!getEntity(entities, participant.entityId)) throw new TypeError('Unknown canonical Encounter Entity');
  }
  return Object.freeze({encounterId, definitionId, status: status as EncounterStatus,
    sides: Object.freeze(sides), participants: Object.freeze(participants)});
}
/** Initial roster only. Empty is allowed; this does not prove activation readiness. */
export function createEncounterState(reference: EncounterDefinitionReference, initial: EncounterInitialState, entities: EntityCollection): EncounterState {
  const definition = createEncounterDefinitionReference(reference);
  const data = fields(initial, ['encounterId', 'sides', 'participants']);
  return capture({...data, definitionId: definition.definitionId, status: 'prepared'}, entities);
}
/** Structural recapture only: status is not transition provenance or an execution,
 * reward, spawn, join/leave or authoritative World commit authorization. */
export function validateEncounterState(state: EncounterState, entities: EntityCollection): EncounterState {
  return capture(fields(state, ['encounterId', 'definitionId', 'status', 'sides', 'participants']), entities);
}

/** L4 observations, not spawn certificates or authoritative current World state. */
export interface EncounterParticipantActivationFact {
  readonly entityId: string;
  readonly life: EntityLifeState;
  readonly worldReady: boolean;
}
export interface EncounterActivationObservation {
  readonly encounterId: string;
  readonly participants: readonly EncounterParticipantActivationFact[];
}
/** Explicit L3 rules; no implicit two-team or alive-only game policy. */
export interface EncounterActivationPolicy {
  readonly requiredOccupiedSideIds: readonly string[];
  readonly minimumParticipants: number;
  readonly minimumOccupiedSides: number;
  readonly allowedLifeStatuses: readonly EntityLifeStatus[];
  readonly requireWorldReady: boolean;
}
export type EncounterActivationRejectionReason = 'not_prepared' | 'insufficient_participants'
  | 'insufficient_occupied_sides' | 'required_side_unoccupied' | 'participant_fact_missing'
  | 'participant_life_not_allowed' | 'participant_world_not_ready';
export type EncounterActivationAdmissionResult =
  | {readonly status: 'admitted'; readonly reason: 'none'; readonly encounterId: string;
      readonly sideId: null; readonly entityId: null}
  | {readonly status: 'rejected'; readonly reason: EncounterActivationRejectionReason;
      readonly encounterId: string; readonly sideId: string | null; readonly entityId: string | null};
export type EncounterActivationTransitionResult =
  | {readonly status: 'activated'; readonly reason: 'none'; readonly encounterId: string; readonly state: EncounterState}
  | {readonly status: 'rejected'; readonly reason: EncounterActivationRejectionReason; readonly encounterId: string; readonly state: null};

function activationBoolean(input: unknown): boolean {
  if (typeof input !== 'boolean') throw new TypeError('Encounter activation requires a boolean');
  return input;
}
function activationCount(input: unknown): number {
  if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < 1) {
    throw new TypeError('Encounter activation count must be a positive safe integer');
  }
  return input;
}
function activationLifeStatus(input: unknown): EntityLifeStatus {
  if (input !== 'alive' && input !== 'dead') throw new TypeError('Encounter activation Life must be alive or dead');
  return input;
}
/** Detached closed policy; no preset, implicit default or rule registration. */
export function createEncounterActivationPolicy(input: EncounterActivationPolicy): EncounterActivationPolicy {
  const data = fields(input, ['requiredOccupiedSideIds', 'minimumParticipants', 'minimumOccupiedSides', 'allowedLifeStatuses', 'requireWorldReady']);
  const requiredOccupiedSideIds = array(data.requiredOccupiedSideIds).map(id);
  const allowedLifeStatuses = array(data.allowedLifeStatuses).map(activationLifeStatus);
  if (new Set(requiredOccupiedSideIds).size !== requiredOccupiedSideIds.length
    || !allowedLifeStatuses.length || new Set(allowedLifeStatuses).size !== allowedLifeStatuses.length) {
    throw new TypeError('Encounter activation lists must be unique; Life statuses nonempty');
  }
  return Object.freeze({requiredOccupiedSideIds: Object.freeze(requiredOccupiedSideIds),
    minimumParticipants: activationCount(data.minimumParticipants), minimumOccupiedSides: activationCount(data.minimumOccupiedSides),
    allowedLifeStatuses: Object.freeze(allowedLifeStatuses), requireWorldReady: activationBoolean(data.requireWorldReady)});
}
/** Canonical EntityLifeState schema capture only; no Life inference or mutation. */
export function createEncounterActivationObservation(input: EncounterActivationObservation): EncounterActivationObservation {
  const data = fields(input, ['encounterId', 'participants']), encounterId = id(data.encounterId);
  const seen = new Set<string>();
  const participants = array(data.participants).map(value => {
    const fact = fields(value, ['entityId', 'life', 'worldReady']), entityId = id(fact.entityId);
    const life = fields(fact.life, ['entityId', 'status']);
    if (id(life.entityId) !== entityId) throw new TypeError('Encounter activation Life identity mismatch');
    if (seen.has(entityId)) throw new TypeError('Duplicate Encounter activation fact');
    seen.add(entityId);
    return Object.freeze({entityId, life: Object.freeze({entityId, status: activationLifeStatus(life.status)}),
      worldReady: activationBoolean(fact.worldReady)});
  });
  return Object.freeze({encounterId, participants: Object.freeze(participants)});
}
function activationInputs(state: EncounterState, entities: EntityCollection,
  policy: EncounterActivationPolicy, observation: EncounterActivationObservation) {
  const current = validateEncounterState(state, entities);
  const rules = createEncounterActivationPolicy(policy), observed = createEncounterActivationObservation(observation);
  if (observed.encounterId !== current.encounterId) throw new TypeError('Encounter activation observation identity mismatch');
  const roster = new Set(current.participants.map(participant => participant.entityId));
  const facts = new Map(observed.participants.map(fact => {
    if (!roster.has(fact.entityId)) throw new TypeError('Foreign Encounter activation fact');
    return [fact.entityId, fact] as const;
  }));
  return {current, rules, facts};
}
function activationAdmission({current, rules, facts}: ReturnType<typeof activationInputs>): EncounterActivationAdmissionResult {
  const reject = (reason: EncounterActivationRejectionReason, sideId: string | null = null, entityId: string | null = null): EncounterActivationAdmissionResult =>
    Object.freeze({status: 'rejected', reason, encounterId: current.encounterId, sideId, entityId});
  if (current.status !== 'prepared') return reject('not_prepared');
  if (current.participants.length < rules.minimumParticipants) return reject('insufficient_participants');
  const occupied = new Set(current.participants.map(participant => participant.sideId));
  if (occupied.size < rules.minimumOccupiedSides) return reject('insufficient_occupied_sides');
  for (const sideId of rules.requiredOccupiedSideIds) {
    if (!occupied.has(sideId)) return reject('required_side_unoccupied', sideId);
  }
  // Separate roster-ordered stages: missing facts precede all Life failures,
  // which precede all World failures, regardless of observation entry order.
  for (const participant of current.participants) {
    if (!facts.has(participant.entityId)) return reject('participant_fact_missing', participant.sideId, participant.entityId);
  }
  for (const participant of current.participants) {
    if (!rules.allowedLifeStatuses.includes(facts.get(participant.entityId)!.life.status)) {
      return reject('participant_life_not_allowed', participant.sideId, participant.entityId);
    }
  }
  for (const participant of current.participants) {
    if (rules.requireWorldReady && !facts.get(participant.entityId)!.worldReady) {
      return reject('participant_world_not_ready', participant.sideId, participant.entityId);
    }
  }
  return Object.freeze({status: 'admitted', reason: 'none', encounterId: current.encounterId, sideId: null, entityId: null});
}
/** Read-only assessment. L4 owns truth/freshness and authoritative commit. */
export function evaluateEncounterActivationAdmission(state: EncounterState, entities: EntityCollection,
  policy: EncounterActivationPolicy, observation: EncounterActivationObservation): EncounterActivationAdmissionResult {
  return activationAdmission(activationInputs(state, entities, policy, observation));
}
/** Explicit prepared -> active candidate. Revalidates original inputs rather
 * than trusting an admission token; no dispatch, persistence or exactly-once claim. */
export function activateEncounter(state: EncounterState, entities: EntityCollection,
  policy: EncounterActivationPolicy, observation: EncounterActivationObservation): EncounterActivationTransitionResult {
  const input = activationInputs(state, entities, policy, observation), admission = activationAdmission(input);
  if (admission.status === 'rejected') {
    return Object.freeze({status: 'rejected', reason: admission.reason, encounterId: admission.encounterId, state: null});
  }
  return Object.freeze({status: 'activated', reason: 'none', encounterId: input.current.encounterId,
    state: Object.freeze({...input.current, status: 'active'})});
}

export type EncounterMembershipOperation = 'join' | 'leave' | 'change_side';
export type EncounterMembershipOpenStatus = 'prepared' | 'active';
/** Explicit L3 eligibility rules. Empty operation lists deny that operation. */
export interface EncounterMembershipPolicy {
  readonly joinAllowedStatuses: readonly EncounterMembershipOpenStatus[];
  readonly leaveAllowedStatuses: readonly EncounterMembershipOpenStatus[];
  readonly changeSideAllowedStatuses: readonly EncounterMembershipOpenStatus[];
  readonly allowedJoinLifeStatuses: readonly EntityLifeStatus[];
  readonly requireWorldReadyOnJoin: boolean;
}
export type EncounterMembershipRequest =
  | {readonly operation: 'join'; readonly encounterId: string; readonly entityId: string;
      readonly sideId: string; readonly readiness: EncounterParticipantActivationFact}
  | {readonly operation: 'leave'; readonly encounterId: string; readonly entityId: string}
  | {readonly operation: 'change_side'; readonly encounterId: string; readonly entityId: string; readonly sideId: string};
export type EncounterMembershipRejectionReason = 'encounter_not_open' | 'operation_not_allowed'
  | 'side_not_found' | 'entity_not_found' | 'already_participating' | 'participant_not_found'
  | 'already_on_side' | 'join_life_not_allowed' | 'join_world_not_ready';
export type EncounterMembershipAdmissionResult =
  | {readonly status: 'admitted'; readonly reason: 'none'; readonly operation: EncounterMembershipOperation;
      readonly encounterId: string; readonly entityId: string; readonly previousSideId: string | null; readonly sideId: string | null}
  | {readonly status: 'rejected'; readonly reason: EncounterMembershipRejectionReason; readonly operation: EncounterMembershipOperation;
      readonly encounterId: string; readonly entityId: string; readonly previousSideId: string | null; readonly sideId: string | null};
export type EncounterMembershipTransitionResult =
  | {readonly status: 'applied'; readonly reason: 'none'; readonly operation: EncounterMembershipOperation;
      readonly encounterId: string; readonly entityId: string; readonly previousSideId: string | null;
      readonly sideId: string | null; readonly state: EncounterState}
  | {readonly status: 'rejected'; readonly reason: EncounterMembershipRejectionReason; readonly operation: EncounterMembershipOperation;
      readonly encounterId: string; readonly entityId: string; readonly previousSideId: string | null;
      readonly sideId: string | null; readonly state: null};

function membershipStatuses(input: unknown): readonly EncounterMembershipOpenStatus[] {
  const statuses = array(input).map(value => {
    if (value !== 'prepared' && value !== 'active') throw new TypeError('Encounter membership status must be prepared or active');
    return value;
  });
  if (new Set(statuses).size !== statuses.length) throw new TypeError('Duplicate Encounter membership status');
  return Object.freeze(statuses);
}
export function createEncounterMembershipPolicy(input: EncounterMembershipPolicy): EncounterMembershipPolicy {
  const data = fields(input, ['joinAllowedStatuses', 'leaveAllowedStatuses', 'changeSideAllowedStatuses', 'allowedJoinLifeStatuses', 'requireWorldReadyOnJoin']);
  const allowedJoinLifeStatuses = array(data.allowedJoinLifeStatuses).map(activationLifeStatus);
  if (!allowedJoinLifeStatuses.length || new Set(allowedJoinLifeStatuses).size !== allowedJoinLifeStatuses.length) {
    throw new TypeError('Encounter membership Life statuses must be unique and nonempty');
  }
  return Object.freeze({joinAllowedStatuses: membershipStatuses(data.joinAllowedStatuses),
    leaveAllowedStatuses: membershipStatuses(data.leaveAllowedStatuses), changeSideAllowedStatuses: membershipStatuses(data.changeSideAllowedStatuses),
    allowedJoinLifeStatuses: Object.freeze(allowedJoinLifeStatuses), requireWorldReadyOnJoin: activationBoolean(data.requireWorldReadyOnJoin)});
}
export function createEncounterMembershipRequest(input: EncounterMembershipRequest): EncounterMembershipRequest {
  // Read the discriminant descriptor without invoking a getter, then capture the
  // entire exact variant before consulting any domain gate.
  const operation = typeof input === 'object' && input !== null
    ? Object.getOwnPropertyDescriptor(input, 'operation') : undefined;
  if (!operation || !('value' in operation) || !['join', 'leave', 'change_side'].includes(operation.value)) {
    throw new TypeError('Unknown Encounter membership operation');
  }
  const kind = operation.value as EncounterMembershipOperation;
  const data = fields(input, kind === 'join' ? ['operation', 'encounterId', 'entityId', 'sideId', 'readiness']
    : kind === 'leave' ? ['operation', 'encounterId', 'entityId'] : ['operation', 'encounterId', 'entityId', 'sideId']);
  const encounterId = id(data.encounterId), entityId = id(data.entityId);
  if (kind === 'leave') return Object.freeze({operation: kind, encounterId, entityId});
  const sideId = id(data.sideId);
  if (kind === 'change_side') return Object.freeze({operation: kind, encounterId, entityId, sideId});
  const readiness = createEncounterActivationObservation({encounterId, participants: [data.readiness as EncounterParticipantActivationFact]}).participants[0]!;
  if (readiness.entityId !== entityId) throw new TypeError('Encounter membership readiness identity mismatch');
  return Object.freeze({operation: kind, encounterId, entityId, sideId, readiness});
}
/** Structural side inspection only; no implicit membership or World lookup. */
export function getEncounterParticipant(state: EncounterState, entities: EntityCollection, entityId: string): EncounterParticipant | null {
  const current = validateEncounterState(state, entities), requestedId = id(entityId);
  return current.participants.find(participant => participant.entityId === requestedId) ?? null;
}
function membershipInputs(state: EncounterState, entities: EntityCollection,
  policy: EncounterMembershipPolicy, request: EncounterMembershipRequest) {
  const current = validateEncounterState(state, entities);
  const rules = createEncounterMembershipPolicy(policy), change = createEncounterMembershipRequest(request);
  if (change.encounterId !== current.encounterId) throw new TypeError('Encounter membership request identity mismatch');
  const member = current.participants.find(participant => participant.entityId === change.entityId);
  return {current, rules, change, member, entities};
}
function membershipAdmission({current, rules, change, member, entities}: ReturnType<typeof membershipInputs>): EncounterMembershipAdmissionResult {
  const diagnostics = {operation: change.operation, encounterId: change.encounterId, entityId: change.entityId,
    previousSideId: member?.sideId ?? null, sideId: change.operation === 'leave' ? null : change.sideId};
  const reject = (reason: EncounterMembershipRejectionReason): EncounterMembershipAdmissionResult => Object.freeze({status: 'rejected', reason, ...diagnostics});
  if (current.status !== 'prepared' && current.status !== 'active') return reject('encounter_not_open');
  const statuses = change.operation === 'join' ? rules.joinAllowedStatuses
    : change.operation === 'leave' ? rules.leaveAllowedStatuses : rules.changeSideAllowedStatuses;
  if (!statuses.includes(current.status)) return reject('operation_not_allowed');
  if (change.operation === 'join') {
    if (!current.sides.some(side => side.sideId === change.sideId)) return reject('side_not_found');
    if (member) return reject('already_participating');
    if (!getEntity(entities, change.entityId)) return reject('entity_not_found');
    if (!rules.allowedJoinLifeStatuses.includes(change.readiness.life.status)) return reject('join_life_not_allowed');
    if (rules.requireWorldReadyOnJoin && !change.readiness.worldReady) return reject('join_world_not_ready');
  } else {
    if (!member) return reject('participant_not_found');
    if (change.operation === 'change_side') {
      if (!current.sides.some(side => side.sideId === change.sideId)) return reject('side_not_found');
      if (member.sideId === change.sideId) return reject('already_on_side');
    }
  }
  return Object.freeze({status: 'admitted', reason: 'none', ...diagnostics});
}
/** Read-only assessment; caller observations are not authoritative permission. */
export function evaluateEncounterMembershipAdmission(state: EncounterState, entities: EntityCollection,
  policy: EncounterMembershipPolicy, request: EncounterMembershipRequest): EncounterMembershipAdmissionResult {
  return membershipAdmission(membershipInputs(state, entities, policy, request));
}
/** Recompute from current inputs. L4 owns CAS, freshness and authoritative commit. */
export function applyEncounterMembershipChange(state: EncounterState, entities: EntityCollection,
  policy: EncounterMembershipPolicy, request: EncounterMembershipRequest): EncounterMembershipTransitionResult {
  const input = membershipInputs(state, entities, policy, request), admission = membershipAdmission(input);
  if (admission.status === 'rejected') return Object.freeze({...admission, state: null});
  const {current, change} = input;
  const participants = change.operation === 'join' ? [...current.participants, createEncounterParticipant({entityId: change.entityId, sideId: change.sideId})]
    : change.operation === 'leave' ? current.participants.filter(participant => participant.entityId !== change.entityId)
    : current.participants.map(participant => participant.entityId === change.entityId
      ? createEncounterParticipant({entityId: change.entityId, sideId: change.sideId}) : participant);
  return Object.freeze({...admission, status: 'applied', state: Object.freeze({...current, participants: Object.freeze(participants)})});
}

export type EncounterActionTargetMode = 'none' | 'participant';
/** Membership association only; never Combat's tactical relation. */
export type EncounterSideMembershipRelation = 'self' | 'same_side' | 'other_side';
export interface EncounterActionScopePolicy {
  readonly targetMode: EncounterActionTargetMode;
  readonly allowedSideRelations: readonly EncounterSideMembershipRelation[];
}
export interface EncounterActionScopeRequest {
  readonly encounterId: string;
  readonly actionId: string;
  readonly sourceEntityId: string;
  readonly targetEntityId: string | null;
}
export type EncounterActionScopeRejectionReason = 'encounter_not_active' | 'source_not_participant'
  | 'target_required' | 'unexpected_target' | 'target_not_participant' | 'side_relation_not_allowed';
export type EncounterActionScopeResult =
  | {readonly status: 'eligible'; readonly reason: 'none'; readonly encounterId: string; readonly actionId: string;
      readonly sourceEntityId: string; readonly targetEntityId: string | null; readonly sourceSideId: string;
      readonly targetSideId: string | null; readonly sideRelation: EncounterSideMembershipRelation | null}
  | {readonly status: 'rejected'; readonly reason: EncounterActionScopeRejectionReason; readonly encounterId: string; readonly actionId: string;
      readonly sourceEntityId: string; readonly targetEntityId: string | null; readonly sourceSideId: string | null;
      readonly targetSideId: string | null; readonly sideRelation: EncounterSideMembershipRelation | null};

export function createEncounterActionScopePolicy(input: EncounterActionScopePolicy): EncounterActionScopePolicy {
  const data = fields(input, ['targetMode', 'allowedSideRelations']);
  if (data.targetMode !== 'none' && data.targetMode !== 'participant') throw new TypeError('Unknown Encounter target mode');
  const allowedSideRelations = array(data.allowedSideRelations).map(value => {
    if (value !== 'self' && value !== 'same_side' && value !== 'other_side') throw new TypeError('Unknown Encounter side membership relation');
    return value;
  });
  if (new Set(allowedSideRelations).size !== allowedSideRelations.length
    || (data.targetMode === 'none' ? allowedSideRelations.length !== 0 : allowedSideRelations.length === 0)) {
    throw new TypeError('Encounter scope relations must be unique and compatible with target mode');
  }
  return Object.freeze({targetMode: data.targetMode, allowedSideRelations: Object.freeze(allowedSideRelations)});
}
export function createEncounterActionScopeRequest(input: EncounterActionScopeRequest): EncounterActionScopeRequest {
  const data = fields(input, ['encounterId', 'actionId', 'sourceEntityId', 'targetEntityId']);
  return Object.freeze({encounterId: id(data.encounterId), actionId: id(data.actionId), sourceEntityId: id(data.sourceEntityId),
    targetEntityId: data.targetEntityId === null ? null : id(data.targetEntityId)});
}
/** Advisory current-snapshot assessment only. L4 owns fresh canonical admission,
 * dispatch, correlation, duplicate prevention and authoritative atomic commit. */
export function evaluateEncounterActionScope(state: EncounterState, entities: EntityCollection,
  policy: EncounterActionScopePolicy, request: EncounterActionScopeRequest): EncounterActionScopeResult {
  const current = validateEncounterState(state, entities);
  const rules = createEncounterActionScopePolicy(policy), action = createEncounterActionScopeRequest(request);
  if (action.encounterId !== current.encounterId) throw new TypeError('Encounter scope request identity mismatch');
  let sourceSideId: string | null = null, targetSideId: string | null = null;
  let sideRelation: EncounterSideMembershipRelation | null = null;
  const reject = (reason: EncounterActionScopeRejectionReason): EncounterActionScopeResult =>
    Object.freeze({status: 'rejected', reason, ...action, sourceSideId, targetSideId, sideRelation});
  if (current.status !== 'active') return reject('encounter_not_active');
  const source = getEncounterParticipant(current, entities, action.sourceEntityId);
  if (!source) return reject('source_not_participant');
  sourceSideId = source.sideId;
  if (rules.targetMode === 'participant' && action.targetEntityId === null) return reject('target_required');
  if (rules.targetMode === 'none' && action.targetEntityId !== null) return reject('unexpected_target');
  if (action.targetEntityId !== null) {
    const target = getEncounterParticipant(current, entities, action.targetEntityId);
    if (!target) return reject('target_not_participant');
    targetSideId = target.sideId;
    sideRelation = action.sourceEntityId === action.targetEntityId ? 'self'
      : sourceSideId === targetSideId ? 'same_side' : 'other_side';
    if (!rules.allowedSideRelations.includes(sideRelation)) return reject('side_relation_not_allowed');
  }
  return Object.freeze({status: 'eligible', reason: 'none', ...action, sourceSideId, targetSideId, sideRelation});
}
