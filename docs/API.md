# Public API — v0.5.1 (GF01–GF16, EC01–EC18, PG01–PG19, CB01–CB30, SK01–SK10)

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

Current root inventory: 46 functions / 49 public types. Existing Foundation APIs
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
calculation. Attributes/stats/resources/life use separate states below;
EC18 integration uses these unchanged public APIs; see the final section below.

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

Attributes/stats expose no generic arbitrary state bag or future-milestone placeholder.

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
EC10–EC13 added five functions/seven types; current inventory including EC14–EC17
is 46 functions/49 public types.

## EC14–EC17: Life State & Death

Root-only exports, same canonical Entity owner:

```ts
type EntityLifeStatus = 'alive' | 'dead';
interface EntityLifeState {
  readonly entityId: string;
  readonly status: EntityLifeStatus;
}
interface EntityLifeResourcePolicy extends EntityResourceBounds {
  readonly resourceId: string;
}
type EntityLifeTransitionOutcome = 'defeated' | 'revived' | 'unchanged';
interface EntityLifeTransitionResult {
  readonly entityId: string;
  readonly before: EntityLifeStatus;
  readonly after: EntityLifeStatus;
  readonly outcome: EntityLifeTransitionOutcome;
  readonly state: EntityLifeState;
}
function createEntityLifeState(entity: EntitySnapshot, options: {readonly status: EntityLifeStatus}): EntityLifeState;
function resolveEntityDefeat(life: EntityLifeState, resources: EntityResourceState, policy: EntityLifeResourcePolicy): EntityLifeTransitionResult;
function reviveEntity(life: EntityLifeState, resources: EntityResourceState, policy: EntityLifeResourcePolicy): EntityLifeTransitionResult;
```

Creation reuses EC03, requires explicit status and neither reads resources nor
infers status from kind. Life state is independent from identity, membership,
attributes, stats and resources. Any actor kind may opt in; no status default,
coercion, provider, runtime, ID generation, numerical call or implicit event.

Life/state/options/policy boundaries require closed own string data fields on
plain/null-prototype records, without getters, symbols, extras or inherited
records. Status is exactly alive/dead; IDs remain exact nonblank strings.
Resource validation reuses the full EC10 boundary, including all finite current
entries. Life/resource entityId must match exactly; selected own resource key
must exist. Bounds are finite and ordered, including negative/nonzero minima.
All inputs validate before any no-op. Malformed/inconsistent inputs throw
TypeError, produce no successful result and mutate no caller data.

| Operation | Valid current | Life before | Result |
| --- | --- | --- | --- |
| Defeat | current == minimum | alive | dead / defeated |
| Defeat | current > minimum (including above maximum) | alive | alive / unchanged |
| Defeat | current >= minimum | dead | dead / unchanged |
| Revival | minimum < current <= maximum | dead | alive / revived |
| Revival | minimum <= current <= maximum | alive | alive / unchanged |

Current below minimum rejects for both operations. Revival above maximum always
rejects; dead at minimum also rejects. Zero-width bounds cannot revive dead life.
Alive at minimum may remain unchanged under revival evaluation pending explicit
defeat. Defeat accepts stale above-max resources without normalizing them; caller
can explicitly normalize through EC11. Life operations never change resource
values or duplicate Kernel arithmetic. EC12 reachedMinimum is only a diagnostic;
resource recovery and revival are separate operations, without joint atomicity.

Every result (including unchanged) and nested state is freshly detached/frozen.
Results contain only scalar diagnostics and the life snapshot, no resource alias,
callback, binding or event history. Old snapshots remain valid; replaying the same
old inputs can repeat the same transition. Sequential callers retain the newest
snapshot to obtain unchanged on repeats. There is no global authority/replay guard.

Caller may publish a changed result via GF12 using caller-defined event names and
payloads. Entity neither registers listeners nor publishes events. GF13 preserves
subscription order/snapshot fan-out/fail-fast delivery, without a queue. A listener
failure after transition does not roll back the life result or retry publication.
No resource synchronization, respawn or kill/reward/loot policy is added.

## EC18: integration evidence, no additional public API

`tests/consumers/entity-integration.mjs` runs the root-only installed package.
Caller configuration yields max-life 25, explicit attribute update yields 29,
and explicit flat modifier yields 32. Caller selects maximum 25, normalizes
health 30 to 25, decreases to 20 then 0, resolves defeat, explicitly regenerates
to 10 and revives. GF10/GF12 command/event publication and lifecycle cleanup are
explicit caller wiring. Two isolated sessions match the independent literal
trace; invalid association/revival/transition and listener failure preserve
previous immutable state. Public inventory remains 46 functions / 49 types.
No transaction, store, scheduler or implicit state synchronization is provided.
See [phase evidence](reports/v0.2.5-entity-integration-closure.md).
Three functions/five types added; current root inventory: 46 functions/49 types.

## PG01–PG03 Progression Foundation

Canonical owner: `src/modules/progression/index.ts`. Root-only exports add one
function and two types (47 functions / 51 public types total).

