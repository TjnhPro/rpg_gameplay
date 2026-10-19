import {
  validateModuleDefinition, createModuleRegistry, registerModule, getModule,
  listModules, configureModules, isModuleEnabled,
  type GameplayModuleDefinition, type ModuleRegistry,
  type ModuleSelection, type ModuleConfiguration,
} from '@rpg/gameplay';

const definition: GameplayModuleDefinition = {id:'unit', optional:true, dependencies:[]};
const registry: ModuleRegistry = registerModule(createModuleRegistry(), definition);
const selection: ModuleSelection = {enable:['unit']};
const configuration: ModuleConfiguration = configureModules(registry, selection);
const enabled: boolean = isModuleEnabled(configuration, 'unit');
const found: GameplayModuleDefinition | undefined = getModule(registry, 'unit');
const definitions: readonly GameplayModuleDefinition[] = listModules(registry);
const checked: GameplayModuleDefinition = validateModuleDefinition(JSON.parse('{}'));
// @ts-expect-error Required metadata cannot be omitted.
registerModule(registry, {id:'bad', dependencies:[]});
// @ts-expect-error Optional metadata must be boolean.
registerModule(registry, {id:'bad', optional:'true', dependencies:[]});
// @ts-expect-error Registered definitions are readonly.
definitions[0]!.optional = false;
// @ts-expect-error Dependency lists are readonly.
definition.dependencies.push('other');
// @ts-expect-error Registry data is readonly.
registry.definitions.push(definition);
// @ts-expect-error Configuration selection is readonly.
configuration.enabledModuleIds.push('other');
// @ts-expect-error Selection IDs must be strings.
configureModules(registry, {enable:[3]});
void enabled; void found; void checked;
