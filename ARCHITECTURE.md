# Architecture — accepted scope, open implementation

## Four layers

```text
L4 Game Application (game UI/render/network/runtime)
              ↓ consumes
L3 Game Rules + Content + Builder (game policy/data)
              ↓ configures
L2 rpg_gameplay (this repo: reusable headless functions and optional capabilities)
              ↓ calls numerical APIs
L1 @rpg/core/kernel (canonical calculations)
```

Dependency hướng xuống; các layer thấp hơn không tham chiếu layer phía trên.

## L2 identity

- L2 chứa những **reusable gameplay capabilities** ngay cả khi một số game không sử dụng.
- Không yêu cầu cả Text/2D/2.5D cùng sử dụng một capability; optional module là feature, không phải 'game-specific' chỉ vì một consumer không bật nó.
- Có thể tạo capability trực tiếp tại L2 hoặc sau này promote từ L3 nếu chứng minh được tính tái sử dụng.
- 14 *nhóm chức năng* tại `docs/GAMEPLAY_CAPABILITIES.md` là inventory scope, **không khóa package shape, classes, APIs, data schema hay implementation**.
- Không cần module == repo riêng; tách package sớm nếu có evidence độc lập nhưng không tự đổi architecture ngoài approved task.

## Ownership & non-overlap

- L1 owns: stats, modifiers, damage calculation, hit/critical/mitigation, resource arithmetic, numerical snapshots.
- L2 owns: gameplay policy/state changes/lifecycle/coordination và reusable item/skill/effect/... khi được triển khai.
- L3 owns: skill definitions, item catalogs, class balancing, game-specific constraints, quests/content, rules presets.
- L4 owns: UI, scene graph, rendering, platform persistence, network transports.
- Legacy entrypoints của `rpg_core` tồn tại để tương thích nhưng KHÔNG làm L2 phụ thuộc chúng.

## Module boundary (initial convention; can evolve with approved task)

### Public package boundary

`@rpg/gameplay` is a private native ESM package with strict NodeNext compilation.
Only the root export is exposed, with JS and declarations in `dist/`. Its current
`src/index.ts` exports GF01–GF05 module, GF06–GF09 lifecycle, GF10–GF13 messaging
and GF14–GF16 execution functions, plus EC01–EC18 Entity/collection/attribute/stat/resource/life contracts and PG01–PG18 Progression/points/skill rank transitions.
Core 2.0.0 is an exact peer; development
and CI reconstruct the pinned installed artifact (see `docs/CORE_INTEGRATION.md`).
Only Core is currently approved as a runtime package. The import/dependency guard
rejects other external runtime dependencies pending an approved task.
Tests/tooling run outside production `src/`; no engine/adapters or global gameplay
state are introduced. Architecture registry declares optional Entity and Progression. Root and sibling re-exports
must use each module's public entrypoint.

GF01–GF05 have one Foundation owner: `src/foundation/modules/`. Their public
registry/configuration and resolved composition are immutable explicit consumer
state, with no singleton or module execution. Composition uses the canonical
dependency resolver; registration/configuration keep their original semantics. They are separate from the static
architecture registry `harness/modules.json`, which declares Entity and dependent Progression.
No Foundation placeholder is registered.

GF06–GF09 have one separate Foundation owner: `src/foundation/runtime/`.
It consumes the Module owner's public definition validator and validated
composition order; it never registers, selects or resolves a new graph. Explicit
caller bindings supply synchronous hooks, separate from module metadata. Runtime
capabilities return immutable lifecycle snapshots; each snapshot has a local
execution guard against replay/reentrancy. A private WeakMap associates capability
identity with its record; reflection cannot reach bindings or execution mutators.
It is not enumerable and does not share progress between runtimes.
There is no global gameplay registry,
state store, implicit service, application loop or Core numerical operation.
Inspection exposes frozen lifecycle data only. Runtime is not a static gameplay module.

