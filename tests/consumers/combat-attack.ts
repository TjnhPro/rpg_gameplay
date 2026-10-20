import {resolveCombatAttack, createExecutionContext, type CombatAdmissionResult,
  type CombatTargetValidationResult, type CombatAttackInput, type CombatAttackOutcome,
  type CombatAttackResolutionResult} from '@rpg/gameplay';
import type {HitCalculationInput, CriticalCalculationInput, DamageScaling,
  ResolvedDamageBonus, MitigationCalculationInput} from '@rpg/core/kernel';

declare const admission: CombatAdmissionResult;
declare const target: CombatTargetValidationResult;
const hit: Required<Omit<HitCalculationInput, 'roll'>> = {
  dodgeChance: 0, eligible: true, rule: {enabled: true, bounds: {min: 0, max: 1}},
};
const critical: Omit<CriticalCalculationInput, 'roll'> = {
  chance: 0.5, bonus: 0.5, eligible: true, rule: hit.rule,
};
const scaling: readonly DamageScaling[] = [{source: 'strength', value: 20, coefficient: 2}];
const bonuses: readonly ResolvedDamageBonus[] = [];
const mitigation: Omit<MitigationCalculationInput, 'damage'> = {
  ruleKey: 'armor', rating: 100,
  rule: {enabled: true, bounds: {min: 0, max: 1}, baseK: 100, levelPenalty: 0, levelScalingEnabled: false},
};
const input: CombatAttackInput = {hit, critical, damage: {base: 100, rank: 1, perRank: 0,
  scaling, flat: {definition: 0, additional: 0, resolved: 0}, bonuses}, mitigation};
const execution = createExecutionContext({clock: {now: () => 0}, random: {next: () => 0.2}});
const result: CombatAttackResolutionResult = resolveCombatAttack(admission, target, input, execution);
const outcome: CombatAttackOutcome = result.outcome;
type IsAny<T> = 0 extends (1 & T) ? true : false;
const noAny: [IsAny<typeof resolveCombatAttack>, IsAny<typeof result>, IsAny<typeof input.damage>,
  IsAny<typeof result.hit>, IsAny<typeof result.finalDamage>] = [false, false, false, false, false];
if (result.outcome === 'landed') {
  const damage: number = result.mitigation.finalDamage;
  // @ts-expect-error Nested B0 diagnostics are immutable.
  result.b0.scaling.push({source: 'other', value: 1});
  // @ts-expect-error Scaling entries are immutable.
  result.b0.scaling[0]!.value = 0;
  // @ts-expect-error Mitigation diagnostics are immutable.
  result.mitigation.missing.push('other');
  // @ts-expect-error Critical diagnostics are immutable.
  result.critical.bonus = 1;
  // @ts-expect-error B1 diagnostics are immutable.
  result.b1.beforeDefense = 0;
  void damage;
} else {
  const zero: 0 = result.finalDamage;
  // @ts-expect-error Dodge does not fabricate unrun diagnostics.
  result.critical;
  // @ts-expect-error Dodge does not fabricate damage stages.
  result.b0;
  void zero;
}
// @ts-expect-error Result immutable.
result.finalDamage = 0;
// @ts-expect-error Hit diagnostics immutable.
result.hit.roll = 0;
// @ts-expect-error Nested context immutable.
result.context.target.entityId = 'other';
// @ts-expect-error No default execution context.
resolveCombatAttack(admission, target, input);
// @ts-expect-error Context is not an admission receipt.
resolveCombatAttack(admission.context, target, input, execution);
// @ts-expect-error Admission is not a target receipt.
resolveCombatAttack(admission, admission, input, execution);
// @ts-expect-error Explicit hit input required.
const missing: CombatAttackInput = {critical, damage: input.damage, mitigation};
// @ts-expect-error No arbitrary outcome.
const invalid: CombatAttackOutcome = 'applied';
// @ts-expect-error Root-only package exports.
import {resolveCombatAttack as deep} from '@rpg/gameplay/modules/combat';
void outcome; void noAny; void missing; void invalid; void deep;