```ts
interface ProgressionInitialState {
  readonly level: number;
  readonly experience: number;
}
interface ProgressionState {
  readonly entityId: string;
  readonly level: number;
  readonly experience: number;
}
function createProgressionState(
  entity: EntitySnapshot,
  initialState: ProgressionInitialState,
): ProgressionState;
```

Entity input passes canonical createEntity validation; exact id/kind strings are
preserved without normalization. Initial input must have exactly own data fields
level/experience. Null, arrays, wrong types, missing/extra fields (including symbol
and nonenumerable extras), inherited required fields and accessors throw TypeError
without invoking getters. Null-prototype data input is valid. Level is a positive
safe integer, including MAX_SAFE_INTEGER; no game cap. EXP is finite nonnegative,
including fractions and -0, preserved exactly as a JavaScript number. No coercion,
clamping, defaults or relation between level and EXP is inferred. Creation alone
does not select EXP semantics; advancement requires explicit mode policy.

The result is a fresh frozen three-scalar object. Caller input/Entity is untouched;
independent snapshots can share an Entity ID. No collection membership or authority
is checked/updated, including after Entity removal. Existing attribute/resource/
life snapshots remain independent. No clock/RNG/Kernel call, event or hook occurs.
Progression is optional: explicit registry definitions and selection of both entity
and progression compose dependency-first. Missing selected Entity fails using the
existing resolver. Creation itself requires no registry/runtime. No transitions,
EXP curves/caps, points/ranks or extra state bags are exposed at v0.3.0.

## PG04–PG06 recorded Experience transitions

Same canonical Progression owner. Additive root exports: gainExperience and
adjustExperience; three readonly types. v0.3.1 inventory: 49 functions/54 types.
No redundant EXP getter: read ProgressionState.experience.

```ts
interface ExperienceAdjustment {
  readonly delta: number;
  readonly maximumExperience?: number;
}
interface ExperienceTransition {
  readonly entityId: string;
  readonly before: number;
  readonly after: number;
  readonly requestedDelta: number;
  readonly appliedDelta: number;
  readonly limited: boolean;
}
interface ExperienceTransitionResult {
  readonly state: ProgressionState;
  readonly transition: ExperienceTransition;
}
function adjustExperience(state: ProgressionState,
  adjustment: ExperienceAdjustment): ExperienceTransitionResult;
function gainExperience(state: ProgressionState, amount: number,
  policy?: Omit<ExperienceAdjustment, 'delta'>): ExperienceTransitionResult;
```

Both validate a closed own-data entityId/level/experience state on every call,
including no-ops. Identity is a nonblank string preserved exactly; PG03 level/EXP
numeric validation is shared unchanged. Structural data need not be pre-frozen or
created by this package. Required inherited/accessor fields and any own unknown
string/symbol/nonenumerable field reject without calling getters. Null-prototype
data remains valid. Adjustment has exactly delta and optional maximumExperience;
gain policy allows only maximumExperience. Inherited optional maximum rejects.
An own maximum with value undefined is invalid; omit the property instead.

Delta must be finite; gain additionally requires nonnegative amount, including 0.
Optional maximum must be finite/nonnegative and at least current EXP, even if the
requested change would reduce EXP. Invalid inputs and uncapped nonfinite results
throw TypeError before returning anything; caller objects stay unchanged.
One canonical update adds delta using JavaScript number semantics, floors below 0
and caps above explicit maximum. A finite valid cap also handles intermediate
positive overflow. No implicit MAX_SAFE_INTEGER bound or decimal/precision policy.

Result, next state and diagnostic are frozen detached objects. entityId/level stay
unchanged; maximum is not stored. appliedDelta is exactly after-before, signed;
limited means floor/cap clipped the requested sum. Reaching a bound exactly or a
zero-delta no-op is not limited. Native number rounding alone does not set limited:
for example 1e20+1 remains 1e20, appliedDelta 0, limited false. No automatic advancement,
EXP representation conversion, event, provider read or Entity-domain update.
EXP remains a recorded scalar, not implicitly cumulative or level-local.

## PG07–PG10 explicit Level & Advancement

Root adds two functions and six readonly types (51 functions/60 types total):

```ts
type ExperienceMode = 'cumulative' | 'level-local';
interface LevelRequirement {
  readonly toLevel: number;
  readonly requiredExperience: number;
  readonly eligible: boolean;
}
interface LevelAdvancementPolicy {
  readonly experienceMode: ExperienceMode;
  readonly maxLevel: number;
  readonly targetLevel: number;
  readonly requirements: readonly LevelRequirement[];
}
type LevelAdvancementBlockReason = 'none' | 'target_reached' | 'max_level'
  | 'insufficient_experience' | 'condition_not_met';
interface LevelAdvancementAssessment {
  readonly entityId: string;
  readonly beforeLevel: number;
  readonly projectedLevel: number;
  readonly targetLevel: number;
  readonly beforeExperience: number;
  readonly projectedExperience: number;
  readonly levelsGained: number;
  readonly experienceConsumed: number;
  readonly advancedLevels: readonly number[];
  readonly blockedAtLevel?: number;
  readonly reason: LevelAdvancementBlockReason;
}
interface LevelAdvancementResult {
  readonly state: ProgressionState;
  readonly transition: LevelAdvancementAssessment;
}
function evaluateLevelAdvancement(state: ProgressionState,
  policy: LevelAdvancementPolicy): LevelAdvancementAssessment;
function advanceProgressionLevel(state: ProgressionState,
  policy: LevelAdvancementPolicy): LevelAdvancementResult;
```

