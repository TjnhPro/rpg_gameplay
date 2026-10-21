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
export {createEffectModifierState, applyEffectModifierTransition, listActiveEffectModifiers} from './modules/effect/index.js';
export type {EffectClassification, EffectModifierSpec, EffectModifierCapture, EffectModifierSnapshot,
  EffectModifierState, EffectModifierTransitionResult} from './modules/effect/index.js';
export {createEffectStatusState, applyEffectStatusTransition, listActiveEffectStatuses,
  listActiveEffectRestrictions, evaluateEffectRestrictionGate} from './modules/effect/index.js';
export type {EffectStatusCapture, EffectStatusSnapshot, EffectStatusState, EffectStatusView,
  EffectRestrictionView, EffectRestrictionPolicy, EffectRestrictionAssessment, EffectStatusTransitionResult} from './modules/effect/index.js';
export {createEffectPeriodicState, applyEffectPeriodicTransition, getNextDueEffectTick,
  completeEffectPeriodicTick} from './modules/effect/index.js';
export type {EffectPeriodicCapture, EffectPeriodicEntry, EffectPeriodicState, EffectPeriodicTickIntent,
  EffectPeriodicTickAssessment, EffectPeriodicTickEvent, EffectPeriodicCompletionResult,
  EffectPeriodicTransitionResult} from './modules/effect/index.js';
export {cleanupDefeatedTargetEffects} from './modules/effect/index.js';
export type {EffectTargetDefeatCleanupRequest, EffectTargetDefeatCleanupResult} from './modules/effect/index.js';
export {createActorAIProfileReference, createActorAIState, validateActorAIState,
  createActorAIDecisionContext, createActorAIActionIntent, validateActorAIDecisionResult} from './modules/actor-ai/index.js';
export type {ActorAIProfileReference, ActorAIControllerMode, ActorAIInitialState, ActorAIState,
  ActorAIDecisionContext, ActorAIActionIntent, ActorAIDecisionResult} from './modules/actor-ai/index.js';
export {createActorAIPerceptionSnapshot, validateActorAIPerceptionSnapshot, evaluateActorAIPerception} from './modules/actor-ai/index.js';
export type {ActorAIPerceivedEntity, ActorAIPerceptionSnapshot, ActorAIPerceptionPolicy,
  ActorAIPerceptionExclusionReason, ActorAIPerceptionExclusion, ActorAIPerceptionAssessment} from './modules/actor-ai/index.js';
export {evaluateActorAITargetSelection} from './modules/actor-ai/index.js';
export type {ActorAITargetSelectionPolicy, ActorAITargetLossReason, ActorAITargetSelectionResult} from './modules/actor-ai/index.js';
export {createActorAIBehaviorPolicy, createActorAIBehaviorObservation, evaluateActorAIBehaviorTransition} from './modules/actor-ai/index.js';
export type {ActorAIBehaviorTargetRequirement, ActorAIBehaviorRule, ActorAIBehaviorPolicy,
  ActorAIBehaviorObservation, ActorAIBehaviorTransitionResult} from './modules/actor-ai/index.js';
export {createActorAIActionSelectionPolicy, createActorAIActionObservation, evaluateActorAIActionSelection} from './modules/actor-ai/index.js';
export type {ActorAIActionKind, ActorAIActionTargetMode, ActorAIActionRule, ActorAIActionSelectionPolicy,
  ActorAIActionAvailability, ActorAIActionObservation, ActorAIActionRuleRejectionReason,
  ActorAIActionRuleRejection, ActorAIActionSelectionResult} from './modules/actor-ai/index.js';

export {validateActorAIActionExecutionFeedback} from './modules/actor-ai/index.js';
export type {ActorAIActionExecutionFeedback} from './modules/actor-ai/index.js';

export {evaluateActorAILifeGate, evaluateActorAIReset, createActorAIDecisionTimingState,
  evaluateActorAIDecisionTiming} from './modules/actor-ai/index.js';
export type {ActorAILifeGateResult, ActorAIResetReason, ActorAIResetRequest, ActorAIResetResult,
  ActorAIDecisionTimingState, ActorAIDecisionTimingPolicy, ActorAIDecisionTimingResult} from './modules/actor-ai/index.js';

export {createEncounterDefinitionReference, createEncounterSide, createEncounterParticipant,
  createEncounterState, validateEncounterState} from './modules/encounter/index.js';
