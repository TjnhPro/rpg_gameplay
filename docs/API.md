# Public API — v0.2.3 (GF01–GF16, EC01–EC13)

Import types/functions only from `@rpg/gameplay`. Native ESM; deep exports closed.
Canonical owners: `src/foundation/modules/index.ts` (GF01–GF05),
`src/foundation/runtime/index.ts` (GF06–GF09), and
`src/foundation/messaging/index.ts` (GF10–GF13) and
`src/foundation/execution/index.ts` (GF14–GF16). No classes, Core numerical wrappers,
persistence or global gameplay state. Module contracts below remain unchanged.

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

## Runtime context and lifecycle (GF06–GF09)

Additional public functions (root export only):

| Function | Result |
| --- | --- |
| `createGameplayRuntime(composition, lifecycleBindings = {})` | Opaque frozen `GameplayRuntime`, initially created; no hooks run |
| `initializeGameplayRuntime(runtime)` | `LifecycleTransitionResult`, dependencies first |
| `startGameplayRuntime(runtime)` | `LifecycleTransitionResult`, dependencies first |
| `stopGameplayRuntime(runtime)` | `LifecycleTransitionResult`, reverse order |
| `disposeGameplayRuntime(runtime)` | `LifecycleTransitionResult`, eligible initialized modules in reverse order |
| `inspectGameplayRuntime(runtime)` | Frozen `GameplayRuntimeSnapshot`, deterministic and without hooks |

New public types: `GameplayRuntime`, `RuntimeStatus`, `LifecycleStage`,
`LifecycleFailure`, `ModuleLifecycleSnapshot`, `GameplayRuntimeSnapshot`,
`LifecycleContext`, `ModuleLifecycleBindings`, `LifecycleBindings`,
`LifecycleTransitionResult`. Private helpers/execution data are not exported.

```ts
type RuntimeStatus = 'created' | 'initialized' | 'running' | 'stopped' | 'disposed' | 'failed';
type LifecycleStage = 'initialize' | 'start' | 'stop' | 'dispose';
interface LifecycleFailure {
  readonly moduleId: string;
  readonly stage: LifecycleStage;
  readonly message: string;
}
interface ModuleLifecycleSnapshot {
  readonly id: string;
  readonly status: RuntimeStatus;
  readonly completedStages: readonly LifecycleStage[];
  readonly failure?: LifecycleFailure;
}
interface GameplayRuntimeSnapshot {
  readonly status: RuntimeStatus;
  readonly moduleIds: readonly string[]; // selected and resolved order
  readonly modules: readonly ModuleLifecycleSnapshot[]; // same order
  readonly failure?: LifecycleFailure;
}
interface LifecycleContext {
  readonly moduleId: string;
  readonly stage: LifecycleStage;
  readonly runtime: GameplayRuntimeSnapshot; // immediately before current hook
}
type ModuleLifecycleBindings = Readonly<Partial<Record<LifecycleStage, (context: LifecycleContext) => void>>>;
type LifecycleBindings = Readonly<Record<string, ModuleLifecycleBindings>>;
type LifecycleTransitionResult =
  | { readonly ok: true; readonly runtime: GameplayRuntime }
  | { readonly ok: false; readonly runtime: GameplayRuntime; readonly failure: LifecycleFailure };
```

Creation accepts GF05 composition data and defensively snapshots it. Canonical
`validateModuleDefinition` checks each definition; IDs/definitions must match
exactly, have no duplicates, and every dependency must already precede its
dependent. A single ordered scan checks these invariants without producing a
new order, calling registration/selection or duplicating GF04 graph resolution.
Malformed compositions throw `TypeError`; no runtime or hooks are created.

Bindings are caller-provided own properties keyed only by selected IDs. Unknown
IDs/stages, malformed binding objects and non-function hooks reject. Explicit
undefined hooks are absent. Binding tables are detached/frozen; callbacks and
their captured external resources remain caller-owned. Hook context contains
only module ID, stage and frozen lifecycle inspection data, with no implicit
clock, RNG, game state or application services. Absent hooks still complete a
stage. Disabled modules cannot be bound, invoked or inspected as selected.

