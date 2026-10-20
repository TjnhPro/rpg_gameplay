import {createEntity, createEntityCollection, addEntity, createActorAIState,
  createActorAIBehaviorPolicy, createActorAIBehaviorObservation, evaluateActorAIBehaviorTransition,
  type ActorAIBehaviorTargetRequirement, type ActorAIBehaviorRule, type ActorAIBehaviorPolicy,
  type ActorAIBehaviorObservation, type ActorAIBehaviorTransitionResult, type ActorAIState} from '@rpg/gameplay';
const actor = createEntity({id: 'actor', kind: 'custom'});
const entities = addEntity(createEntityCollection(), actor);
const state = createActorAIState(actor, {profileId: 'P'}, {controller: 'ai', behaviorStateId: 'custom'});
const guards: readonly ActorAIBehaviorTargetRequirement[] = ['any', 'present', 'absent']; void guards;
const rule: ActorAIBehaviorRule = {ruleId: 'r', fromStateId: 'custom', triggerId: 'go', toStateId: 'other', targetRequirement: 'present'};
const policy: ActorAIBehaviorPolicy = createActorAIBehaviorPolicy({profileId: 'P', stateIds: ['custom', 'other'], rules: [rule]});
const observation: ActorAIBehaviorObservation = createActorAIBehaviorObservation(state, ['go']);
const result: ActorAIBehaviorTransitionResult = evaluateActorAIBehaviorTransition(state, entities, observation, policy);
if (result.status === 'blocked') {
  const noState: null = result.state, next: null = result.nextBehaviorStateId, matched: null = result.ruleId;
  const reason: 'manual_control' = result.reason; void noState; void next; void matched; void reason;
} else {
  const next: ActorAIState = result.state; void next;
  if (result.status === 'transitioned') {const ruleId: string = result.ruleId, triggerId: string = result.triggerId; void ruleId; void triggerId;}
  else {const reason: 'no_trigger' | 'no_matching_rule' | 'same_state' = result.reason; void reason;}
  // @ts-expect-error Candidate state is immutable.
  result.state.behaviorStateId = 'changed';
}
// @ts-expect-error Closed result discriminators exclude execution success.
const invalidStatus: ActorAIBehaviorTransitionResult['status'] = 'executed'; void invalidStatus;
// @ts-expect-error Blocked has no state candidate.
const invalidResult: ActorAIBehaviorTransitionResult = {status: 'blocked', reason: 'manual_control', ruleId: null, triggerId: null, previousBehaviorStateId: 'custom', nextBehaviorStateId: null, state}; void invalidResult;
// @ts-expect-error Guard has no default or numerical policy.
const invalidGuard: ActorAIBehaviorTargetRequirement = 'alive'; void invalidGuard;
// @ts-expect-error Required target guard.
const missing: ActorAIBehaviorRule = {ruleId: 'r', fromStateId: 'a', triggerId: 'go', toStateId: 'b'}; void missing;
// @ts-expect-error Nested rule list is readonly.
policy.rules.push(rule);
// @ts-expect-error Nested rule is readonly.
policy.rules[0]!.toStateId = 'changed';
// @ts-expect-error State membership is readonly.
policy.stateIds.push('changed');
// @ts-expect-error Observation triggers are readonly.
observation.triggerIds.push('changed');
// @ts-expect-error Result envelope is readonly.
result.reason = 'same_state';
// @ts-expect-error Root-only package exports.
import {} from '@rpg/gameplay/modules/actor-ai';
