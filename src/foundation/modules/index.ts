/** A declaration only: no instance, lifecycle or dependency resolution. */
export interface GameplayModuleDefinition {
  readonly id: string;
  readonly optional: boolean;
  readonly dependencies: readonly string[];
}

/** Immutable explicit state. Create and extend using registry functions. */
export interface ModuleRegistry {
  readonly definitions: readonly GameplayModuleDefinition[];
}

export interface ModuleSelection {
  readonly enable?: readonly string[];
  readonly disable?: readonly string[];
}

/** Selection intent in registration order; does not indicate execution. */
export interface ModuleConfiguration {
  readonly enabledModuleIds: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireId(value: unknown): asserts value is string {
  // Same identity convention as the static architecture registry.
  if (typeof value !== 'string' || value !== value.trim() || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)) {
    throw new TypeError('Module ID must be lowercase kebab-case, starting with a letter');
  }
}

function readIds(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array of module IDs`);
  const ids: string[] = [];
  for (const id of value) {
    requireId(id);
    if (ids.includes(id)) throw new TypeError(`${label} contains duplicate ID '${id}'`);
    ids.push(id);
  }
  return Object.freeze(ids);
}

/** Validate untrusted data and return a detached, frozen definition; throws TypeError. */
export function validateModuleDefinition(value: unknown): GameplayModuleDefinition {
  if (!isRecord(value)) throw new TypeError('Module definition must be an object');
  const {id, optional} = value;
  requireId(id);
  if (typeof optional !== 'boolean') throw new TypeError('Module optional must be boolean');
  const dependencies = readIds(value.dependencies, 'dependencies');
  if (dependencies.includes(id)) throw new TypeError(`Module '${id}' cannot depend on itself`);
  return Object.freeze({id, optional, dependencies});
}

export function createModuleRegistry(): ModuleRegistry {
  return Object.freeze({definitions: Object.freeze([])});
}

/** Return a new registry; duplicate/invalid registration throws TypeError. */
export function registerModule(registry: ModuleRegistry, input: GameplayModuleDefinition): ModuleRegistry {
  const definition = validateModuleDefinition(input);
  if (getModule(registry, definition.id) !== undefined) {
    throw new TypeError(`Module '${definition.id}' is already registered`);
  }
  return Object.freeze({definitions: Object.freeze([...registry.definitions, definition])});
}

/** Exact lookup; an unknown ID returns undefined. */
export function getModule(registry: ModuleRegistry, id: string): GameplayModuleDefinition | undefined {
  return registry.definitions.find(definition => definition.id === id);
}

/** Frozen definitions in registration order. */
export function listModules(registry: ModuleRegistry): readonly GameplayModuleDefinition[] {
  return registry.definitions;
}

/** Required modules default on, optional modules default off. No graph validation. */
export function configureModules(registry: ModuleRegistry, selection: ModuleSelection = {}): ModuleConfiguration {
  if (!isRecord(selection)) throw new TypeError('Module selection must be an object');
  const enable = readIds(selection.enable === undefined ? [] : selection.enable, 'enable');
  const disable = readIds(selection.disable === undefined ? [] : selection.disable, 'disable');
  for (const id of [...enable, ...disable]) {
    if (getModule(registry, id) === undefined) throw new TypeError(`Unknown module '${id}'`);
  }
  for (const id of enable) {
    if (disable.includes(id)) throw new TypeError(`Module '${id}' cannot be both enabled and disabled`);
  }
  for (const id of disable) {
    if (getModule(registry, id)?.optional === false) throw new TypeError(`Required module '${id}' cannot be disabled`);
  }
  const enabledModuleIds = registry.definitions
    .filter(definition => !definition.optional || enable.includes(definition.id))
    .map(definition => definition.id);
  return Object.freeze({enabledModuleIds: Object.freeze(enabledModuleIds)});
}

/** Unknown/unselected IDs return false; no module is initialized or run. */
export function isModuleEnabled(configuration: ModuleConfiguration, id: string): boolean {
  return configuration.enabledModuleIds.includes(id);
}
