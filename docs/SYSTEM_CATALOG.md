# RPG Gameplay — System Catalog

Purpose: **capability discovery + correct owner routing**, not an approved work list,
API reference replacement, or authority competing with source.

Audit: 2026-10-22; branch `feat/v0.15-state-archive` based on `origin/main` at
`cf303335737da2b57421b1459eff2a0da154a60d`, plus ST01–ST05 changes described here;
package `@rpg/gameplay@0.15.0`. State Archive is implemented on this feature branch,
not asserted merged on main. Other capabilities retain the prior merged baseline.
Exact delivered branch SHA is recorded in the checkpoint report's PR evidence supplement.
`IMPLEMENTED`, Developer acceptance, and merged-on-main are separate facts. Merge
is observable (Currency PR19 is in this main); historical reports still say acceptance
PENDING. This catalog does not infer formal acceptance from a merge or green tests.

Sources of truth: [root exports](../src/index.ts), linked owner implementations/tests,
[declared graph](../harness/modules.json), [architecture](../ARCHITECTURE.md),
[Developer decisions](DECISIONS.md). See [API contracts](API.md),
[scope groups](GAMEPLAY_CAPABILITIES.md), [boundaries](MODULE_BOUNDARIES.md),
[task execution](TASK_EXECUTION.md), [testing](TESTING.md) and [verification](VERIFICATION.md).
Historical prose can describe an earlier checkpoint; source/exports plus actual tests
determine implementation, registry determines declared edges, Developer decides ownership.

## Harness read/update protocol

**Before proposing a new gameplay feature:** read this catalog as a mandatory task
discovery step. Identify existing capability and candidate canonical owner; verify
the relevant public API, implementation, tests and L1–L4 boundary. Reuse sufficient
capability. If insufficient, report an evidence-based gap and obtain Developer approval
before new implementation or API changes. The catalog is a navigation map, not an oracle.

**When an approved feature adds, changes or removes behavior:** update the matching
catalog entry **in the same approved feature change set**, including capability status,
API/evidence links and boundaries. Do not defer updates to phase closure. Do not claim
implementation before source evidence or acceptance before Developer approval. Feature
task scope/delivery must include the relevant catalog update.

If this file is outdated, report the discrepancy and audit the canonical owner. Correct
the catalog only when the current task permits it; otherwise request correction scope.
An outdated entry never authorizes duplicate mechanics, state, engines or calculators.

**Enforcement limitation:** these rules bind agents/harness workflows instructed to
read this file. A standalone Markdown file cannot force automatic reading. This task
does not change AGENTS.md, task entrypoints or agent bootstrapping. Global automatic
invocation requires an entrypoint/task-prompt change under a separately approved task.

## Quick system index

The original **14 accepted scope groups are not 14 implementation modules**.
All 14 registry modules below are optional. Dependencies list gameplay modules only;
Foundation and public Kernel usage are described in entries, not invented registry edges.

