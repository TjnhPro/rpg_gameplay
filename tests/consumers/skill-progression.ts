import {
  createEntity, createProgressionState, advanceProgressionLevel,
  createSkillRankState, getSkillRank, createSkillPointState, grantSkillPointRewards,
  evaluateSkillUpgrade, upgradeSkillRank,
  type EntitySkillRankState, type SkillPointInitialState, type EntitySkillPointState,
  type SkillPointRewardPolicy, type SkillPointRewardResult, type SkillRankPrerequisite,
  type SkillUpgradeRequirement, type SkillUpgradeOutcome, type SkillUpgradeBlockReason,
  type SkillUpgradeAssessment, type SkillUpgradeResult,
} from '@rpg/gameplay';
const actor = createEntity({id: 'x', kind: 'custom'});
const progression = createProgressionState(actor, {level: 10, experience: 100});
const ranks: EntitySkillRankState = createSkillRankState(actor, {sword: 0, basic: 2});
const initial: SkillPointInitialState = {unspentPoints: 0, spentPoints: 0, rewardedThroughLevel: 10};
const points: EntitySkillPointState = createSkillPointState(progression, initial);
const receipt = advanceProgressionLevel(progression, {experienceMode: 'cumulative', maxLevel: 20, targetLevel: 11,
  requirements: [{toLevel: 11, requiredExperience: 100, eligible: true}]});
const rewardPolicy: SkillPointRewardPolicy = {pointsByLevel: {11: 1}};
const reward: SkillPointRewardResult = grantSkillPointRewards(points, receipt, rewardPolicy);
const prerequisite: SkillRankPrerequisite = {skillId: 'basic', minimumRank: 2};
const requirement: SkillUpgradeRequirement = {skillId: 'sword', expectedRank: 0, maxRank: 5, pointCost: 1,
  requiredCharacterLevel: 10, prerequisites: [prerequisite], eligible: true};
const assessment: SkillUpgradeAssessment = evaluateSkillUpgrade(receipt.state, ranks, reward.state, requirement);
const result: SkillUpgradeResult = upgradeSkillRank(receipt.state, ranks, reward.state, requirement);
const rank: number | undefined = getSkillRank(result.ranks, 'sword');
const outcome: SkillUpgradeOutcome = assessment.outcome;
const reason: SkillUpgradeBlockReason = result.transition.reason;
// @ts-expect-error Required explicit balances/cursor.
createSkillPointState(progression, {unspentPoints: 0});
// @ts-expect-error Actual advancement result required.
grantSkillPointRewards(points, progression, rewardPolicy);
// @ts-expect-error Rank map accepts numeric ranks only.
createSkillRankState(actor, {sword: '0'});
// @ts-expect-error String identifiers only.
getSkillRank(ranks, 123);
// @ts-expect-error Unknown lookup may be undefined.
const definite: number = getSkillRank(ranks, 'unknown');
// @ts-expect-error expectedRank is required.
const missing: SkillUpgradeRequirement = {skillId: 'sword', maxRank: 5, pointCost: 1, requiredCharacterLevel: 10, prerequisites: [], eligible: true};
// @ts-expect-error Closed policy.
evaluateSkillUpgrade(progression, ranks, points, {...requirement, cooldown: 1});
// @ts-expect-error Eligibility is boolean, not callback.
upgradeSkillRank(progression, ranks, points, {...requirement, eligible: () => true});
// @ts-expect-error Readonly nested ranks.
ranks.ranks.sword = 1;
// @ts-expect-error Readonly state identity.
ranks.entityId = 'other';
// @ts-expect-error Readonly initial values.
initial.unspentPoints = 3;
// @ts-expect-error Readonly point cursor.
points.rewardedThroughLevel = 11;
// @ts-expect-error Readonly reward map.
rewardPolicy.pointsByLevel[11] = 2;
// @ts-expect-error Readonly reward level list.
reward.transition.rewardedLevels.push(12);
// @ts-expect-error Readonly prerequisite.
prerequisite.minimumRank = 3;
// @ts-expect-error Readonly requirement list.
requirement.prerequisites.push(prerequisite);
// @ts-expect-error Readonly requirement rank precondition.
requirement.expectedRank = 2;
// @ts-expect-error Readonly combined result.
result.ranks = ranks;
// @ts-expect-error Readonly combined pool.
result.points.spentPoints = 0;
// @ts-expect-error Readonly transition.
result.transition.projectedRank = 99;
// @ts-expect-error No Skill fields added to ProgressionState.
progression.ranks;
// @ts-expect-error Closed package, root imports only.
import {upgradeSkillRank as deep} from '@rpg/gameplay/modules/progression';
void rank; void outcome; void reason; void definite; void missing; void deep;
