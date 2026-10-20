import assert from 'node:assert/strict';
import test from 'node:test';
import * as g from '@rpg/gameplay';

// Installed external caller: canonical Combat preflight, explicit candidate commit,
// request dispatch and completion reporting. No production cross-owner pipeline.
function fixture(relation = 'enemy') {
  const actor = g.createEntity({id: 'player-1', kind: 'player'});
  const target = g.createEntity({id: 'target-1', kind: 'monster'});
  const entities = [actor, target].reduce(g.addEntity, g.createEntityCollection());
  const actorLife = g.createEntityLifeState(actor, {status: 'alive'});
  const targetLife = g.createEntityLifeState(target, {status: 'alive'});
  const definition = g.createSkillDefinition({skillId: 'fireball'});
  const instance = g.createSkillInstance(definition, actor, {instanceId: 'instance-001'});
  const calls = {clock: 0, random: 0, ids: 0};
  const executionContext = g.createExecutionContext({clock: {now() {calls.clock++; return 1000;}},
    random: {next() {calls.random++; return .2;}}, ids: {next() {calls.ids++; throw Error('unexpected ID');}}});
  const intent = {attemptId: 'attempt-001', dispatch: {kind: 'combat', actionId: 'action-001',
    actionType: 'spell_attack', targetEntityId: target.id}};
  const input = {instance, admission: g.evaluateSkillActivationAdmission(definition, instance, actor.id,
    entities, actorLife, {owned: true, eligible: true, rank: {mode: 'not_required'}}),
    resourceState: g.createEntityResourceState(actor, {mana: {minimum: 0, maximum: 100, current: 100}}),
    resourceCosts: {costs: [{resourceId: 'mana', amount: 25}],
      bounds: [{resourceId: 'mana', minimum: 0, maximum: 100, currentAboveMaximum: 'reject'}]},
    cooldownState: g.createSkillCooldownState(instance), cooldownConfig: {baseDurationMs: 1000, effectiveCdr: .25},
    executionContext, intent};
  const targetPolicy = {relation, allowedRelations: ['enemy'], allowedLifeStatuses: ['alive']};
  function preflight(actorEntityId, dispatch) {
    const context = g.createCombatActionContext({actionId: dispatch.actionId, actionType: dispatch.actionType,
      sourceEntityId: actorEntityId, target: {kind: 'entity', entityId: dispatch.targetEntityId}});
    const admission = g.evaluateCombatActionAdmission(context, entities, actorLife, {eligible: true});
    const validation = g.evaluateCombatTargetValidation(admission, entities, targetLife, targetPolicy);
    return {context, admission, validation};
  }
  const checked = preflight(actor.id, intent.dispatch);
  input.executionPreflight = {kind: 'combat', status:
    checked.admission.status === 'admitted' && checked.validation.status === 'accepted' ? 'accepted' : 'rejected'};
  return {input, calls, checked, preflight, targetLife,
    targetResources: g.createEntityResourceState(target, {health: {minimum: 0, maximum: 100, current: 100}})};
}

test('SK24/S03: actual installed Combat target rejection stops activation without payment or clock', () => {
  const f = fixture('ally');
  assert.equal(f.checked.admission.status, 'admitted');
  assert.equal(f.checked.validation.status, 'rejected');
  assert.equal(f.checked.validation.reason, 'relation_not_allowed');
  assert.deepEqual(g.activateSkill(f.input), {status: 'rejected', reason: 'execution_preflight_rejected',
    request: null, resources: null, cooldown: null});
  assert.equal(f.input.resourceState.current.mana, 100);
  assert.equal(f.input.cooldownState.readyAtMs, null);
  assert.deepEqual(f.calls, {clock: 0, random: 0, ids: 0});
  console.log('SKILL_COMBAT_PREFLIGHT_PASS S03; canonical_relation_not_allowed; no_payment_clock');
});

