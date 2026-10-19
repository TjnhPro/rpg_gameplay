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
