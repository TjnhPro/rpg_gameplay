import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../../dist/index.js';

test('canonical damage/defeat is deterministic; dead source and invalid relation are rejected', () => {
  const source = g.createEntity({id: 'source', kind: 'player'});
  const target = g.createEntity({id: 'target', kind: 'monster'});
  const entities = g.addEntity(g.addEntity(g.createEntityCollection(), source), target);
  const context = g.createCombatActionContext({actionId: 'attack', actionType: 'basic_attack',
    sourceEntityId: source.id, target: {kind: 'entity', entityId: target.id}});
  const life = g.createEntityLifeState(target, {status: 'alive'});
  const resources = g.createEntityResourceState(target, {health: {minimum: 0, maximum: 100, current: 100}});
  const admission = g.evaluateCombatActionAdmission(context, entities,
    {entityId: source.id, status: 'alive'}, {eligible: true});
  assert.equal(admission.status, 'admitted');
  assert.equal(g.evaluateCombatActionAdmission(context, entities,
    {entityId: source.id, status: 'dead'}, {eligible: true}).reason, 'source_dead');
  const targetPolicy = {relation: 'enemy', allowedRelations: ['enemy'], allowedLifeStatuses: ['alive']};
  const validated = g.evaluateCombatTargetValidation(admission, entities, life, targetPolicy);
  assert.equal(validated.status, 'accepted');
  assert.equal(g.evaluateCombatTargetValidation(admission, entities, life,
    {...targetPolicy, relation: 'ally'}).reason, 'relation_not_allowed');
  const numerical = {
    hit: {dodgeChance: 0.1, eligible: true, rule: {enabled: true, bounds: {min: 0, max: 1}}},
    critical: {chance: 0.5, bonus: 0.5, eligible: true, rule: {enabled: false, bounds: {min: 0, max: 1}}},
    damage: {base: 150, rank: 1, perRank: 0, scaling: [], flat: {definition: 0, additional: 0, resolved: 0}, bonuses: []},
    mitigation: {ruleKey: 'armor', rating: 100, rule: {enabled: false, bounds: {min: 0, max: 1}, levelScalingEnabled: false}},
  };
  const run = () => {
    let draws = 0;
    const execution = g.createExecutionContext({clock: {now: () => 1000},
      random: {next() { draws++; return 0.2; }}});
    const attack = g.resolveCombatAttack(admission, validated, numerical, execution);
    assert.ok(draws > 0, 'the repeat-call oracle exercises injected randomness');
    return g.applyCombatAttackDamage(attack, resources, life,
      {resourceId: 'health', minimum: 0, maximum: 100, currentAboveMaximum: 'reject'});
  };
  const result = run();
  assert.deepEqual(run(), result);
  assert.equal(result.calculatedDamage, 150);
  assert.equal(result.appliedDamage, 100);
  assert.equal(result.resourceResult.state.current.health, 0);
  assert.equal(result.lifeResult.outcome, 'defeated');
  assert.equal(result.lifeResult.state.status, 'dead');
  assert.deepEqual(result.resourceResult, g.transitionEntityResource(resources, 'health',
    {operation: 'decrease', amount: 150, maximum: 100,
      rule: {minimum: 0, currentAboveMaximum: 'reject', allowIncreaseFromMinimum: false}}));
  assert.equal(resources.current.health, 100);
  assert.equal(life.status, 'alive');
});
