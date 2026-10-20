import {createEffectModifierState, applyEffectModifierTransition, listActiveEffectModifiers,
  type EffectClassification, type EffectModifierSpec, type EffectModifierCapture, type EffectModifierSnapshot,
  type EffectModifierState, type EffectModifierTransitionResult, type EffectLifecycleState,
  type EffectLifecycleStartResult, type EffectLifecycleTransitionResult, type EffectStackMutationResult,
} from '@rpg/gameplay';
import type {ModifierOperation, NumericalModifier} from '@rpg/core/kernel';

const operation: ModifierOperation = 'add_percentage_points';
const classification: EffectClassification = 'neutral';
const spec: EffectModifierSpec = {modifierId: 'bonus', target: 'attack', operation, value: -0.5, enabled: false};
const capture: EffectModifierCapture = {classification, modifiers: [spec]};
const snapshot: EffectModifierSnapshot = {effectInstanceId: 'A', ...capture};
declare const lifecycle: EffectLifecycleState, start: EffectLifecycleStartResult,
  advancement: EffectLifecycleTransitionResult, stack: EffectStackMutationResult;
const state: EffectModifierState = createEffectModifierState(lifecycle);
const synchronize: (s: EffectModifierState, t: EffectLifecycleStartResult | EffectLifecycleTransitionResult | EffectStackMutationResult,
  c?: EffectModifierCapture) => EffectModifierTransitionResult = applyEffectModifierTransition;
const result = synchronize(state, start, capture);
synchronize(state, advancement); synchronize(state, stack);
if (result.status === 'applied') {
  const reason: 'none' = result.reason;
  const modifiers: readonly NumericalModifier[] = listActiveEffectModifiers(result.state);
  const coreOperation: ModifierOperation = modifiers[0]!.operation;
  // @ts-expect-error Canonical identity readonly.
  modifiers[0]!.identity.sourceInstanceId = 'other';
  // @ts-expect-error Canonical array readonly.
  modifiers.push(modifiers[0]!);
  // @ts-expect-error Nested modifier snapshot readonly.
  result.state.snapshots[0]!.modifiers[0]!.value = 9;
  void reason; void coreOperation;
} else {
  const empty: null = result.state;
  const reason: 'transition_rejected' | 'stale_transition' | 'capture_required' = result.reason;
  void empty; void reason;
}
// @ts-expect-error Core operation union reused, no invented operation.
const wrong: EffectModifierSpec = {...spec, operation: 'multiply'};
// @ts-expect-error Classification is explicit metadata.
const inferred: EffectClassification = 'positive';
// @ts-expect-error Explicit enabled required.
const missing: EffectModifierSpec = {modifierId: 'x', target: 'attack', operation, value: 1};
// @ts-expect-error No standalone second instance collection.
const alternative: EffectModifierState = {instances: [], snapshots: []};
// @ts-expect-error Snapshot association required.
const unbound: EffectModifierSnapshot = capture;
// @ts-expect-error Classification readonly.
snapshot.classification = 'buff';
// @ts-expect-error Nested lifecycle readonly.
state.lifecycle.effectState.instances.push({});
void wrong; void inferred; void missing; void alternative; void unbound;
