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

Exact module splits, exported APIs, object vs functional store contracts, package boundaries, runtime adapters, test runner/version, persistence schema, detailed gameplay mechanics, turn/realtime scheduler — decide **per approved task** with evidence. Harness's initial CLI runs dependency-free under Node; introduce TS tooling with the first module task.
