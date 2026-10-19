# Public API — v0.1.2 (GF01–GF05)

Import types/functions only from `@rpg/gameplay`. Native ESM; deep exports closed.
Canonical owner: `src/foundation/modules/index.ts`. No classes, runtime, hooks,
Core numerical wrappers, persistence or global mutable state.

## Contracts

```ts
interface GameplayModuleDefinition {
  readonly id: string;
  readonly optional: boolean;
  readonly dependencies: readonly string[];
}
interface ModuleRegistry {
  readonly definitions: readonly GameplayModuleDefinition[];
}
interface ModuleSelection {
  readonly enable?: readonly string[];
  readonly disable?: readonly string[];
}
interface ModuleConfiguration {
  readonly enabledModuleIds: readonly string[];
}
interface ModuleComposition {
  readonly moduleIds: readonly string[];
  readonly definitions: readonly GameplayModuleDefinition[];
}
```

Registry/configuration types describe public readonly snapshots, not internal
maps or stores. Use the functions below to create state. Function-produced state,
its arrays and definitions are frozen at runtime; definitions and selections are
detached from caller inputs. Unchanged immutable definitions can be shared across
registry versions. No hidden shared mutable state. No optional metadata beyond
the required identity/optional/dependency fields is needed in this version.

## Functions

| Function | Result and failure semantics |
| --- | --- |
| `validateModuleDefinition(value: unknown)` | Returns a detached frozen `GameplayModuleDefinition`; rejects malformed input with `TypeError` |
| `createModuleRegistry()` | New empty `ModuleRegistry` |
| `registerModule(registry, definition)` | New registry containing a validated snapshot, appended in registration order; invalid or duplicate ID throws `TypeError`, original unchanged |
| `getModule(registry, id)` | Exact lookup, frozen definition or `undefined`; creates nothing |
| `listModules(registry)` | Frozen definitions in registration order |
| `configureModules(registry, selection = {})` | New frozen `ModuleConfiguration`; invalid selection throws `TypeError` |
| `isModuleEnabled(configuration, id)` | Boolean selection query; unknown or unselected ID returns `false` |
| `resolveModuleDependencies(registry, configuration)` | Frozen dependency-first selected IDs; invalid configuration/selected graph throws `TypeError` |
| `composeModules(registry, configuration)` | Frozen `ModuleComposition`; calls the canonical resolver and adds corresponding frozen definitions |

IDs follow the existing Harness lowercase kebab-case convention:
`[a-z][a-z0-9]*(?:-[a-z0-9]+)*`, with no whitespace or normalization. `optional`
must be boolean; `dependencies` must be an array of valid unique IDs excluding
self. Missing required fields are rejected. Unknown extra definition properties
are omitted from the canonical snapshot. Dependency registration, cycles and
graph validity are not checked during registration; the resolver checks the
selected graph (GF04).

Selection lists must contain valid registered unique IDs. Omitted lists are
empty; malformed lists, unknown IDs, overlap between enable/disable and disabling
a required module throw `TypeError` with a diagnostic message. Optional modules
default disabled; required modules default enabled. Enabling a required module
is permitted. Each configuration starts from these defaults; disabling an
optional module keeps it unselected. Configurations are independent snapshots,
not runtime toggles. `enabledModuleIds` always follows registry registration
order, regardless of input selection/dependency order. Registering more modules
does not change prior configurations.

Dependency declarations never auto-enable or execute modules. A selected module
may have unregistered or unselected dependencies in a configuration. Selection expresses
intent, not a runnable graph. No feature module is included by default.

The consumer registry is separate from `harness/modules.json`, which describes
static repository source ownership/dependencies and retains its existing checks.

## Dependency resolution and composition (GF04–GF05)

Pass a registry created by the public registry functions. Configuration must be
an object with an array of valid, unique, registered `enabledModuleIds`, including
all required modules. A configuration predating a newly registered required
module is rejected. Malformed IDs, unknown IDs and missing required modules
throw `TypeError`.

Only selected modules are traversed. Each dependency must be registered and
selected; errors identify the dependent and dependency. Selected cycles throw
`TypeError` with a cycle path. Unknown dependencies/cycles confined to disabled
modules are ignored. Empty valid selections produce empty results.

The resolver returns exactly the selected IDs once each, dependencies first.
At every step it chooses the earliest registered currently ready module,
including modules that have just become ready. Selection array order and
dependency declaration order do not set this priority. Inputs and configuration
registration order remain unchanged. No partial result escapes a failure.

Composition calls this resolver and returns `moduleIds` plus corresponding
`definitions` in the same order. Both arrays and the object are frozen; sharing
already frozen registry definitions is safe. Results are detached from mutable
configuration arrays and unaffected by later registrations/calls. No cache,
auto-enablement, initialization, hooks or execution occurs.