| Operation | Allowed input status | Successful output status |
| --- | --- | --- |
| initialize | created | initialized |
| start | initialized | running |
| stop | running | stopped |
| dispose | created, initialized, stopped, failed | disposed |

Dispose while running is rejected; stop first. Created disposal invokes no
cleanup hooks, leaving never-initialized module statuses created. Disposing
initialized state does not require start. Empty compositions follow all normal
transitions without default modules. Restart/reinitialize are unsupported.

Malformed/forged runtimes and illegal transitions throw `TypeError` before hooks.
Each runtime snapshot is an execution capability that advances once. Always use
`result.runtime` for the next operation; replaying a consumed snapshot (including
reentrant calls from its hook) rejects before invoking hooks. Its inspection
snapshot stays unchanged forever. A small per-snapshot closure guards execution;
its record is associated privately by identity, never stored on the public object.
JavaScript reflection exposes no internal bindings or execution mutators. There
is no global gameplay store or singleton. Concurrent independent runtimes share no
framework progress, even when created from the same composition.

Hooks must return undefined synchronously. A throw, Promise/thenable, or other
return value stops that transition immediately and returns `ok:false` with a new
failed runtime, immutable module/stage/message diagnostic, and completed progress.
Later modules in that transition are not invoked; initialize/start cannot resume.
A native Promise rejection is observed to avoid an unhandled rejection, but is
never awaited or accepted as success. Arbitrary thenables are not executed.
Async effects already started by caller code cannot be canceled by L2. The void
callback type follows TypeScript conventions; runtime return validation is still
mandatory because TypeScript allows value-returning callbacks in void positions.

Explicit dispose after failure visits only modules that successfully completed
initialize and have not completed dispose. It does not call stop implicitly or
claim rollback of external side effects. Cleanup failure also returns failed
progress. A subsequent explicit dispose can retry outstanding cleanup; completed
hooks are skipped. There is no automatic retry. Successful cleanup returns
disposed, retaining historical failure diagnostics; modules that never initialized
retain their created/failed state. Top-level failure is the latest diagnostic;
per-module failures preserve relevant history. A failed cleanup never reports
disposed success.

Inspection is immutable data only: overall status, selected/resolved IDs, module
statuses/completed stages and diagnostics. No callbacks, timestamps, runtime
services or gameplay state are exposed. Old snapshots and hook-context views
stay stable. Callers deliberately sharing mutable closure resources across
bindings retain responsibility for that sharing; lifecycle isolation does not
clone external objects or undo their side effects.

## Command and event coordination (GF10–GF13)

One opt-in `GameplayMessaging` per validated selected composition. Creation checks
exact unique ID/definition alignment and dependency-first input order using the
canonical Module definition validator; it neither selects nor resolves a graph.
Selected identities are detached from caller input. Only selected modules can
own handlers/subscriptions; no default registrations or services are supplied.

| Function | Result and semantics |
| --- | --- |
| `createGameplayMessaging(composition)` | Opaque frozen context; private per-context tables |
| `registerCommandHandler(messaging, {moduleId, commandType, handler})` | void; one handler/type, duplicate/invalid registration throws without overwriting |
| `dispatchCommand(messaging, {type, payload})` | Frozen `CommandResult`; exactly one matching handler, never auto-publishes |
| `subscribeEvent(messaging, {moduleId, eventType, handler})` | Opaque frozen `EventSubscription` token; registration order |
| `publishEvent(messaging, {type, payload})` | Frozen `EventPublishResult`; snapshot fan-out, fail-fast |
| `unsubscribeEvent(messaging, token)` | true if removed, false if already removed; forged/foreign token throws |
| `unsubscribeModuleEvents(messaging, moduleId)` | Count removed across all event types for that selected owner; repeat returns 0 |

Eleven public types: `GameplayMessaging`, `GameplayCommand`, `CommandOutcome`,
`CommandHandlerRegistration`, `CommandFailure`, `CommandResult`, `GameplayEvent`,
`EventSubscription`, `EventSubscriptionRegistration`, `EventFailure`,
`EventPublishResult`. Through GF13: 22 functions, 26 types. No deep
exports, raw tables, execution guards or private helpers.