test('SK24/S12-S14/S22: exact request identity reaches actual Combat dodge and landed application', () => {
  const oldNow = Date.now, oldRandom = Math.random;
  Date.now = Math.random = () => {throw Error('implicit provider');};
  try {
    for (const dodged of [true, false]) {
      const f = fixture(), result = g.activateSkill(f.input);
      assert.equal(result.status, 'accepted');
      assert.deepEqual(result.request, {attemptId: 'attempt-001', instanceId: 'instance-001', skillId: 'fireball',
        actorEntityId: 'player-1', dispatch: {kind: 'combat', actionId: 'action-001', actionType: 'spell_attack', targetEntityId: 'target-1'}});
      // Candidate commit belongs to this caller before dispatch.
      const committed = {resources: result.resources, cooldown: result.cooldown};
      assert.deepEqual(committed, {resources: {entityId: 'player-1', current: {mana: 75}},
        cooldown: {instanceId: 'instance-001', skillId: 'fireball', entityId: 'player-1', startedAtMs: 1000, readyAtMs: 1750}});
      const handoff = f.preflight(result.request.actorEntityId, result.request.dispatch);
      assert.deepEqual(handoff.context, {actionId: 'action-001', actionType: 'spell_attack', sourceEntityId: 'player-1',
        target: {kind: 'entity', entityId: 'target-1'}});
      assert.equal(handoff.admission.status, 'admitted'); assert.equal(handoff.validation.status, 'accepted');
      const numerical = {hit: {dodgeChance: dodged ? .5 : 0, eligible: true, rule: {enabled: true, bounds: {min: 0, max: 1}}},
        critical: {chance: .5, bonus: .5, eligible: true, rule: {enabled: true, bounds: {min: 0, max: 1}}},
        damage: {base: 100, rank: 1, perRank: 0, scaling: [], flat: {definition: 0, additional: 0, resolved: 0}, bonuses: []},
        mitigation: {ruleKey: 'armor', rating: 100, rule: {enabled: true, bounds: {min: 0, max: 1},
          baseK: 100, levelPenalty: 0, levelScalingEnabled: false}}};
      const attack = g.resolveCombatAttack(handoff.admission, handoff.validation, numerical, f.input.executionContext);
      const applied = g.applyCombatAttackDamage(attack, f.targetResources, f.targetLife,
        {resourceId: 'health', minimum: 0, maximum: 100, currentAboveMaximum: 'allow'});
      assert.equal(attack.outcome, dodged ? 'dodged' : 'landed');
      assert.equal(attack.finalDamage, dodged ? 0 : 75); // Independent oracle: 100*1.5*(1-.5).
      if (dodged) {
        assert.equal(applied.resourceResult, null); assert.equal(applied.lifeResult, null);
      } else {
        assert.equal(applied.appliedDamage, 75);
        assert.deepEqual(applied.resourceResult.state, {entityId: 'target-1', current: {health: 25}});
        assert.deepEqual(applied.lifeResult.state, {entityId: 'target-1', status: 'alive'});
      }
      assert.deepEqual(g.reportSkillExecutionOutcome(result.request, {status: 'completed'}),
        {attemptId: 'attempt-001', instanceId: 'instance-001', skillId: 'fireball', actorEntityId: 'player-1',
          dispatchKind: 'combat', status: 'completed'});
      assert.equal(committed.resources.current.mana, 75); assert.equal(committed.cooldown.readyAtMs, 1750);
      assert.equal(f.input.resourceState.current.mana, 100); assert.equal(f.targetResources.current.health, 100);
      assert.deepEqual(f.calls, {clock: 1, random: 1, ids: 0});
    }
  } finally {Date.now = oldNow; Math.random = oldRandom;}
  console.log('SKILL_COMBAT_HANDOFF_PASS S12-S14/S22; canonical_admission_target_attack_damage; mana75; HP100->25; dodge_completed');
});
