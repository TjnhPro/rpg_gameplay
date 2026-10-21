## v0.7.6 Actor AI lifecycle checkpoint

AI31 reads Entity Life and composes existing target loss. AI32 provides explicit
metadata reset. AI33 composes disengage with existing FSM and caller World facts.
AI34 evaluates caller cadence through Foundation Clock. AI35 proves truthful
feedback/recovery continuity using canonical Combat/Skill and L4 commit fixtures.
AI01–AI30 remain prior accepted milestones. AI31–AI35 are scoped implementation;
final checkpoint depends on exact-head PR evidence. AI36–AI40 are OUT_OF_SCOPE.
No autonomous loop, revival, movement, refund, retry or game-specific policy.

## v0.7.5 Actor AI integration checkpoint

AI26 canonical Combat; AI27 canonical Skill; AI28 actual Effect restriction AND-gates;
AI29 immutable terminal feedback/correlation; AI30 caller-explicit fresh fallback:
IMPLEMENTED with installed fixture evidence. AI01–AI25 retained. Production adds
only feedback capture/validation; no AI execution authority or domain dependency.
AI31–AI40 OUT_OF_SCOPE. Phase IN_PROGRESS, Developer acceptance PENDING.
Concrete gameplay profiles NOT_EVALUATED. [report](reports/v0.7.5-combat-skill-effect-integration.md); previous statements historical.

## v0.7.4 Actor AI checkpoint

AI01–AI20 retained; AI21 Basic Attack Intent, AI22 Skill Use Intent, AI23 Movement
Intent (Approach/Return only), AI24 Priority & Fallback, AI25 Decision Outcomes
IMPLEMENTED as advisory data selection. L3 supplies behavior/action priority;
L4 supplies correlated availability and retains canonical admission/execution.
Explicit wait supported; missing availability fails closed per rule, no implicit wait.
AI26–AI40 OUT_OF_SCOPE. Phase IN_PROGRESS, acceptance PENDING. [report](reports/v0.7.4-ai-action-selection-intent.md).
Concrete gameplay profiles remain NOT_EVALUATED; earlier statements are historical.

## v0.7.3 Actor AI behavior checkpoint

AI16 generic state/profile policy, AI17 ordered FSM/guards, AI18 Idle/Guard,
AI19 configurable Aggressive/Defensive/Passive and AI20 Disengage/Return:
IMPLEMENTED with installed contract evidence. AI01–AI15 preserved.
L3 examples are test data, not framework presets. L4 supplies triggers and commits
behavior-only candidates. No target mutation/actions/World/spatial/automatic reset.
AI21–AI25(v0.7.4), AI26–AI30(v0.7.5), AI31–AI35(v0.7.6), AI36–AI40(v0.7.7)
remain OUT_OF_SCOPE. Phase IN_PROGRESS, acceptance PENDING. [Report](reports/v0.7.3-ai-behavior-state-transitions.md).
Concrete gameplay profiles NOT_EVALUATED; older statements are historical.

## v0.7.2 checkpoint delta

AI11 Target Selection Policy, AI12 Acquisition, AI13 Retention, AI14 Switching
and AI15 Loss/Outcomes are IMPLEMENTED. AI01–AI10 preserved. Explicit preferences
and lexical fallback determine selection; immutable candidate is not L4 commit.
AI16–AI40 remain OUT_OF_SCOPE. No behavior/action execution, Threat Engine or
World/Spatial implementation. Phase IN_PROGRESS; acceptance PENDING; profiles
NOT_EVALUATED. [Report](reports/v0.7.2-target-acquisition-selection.md).
Earlier status below is historical.

## v0.7.1 checkpoint delta

AI06 Perception Snapshot, AI07 Target Facts, AI08 Awareness Validation,
AI09 Candidate Filtering and AI10 Perception Outcomes are IMPLEMENTED.
AI01–AI05 preserved. AI11–AI40 remain OUT_OF_SCOPE (v0.7.2–v0.7.7).
L4 supplies observation facts/time; L3 supplies all eligibility gates; L2 captures,
validates and filters only. No target selection or World/Spatial implementation.
Actor AI phase IN_PROGRESS; Developer acceptance PENDING; profiles NOT_EVALUATED.
See [report](reports/v0.7.1-ai-perception-context.md). Earlier status is historical.

## Current checkpoint: v0.7.0 — Actor AI Foundation