export type {EncounterDefinitionReference, EncounterSide, EncounterParticipant, EncounterStatus,
  EncounterInitialState, EncounterState} from './modules/encounter/index.js';

export {createEncounterActivationPolicy, createEncounterActivationObservation,
  evaluateEncounterActivationAdmission, activateEncounter} from './modules/encounter/index.js';
export type {EncounterParticipantActivationFact, EncounterActivationObservation, EncounterActivationPolicy,
  EncounterActivationRejectionReason, EncounterActivationAdmissionResult, EncounterActivationTransitionResult} from './modules/encounter/index.js';

export {createEncounterMembershipPolicy, createEncounterMembershipRequest, getEncounterParticipant,
  evaluateEncounterMembershipAdmission, applyEncounterMembershipChange} from './modules/encounter/index.js';
export type {EncounterMembershipOperation, EncounterMembershipOpenStatus, EncounterMembershipPolicy,
  EncounterMembershipRequest, EncounterMembershipRejectionReason, EncounterMembershipAdmissionResult,
  EncounterMembershipTransitionResult} from './modules/encounter/index.js';

export {createEncounterActionScopePolicy, createEncounterActionScopeRequest,
  evaluateEncounterActionScope} from './modules/encounter/index.js';
export type {EncounterActionTargetMode, EncounterSideMembershipRelation, EncounterActionScopePolicy,
  EncounterActionScopeRequest, EncounterActionScopeRejectionReason, EncounterActionScopeResult} from './modules/encounter/index.js';

export {createEncounterCompletionPolicy, createEncounterCompletionObservation,
  evaluateEncounterCompletion} from './modules/encounter/index.js';
export type {EncounterParticipantLifeFact, EncounterObjectiveStatus, EncounterObjectiveFact,
  EncounterContinuation, EncounterCompletionObservation, EncounterVictoryOutcomeTemplate, EncounterDrawOutcomeTemplate,
  EncounterOutcomeTemplate, EncounterCompletionRule, EncounterCompletionPolicy, EncounterResolutionOutcome,
  EncounterCompletionPendingReason, EncounterCompletionAssessment} from './modules/encounter/index.js';

export {createEncounterClosurePolicy, resolveEncounter, closeEncounter, cancelEncounter,
  createEncounterCleanupHandoff} from './modules/encounter/index.js';
export type {EncounterResolutionTransitionResult, EncounterDispositionRecord, EncounterCloseTransitionResult,
  EncounterClosurePolicy, EncounterCancellationRequest, EncounterCancellationTransitionResult,
  EncounterCleanupHandoff} from './modules/encounter/index.js';

export {createItemDefinitionReference, createItemInstanceReference, validateItemInstanceReference,
  createItemDefinition, validateItemDefinition, createItemInstance, validateItemInstance} from './modules/item/index.js';
export type {ItemDefinitionReference, ItemInstanceInitialIdentity, ItemInstanceReference, ItemPropertyValue,
  ItemDefinitionContent, ItemDefinition, ItemInstanceInitialState, ItemInstanceState} from './modules/item/index.js';

export {getItemInstanceProperty, setItemInstanceProperty, replaceItemInstanceProperties} from './modules/item/index.js';
export type {ItemPropertyReadResult, ItemPropertyOperationAdmission, ItemPropertyOperationResult} from './modules/item/index.js';

export {validateItemStackPolicy, assessItemStackCompatibility} from './modules/item/index.js';
export type {ItemStackPolicy, ItemStackCompatibilityResult} from './modules/item/index.js';

export {createInventoryState, validateInventoryState} from './modules/inventory/index.js';
export type {InventoryOwnerReference, InventoryEntry, InventoryState, InventoryItemContext,
  InventoryValidationContext, InventoryTransitionResult} from './modules/inventory/index.js';
export {getInventoryEntry, listInventoryEntries, hasInventoryItem, assessInventoryCapacity} from './modules/inventory/index.js';
export type {InventoryCapacityPolicy, InventoryCapacityAssessment} from './modules/inventory/index.js';
export {addInventoryEntry, removeInventoryEntry, adjustInventoryQuantity} from './modules/inventory/index.js';
export type {InventoryOperationAdmission, InventoryMutationReason} from './modules/inventory/index.js';
