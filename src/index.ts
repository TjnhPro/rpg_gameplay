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
