export {
  validateModuleDefinition, createModuleRegistry, registerModule,
  getModule, listModules, configureModules, isModuleEnabled,
  resolveModuleDependencies, composeModules,
} from './foundation/modules/index.js';
export type {
  GameplayModuleDefinition, ModuleRegistry, ModuleSelection, ModuleConfiguration,
  ModuleComposition,
} from './foundation/modules/index.js';
export {
  createGameplayRuntime, initializeGameplayRuntime, startGameplayRuntime,
  stopGameplayRuntime, disposeGameplayRuntime, inspectGameplayRuntime,
} from './foundation/runtime/index.js';
export type {
  LifecycleStage, RuntimeStatus, LifecycleFailure, ModuleLifecycleSnapshot,
  GameplayRuntimeSnapshot, LifecycleContext, ModuleLifecycleBindings,
  LifecycleBindings, GameplayRuntime, LifecycleTransitionResult,
} from './foundation/runtime/index.js';
export {
  createGameplayMessaging, registerCommandHandler, dispatchCommand,
  subscribeEvent, publishEvent, unsubscribeEvent, unsubscribeModuleEvents,
} from './foundation/messaging/index.js';
export type {
  GameplayMessaging, GameplayCommand, CommandOutcome, CommandHandlerRegistration,
  CommandFailure, CommandResult, GameplayEvent, EventSubscription,
  EventSubscriptionRegistration, EventFailure, EventPublishResult,
} from './foundation/messaging/index.js';
export {
  createExecutionContext, readExecutionTime, nextExecutionRandom, nextExecutionId,
} from './foundation/execution/index.js';
export type {
  GameplayClock, GameplayRandom, GameplayIdProvider, GameplayExecutionDependencies,
  GameplayExecutionContext,
} from './foundation/execution/index.js';
export {
  createEntity, createEntityCollection, addEntity, getEntity, hasEntity,
  listEntities, removeEntity, replaceEntity,
  createEntityAttributeState, getEntityBaseAttributes, setEntityBaseAttribute, calculateEntityStats,
  createEntityResourceState, getEntityResourceCurrent, normalizeEntityResource,
  transitionEntityResource, regenerateEntityResource,
  createEntityLifeState, resolveEntityDefeat, reviveEntity,
} from './modules/entity/index.js';
export {createProgressionState, gainExperience, adjustExperience,
  evaluateLevelAdvancement, advanceProgressionLevel,
  createAttributePointState, grantAttributePointRewards, allocateAttributePoints,
  createSkillRankState, getSkillRank, createSkillPointState, grantSkillPointRewards,
  evaluateSkillUpgrade, upgradeSkillRank} from './modules/progression/index.js';
export type {ProgressionInitialState, ProgressionState, ExperienceAdjustment, ExperienceTransition, ExperienceTransitionResult,
  ExperienceMode, LevelRequirement, LevelAdvancementPolicy, LevelAdvancementBlockReason,
  LevelAdvancementAssessment, LevelAdvancementResult,
  EntityAttributePointState, AttributePointInitialState, AttributePointRewardPolicy,
  AttributePointRewardResult, AttributePointAllocation, AttributePointAllocationResult,
  EntitySkillRankState, SkillPointInitialState, EntitySkillPointState, SkillPointRewardPolicy,
  SkillPointRewardResult, SkillRankPrerequisite, SkillUpgradeRequirement, SkillUpgradeOutcome,
  SkillUpgradeBlockReason, SkillUpgradeAssessment, SkillUpgradeResult} from './modules/progression/index.js';
export type {
  EntityDefinition, EntitySnapshot, EntityCollection,
  EntityAttributeState, EntityStatConfiguration, EntityStatSnapshot,
  EntityResourceState, EntityResourceDefinition, EntityResourceBounds,
  EntityResourceTransitionInput, EntityResourceRegenerationInput,
  EntityResourceNormalizationResult, EntityResourceTransitionResult,
  EntityLifeStatus, EntityLifeState, EntityLifeResourcePolicy,
  EntityLifeTransitionOutcome, EntityLifeTransitionResult,
} from './modules/entity/index.js';
