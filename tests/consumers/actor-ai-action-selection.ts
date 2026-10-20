import {createEntity, createEntityCollection, addEntity, createActorAIState, createActorAIDecisionContext,
  createActorAIActionSelectionPolicy, createActorAIActionObservation, evaluateActorAIActionSelection,
  validateActorAIDecisionResult, type ActorAIActionKind, type ActorAIActionTargetMode, type ActorAIActionRule,
  type ActorAIActionSelectionPolicy, type ActorAIActionAvailability, type ActorAIActionObservation,
  type ActorAIActionRuleRejectionReason, type ActorAIActionRuleRejection, type ActorAIActionSelectionResult,
  type ActorAIActionIntent, type ActorAIDecisionResult} from '@rpg/gameplay';
const actor = createEntity({id: 'actor', kind: 'custom'}), entities = addEntity(createEntityCollection(), actor);
const state = createActorAIState(actor, {profileId: 'P'}, {controller: 'ai', behaviorStateId: 'engaged'});
const context = createActorAIDecisionContext(state, 'D');
const kinds: readonly ActorAIActionKind[] = ['basic_attack', 'skill', 'approach_target', 'return_home', 'wait'];
const modes: readonly ActorAIActionTargetMode[] = ['current_target', 'self', 'none']; void kinds; void modes;
const rule: ActorAIActionRule = {ruleId: 'r', behaviorStateId: 'engaged', actionKey: 'skill', actionKind: 'skill', targetMode: 'self'};
const policy: ActorAIActionSelectionPolicy = createActorAIActionSelectionPolicy({profileId: 'P', rules: [rule]});
const facts: readonly ActorAIActionAvailability[] = [{actionKey: 'skill', status: 'available', reasonId: null},
  {actionKey: 'attack', status: 'unavailable', reasonId: 'opaque'}];
const observation: ActorAIActionObservation = createActorAIActionObservation(context, facts);
const result: ActorAIActionSelectionResult = evaluateActorAIActionSelection(state, entities, context, policy, observation);
const decision: ActorAIDecisionResult = validateActorAIDecisionResult(state, context, result.decision);
if (decision.status === 'proposed') {const intent: ActorAIActionIntent = decision.intent; void intent;}
else {const nothing: null = decision.intent; void nothing;}
const reasons: readonly ActorAIActionRuleRejectionReason[] = ['availability_missing', 'action_unavailable', 'target_missing']; void reasons;
const rejection: ActorAIActionRuleRejection | undefined = result.rejected[0]; void rejection;
for (const fact of facts) {if (fact.status === 'available') {const reason: null = fact.reasonId; void reason;} else {const reason: string = fact.reasonId; void reason;}}
// @ts-expect-error Closed category excludes execution receipts.
const invalidKind: ActorAIActionKind = 'executed'; void invalidKind;
// @ts-expect-error No spatial target mode.
const invalidMode: ActorAIActionTargetMode = 'ground'; void invalidMode;
// @ts-expect-error Availability reason discriminant.
const invalidFact: ActorAIActionAvailability = {actionKey: 'x', status: 'available', reasonId: 'invalid'}; void invalidFact;
// @ts-expect-error Intent retains the existing shape, no damage.
const invalidIntent: ActorAIActionIntent = {...context, actionKey: 'x', targetEntityId: null, damage: 10}; void invalidIntent;
// @ts-expect-error Required observation correlation.
createActorAIActionObservation({actorId: 'actor'}, []);
// @ts-expect-error Nested policy array readonly.
policy.rules.push(rule);
// @ts-expect-error Nested rule readonly.
policy.rules[0]!.actionKey = 'changed';
// @ts-expect-error Nested observation readonly.
observation.availability.push(facts[0]!);
// @ts-expect-error Availability fact readonly.
observation.availability[0]!.reasonId = null;
// @ts-expect-error Frozen result metadata.
result.selectedRuleId = 'changed';
// @ts-expect-error Frozen rejection.
result.rejected[0]!.reason = 'target_missing';
// @ts-expect-error Existing immutable intent preserved.
if (decision.status === 'proposed') decision.intent.actionKey = 'changed';
// @ts-expect-error Root-only package.
import {} from '@rpg/gameplay/modules/actor-ai';