Both use the same private resolver once per call. All state fields use existing
PG02/PG06 closed own-data validation. Mode/max/target/requirements are mandatory
own data; unknown string/symbol/nonenumerable properties, missing/inherited fields
and accessors reject with TypeError without evaluating getters. Null-prototype
records remain valid. All levels are positive safe integers and must satisfy
current <= target <= max. No level-down or implicit default.

Requirements must be a dense own-data array, without extras, with exactly one
closed requirement per step current+1 through target in that order. No duplicate,
missing, skipped, extra or reordered step; no sparse/accessor entry. requiredExperience
is finite nonnegative (fractions and zero allowed); eligible is boolean, never a
callback. Cumulative thresholds must be nondecreasing. Local costs may decrease.
The entire policy/list validates before evaluation, including no-op, at-max and
requests with an early blocker. Malformed input rejects the whole operation.

Cumulative compares recorded EXP against absolute thresholds and retains EXP.
Level-local compares remaining EXP to each cost then subtracts only successful
costs. Eligibility false wins over insufficient EXP. A blocker stops at that step
without skipping, preserving the successful prefix in the returned state.
maxLevel never caps EXP. The target ends this call even if more EXP remains.

Reason none means all requested steps completed (also when reaching max in this
call). target_reached means target was already current; max_level takes precedence
when current was already max. Blockers give condition_not_met or
insufficient_experience and include blockedAtLevel; otherwise that property is
absent. levelsGained = projectedLevel-beforeLevel; experienceConsumed =
beforeExperience-projectedExperience, reflecting native JavaScript arithmetic.
No epsilon/rounding/decimal policy. Invalid results reject rather than returning
partial data; ordinary blocker results are valid partial advancements.

Result, nested state, assessment and detached advancedLevels array are frozen.
Evaluate is semantically equal to advance.transition for equivalent inputs.
Exact entityId survives; caller state/policy/requirements and all other domains
remain untouched. No callbacks, time/RNG, events, auto rewards or stored mode/cap.
Caller maintains consistent EXP mode throughout a lifecycle; no mode conversion.
PG05/PG06 retain their independent behavior, including unchanged level after gain
or EXP loss. PG11–PG19 remain outside this checkpoint.

## PG11–PG13 Attribute Points

Root adds three functions and six readonly types (54 functions/66 types total):

```ts
createAttributePointState(state: ProgressionState, initial: AttributePointInitialState): EntityAttributePointState;
grantAttributePointRewards(points: EntityAttributePointState, advancement: LevelAdvancementResult, policy: AttributePointRewardPolicy): AttributePointRewardResult;
allocateAttributePoints(points: EntityAttributePointState, attributes: EntityAttributeState, allocation: AttributePointAllocation): AttributePointAllocationResult;
```

- `AttributePointInitialState`: explicit `unspentPoints`, `spentPoints`,
  `rewardedThroughLevel`. Balances and their sum are nonnegative safe integers;
  cursor is a positive safe integer <= initial progression level.
- `EntityAttributePointState`: initial fields plus exact `entityId` and required
  readonly `pointKind: 'attribute'`. Separate from
  ProgressionState. All creation/transition results are frozen detached snapshots.
- `AttributePointRewardPolicy`: `pointsByLevel: Readonly<Record<number, number>>`,
  plain/null-prototype own-data map with exactly canonical completed-level keys.
  No missing/extra keys, aliases, getters, negative/fractional/unsafe values.
- `AttributePointRewardResult`: `{state, transition}`. Transition has `entityId`,
  frozen `rewardedLevels`, `pointsGranted`, `beforeUnspent`, `afterUnspent`.
- `AttributePointAllocation`: closed `{attributeId, pointCost, newBaseValue}`.
  Cost positive safe integer within available balance; existing exact attribute
  key; finite strictly increased value. No point-to-attribute conversion formula.
- `AttributePointAllocationResult`: `{points, attributes, transition}`. Transition
  has `entityId`, `attributeId`, `beforeValue`, `afterValue`, `pointsSpent`,
  `beforeUnspent`, `afterUnspent`. Canonical Entity setter owns attribute updates.

Reward input is the actual PG09 result, structurally validated for identity,
state/diagnostic consistency, contiguous completed levels, consumption and blocker.
Cursor must equal `beforeLevel`; only completed levels receive caller rewards.
Zero rewards advance cursor; no-level receipts preserve cursor and balances.
Updated cursor rejects repeated successful receipts. Stale snapshots can branch;
structural receipts do not authenticate provenance. No global exactly-once ledger.
Allocation builds both snapshots atomically in memory, not a database transaction.
Caller owns economics/restrictions, joint persistence, events and explicit stat
recalculation. No EXP/level/resource changes, respec or Skill Point/Rank system.