GF10–GF13 have one opt-in coordination owner: `src/foundation/messaging/`.
It validates supplied composition identities/order through the Module public
validator and an ordered boundary check, without graph resolution. Private weak
context associations protect per-context command/subscription tables from public
reflection. Commands route to one selected owner; events use registration-order
snapshot fan-out and fail-fast diagnostics. Same-context nested execution rejects;
there is no queue, scheduler or automatic command-to-event pipeline. Lifecycle
integration is explicit caller wiring of subscribe/owner cleanup in existing
hooks, never a claim of live Runtime authority or an implicit lifecycle engine.

GF14–GF16 have one execution dependency owner: `src/foundation/execution/`.
It captures caller clock/RNG/ID callbacks and receivers behind private weak
capability associations, with no dependency on the other owners. No counters,
implicit providers, scheduling or automatic metadata are introduced. Existing
callbacks integrate through caller closures, preserving public signatures and
failure handling. Equivalent explicit inputs/call order and equivalent starting
provider/callback states give reproducible Foundation traces; callback external
effects remain outside that guarantee. Foundation is the accepted v0.1.5 baseline;
gameplay behavior is not covered by its compatibility probes.

EC01–EC03 have one gameplay owner: `src/modules/entity/`. Creation validates a
closed id/kind definition and returns detached frozen scalar data. Caller supplies
both strings; no subtype engines, state bags, ID generation
or numerical calculation. Static ownership declares entity optional with no
dependencies. Consumer registration/selection/composition remain explicit GF01–GF05
operations. EC04–EC06 extends this same owner with explicit immutable collection
membership, exact collection-local uniqueness and ordered full-snapshot updates.
Collections are frozen data, not capabilities backed by a global store. Structural
inputs are validated/detached through EC03 before use; no mutable caller data is
returned. Identity/collection operations invoke no hooks or Kernel calculations.
EC07–EC09 stays in the same owner: separate immutable EntityAttributeState bound
by exact entityId; explicit caller-owned EntityStatConfiguration composed from
Kernel public types; one calculateEntityStats path through Kernel modifier
preparation and ordered stat calculation. L2 validates/captures input and projects
two frozen numeric maps. No numerical algorithm, global store/cache, schema policy
or membership synchronization is added. Foundation and EC01–EC06 semantics stay
unchanged. Entity v0.2.5 is the merged baseline; EC18 evidence is below.

EC10–EC13 stays in the same Entity owner: separate immutable entityId/current
resource snapshots with fixed caller-defined keys. Bounds and policies arrive at
operation boundaries. Initialization/normalization, increase/decrease and explicit
regeneration delegate respectively to normalizeResource, calculateResourceTransition
and calculateResourceRegeneration from the pinned public Kernel. L2 validates,
captures inputs, replaces one current value and freezes diagnostics verbatim;
there is no numerical fallback. Stats-to-maximum handoff is explicit caller work.
No global store, scheduler, life state, events or additional module is introduced.

- Reusable module source: `src/modules/<module-id>/`.
- Module register: `harness/modules.json`, optional Entity and Progression (depends on Entity).
- Sibling imports must reference declared dependencies and sibling public entry point, not private implementation files.
- `src/index.ts` được phép re-export public modules. `src/shared/`/`src/contracts/` không import runtime modules.
- Ownership of each actual module declared in registry; do not add all 14 empty modules in advance.
- Do not confuse optional with 'no dependency': optional feature may list a required dependency when **enabled**.
- Function contracts/data are designed per approved capability task; no global framework engine required.

## Meaningful reasons to split early

Separate an owner when behaviors have different lifecycle, state authority, dependency set or integration contracts. Shared logic may be reused, but don't merge unlike implementations just to avoid a package. Don't generalize a game-only feature prematurely.

## Rules of construction