```ts
interface GameplayCommand { readonly type: string; readonly payload: unknown; }
interface GameplayEvent { readonly type: string; readonly payload: unknown; }
type CommandOutcome =
  | { readonly status: 'success'; readonly value?: unknown }
  | { readonly status: 'rejected'; readonly reason: string };
interface CommandHandlerRegistration {
  readonly moduleId: string;
  readonly commandType: string;
  readonly handler: (command: GameplayCommand) => CommandOutcome;
}
interface CommandFailure {
  readonly commandType: string; readonly moduleId: string; readonly message: string;
}
type CommandResult =
  | { readonly status: 'success'; readonly commandType: string; readonly moduleId: string; readonly value?: unknown }
  | { readonly status: 'rejected'; readonly commandType: string; readonly moduleId: string; readonly reason: string }
  | { readonly status: 'unhandled'; readonly commandType: string }
  | { readonly status: 'failed'; readonly failure: CommandFailure };
interface EventSubscriptionRegistration {
  readonly moduleId: string;
  readonly eventType: string;
  readonly handler: (event: GameplayEvent) => void;
}
interface EventFailure {
  readonly eventType: string; readonly moduleId: string;
  readonly subscription: EventSubscription; readonly message: string;
}
type EventPublishResult =
  | { readonly ok: true; readonly eventType: string; readonly completedDeliveries: number }
  | { readonly ok: false; readonly eventType: string; readonly completedDeliveries: number; readonly failure: EventFailure };
```

Command/event types follow lowercase kebab-case `[a-z][a-z0-9]*(?:-[a-z0-9]+)*`;
no normalization or implied owner routing. An envelope must supply `payload`
(explicit undefined is valid). Malformed envelopes, owners, registrations,
capabilities and tokens throw `TypeError`. Unknown valid command returns unhandled;
zero event subscribers succeeds with 0 deliveries. Tables retain detached frozen
registration metadata and original callbacks; caller replacements do not rewire them.
Command registrations last for the context's lifetime; event cleanup does not
unregister commands or dispose the context.

Handlers return explicit success/value or rejected/nonempty reason. Foundation
does not decide business rejection reasons. Throw, malformed outcome or unsupported
async result produces failed with command type/owner/message. Event listeners
must return undefined; throw, Promise/thenable or non-void return stops fan-out,
reports the failing token/owner/type and only counts previously completed listeners.
No later listener, retry or side-effect rollback. Native Promise rejections are
observed without awaiting; arbitrary thenables are not executed. Callback work
already started cannot be canceled. TypeScript permits value-returning callbacks
in void positions, so listener return validation is enforced at runtime.

Each publish snapshots matching active subscriptions in registration order at
entry to fan-out. Subscribe/unsubscribe/owner cleanup during callbacks affect the
next publish; even a removed listener still runs in the current snapshot unless
an earlier failure stops it. New listeners never join that current iteration.
Same-context nested dispatch/publish throws before executing anything. If uncaught
inside the callback, it becomes the outer structured failure; a caller catching
it has observed the rejection and may return normally. Other contexts can execute
independently. The guard is always released after return/failure; no nested queue.

Envelope and result/diagnostic metadata are detached/frozen. Payloads and success
values are unknown business data passed by reference, never cloned, mutated or
deep-frozen by Foundation. A listener/caller can mutate its business objects;
later listeners see the same reference. Caller remains responsible for validation,
sharing and external effects. Frozen opaque tokens/context expose no internal
collections, callbacks or execution mutators through reflection.

Lifecycle integration is **explicit caller wiring**, for example:

```ts
const messaging = createGameplayMessaging(composition);
const runtime = createGameplayRuntime(composition, {
  unit: {
    initialize() {
      subscribeEvent(messaging, {moduleId: 'unit', eventType: 'notice', handler() {}});
    },
    stop() { unsubscribeModuleEvents(messaging, 'unit'); },
    dispose() { unsubscribeModuleEvents(messaging, 'unit'); },
  },
});
```

