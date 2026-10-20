import {createEntity, getEntity, type EntitySnapshot, type EntityCollection} from '../entity/index.js';

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