Effect PR #11 is merged at baseline be716c4. AI01–AI05 implement actor identity,
opaque L3 profile references, immutable AI state, structural decision/action
contracts and an optional Entity-only module. Player, Monster, NPC, Pet, Summon,
Companion and arbitrary Entity kinds use the same six functions.
Manual states reject AI proposals; no_action reasons are controller-bound.
Target references do not imply target validity or action admission.
AI06–AI40 remain OUT_OF_SCOPE at this checkpoint: no perception, evaluator, target
selection, FSM transitions, priorities, execution, feedback, lifecycle or scheduler.
Actor AI phase IN_PROGRESS; Developer acceptance PENDING.
[Task](tasks/active/v0.7.0-actor-ai-foundation.md) /
[report](reports/v0.7.0-actor-ai-foundation.md). Concrete game profiles NOT_EVALUATED.
Earlier candidate statuses below are historical.

## Current patch candidate: v0.6.7-FIX01

EF01–EF40 remains the baseline. One explicit canonical Effect cleanup operation
now accepts caller-bound target death time, rejects unresolved earlier work and
cancels same-time/future ticks after Entity death; existing companion owners align.
This adds one public function/two types without new gameplay policy/module/engine.
Actual installed regression evidence and exact-head readiness are tracked in
[patch report](reports/v0.6.7-fix01-target-defeat-cleanup.md) / PR #11.
Developer acceptance PENDING; no merge/tag/publish; game profiles NOT_EVALUATED.

## Original closure candidate: v0.6.7 — EF01–EF40 (historical)

EF01–EF35 reusable capabilities preserved; EF36 full E2E, EF37 five generic source
origins and target isolation, EF38 independent literal replay/recovery, EF39 full
regression/audit and EF40 actual installed package/strict declarations are
IMPLEMENTED and locally verified. No new production source or public API.

Supported MVP: fixed pre-resolved DoT/HoT, timed/persistent independent stacks,
refresh/consume/remove, apply-time modifiers through Entity/Core and generic
restrictions handed to actual Skill/Combat/Effect admission. Skill activation uses
the existing caller dispatch; Item/Equipment are generic references, not new modules.
Environment/System use system sources without fake Entities. L4 owns cleanup and
atomic local publication. Advanced numerical variants remain DEFERRED_UNSUPPORTED
pending canonical capability/policy review, with no substitute formulas.

Final exact-head CI/readiness: [final review report](reports/v0.6.7-effect-final-review.md) and PR #11. Developer acceptance PENDING;
no merge/tag/publish. Concrete game profiles NOT_EVALUATED. Earlier sections are
historical checkpoint evidence, superseded by this closure candidate.

## Current checkpoint: v0.6.6 Periodic Effects — DoT / HoT

EF31–EF35 IMPLEMENTED: explicit immutable none/dot/hot captures, aligned per-instance
cursors, one-intent deterministic catch-up, tick at inclusive expiry boundary,
persistent/independent stack cadences, refresh preservation and exact lifecycle cleanup.
Installed L4 composition executes fixed pre-resolved DoT/HoT through real Entity/Core
Resource/Life. Death blocks subsequent ticks; source death remains independent.
Failed execution preserves cursor; stale completion/pending expiry advancement reject.
Modifier/status companions and EF01–EF30 remain intact.

Advanced numerical variants DEFERRED_UNSUPPORTED pending canonical capability review;
no formulas/workarounds, automatic scheduler, runtime, manager or production orchestration.
v0.6.7 Integration & Closure NOT_STARTED. Phase IN_PROGRESS; acceptance PENDING.
Framework contracts verified; concrete game profile behavior remains NOT_EVALUATED.
Earlier checkpoint sections are historical evidence, not current scope.

## Current checkpoint: v0.6.5 Effect Restrictions & Status

EF26–EF30 adds exact opaque status/restriction IDs, immutable apply-time snapshots,
ordered active contributor views and explicit exact-match restriction assessment.
L3 defines meaning/applicable actions; L4 binds the assessed Entity, ANDs existing
eligibility and passes unchanged Skill/Combat/EF08 policies. Installed examples
prove Stun/Silence/immunity through those canonical admissions. Assessment alone
is not full authorization. Lifecycle remains the sole membership/time authority;
status companion contains only Entity/time and per-instance payloads. Refresh
preserves capture; expiration/removal/consumption prune it. No numerical operation,
status vocabulary, action engine, periodic runtime or global registry. Foundation,
Application, Lifecycle, Stacking, Modifiers and Restrictions through0.6.5 are
IMPLEMENTED. DoT/HoT0.6.6 and Closure0.6.7 OUT_OF_SCOPE. Phase IN_PROGRESS,
acceptance PENDING; gameplay profiles NOT_EVALUATED. Earlier sections are history.

## Current checkpoint: v0.6.4 Buff / Debuff & Stat Modifiers

EF21–EF25 adds explicit buff/debuff/neutral metadata, immutable apply-time payload
snapshots and canonical Core modifier projection. A companion embeds the existing
lifecycle as its only instance authority and stores exactly one payload per active
instance. L4 synchronizes accepted lifecycle results and composes numerical sources;
Entity/Core calculate stats. Refresh retains payloads; consume/remove/expire prune
them. No stat cache/rollback, new math, catalog, restriction or periodic runtime.
Phase IN_PROGRESS, Developer acceptance PENDING; v0.6.5 NOT_STARTED. Gameplay
profile behavior NOT_EVALUATED. Earlier milestone sections are historical.