This does not change GF07 transitions or automatically gate messaging by Runtime
status. A context can dispatch/publish before start or after disposal if the caller
keeps registrations. Historical runtime inspection is not live authority. No
implicit clock/RNG, gameplay state, async bus, implicit dependencies or automatic events.

## GF14–GF16: execution dependencies and conditional determinism

Canonical owner: `src/foundation/execution/index.ts`, exported only through the
package root. This independent capability can be captured by existing lifecycle,
command or event callbacks; those APIs and their failure handling are unchanged.

```ts
interface GameplayClock { now(): number; }
interface GameplayRandom { next(): number; }
interface GameplayIdProvider { next(): string; }
interface GameplayExecutionDependencies {
  readonly clock: GameplayClock;
  readonly random?: GameplayRandom;
  readonly ids?: GameplayIdProvider;
}
// GameplayExecutionContext is opaque, obtained only by creation.
```

| Function | Contract |
| --- | --- |
| `createExecutionContext(dependencies): GameplayExecutionContext` | Requires a clock and validates supplied ports/methods without invoking them. Returns frozen opaque capability. |
| `readExecutionTime(context): number` | Calls captured clock once; finite nonnegative milliseconds relative to caller origin. Backward movement and fractional values allowed. |
| `nextExecutionRandom(context): number` | Calls captured RNG once; finite [0,1). Missing RNG throws. |
| `nextExecutionId(context): string` | Calls captured ID provider once; nonblank string returned unchanged, no Module ID format or uniqueness restriction. Missing provider throws. |

Dependencies/providers must be non-null non-array objects, with callable `now` or
`next`. Creation captures each original method and its receiver: later replacing
a slot/method does not rebind the capability. Provider mutable state stays with
the caller and remains observable through those captured methods. No provider is
cloned, mutated or frozen. Intentionally sharing one provider shares caller
state; separate providers remain isolated. Reflection cannot reach callbacks or
records, and copying brands/properties cannot forge a valid identity.

Malformed dependencies, missing optional ports on access, invalid outputs and
forged contexts throw TypeError. Provider-thrown values propagate by identity;
there is no retry, wrapping, sequence rollback, caching or implicit increment.
When called inside existing callbacks, those owners convert errors according to
their existing command/event/lifecycle contracts. No request reads another port.
Creation/inspection/registration/dispatch/publication never read providers unless
caller code explicitly does so. Ports are synchronous; Promise outputs are invalid.

GF16 guarantees reproducible **Foundation semantic observations** for equivalent
inputs, selected composition, registration/call order and starting provider and
callback states. It does not make arbitrary external side effects deterministic.
No hidden time/RNG/ID source, default implementation, seeded algorithm, scheduler,
global gameplay store, rollback, persistence or replay service exists. Metadata
has no implicit timestamps/IDs. Snapshot semantics of the other owners remain
unchanged. Text/2D/2.5D evidence covers opaque data compatibility only; it does not
implement coordinates, direction processing, movement, combat or rendering.

## EC01–EC03: Entity identity and creation

Canonical owner: `src/modules/entity/index.ts`. Root additions:

```ts
interface EntityDefinition {
  readonly id: string;
  readonly kind: string;
}
type EntitySnapshot = EntityDefinition;
function createEntity(definition: EntityDefinition): EntitySnapshot;
```

Current root inventory: 43 functions / 44 public types. Existing Foundation APIs
and root-only exports are preserved. Both fields must be nonblank strings, stored
unchanged including whitespace/case/punctuation and arbitrary caller-defined kind.
No enum, module-ID format, default, coercion or ID generation. Same ID represents
the same logical identity under consumer rules; independent snapshots may share
an ID. Object reference equality does not replace ID equality.

The runtime definition is closed: exactly two own data properties id/kind on a
non-null non-array object. Missing/inherited fields, accessors and extra string,
symbol or nonenumerable keys throw TypeError. Accessors are not invoked.
Null-prototype data objects are supported. TypeScript is structural: excess-field
checks apply to fresh literals; runtime validation also rejects extra properties
on structurally typed variables. No private validator is exported.

Creation returns a fresh detached frozen scalar snapshot; input remains mutable
and unfrozen. No deep-cloning machinery, writable record or global state. Invalid
input creates no partial successful entity or framework side effect. Identical
valid inputs yield equal semantic data with distinct snapshot references.

