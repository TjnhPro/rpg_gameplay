import {
  createModuleRegistry, registerModule, configureModules, resolveModuleDependencies, composeModules,
  type GameplayModuleDefinition, type ModuleComposition,
} from '@rpg/gameplay';

const registry = registerModule(createModuleRegistry(), {id:'unit', optional:false, dependencies:[]});
const configuration = configureModules(registry);
const resolved: readonly string[] = resolveModuleDependencies(registry, configuration);
const composition: ModuleComposition = composeModules(registry, configuration);
const definitions: readonly GameplayModuleDefinition[] = composition.definitions;
// @ts-expect-error Resolved order is readonly.
resolved.push('injected');
// @ts-expect-error Composition IDs are readonly.
composition.moduleIds.reverse();
// @ts-expect-error Definitions are readonly.
composition.definitions[0]!.dependencies.push('injected');
// @ts-expect-error Configuration contract remains required.
resolveModuleDependencies(registry, {enable:['unit']});
// @ts-expect-error Enabled IDs must be strings.
composeModules(registry, {enabledModuleIds:[3]});
// @ts-expect-error No runtime instance or lifecycle is exposed.
composition.start();
void definitions;
