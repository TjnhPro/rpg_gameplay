import {createEntity, createEffectDefinition, createEffectInstance, createEffectState, validateEffectState,
  type EffectDefinition, type EffectSourceReference, type EffectInstanceInitialState,
  type EffectInstanceState, type EffectState} from '@rpg/gameplay';

const definition: EffectDefinition = createEffectDefinition({effectId: 'poison'});
const source: EffectSourceReference = {kind: 'entity', sourceId: 'player-1', sourceKey: 'equipment/sword-1'};
const system: EffectSourceReference = {kind: 'system', sourceId: 'swamp', sourceKey: 'zone/area-1'};
const initial: EffectInstanceInitialState = {effectInstanceId: 'effect-1', source};
const target = createEntity({id: 'monster-1', kind: 'monster'});
const instance: EffectInstanceState = createEffectInstance(definition, target, initial);
const second = createEffectInstance(definition, target, {...initial, source: system, effectInstanceId: 'effect-2'});
const empty: EffectState = createEffectState(target);
const state: EffectState = validateEffectState({entityId: target.id, instances: [instance, second]});
function sourceVariant(reference: EffectSourceReference): string {
  if (reference.kind === 'entity') {const kind: 'entity' = reference.kind; return kind + reference.sourceId;}
  const kind: 'system' = reference.kind; return kind + reference.sourceKey;
}
const signatures: [
  (d: EffectDefinition) => EffectDefinition,
  (d: EffectDefinition, e: typeof target, i: EffectInstanceInitialState) => EffectInstanceState,
  (e: typeof target) => EffectState,
  (s: EffectState) => EffectState,
] = [createEffectDefinition, createEffectInstance, createEffectState, validateEffectState];
// @ts-expect-error Identity-only definition.
createEffectDefinition({effectId: 'poison', durationMs: 100});
// @ts-expect-error Source discriminant has only Entity/System variants.
const invalidSource: EffectSourceReference = {kind: 'equipment', sourceId: 'player-1', sourceKey: 'sword'};
// @ts-expect-error Explicit stable sourceKey required.
const missingKey: EffectSourceReference = {kind: 'system', sourceId: 'zone'};
// @ts-expect-error Initial instance has no default identity.
createEffectInstance(definition, target, {source});
// @ts-expect-error Entity factory contract is required.
createEffectInstance(definition, {id: 'monster-1'}, initial);
// @ts-expect-error Structural instances require target identity.
validateEffectState({entityId: target.id, instances: [{effectInstanceId: 'i', effectId: 'poison', source}]});
// @ts-expect-error Definition readonly.
definition.effectId = 'changed';
// @ts-expect-error Initial contract readonly.
initial.effectInstanceId = 'changed';
// @ts-expect-error Instance readonly.
instance.targetEntityId = 'changed';
// @ts-expect-error Nested source readonly.
instance.source.sourceKey = 'changed';
// @ts-expect-error State readonly.
state.entityId = 'changed';
// @ts-expect-error Instance array readonly.
state.instances.push(instance);
// @ts-expect-error Instance array entries readonly.
state.instances[0] = second;
// @ts-expect-error No active/application promise.
const active: boolean = instance.active;
// @ts-expect-error Private helpers are not root exports.
import {sourceSnapshot} from '@rpg/gameplay';
// @ts-expect-error Package has no Effect deep exports.
import {} from '@rpg/gameplay/modules/effect';
type IsAny<T> = 0 extends (1 & T) ? true : false;
const noAny: [IsAny<EffectDefinition>, IsAny<EffectSourceReference>, IsAny<EffectInstanceInitialState>,
  IsAny<EffectInstanceState>, IsAny<EffectState>] = [false, false, false, false, false];
void [empty, state, signatures, noAny, sourceVariant, invalidSource, missingKey, active];