## PG14–PG18 Skill Progression

Root adds six functions and eleven readonly types (60 functions/77 types total):

```ts
createSkillRankState(entity: EntitySnapshot, ranks: Readonly<Record<string, number>>): EntitySkillRankState;
getSkillRank(state: EntitySkillRankState, skillId: string): number | undefined;
createSkillPointState(state: ProgressionState, initial: SkillPointInitialState): EntitySkillPointState;
grantSkillPointRewards(points: EntitySkillPointState, advancement: LevelAdvancementResult, policy: SkillPointRewardPolicy): SkillPointRewardResult;
evaluateSkillUpgrade(progression: ProgressionState, ranks: EntitySkillRankState, points: EntitySkillPointState, requirement: SkillUpgradeRequirement): SkillUpgradeAssessment;
upgradeSkillRank(progression: ProgressionState, ranks: EntitySkillRankState, points: EntitySkillPointState, requirement: SkillUpgradeRequirement): SkillUpgradeResult;
```

- `EntitySkillRankState`: `{entityId, ranks: Readonly<Record<string, number>>}`.
  Empty map allowed; nonblank exact own string keys and nonnegative safe integer
  ranks. Rank0 means registered/unlearned; unknown keys stay unknown. No catalog
  registration/removal during upgrade. Ordinary/null-prototype data maps only,
  no getters/symbol keys/inherited ranks; `__proto__` is safe own data.
- `SkillPointInitialState`: required `unspentPoints`, `spentPoints`,
  `rewardedThroughLevel`. `EntitySkillPointState` adds exact `entityId` and required
  readonly `pointKind: 'skill'`. Balances
  and total nonnegative safe integers; cursor positive safe integer <= supplied
  level at creation. Independent pool/cursor from Attribute Points.
- `SkillPointRewardPolicy`: `{pointsByLevel: Readonly<Record<number, number>>}`.
  Same complete actual-PG09 receipt consistency and exact completed-level reward
  map rules as PG12. Partial rewards cover completed prefix only; zero advances
  cursor; no-level preserves balances/cursor. Updated cursor rejects replay.
- `SkillPointRewardResult`: `{state, transition}`; transition has `entityId`,
  `rewardedLevels`, `pointsGranted`, `beforeUnspent`, `afterUnspent`.
- `SkillRankPrerequisite`: closed `{skillId, minimumRank}`. Exact registered
  nonblank ID, positive safe minimum; no duplicates or self-reference.
- `SkillUpgradeRequirement`: closed `{skillId, expectedRank, maxRank, pointCost,
  requiredCharacterLevel, prerequisites, eligible}`. Target must exist. Expected
  rank is nonnegative safe and must equal actual; cap positive safe and >= actual.
  Cost nonnegative safe (explicit0 valid); required level positive safe; boolean
  eligibility only; complete dense own-data prerequisite list.
- `SkillUpgradeOutcome`: `'upgraded' | 'blocked'`.
- `SkillUpgradeBlockReason`: `'none' | 'max_rank' | 'character_level_too_low' |
  'prerequisite_not_met' | 'condition_not_met' | 'insufficient_points'`.
- `SkillUpgradeAssessment`: `{entityId, skillId, beforeRank, projectedRank,
  beforeUnspent, projectedUnspent, pointsSpent, outcome, reason}`.
- `SkillUpgradeResult`: `{ranks, points, transition: SkillUpgradeAssessment}`.

Three state identities must match. Complete validation precedes blockers; invalid
policy/state, unknown prerequisite, rank above cap or stale expectedRank throws
TypeError. Valid blockers use priority max rank -> character level -> prerequisites
-> eligibility -> points. Blocked result preserves rank/point values with zero
spending; success increments only target by one and transfers exact cost from
unspent to spent. Other ranks, cursor, level/EXP/Attributes/Resources stay intact.
Evaluate equals actual transition by semantic deep equality, using one resolver.
All results/nested maps/lists frozen and detached, including blocked results;
caller inputs untouched. latest snapshots required for cursor/expectedRank guards.
Stale snapshots can branch; structural discriminants separate domains but do not
authenticate data or receipt provenance. Caller jointly stores next snapshots; no persistent transaction
or global exactly-once guarantee. No Skill execution/effects/catalog, respec,
automatic reward/event/level change, time/RNG or generic prerequisite graph.


## PG19 installed integration (no new API)

