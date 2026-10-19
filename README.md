# RPG Gameplay — v0.3.4 Skill Progression

> **Status: merged Entity v0.2.5 baseline; PG01–PG18 implemented. Progression phase IN_PROGRESS; Developer acceptance PENDING until final v0.3.5 review.**
> Private native ESM/strict TypeScript package with installed-package contract
> verification and pinned Core Kernel integration. Module declarations, immutable
> registry, selection, dependency resolution, composition and synchronous lifecycle
> coordination, explicit command routing, synchronous event pub/sub and injected
> clock/RNG/ID execution dependencies are available.
> **Optional Entity supports identity, immutable collections/base attributes and caller-configured Kernel stats/resources and explicit life transitions.**

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
including GF01–GF16, EC01–EC18 and PG01–PG18 through an installed-package consumer. Text/2D/2.5D probes
prove Foundation/Entity data compatibility; gameplay profile behavior is NOT_EVALUATED.

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
Independent snapshots and collections can share an ID; IDs must be unique within
each collection. Collection operations preserve exact IDs and insertion order.
Module ID entity is distinct from actor identity. Explicit GF01–GF05 registration/
selection/composition creates no actor and does not gate direct createEntity calls.
See [API](docs/API.md), [phase report](docs/reports/v0.2.5-entity-integration-closure.md)
and [single-PR phase workflow](docs/TASK_EXECUTION.md).

```ts
import {createEntityCollection, addEntity, replaceEntity, removeEntity, listEntities} from '@rpg/gameplay';
const empty = createEntityCollection();
const base = addEntity(empty, {id: 'actor-1', kind: 'npc'});
const companion = replaceEntity(base, {id: 'actor-1', kind: 'companion'});
const removed = removeEntity(base, 'actor-1');
listEntities(base); // [{id: 'actor-1', kind: 'npc'}]; branches leave base unchanged
```

`getEntity`/`hasEntity` query exact IDs. Unknown valid lookup returns undefined/false;
duplicate add and unknown remove/replace throw TypeError. Every change returns a
new frozen collection; enumeration and contained snapshots are frozen/detached.
Replace is full same-ID replacement at the old position, not upsert/partial patch.

## Attributes and Kernel stats

`createEntityAttributeState(entity, baseAttributes)` captures arbitrary finite
numeric keys in a separate immutable state associated by entityId. Empty maps,
negative/fractional values and special property names are supported.
`getEntityBaseAttributes(state)` returns frozen detached data;
`setEntityBaseAttribute(state, existingKey, value)` returns a new state without
calculating stats. Entity and collection schemas remain unchanged.

