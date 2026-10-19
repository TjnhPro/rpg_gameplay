# AGENTS.md — RPG Gameplay

Repository này là **L2 reusable headless function-first RPG framework**, KHÔNG phải game.

## Đọc trước khi làm
1. `README.md` — mục tiêu, trạng thái hiện tại và entry points.
2. `ARCHITECTURE.md` + `docs/DECISIONS.md` — quyết định của Developer.
3. `docs/TASK_EXECUTION.md` — **chỉ implement task có plan được Developer duyệt**.
4. `docs/TESTING.md` + `docs/VERIFICATION.md` — chứng minh hành vi bằng tests tối thiểu đủ giá trị.
5. `docs/CORE_INTEGRATION.md` + `harness/modules.json` — numerical Kernel, module owners.
6. `docs/GAMEPLAY_CAPABILITIES.md` — 14 nhóm candidate đã chốt ở cấp scope, **không phải package/API đã chốt**.

## Invariants bắt buộc
- **Plan-first**: task được thảo luận và duyệt trên ChatGPT trước. Không tự thiết kế lại scope, public API hoặc roadmap.
- **Function-only**: code thuần TypeScript/functions, headless. Không xây Text/2D/2.5D game, UI, renderer, engine adapters để 'test'.
- **Kernel-only**: L2 chỉ import `@rpg/core/kernel`; không import root/Legacy/internal của `@rpg/core`.
- **Single canonical owner**: không tạo calculator mới thay Core; không nhân bản Gameplay Engine/Skill/Effect/Inventory implementations.
- **Modular**: module optional khi phù hợp; module deps rõ; không có dependency L2 -> L3/L4.
- **No default game policy**: game-specific settings/content ở L3; không hardcode một game thành framework chung.
- **Controlled randomness/time**: RNG và time do caller cấp, test phải tái hiện được khi hành vi phụ thuộc chúng.
- **Evidence-focused tests**: mỗi test phải chứng minh contract/invariant; expected độc lập; không đặt KPI số test.
- **Escalate**: bất kỳ change Core, ownership/architecture breaking, feature gap ngoài plan -> STOP với evidence và options, đợi Developer quyết định.

## Quy trình agent
Preflight repo & approved task -> xác nhận boundaries -> implement chỉ trong scope -> viết functional/contract evidence -> `npm run verify` -> self-review -> báo cáo PASS/BLOCKED và các gate chưa chạy. Developer tự quyết định acceptance.

## Quick commands
- `npm run harness:check`: check registry, imports, module boundary.
- `npm run harness:selftest`: chứng minh checker bắt được các vi phạm cơ bản.
- Fresh install: `npm run core:prepare` then `npm ci --ignore-scripts` (see Core integration).
- `npm run verify`: boundaries, self-tests, build, strict typecheck and installed-package contracts including GF01–GF09. Gameplay execution/profiles remain NOT_EVALUATED.

Không claim gameplay pass khi chưa có gameplay. Không sửa baseline/expected chỉ để làm test xanh.
