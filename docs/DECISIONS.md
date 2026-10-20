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

The approved v0.2.1 task extends that same Entity owner with EC04–EC06: immutable
ordered collection snapshots, exact collection-local unique IDs, explicit add/
lookup/list/remove and full same-ID replacement. Updates branch without mutation;
missing remove/replace and malformed/duplicate data throw TypeError. EC03 remains
the sole entity validator. No global store, arbitrary state bag, Foundation/Core
change or EC07+ implementation. Continue the same branch/Draft PR #7.

The approved v0.2.2 task adds EC07–EC09 in that same Entity owner: separate
entityId-bound immutable base attributes, explicit caller configuration composed
from Kernel types, validation/capture and detached calculated snapshots. Numerical
operations use public prepareNumericalModifiers/calculateStats exclusively,
including empty modifiers. Recalculation is an explicit repeat call, with no
global state/cache, game schema, modifier lifecycle or collection synchronization.
EC01–EC06 and Foundation remain unchanged; EC10+ is outside this checkpoint.

## v0.2.3 approved resource checkpoint

The approved task adds EC10–EC13 to the existing optional Entity owner, with
separate current-only immutable snapshots and fixed arbitrary resource keys.
Caller supplies bounds/policy/rate/time/precision; all resource arithmetic and
diagnostics belong to the pinned public Kernel. No automatic Stats synchronization,
life-state inference, scheduler, global resource store or new module is introduced.
GF01–GF16 and EC01–EC09 contracts/pin remain unchanged. Continue phase branch and
Draft PR #7; EC14+ and final v0.2.5 Developer acceptance remain pending.

## v0.2.4 approved life checkpoint

EC14–EC17 adds separate immutable alive/dead snapshots in the Entity owner.
Caller explicitly supplies resource selection and bounds. Defeat evaluates minimum
without resource arithmetic; revival only changes life after caller recovery.
Malformed inputs throw TypeError before no-op. Already-dead defeat and valid
already-alive revival return unchanged; above-max is allowed for defeat evaluation
but rejected for revival. No global authority/replay protection or automatic events.
Caller may publish transition outcomes using unchanged GF12/GF13. Core, old contracts,
registry/deps and EC18 scope remain intact; phase acceptance is deferred to v0.2.5.

## v0.2.5 approved integration and review readiness

The approved task authorizes EC18 installed consumer evidence, full phase audit,
version 0.2.5, report and existing PR #7 readiness after exact-head gates.
No new production APIs or owners are needed. EC01-EC17 and GF01-GF16 semantics,
Core revision/integrity, optional Entity registry and dependency pins stay intact.
Two independent literal-oracle sessions exercise explicit cross-domain handoff,
immutable state, commands/events and cleanup/failures. Agent may mark the same
PR Ready for Review only after final CI; Developer acceptance/closure remains
PENDING. No merge, tag, release, publish or task archival is authorized here.

## Effect v0.6.x approved contract — D01–D18

These identifiers belong to the Effect phase. The approved task is
[tasks/active/v0.6.0-effect-foundation.md](tasks/active/v0.6.0-effect-foundation.md).
D01–D03 structural identity/ownership are implemented at v0.6.0; subsequent
semantics remain approved constraints for later milestones, without placeholders.

| Decision | Approved contract |
| --- | --- |
| D01 | Effect độc lập, dùng chung cho nhiều gameplay systems |
| D02 | L2 Effect sở hữu Effect Instance và lifecycle state |
| D03 | Source hỗ trợ Entity và System/Environment, có stable sourceKey |
| D04 | Duration hỗ trợ timed và persistent; instant deferred |
| D05 | Foundation Clock, L4 advance simulation, no background timer |
| D06 | Stack group theo targetId + effectId + sourceKey |
| D07 | L3 chọn refresh/stack và maxStacks |
| D08 | Independent expiration per stack |
| D09 | Refresh duration không thay numerical snapshot cũ |
| D10 | Stack overflow mặc định reject |
| D11 | Remove instance/group và consume N stacks |
| D12 | Modifier snapshot at apply; numerical resolution qua Kernel |
| D13 | Buff/Debuff classification là metadata, không phải separate engines |
| D14 | Effect xuất restrictions, L3 diễn giải, L4 đưa vào Skill/Combat |
| D15 | First tick at appliedAt + interval; due ticks before expire at boundary |
| D16 | Effect tạo tick intent; canonical owners thực hiện numerical/resource transitions |
| D17 | Source death không tự hủy effect; target death theo cleanup policy |
| D18 | Kernel-only; no Legacy import/copy; unsupported numerical features deferred |

Core-first MVP: L1 public Kernel remains the sole numerical owner. Effect
identity-only v0.6.0 needs no numerical operation. For future milestones, inventory
public pinned Kernel capability first; unsupported numerical features are
DEFERRED_UNSUPPORTED and excluded from MVP. Never import/copy Legacy effects or
create an L2 calculator to fill the gap. L2 Effect owns structural identity/state;
canonical Entity validates targets. L3 supplies content/policy; L4 supplies stable
source identity, authoritative state and explicit orchestration. No global store,
second runtime engine or coupling to Skill/Combat/Progression is authorized.
