# RPG Gameplay — v0.2.0 Entity Foundation checkpoint

> **Status: GF01–GF16 baseline accepted; EC01–EC03 checkpoint implemented. Phase v0.2.x IN_PROGRESS; acceptance PENDING final v0.2.5 review.**
> Private native ESM/strict TypeScript package with installed-package contract
> verification and pinned Core Kernel integration. Module declarations, immutable
> registry, selection, dependency resolution, composition and synchronous lifecycle
> coordination, explicit command routing, synchronous event pub/sub and injected
> clock/RNG/ID execution dependencies are available.
> **Entity identity/classification is the first optional gameplay module; no collection, stats, resources, life state or game loop.**

## Mục tiêu

Phát triển thư viện **headless, function-first, reusable RPG gameplay** dùng cho Text RPG, RPG 2D, RPG 2.5D (và mở rộng turn-based khi cần), không xây một game ứng dụng trong repo này.

- L1: `@rpg/core/kernel` — tính toán numerical canonical.
- L2: `rpg_gameplay` — reusable, optional gameplay capabilities; ownership rõ; không duplicate Kernel.
- L3: game rules/content/builder — cấu hình và nội dung riêng từng game.
- L4: game application — UI, render, networking, persistence adapters.

## Khởi tạo

Clone this repository. Development/CI uses npm **12.2.0** and compatible Node
(22.22.2+, or 24.15+); library runtime requires Node >=22.13.0. Git and network
access to GitHub/npm are required to reconstruct the pinned Core artifact.

```sh
npm install --global npm@12.2.0
npm run core:prepare
npm ci --ignore-scripts
npm run verify
```

`core:prepare` builds/packs the exact revision in [Core pin](harness/core-pin.json)
into ignored `.artifacts/`, checks its SHA-512 against the lockfile, and never
changes a Developer Core checkout. Run it before `npm ci` in a fresh checkout.

`npm run build` emits `dist/index.js` and `dist/index.d.ts`. `npm run typecheck`
checks strict NodeNext source; `npm run test:functional` requires a preceding
build and tests installed package contracts/Kernel integration plus gate failures.
`npm run verify` runs boundaries, self-tests, build, typecheck and these contracts,
including GF01–GF16 and EC01–EC03 through an installed-package consumer. Text/2D/2.5D probes
prove Foundation data-shape compatibility; gameplay profile behavior is NOT_EVALUATED.

## Entity identity and classification

```ts
import {createEntity} from '@rpg/gameplay';
const player = createEntity({id: 'player-1', kind: 'player'});
const monster = createEntity({id: 'monster-1', kind: 'monster'});
const npc = createEntity({id: 'npc-1', kind: 'npc'});
```

One function supports arbitrary nonblank kinds/IDs preserved exactly. Definitions
contain exactly own data fields id/kind; extras, accessors and inherited fields
throw TypeError. Snapshots are detached/frozen; input stays caller-owned.
Independent snapshots can share an ID; collection uniqueness is deferred to EC04.
Module ID entity is distinct from actor identity. Explicit GF01–GF05 registration/
selection/composition creates no actor and does not gate direct createEntity calls.
See [API](docs/API.md), [checkpoint report](docs/reports/v0.2.0-entity-foundation.md)
and [single-PR phase workflow](docs/TASK_EXECUTION.md).

## External package consumption (local artifacts, no publication)

`npm pack --pack-destination .artifacts` builds a private gameplay tarball. In an
independent ESM project, install **both** that tarball and the prepared Core tarball
using paths appropriate to that project:

```sh
npm install /path/to/rpg-gameplay-0.2.0.tgz /path/to/rpg-core-2.0.0.tgz
```

Core is an exact `2.0.0` peer so the package contains no machine-local dependency
path. Use the pinned artifact, not an assumed registry package. The repository's
dev dependency/lockfile pins the local artifact for development and CI. The
consumer is responsible for supplying that same Core artifact. Only import
`@rpg/gameplay` and `@rpg/core/kernel`; gameplay deep exports are closed. No game
execution API is available. [Core integration](docs/CORE_INTEGRATION.md) explains the pin.

## Module declarations and selection

```ts
import {createModuleRegistry, registerModule, configureModules, isModuleEnabled, composeModules} from '@rpg/gameplay';

const original = createModuleRegistry();
const registry = registerModule(original, {
  id: 'optional-capability', optional: true, dependencies: [],
});
const defaults = configureModules(registry); // optional is disabled
const selected = configureModules(registry, {enable: ['optional-capability']});
isModuleEnabled(selected, 'optional-capability'); // true; nothing is executed
const composition = composeModules(registry, selected);
// composition.moduleIds: ['optional-capability']; frozen definitions in the same order
```

Each call returns frozen explicit state; `original` and `defaults` stay unchanged.
Required modules default enabled and cannot be disabled. Unknown, duplicate or
conflicting selections throw `TypeError`. Dependencies are stored declarations;
registration/selection do not check the graph. Resolution/composition validate
selected dependencies and cycles, then order dependencies first with earliest
registration priority among currently ready modules at each step. They never
auto-enable or initialize modules; configuration order stays unchanged.
See [public API](docs/API.md) for types, validation, errors and ownership.

