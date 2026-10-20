import * as g from '@rpg/gameplay';
const source = g.createEntity({id: 'player-1', kind: 'player'});
const target = g.createEntity({id: 'monster-1', kind: 'monster'});
const entities = g.addEntity(g.addEntity(g.createEntityCollection(), source), target);
const sourceLife = g.createEntityLifeState(source, {status: 'alive'});
let life: g.EntityLifeState = g.createEntityLifeState(target, {status: 'alive'});
let resources: g.EntityResourceState = g.createEntityResourceState(target, {health: {minimum: 0, maximum: 100}});
declare const numerical: g.CombatAttackInput;
const execution = g.createExecutionContext({clock: {now: () => 0}, random: {next: () => 0.2}});
const policy: g.CombatDamageApplicationPolicy = {resourceId: 'health', minimum: 0, maximum: 100, currentAboveMaximum: 'allow'};
for (const actionId of ['attack-001', 'attack-002']) {
  const context = g.createCombatActionContext({actionId, actionType: 'basic_attack', sourceEntityId: source.id,
    target: {kind: 'entity', entityId: target.id}});
  const admission = g.evaluateCombatActionAdmission(context, entities, sourceLife, {eligible: true});
  if (admission.status === 'rejected') continue;
  const validation = g.evaluateCombatTargetValidation(admission, entities, life,
    {relation: 'enemy', allowedRelations: ['enemy'], allowedLifeStatuses: ['alive']});
  if (validation.status === 'rejected') continue;
  const attack: g.CombatAttackResolutionResult = g.resolveCombatAttack(admission, validation, numerical, execution);
  const result = g.applyCombatAttackDamage(attack, resources, life, policy);
  if (result.outcome === 'processed') {
    const resourceResult: g.EntityResourceTransitionResult = result.resourceResult;
    const lifeResult: g.EntityLifeTransitionResult = result.lifeResult;
    resources = resourceResult.state; life = lifeResult.state;
    // @ts-expect-error Old and next snapshots remain readonly.
    resources.current.health = 1;
    // @ts-expect-error No writable Life alias.
    life.status = 'alive';
  } else {
    const noResource: null = result.resourceResult, noLife: null = result.lifeResult;
    const zero: 0 = result.appliedDamage;
    void noResource; void noLife; void zero;
  }
  if (attack.outcome === 'dodged') {
    const zero: 0 = attack.finalDamage;
    // @ts-expect-error Unrun numerical stage absent on dodge.
    attack.critical;
    void zero;
  }
  type IsAny<T> = 0 extends (1 & T) ? true : false;
  const noAny: [IsAny<typeof result>, IsAny<typeof attack>] = [false, false];
  void noAny;
}
// @ts-expect-error No production orchestration facade.
g.createCombatEngine();
// @ts-expect-error No persistent Combat Session.
g.createCombatSession();
// @ts-expect-error Root-only installed boundary.
import {resolveCombatAttack} from '@rpg/gameplay/dist/modules/combat/index.js';
void resolveCombatAttack;
