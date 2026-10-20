import * as g from '@rpg/gameplay';

// External L4 composition against installed declarations; no new facade/API.
interface Current {
  readonly lifecycle: g.EffectLifecycleState;
  readonly modifiers: g.EffectModifierState;
  readonly statuses: g.EffectStatusState;
  readonly periodic: g.EffectPeriodicState;
  readonly resources: g.EntityResourceState;
  readonly life: g.EntityLifeState;
}
declare const current: Current, context: g.GameplayExecutionContext, entities: g.EntityCollection,
  target: g.EntitySnapshot, source: g.EffectSourceReference;
const definition: g.EffectDefinition = g.createEffectDefinition({effectId: 'poison'});
const instance: g.EffectInstanceState = g.createEffectInstance(definition, target, {effectInstanceId: 'A', source});
const application: g.EffectApplyResult = g.applyEffect(definition, {instance}, current.lifecycle.effectState,
  entities, current.life, {sourceEligible: true, targetEligible: true, allowedTargetLifeStatuses: ['alive']});
const transition: g.EffectStackMutationResult = g.applyEffectStack(current.lifecycle, application,
  {mode: 'timed', durationMs: 5000}, {mode: 'stack', maxStacks: 3}, context);
const modifiers = g.applyEffectModifierTransition(current.modifiers, transition, {classification: 'debuff', modifiers: []});
const statuses = g.applyEffectStatusTransition(current.statuses, current.lifecycle, transition, {statusIds: [], restrictionIds: []});
const periodic = g.applyEffectPeriodicTransition(current.periodic, current.lifecycle, transition,
  {mode: 'periodic', kind: 'dot', intervalMs: 1000, resourceId: 'health'});
if (transition.status === 'applied' && modifiers.status === 'applied' && statuses.status === 'applied' && periodic.status === 'applied') {
  const next: Current = {...current, lifecycle: transition.state, modifiers: modifiers.state, statuses: statuses.state, periodic: periodic.state};
  const gate: g.EffectRestrictionAssessment = g.evaluateEffectRestrictionGate(next.lifecycle, next.statuses, {blockedByRestrictionIds: ['stun']});
  const intent = g.getNextDueEffectTick(next.lifecycle, next.periodic, next.life, context);
  if (intent.status === 'due') {
    const resource = g.transitionEntityResource(next.resources, intent.intent.resourceId, {maximum: 100, amount: 10,
      operation: intent.intent.kind === 'dot' ? 'decrease' : 'increase',
      rule: {minimum: 0, currentAboveMaximum: 'allow', allowIncreaseFromMinimum: false}});
    const life = g.resolveEntityDefeat(next.life, resource.state, {resourceId: 'health', minimum: 0, maximum: 100});
    const completion = g.completeEffectPeriodicTick(next.lifecycle, next.periodic, intent.intent, next.life, context);
    if (completion.status === 'applied') {
      const committed: Current = {...next, resources: resource.state, life: life.state, periodic: completion.state};
      // @ts-expect-error Public nested state is immutable.
      committed.periodic.entries[0]!.effectInstanceId = 'changed';
      // @ts-expect-error Resource map is immutable.
      committed.resources.current.health = 0;
      void committed;
    }
  }
  const records: readonly g.EffectRestrictionView[] = gate.matches;
  void records;
}
// @ts-expect-error No Effect runtime facade or new orchestration namespace.
g.EffectEngine;
const cleanupRequest: g.EffectTargetDefeatCleanupRequest = {defeatedAtMs: 2000};
const cleanup: g.EffectTargetDefeatCleanupResult = g.cleanupDefeatedTargetEffects(
  current.lifecycle, current.periodic, current.life, cleanupRequest, context);
g.applyEffectModifierTransition(current.modifiers, cleanup);
g.applyEffectStatusTransition(current.statuses, current.lifecycle, cleanup);
g.applyEffectPeriodicTransition(current.periodic, current.lifecycle, cleanup);
if (cleanup.status === 'applied') {
  const action: 'target_defeated' = cleanup.action;
  // @ts-expect-error Cleanup snapshots are readonly.
  cleanup.state.observedAtMs = 1;
  // @ts-expect-error Dedicated cleanup does not widen the historical stack union.
  const historical: g.EffectStackMutationResult = cleanup;
  void action; void historical;
} else {
  const empty: null = cleanup.state;
  void empty;
}
// @ts-expect-error Explicit simulation death timestamp is required.
g.cleanupDefeatedTargetEffects(current.lifecycle, current.periodic, current.life, {}, context);
// @ts-expect-error No private/deep package entry.
import {} from '@rpg/gameplay/dist/modules/effect/index.js';
