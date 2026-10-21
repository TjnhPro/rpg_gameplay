import {
  createEntity, createEntityCollection, addEntity, createEntityLifeState,
  createEncounterState, activateEncounter, evaluateEncounterActionScope,
  createEncounterCompletionObservation, resolveEncounter, closeEncounter,
  createEncounterCleanupHandoff, cancelEncounter,
  type EncounterState, type EncounterStatus, type EncounterDispositionRecord,
  type EncounterResolutionOutcome, type EncounterCompletionPolicy,
} from '@rpg/gameplay';

const actor = createEntity({id: 'player-001', kind: 'player'});
const entities = addEntity(createEntityCollection(), actor);
const life = createEntityLifeState(actor, {status: 'alive'});
const prepared: EncounterState = createEncounterState({definitionId: 'forest-patrol'}, {
  encounterId: 'forest-fight-001', sides: [{sideId: 'party'}],
  participants: [{entityId: actor.id, sideId: 'party'}],
}, entities);
const status: EncounterStatus = prepared.status;
const activation = activateEncounter(prepared, entities, {
  minimumParticipants: 1, minimumOccupiedSides: 1, requiredOccupiedSideIds: [],
  allowedLifeStatuses: ['alive'], requireWorldReady: true,
}, {encounterId: prepared.encounterId, participants: [{entityId: actor.id, life, worldReady: true}]});
if (activation.status === 'activated') {
  const scope = evaluateEncounterActionScope(activation.state, entities,
    {targetMode: 'participant', allowedSideRelations: ['self']},
    {encounterId: prepared.encounterId, actionId: 'manual-turn', sourceEntityId: actor.id, targetEntityId: actor.id});
  if (scope.status === 'eligible') {const noRejection: 'none' = scope.reason; void noRejection;}
  const observation = createEncounterCompletionObservation({encounterId: prepared.encounterId,
    participants: [{entityId: actor.id, life}], continuation: 'clear', objectives: [{objectiveId: 'limit', status: 'succeeded'}]});
  const draw: EncounterResolutionOutcome = {kind: 'draw', winnerSideIds: [], defeatedSideIds: []};
  const policy: EncounterCompletionPolicy = {definitionId: prepared.definitionId,
    rules: [{ruleId: 'draw', kind: 'objective', objectiveId: 'limit', whenStatus: 'succeeded', outcome: draw}]};
  const result = resolveEncounter(activation.state, entities, policy, observation);
  if (result.status === 'resolved') {
    const companion: EncounterDispositionRecord = result.disposition;
    if (companion.kind === 'resolution') {const outcome: EncounterResolutionOutcome = companion.outcome; void outcome;}
    const closed = closeEncounter(result.state, entities, companion);
    if (closed.status === 'closed') createEncounterCleanupHandoff(closed.state, entities, closed.disposition);
  } else {const absent: null = result.disposition; void absent;}
}
const cancelled = cancelEncounter(prepared, entities,
  {definitionId: prepared.definitionId, cancelAllowedStatuses: ['prepared']},
  {encounterId: prepared.encounterId, reasonId: 'caller-abort'});
if (cancelled.status === 'cancelled' && cancelled.disposition.kind === 'cancellation') {
  const noVictory: null = cancelled.disposition.outcome; void noVictory;
}
// @ts-expect-error no scheduler on EncounterState
prepared.roundIndex = 1;
// @ts-expect-error no wave counter on EncounterState
prepared.waveIndex = 1;
// @ts-expect-error deeply readonly roster
prepared.participants.push({entityId: 'outsider', sideId: 'party'});
// @ts-expect-error terminal union is closed
const unsupported: EncounterStatus = 'reopened';
void [status, unsupported];
