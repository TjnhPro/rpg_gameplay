import {
  createEntity, createProgressionState, advanceProgressionLevel, createEntityAttributeState,
  createAttributePointState, grantAttributePointRewards, allocateAttributePoints,
  type EntityAttributePointState, type AttributePointInitialState, type AttributePointRewardPolicy,
  type AttributePointRewardResult, type AttributePointAllocation, type AttributePointAllocationResult,
} from '@rpg/gameplay';
const entity = createEntity({id: 'x', kind: 'custom'});
const progression = createProgressionState(entity, {level: 1, experience: 100});
const initial: AttributePointInitialState = {unspentPoints: 0, spentPoints: 0, rewardedThroughLevel: 1};
const points: EntityAttributePointState = createAttributePointState(progression, initial);
const level = advanceProgressionLevel(progression, {experienceMode: 'cumulative', maxLevel: 100, targetLevel: 2,
  requirements: [{toLevel: 2, requiredExperience: 100, eligible: true}]});
const policy: AttributePointRewardPolicy = {pointsByLevel: {2: 5}};
const reward: AttributePointRewardResult = grantAttributePointRewards(points, level, policy);
const allocation: AttributePointAllocation = {attributeId: 'strength', pointCost: 3, newBaseValue: 23};
const result: AttributePointAllocationResult = allocateAttributePoints(reward.state,
  createEntityAttributeState(entity, {strength: 20}), allocation);
const total: number = result.points.unspentPoints + result.points.spentPoints;
const levels: readonly number[] = reward.transition.rewardedLevels;
// @ts-expect-error All initial fields are required.
createAttributePointState(progression, {unspentPoints: 0, rewardedThroughLevel: 1});
// @ts-expect-error Receipt required; a plain ProgressionState is insufficient.
grantAttributePointRewards(points, progression, policy);
// @ts-expect-error Closed reward policy.
grantAttributePointRewards(points, level, {...policy, multiplier: 2});
// @ts-expect-error No callbacks as per-level rewards.
const callbackPolicy: AttributePointRewardPolicy = {pointsByLevel: {2: () => 5}};
// @ts-expect-error Closed allocation shape.
allocateAttributePoints(points, result.attributes, {...allocation, skillPoints: 1});
// @ts-expect-error Explicit new value required.
allocateAttributePoints(points, result.attributes, {attributeId: 'strength', pointCost: 1});
// @ts-expect-error Readonly initial input.
initial.unspentPoints = 5;
// @ts-expect-error Readonly point state.
points.rewardedThroughLevel = 2;
// @ts-expect-error Readonly reward map.
policy.pointsByLevel[2] = 10;
// @ts-expect-error Readonly granted state.
reward.state.spentPoints = 0;
// @ts-expect-error Readonly rewarded list.
reward.transition.rewardedLevels.push(3);
// @ts-expect-error Readonly allocation input.
allocation.newBaseValue = 30;
// @ts-expect-error Readonly combined result.
result.attributes = result.attributes;
// @ts-expect-error Canonical readonly attribute map.
result.attributes.baseAttributes.strength = 0;
// @ts-expect-error Readonly allocation transition.
result.transition.pointsSpent = 0;
// @ts-expect-error No mandatory points added to ProgressionState.
progression.unspentPoints;
// @ts-expect-error Root-only package exports.
import {allocateAttributePoints as deep} from '@rpg/gameplay/modules/progression';
void total; void levels; void callbackPolicy; void deep;
