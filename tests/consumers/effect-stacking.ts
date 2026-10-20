import {
  inspectEffectStackGroups, evaluateEffectStackAdmission, applyEffectStack, refreshEffectStackLifetime,
  consumeEffectStacks, removeEffectStackGroup,
  type EffectStackGroupKey, type EffectStackGroupView, type EffectStackPolicy,
  type EffectStackAdmissionResult, type EffectStackRejectionReason, type EffectStackConsumeRequest,
  type EffectStackConsumedEvent, type EffectStackEvent, type EffectStackMutationResult,
  type EffectLifecycleState, type EffectApplyResult, type EffectDuration, type GameplayExecutionContext,
  type EffectRemovalReason,
} from '@rpg/gameplay';
import * as g from '@rpg/gameplay';
declare const state: EffectLifecycleState, application: EffectApplyResult, context: GameplayExecutionContext;
const group: EffectStackGroupKey = {targetEntityId: 'target', effectId: 'poison', sourceKey: 'source'};
const policy: EffectStackPolicy = {mode: 'refresh', maxStacks: 1};
const duration: EffectDuration = {mode: 'timed', durationMs: 1000};
const request: EffectStackConsumeRequest = {group, count: 2};
const inspect: (s: EffectLifecycleState) => readonly EffectStackGroupView[] = inspectEffectStackGroups;
const assess: (s: EffectLifecycleState, a: EffectApplyResult, d: EffectDuration, p: EffectStackPolicy,
  c: GameplayExecutionContext) => EffectStackAdmissionResult = evaluateEffectStackAdmission;
const apply: (s: EffectLifecycleState, a: EffectApplyResult, d: EffectDuration, p: EffectStackPolicy,
  c: GameplayExecutionContext) => EffectStackMutationResult = applyEffectStack;
const renew: (s: EffectLifecycleState, id: string, d: EffectDuration, c: GameplayExecutionContext) => EffectStackMutationResult = refreshEffectStackLifetime;
const consume: (s: EffectLifecycleState, r: EffectStackConsumeRequest) => EffectStackMutationResult = consumeEffectStacks;
const remove: (s: EffectLifecycleState, k: EffectStackGroupKey, r: EffectRemovalReason) => EffectStackMutationResult = removeEffectStackGroup;
const admission = assess(state, application, duration, policy, context);
if (admission.status === 'admitted') {
  const reason: 'none' = admission.reason, operation: 'add' | 'refresh' = admission.operation;
  void reason; void operation;
} else {
  const operation: null = admission.operation, reason: EffectStackRejectionReason = admission.reason;
  void operation; void reason;
}
const result = apply(state, application, duration, policy, context);
if (result.status === 'rejected') {
  const nothing: null = result.state, empty: readonly [] = result.events;
  void nothing; void empty;
} else {
  const action: 'added' | 'refreshed' | 'consumed' | 'group_removed' = result.action;
  // @ts-expect-error Immutable nested candidate.
  result.state.effectState.instances.push({});
  void action;
}
declare const event: EffectStackEvent;
if (event.type === 'stack-consumed') {
  const consumed: EffectStackConsumedEvent = event;
  // @ts-expect-error Selected IDs are immutable.
  consumed.consumedInstanceIds.push('bad');
} else if (event.type === 'refreshed') {
  const expiry: number = event.expiresAtMs; void expiry;
} else if (event.type === 'removed') {
  const reason: EffectRemovalReason = event.reason; void reason;
}
const groups = inspect(state);
// @ts-expect-error Group array readonly.
groups.push(groups[0]!);
// @ts-expect-error Key readonly.
group.sourceKey = 'changed';
// @ts-expect-error Derived membership readonly.
groups[0]!.instanceIds[0] = 'changed';
// @ts-expect-error Source snapshot readonly.
groups[0]!.source.sourceId = 'changed';
// @ts-expect-error Refresh policy cannot have capacity 2.
const invalid: EffectStackPolicy = {mode: 'refresh', maxStacks: 2};
// @ts-expect-error No implicit policy defaults.
const missing: EffectStackPolicy = {mode: 'stack'};
// @ts-expect-error No advanced overflow modes.
const replace: EffectStackPolicy = {mode: 'replace', maxStacks: 1};
// @ts-expect-error Old removal reasons not widened for consumption.
const reason: EffectRemovalReason = 'consumed';
// @ts-expect-error No stack manager.
g.createStackManager();
// @ts-expect-error Private validation stays private.
g.resolveStackAdmission();
// @ts-expect-error Deep exports closed.
import type {EffectStackPolicy as Deep} from '@rpg/gameplay/modules/effect';
type IsAny<T> = 0 extends (1 & T) ? true : false;
const notAny: IsAny<ReturnType<typeof applyEffectStack>> = false;
void renew; void consume; void remove; void request; void invalid; void missing; void replace; void reason; void notAny;