The root remains exactly 60 runtime functions / 77 public types, including the
14 Progression functions / 28 types above. No integration facade or deep export.
Existing strict consumers cover every Progression declaration; the additional
progression-integration.ts proves cross-domain result assignability, readonly
outputs, actual receipt requirements and closed root-only package exports.
Caller sequences PG01-PG18 with Entity and opt-in GF10-GF13. Actual level results
can feed both reward operations independently. Allocation returns points and
attributes together; upgrade returns ranks and points together. Caller applies
both next snapshots, recalculates stats and publishes events explicitly.
Updated cursors/expectedRank reject sequential replay; old immutable snapshots
can branch. Structural receipts/pool types do not authenticate provenance/domain.
No persistent exactly-once, global transaction, lock, automatic rewards/events,
EXP mode conversion or Skill execution. Phase REVIEW_PENDING; acceptance PENDING.

## F-001: Point Pool type isolation (pre-merge v0.3.5 correction)

Attribute and Skill Point snapshots now require own data `pointKind` with the
exact literal `attribute` and `skill`, respectively. Initial inputs remain the
closed three-field balances/cursor records; factories attach the kind and reject
caller-supplied initial pointKind. Both reward APIs, Attribute Allocation and
Skill Evaluation/Upgrade validate the expected kind selected by their own code
path before granting/spending or evaluating valid gameplay blockers. Missing,
unknown, wrong-case, inherited/accessor kinds and extra state fields throw
TypeError; getters are not invoked. All next states preserve their exact kind.

TypeScript rejects cross-pool arguments/assignments and untagged snapshots. Public
returns stay precise, not unions; no added public function/type export. The only
approved snapshot delta is pointKind; numeric balances/cursors/results unchanged.
Consumers constructing/exact-matching snapshots must include it. Untagged legacy
objects are rejected with no inference, normalization or migration. pointKind is
a structural domain discriminator, not authentication/provenance or an exactly-once
authority; stale immutable snapshots can still branch. Package stays0.3.5.

## CB01–CB05 Combat Foundation

Canonical owner: `src/modules/combat/index.ts`. One new runtime function and three
readonly types, exported only through the package root. Current root inventory:
61 functions / 80 public types; accepted Group A exports remain unchanged.

```ts
interface CombatEntityTarget {
  readonly kind: 'entity';
  readonly entityId: string;
}
interface CombatActionRequest {
  readonly actionId: string;
  readonly actionType: string;
  readonly sourceEntityId: string;
  readonly target: CombatEntityTarget;
}
type CombatActionContext = CombatActionRequest;
function createCombatActionContext(request: CombatActionRequest): CombatActionContext;
```

The factory synchronously validates exactly four own data fields and exactly two
own target data fields. All IDs and actionType must be primitive nonblank strings;
trim checks blankness only, preserving the original string including whitespace
and case. Target kind must be exactly `entity`. Null, arrays, functions, missing,
unknown (including nonenumerable/symbol), inherited required fields and accessors
throw TypeError without invoking getters or returning a partial snapshot. Plain
and null-prototype own-data records are supported using existing boundary semantics.
No coercion, defaults, ID generation or fake Entity validation.

Each call returns a fresh frozen root with a fresh frozen target. Original inputs
stay mutable and detached. Equal requests produce semantically equal independent
snapshots; duplicate actionId is permitted. Source/target are opaque references:
self-target, swapped actor roles and unknown references are accepted. No collection
lookup, supported-action catalog, trusted receipt, admission or execution is implied.

Static module combat is optional and declares only entity. Consumer module
registration/selection is explicit; combat alone fails dependency resolution without
auto-enabling Entity. Progression remains independently selectable with Entity.
The factory requires neither runtime registration nor Entity objects, Foundation
execution providers or Kernel calls. No event, domain-state mutation, persistent
session, numerical operation, Skill integration or game-mode/time/spatial policy.

## CB06–CB10 Combat Action Admission

Same Combat owner; one new root function and four types. At the v0.4.1 checkpoint:
62 runtime functions /84 public types. CB01–CB05 contracts remain unchanged.

```ts
interface CombatActorEligibilityPolicy { readonly eligible: boolean; }
type CombatAdmissionStatus = 'admitted' | 'rejected';
type CombatAdmissionReason = 'none' | 'source_not_found' | 'source_dead' | 'source_ineligible';
interface CombatAdmissionResult {
  readonly context: CombatActionContext;
  readonly status: CombatAdmissionStatus;
  readonly reason: CombatAdmissionReason;
}
function evaluateCombatActionAdmission(
  context: CombatActionContext, entities: EntityCollection,
  sourceLife: EntityLifeState, policy: CombatActorEligibilityPolicy,
): CombatAdmissionResult;
```

Synchronous pure evaluation: canonical createCombatActionContext validates and
captures context; public Entity getEntity validates collection/looks up only
source; Life must have exactly own data entityId/status, nonblank exact ID and
alive/dead; source ID must match; policy must have exactly own boolean eligible.
All validation completes before gameplay rejection. Missing/invalid records,
extra/symbol/inherited/accessor fields, invalid life status, mismatched IDs,
missing boolean or callback policy throw TypeError without invoking getters.
Plain/null-prototype records retain accepted own-data semantics. No default Life
or eligible, coercion, HP inference or implicit policy evaluation.

