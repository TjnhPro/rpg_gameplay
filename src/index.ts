export {inspectEffectStackGroups, evaluateEffectStackAdmission, applyEffectStack, refreshEffectStackLifetime,
  consumeEffectStacks, removeEffectStackGroup} from './modules/effect/index.js';
export type {EffectStackGroupKey, EffectStackGroupView, EffectStackPolicy, EffectStackAdmissionResult,
  EffectStackRejectionReason, EffectStackConsumeRequest, EffectStackConsumedEvent, EffectStackEvent,
  EffectStackMutationResult} from './modules/effect/index.js';
export {createEffectLifecycleState, startEffectLifetime, advanceEffectLifecycle, removeEffectLifetime} from './modules/effect/index.js';
export type {EffectDuration, EffectLifetimeState, EffectLifecycleState, EffectRemovalReason, EffectLifecycleEvent,
  EffectLifecycleStartResult, EffectLifecycleTransitionResult} from './modules/effect/index.js';
export {evaluateEffectApplyAdmission, applyEffect} from './modules/effect/index.js';
export type {EffectApplyRequest, EffectApplyPolicy, EffectApplyAdmissionStatus, EffectApplyAdmissionReason,
  EffectApplyAdmissionResult, EffectApplyResult} from './modules/effect/index.js';
export {createEffectDefinition, createEffectInstance, createEffectState, validateEffectState} from './modules/effect/index.js';
export type {EffectSourceReference, EffectDefinition, EffectInstanceInitialState, EffectInstanceState, EffectState} from './modules/effect/index.js';
export {createSkillDefinition, createSkillInstance, evaluateSkillActivationAdmission,
  evaluateSkillResourceCosts, applySkillResourceCosts, createSkillCooldownState,
  evaluateSkillCooldownReady, startSkillCooldown, activateSkill, reportSkillExecutionOutcome,
  createSkillLoadoutState, validateSkillLoadoutState, assignSkillLoadoutSlot,
  replaceSkillLoadoutSlot, removeSkillLoadoutSlot} from './modules/skill/index.js';
export type {SkillDefinition, SkillInstanceInitialState, SkillInstanceState,
  SkillRankAdmissionPolicy, SkillAdmissionPolicy, SkillAdmissionStatus,
  SkillAdmissionReason, SkillAdmissionResult, SkillResourceCost, SkillResourceCostBounds,
  SkillResourceCostRequest, SkillResourceCostStatus, SkillResourceCostRejectionReason,
  SkillResourceCostAssessment, SkillResourceCostApplicationResult, SkillCooldownState,
  SkillCooldownConfiguration, SkillCooldownStatus, SkillCooldownReason,
  SkillCooldownAssessment, SkillCooldownStartResult, SkillExecutionIntent, SkillExecutionPreflight,
  SkillActivationInput, SkillActivationRejectionReason, SkillActivationResult, SkillExecutionRequest,
  SkillExecutionStatus, SkillExecutionReport, SkillExecutionOutcome,
  SkillLoadoutLayout, SkillLoadoutSlot, SkillLoadoutState, SkillSlotAssignmentPolicy,
  SkillSlotRemovalPolicy, SkillLoadoutMutationOperation, SkillLoadoutMutationReason,
  SkillLoadoutMutationResult} from './modules/skill/index.js';
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
export {createCombatActionContext, evaluateCombatActionAdmission, evaluateCombatTargetValidation,
  resolveCombatAttack, applyCombatAttackDamage} from './modules/combat/index.js';
export type {CombatEntityTarget, CombatActionRequest, CombatActionContext,
  CombatActorEligibilityPolicy, CombatAdmissionStatus, CombatAdmissionReason, CombatAdmissionResult,
  CombatTargetRelation, CombatTargetPolicy, CombatTargetValidationStatus,
  CombatTargetRejectionReason, CombatTargetValidationResult,
  CombatAttackInput, CombatAttackOutcome, CombatAttackResolutionResult,
  CombatDamageApplicationPolicy, CombatDamageApplicationOutcome, CombatDamageApplicationResult} from './modules/combat/index.js';
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
