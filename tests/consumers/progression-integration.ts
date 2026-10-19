import * as g from '@rpg/gameplay';

// Existing per-milestone strict consumers cover all 28 Progression types.
// This fixture proves cross-domain assignability through the installed root.
const entity: g.EntitySnapshot = g.createEntity({id: 'player-1', kind: 'player'});
const collection: g.EntityCollection = g.addEntity(g.createEntityCollection(), entity);
const start: g.ProgressionState = g.createProgressionState(entity, {level: 1, experience: 0});
const earned: g.ExperienceTransitionResult = g.gainExperience(start, 260);
const adjusted: g.ExperienceTransitionResult = g.adjustExperience(earned.state, {delta: -10});
const policy: g.LevelAdvancementPolicy = {experienceMode: 'cumulative', maxLevel: 100, targetLevel: 3,
  requirements: [{toLevel: 2, requiredExperience: 100, eligible: true}, {toLevel: 3, requiredExperience: 250, eligible: true}]};
const projection: g.LevelAdvancementAssessment = g.evaluateLevelAdvancement(earned.state, policy);
const level: g.LevelAdvancementResult = g.advanceProgressionLevel(earned.state, policy);
const initial = {unspentPoints: 0, spentPoints: 0, rewardedThroughLevel: 1};
const ap: g.AttributePointRewardResult = g.grantAttributePointRewards(g.createAttributePointState(start, initial), level,
  {pointsByLevel: {2: 5, 3: 5}});
const allocation: g.AttributePointAllocationResult = g.allocateAttributePoints(ap.state,
  g.createEntityAttributeState(entity, {strength: 20}), {attributeId: 'strength', pointCost: 3, newBaseValue: 23});
const config: g.EntityStatConfiguration = {attributeOrder: ['strength'], statOrder: ['power'],
  attributeRules: {strength: {default: 0, enabled: true, bounds: {}}}, attributeBaselines: {strength: 0},
  baseStats: {power: 5}, rules: {power: {default: 5, enabled: true, bounds: {}, training: 0,
    scaling: [{attribute: 'strength', coefficient: 2, enabled: true}]}}, flatContributions: {}, modifiers: []};
const stats: g.EntityStatSnapshot = g.calculateEntityStats(allocation.attributes, config);
const sp: g.SkillPointRewardResult = g.grantSkillPointRewards(g.createSkillPointState(start, initial), level,
  {pointsByLevel: {2: 1, 3: 2}});
const ranks = g.createSkillRankState(entity, {sword_basic: 2, sword_mastery: 0});
const requirement: g.SkillUpgradeRequirement = {skillId: 'sword_mastery', expectedRank: 0, maxRank: 5, pointCost: 2,
  requiredCharacterLevel: 3, prerequisites: [{skillId: 'sword_basic', minimumRank: 2}], eligible: true};
const assessment: g.SkillUpgradeAssessment = g.evaluateSkillUpgrade(level.state, ranks, sp.state, requirement);
const upgrade: g.SkillUpgradeResult = g.upgradeSkillRank(level.state, ranks, sp.state, requirement);
const rank: number | undefined = g.getSkillRank(upgrade.ranks, 'sword_mastery');
const registry = g.registerModule(g.registerModule(g.createModuleRegistry(),
  {id: 'entity', optional: true, dependencies: []}), {id: 'progression', optional: true, dependencies: ['entity']});
const composition = g.composeModules(registry, g.configureModules(registry, {enable: ['entity', 'progression']}));
const messaging = g.createGameplayMessaging(composition);
const published: g.EventPublishResult = g.publishEvent(messaging, {type: 'skill-rank-upgraded', payload: upgrade.transition});
// @ts-expect-error Combined cross-domain outputs remain readonly.
allocation.points.unspentPoints = 0;
// @ts-expect-error Effective stats remain a readonly numeric projection.
stats.stats.power = 0;
// @ts-expect-error Snapshot rank maps remain readonly.
upgrade.ranks.ranks.sword_mastery = 0;
// @ts-expect-error A combined upgrade result is not an advancement receipt.
g.grantSkillPointRewards(sp.state, upgrade, {pointsByLevel: {}});
// @ts-expect-error No integration facade is exposed.
g.runCharacterProgression();
// @ts-expect-error Root-only installed package exports.
import {advanceProgressionLevel as deep} from '@rpg/gameplay/dist/modules/progression/index.js';
void collection; void adjusted; void projection; void assessment; void rank; void published; void deep;