| Valid inputs | status | reason |
| --- | --- | --- |
| Source absent (even dead/ineligible) | rejected | source_not_found |
| Source present, dead (even ineligible) | rejected | source_dead |
| Source present/alive, eligible false | rejected | source_ineligible |
| Source present/alive, eligible true | admitted | none |

Every result and its context/target are freshly detached/frozen, including rejected
results. Original inputs remain untouched. Player/Monster/custom actor kinds share
semantics. Unknown target and self-target are actor-stage admissible; no target
lookup/relations/life/range or supported-action catalog is evaluated. Admitted does
not mean executed or fully authorized. No state writes/events/time/RNG/ID allocation,
resource/death/numerical operations or persistent reservation. Caller provides
current authoritative state; stale snapshots can be evaluated again and results
supply no concurrency or transaction authority. No additional function/deep export.

## CB11–CB15 Combat Target Validation

Package0.4.2 adds one root function and five types (63 functions/89 types total).

```ts
type CombatTargetRelation = 'self' | 'ally' | 'enemy' | 'neutral';
interface CombatTargetPolicy {
  readonly relation: CombatTargetRelation;
  readonly allowedRelations: readonly CombatTargetRelation[];
  readonly allowedLifeStatuses: readonly EntityLifeStatus[];
}
type CombatTargetValidationStatus = 'accepted' | 'rejected';
type CombatTargetRejectionReason = 'none' | 'target_not_found'
  | 'relation_not_allowed' | 'target_life_not_allowed';
interface CombatTargetValidationResult {
  readonly context: CombatActionContext;
  readonly targetEntityId: string;
  readonly relation: CombatTargetRelation;
  readonly targetLifeStatus: EntityLifeStatus;
  readonly status: CombatTargetValidationStatus;
  readonly reason: CombatTargetRejectionReason;
}
function evaluateCombatTargetValidation(
  admission: CombatAdmissionResult, entities: EntityCollection,
  targetLife: EntityLifeState, policy: CombatTargetPolicy,
): CombatTargetValidationResult;
```

Admission must be exactly own data context/status/reason with admitted/none;
rejected or malformed receipts throw TypeError before target inputs are evaluated.
The nested context uses the canonical factory. This validates structure only, not
receipt provenance, freshness or authority. Source life/eligibility is never rerun.

Target lookup uses public getEntity. Life requires own data entityId/status,
alive/dead and exact target ID even if target is absent. Policy requires exactly
own data relation/allowedRelations/allowedLifeStatuses, exact literals and nonempty
dense arrays of unique own data entries without extra/symbol/accessor fields.
Missing/inherited required fields, unknown literals, duplicates, holes, accessors,
wrong identities or same-ID/non-self and different-ID/self inconsistencies throw
TypeError without calling getters. No coercion/defaults/callbacks. Own-data plain
and null-prototype records follow the existing Combat contract.

All validation precedes selection: missing target -> rejected/target_not_found;
otherwise disallowed relation -> rejected/relation_not_allowed; otherwise
disallowed life -> rejected/target_life_not_allowed; otherwise accepted/none.
Ally/enemy/neutral truth belongs to caller. Dead is valid if explicitly allowed;
no HP inference/revival. Original inputs stay untouched/unfrozen; result and its
fresh context/target are frozen/detached. No mutable policy aliases survive.
No attack/range/Skill check, numerical call, execution token, state mutation,
global relationship/target store, event or time/RNG. Caller supplies current
snapshots and sequences stages; structural accepted results are replayable data.

## CB16–CB20 Combat Attack Resolution

Package0.4.3 adds one root function and three types (64 functions/92 types total).

```ts
function resolveCombatAttack(
  admission: CombatAdmissionResult,
  targetValidation: CombatTargetValidationResult,
  attackInput: CombatAttackInput,
  executionContext: GameplayExecutionContext,
): CombatAttackResolutionResult;
type CombatAttackOutcome = 'dodged' | 'landed';
```

CombatAttackInput composes public Kernel types, with no callbacks/RNG in numerical
data: hit requires dodgeChance/eligible/rule; critical requires chance/bonus/
eligible/rule. damage requires base/rank/perRank, explicit ordered scaling entries
{source,value,coefficient}, flat {definition,additional,resolved} and explicit
already-effective ResolvedDamageBonus[] bonuses (id/source/eligible/reason/value/
contributions). mitigation requires ruleKey/rating/rule; optional sourceLevel and
targetLevel follow Kernel. Rule requires enabled/bounds/levelScalingEnabled;
baseK/levelPenalty can be omitted while disabled. Enabled mitigation requires
positive baseK and nonnegative levelPenalty, plus levels when scaling is enabled.

All records are closed own-data; arrays are dense own-data without extra fields.
Finite numeric fields, positive safe-integer rank, nonblank IDs, unique scaling
source IDs and finite non-inverted bounds are mandatory. No defaults/coercion or
inherited/accessor fields; explicit undefined is invalid. All stage/numerical
validation precedes RNG. Receipts require admitted/none and accepted/none, exact
actionId/actionType/sourceEntityId/target.kind/target.entityId agreement and
targetEntityId/self-relation/Life consistency. They are structural, not fresh or
authenticated authority. Admission/existence/policies are never rerun.

