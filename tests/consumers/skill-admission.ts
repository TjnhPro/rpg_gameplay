import {evaluateSkillActivationAdmission, createSkillDefinition, createSkillInstance,
  createEntity, createEntityCollection, addEntity, createEntityLifeState, createSkillRankState, getSkillRank,
  type SkillAdmissionPolicy, type SkillRankAdmissionPolicy, type SkillAdmissionStatus,
  type SkillAdmissionReason, type SkillAdmissionResult, type SkillDefinition, type SkillInstanceState,
  type EntityCollection, type EntityLifeState} from '@rpg/gameplay';

const actor = createEntity({id: 'player-1', kind: 'player'});
const definition = createSkillDefinition({skillId: 'fireball'});
const instance = createSkillInstance(definition, actor, {instanceId: 'instance-001'});
const entities = addEntity(createEntityCollection(), actor);
const life = createEntityLifeState(actor, {status: 'alive'});
const rankless: SkillRankAdmissionPolicy = {mode: 'not_required'};
const rank = getSkillRank(createSkillRankState(actor, {fireball: 3}), definition.skillId);
const ranked: SkillRankAdmissionPolicy = {mode: 'required', currentRank: rank ?? null, minimumRank: 2};
const policy: SkillAdmissionPolicy = {owned: true, eligible: true, rank: ranked};
const result: SkillAdmissionResult = evaluateSkillActivationAdmission(definition, instance, actor.id, entities, life, policy);
const signature: (definition: SkillDefinition, instance: SkillInstanceState, actorEntityId: string,
  entities: EntityCollection, actorLife: EntityLifeState, policy: SkillAdmissionPolicy) => SkillAdmissionResult = evaluateSkillActivationAdmission;
const status: SkillAdmissionStatus = result.status;
const reason: SkillAdmissionReason = result.reason;
const ids: readonly string[] = [result.instanceId, result.skillId, result.actorEntityId];
type IsAny<T> = 0 extends (1 & T) ? true : false;
const noAny: [IsAny<typeof evaluateSkillActivationAdmission>, IsAny<typeof result>, IsAny<typeof policy.rank>,
  IsAny<typeof result.status>, IsAny<typeof result.reason>] = [false, false, false, false, false];
// @ts-expect-error Ownership is mandatory.
const missing: SkillAdmissionPolicy = {eligible: true, rank: rankless};
// @ts-expect-error Rank policy is mandatory.
const missingRank: SkillAdmissionPolicy = {owned: true, eligible: true};
// @ts-expect-error No implicit boolean coercion.
const bool: SkillAdmissionPolicy = {owned: 1, eligible: true, rank: rankless};
// @ts-expect-error No metadata bag.
const extra: SkillAdmissionPolicy = {owned: true, eligible: true, rank: rankless, metadata: {}};
// @ts-expect-error Rankless variant has no numerical fields.
const ranklessExtra: SkillRankAdmissionPolicy = {mode: 'not_required', currentRank: 1};
// @ts-expect-error Explicit null represents unknown registration, not undefined.
const undefinedRank: SkillRankAdmissionPolicy = {mode: 'required', currentRank: undefined, minimumRank: 1};
// @ts-expect-error minimumRank is required.
const missingMinimum: SkillRankAdmissionPolicy = {mode: 'required', currentRank: 3};
// @ts-expect-error Unknown rank modes are rejected.
const mode: SkillRankAdmissionPolicy = {mode: 'automatic'};
// @ts-expect-error Six explicit arguments required.
evaluateSkillActivationAdmission(definition, instance, actor.id, entities, life);
// @ts-expect-error Actor ID is a string, not Entity.
evaluateSkillActivationAdmission(definition, instance, actor, entities, life, policy);
// @ts-expect-error Result IDs are readonly.
result.instanceId = 'changed';
// @ts-expect-error Result skill ID is readonly.
result.skillId = 'changed';
// @ts-expect-error Result actor ID is readonly.
result.actorEntityId = 'changed';
// @ts-expect-error Result status is readonly.
result.status = 'rejected';
// @ts-expect-error Result reason is readonly.
result.reason = 'actor_dead';
// @ts-expect-error Policy is readonly.
policy.owned = false;
// @ts-expect-error Nested rank is readonly.
ranked.currentRank = 0;
// @ts-expect-error No speculative resource reason.
const future: SkillAdmissionReason = 'insufficient_resource';
// @ts-expect-error Admission is not activation.
const activated: SkillAdmissionStatus = 'activated';
// @ts-expect-error No receipt/token.
result.activationId;
// @ts-expect-error No rank duplicated on the instance.
instance.rank;
// @ts-expect-error No deep Skill import.
import {evaluateSkillActivationAdmission as deep} from '@rpg/gameplay/modules/skill';
void [rankless, signature, status, reason, ids, noAny, missing, missingRank, bool, extra,
  ranklessExtra, undefinedRank, missingMinimum, mode, future, activated, deep];
