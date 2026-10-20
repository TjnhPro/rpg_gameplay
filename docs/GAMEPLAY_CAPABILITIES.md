# L2 Gameplay Foundation — 14 accepted capability groups

**Accepted scope**, not an instruction to write 14 packages/classes or implement all at once. Each capability can be optional. Evaluate owners and dependencies only when a task reaches that capability.

| # | Capability group | Reusable responsibility | Examples left to L3 |
| --- | --- | --- | --- |
| 01 | Gameplay Foundation | lifecycle/registration/composition of optional capabilities; explicit clock/RNG contracts | game startup choices |
| 02 | Entity / Character | identity and gameplay character state, actor/resource storage | character names, game classes, initial stats |
| 03 | Progression | EXP/level/upgrades rules interface & state transitions | level curves, talent restrictions |
| 04 | Combat | action admission, target policy interfaces, damage application/lifecycle | PvP/PvE rules, game formula selection |
| 05 | Skill | definition identity schema, skill instance/availability/activation/cost/cooldown lifecycle | concrete skill content, tuning, visuals; rank state remains Progression-owned |
| 06 | Effect | reusable apply/stack/refresh/expire/DoT/HoT/status transitions | effect catalogs & presentation |
| 07 | Monster & AI | monsters as gameplay actors, decision interfaces/behaviors | monster templates and tuning |
| 08 | Encounter | encounter lifecycle, participation, completion conditions | zone/dungeon/wave designs |
| 09 | Item | item definitions/instances and reusable operations | items, rarities, affix pools, balance |
| 10 | Inventory | ownership/storage/transfer/stack/capacity operations | inventory dimensions, restrictions |
| 11 | Equipment | equip/unequip/slots/requirements/modifier source wiring | slot layout and item stat settings |
| 12 | Loot | configurable drop selection/generation | loot tables and probabilities |
| 13 | Reward | reward grants/claims/transaction outcomes | amount, tables, reward eligibility policy |
| 14 | Gameplay State & Persistence Contracts | portable state capture/restore validation/interfaces | DB drivers, save slots, schema choices |

**Ownership is provisional within groups**: overlap (e.g. rewards vs progression or item vs equipment) must be addressed with one canonical owner in approved tasks. L1 always remains sole canonical numerical calculation owner.

## Later candidates (not forbidden / not L3 by default)

Spatial/movement, skill delivery (melee/projectile/AoE), realtime controller, turn controller, quest, world/area/zone, NPC/interactions, party, trigger/condition, crafting, trading/economy, advanced itemization, character builds, dungeon, automation/idle.

Build a capability later when needed; do not make the 14 groups a rigid global dependency chain. L3 can incubate a candidate before promoting reusable behavior to L2.

## v0.2.x Entity implementation evidence

Group 02 currently provides EC01-EC18 identity, immutable collection/attributes,
explicit Kernel stats/resources and explicit life evaluation/revival. The single
owner remains src/modules/entity/index.ts; EC18 adds installed integration only.
Group 01 GF01-GF16 remains the accepted baseline. Other groups above remain
candidate scope, not implemented capabilities. Text/2D/2.5D Foundation/Entity
data compatibility is EVALUATED; concrete gameplay behavior is NOT_EVALUATED.
Entity phase is REVIEW_PENDING with Developer acceptance PENDING; see the
v0.2.5 phase report. No global registry, persistent storage or gameplay engine.

## v0.3.0 Progression checkpoint

Entity v0.2.5 EC01–EC18 is the merged PR #7 baseline. PG01–PG03 now provides
optional Progression identity, explicit level/EXP contracts and immutable validated
creation through one shared actor API. PG04–PG06 adds explicit scalar gain/adjustment;
PG07–PG10 adds caller-configured cumulative/local level advancement and immutable
diagnostics. No default curves. Phase
IN_PROGRESS; Developer acceptance PENDING until final v0.3.5 review.

PG11–PG13 adds explicit separate Attribute Point snapshots, completed-level
rewards with immutable cursor and caller-priced canonical Entity allocation.
No automatic stat/resource/EXP/event changes or global reward authority. Progression remains IN_PROGRESS pending
final v0.3.5 Developer review; game profiles remain NOT_EVALUATED.

PG14–PG18 adds registered exact-key Skill Ranks, independent Skill Point pools/
cursors, explicit per-level rewards and caller-configured one-rank upgrades with
prerequisites, blockers and expectedRank guards. No Skill execution/catalog/effects
or generic talent graph. PG19 installed integration is now verified; phase
REVIEW_PENDING and Developer acceptance PENDING.


## v0.3.5 Progression integration

