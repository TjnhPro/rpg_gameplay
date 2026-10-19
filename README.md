# RPG Gameplay — Harness Foundation

> **Status: SCAFFOLD ONLY.** Đây là repository mới cho L2 `rpg_gameplay`.
> ZIP này cài đặt knowledge base, quy trình approved-task, module registry và các kiểm tra Harness ban đầu. **Chưa có gameplay implementation hoặc gameplay functional tests.**

## Mục tiêu

Phát triển thư viện **headless, function-first, reusable RPG gameplay** dùng cho Text RPG, RPG 2D, RPG 2.5D (và mở rộng turn-based khi cần), không xây một game ứng dụng trong repo này.

- L1: `@rpg/core/kernel` — tính toán numerical canonical.
- L2: `rpg_gameplay` — reusable, optional gameplay capabilities; ownership rõ; không duplicate Kernel.
- L3: game rules/content/builder — cấu hình và nội dung riêng từng game.
- L4: game application — UI, render, networking, persistence adapters.

## Khởi tạo

1. Giải nén ZIP; thư mục `rpg_gameplay/` là repo root.
2. `cd rpg_gameplay && git init` (hoặc copy nội dung vào repo mới).
3. Dùng Node.js >=22.13.0: chạy `npm run verify` để kiểm tra **Harness scaffold**.
4. Đọc [AGENTS.md](AGENTS.md), [ARCHITECTURE.md](ARCHITECTURE.md), [docs/DECISIONS.md](docs/DECISIONS.md).
5. Khi có *task đã duyệt từ ChatGPT*, lưu plan theo [docs/TASK_EXECUTION.md](docs/TASK_EXECUTION.md), rồi giao agent triển khai.
6. Trước task gameplay đầu tiên, pin/install artifact của `rpg_core` theo [docs/CORE_INTEGRATION.md](docs/CORE_INTEGRATION.md) và bổ sung `typecheck` + `test:functional` ở task đã duyệt.

`npm run verify` **chỉ thông báo Harness PASS** khi chưa có `src/`; không được diễn giải là 14 chức năng gameplay đã kiểm thử.

## Điều hướng

| Đọc | Để làm gì |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Điểm vào cho coding agents |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Ranh giới L1–L4 và module ownership |
| [docs/GAMEPLAY_CAPABILITIES.md](docs/GAMEPLAY_CAPABILITIES.md) | 14 nhóm tính năng đã duyệt, không phải 14 package |
| [docs/HARNESS_CAPABILITIES.md](docs/HARNESS_CAPABILITIES.md) | H01–H16 và mức triển khai hiện tại |
| [docs/TASK_EXECUTION.md](docs/TASK_EXECUTION.md) | Approved plan, stop conditions, acceptance |
| [docs/TESTING.md](docs/TESTING.md) | Function-only tests; evidence thay cho số lượng |
| [docs/VERIFICATION.md](docs/VERIFICATION.md) | Commands và giới hạn từng gate |
| [harness/modules.json](harness/modules.json) | Registry module ban đầu rỗng |

## Reference

- [OpenAI — Harness engineering](https://openai.com/index/harness-engineering/)
- [TjnhPro/rpg_core](https://github.com/TjnhPro/rpg_core) (`@rpg/core/kernel`)

Không có migration, legacy compatibility, game examples, renderer hoặc gameplay code trong scaffold.
