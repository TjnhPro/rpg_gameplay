import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../../dist/index.js';

test('experience advancement, explicit point rewards and bounded spending', () => {
  const actor = g.createEntity({id: 'actor', kind: 'player'});
  const initial = g.createProgressionState(actor, {level: 1, experience: 0});
  const gained = g.gainExperience(initial, 260);
  assert.equal(gained.state.experience, 260);
  assert.throws(() => g.gainExperience(initial, -1));
  const advanced = g.advanceProgressionLevel(gained.state, {experienceMode: 'level-local', maxLevel: 100, targetLevel: 4,
    requirements: [{toLevel: 2, requiredExperience: 100, eligible: true},
      {toLevel: 3, requiredExperience: 150, eligible: true}, {toLevel: 4, requiredExperience: 200, eligible: true}]});
  assert.deepEqual(advanced.state, {entityId: 'actor', level: 3, experience: 10});
  const pool = g.createAttributePointState(initial, {unspentPoints: 0, spentPoints: 0, rewardedThroughLevel: 1});
  const rewardPolicy = {pointsByLevel: {2: 5, 3: 5}};
  const rewarded = g.grantAttributePointRewards(pool, advanced, rewardPolicy);
  assert.equal(rewarded.state.unspentPoints, 10);
  assert.throws(() => g.grantAttributePointRewards(rewarded.state, advanced, rewardPolicy));
  const attributes = g.createEntityAttributeState(actor, {strength: 10});
  const allocation = {attributeId: 'strength', pointCost: 10, newBaseValue: 20};
  const spent = g.allocateAttributePoints(rewarded.state, attributes, allocation);
  assert.equal(spent.attributes.baseAttributes.strength, 20);
  assert.equal(spent.points.unspentPoints, 0);
  assert.equal(spent.points.spentPoints, 10);
  assert.throws(() => g.allocateAttributePoints(spent.points, spent.attributes, allocation));
  assert.equal(rewarded.state.unspentPoints, 10); // caller commits the returned candidate
});
