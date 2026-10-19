export {
  validateModuleDefinition, createModuleRegistry, registerModule,
  getModule, listModules, configureModules, isModuleEnabled,
  resolveModuleDependencies, composeModules,
} from './foundation/modules/index.js';
export type {
  GameplayModuleDefinition, ModuleRegistry, ModuleSelection, ModuleConfiguration,
  ModuleComposition,
} from './foundation/modules/index.js';