## Runtime context and lifecycle

```ts
import {
  createGameplayRuntime, initializeGameplayRuntime, startGameplayRuntime,
  stopGameplayRuntime, disposeGameplayRuntime, inspectGameplayRuntime,
} from '@rpg/gameplay';

let runtime = createGameplayRuntime(composition, {
  'optional-capability': {initialize: context => { void context.moduleId; }},
}); // No hooks run during creation.
for (const transition of [initializeGameplayRuntime, startGameplayRuntime,
  stopGameplayRuntime, disposeGameplayRuntime]) {
  const result = transition(runtime);
  runtime = result.runtime;
  if (!result.ok) break; // Inspect failure/progress; explicitly dispose if needed.
}
inspectGameplayRuntime(runtime); // Frozen lifecycle data; no hooks or services.
```

Use each returned runtime for the next operation. Previous snapshots remain
inspectable but cannot advance twice. Hook errors return `ok:false` with the
failed runtime and module/stage diagnostic. Initialize/start follow composition
order; stop/dispose reverse it. See [API](docs/API.md) for transitions, cleanup,
composition validation and synchronous callback limits.

## Commands and events

```ts
import {
  createGameplayMessaging, registerCommandHandler, dispatchCommand,
  subscribeEvent, publishEvent, unsubscribeModuleEvents,
} from '@rpg/gameplay';

const messaging = createGameplayMessaging(composition);
registerCommandHandler(messaging, {
  moduleId: 'optional-capability', commandType: 'request',
  handler: command => ({status: 'success', value: command.payload}),
});
dispatchCommand(messaging, {type: 'request', payload: undefined});
subscribeEvent(messaging, {
  moduleId: 'optional-capability', eventType: 'notice',
  handler: event => { void event.payload; },
});
publishEvent(messaging, {type: 'notice', payload: undefined});
unsubscribeModuleEvents(messaging, 'optional-capability');
```

Messaging is opt-in and independent of Runtime status. Caller wires subscription
registration/cleanup into initialize/stop/dispose hooks as needed. One handler per
command type; results distinguish success/rejected/unhandled/failed. Events use a
registration-order snapshot and stop at the first failure, reporting completed
deliveries. Same-context nested dispatch/publish throws; no queue or automatic
command-to-event publication. Foundation metadata is frozen; arbitrary business
payloads/values remain caller-owned. See [API](docs/API.md) for full contracts.

## Explicit execution dependencies

```ts
import {createExecutionContext, readExecutionTime, nextExecutionRandom} from '@rpg/gameplay';
const execution = createExecutionContext({
  clock: {now: () => 1000}, // milliseconds, caller-chosen origin
  random: {next: () => 0.25}, // optional; no fallback
});
readExecutionTime(execution); // 1000; exactly one explicit provider call
nextExecutionRandom(execution); // 0.25
```

Clock is required; RNG and IDs are optional. Methods/receivers are captured at
creation without calling or freezing providers. Time must be finite/nonnegative,
RNG finite in [0,1), IDs nonblank strings unchanged. Missing/invalid providers or
outputs throw TypeError; provider exceptions propagate unchanged. Caller wires
the context into existing callbacks through closures. Equivalent inputs, call
order and starting provider/callback states give reproducible Foundation traces;
arbitrary callback effects are the caller's responsibility. No scheduler, global
store, PRNG or ID algorithm is supplied. See [API](docs/API.md) and the
[closure evidence](docs/reports/v0.1.5-clock-determinism-foundation-closure.md).

Read [AGENTS.md](AGENTS.md), [ARCHITECTURE.md](ARCHITECTURE.md) and
[accepted decisions](docs/DECISIONS.md). Future implementation needs an approved
task recorded under [task execution](docs/TASK_EXECUTION.md).

## Điều hướng

| Đọc | Để làm gì |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Điểm vào cho coding agents |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Ranh giới L1–L4 và module ownership |
| [docs/GAMEPLAY_CAPABILITIES.md](docs/GAMEPLAY_CAPABILITIES.md) | 14 nhóm tính năng đã duyệt, không phải 14 package |
| [docs/HARNESS_CAPABILITIES.md](docs/HARNESS_CAPABILITIES.md) | H01–H16 và mức triển khai hiện tại |
| [docs/TASK_EXECUTION.md](docs/TASK_EXECUTION.md) | Approved plan, stop conditions, acceptance |
| [docs/TESTING.md](docs/TESTING.md) | Function-only tests; evidence thay cho số lượng |
| [docs/VERIFICATION.md](docs/VERIFICATION.md) | Commands và giới hạn từng gate |
| [harness/modules.json](harness/modules.json) | Registry module ban đầu rỗng |

## Reference

- [OpenAI — Harness engineering](https://openai.com/index/harness-engineering/)
- [TjnhPro/rpg_core](https://github.com/TjnhPro/rpg_core) (`@rpg/core/kernel`)

Không có migration, legacy compatibility, game examples, renderer hoặc game loop.