`calculateEntityStats(state, configuration)` validates explicit attribute/stat
orders, Kernel-compatible rules, baselines, baseStats, flatContributions and
modifiers, then delegates to `prepareNumericalModifiers()` and `calculateStats()`.
Optional synchronous numeric transforms belong to the caller. The result holds
only frozen detached entityId/effectiveAttributes/stats. Call the same function
again with changed inputs to recalculate; old snapshots remain intact. L3 owns
schema and balancing; there is no implicit collection synchronization or cache.
See [configuration example and validation contract](docs/API.md#ec07ec09-attributes-and-kernel-stats).

## Resources and explicit Kernel transitions

`createEntityResourceState(entity, definitions)` creates frozen current values
associated by entityId. Each caller-defined resource supplies minimum/maximum and
optional current; Kernel initializes omitted current at maximum. Empty sets are
valid. Bounds are supplied at every operation and are never cached in state.

```ts
import {createEntityResourceState, transitionEntityResource, regenerateEntityResource} from '@rpg/gameplay';
const resources = createEntityResourceState(player, {
  health: {minimum: 0, maximum: 100, current: 80},
  mana: {minimum: 0, maximum: 50},
});
const decreased = transitionEntityResource(resources, 'health', {
  operation: 'decrease', amount: 25, maximum: 100,
  rule: {minimum: 0, currentAboveMaximum: 'reject', allowIncreaseFromMinimum: true},
}); // decreased.state.current.health=55; transition.applied=25
regenerateEntityResource(decreased.state, 'health', {
  minimum: 0, maximum: 100, ratePerSecond: 2, elapsedSeconds: 2.5,
  eligible: true, precision: {decimalPlaces: 2},
}); // current=60; caller supplies time, eligibility and all policy
```

`getEntityResourceCurrent` returns current or undefined for a valid unknown key.
`normalizeEntityResource(state, key, {minimum, maximum})` explicitly normalizes a
stored current when bounds change. Every numerical operation delegates to Kernel
and returns frozen diagnostics with next state, leaving old versions unchanged.
Stats maxima are handed over explicitly; no refill, automatic synchronization,
scheduler, life-state interpretation or Combat/Skill behavior is introduced.

## External package consumption (local artifacts, no publication)

`npm pack --pack-destination .artifacts` builds a private gameplay tarball. In an
independent ESM project, install **both** that tarball and the prepared Core tarball
using paths appropriate to that project:

```sh
npm install /path/to/rpg-gameplay-0.3.4.tgz /path/to/rpg-core-2.0.0.tgz
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
| [harness/modules.json](harness/modules.json) | Optional Entity và Progression; Progression phụ thuộc Entity |

## Reference

- [OpenAI — Harness engineering](https://openai.com/index/harness-engineering/)
- [TjnhPro/rpg_core](https://github.com/TjnhPro/rpg_core) (`@rpg/core/kernel`)

Không có migration, legacy compatibility, game examples, renderer hoặc game loop.

## Explicit life state (EC14–EC17)

```ts
import {createEntityLifeState, resolveEntityDefeat, reviveEntity} from '@rpg/gameplay';
const life = createEntityLifeState(player, {status: 'alive'});
// depleted/restored are caller-created EC11/EC12 resource snapshots for player.
const policy = {resourceId: 'vitality', minimum: 5, maximum: 100};
const defeat = resolveEntityDefeat(life, depleted, policy);
const revival = reviveEntity(defeat.state, restored, policy);
```

Life state is a separate frozen entityId/status snapshot. Resource minimum alone
never causes death, and recovery never causes revival. Caller explicitly evaluates
minimum defeat and performs life-only revival after recovery above minimum within
bounds. Repeated operations on the new snapshot return unchanged. Caller may
publish changed outcomes through GF12; no automatic event, global store or replay
guard. Old snapshots remain usable. EC18 combines these public functions without
new production APIs; final phase acceptance remains with Developer.

## Progression Foundation (PG01–PG03)

```ts
import {createEntity, createProgressionState} from '@rpg/gameplay';
const actor = createEntity({id: 'player-1', kind: 'player'});
const progression = createProgressionState(actor, {level: 10, experience: 1500});
// Frozen {entityId: 'player-1', level: 10, experience: 1500}
```

The same API accepts Monster/NPC/custom actors. Caller supplies a positive safe
integer level and finite nonnegative EXP (fractions preserved). EXP is a recorded
number only; advancement interprets it using an explicit caller-selected mode.
Creation supplies no defaults, curves, caps, points or events. Optional Progression requires
explicit Entity selection when composed; neither is automatically enabled.
See [checkpoint report](docs/reports/v0.3.0-progression-foundation.md).

## Experience System (PG04–PG06)

```ts
import {gainExperience, adjustExperience} from '@rpg/gameplay';
const gained = gainExperience(progression, 250); // EXP1500 -> 1750; level10 unchanged
const reduced = adjustExperience(gained.state, {delta: -100}); // EXP1650
const capped = gainExperience(reduced.state, 100, {maximumExperience: 1700});
// transition: before1650, after1700, requestedDelta100, appliedDelta50, limitedtrue
```

Read EXP directly from the readonly state. Operations return frozen state and
transition diagnostics; old snapshots remain intact. Minimum is 0; optional finite
nonnegative maximum belongs to the current operation and must not be below current
EXP. Uncapped overflow throws TypeError; a valid cap bounds intermediate overflow.
EXP stays a recorded scalar, with no cumulative/local conversion or automatic
level-up. See [v0.3.1 evidence](docs/reports/v0.3.1-experience-system.md).

## Level & Advancement (PG07–PG10)

```ts
import {evaluateLevelAdvancement, advanceProgressionLevel} from '@rpg/gameplay';
const policy = {experienceMode: 'level-local' as const, maxLevel: 100, targetLevel: 4,
  requirements: [
    {toLevel: 2, requiredExperience: 100, eligible: true},
    {toLevel: 3, requiredExperience: 150, eligible: true},
    {toLevel: 4, requiredExperience: 200, eligible: true},
  ]};
const state = {entityId: 'player-1', level: 1, experience: 260};
evaluateLevelAdvancement(state, policy); // dry-run: level3, EXP10, blocked at4
advanceProgressionLevel(state, policy); // frozen state + identical transition
```

Every request supplies mode, max, target and all contiguous steps to that target.
Cumulative mode uses nondecreasing absolute thresholds without consuming EXP;
level-local subtracts successful per-step costs and preserves the remainder.
Caller evaluates external eligibility first. The first blocker stops advancement
and retains the successful prefix. Entire malformed policies throw before any
projection, even for no-op/max-level. No automatic level-up, rewards, points,
events or mode conversion. Caller maintains mode consistency across a lifecycle.
See [API](docs/API.md) and [v0.3.2 report](docs/reports/v0.3.2-level-advancement.md).

## Attribute Points (PG11–PG13)

`createAttributePointState(progression, initial)` captures explicit unspent/spent
safe integer balances and a reward cursor. `grantAttributePointRewards(points,
advancement, {pointsByLevel})` consumes the actual level advancement result and
caller rewards for exactly its completed levels. `allocateAttributePoints(points,
attributes, {attributeId, pointCost, newBaseValue})` spends points through the
canonical Entity setter, returning combined immutable snapshots.

Updated cursors reject receipt replay; stale snapshots can branch. Caller owns
upgrade economics, storage and explicit stat recalculation. No automatic rewards,
events or global ledger. See [API](docs/API.md) and
[v0.3.3 evidence](docs/reports/v0.3.3-attribute-points.md).

## Skill Progression (PG14–PG18)

```ts
import {createSkillRankState, createSkillPointState, grantSkillPointRewards,
  evaluateSkillUpgrade, upgradeSkillRank} from '@rpg/gameplay';

const ranks = createSkillRankState(entity, {sword_basic: 2, fireball: 0});
const points = createSkillPointState(progression, {
  unspentPoints: 3, spentPoints: 5, rewardedThroughLevel: 10,
});
const requirement = {skillId: 'sword_basic', expectedRank: 2, maxRank: 10,
  pointCost: 2, requiredCharacterLevel: 15, prerequisites: [], eligible: true};
// Given progression.level >= 15: rank2->3, unspent3->1, spent5->7.
const projection = evaluateSkillUpgrade(progression, ranks, points, requirement);
const next = upgradeSkillRank(progression, ranks, points, requirement);
```

Use `getSkillRank` for validated inspection: rank0 is registered but unlearned;
unknown key returns undefined. `grantSkillPointRewards` explicitly consumes PG09
results and caller per-level rewards, with its own cursor. Pools stay independent.
Policy fully validates before blockers: max rank, character level, prerequisites,
eligibility, points. Stale expectedRank throws; valid blockers return diagnostics
and unchanged frozen values. Each success adds exactly one rank, including free
upgrades. No Skill execution/effects or automatic events. See
[v0.3.4 evidence](docs/reports/v0.3.4-skill-progression.md).
