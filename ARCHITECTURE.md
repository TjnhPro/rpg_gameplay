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

- Reusable module source: `src/modules/<module-id>/`.
- Module register: `harness/modules.json`, initially empty.
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