Static ownership declares entity optional with no dependencies. Consumers register,
enable, resolve and compose it through GF01–GF05 explicitly; default disabled,
no actor auto-creation. Selection is composition intent and does not gate direct
creation. The caller may explicitly call nextExecutionId before passing that ID;
Entity constructs no context and calls no providers, hooks, events or Kernel
calculation. Attributes/stats/resources use separate states below; life-state
and EC18 integration require later approved tasks.

## EC04–EC06: Entity collection and snapshot updates

Same canonical Entity owner and root-only package exports:

```ts
interface EntityCollection {
  readonly entities: readonly EntitySnapshot[];
}
function createEntityCollection(): EntityCollection;
function addEntity(collection: EntityCollection, entity: EntityDefinition): EntityCollection;
function getEntity(collection: EntityCollection, entityId: string): EntitySnapshot | undefined;
function hasEntity(collection: EntityCollection, entityId: string): boolean;
function listEntities(collection: EntityCollection): readonly EntitySnapshot[];
function removeEntity(collection: EntityCollection, entityId: string): EntityCollection;
function replaceEntity(collection: EntityCollection, entity: EntityDefinition): EntityCollection;
```

Creation returns a fresh frozen empty collection. Add appends a canonical EC03
validated detached entity; duplicate exact ID throws TypeError even if kind differs.
Uniqueness is collection-local. Lookup compares nonblank string IDs exactly,
without normalization: unknown valid IDs return undefined/false. Malformed IDs
throw TypeError. List returns frozen snapshots in insertion order, without sorting.
Remove requires an existing ID and preserves remaining relative order; unknown
or malformed IDs throw TypeError. Readding a removed ID appends it at the end.

Replace requires an existing exact ID and a complete valid id/kind definition;
it preserves the position and can change kind explicitly. No upsert, implicit
rename, arbitrary partial patch or automatic behavior change. Every successful
add/remove/replace returns a new frozen collection and frozen membership/entity
data. All previous versions and branching updates stay independent; invalid
operations leave them unchanged. Caller inputs are never frozen or mutated.

Collections are structural data, not opaque live handles. Runtime input must be
exactly an own entities data property holding a dense array of own data entries,
with no extra collection/array keys. Entries go through createEntity; duplicates,
malformed entries, holes, inherited fields and accessors throw TypeError without
invoking getters. Valid structural caller inputs are accepted but detached on
each operation, including lookup/list. Snapshot reference reuse is not promised.
Boundary validation/copying is linear in collection size; no performance or
collection-size limit is imposed. Ordinary Proxy traps remain caller code.

Collection operations have no backing mutable map, singleton, implicit clock/RNG/
ID, runtime, event/hook or Kernel calculation. Entity's optional registry entry
and dependencies and GF01–GF16 contracts remain unchanged.

## EC07–EC09: Attributes and Kernel stats

Root-only exports, owned by `src/modules/entity/index.ts`:

```ts
import type {PreparedStatCalculationInput, NumericalModifier} from '@rpg/core/kernel';
interface EntityAttributeState {
  readonly entityId: string;
  readonly baseAttributes: Readonly<Record<string, number>>;
}
type EntityStatConfiguration = Omit<PreparedStatCalculationInput, 'attributeBases'> & {
  readonly modifiers: readonly NumericalModifier[];
};
interface EntityStatSnapshot {
  readonly entityId: string;
  readonly effectiveAttributes: Readonly<Record<string, number>>;
  readonly stats: Readonly<Record<string, number>>;
}
function createEntityAttributeState(entity: EntitySnapshot, baseAttributes: Readonly<Record<string, number>>): EntityAttributeState;
function getEntityBaseAttributes(state: EntityAttributeState): Readonly<Record<string, number>>;
function setEntityBaseAttribute(state: EntityAttributeState, attributeId: string, value: number): EntityAttributeState;
function calculateEntityStats(state: EntityAttributeState, configuration: EntityStatConfiguration): EntityStatSnapshot;
```