## Current checkpoint: v0.6.3 Effect Stacking & Refresh

EF16–EF20 add exact target/effect/sourceKey group views, source identity collision
checks, explicit stack/refresh policy and capacity, nonshortening single-anchor
renewal, exact-N consumption and whole-group removal. Membership/counts derive
from the existing canonical EffectState; lifetimes remain independent metadata.
L3 supplies policy; L4 owns freshness, clock advance and commit. Historical policy
changes cannot all be inferred without stored policy; L4 must preserve consistency.
Buff/Debuff modifiers, restrictions and DoT/HoT remain OUT_OF_SCOPE. Phase
IN_PROGRESS, Developer acceptance PENDING; v0.6.4 NOT_STARTED. Gameplay profile
behavior NOT_EVALUATED. Earlier checkpoint sections are historical.

## Current checkpoint: v0.6.2 Effect Duration & Lifecycle

EF11–EF15 implement timed/persistent duration, initialization from accepted EF09,
explicit Foundation-clock advancement, deterministic expiration, single-instance
removal and immutable returned events/candidates. One embedded EffectState remains
the instance owner; lifetime records contain timing references only. L3 supplies
duration, L4 advances/commits and requests external death cleanup.
Stack/refresh, buff/debuff, restrictions and DoT/HoT remain OUT_OF_SCOPE for this
checkpoint. No timer, scheduler, global store, numerical calculation or publication.
v0.6.x IN_PROGRESS; v0.6.3 NOT_STARTED; Developer acceptance PENDING. Gameplay
profile behavior remains NOT_EVALUATED. All sections below are checkpoint history.

## Current checkpoint: v0.6.1 Effect Application & Admission

EF06–EF10 add source-agnostic apply requests, canonical Entity lookup, explicit
caller life/eligibility policy, deterministic admission and immutable appended
EffectState candidates. Applied is structural acceptance, without active-timed
semantics or authoritative commit. Entity/System/Skill/Equipment/Environment
handoffs use the same API; no sibling module dependency is added.
Duration, active lifecycle, stack/refresh, modifiers, restrictions and DoT/HoT
remain NOT_IMPLEMENTED. v0.6.x IN_PROGRESS, v0.6.2 NOT_STARTED, Developer acceptance
PENDING. Existing gameplay profile behavior remains NOT_EVALUATED. Earlier
checkpoint sections below retain their historical scope.

## Current checkpoint: v0.6.0 Effect Foundation

EF01 identity, EF02 definition, EF03 instance, EF04 immutable structural state and
EF05 optional module integration are implemented for review. Effect IDs are
independent of Skill; entity/system source references preserve caller sourceKey.
No gameplay profile is evaluated by this structural milestone. Application,
active lifecycle, stack/refresh, modifiers, restrictions and DoT/HoT are
NOT_IMPLEMENTED. v0.6.x IN_PROGRESS; v0.6.1 NOT_STARTED; acceptance PENDING.
Skill PR #10 is the merged baseline. Earlier milestone status below is historical.

# L2 Gameplay Foundation — 14 accepted capability groups

## Skill v0.5.6 closure candidate

SK01–SK30 are exercised together by installed SK31–SK35 evidence: ranked Combat,
rankless caller execution, multi-resource payment, cooldown reuse, reference-only
loadout and deterministic rejection/replay. No production capability is added.
No Effect runtime, cast/channel, range/LOS, refund, persistent catalog or live
application runtime is claimed. Full gameplay profile behavior remains
NOT_EVALUATED; phase acceptance remains PENDING. See the
[final review](reports/v0.5.6-skill-final-review.md).


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

## v0.8.0 Encounter Foundation — EN01–EN05

Package @rpg/gameplay@0.8.0 adds five functions and six types at the root.
Optional encounter -> [entity] captures one engagement as an immutable five-field
snapshot. Factory status is always prepared; validation accepts the five status
names structurally and grants no lifecycle/World authority. Exact opaque IDs,
unique sides/participant Entity IDs, canonical current Entity membership, dense
own-data arrays and closed records are required. Empty/dead references are
structurally allowed; activation readiness is deferred.

No activation, dynamic Join/Leave, spawning, Combat/AI dispatch, completion,
rewards, global store or scheduler. EN06–EN40 are not implemented/authorized.
Phase IN_PROGRESS; Developer acceptance PENDING; phase PR remains Draft.
See [task](tasks/active/v0.8.0-encounter-foundation.md) and
[report](reports/v0.8.0-encounter-foundation.md).
