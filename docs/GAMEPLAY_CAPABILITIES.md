# L2 Gameplay Foundation — 14 accepted capability groups

**Accepted scope**, not an instruction to write 14 packages/classes or implement all at once. Each capability can be optional. Evaluate owners and dependencies only when a task reaches that capability.

| # | Capability group | Reusable responsibility | Examples left to L3 |
| --- | --- | --- | --- |
| 01 | Gameplay Foundation | lifecycle/registration/composition of optional capabilities; explicit clock/RNG contracts | game startup choices |
| 02 | Entity / Character | identity and gameplay character state, actor/resource storage | character names, game classes, initial stats |
| 03 | Progression | EXP/level/upgrades rules interface & state transitions | level curves, talent restrictions |
| 04 | Combat | action admission, target policy interfaces, damage application/lifecycle | PvP/PvE rules, game formula selection |
| 05 | Skill | skill instance/availability/activation/cost/cooldown lifecycle | skill definitions, skill ranks/visuals |
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
creation through one shared actor API. PG04–PG19 remain NOT_STARTED. This does not
implement experience gain, advancement, curves, points or skill upgrades. Phase
IN_PROGRESS; Developer acceptance PENDING until final v0.3.5 review.