State is separate from closed Entity/collection data, with exact entityId association.
Creation reuses createEntity validation. State reads/updates validate structural
own entityId/baseAttributes data and detach it. Records accept ordinary or null
prototypes; custom inherited records, symbols, accessors, arrays and callable data
are rejected. Attribute keys are exact nonblank strings, including constructor and
__proto__; finite negatives/fractions and empty maps are valid. No normalization,
clamping or schema defaults. Keyed update rejects unknown keys and preserves the
identity/other values in a new frozen state. No calculation is triggered.

```ts
import {createEntity, createEntityAttributeState, setEntityBaseAttribute, calculateEntityStats} from '@rpg/gameplay';
const attributes = createEntityAttributeState(createEntity({id: 'actor-1', kind: 'any'}), {strength: 10});
const configuration = {
  attributeOrder: ['strength'], statOrder: ['power'],
  attributeRules: {strength: {default: 0, enabled: true, bounds: {}}},
  attributeBaselines: {strength: 0}, baseStats: {power: 5},
  rules: {power: {default: 5, enabled: true, bounds: {}, training: 0,
    scaling: [{attribute: 'strength', coefficient: 2, enabled: true}]}},
  flatContributions: {}, modifiers: [],
};
calculateEntityStats(attributes, configuration).stats.power; // 25
calculateEntityStats(setEntityBaseAttribute(attributes, 'strength', 12), configuration).stats.power; // 29
```

Configuration is captured before Kernel/callback execution, without freezing or
mutating caller-owned rules, modifiers, arrays or callbacks. All required maps and
orders must be supplied explicitly, including empty modifiers. Order arrays must
be dense own data, with unique nonblank IDs. Attribute maps/base state must match
attributeOrder exactly; rules match statOrder exactly. Attribute/stat targets must
not collide. baseStats/flatContributions/transforms can omit ordered stat keys,
but cannot introduce unordered keys. Scaling references must name ordered
attributes, including disabled terms. Rule defaults, bounds, coefficients,
training, baselines, contributions and modifiers are finite; enabled is boolean.
Bounds are optional finite min/max with min <= max; optional precision requires
integer decimalPlaces 0–100, the Kernel's JS rounding domain. Explicit undefined,
unknown fields and incomplete rules are rejected, never silently filled.

Modifiers require own identity source/sourceInstanceId/id, ordered target,
enabled, finite value and one Kernel operation: add_flat, add_percent or
add_percentage_points. L2 validates/copies them; Kernel alone performs canonical
deduplication, conflict detection, aggregation and arithmetic. No-modifier calls
use the same resolver/stat path. Kernel owns attribute/stat order, baselines,
default stat bases, scaling, disabled rules, bounds and precision. training is
passed through, with no extra training arithmetic in L2.

Optional transforms are captured functions called by Kernel once per ordered
stat, including disabled rules. They must synchronously return a finite number;
invalid return types/nonfinite values throw TypeError, without coercion/repair.
Caller throws and Kernel errors propagate. Valid values are projected verbatim
from Kernel attributes/values into frozen detached numeric maps; mutable diagnostic
details/modifier references are not exposed. No arithmetic runs while projecting.

Recalculation explicitly calls calculateEntityStats again with new state/modifiers/
configuration. No live binding, cache, events, provider injection or automatic
resource synchronization. Old snapshots remain intact, even if caller inputs
later change. Collection removal/replacement neither deletes nor rewrites attribute
states; membership checks remain caller responsibility. Determinism requires equal
inputs/order and deterministic caller callbacks. Ordinary JS Proxy traps and
callback closure state remain caller code; no runtime/IO isolation is promised.

No generic arbitrary state bag, life state or future-milestone
placeholder is exposed.

## EC10–EC13: Resources and transitions

Same Entity owner and root-only exports. Kernel types are imported from
`@rpg/core/kernel`; public options compose them without resource/current overrides.