Group03 PG01-PG19 implementation and installed integration evidence are complete
for Developer review, not acceptance. Explicit EXP/levels, independent AP/SP,
canonical Entity allocation/Kernel recalculation and rank upgrade integrate with
caller Foundation commands/events. No new production capability/module. Other
candidate groups remain unimplemented; Skill execution/catalog/effects are not
implied by Skill Rank bookkeeping. Progression phase REVIEW_PENDING.

F-001 pre-merge remediation makes the approved AP/SP independence explicit in
public snapshots: required readonly pointKind attribute/skill, own-data runtime
guards and strict TypeScript isolation. No new capability/API/module, formula or
engine; package0.3.5 and phase REVIEW_PENDING. Structural kind is not a trusted
credential. Untagged old snapshots reject; no implicit migration/conversion.

## v0.4.0 checkpoint checkpoint: Combat Foundation

Group A (GF01–GF16, EC01–EC18, PG01–PG19 including point-pool isolation) is the
merged PR #8 baseline. Historical pending statuses above describe prior checkpoints.
Group04 now has CB01–CB05: optional combat -> entity, exact action/source/target
identity, frozen detached action intent and closed own-data structural validation.
Self-target/unknown references are valid; no actor lookup or authorization follows.
Basic attack intent requires no Skill/Progression dependency. No admission, target
relations, attack/damage/resource/death execution, active session, Skill/Effect/AI/
Encounter integration, scheduler or renderer is implemented. Remaining candidate
groups are unchanged. Context data compatibility is verified for Text/Realtime/
Turn-Based callers; gameplay execution/profile behavior remains NOT_EVALUATED.
Combat phase IN_PROGRESS, PR DRAFT, Developer acceptance PENDING. v0.4.1+ NOT_STARTED.

## v0.4.1 checkpoint checkpoint: Actor-stage admission

CB06–CB10 adds pure source existence (canonical Entity Collection), supplied
Entity Life and explicit caller boolean eligibility evaluation. Structured frozen
admitted/rejected results distinguish valid rejection from malformed TypeError.
Priority is source_not_found > source_dead > source_ineligible > none.
Unknown target/self-target can pass actor-stage admission. No target policy,
execution, resources/death changes, Skill/Effect dependency or session authority.
Group A and CB01–CB05 remain intact. Phase IN_PROGRESS; PR #9 DRAFT; acceptance
PENDING; v0.4.2–v0.4.5 NOT_STARTED. Gameplay profile behavior NOT_EVALUATED.


## v0.4.2 current checkpoint: Target Validation

Group04 adds CB11-CB15: target existence through Entity getEntity, exact target/Life
identity, self by exact IDs and caller-resolved ally/enemy/neutral. Explicit closed
policies require nonempty unique relation/life lists. Dead targets may be accepted.
Admitted/none precondition; validation precedes missing > relation > life rejection.
Frozen detached result with accepted/rejected diagnostics. No faction authority,
spatial targeting, execution/damage/death/revival/Skill feature. Earlier milestone
sections above describe their historical checkpoints. Phase IN_PROGRESS, PR #9
DRAFT; Developer acceptance PENDING. v0.4.3-v0.4.5 NOT_STARTED.

## v0.4.3 current checkpoint: Attack Resolution

Group04 CB16–CB20 sequences structurally admitted/accepted matching stage results,
Kernel Hit/Dodge, Critical, B0, B1 and Mitigation using explicit caller numerical
snapshots/policy and lazy Foundation RNG. Frozen detached discriminated outcomes
omit unrun diagnostics after dodge. Critical is additive once; final damage is
calculated only. No HP/death/events/Skill/Effect implementation or persistent
Combat state. GF/EC/PG and CB01–CB15 remain intact. Phase IN_PROGRESS, PR #9 DRAFT,
Developer acceptance PENDING; v0.4.4/v0.4.5 NOT_STARTED. Gameplay profile behavior
remains NOT_EVALUATED. Earlier sections are historical checkpoint descriptions.

## v0.4.4 current checkpoint: Damage Application & Death

Group04 CB21–CB25 accepts actual CB20 receipts, caller target Resource/Life and
explicit life-resource/bounds/above-max policy. Positive damage runs canonical
Entity reduction then defeat with updated resources; calculated/applied damage
and Life transition outcomes remain distinct. Dodge/zero are validated no-ops.
No heal/revive/Skill/Effect/Encounter, automatic events/rewards, persistent Combat
state or exactly-once authority. Custom resources and player/monster parity work.
Prior sections are historical. Phase IN_PROGRESS; PR #9 DRAFT; acceptance PENDING;
v0.4.5 NOT_STARTED. Gameplay profiles NOT_EVALUATED.

## v0.4.5 current Combat review scope

