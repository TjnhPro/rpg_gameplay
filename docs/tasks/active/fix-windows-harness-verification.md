# TASK — fix-windows-harness-verification

**Status:** APPROVED for implementation; Developer acceptance PENDING.
**Approval evidence:** Developer task in this session, 2026-10-19, reproduced below.
**Baseline:** Unborn `master`; entire Harness Foundation untracked; no configured remote.
**Core dependency:** NOT_REQUIRED.

## Approved task text

# Task — Fix Windows Harness Verification & Push to GitHub

**Repository:** `D:\python_code\game_dev\jx1_web\rpg-gameplay`

**Mục tiêu:** Sửa lỗi `npm run verify` trên Windows, kiểm chứng toàn bộ Harness Foundation, sau đó Git commit và push lên GitHub.

## 1. Vấn đề

Chạy:
```
npm run verify
```

Gặp lỗi:
```yaml
'C:\Program' is not recognized as an internal or external command,
operable program or batch file.

VERIFY_FAIL: C:\Program Files\nodejs\node.exe scripts/check-boundaries.mjs
```

Nguyên nhân dự kiến: Script gọi `process.execPath` thông qua shell mà không xử lý đúng đường dẫn chứa khoảng trắng.

## 2. Yêu cầu triển khai

1. Đọc `AGENTS.md` và các quy định Harness hiện có.
2. Kiểm tra `scripts/verify.mjs` và những script liên quan.
3. Sửa lỗi theo hướng cross-platform Windows/Linux/macOS, ưu tiên `spawnSync` hoặc `execFileSync` với `shell: false` và argument array.
4. Kiểm tra các subprocess khác để tránh lỗi tương tự.
5. Không thay đổi architecture, gameplay contracts hoặc bổ sung gameplay features.
6. Không tạo migration, application, game simulator hoặc các testcase không liên quan.

## 3. Verification

Bắt buộc chạy và ghi nhận kết quả thực tế:
```
npm run verify
```

Kiểm chứng thêm:

- Harness boundary checks PASS.
- Harness self-tests PASS.
- Không còn lỗi đường dẫn `C:\Program Files`.
- Không có verification step bị bỏ qua âm thầm.
- Không báo cáo gameplay tests PASS nếu chưa có gameplay implementation.
- Không cần tạo thêm test nếu kiểm chứng hiện có đã chứng minh được lỗi được xử lý.

Nếu phát hiện lỗi khác trong Harness Foundation, được phép sửa trong phạm vi cần thiết để hoàn thành verification, nhưng không được mở rộng sang gameplay implementation.

## 4. Git Commit & Push

Sau khi verification PASS:

1. Kiểm tra `git status` và `git diff`.
2. Chỉ commit những thay đổi thuộc task hoặc Harness Foundation đã được phép đưa lên repository.
3. Không commit secrets, build artifacts, logs hoặc file tạm.
4. Commit với message phù hợp, ví dụ:
```scss
git commit -m "fix(harness): make verification cross-platform"
```

5. Push lên GitHub bằng branch hiện tại và remote đã cấu hình. Nếu chưa có remote hoặc thiếu quyền truy cập, báo cáo BLOCKED, không tự tạo repository hoặc thay đổi remote.
6. Không force push.

## 5. Acceptance Criteria

- `npm run verify` PASS trên môi trường Windows hiện tại.
- Các kiểm tra Harness đang có vẫn hoạt động.
- Fix không phụ thuộc đường dẫn cài đặt Node.js cụ thể.
- Working tree sạch sau commit nếu không có thay đổi ngoài task.
- Commit và push thành công lên đúng GitHub repository.

## 6. Báo cáo cuối cùng

Trả lời ngắn gọn theo cấu trúc:

- **Status:** PASS / BLOCKED
- **Root cause:** Nguyên nhân thực tế
- **Changes:** Files đã sửa
- **Verification:** Lệnh và kết quả
- **Git:** Branch, commit SHA, push status
- **GitHub:** URL commit hoặc PR nếu có

**Được phép tự triển khai, kiểm chứng, commit và push trong phạm vi task này. Không cần xin duyệt lại cho các sửa lỗi kỹ thuật thông thường. Chỉ dừng nếu phát sinh thay đổi ngoài scope hoặc không thể kiểm chứng.**

## Execution boundaries

Owner: Harness scripts only; no module, Core, dependency or gameplay contract changes.
Use direct Node subprocesses and the invoking npm CLI for production gates.
Commit the authorized existing Harness Foundation and task record on `master`.
Original task prohibited creating a remote/repository. Developer follow-up in
this session explicitly authorized: "public lên github với repo rpg_gameplay".
Create public `TjnhPro/rpg_gameplay` and publish the current `master` branch.

## Result

- Implementation: `scripts/verify.mjs` uses `spawnSync` with argument arrays and
  `shell:false`; production npm gates use `process.execPath` + `npm_execpath`.
  Spawn errors/signals are reported; failed commands retain nonzero exit status.
- Reproduction before fix: `npm run verify` failed with `'C:\Program' is not
  recognized` at the first boundary subprocess.
- Windows environment: Node v24.18.0 at `C:\Program Files\nodejs\node.exe`, npm 12.2.0.
- `npm run verify`: exit 0, `HARNESS_BOUNDARIES_PASS modules=0 source_files=0`,
  `HARNESS_SELFTEST_PASS 11 focused controls`, `HARNESS_VERIFIED`.
- `GAMEPLAY_NOT_EVALUATED`: no production source or actual gameplay tests exist.
- Temporary Harness fixture in a directory with spaces: both declared npm gates
  executed; failing first gate propagated exit 7 without running the second or
  printing success; missing typecheck script failed explicitly with exit 1.
  These are orchestration probes, not gameplay/typecheck evidence. Fixture removed.
- Subprocess audit: `verify.mjs` is the only existing subprocess launcher.
- Linux/macOS execution and remote CI: NOT_RUN in this Windows environment.
- Git delivery: initial commit `753633248318da684147c868ac58bba599566c85`
  includes authorized existing Harness Foundation and this task. Initially blocked
  because no remote was configured; follow-up authorizes public GitHub publication.
- Status: local Harness READY_FOR_REVIEW; publication authorized by follow-up.
- Developer acceptance: PENDING.
