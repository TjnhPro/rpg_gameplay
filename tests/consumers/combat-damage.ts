import {applyCombatAttackDamage, type CombatAttackResolutionResult,
  type CombatDamageApplicationPolicy, type CombatDamageApplicationOutcome, type CombatDamageApplicationResult,
  type EntityResourceState, type EntityLifeState, type EntityResourceTransitionResult,
  type EntityLifeTransitionResult, type EntityLifeResourcePolicy} from '@rpg/gameplay';

declare const attack: CombatAttackResolutionResult;
declare const resources: EntityResourceState;
declare const life: EntityLifeState;
const policy: CombatDamageApplicationPolicy = {resourceId: 'vitality', minimum: 0, maximum: 100, currentAboveMaximum: 'allow'};
const canonicalPolicy: EntityLifeResourcePolicy = policy;
const result: CombatDamageApplicationResult = applyCombatAttackDamage(attack, resources, life, policy);
const outcome: CombatDamageApplicationOutcome = result.outcome;
type IsAny<T> = 0 extends (1 & T) ? true : false;
const noAny: [IsAny<typeof applyCombatAttackDamage>, IsAny<typeof result>, IsAny<typeof result.resourceResult>,
  IsAny<typeof result.lifeResult>] = [false, false, false, false];
if (result.outcome === 'processed') {
  const resource: EntityResourceTransitionResult = result.resourceResult;
  const defeated: EntityLifeTransitionResult = result.lifeResult;
  // @ts-expect-error Canonical nested resource state readonly.
  resource.state.current.vitality = 1;
  // @ts-expect-error Canonical resource diagnostics readonly.
  resource.transition.applied = 1;
  // @ts-expect-error Canonical life state readonly.
  defeated.state.status = 'alive';
  // @ts-expect-error Result transition binding readonly.
  result.resourceResult = resource;
  void resource; void defeated;
} else {
  const noResource: null = result.resourceResult, noLife: null = result.lifeResult;
  const zero: 0 = result.calculatedDamage, noApplied: 0 = result.appliedDamage;
  // @ts-expect-error No fabricated no-op transition.
  result.resourceResult.transition;
  void noResource; void noLife; void zero; void noApplied;
}
// @ts-expect-error Result readonly.
result.appliedDamage = 2;
// @ts-expect-error Context deeply readonly.
result.context.target.entityId = 'other';
// @ts-expect-error Policy readonly.
policy.minimum = 1;
// @ts-expect-error Explicit policy mandatory.
applyCombatAttackDamage(attack, resources, life);
// @ts-expect-error Raw damage is not an attack result.
applyCombatAttackDamage(30, resources, life, policy);
// @ts-expect-error Life is not a Resource State.
applyCombatAttackDamage(attack, life, life, policy);
// @ts-expect-error Resources are not Life State.
applyCombatAttackDamage(attack, resources, resources, policy);
// @ts-expect-error No implicit above-maximum policy.
const missing: CombatDamageApplicationPolicy = {resourceId: 'health', minimum: 0, maximum: 100};
// @ts-expect-error Exact policy literals.
const invalidPolicy: CombatDamageApplicationPolicy = {...policy, currentAboveMaximum: 'clamp'};
// @ts-expect-error Life outcome is not application outcome.
const invalidOutcome: CombatDamageApplicationOutcome = 'defeated';
// @ts-expect-error Root-only package exports.
import {applyCombatAttackDamage as deep} from '@rpg/gameplay/modules/combat';
void canonicalPolicy; void outcome; void noAny; void missing; void invalidPolicy; void invalidOutcome; void deep;