- Favor explicit function inputs/outputs; stateful features may pass/return state, but no renderer/runtime dependency.
- No hidden app clock/RNG or globals for gameplay transitions.
- A public contract needs clear ownership, behavior and verification evidence.
- Interface changes or ownership moves require an approved task or explicit Developer decision.

See `docs/TESTING.md` for how Text/2D/2.5D differences are checked **without building three games**.

## EC14–EC17 Life State & Death

Same Entity owner, optional registry entry and no module dependencies. Independent
immutable entityId/status snapshots hold alive/dead; three pure functions create,
resolve minimum defeat and revive after caller recovery. Canonical EC10 validation
reads resource state; life operations compare values and call no Kernel numerical
operation, Foundation provider, runtime or messaging function. L1 still owns all
resource arithmetic, L3 owns resource selection/bounds/operation timing and event
names/publication. All data validates before no-op; no hidden mutable authority,
automatic normalization, hardcoded game policy, event dispatch or second life engine.
EC01–EC13/GF01–GF16 bodies and Core pin remain unchanged.

## EC18 installed integration

v0.2.5 adds consumer evidence only. The existing Entity functions compose with
Foundation module selection, lifecycle, commands/events and explicit execution
ports. Caller wiring hands a calculated maximum to resources, explicitly
normalizes it, depletes/recover resources, resolves life outcomes and publishes
events. No production API, state owner, calculator or dependency is added.
Two independent sessions match a literal semantic oracle, preserve prior actor
snapshots and expose fail-fast listener progress without automatic rollback.
This Entity checkpoint was merged through PR #7 before Progression implementation.

## PG01–PG03 Progression Foundation

One separate canonical owner, `src/modules/progression/index.ts`, imports only
Entity's public entrypoint for canonical identity validation through createEntity.
It captures explicit level/experience as detached frozen scalar data; no store,
calculator, execution provider or runtime/messaging binding. The static optional
progression entry depends on entity. GF04–GF05 still requires explicit selection
of both; no automatic enablement or alternate resolver. Core pin and all existing
Foundation/Entity contracts remain unchanged. L3 owns game curves and policies;
Advancement now uses explicit caller-selected EXP modes; state stores neither mode nor cap.
Progression phase REVIEW_PENDING; Developer acceptance PENDING.

## PG04–PG06 Experience System

Same Progression owner and unchanged optional dependency entity. PG02 experience
is the sole recorded EXP state; direct readonly access suffices. adjustExperience
owns one synchronous immutable scalar transition; gainExperience only validates
nonnegative gain/options and delegates to it. Shared private PG03 own-data/numeric
validation serves creation and transitions; state identity validation is a nonblank
string check, without a fake Entity kind or collection lookup. No new public
validator, global store, parallel engine, Foundation or Entity change.

The approved v0.3.1 task explicitly permits scalar bookkeeping: signed addition,
minimum 0, optional operation-local maximum, finite-result enforcement and signed
after-before diagnostics. This is not an EXP formula. No suitable public Kernel
EXP contract exists; no fabricated resource bound/policy or dummy Kernel call.
All existing Entity numerical delegation and Core pin remain unchanged. Level,
reward/point/event/lifecycle behavior is outside this transition.

## PG07–PG10 Level & Advancement

Same canonical Progression owner, optional dependency entity and three-scalar
state. Existing PG02 level validator now also validates max/target/step levels.
One private resolver validates/captures the whole closed policy and dense complete
contiguous requirements, then resolves successful steps sequentially. Evaluate
returns its frozen projection; advance returns that projection and a frozen next
state, without resolving twice. Eligibility precedes EXP; first blocker retains
the successful prefix. Cumulative thresholds do not consume EXP; local costs do.
The caller selects mode/max/target/eligibility and maintains mode consistency.
Only approved comparison/increment/subtraction/diagnostic bookkeeping is added;
no curve, fake Kernel delegation, store, new module, engine, reward or event.
Entity/Foundation/Core/registry and PG01–PG06 semantics remain unchanged.

## PG11–PG13 Attribute Points

