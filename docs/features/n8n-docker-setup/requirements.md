# Feature: Setup n8n trên Docker (Phase 2 — bước 2.1)

## Mục tiêu

Bật được n8n trên máy local bằng **1 lệnh**, với đầy đủ những gì các bước sau cần:
- **Bước 2.2:** workflow MCP server (tool `get_position_requirements`).
- **Bước 2.3:** WF-1 đánh giá CV.

Cụ thể:
- n8n chạy trong Docker Compose, cùng Postgres hiện có. n8n lưu dữ liệu nội bộ của nó vào database riêng `n8n`.
- Tự tạo các DB role `n8n_app` và `mcp_readonly`, với **đúng** các quyền trong [database.md §6](../../database.md#6-phân-quyền-db-cho-n8n).
- Tự tạo tài khoản owner và 2 Postgres credential trong n8n từ `.env`, không phải thao tác tay trên UI.
- Có lệnh export / import workflow ra file JSON trong repo, để dựng lại trên máy khác hoặc trên Azure.
- Có lệnh smoke-check kiểm tra toàn bộ cấu hình trên.

Bối cảnh: [project-overview.md §3 Môi trường triển khai](../../project-overview.md#môi-trường-triển-khai), [§6](../../project-overview.md#6-ranh-giới-trách-nhiệm-backend--n8n--mcp), [§7](../../project-overview.md#7-đánh-giá-cv-n8n--mcp--claude) (D4, D13, D15, D17, D19, D25–D28) · [database.md §5, §6](../../database.md#6-phân-quyền-db-cho-n8n)

---

## Phạm vi

- Thêm vào `docker-compose.dev.yml`, dưới **profile `n8n`**:
  - service `n8n-init`: chạy 1 lần mỗi khi up, tạo hoặc cập nhật database `n8n` và các role;
  - service `n8n`: image cố định `n8nio/n8n:2.46.6`.
- Các script trong thư mục `n8n/`:
  - `setup/init-db.sh`: SQL idempotent cho database, role và quyền;
  - `setup/entrypoint.sh`: kiểm tra biến môi trường, tạo owner, import credential, rồi start n8n;
  - `setup/credentials.cjs`: tạo file credential tạm cho `entrypoint.sh`;
  - `setup/workflows.sh` + `setup/clean-export.cjs`: export / import, lọc field cá nhân khỏi file export;
  - `setup/check.sh` + `setup/check-db.sh`: smoke-check;
  - thư mục `workflows/` chứa file export.
- Hướng dẫn sử dụng: [n8n-setup.md](./n8n-setup.md).
- npm script ở gốc repo: `n8n:up`, `n8n:down`, `n8n:logs`, `n8n:export`, `n8n:import`, `n8n:check`. `db:down` dừng cả n8n.
- Thêm biến vào `.env.example`. Sửa [database.md §6](../../database.md#6-phân-quyền-db-cho-n8n): quyền nằm trong script setup, không nằm trong Prisma migration (NQ2).
- **Không làm:**
  - workflow MCP server, WF-1 và PoC đọc PDF (bước 2.2, 2.3);
  - credential Anthropic, Google Drive (làm cùng WF-1);
  - triển khai Azure (Phase 5);
  - backup database `n8n`.

### Biến môi trường mới (`.env` gốc)

| Biến | Bắt buộc | Dùng cho |
|------|----------|----------|
| `N8N_ENCRYPTION_KEY` | Có | Khoá mã hoá credential của n8n, cố định (sinh bằng `openssl rand -hex 32`). Mất khoá này thì không giải mã được credential. |
| `N8N_DB_PASSWORD` | Có | Mật khẩu role `n8n`, chủ database `n8n` (dữ liệu nội bộ của n8n) |
| `N8N_APP_DB_PASSWORD` | Có | Mật khẩu role `n8n_app` (WF-1) |
| `MCP_DB_PASSWORD` | Có | Mật khẩu role `mcp_readonly` (MCP server) |
| `N8N_OWNER_EMAIL` | Có | Email đăng nhập owner của n8n |
| `N8N_OWNER_PASSWORD` | Có | Mật khẩu owner, dạng plain: tối thiểu 8 ký tự, có ít nhất 1 chữ số và 1 chữ in hoa |
| `N8N_OWNER_FIRST_NAME`, `N8N_OWNER_LAST_NAME` | Không | Tên hiển thị của owner (mặc định "Instance Owner") |
| `N8N_HOST_PORT` | Không | Cổng trên máy local (mặc định `5678`) |

n8n dùng lại các biến `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` đã có, để init và để biết tên database của ứng dụng.

---

## Acceptance Criteria

Mỗi AC là một scenario. "Postgres" là service `db` trong `docker-compose.dev.yml`; database ứng dụng là `POSTGRES_DB` (`cv_ai_scanner`).

### Khởi động & dừng

#### AC-1: Bật n8n bằng 1 lệnh

**Given:** `.env` đã điền đủ các biến bắt buộc ở bảng trên và Docker đang chạy
**When:** chạy `npm run n8n:up`
**Then:**
- Các service bật theo thứ tự: `db` healthy → `n8n-init` chạy xong (exit 0) → `n8n`.
- Trong vòng 2 phút:
  - http://localhost:5678 mở ra trang đăng nhập của n8n;
  - `GET /healthz/readiness` trả 200.
- Container `n8n` chạy image `n8nio/n8n:2.46.6`.

#### AC-2: Không làm phiền người chỉ làm FE / BE

**Given:** `.env` **chưa có** biến nào của n8n
**When:** chạy `npm run db:up`, rồi `npm run dev`
**Then:**
- Chỉ Postgres được bật; `n8n` và `n8n-init` không chạy.
- Docker Compose không báo lỗi thiếu biến; backend và frontend chạy bình thường.

#### AC-3: Thiếu hoặc sai biến bắt buộc

**Given:** `.env` rơi vào một trường hợp dưới đây
**When:** chạy `npm run n8n:up`
**Then:** setup dừng với thông báo nêu **đúng tên biến**. Không có role, owner hay credential nào được tạo hoặc sửa với giá trị sai.

| Trường hợp | Kết quả |
|------------|---------|
| Thiếu `N8N_DB_PASSWORD`, `N8N_APP_DB_PASSWORD` hoặc `MCP_DB_PASSWORD` | `n8n-init` exit ≠ 0, nêu tên biến; `n8n` không start |
| Thiếu `N8N_ENCRYPTION_KEY`, `N8N_OWNER_EMAIL` hoặc `N8N_OWNER_PASSWORD` | `n8n` dừng trước khi start, nêu tên biến |
| `N8N_OWNER_PASSWORD` không đủ mạnh (dưới 8 ký tự, thiếu chữ số hoặc thiếu chữ in hoa) | `n8n` dừng, nêu yêu cầu về mật khẩu |

#### AC-4: Chạy lại không làm hỏng gì

**Given:** n8n đã setup xong và đã có workflow, credential, execution
**When:** chạy lại `npm run n8n:up`, hoặc tạo lại container (`--force-recreate`), hoặc khởi động lại Docker
**Then:**
- `n8n-init` chạy lại thành công, không lỗi "already exists".
- Workflow, credential, execution log còn nguyên.
- Credential cũ vẫn mở được, vì `N8N_ENCRYPTION_KEY` không đổi.

#### AC-5: Dừng n8n

**When:** chạy `npm run n8n:down`
**Then:**
- Container `n8n` dừng, Postgres vẫn chạy.
- Lần `n8n:up` sau, dữ liệu của n8n vẫn còn.

**When:** chạy `npm run db:down`
**Then:**
- Cả `n8n` và `db` dừng, không báo lỗi network còn container đang dùng.
- Dữ liệu (volume) được giữ.

### Database & quyền

#### AC-6: Database riêng cho n8n

**Given:** đã chạy `n8n:up`
**Then:**
- Có database `n8n`, chủ sở hữu là role `n8n`. Mọi bảng nội bộ của n8n (workflow, credential, execution, user…) nằm trong database này.
- Database ứng dụng không có bảng nào của n8n, nên `npx prisma migrate dev` không báo lệch schema (drift).
- Role `n8n` **không** kết nối được vào database ứng dụng.

#### AC-7: Quyền của `n8n_app` (WF-1)

**Given:** đã chạy `n8n:up`
**When:** kết nối database ứng dụng bằng role `n8n_app`, mật khẩu `N8N_APP_DB_PASSWORD`
**Then:**

| Thao tác | Kết quả |
|----------|---------|
| `SELECT` trên `applications`, `position_criteria`, `job_levels` | Được |
| `UPDATE applications SET status, updated_at` | Được |
| `UPDATE` cột khác của `applications` (vd `full_name`, `email`, `cv_drive_url`) | `permission denied` |
| `SELECT`, `INSERT`, `UPDATE` trên `evaluations` | Được |
| `DELETE` trên `evaluations` | `permission denied` |
| `INSERT` vào `application_status_history` | Được |
| `UPDATE`, `DELETE` trên `application_status_history` | `permission denied` |
| `SELECT` trên `positions`, `job_categories`, `users` | `permission denied` |
| `CREATE TABLE` | `permission denied` |
| Kết nối vào database `n8n` | Bị từ chối |

#### AC-8: Quyền của `mcp_readonly` (MCP server)

**Given:** đã chạy `n8n:up`
**When:** kết nối database ứng dụng bằng role `mcp_readonly`, mật khẩu `MCP_DB_PASSWORD`
**Then:**

| Thao tác | Kết quả |
|----------|---------|
| `SELECT` trên `job_categories`, `job_levels`, `positions`, `position_criteria` | Được |
| `SELECT` trên `applications`, `evaluations`, `application_status_history`, `users` | `permission denied` |
| `INSERT`, `UPDATE`, `DELETE` trên bất kỳ bảng nào | `permission denied` |
| Kết nối vào database `n8n` | Bị từ chối |

Như vậy, kể cả khi CV chứa prompt injection, Claude cũng không đọc được dữ liệu ứng viên ([project-overview.md §6](../../project-overview.md#6-ranh-giới-trách-nhiệm-backend--n8n--mcp)).

#### AC-9: Quyền và mật khẩu luôn khớp với script và `.env`

**Given:** đã setup một lần
**When:** sửa mật khẩu trong `.env` (vd `N8N_APP_DB_PASSWORD`), hoặc bỏ một lệnh `GRANT` khỏi `init-db.sh`, rồi chạy lại `npm run n8n:up`
**Then:**
- Role đăng nhập được bằng mật khẩu mới; mật khẩu cũ bị từ chối.
- Quyền bị bỏ khỏi script cũng bị thu hồi trong DB: script luôn thu hồi hết quyền cũ rồi cấp lại đúng danh sách.
- Credential tương ứng trong n8n cũng dùng mật khẩu mới (AC-11).

### Owner & credential

#### AC-10: Owner tạo từ `.env`

**Given:** `N8N_OWNER_EMAIL` / `N8N_OWNER_PASSWORD` đã điền
**When:** mở n8n lần đầu
**Then:**
- **Không** có màn hình "Set up owner account".
- Đăng nhập được bằng email và mật khẩu trong `.env`.

**When:** đổi `N8N_OWNER_PASSWORD` trong `.env`, rồi chạy lại `npm run n8n:up`
**Then:** mật khẩu mới có hiệu lực, mật khẩu cũ không còn đăng nhập được (`.env` là nguồn chính).

`.env` chỉ chứa mật khẩu dạng plain. Container tự tính bcrypt hash lúc khởi động và không ghi hash ra file.

#### AC-11: 2 Postgres credential có sẵn

**Given:** đã đăng nhập n8n
**When:** mở mục **Credentials**
**Then:** có đúng 2 credential sau, và nút **Test connection** của cả hai đều thành công:

| Tên | Id (cố định) | Role | Dùng cho |
|-----|--------------|------|----------|
| `CV Scanner DB (n8n_app)` | `cvScannerN8nApp` | `n8n_app` | WF-1 |
| `CV Scanner DB (mcp_readonly)` | `cvScannerMcpRead` | `mcp_readonly` | Workflow MCP server |

- Cả hai kết nối host `db`, port `5432`, database = `POSTGRES_DB`, tắt SSL (chỉ dùng mạng nội bộ Docker).
- Id cố định, nên workflow export ở máy này import sang máy khác vẫn trỏ đúng credential (AC-14).
- Chạy lại `n8n:up` không tạo bản trùng; giá trị được cập nhật theo `.env`.
- Không file nào chứa mật khẩu được ghi vào repo hay volume bind-mount.

### Cấu hình n8n

#### AC-12: Múi giờ Việt Nam

**Given:** n8n đang chạy
**Then:**
- `GENERIC_TIMEZONE` và `TZ` của container đều là `Asia/Ho_Chi_Minh`.
- Múi giờ mặc định của workflow mới là `Asia/Ho_Chi_Minh`, nên Schedule Trigger "00:00 hằng ngày" chạy lúc 00:00 giờ Việt Nam (D15).

#### AC-13: Chỉ mở trên máy local

**Given:** n8n đang chạy
**Then:**
- Cổng `5678` (hoặc `N8N_HOST_PORT`) chỉ gắn vào `127.0.0.1`: máy khác trong mạng LAN không truy cập được.
- Đã tắt gửi thông tin chẩn đoán (telemetry) về n8n (`N8N_DIAGNOSTICS_ENABLED=false`).

### Workflow trong repo

#### AC-14: Export workflow

**Given:** trong n8n có ít nhất 1 workflow
**When:** chạy `npm run n8n:export`
**Then:**
- Mỗi workflow là 1 file JSON (định dạng dễ đọc) trong `n8n/workflows/`, tên file là id của workflow.
- File chỉ tham chiếu credential bằng id và tên, **không** chứa mật khẩu hay secret.
- File **không** chứa dữ liệu cá nhân hay dữ liệu riêng của từng máy:
  - bỏ `shared`: tên project của owner chứa email owner;
  - bỏ `pinData`: dữ liệu mẫu, có thể là dữ liệu ứng viên;
  - bỏ `staticData`, mốc thời gian và các bộ đếm version.
- Export lại thì ghi đè đúng các file đó, không tạo file trùng. Workflow không đổi thì file giữ nguyên từng byte.

#### AC-15: Import workflow

**Given:** `n8n/workflows/` có file JSON (vd vừa clone repo, hoặc database `n8n` còn trống)
**When:** chạy `npm run n8n:import`
**Then:**
- Các workflow xuất hiện trong n8n, gắn đúng 2 credential ở AC-11.
- Import lại thì cập nhật workflow cũ, không tạo bản trùng.

#### AC-16: n8n chưa chạy

**Given:** container `n8n` không chạy
**When:** chạy `npm run n8n:export` hoặc `npm run n8n:import`
**Then:** báo "n8n is not running — run `npm run n8n:up` first", với exit code ≠ 0.

### Smoke-check

#### AC-17: `npm run n8n:check`

**Given:** đã chạy `n8n:up`
**When:** chạy `npm run n8n:check`
**Then:**
- Kiểm tra lần lượt AC-1, AC-6 → AC-13, in ✓ hoặc ✗ cho từng mục.
- Exit code ≠ 0 nếu có mục ✗.
- **Không thay đổi dữ liệu:**
  - quyền được đọc bằng `has_table_privilege` / `has_column_privilege` và so khớp **chính xác** với danh sách mong đợi;
  - các thao tác thử thật dùng `WHERE false` hoặc `LIMIT 0`;
  - `CREATE TABLE` chạy trong transaction rồi `ROLLBACK`.

---

## Kiểm thử

Đây là feature hạ tầng, không có code FE / BE, nên không viết cucumber hay unit test (NQ4). Mỗi AC được kiểm bằng `npm run n8n:check` (file `n8n/setup/check.sh`) trên môi trường thật, hoặc kiểm tay. Kết quả ghi vào [tasks.md](./tasks.md).

| AC | Cách kiểm |
|----|-----------|
| AC-1 | `check.sh`: `/healthz/readiness` 200, image `n8nio/n8n:2.46.6`, `n8n-init` exit 0 |
| AC-2 | Tay: `.env` không có biến n8n → `db:up` chỉ bật `db`; `npm run dev` chạy bình thường |
| AC-3 | Tay: lần lượt bỏ từng biến hoặc dùng mật khẩu yếu → đọc log `n8n-init` / `n8n` |
| AC-4 | Tay: `--force-recreate` và khởi động lại Docker → chạy lại `check.sh`, credential vẫn mở được |
| AC-5 | Tay: `n8n:down`, `db:down`, `n8n:up` → dữ liệu còn |
| AC-6 → AC-9 | `check.sh`: `psql` bằng từng role, thử từng thao tác trong bảng (ghi thì `ROLLBACK`); đổi mật khẩu thì kiểm thêm bằng tay |
| AC-10 | `check.sh`: owner trong database `n8n` có đúng email · Tay: đăng nhập UI, đổi mật khẩu |
| AC-11 | `check.sh`: có 2 credential với đúng id, mật khẩu đã mã hoá · Tay: chạy một workflow mẫu bằng credential; Test connection trên UI |
| AC-12, AC-13 | `check.sh`: biến môi trường của container, `docker port` chỉ có `127.0.0.1` |
| AC-14 → AC-16 | Tay: tạo workflow mẫu → export → xoá → import → kiểm tra file không chứa mật khẩu |
| AC-17 | Chạy `check.sh` khi mọi thứ đúng (exit 0) và khi cố ý làm sai một quyền (exit ≠ 0) |

---

## Quyết định (2026-11-07)

| # | Câu hỏi | Đã chốt |
|---|---------|---------|
| NQ1 | Chạy setup thế nào | **Tự động khi up:** container `n8n-init` chạy 1 lần trước n8n, idempotent. Script SQL dùng lại được cho Azure. |
| NQ2 | Role / `GRANT` đặt ở đâu | **Trong script setup** (`n8n/setup/init-db.sh`), không trong Prisma migration. Người không dùng n8n vẫn migrate bình thường. Sửa [database.md §6](../../database.md#6-phân-quyền-db-cho-n8n) cho khớp. |
| NQ3 | Phạm vi thêm | **Lệnh export / import workflow**, **tự tạo 2 Postgres credential**, **tự tạo owner** từ `.env` |
| NQ4 | Kiểm thử feature hạ tầng | **Script smoke-check** `npm run n8n:check`, kèm các bước kiểm tay ghi trong `tasks.md` |
| — | Version n8n | Cố định **`n8nio/n8n:2.46.6`** (kênh `stable` ngày 2026-11-07). Nâng version là một việc riêng có chủ đích. |
| — | n8n có bật cùng `db:up` không | **Không:** n8n nằm trong compose profile `n8n`, chỉ bật bằng `n8n:up` (AC-2) |
| — | Database `n8n` dùng role nào | Role riêng **`n8n`** chỉ sở hữu database `n8n`, không dùng superuser của ứng dụng |
| — | Truy cập n8n | Chỉ `127.0.0.1`, tắt telemetry |

### Ghi chú kỹ thuật (đã kiểm trên image 2.46.6)

- **Owner qua biến môi trường:** n8n 2.x hỗ trợ chính thức `N8N_INSTANCE_OWNER_MANAGED_BY_ENV=true` cùng `N8N_INSTANCE_OWNER_EMAIL` / `_PASSWORD_HASH` (bcrypt) / `_FIRST_NAME` / `_LAST_NAME`. Mỗi lần start, n8n ghi đè owner theo biến môi trường.
  - Hash bcrypt chứa ký tự `$`, mà Docker Compose hiểu `$` là biến. Vì vậy **không** để hash trong `.env`: `entrypoint.sh` tự hash `N8N_OWNER_PASSWORD` bằng `bcryptjs` có sẵn trong image.
  - Image 2.46.6 không có lệnh CLI nào để tạo user.
- **`n8n import:credentials`:** nếu `data` là object (plain) thì tự mã hoá bằng `N8N_ENCRYPTION_KEY`; ghi theo `id` (upsert), nên chạy lại không tạo bản trùng. File JSON tạm chỉ nằm trong container và bị xoá ngay sau khi import.
- **`CREATE DATABASE` không chạy được trong transaction / khối `DO`:** dùng `SELECT … WHERE NOT EXISTS … \gexec` của `psql`.
- **Postgres mặc định cho `PUBLIC` quyền `CONNECT` vào mọi database:** phải `REVOKE CONNECT … FROM PUBLIC`, rồi chỉ cấp lại cho đúng role (AC-6 → AC-8).
- **Container Postgres đã có volume thì không chạy lại `docker-entrypoint-initdb.d`:** vì vậy cần service `n8n-init` riêng, thay vì dựa vào initdb.

### Phát hiện khi chạy thật

- **n8n 2.46 cảnh báo Postgres 16** ("outside the supported range … compatibility support only"). n8n vẫn chạy và mọi AC đều pass, nhưng n8n khuyến nghị Postgres 17 → đã nâng lên Postgres 17 ở feature [postgres-17-upgrade](../postgres-17-upgrade/requirements.md) (D29).
- **Docker Compose và dotenv / `node --env-file` đọc `.env` khác nhau:**
  - Compose chỉ coi `#` là comment khi đứng sau dấu cách, và hiểu `$` là biến.
  - `node --env-file` cắt giá trị ngay tại `#`.
  - Hệ quả: một mật khẩu có `#` vẫn đúng với n8n, nhưng sai khi một script Node đọc cùng file `.env`. Khuyến nghị đặt giá trị như vậy trong dấu nháy đơn (`.env.example`, [n8n-setup.md](./n8n-setup.md)).
- **`n8n export:workflow` để lại email owner** trong `shared[].project.name` (vd "Instance Owner <email>") → `clean-export.cjs` bỏ field này (AC-14).
- `WEBHOOK_URL` đã deprecated → dùng `N8N_WEBHOOK_URL`.
- **Chạy `n8n execute` trong container đang chạy n8n:** phải đặt `N8N_RUNNERS_BROKER_PORT` khác 5679, vì cổng 5679 đã bị task broker của tiến trình chính chiếm.
- **Lưu ý cho WF-1 (bước 2.3):** thao tác Insert / Update của node Postgres mặc định trả về các cột (`RETURNING`). Khi đó Postgres đòi thêm quyền `SELECT`, mà `n8n_app` không có `SELECT` trên `application_status_history`. Cần kiểm lại lúc làm WF-1:
  - hoặc dùng "Execute Query" không có `RETURNING`;
  - hoặc cấp thêm quyền (sửa `init-db.sh` + database.md §6).