Hit -> Critical -> B0 -> B1 -> Mitigation delegates actual public Kernel calls.
Lazy Foundation nextExecutionRandom supplies rolls: zero/disabled/ineligible
dodge draws0; enabled eligible critical draws1 even at chance0. Dodge draws at
most1, never Critical. Invalid/missing/throwing RNG propagates without retries or
rollback. Already-effective bonus eligibility is not resolved again. Actual
critical.bonus is added once in B1; multiplier is diagnostic only. Missing enabled
mitigation config and nonfinite Kernel diagnostics throw TypeError.

Result is a deeply frozen detached discriminated union. Both outcomes include
context, outcome, actual hit diagnostics and finalDamage. dodged has finalDamage0
and no critical/b0/b1/mitigation properties. landed includes actual critical, b0
(including ordered scaling), b1 and mitigation (including missing diagnostics);
finalDamage is mitigation.finalDamage. Disabled mitigation preserves status and
missing fields. Original inputs/Kernel results are never frozen or mutated.
No HP/Life writes, automatic events, clock access, global store, Skill/Effect
execution or supported-action catalog. Caller explicitly invokes resolution and
owns current state, numerical snapshots and execution dependencies.

## CB21–CB25 Combat Damage Application

Package0.4.4 adds one root function and three types (65 functions/95 types total).

```ts
interface CombatDamageApplicationPolicy extends EntityLifeResourcePolicy {
  readonly currentAboveMaximum: EntityResourceTransitionInput['rule']['currentAboveMaximum'];
}
type CombatDamageApplicationOutcome = 'dodged' | 'zero_damage' | 'processed';
function applyCombatAttackDamage(
  attack: CombatAttackResolutionResult, resources: EntityResourceState,
  life: EntityLifeState, policy: CombatDamageApplicationPolicy,
): CombatDamageApplicationResult;
```

Policy requires resourceId/minimum/maximum/currentAboveMaximum with no default
health key, rounding, minimum damage or multiplier. Attack is the complete actual
CB20 dodged/landed shape with finite nonnegative finalDamage, canonical context,
closed own-data records/dense arrays and valid nested diagnostics. Redundant
hit/outcome, Critical/B1 and B1/mitigation/finalDamage links must agree. Numerical
stages are never recalculated. Validation is structural, not receipt authentication.

Exact target IDs must match Resource/Life IDs. Canonical Entity resource read
validates every map entry; Life schema/prototype/identity and explicit finite
ordered policy bounds/resource selection validate before no-op. Unknown IDs,
current below minimum, getters, inherited required/unknown fields, malformed
states/receipts/policy throw TypeError without invoking getters. Positive damage
with above-max reject propagates the canonical Entity/Core error.

CombatDamageApplicationResult is a readonly discriminated union. Both variants
include detached frozen context and calculatedDamage/appliedDamage. dodged or
zero_damage has both damage fields0 and resourceResult/lifeResult:null; caller
keeps its current snapshots. These paths do not transition, normalize above-max
resources or evaluate defeat, even at minimum. Above-max behavior applies only
when an actual positive resource transition runs.

processed contains exact EntityResourceTransitionResult and EntityLifeTransitionResult.
One transitionEntityResource decrease uses finalDamage, selected bounds/above-max
and allowIncreaseFromMinimum:false. One resolveEntityDefeat uses its UPDATED
resource state and the same resourceId/minimum/maximum. appliedDamage is exactly
transition.applied, never HP delta (140->100/request20 gives applied20/delta40).
Positive damage at minimum is processed even if applied0; alive may be defeated,
while already dead remains unchanged. Life outcome, not reachedMinimum/final dead
status alone, identifies a new defeat. All nested canonical results are frozen;
caller originals remain untouched/unfrozen, without mutable aliases.

No damage recalculation, blanket dead-target ban, automatic events/rewards,
Skill/Effect/Encounter feature, healing/revival, ledger or global state. Caller
owns trusted/current snapshots, authorization, durable writes, replay/exactly-once
and concurrent consistency. A receipt can be reused on independent state branches.

## CB26–CB30 installed composition (v0.4.5)

No public API/type additions or signature changes:65 root functions/95 types.
Root-only exports remain closed. Caller creates contexts, evaluates admission and
target, explicitly stops on rejection, resolves through Kernel with Foundation RNG,
then calls applyCombatAttackDamage. For processed outcomes, retain both
resourceResult.state and lifeResult.state together for the next attempt; no-op
outcomes retain caller states. resourceResult/lifeResult are canonical Entity
results, not Combat-specific state. Strict external combat-integration.ts verifies
this continuation, discriminated nulls, readonly snapshots and absence of facades.

The same calculated75 can apply75 to HP100, then25 to HP25. Caller must not infer
applied magnitude from HP delta (above-max140->100/request20 still applied20).
Structural receipts are not authenticated/fresh authorization. Reusing old state
branches again; no persistent exactly-once, transaction or concurrency authority.
No Skill/Effect/AI/Encounter integration is provided. See closure report.

