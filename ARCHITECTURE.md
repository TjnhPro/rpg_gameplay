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
and GF14–GF16 execution functions, plus EC01–EC03 Entity creation/contracts.
Core 2.0.0 is an exact peer; development
and CI reconstruct the pinned installed artifact (see `docs/CORE_INTEGRATION.md`).
Only Core is currently approved as a runtime package. The import/dependency guard
rejects other external runtime dependencies pending an approved task.
Tests/tooling run outside production `src/`; no engine/adapters or global gameplay
state are introduced. Architecture registry declares optional Entity. Root and sibling re-exports
must use each module's public entrypoint.

GF01–GF05 have one Foundation owner: `src/foundation/modules/`. Their public
registry/configuration and resolved composition are immutable explicit consumer
state, with no singleton or module execution. Composition uses the canonical
dependency resolver; registration/configuration keep their original semantics. They are separate from the static
architecture registry `harness/modules.json`, which now declares Entity only.
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
both strings; no subtype engines, state bags, ID generation, collection authority
or numerical calculation. Static ownership declares entity optional with no
dependencies. Consumer registration/selection/composition remain explicit GF01–GF05
operations. Entity phase acceptance is pending final v0.2.5 review; EC04+ is deferred.

- Reusable module source: `src/modules/<module-id>/`.
- Module register: `harness/modules.json`, currently optional Entity only.
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
