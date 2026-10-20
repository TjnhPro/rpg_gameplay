import {createEntity, createEntityCollection, addEntity, createActorAIState,
  createActorAIPerceptionSnapshot, evaluateActorAIPerception, evaluateActorAITargetSelection,
  type ActorAITargetSelectionPolicy, type ActorAITargetLossReason, type ActorAITargetSelectionResult,
  type ActorAIPerceptionExclusionReason, type ActorAIState} from '@rpg/gameplay';
const actor = createEntity({id: 'actor', kind: 'custom'});
const entities = addEntity(createEntityCollection(), actor);
const state = createActorAIState(actor, {profileId: 'profile'}, {controller: 'ai', behaviorStateId: 'idle'});
const perception = evaluateActorAIPerception(state, entities, createActorAIPerceptionSnapshot(state,
  {observedAtMs: 0, candidates: []}), {allowedRelationIds: [], allowedLifeStatuses: [],
  requireVisible: false, requireInRange: false, requireReachable: false, allowSelf: false});
const policy: ActorAITargetSelectionPolicy = {retention: 'retain_if_eligible', preferredTargetIds: ['actor']};
const alternate: ActorAITargetSelectionPolicy = {retention: 'prefer_priority', preferredTargetIds: []}; void alternate;
const exclusion: ActorAIPerceptionExclusionReason = 'target_not_visible';
const loss: ActorAITargetLossReason = exclusion;
const unseen: ActorAITargetLossReason = 'not_perceived'; void loss; void unseen;
const result: ActorAITargetSelectionResult = evaluateActorAITargetSelection(state, entities, perception, policy);
if (result.status === 'blocked') {
  const noState: null = result.state, target: null = result.selectedTargetEntityId;
  const manual: 'manual_control' = result.reason; void noState; void target; void manual;
} else {
  const next: ActorAIState = result.state; void next;
  if (result.status === 'selected') {const target: string = result.selectedTargetEntityId; void target;}
  else {const target: null = result.selectedTargetEntityId; void target;}
  // @ts-expect-error State candidates are readonly.
  result.state.targetEntityId = 'changed';
}
// @ts-expect-error No policy defaults.
const missing: ActorAITargetSelectionPolicy = {retention: 'prefer_priority'}; void missing;
// @ts-expect-error No other retention mode.
const invalid: ActorAITargetSelectionPolicy['retention'] = 'nearest'; void invalid;
// @ts-expect-error Canonical loss reasons only.
const invalidLoss: ActorAITargetLossReason = 'target_dead'; void invalidLoss;
// @ts-expect-error Nested preference list is readonly.
policy.preferredTargetIds.push('other');
// @ts-expect-error Result envelope is readonly.
result.lossReason = null;
// @ts-expect-error Root-only export map.
import {} from '@rpg/gameplay/modules/actor-ai';
