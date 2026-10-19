# Accepted decisions — 2026-10-19

This document captures decisions already made with Developer, not a proposal to revisit them.

| ID | Decision |
| --- | --- |
| D01 | Four logical layers: L1 `rpg_core` → L2 `rpg_gameplay` → L3 game rules/content/builder → L4 game application. |
| D02 | `rpg_gameplay` is a **new repository**, not a migration; no backwards compatibility requirement. |
| D03 | L2 consumes **only** public `@rpg/core/kernel` calculation APIs; Core's preserved Legacy Gameplay is not a dependency. |
| D04 | L2 collects reusable RPG capabilities, even if not every game enables every one. |
| D05 | Modules can be enabled/disabled or omitted. Do not build a monolithic Gameplay Engine. |
| D06 | L3 contains game rules, configs, data/content and builder, NOT generic Item/Inventory/etc implementations merely because a game skips them. |
| D07 | Feature promotion from L3→L2 is allowed when reuse is demonstrated. |
| D08 | 14 groups of L2 Foundation capabilities are accepted as scope inventory; not 14 fixed packages or mandatory simultaneous implementations. |
| D09 | Primary verification profiles: Text RPG, RPG 2D, RPG 2.5D; **function-level scenarios only**, not games. |
| D10 | The library is pure/headless TypeScript functions, no game, renderer, UI or scene. State/lifecycle functions can exist; function-first != every operation stateless. |
| D11 | Task is discussed and approved by Developer on ChatGPT before agent implementation. Agent follows approved plan and cannot expand scope unilaterally. |
| D12 | Tests focus on function contracts and meaningful behavior; enough evidence, no test count quotas, avoid redundant matrix explosion. |
| D13 | Core numerical gaps and architecture/ownership changes require explicit escalation; agent must not create duplicate calculators/engines as shortcuts. |
| D14 | Developer alone accepts task/phase completion. Automated green checks are evidence, not approval. |

## Still deliberately undecided

Exact module splits, gameplay APIs, object vs functional store contracts, runtime
adapters, persistence schema, gameplay mechanics, turn/realtime scheduler — decide
**per approved task** with evidence. The approved v0.1.0 task establishes one
private native ESM package, strict TypeScript 6.0.3, and Node's built-in contract
test runner; it does not decide any gameplay contract or runtime.

The approved v0.1.1 task adds GF01–GF03: one Foundation owner for immutable
module declarations/registration/selection. It does not decide dependency
resolution, composition, lifecycle or concrete gameplay feature contracts.

The approved v0.1.2 task adds GF04–GF05 in the same Foundation owner: selected
dependency validation and deterministic dependency-first ordering, then immutable
data composition via that canonical resolver. Earliest registration among
currently ready modules wins at each step. GF01–GF03 retain their behavior;
there is no auto-enablement or execution. Context/lifecycle and GF06+ remain
undecided until their own approved tasks.

The approved v0.1.3 task adds GF06–GF09 at `src/foundation/runtime/`: explicit
synchronous lifecycle bindings, immutable runtime progress and read-only
inspection. Bindings stay separate from GF01 metadata and GF05 composition.
Creation validates the supplied order without dependency resolution. Each
snapshot advances once; errors retain partial progress and require explicit
cleanup. No shared mutable registry, implicit service, async orchestration,
command/event system, clock/RNG, game loop or concrete gameplay implementation.
GF10+ remains outside this task. Developer acceptance remains a separate gate.

The approved v0.1.4 task adds GF10–GF13 at `src/foundation/messaging/`: an
independent opt-in context, selected-module ownership, explicit command outcomes,
registration-order event snapshots, fail-fast delivery progress and explicit
unsubscribe/owner cleanup. One command handler per type; no implicit events.
Caller wires cleanup into existing lifecycle hooks. Same-context nested
dispatch/publish throws; other contexts remain independent. Private capability
associations expose no tables/bindings through reflection. Coordination metadata
is frozen; arbitrary business payload/value references remain caller-owned.
No live Runtime gating, Core changes or async scheduler is decided by v0.1.4.

The approved v0.1.5 task adds GF14–GF16 at `src/foundation/execution/`: required
caller clock, optional RNG/ID ports, captured methods/receivers and private weak
identity associations. No defaults, provider calls during creation, global store,
framework counters or scheduling. Invalid boundaries/output throw TypeError;
provider throws propagate unchanged. Existing callbacks integrate by closures.
GF16 is conditional on equivalent explicit inputs/order and starting provider/
callback state. Installed integration and opaque Text/2D/2.5D payload probes
supported Foundation closure review, accepted as the v0.2.0 baseline after PR #6 merge.

The approved v0.2.0 task starts one Entity / Character phase branch and Draft PR
through v0.2.5, with verified checkpoint commits and final phase acceptance only.
EC01–EC03 has one owner at `src/modules/entity/`: caller-defined nonblank id/kind,
closed two-field creation, detached immutable snapshots, no implicit identity or
collection authority. Entity is optional with no dependencies. EC04+ remains
outside this checkpoint and requires separately approved tasks.
