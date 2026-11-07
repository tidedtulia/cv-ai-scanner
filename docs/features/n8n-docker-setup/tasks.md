# Tasks: Setup n8n trên Docker

Feature branch: `feature/n8n-docker-setup`
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md) · Hướng dẫn sử dụng: [n8n-setup.md](./n8n-setup.md)

---

## Phân tích & scenario

- [x] Chốt NQ1–NQ4, version `n8nio/n8n:2.46.6`, profile `n8n`, role `n8n`, chỉ `127.0.0.1` (2026-11-07)
- [x] Kiểm trên image 2.46.6:
  - owner qua `N8N_INSTANCE_OWNER_*` (bcrypt);
  - `import:credentials` tự mã hoá dữ liệu plain và upsert theo `id`;
  - có sẵn `bcryptjs`.
- [x] Scenario AC-1 → AC-17 trong [requirements.md](./requirements.md)
- [x] Bạn review scenario (2026-11-07)

## Docker & script

- [x] `docker-compose.dev.yml`, profile `n8n`:
  - service `n8n-init` (`postgres:16-alpine` chạy `n8n/setup/init-db.sh`);
  - service `n8n` (`depends_on`: `db` healthy và `n8n-init` completed; healthcheck `/healthz/readiness`; `127.0.0.1:${N8N_HOST_PORT:-5678}`; volume `n8n_data`; bind-mount `n8n/setup` (chỉ đọc) và `n8n/workflows`).
- [x] `n8n/setup/init-db.sh`:
  - kiểm tra biến; báo lỗi rõ nếu database ứng dụng chưa migrate;
  - role `n8n` + database `n8n`; role `n8n_app` / `mcp_readonly`, mật khẩu đọc bằng `\getenv` (không đưa lên dòng lệnh);
  - `REVOKE CONNECT … FROM PUBLIC`;
  - thu hồi hết quyền cũ rồi `GRANT` lại đúng database.md §6.
- [x] `n8n/setup/entrypoint.sh` + `credentials.cjs`:
  - kiểm tra biến và độ mạnh mật khẩu;
  - tạo bcrypt hash cho owner;
  - import 2 credential (file tạm quyền 600, xoá ngay);
  - `unset` mật khẩu plain, rồi `exec /docker-entrypoint.sh start`.
- [x] `n8n/setup/workflows.sh` + `clean-export.cjs` (export / import, bỏ `shared` / `pinData` / `staticData` / mốc thời gian)
- [x] `n8n/setup/check.sh` + `check-db.sh` (smoke-check AC-17); `n8n/workflows/.gitkeep`
- [x] npm script: `n8n:up` (`up -d --wait`), `n8n:down`, `n8n:logs`, `n8n:export`, `n8n:import`, `n8n:check`; `db:down` thêm `--profile n8n`
- [x] `.env.example`: thêm các biến n8n, kèm ghi chú dùng dấu nháy đơn khi giá trị có `#` / `$`
- [x] Đổi `WEBHOOK_URL` (deprecated) → `N8N_WEBHOOK_URL`

## Docs

- [x] [database.md §6](../../database.md#6-phân-quyền-db-cho-n8n): quyền nằm trong `n8n/setup/init-db.sh`, thêm role `n8n`, `REVOKE CONNECT`
- [x] `CLAUDE.md`: lệnh n8n, nơi đặt GRANT, cách Compose đọc `.env`; feature hạ tầng → kiểm bằng smoke-check
- [x] Hướng dẫn [n8n-setup.md](./n8n-setup.md)
- [x] [project-overview.md](../../project-overview.md): D25–D28, bước 2.1 trong lộ trình, Q13 (Postgres 17)

## Kiểm chứng (2026-11-07, máy local, dữ liệu thử đã xoá)

- [x] `npm run n8n:check` pass toàn bộ (AC-1, AC-6 → AC-13)
- [x] AC-17: cố ý cấp thêm `DELETE ON evaluations` cho `n8n_app` và `SELECT ON users` cho `mcp_readonly` → check báo 4 mục ✗, exit 1. Chạy `n8n:up` → quyền thừa bị thu hồi, check pass (AC-9).
- [x] AC-1: `n8n:up` khoảng 17 giây, theo đúng thứ tự `db` healthy → `n8n-init` exit 0 → `n8n` healthy
- [x] AC-2: không bật profile thì compose chỉ có service `db`; `db:up` chỉ bật Postgres. Compose dùng giá trị mặc định `${VAR:-}` nên không báo lỗi thiếu biến n8n.
- [x] AC-3: thiếu từng biến → `n8n-init` / `n8n` báo đúng tên biến. Mật khẩu yếu (`Short1A`, `nouppercase123`, `NoNumberHere`) bị từ chối. Với `N8N_DB_PASSWORD` rỗng, `n8n:up` exit 1 và n8n chỉ ở trạng thái Created, không start.
- [x] AC-4: chạy lại `n8n:up` nhiều lần và `--force-recreate` → không lỗi; workflow, execution, credential vẫn còn; workflow vẫn chạy được (giải mã được credential).
- [x] AC-5: `n8n:down` chỉ dừng n8n; `db:down` dừng tất cả và xoá network mà không lỗi; bật lại thì dữ liệu còn. Backend dev server vẫn trả 200 sau khi Postgres khởi động lại.
- [x] AC-6: `prisma migrate status` báo "up to date". `migrate dev --create-only` chỉ tạo migration **rỗng** (không drift); file đã xoá.
- [x] AC-9 (mật khẩu): tạm đổi `N8N_APP_DB_PASSWORD` qua biến shell → mật khẩu mới dùng được, mật khẩu cũ bị từ chối, credential trong n8n cập nhật theo. Đã khôi phục về `.env`.
- [x] AC-10: không còn màn hình tạo owner (`showSetupOnFirstLoad=false`). Đăng nhập bằng mật khẩu trong `.env` → 200 `global:owner`; mật khẩu sai → 401. Đổi mật khẩu → mật khẩu mới 200, mật khẩu cũ 401; đã khôi phục.
- [x] AC-11: workflow mẫu (Manual Trigger + Postgres dùng `cvScannerMcpRead`) chạy thành công: `SELECT count(*) FROM positions` → 3
- [x] AC-14: export → `n8n/workflows/smokeTestWorkflow.json`:
  - credential được tham chiếu bằng id và tên; 0 mật khẩu hay secret, 0 email;
  - export 2 lần cho ra file giống hệt nhau.
- [x] AC-15: xoá workflow trong n8n → import → workflow có lại, gắn đúng credential, chạy được; import lần 2 vẫn chỉ có 1 bản
- [x] AC-16: khi n8n dừng, `n8n:export` / `n8n:import` / `n8n:check` báo "n8n is not running…", exit 1
- [x] AC-11 (UI, 2026-11-07): đăng nhập http://localhost:5678 → **Credentials** → **Test connection** cho `CV Scanner DB (n8n_app)` và `CV Scanner DB (mcp_readonly)` đều báo "Connection tested successfully"

## Còn lại / sau này

- [ ] Q13: nâng Postgres 16 → 17 (dev: tạo volume mới + migrate + seed, hoặc dump / restore; Azure: chọn bản 17 ở Phase 5)
- [ ] WF-1 (bước 2.3): kiểm Insert / Update của node Postgres có cần `SELECT` do `RETURNING` hay không (xem ghi chú trong requirements.md)
