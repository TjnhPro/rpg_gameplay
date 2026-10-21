import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../../dist/index.js';

test('skill admission, all-or-nothing resource cost and injected-clock cooldown', () => {
  const actor = g.createEntity({id: 'actor', kind: 'player'});
  const entities = g.addEntity(g.createEntityCollection(), actor);
  const definition = g.createSkillDefinition({skillId: 'fireball'});
  const instance = g.createSkillInstance(definition, actor, {instanceId: 'cast'});
  const policy = {owned: true, eligible: true, rank: {mode: 'not_required'}};
  const admission = g.evaluateSkillActivationAdmission(definition, instance, actor.id, entities,
    {entityId: actor.id, status: 'alive'}, policy);
  assert.equal(admission.status, 'admitted');
  assert.equal(g.evaluateSkillActivationAdmission(definition, instance, actor.id, entities,
    {entityId: actor.id, status: 'dead'}, policy).reason, 'actor_dead');
  const resources = {entityId: actor.id, current: {mana: 100}};
  const request = {costs: [{resourceId: 'mana', amount: 25}],
    bounds: [{resourceId: 'mana', minimum: 0, maximum: 100, currentAboveMaximum: 'reject'}]};
  const paid = g.applySkillResourceCosts(admission, resources, request);
  assert.equal(paid.status, 'applied');
  assert.equal(paid.state.current.mana, 75);
  const rejected = g.applySkillResourceCosts(admission, {entityId: actor.id, current: {mana: 10}}, request);
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.state, null);
  assert.equal(resources.current.mana, 100);
  let now = 1000;
  const context = g.createExecutionContext({clock: {now: () => now}});
  const initial = g.createSkillCooldownState(instance);
  const started = g.startSkillCooldown(instance, initial, context, {baseDurationMs: 1000, effectiveCdr: 0.25});
  assert.equal(started.durationMs, 750); // canonical Kernel duration, independent literal oracle
  assert.equal(started.state.readyAtMs, 1750);
  assert.equal(g.startSkillCooldown(instance, started.state, context,
    {baseDurationMs: 0, effectiveCdr: 0}).status, 'rejected');
  now = 1750;
  assert.equal(g.evaluateSkillCooldownReady(instance, started.state, context).status, 'ready');
});
