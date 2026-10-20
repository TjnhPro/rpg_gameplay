import {createEffectPeriodicState, applyEffectPeriodicTransition, getNextDueEffectTick, completeEffectPeriodicTick,
  type EffectPeriodicCapture, type EffectPeriodicEntry, type EffectPeriodicState, type EffectPeriodicTickIntent,
  type EffectPeriodicTickAssessment, type EffectPeriodicTickEvent, type EffectPeriodicCompletionResult,
  type EffectPeriodicTransitionResult, type EffectLifecycleState, type EffectLifecycleStartResult,
  type EffectLifecycleTransitionResult, type EffectStackMutationResult, type EntityLifeState,
  type GameplayExecutionContext} from '@rpg/gameplay';
declare const lifecycle: EffectLifecycleState, life: EntityLifeState, context: GameplayExecutionContext,
  transition: EffectLifecycleStartResult | EffectLifecycleTransitionResult | EffectStackMutationResult;
const capture: EffectPeriodicCapture = {mode: 'periodic', kind: 'dot', intervalMs: 0.25, resourceId: 'custom'};
const none: EffectPeriodicCapture = {mode: 'none'};
const state: EffectPeriodicState = createEffectPeriodicState(lifecycle);
const entry: EffectPeriodicEntry = {effectInstanceId: 'A', ...capture, nextTickAtMs: 1001};
const sync: (state: EffectPeriodicState, previous: EffectLifecycleState,
  transition: EffectLifecycleStartResult | EffectLifecycleTransitionResult | EffectStackMutationResult,
  capture?: EffectPeriodicCapture) => EffectPeriodicTransitionResult = applyEffectPeriodicTransition;
const next = sync(state, lifecycle, transition, none);
if (next.status === 'rejected') {const empty: null = next.state; void empty;}
const assessment: EffectPeriodicTickAssessment = getNextDueEffectTick(lifecycle, state, life, context);
if (assessment.status === 'due') {
  const intent: EffectPeriodicTickIntent = assessment.intent;
  const result: EffectPeriodicCompletionResult = completeEffectPeriodicTick(lifecycle, state, intent, life, context);
  if (result.status === 'applied') {
    const event: EffectPeriodicTickEvent = result.events[0]!;
    const type: 'tick-completed' = event.type;
    // @ts-expect-error Immutable cursor.
    result.state.entries.push(entry);
    // @ts-expect-error No numerical result invented by Effect.
    event.applied;
    void type;
  } else {const empty: null = result.state; const reason: 'stale_tick' | 'target_dead' | 'time_regressed' = result.reason; void empty; void reason;}
  // @ts-expect-error Immutable intent.
  intent.dueAtMs = 0;
} else {const empty: null = assessment.intent; void empty;}
// @ts-expect-error No implicit periodic configuration.
const missing: EffectPeriodicCapture = {mode: 'periodic', kind: 'dot'};
// @ts-expect-error None has no periodic fields.
const extra: EffectPeriodicCapture = {mode: 'none', intervalMs: 1000};
// @ts-expect-error No unsupported kind.
const invalid: EffectPeriodicCapture = {mode: 'periodic', kind: 'heal', intervalMs: 1000, resourceId: 'x'};
// @ts-expect-error Companion contains no duplicate lifecycle.
const duplicate: EffectPeriodicState = {entityId: 'x', observedAtMs: 0, entries: [], lifecycle};
// @ts-expect-error Resource execution belongs to L4.
completeEffectPeriodicTick(lifecycle, state, assessment.intent, life, context, {amount: 10});
// @ts-expect-error No private planner exports.
import {periodicDue} from '@rpg/gameplay';
// @ts-expect-error Deep import closed.
import {} from '@rpg/gameplay/dist/modules/effect/index.js';
void missing; void extra; void invalid; void duplicate; void periodicDue;