```ts
interface EntityResourceState {
  readonly entityId: string;
  readonly current: Readonly<Record<string, number>>;
}
type EntityResourceDefinition = Omit<ResourceNormalizationInput, 'resource'>;
type EntityResourceBounds = Omit<ResourceNormalizationInput, 'resource' | 'current'>;
type EntityResourceTransitionInput = Omit<ResourceTransitionInput, 'resource' | 'current'>;
type EntityResourceRegenerationInput = Omit<ResourceRegenerationInput, 'resource' | 'current'>;
interface EntityResourceNormalizationResult {
  readonly state: EntityResourceState;
  readonly calculation: Readonly<ResourceNormalizationResult>;
}
interface EntityResourceTransitionResult {
  readonly state: EntityResourceState;
  readonly transition: Readonly<ResourceTransitionResult>;
}
function createEntityResourceState(entity: EntitySnapshot, definitions: Readonly<Record<string, EntityResourceDefinition>>): EntityResourceState;
function getEntityResourceCurrent(state: EntityResourceState, resourceId: string): number | undefined;
function normalizeEntityResource(state: EntityResourceState, resourceId: string, bounds: EntityResourceBounds): EntityResourceNormalizationResult;
function transitionEntityResource(state: EntityResourceState, resourceId: string, options: EntityResourceTransitionInput): EntityResourceTransitionResult;
function regenerateEntityResource(state: EntityResourceState, resourceId: string, options: EntityResourceRegenerationInput): EntityResourceTransitionResult;
```

Creation validates Entity using EC03 and captures the entire definition map before
normalization. Definitions require finite minimum/maximum with minimum <= maximum;
optional current must be finite if present (explicit undefined is rejected).
Out-of-bounds normalization inputs are valid. Each value comes from Kernel
normalizeResource, including omitted-current initialization; L2 supplies no fallback.
Empty maps are valid. Resource IDs are exact nonblank strings, including whitespace,
case, constructor and __proto__, without a fixed vocabulary. The key set is fixed
at creation; mutation operations require an existing key. Valid unknown inspection
returns undefined and invokes no Kernel; malformed IDs throw TypeError.

Resource state is separate from Entity, collections, attributes and stats. Runtime
structural input must contain exactly own entityId/current data; numeric maps and
active configuration accept plain/null prototypes, own string data fields, no
accessors, symbols, custom inherited records, extras or coercion. State current
values must be finite. Old states and caller objects remain unchanged/unfrozen;
all returned state/maps/envelopes/diagnostics are detached and frozen. TypeError
rejects malformed inputs, and Kernel errors propagate without partial publication.
Proxy traps remain caller code; no IO isolation is promised.

Explicit normalization supplies finite ordered bounds and returns the authoritative
resource/before/after/initialized calculation. Maximum changes never trigger an
implicit update: current100 with new maximum80 becomes80 only on explicit request.
Increasing maximum never automatically refills current.

Transition requires operation increase/decrease, finite nonnegative amount, finite
ordered rule.minimum/maximum, current >= minimum, complete rule with
currentAboveMaximum allow/reject and boolean allowIncreaseFromMinimum. Kernel owns
above-maximum rejection/clamping, recovery and all arithmetic. Diagnostics preserve
resource/before/after/applied/reachedMinimum exactly: with current120/max100 and
allow, increase10 returns after100/applied-20; decrease10 returns after100/applied10.
Applied is not reconstructed from state delta. ReachedMinimum is not a life state.

Eligible regeneration requires finite ordered bounds, current within those bounds,
finite nonnegative ratePerSecond/elapsedSeconds and integer precision.decimalPlaces
0–100. Caller explicitly supplies eligibility and time; no hidden clock read or
precision/rate default. The entire active input is captured before Kernel execution.
With eligible=false, only state/ID, options shape/known keys and own boolean eligible
are checked: ignored bounds/rate/time/precision are never read, normalized or
validated, including accessors. Kernel receives its early no-op input and returns
unchanged current/applied0/reachedMinimum false even if current is outside new bounds.
The TypeScript signature still requires the complete canonical options contract.
No fabricated numeric defaults or retry are used in that no-op path.

Caller may pass an EC08 stat as maximum explicitly. Resource state stores no bound,
stat snapshot or live binding. No policy infers HP/death/revive, performs schema
updates, emits events, accesses Runtime/Messaging, or schedules automatic recovery.
Five functions/seven types added; root inventory: 43 functions/44 public types.
