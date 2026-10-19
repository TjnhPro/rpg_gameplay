# Public API — v0.1.4 (GF01–GF13)

Import types/functions only from `@rpg/gameplay`. Native ESM; deep exports closed.
Canonical owners: `src/foundation/modules/index.ts` (GF01–GF05) and
`src/foundation/runtime/index.ts` (GF06–GF09), and
`src/foundation/messaging/index.ts` (GF10–GF13). No classes, Core numerical wrappers,
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
`EventPublishResult`. Combined root inventory: 22 functions, 26 types. No deep
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
clock/RNG, gameplay state, async bus, implicit dependencies or automatic events.