## SK01–SK05 Skill Foundation (v0.5.0)

Two additive root functions and three readonly types: 67 runtime functions and
98 exported types total. No existing signatures or package export paths change.

```ts
interface SkillDefinition { readonly skillId: string; }
interface SkillInstanceInitialState { readonly instanceId: string; }
interface SkillInstanceState {
  readonly instanceId: string;
  readonly skillId: string;
  readonly entityId: string;
}
function createSkillDefinition(definition: SkillDefinition): SkillDefinition;
function createSkillInstance(definition: SkillDefinition, entity: EntitySnapshot,
  initial: SkillInstanceInitialState): SkillInstanceState;
```

Both factories capture detached frozen data. Skill/instance IDs are nonblank,
case-sensitive strings preserved exactly, without trimming, normalization or
generation. Definition and initial records contain exactly one own data property;
unknown/non-enumerable extra fields, symbols, getters, inherited required fields,
null/arrays and malformed IDs throw TypeError without invoking getters. Entity
validation delegates to public createEntity. The instance stores no definition or
Entity object reference; callers may supply structurally valid records directly.

Same skillId may bind multiple actors or instances. Repeated instanceId inputs
are structurally valid: uniqueness, idempotency, membership and authorization are
caller-owned. Creation does not imply learned/unlocked/equipped/available/alive,
admitted or activated. No rank/resources/cooldown/execution fields or lifecycle
operations are present. L3 explicitly projects rich content to {skillId}.

Static optional skill -> entity requires explicit selection of both. Progression
and Combat remain independent siblings. No implicit runtime, events, providers,
Core calculation or registry/catalog is created. All Skill deep imports stay closed.

## SK06–SK10 Skill Availability & Admission (v0.5.1)

One added root function and five types; current total **68 functions/103 types**.
SK01–SK05 schemas and all previous signatures remain unchanged. Deep exports closed.

```ts
type SkillRankAdmissionPolicy =
  | {readonly mode: 'not_required'}
  | {readonly mode: 'required'; readonly currentRank: number | null; readonly minimumRank: number};
interface SkillAdmissionPolicy {
  readonly owned: boolean;
  readonly eligible: boolean;
  readonly rank: SkillRankAdmissionPolicy;
}
type SkillAdmissionStatus = 'admitted' | 'rejected';
type SkillAdmissionReason = 'none' | 'actor_not_found' | 'actor_dead' | 'skill_not_owned'
  | 'skill_rank_unregistered' | 'skill_rank_too_low' | 'actor_ineligible';
interface SkillAdmissionResult {
  readonly instanceId: string;
  readonly skillId: string;
  readonly actorEntityId: string;
  readonly status: SkillAdmissionStatus;
  readonly reason: SkillAdmissionReason;
}
function evaluateSkillActivationAdmission(definition: SkillDefinition,
  instance: SkillInstanceState, actorEntityId: string, entities: EntityCollection,
  actorLife: EntityLifeState, policy: SkillAdmissionPolicy): SkillAdmissionResult;
```

Closed own-data records are mandatory: missing/unknown/nonenumerable extra/symbol/
accessor fields, inherited required fields, malformed identities, life status,
policy booleans or rank configuration throw TypeError without invoking getters.
Life snapshots follow Entity's ordinary/null prototype contract. IDs remain exact.
Definition/instance skill mismatch or life/actor mismatch throws TypeError even
when actor lookup misses. Instance/actor mismatch is valid skill_not_owned.
Entity lookup delegates to getEntity, including full collection validation.

Required ranks: currentRank is null for unregistered, otherwise a nonnegative safe
integer (0 is registered/unlearned); minimumRank is a positive safe integer.
No coercion/default/undefined fallback. Rankless policy has only mode and requires
no Progression. Caller reads canonical getSkillRank for the correct Entity/Skill
and explicitly maps undefined to null; Skill neither authenticates freshness/
provenance nor imports Progression. L3 owns rank requirements and both booleans;
owned:true cannot override exact actor binding. No Entity kind policy is inferred.

Every supplied contract validates before choosing this fixed rejection priority:
actor_not_found > actor_dead > skill_not_owned > skill_rank_unregistered >
skill_rank_too_low > actor_ineligible > none. Only none is admitted; all others
are ordinary structured rejections. Results contain exactly the five fields
shown, detached/frozen scalar data. Caller inputs remain unchanged/unfrozen.

Admitted means Skill-stage availability at evaluation only. It does not establish
resource sufficiency, cooldown readiness, target/Combat admission, activation,
execution or committed state. Assessment is not an authorization token/execution
receipt. No spending, scheduling, event, ID, Clock/RNG, rank/Life mutation, cache
or global store occurs. L4 supplies authoritative current snapshots and coordinates
later checks/persistence/concurrency. Optional skill -> entity remains unchanged;
Combat stays independent. v0.5.2+ mechanisms remain unimplemented.
