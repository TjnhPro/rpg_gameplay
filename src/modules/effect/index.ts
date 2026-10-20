import {createEntity, type EntitySnapshot} from '../entity/index.js';

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
