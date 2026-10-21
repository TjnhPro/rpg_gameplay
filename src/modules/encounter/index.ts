import {getEntity, listEntities, type EntityCollection} from '../entity/index.js';

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
