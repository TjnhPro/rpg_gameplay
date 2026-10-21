import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../../dist/index.js';

test('explicit activation, membership candidates, action scope and resolution/close', () => {
  let entities = g.createEntityCollection();
  for (const id of ['player', 'monster', 'guest']) entities = g.addEntity(entities, {id, kind: 'npc'});
  const prepared = g.createEncounterState({definitionId: 'fight'}, {encounterId: 'one',
    sides: [{sideId: 'party'}, {sideId: 'enemies'}],
    participants: [{entityId: 'player', sideId: 'party'}, {entityId: 'monster', sideId: 'enemies'}]}, entities);
  const fact = entityId => ({entityId, life: {entityId, status: 'alive'}, worldReady: true});
  const active = g.activateEncounter(prepared, entities,
    {requiredOccupiedSideIds: ['party', 'enemies'], minimumParticipants: 2, minimumOccupiedSides: 2,
      allowedLifeStatuses: ['alive'], requireWorldReady: true},
    {encounterId: 'one', participants: ['player', 'monster'].map(fact)}).state;
  assert.equal(active.status, 'active');
  assert.equal(prepared.status, 'prepared');
  const membership = {joinAllowedStatuses: ['active'], leaveAllowedStatuses: ['active'],
    changeSideAllowedStatuses: ['active'], allowedJoinLifeStatuses: ['alive'], requireWorldReadyOnJoin: true};
  const join = {operation: 'join', encounterId: 'one', entityId: 'guest', sideId: 'party', readiness: fact('guest')};
  const joined = g.applyEncounterMembershipChange(active, entities, membership, join);
  assert.equal(g.getEncounterParticipant(joined.state, entities, 'guest').sideId, 'party');
  const duplicate = g.applyEncounterMembershipChange(joined.state, entities, membership, join);
  assert.equal(duplicate.reason, 'already_participating');
  assert.equal(duplicate.state, null);
  const changed = g.applyEncounterMembershipChange(joined.state, entities, membership,
    {operation: 'change_side', encounterId: 'one', entityId: 'guest', sideId: 'enemies'});
  assert.equal(g.getEncounterParticipant(changed.state, entities, 'guest').sideId, 'enemies');
  const left = g.applyEncounterMembershipChange(changed.state, entities, membership,
    {operation: 'leave', encounterId: 'one', entityId: 'guest'});
  assert.equal(g.getEncounterParticipant(left.state, entities, 'guest'), null);
  const scope = {targetMode: 'participant', allowedSideRelations: ['other_side']};
  const action = {encounterId: 'one', actionId: 'attack', sourceEntityId: 'player', targetEntityId: 'monster'};
  assert.equal(g.evaluateEncounterActionScope(active, entities, scope, action).status, 'eligible');
  assert.equal(g.evaluateEncounterActionScope(prepared, entities, scope, action).reason, 'encounter_not_active');
  assert.equal(g.evaluateEncounterActionScope(active, entities, scope,
    {...action, sourceEntityId: 'guest'}).reason, 'source_not_participant');
  const policy = {definitionId: 'fight', rules: [{ruleId: 'last-standing', kind: 'side_elimination',
    contenderSideIds: ['party', 'enemies'], zeroSurvivors: 'pending'}]};
  const observation = {encounterId: 'one', participants: ['player', 'monster'].map(entityId =>
    ({entityId, life: {entityId, status: 'alive'}})), objectives: [], continuation: 'clear'};
  assert.equal(g.evaluateEncounterCompletion(active, entities, policy, observation).status, 'pending');
  assert.equal(g.resolveEncounter(active, entities, policy, observation).state, null);
  const defeated = {...observation, participants: [observation.participants[0],
    {entityId: 'monster', life: {entityId: 'monster', status: 'dead'}}]};
  const assessment = g.evaluateEncounterCompletion(active, entities, policy, defeated);
  assert.deepEqual(assessment.outcome, {kind: 'victory', winnerSideIds: ['party'], defeatedSideIds: ['enemies']});
  assert.equal(active.status, 'active'); // assessment does not finalize the encounter
  const resolved = g.resolveEncounter(active, entities, policy, defeated);
  assert.equal(resolved.state.status, 'resolved');
  assert.equal(g.closeEncounter(active, entities, resolved.disposition).reason, 'encounter_not_resolved');
  const closed = g.closeEncounter(resolved.state, entities, resolved.disposition);
  assert.equal(closed.state.status, 'closed');
  assert.equal(g.evaluateEncounterActionScope(closed.state, entities, scope, action).reason, 'encounter_not_active');
});