The existing optional Progression owner holds a separate immutable point pool,
not fields on ProgressionState. Its cursor requires the next actual advancement
receipt to start at the last rewarded level; zero rewards still move the cursor.
Complete receipt/policy validation precedes grants. Updated snapshots provide a
local replay guard; no global authority or persistent exactly-once guarantee.
Allocation uses public Entity get/set APIs, returns points and attributes together
and never recalculates stats. Caller supplies cost/value and stores both snapshots.
Entity/Foundation/Core and PG01–PG10 behavior remain unchanged.

## PG14–PG18 Skill Progression

Same optional Progression owner and entity dependency. Separate fixed-key rank
snapshots and independent Skill Point balances/cursor; ProgressionState unchanged.
Private point initialization/reward bookkeeping is shared with Attribute Points
without changing their public contracts. No public generic wallet/point engine.
Exact own-data skill keys preserve arbitrary identifiers and special names safely.
One resolver validates all state/policy/prerequisites then evaluates deterministic
cap/level/prerequisite/eligibility/point priority. Dry-run and upgrade share that
resolution. Upgrade constructs frozen combined next rank/point data, one rank per
request. expectedRank is a local optimistic precondition, not a global lock.
L3 supplies definitions/caps/costs/eligibility; no Skill Engine/catalog, automatic
execution/events, graph traversal or numerical formula. PG19 integration is consumer evidence only, described below.


## PG19 integration and phase audit

Existing Progression functions compose with public Entity and opt-in Foundation
functions in an external installed consumer. PG19 adds no production source/API,
orchestration facade or mutable authority. PG01-PG18 semantics stay unchanged.
Entity owns Base Attributes/resources/life; Entity delegates stats to real pinned
Kernel. L3/caller explicitly advances, grants both independent pools, allocates,
recalculates, upgrades and publishes. No operation synchronizes another domain.
Full PR diff from merged Entity baseline is classified in the closure report.
Static registry remains optional entity and optional progression -> entity; no
Skill/Reward placeholders. Phase REVIEW_PENDING; Developer alone accepts/closes.

## CB01–CB05 Combat Foundation (v0.4.0)

Group A is the merged PR #8 baseline at c550669. Combat phase is IN_PROGRESS,
Developer acceptance PENDING. Earlier sections retain milestone history.
One canonical owner, `src/modules/combat/index.ts`, captures a structural action
attempt as immutable exact IDs and one entity target. Static optional combat
requires entity, independently of progression. At v0.4.0 it needed no imports:
opaque identity validation requires no Entity creation or lookup. Root exports
one factory and three types; package deep exports remain closed.

Request and context share one structural shape and one validation path. Private
own-data/identifier helpers capture descriptors before building a frozen root and
target; caller records stay untouched. Entity owns identity/attributes/resources/
life, Progression owns EXP/level/ranks/points, Foundation owns coordination/providers,
Kernel owns numerical work. No action admission, target policy, numerical formula,
execution, global action registry, CombatSession, Skill/Effect/Encounter owner or
second engine is introduced. Later basic attacks must remain independent of Skill.
The snapshot is mode-neutral and needs no clock, RNG, IDs, turns or spatial data.

## CB06–CB10 Actor-stage admission (v0.4.1)

Same Combat owner imports getEntity and EntityCollection/EntityLifeState only
through ../entity/index.js. Canonical CB03 factory supplies context validation;
canonical getEntity owns full collection validation and exact source lookup.
Combat protects supplied Life schema/identity only, comparing existing alive/dead
without HP calculation or transitions. Existing private own-data helper also
captures explicit boolean policy. One evaluation function validates all inputs,
then applies missing > dead > ineligible > admitted priority and freezes result.
No new Life/Collection owner, lookup engine, state store, numerical calculator,
Condition Engine, Skill dependency or execution authority. Registry unchanged.
Target identity is structural only until a separately approved target milestone.
