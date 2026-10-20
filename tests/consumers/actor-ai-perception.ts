import {createEntity, createEntityCollection, addEntity, createActorAIState,
  createActorAIPerceptionSnapshot, validateActorAIPerceptionSnapshot, evaluateActorAIPerception,
  type EntityLifeStatus, type ActorAIPerceivedEntity, type ActorAIPerceptionSnapshot,
  type ActorAIPerceptionPolicy, type ActorAIPerceptionExclusionReason,
  type ActorAIPerceptionExclusion, type ActorAIPerceptionAssessment} from '@rpg/gameplay';
const actor = createEntity({id: 'player', kind: 'player'});
const entities = addEntity(createEntityCollection(), actor);
const state = createActorAIState(actor, {profileId: 'custom'}, {controller: 'manual', behaviorStateId: 'idle'});
const life: EntityLifeStatus = 'alive';
const candidate: ActorAIPerceivedEntity = {entityId: 'player', relationId: 'self', lifeStatus: life,
  visible: true, inRange: true, reachable: true};
const policy: ActorAIPerceptionPolicy = {allowedRelationIds: ['self'], allowedLifeStatuses: [life],
  requireVisible: true, requireInRange: false, requireReachable: false, allowSelf: true};
const snapshot: ActorAIPerceptionSnapshot = validateActorAIPerceptionSnapshot(state,
  createActorAIPerceptionSnapshot(state, {observedAtMs: 0, candidates: [candidate]}));
const assessment: ActorAIPerceptionAssessment = evaluateActorAIPerception(state, entities, snapshot, policy);
const reason: ActorAIPerceptionExclusionReason = 'entity_not_found';
const exclusion: ActorAIPerceptionExclusion = {entityId: 'missing', reason};
const canonicalLife: EntityLifeStatus = candidate.lifeStatus; void canonicalLife; void exclusion;
// @ts-expect-error Canonical Life domain only.
const invalidLife: ActorAIPerceivedEntity['lifeStatus'] = 'ghost'; void invalidLife;
// @ts-expect-error All explicit policy gates required.
const defaults: ActorAIPerceptionPolicy = {allowedRelationIds: []}; void defaults;
// @ts-expect-error Readonly snapshot.
snapshot.observedAtMs = 9;
// @ts-expect-error Readonly nested array.
snapshot.candidates.push(candidate);
// @ts-expect-error Readonly fact.
candidate.relationId = 'enemy';
// @ts-expect-error Readonly policy list.
policy.allowedLifeStatuses.push('dead');
// @ts-expect-error Readonly assessment candidate.
assessment.eligible[0]!.visible = false;
// @ts-expect-error Readonly exclusion reason.
assessment.excluded[0]!.reason = 'self_not_allowed';
// @ts-expect-error Assessment does not select a target.
assessment.selectedTargetId;
// @ts-expect-error Closed root-only package exports.
import {} from '@rpg/gameplay/modules/actor-ai';
