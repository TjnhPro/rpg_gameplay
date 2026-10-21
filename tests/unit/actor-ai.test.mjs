import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../../dist/index.js';

test('AI selects a candidate without execution; manual/dead actors are blocked', () => {
  const actor = g.createEntity({id: 'actor', kind: 'player'});
  let entities = g.addEntity(g.createEntityCollection(), actor);
  for (const id of ['B', 'A']) entities = g.addEntity(entities, {id, kind: 'monster'});
  const state = g.createActorAIState(actor, {profileId: 'profile'}, {controller: 'ai', behaviorStateId: 'idle'});
  const snapshot = g.createActorAIPerceptionSnapshot(state, {observedAtMs: 1200,
    candidates: ['B', 'A'].map(entityId => ({entityId, relationId: 'enemy', lifeStatus: 'alive',
      visible: true, inRange: true, reachable: true}))});
  const perception = g.evaluateActorAIPerception(state, entities, snapshot,
    {allowedRelationIds: ['enemy'], allowedLifeStatuses: ['alive'], requireVisible: true,
      requireInRange: true, requireReachable: true, allowSelf: false});
  const policy = {retention: 'prefer_priority', preferredTargetIds: []};
  const selected = g.evaluateActorAITargetSelection(state, entities, perception, policy);
  assert.equal(selected.status, 'selected');
  assert.equal(selected.selectedTargetEntityId, 'A');
  assert.equal(selected.state.targetEntityId, 'A');
  assert.equal(state.targetEntityId, null);
  assert.deepEqual(g.getEntity(entities, 'A'), {id: 'A', kind: 'monster'});
  const manual = g.evaluateActorAITargetSelection({...state, controller: 'manual'}, entities, perception, policy);
  assert.equal(manual.reason, 'manual_control');
  assert.equal(manual.state, null);
  assert.deepEqual(g.evaluateActorAILifeGate(state, entities, {entityId: 'actor', status: 'dead'}),
    {status: 'blocked', reason: 'actor_dead', actorId: 'actor'});
});
