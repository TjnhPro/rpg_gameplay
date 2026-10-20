import {createEffectLifecycleState, startEffectLifetime, advanceEffectLifecycle, removeEffectLifetime,
  createEntity, createEffectState, createExecutionContext, applyEffect, createEntityCollection, addEntity,
  type EffectDuration, type EffectLifetimeState, type EffectLifecycleState, type EffectRemovalReason,
  type EffectLifecycleEvent, type EffectLifecycleStartResult, type EffectLifecycleTransitionResult,
  type EffectState, type EffectApplyResult, type GameplayExecutionContext} from '@rpg/gameplay';

const target = createEntity({id: 'target', kind: 'monster'});
const context = createExecutionContext({clock: {now: () => 1000}});
const initial: EffectState = createEffectState(target);
const lifecycle: EffectLifecycleState = createEffectLifecycleState(initial, context);
const duration: EffectDuration = {mode: 'timed', durationMs: 0.25};
const persistent: EffectDuration = {mode: 'persistent'};
const application: EffectApplyResult = applyEffect({effectId: 'poison'}, {instance: {
  effectInstanceId: 'A', effectId: 'poison', targetEntityId: 'target',
  source: {kind: 'system', sourceId: 'zone', sourceKey: 'zone-1'}}}, initial,
  addEntity(createEntityCollection(), target), {entityId: 'target', status: 'alive'},
  {sourceEligible: true, targetEligible: true, allowedTargetLifeStatuses: ['alive']});
const start: EffectLifecycleStartResult = startEffectLifetime(lifecycle, application, duration, context);
const advance: EffectLifecycleTransitionResult = advanceEffectLifecycle(lifecycle, context);
const reason: EffectRemovalReason = 'dispel';
const remove: EffectLifecycleTransitionResult = removeEffectLifetime(lifecycle, 'A', reason);
const signatures: [
  (state: EffectState, context: GameplayExecutionContext) => EffectLifecycleState,
  (state: EffectLifecycleState, application: EffectApplyResult, duration: EffectDuration, context: GameplayExecutionContext) => EffectLifecycleStartResult,
  (state: EffectLifecycleState, context: GameplayExecutionContext) => EffectLifecycleTransitionResult,
  (state: EffectLifecycleState, id: string, reason: EffectRemovalReason) => EffectLifecycleTransitionResult,
] = [createEffectLifecycleState, startEffectLifetime, advanceEffectLifecycle, removeEffectLifetime];
if (start.status === 'started') {
  const state: EffectLifecycleState = start.state; const none: 'none' = start.reason;
  // @ts-expect-error Successful start has a complete state.
  const empty: null = start.state;
  void [state, none, empty];
} else {
  const empty: null = start.state; const events: readonly [] = start.events;
  const rejected: 'application_rejected' | 'stale_application' | 'lifecycle_not_advanced' | 'time_regressed' = start.reason;
  // @ts-expect-error Rejected start has no candidate.
  const state: EffectLifecycleState = start.state;
  void [empty, events, rejected, state];
}
for (const transition of [advance, remove]) {
  if (transition.status === 'applied') {
    const state: EffectLifecycleState = transition.state; const none: 'none' = transition.reason; void [state, none];
  } else {
    const state: null = transition.state; const events: readonly [] = transition.events;
    const rejected: 'effect_not_found' | 'time_regressed' = transition.reason; void [state, events, rejected];
  }
}
function inspect(event: EffectLifecycleEvent, lifetime: EffectLifetimeState, duration: EffectDuration) {
  if (event.type === 'removed') {const reason: EffectRemovalReason = event.reason; void reason;}
  else {
    // @ts-expect-error Only removed events have removal reasons.
    void event.reason;
  }
  if (duration.mode === 'timed') {const ms: number = duration.durationMs; void ms;}
  else {
    // @ts-expect-error Persistent duration has no durationMs.
    void duration.durationMs;
  }
  // @ts-expect-error Frozen lifetime metadata.
  lifetime.expiresAtMs = 0;
  // @ts-expect-error Frozen events.
  event.atMs = 0;
}
// @ts-expect-error No default or implicit instant duration.
const instant: EffectDuration = {mode: 'instant'};
// @ts-expect-error Persistent fields are closed.
const invalid: EffectDuration = {mode: 'persistent', durationMs: 5000};
// @ts-expect-error Duration required for timed mode.
const missing: EffectDuration = {mode: 'timed'};
// @ts-expect-error Canonical lifecycle state is readonly.
lifecycle.observedAtMs = 0;
// @ts-expect-error Nested lifetime array is readonly.
lifecycle.lifetimes.push({effectInstanceId: 'B', mode: 'persistent', startedAtMs: 1000, expiresAtMs: null});
// @ts-expect-error Canonical instances remain readonly.
lifecycle.effectState.instances[0]!.source.sourceKey = 'changed';
// @ts-expect-error Removal needs an explicit approved reason.
removeEffectLifetime(lifecycle, 'A', 'expired');
// @ts-expect-error No forged execution context.
advanceEffectLifecycle(lifecycle, {});
// @ts-expect-error Private validators are not root exports.
import {lifecycleSnapshot} from '@rpg/gameplay';
// @ts-expect-error Deep package paths stay closed.
import type {EffectLifecycleState as DeepState} from '@rpg/gameplay/modules/effect';
type IsAny<T> = 0 extends (1 & T) ? true : false;
const notAny: [IsAny<EffectLifecycleState>, IsAny<EffectLifecycleStartResult>, IsAny<EffectLifecycleTransitionResult>] = [false, false, false];
void [persistent, signatures, inspect, instant, invalid, missing, notAny, lifecycleSnapshot];