| System | Canonical location | Dependency | Current implementation status | Note / entry |
| --- | --- | --- | --- | --- |
| 01 Gameplay Foundation | src/foundation/ | no registry entry | IMPLEMENTED | [composition/lifecycle/ports](#gameplay-foundation-system) |
| 02 Entity / Character | src/modules/entity/ | entity → [] | IMPLEMENTED | [identity/stats/resources/life](#entity--character-system) |
| 03 Progression | src/modules/progression/ | progression → [entity] | IMPLEMENTED | [EXP/points/ranks](#progression-system) |
| 04 Combat | src/modules/combat/ | combat → [entity] | IMPLEMENTED | [attack/damage handoff](#combat-system) |
| 05 Skill | src/modules/skill/ | skill → [entity] | IMPLEMENTED | [admission/cost/cooldown/intent](#skill-system) |
| 06 Effect | src/modules/effect/ | effect → [entity] | IMPLEMENTED | [lifecycle/stack/status/tick intents](#effect-system) |
| 07 Monster & AI | Entity + src/modules/actor-ai/ | actor-ai → [entity] | IMPLEMENTED actor/AI capabilities | [no Monster Engine](#monster--ai-system) |
| 08 Encounter | src/modules/encounter/ | encounter → [entity] | IMPLEMENTED | [engagement lifecycle](#encounter-system) |
| 09 Item | src/modules/item/ | item → [] | IMPLEMENTED | [definition/instance/properties](#item-system) |
| 10 Inventory | src/modules/inventory/ | inventory → [item] | IMPLEMENTED | [quantity/capacity/full merge](#inventory-system) |
| 11 Equipment | src/modules/equipment/ | equipment → [item] | IMPLEMENTED | [slots/equip/replacement](#equipment-system) |
| 12 Loot | src/modules/loot/ | loot → [] | IMPLEMENTED | [weighted selection](#loot-system) |
| 13 Reward | src/modules/reward/ | reward → [] | IMPLEMENTED | [claim candidates/intents](#reward-system) |
| 14 Gameplay State & Persistence Contracts | src/modules/state-archive/ + domain owners | state-archive → [] | IMPLEMENTED structural archive only, on feature branch | [separate data from storage](#gameplay-state--persistence-contracts-system) |
| Additional phase/system — Currency | src/modules/currency/ | currency → [] | IMPLEMENTED | [wallet operations](#additional-phasesystem--currency-system) |

## Canonical owner routing guide

- **L1** [public pinned Kernel](CORE_INTEGRATION.md): canonical stats/modifiers,
  hit/critical/damage/mitigation, resource arithmetic and cooldown math used by existing
  L2 adapters. Verify the exact pinned API before assuming support for a new formula.
- **L2**: owner-specific identity/state validation, candidate transitions and assessments.
  Use package root APIs; source links here are audit navigation, not deep-import permission.
- **L3**: concrete item/skill/effect/loot/reward/currency content, curves, caps, balancing,
  eligibility and policy. Structural L2 definitions do not supply a game's catalog.
- **L4**: authoritative current state, cross-system orchestration/commit, persistence,
  UI/world/network, clock/RNG providers and actual event triggering. Foundation exposes
  explicit ports/dispatch, not an automatic simulation or authoritative game loop.

Route damage math → L1; Combat outcome → Combat; HP/Life → Entity. Skill ranks/points
→ Progression; activation/cost/cooldown/loadout → Skill; status/DoT/HoT → Effect.
Item identity/properties → Item; bag quantities → Inventory; occupied slots → Equipment.
Drop selection → Loot; entitlement/claim → Reward; wallet → Currency.
Monster actor → Entity; AI decision → Actor AI; engagement lifecycle → Encounter.
Cross-storage transfer, multi-system grant and concurrency → L4 composition, never
an implied L2 generic transaction engine.

## Gameplay Foundation System

- **Canonical owner / graph:** [modules](../src/foundation/modules/index.ts),
  [runtime](../src/foundation/runtime/index.ts), [messaging](../src/foundation/messaging/index.ts),
  [execution](../src/foundation/execution/index.ts); no gameplay registry entry.
- **Owns / does not own:** explicit capability composition, synchronous lifecycle and
  ports; no gameplay store, implicit hook wiring, scheduler or numerical calculator.
- **Implemented:** registration/configuration/dependency ordering (`registerModule`,
  `composeModules`); encapsulated lifecycle (`createGameplayRuntime`, `startGameplayRuntime`,
  `inspectGameplayRuntime`); owned commands (`dispatchCommand`) and explicit clock/RNG/IDs
  (`createExecutionContext`). Evidence: [foundation tests](../tests/unit/foundation.test.mjs).
- **Evidence gap:** event fan-out/cleanup (`subscribeEvent`, `publishEvent`,
  `unsubscribeModuleEvents`) exists in messaging source; current direct suite covers
  command dispatch, not comprehensive event failure/cleanup semantics.
- **Known non-owners:** OUT_OF_SCOPE L4 startup wiring, provider effects and simulation.
- **Where to extend:** matching Foundation owner for approved reusable coordination;
  game startup/provider selection belongs to L4. [Contract detail](API.md).

## Entity / Character System

- **Canonical owner / graph:** [entity](../src/modules/entity/index.ts); entity → [].
- **Owns / does not own:** entity identity, ordered collection, base attributes,
  resource/life snapshots; delegates numerical work to Kernel, owns no world or player DB.
- **Implemented:** collection and same-ID replacement (`createEntity`, `replaceEntity`),
  explicit stat calculation (`calculateEntityStats`), bounded resource/defeat/revival
  (`transitionEntityResource`, `resolveEntityDefeat`, `reviveEntity`). Evidence:
  [entity tests](../tests/unit/entity.test.mjs), [Combat handoff](../tests/unit/combat.test.mjs).
- **Known non-owners:** OUT_OF_SCOPE L3 class/initial-stat policy; L4 spawning,
  automatic recalculation and authoritative state. Regen/normalization APIs also exist;
  daily Entity tests do not exhaust their policies.
- **Where to extend:** Entity contracts here; numerical gaps require L1 capability
  review, never a copied L2 calculator. [Contract detail](API.md).

## Progression System

- **Canonical owner / graph:** [progression](../src/modules/progression/index.ts); progression → [entity].
- **Owns / does not own:** EXP/level, distinct attribute/skill point pools and skill ranks;
  no Skill activation ownership, automatic reward grants or global character state.
- **Implemented:** explicit EXP/advancement (`gainExperience`, `advanceProgressionLevel`)
  and point reward/allocation (`grantAttributePointRewards`, `allocateAttributePoints`).
  Evidence: [progression tests](../tests/unit/progression.test.mjs).
- **Evidence gap:** `getSkillRank`/`upgradeSkillRank` and skill-point rewards have source
  implementations; the current direct Progression case focuses on EXP/attribute points,
  not independent skill-point isolation/regression coverage.
- **Known non-owners:** OUT_OF_SCOPE L3 curves, costs and prerequisites; L4 commit.
- **Where to extend:** same owner for approved progression transitions; skill execution
  routes to Skill/Combat, not a second rank store. [Contract detail](API.md).

## Combat System

- **Canonical owner / graph:** [combat](../src/modules/combat/index.ts); combat → [entity].
- **Owns / does not own:** action admission/target policy/outcome and damage handoff;
  Entity owns HP/Life, Kernel owns hit/critical/damage/mitigation arithmetic.
- **Implemented:** admitted attacks and relation checks (`evaluateCombatActionAdmission`,
  `evaluateCombatTargetValidation`); deterministic injected-RNG resolution and canonical
  damage/defeat handoff (`resolveCombatAttack`, `applyCombatAttackDamage`). Evidence:
  [combat tests](../tests/unit/combat.test.mjs).
- **Known non-owners:** OUT_OF_SCOPE L3 PvP/target facts/formula inputs; L4 scheduling,
  receipt freshness and commit. Lifesteal is not established by these attack APIs.
- **Where to extend:** approved Combat contracts here; audit Entity and pinned Kernel
  before any new numerical mechanic. [Contract detail](API.md).

## Skill System

- **Canonical owner / graph:** [skill](../src/modules/skill/index.ts); skill → [entity].
- **Owns / does not own:** identity/instances, admission, resource payment, cooldown,
  activation intent and slot references; no rank store, delivery executor or scheduler.
- **Implemented:** `evaluateSkillActivationAdmission`, `applySkillResourceCosts`,
  `startSkillCooldown`/`evaluateSkillCooldownReady` use Entity/Kernel and caller clock.
  Evidence: [skill tests](../tests/unit/skill.test.mjs).
- **Evidence gap:** `activateSkill`, `reportSkillExecutionOutcome` and
  `assignSkillLoadoutSlot` implement candidate/intent/report/loadout behavior in source;
  the current direct Skill case does not exercise the full activation/loadout pipeline.
- **Known non-owners:** OUT_OF_SCOPE Progression ranks, L3 concrete content and L4
  actual dispatch/visuals/refund policy. Reports alone do not prove execution occurred.
- **Where to extend:** Skill owner for approved reusable activation contracts; audit
  Combat/Effect and L1 separately for delivery/numerical needs. [Contracts](API.md).

## Effect System

- **Canonical owner / graph:** [effect](../src/modules/effect/index.ts); effect → [entity].
- **Owns / does not own:** effect identity, lifecycle membership, stacks, captured
  modifier/status data and periodic cursors/intents; no HP calculator or background ticks.
- **Implemented:** admission/application and explicit timed expiration (`applyEffect`,
  `startEffectLifetime`, `advanceEffectLifecycle`). Evidence:
  [effect tests](../tests/unit/effect.test.mjs).
- **Source-present, limited daily evidence:** stacking/refresh (`applyEffectStack`),
  modifier projection (`listActiveEffectModifiers`), restriction gates
  (`evaluateEffectRestrictionGate`), DoT/HoT intents (`getNextDueEffectTick`,
  `completeEffectPeriodicTick`) and defeat cleanup (`cleanupDefeatedTargetEffects`).
  Current direct Effect case covers application/expiry, not these complete flows.
- **Known gaps:** DEFERRED advanced periodic scaling/resistance/critical policies
  ([numerical audit](CORE_INTEGRATION.md)); OUT_OF_SCOPE Entity resource/Life changes,
  L3 amounts/restriction interpretation and L4 tick execution/atomic cursor commit.
- **Where to extend:** same Effect owner after L1/Entity audit; no second DoT engine
  or inferred lifesteal formula. [Contract detail](API.md).

## Monster & AI System

- **Canonical owner / graph:** [Entity](../src/modules/entity/index.ts) owns actors;
  [actor-ai](../src/modules/actor-ai/index.ts) owns decisions; actor-ai → [entity].
- **Owns / does not own:** AI snapshots, perception filtering and advisory selection;
  no separate Monster Engine, world sensing, attack executor or duplicate actor state.
- **Implemented:** `evaluateActorAIPerception`, `evaluateActorAITargetSelection`,
  `evaluateActorAILifeGate` with explicit observations/manual/dead gates. Evidence:
  [actor-ai tests](../tests/unit/actor-ai.test.mjs).
- **Evidence gap:** behavior/action priority (`evaluateActorAIBehaviorTransition`,
  `evaluateActorAIActionSelection`), reset/timing (`evaluateActorAIReset`,
  `evaluateActorAIDecisionTiming`) and `validateActorAIActionExecutionFeedback` exist
  in source; current direct case does not prove the entire execution/replay pipeline.
- **Known non-owners:** OUT_OF_SCOPE L3 profiles/monster templates; L4 perception
  truth, active controller, dispatch and feedback freshness.
- **Where to extend:** Entity for actor state, Actor AI for approved advisory behavior;
  audit before assigning a new AI capability to an engine. [Contracts](API.md).

## Encounter System

- **Canonical owner / graph:** [encounter](../src/modules/encounter/index.ts); encounter → [entity].
- **Owns / does not own:** one engagement, sides/roster, lifecycle and completion
  assessment; no zone/dungeon/world authority or Combat/AI implementation.
- **Implemented:** `activateEncounter`, `applyEncounterMembershipChange`,
  `evaluateEncounterActionScope`, `evaluateEncounterCompletion`, `resolveEncounter`,
  `closeEncounter`. Evidence: [encounter tests](../tests/unit/encounter.test.mjs).
- **Evidence gap:** cancellation/cleanup handoff (`cancelEncounter`,
  `createEncounterCleanupHandoff`) exist in source but are not fully exercised by that case.
- **Known non-owners:** OUT_OF_SCOPE L3 victory/objective/side policy; L4 spawning,
  truthful current observations, recovery orchestration and authoritative commit.
- **Where to extend:** same owner for approved engagement contracts; compose existing
  Entity/Combat/AI through L4 rather than adding dependency edges. [Contracts](API.md).

## Item System

- **Canonical owner / graph:** [item](../src/modules/item/index.ts); item → [].
- **Owns / does not own:** definition/instance identity, detached property data and
  advisory stack compatibility; no bag quantity, equipped slots or item-stat calculator.
- **Implemented:** `createItemDefinition`, `createItemInstance`, `setItemInstanceProperty`,
  `assessItemStackCompatibility`. Evidence: [item tests](../tests/unit/item.test.mjs).
- **Known non-owners:** OUT_OF_SCOPE L3 item catalogs, affix generation and balancing;
  Inventory/Equipment own storage, L4 owns grants/commit. Stack compatibility does not merge.
- **Where to extend:** approved Item data/operations here; numerical modifier policy
  must route through Entity/L1, not arbitrary property arithmetic. [Contracts](API.md).

## Inventory System

- **Canonical owner / graph:** [inventory](../src/modules/inventory/index.ts); inventory → [item].
- **Owns / does not own:** ordered Item membership/quantities, entry capacity and full
  merge proposals; no Item identity owner or cross-storage transaction coordinator.
- **Implemented:** validated snapshots (`createInventoryState`), lookup/capacity
  (`getInventoryEntry`, `assessInventoryCapacity`), add/remove/quantity
  (`addInventoryEntry`, `adjustInventoryQuantity`) and full `mergeInventoryEntries`.
  Evidence: [state](../tests/unit/inventory.test.mjs), [queries](../tests/unit/inventory-queries.test.mjs),
  [mutations](../tests/unit/inventory-mutations.test.mjs), [merge](../tests/unit/inventory-merge.test.mjs).
- **Known gaps/non-owners:** DEFERRED split/partial merge/transfer per [current API](API.md);
  OUT_OF_SCOPE L3 capacity/stack rules and L4 multi-storage freshness/commit.
- **Where to extend:** same Inventory owner for approved local quantity behavior;
  compose with Equipment in L4, never copy Item/Equipment state.

## Equipment System

- **Canonical owner / graph:** [equipment](../src/modules/equipment/index.ts); equipment → [item].
- **Owns / does not own:** Item slot occupancy, admission and equip/unequip/replacement
  candidates; no Inventory writes, stat engine or automatic modifier activation.
- **Implemented:** `createEquipmentState`, `assessEquipmentAdmission`, `equipEquipmentItem`,
  `unequipEquipmentItem`, `replaceEquipmentItem`; replacement returns the released Item.
  Evidence: [state](../tests/unit/equipment.test.mjs), [admission](../tests/unit/equipment-admission.test.mjs),
  [operations](../tests/unit/equipment-operations.test.mjs).
- **Composition evidence only:** [equipment integration](../tests/unit/equipment-integration.test.mjs)
  delegates to a test-local consumer for Inventory handoff and Entity/Core recalculation;
  this is not a production transfer or modifier-wiring service.
- **Known non-owners:** OUT_OF_SCOPE L3 slot/item eligibility and modifier settings;
  L4 cross-storage atomic commit and recalculation trigger.
- **Where to extend:** Equipment for approved slot semantics, Item for item data,
  Entity/L1 for recalculation; audit all candidates before committing. [Contracts](API.md).

## Loot System

- **Canonical owner / graph:** [loot](../src/modules/loot/index.ts); loot → [].
- **Owns / does not own:** validated weighted tables and structural drop intents;
  no Item creation, wallet writes, Reward claim or implicit RNG.
- **Implemented:** `createLootTableDefinition`, `validateLootRollResult`, `rollLootTable`;
  one caller sample selects no-drop or one ordered entry. Evidence:
  [table contracts](../tests/unit/loot.test.mjs), [selection](../tests/unit/loot-selection.test.mjs).
- **Composition evidence only:** [loot integration](../tests/unit/loot-integration.test.mjs)
  uses real Item/Inventory APIs through a caller fixture, not automatic grant delivery.
- **Known non-owners:** OUT_OF_SCOPE L3 weights/content and L4 sample generation,
  entitlement and delivery. Gold references do not automatically create Currency grants.
- **Where to extend:** same owner for approved selection semantics; delivery routes
  through Reward/Currency/Inventory as explicit L4 composition. [Contracts](API.md).

## Reward System

- **Canonical owner / graph:** [reward](../src/modules/reward/index.ts); reward → [].
- **Owns / does not own:** immutable resolved packages/claims and opaque grant intents;
  no Item/EXP/Currency delivery, entitlement authority or transaction backend.
- **Implemented:** `createRewardPackage`, `createRewardClaimState`, `prepareRewardClaim`
  return claimed candidates/intents or already_claimed/ineligible. Evidence:
  [state](../tests/unit/reward.test.mjs), [planning](../tests/unit/reward-claim-planning.test.mjs).
- **Composition evidence only:** [Reward consumer](../tests/unit/reward-integration.test.mjs)
  proves Item/EXP handoff; [Currency consumer](../tests/unit/currency-integration.test.mjs)
  proves currency handoff/failure/replay. Neither is a production grant dispatcher.
- **Known non-owners:** OUT_OF_SCOPE L3 content/eligibility; L4 validates intent kind,
  amount and recipient, prepares all owner candidates and commits atomically. No global exactly-once claim.
- **Where to extend:** approved claim/intent behavior here; numerical/delivery behavior
  remains with canonical grant owners, coordinated by L4. [Contracts](API.md).

## Gameplay State & Persistence Contracts System

- **Canonical owner / graph:** [state-archive](../src/modules/state-archive/index.ts);
  state-archive → []. Existing domain owners retain their snapshots and semantic validators.
- **Owns / does not own:** portable ordered versioned archive representation/structural
  capture only; no global state, persistence, domain reconstruction or authoritative restore.
- **Implemented ST01–ST05:** `validateGameplayStateRecord`, `validateGameplayStateArchive`
  capture detached deeply frozen JSON-compatible payloads, exact triple identities,
  independent positive version labels and safe own keys. Reject lossy/hostile structures
  including -0 without invoking getters. Evidence: [archive tests](../tests/unit/state-archive.test.mjs).
- **Known gaps:** PLANNED approved phase direction for assembly/inspection and explicit
  compatibility/restore preparation, each awaiting its own implementation instruction;
  no query/factory/version acceptance policy in this checkpoint. Structural acceptance
  never proves owner semantics, cross-system consistency or a migration strategy.
- **Where to extend:** same State Archive owner for approved portable format operations;
  domain validation stays with each owner, L3 chooses records/schema policy, L4 performs
  serialization/storage/owner calls/freshness/all-or-nothing publication. No implicit
  adapter registry or duplicate validator. [Checkpoint](reports/v0.15.0-state-archive-foundation.md).

## Additional phase/system — Currency System

- **Canonical owner / graph:** [currency](../src/modules/currency/index.ts); currency → [].
  Additional system, not a replacement for original group14.
- **Owns / does not own:** independent wallet identity, neutral owner, ordered safe-integer
  balances and immutable operation candidates; no catalog, ledger or economic authority.
- **Implemented:** `createCurrencyWalletState`, `validateCurrencyWalletState`,
  `getCurrencyBalance`, `creditCurrency`, `debitCurrency`; explicit admission/cap,
  overflow protection and retained zero entries. Evidence: [currency tests](../tests/unit/currency.test.mjs).
- **Composition evidence only:** [Currency integration](../tests/unit/currency-integration.test.mjs)
  runs real Reward intents with failure/replay/stale isolation in a local L4 fixture.
- **Known non-owners:** OUT_OF_SCOPE L3 currency existence/prices/caps, L4 authoritative
  commit/concurrency, transfer/exchange/billing/persistence; no production multi-wallet coordinator.
- **Where to extend:** approved local wallet bookkeeping here; coordinate grants or
  purchases with other owners in L4, not a new Wallet Manager. [Contracts](API.md).

## Status legend and evidence rules

- **IMPLEMENTED:** behavior exists on the baseline in production source, with public
  API when applicable and linked function-level evidence. Source-present APIs with
  limited/missing current direct coverage have explicit evidence-gap notes; exports
  alone never prove tested semantics or production integration.
- **IN_PROGRESS:** verified code on another branch/PR, absent on baseline; must name
  the checked ref/PR. None is asserted here without a separate live audit.
- **PLANNED:** Developer-approved roadmap/task for behavior not yet in baseline code.
  Accepted scope alone does not approve API, schema or implementation.
- **DEFERRED:** documented gap outside current MVP; not authority to implement it.
- **OUT_OF_SCOPE:** another system/layer owns this concern, not a missing local API.
- **UNVERIFIED:** insufficient evidence; do not convert it to IMPLEMENTED or assert
  universal absence. Audit other owners before inventing one.

Developer acceptance is separate from implementation/merge/CI. Current direct tests
are deliberately compact, not the historical installed-consumer or eight-job matrix.
Test-local composition is labeled as such; no game-profile, durable transaction,
global replay/concurrency or backend assurance follows. Do not recreate removed tests
or quotas merely to maintain this document.

## Maintenance checklist

1. Feature request → read catalog → verify root/source/tests → route owner and L1–L4
   → document reuse/gap → obtain approval for the implementation scope.
2. In the approved feature change set, update affected behavior/status/API/evidence,
   ownership and removed/deprecated capability. Do not wait until phase end.
3. Before review/merge, compare code/API/registry/test diff with catalog; never describe
   future work, external Draft branches or fixtures as implemented production on main.
4. If correction is outside task permissions, report discrepancy/gap and obtain scope;
   do not silently edit protected docs or bypass canonical owners.
5. Refresh audit branch/date/baseline when relevant code changes. This SHA records
   freshness, not a runtime invariant or requirement to freeze future main.

Navigation review probes (routing checks, not implemented game mechanics):

- **Lifesteal on hit:** inspect Combat hit/applied damage, Entity resource/Life,
  Effect intent/status capability and pinned Kernel requirements. No lifesteal formula
  or automatic on-hit consumer is established here; present the concrete gap first.
- **Equip Sword from Inventory:** resolve Item identity, Inventory removal/capacity,
  Equipment admission/released Item and L4 all-candidate handoff; no duplicate storage engine.
- **Drop Gold or reward EXP:** Loot selects intents, Reward prepares claims, Currency
  credits wallets and Progression grants EXP. All these owners exist on this baseline;
  composing/committing them is L4 work, not an automatic Loot or Reward production service.
