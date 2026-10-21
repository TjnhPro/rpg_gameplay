import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../../dist/index.js';

test('entity collection identity and canonical derived stats', () => {
  const actor = g.createEntity({id: 'actor', kind: 'player'});
  const collection = g.addEntity(g.createEntityCollection(), actor);
  assert.deepEqual(g.getEntity(collection, 'actor'), actor);
  assert.throws(() => g.addEntity(collection, actor));
  const replaced = g.replaceEntity(collection, {id: 'actor', kind: 'npc'});
  assert.equal(g.getEntity(replaced, 'actor').kind, 'npc');
  assert.equal(g.getEntity(collection, 'actor').kind, 'player');
  const attributes = g.createEntityAttributeState(actor, {strength: 10});
  const next = g.setEntityBaseAttribute(attributes, 'strength', 12);
  assert.equal(attributes.baseAttributes.strength, 10);
  const rule = {default: 0, bounds: {}, enabled: true};
  const stats = g.calculateEntityStats(next, {attributeOrder: ['strength'], statOrder: ['power'],
    attributeRules: {strength: rule}, attributeBaselines: {strength: 0}, baseStats: {power: 5},
    rules: {power: {...rule, default: 5, scaling: [{attribute: 'strength', coefficient: 2, enabled: true}], training: 0}},
    flatContributions: {}, modifiers: []});
  assert.equal(stats.stats.power, 29);
  assert.throws(() => g.setEntityBaseAttribute(attributes, 'missing', 1));
});

test('bounded resource loss, explicit defeat and revival', () => {
  const actor = g.createEntity({id: 'actor', kind: 'player'});
  const resources = g.createEntityResourceState(actor, {health: {minimum: 0, maximum: 100, current: 20}});
  const life = g.createEntityLifeState(actor, {status: 'alive'});
  const policy = {resourceId: 'health', minimum: 0, maximum: 100};
  const depleted = g.transitionEntityResource(resources, 'health', {operation: 'decrease', amount: 30, maximum: 100,
    rule: {minimum: 0, currentAboveMaximum: 'reject', allowIncreaseFromMinimum: true}});
  assert.deepEqual(depleted.transition, {resource: 'health', before: 20, after: 0, applied: 20, reachedMinimum: true});
  const dead = g.resolveEntityDefeat(life, depleted.state, policy);
  assert.equal(dead.state.status, 'dead');
  assert.throws(() => g.reviveEntity(dead.state, depleted.state, policy), /recovery above minimum/);
  assert.equal(g.reviveEntity(dead.state, resources, policy).state.status, 'alive');
  assert.equal(life.status, 'alive');
  assert.equal(resources.current.health, 20);
});