Group04 CB01–CB30 implementation complete for review; phase REVIEW_PENDING,
Developer acceptance PENDING. Earlier sections describe milestone history.
CB26 full public Basic Attack/updated-state continuation; CB27 independent literal
replay/RNG/snapshot isolation; CB28 rejection and prior contract regression;
CB29 installed/root-only/strict types and ownership; CB30 full phase audit/review
handoff. No new mechanics/API/module. No Skill/Effect/AI/Encounter, spatial/turn/
realtime controller, automatic events/rewards, persistence or global authority.
Combat core function semantics VERIFIED; concrete game-mode integrations and
gameplay profiles NOT_EVALUATED. Agent does not close/accept the phase.

## v0.5.0 current Skill checkpoint

Combat CB01–CB30 is the accepted merged PR #9 baseline at 82feaf5; earlier pending
statuses above are historical. Group05 now implements SK01–SK05 only: optional
skill -> entity, reusable identity-only SkillDefinition and independent immutable
SkillInstanceState. L2 owns schema/structural validation; L3 owns concrete Skill
content/configuration. Progression retains Skill Rank/Points; Combat retains its
admission/target/numerical application contracts. Neither is a Skill dependency.
No availability, learning/unlocking, costs, cooldown, execution or loadout is
implemented. Skill phase IN_PROGRESS, PR DRAFT, acceptance PENDING; v0.5.1–v0.5.6
NOT_STARTED. Shared structural contracts verified; game profiles NOT_EVALUATED.

## v0.5.1 current Skill checkpoint

SK01–SK10 implemented: immutable identity foundation plus pure synchronous
Skill-stage availability/admission. Explicit actor binding/ownership, canonical
Entity existence/Life, caller-supplied canonical rank and L3 eligibility produce
frozen structured assessments. Full validation precedes deterministic rejection.
No learning/unlocking, costs, cooldown, execution, loadout, effects or global
state. Prior v0.5.0 availability/NOT_STARTED statements are historical.
Skill phase IN_PROGRESS; PR DRAFT; Developer acceptance PENDING.
v0.5.2–v0.5.6 NOT_STARTED. Game profiles NOT_EVALUATED.

## v0.5.2 current Skill checkpoint

Group05 now implements SK01–SK15: identities, availability and reusable explicit
Resource Costs. Sufficiency/application reuse Entity/Core and return an immutable
all-or-nothing candidate; no activation/execution, reservation, cooldown or store.
L3 owns cost/bounds policy; L4 owns runtime commit/concurrency. This supersedes
historical Skill scope above. Phase IN_PROGRESS, PR #10 DRAFT, acceptance PENDING;
v0.5.3+ requires separately submitted tasks. Gameplay profiles NOT_EVALUATED.

## v0.5.3 current Skill checkpoint

Group05 implements SK01–SK20, adding independent immutable cooldown state,
canonical Core duration, injected Foundation time and explicit ready/reuse
assessments/candidate starts. Zero/fractional durations and exact boundaries are
supported; malformed, rewound and unrepresentable time fails closed. No implicit
refresh/activation/cost commit, timer/scheduler/global store. L3 config and L4
time origin/commit remain caller-owned. Supersedes historical cooldown exclusions;
phase IN_PROGRESS, PR #10 DRAFT, acceptance PENDING; v0.5.4 NOT_STARTED.

## v0.5.4 current Skill checkpoint

Group05 implements SK01–SK25. Activation returns immutable all-or-nothing
Resource/Cooldown candidates plus execution references after admission, caller
preflight, cost and cooldown gates. Caller-mediated actual Combat handoff covers
rejection/dodge/landed; outcome reports only caller completion/failure. No Skill
Combat executor, authoritative commit, reservation, rollback/refund/exactly-once,
Effect System or complete game runtime. This supersedes historical activation
exclusions above. L3 policy and L4 commit/dispatch remain external.
Phase IN_PROGRESS, PR #10 DRAFT, Developer acceptance PENDING;
v0.5.5 slots/loadout NOT_STARTED; game profiles NOT_EVALUATED.

## v0.5.5 current Skill checkpoint

Group05 implements SK01–SK30. Loadout adds ordered immutable nullable instance
references, empty-layout support, canonical structural validation, assign/replace/
remove candidates and explicit L3 eligibility/duplicate policy. Duplicate/stale
references are structurally valid; no catalog authority is claimed. L4 owns active
loadout selection, resolution, persistence and authoritative commit. Assignment
is independent of learning, admission, resource, cooldown or Combat state.
This supersedes historical loadout exclusions above. No Skill inventory, global
registry, UI, move/swap, automatic activation or new gameplay module.
Phase IN_PROGRESS; PR #10 DRAFT; Developer acceptance PENDING;
v0.5.6 NOT_STARTED; concrete game profiles NOT_EVALUATED.
