# Feature: Nâng PostgreSQL 16 → 17 (Phase 2 — bước 2.1b)

## Mục tiêu

n8n 2.46 báo Postgres 16 "outside the supported range" (câu hỏi mở Q13). Nâng Postgres của môi trường dev lên **17**, **giữ nguyên dữ liệu** (đơn ứng tuyển, vị trí, tài khoản HR, database `n8n`), và có sẵn lệnh để lặp lại việc này an toàn.

Bối cảnh: [project-overview.md Q13](../../project-overview.md#12-câu-hỏi-mở) · [n8n-docker-setup](../n8n-docker-setup/requirements.md#phát-hiện-khi-chạy-thật)

---

## Phạm vi

- `docker-compose.dev.yml`: service `db` và `n8n-init` dùng `postgres:17-alpine`. `docker-compose.prod.yml`: bỏ `postgres:latest`, cố định `postgres:17-alpine`.
- Lệnh `npm run db:upgrade`: sao lưu, đổi sang volume Postgres 17, khôi phục, kiểm tra.
- Lệnh `npm run db:backup`: chỉ sao lưu (dùng lại được cho lần nâng sau).
- Cập nhật tài liệu nhắc Postgres 16 (project-overview, n8n-setup, CLAUDE.md).
- **Không làm:** nâng PostgreSQL trên Azure (Phase 5), sao lưu định kỳ.

---

## Acceptance Criteria

Mỗi AC là một scenario. "Dữ liệu" gồm database ứng dụng (`POSTGRES_DB`) và database `n8n`.

### Nâng cấp

#### AC-1: Nâng 16 → 17, giữ nguyên dữ liệu

**Given:** dev đang chạy Postgres 16, có dữ liệu thật (1 đơn ứng tuyển, 3 vị trí, 1 HR, database `n8n`)
**When:** chạy `npm run db:upgrade`
**Then:**
- Container `db` chạy Postgres 17 (`SHOW server_version` bắt đầu bằng `17.`).
- Số dòng của mọi bảng ở cả 2 database bằng đúng trước khi nâng.
- Đăng nhập được bằng `POSTGRES_USER` và cả 3 role `n8n`, `n8n_app`, `mcp_readonly` với mật khẩu cũ.
- Backend `GET /api/positions` trả 200, `npx prisma migrate status` báo "up to date".

#### AC-2: n8n vẫn chạy đúng sau khi nâng

**Given:** đã nâng lên 17 (AC-1)
**When:** chạy `npm run n8n:up`, rồi `npm run n8n:check`
**Then:**
- `n8n:check` pass toàn bộ (quyền, owner, credential vẫn khớp).
- Log của n8n **không** còn dòng "outside the supported range".
- Credential cũ vẫn mở được (không đổi `N8N_ENCRYPTION_KEY`).

#### AC-3: Luôn có bản sao lưu và cách quay lại

**When:** chạy `npm run db:upgrade`
**Then:**
- Trước khi đổi gì, tạo file dump đầy đủ (`pg_dumpall`) trong `tmp/db-backups/` (đã gitignore), tên có thời gian.
- Volume Postgres 16 cũ **không bị xoá**: được đổi sang tên có hậu tố `-pg16`, để quay lại được.
- Cuối lệnh in đường dẫn file dump, tên volume cũ và cách quay lại.

#### AC-4: Lỗi giữa chừng không làm mất dữ liệu

**Given:** một bước thất bại (ví dụ khôi phục lỗi, hoặc số dòng sau khôi phục không khớp)
**Then:**
- Lệnh dừng, exit ≠ 0 và nêu bước lỗi.
- Script **tự trả volume về Postgres 16 đúng như trước khi nâng** (và xoá bản sao `-pg16` vừa tạo), nên chạy lại `db:upgrade` được ngay sau khi sửa nguyên nhân.
- File dump vẫn được giữ; lệnh in đường dẫn.

#### AC-5: Chạy lại khi đã là Postgres 17

**Given:** `db` đã chạy Postgres 17
**When:** chạy `npm run db:upgrade`
**Then:** báo "Postgres đã là 17, không cần nâng", exit 0, không đụng vào dữ liệu hay volume.

#### AC-6: Không đủ điều kiện thì không làm gì

**Given:** một trong các trường hợp sau
**When:** chạy `npm run db:upgrade`
**Then:** dừng ngay với thông báo rõ, chưa đổi gì.

| Trường hợp | Thông báo |
|------------|-----------|
| Container `db` không chạy và không có volume Postgres 16 | không tìm thấy dữ liệu để nâng |
| Backend dev server đang kết nối (`npm run dev`) | cần dừng backend / frontend trước, để dump nhất quán |
| Container `n8n` đang chạy | cần `npm run n8n:down` trước |
| Thiếu `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` trong `.env` | nêu đúng tên biến |
| Volume `<volume>-pg16` đã tồn tại (bản sao của lần nâng trước) | nêu tên volume và lệnh xoá nếu không cần nữa |

### Sao lưu

#### AC-7: Sao lưu riêng

**When:** chạy `npm run db:backup`
**Then:**
- Tạo file dump đầy đủ (mọi database và role) trong `tmp/db-backups/`, không dừng hay thay đổi container.
- In đường dẫn file và dung lượng; mật khẩu không xuất hiện trong log.

### Cấu hình & tài liệu

#### AC-8: Mọi nơi cùng một version

**Then:**
- `docker-compose.dev.yml` (`db`, `n8n-init`) và `docker-compose.prod.yml` đều dùng `postgres:17-alpine`; không còn `postgres:16` hay `postgres:latest`.
- Tài liệu không còn nói dev chạy Postgres 16; Q13 được ghi là đã chốt (D29).
- `db:up` và `n8n:up` sau khi nâng chạy lại bình thường trên máy đã nâng; trên máy mới (chưa có volume) tạo database Postgres 17 sạch và `prisma migrate deploy` + `prisma db seed` chạy được.

---

## Kiểm thử

Feature hạ tầng, không có code FE / BE (D28): kiểm trên môi trường thật bằng script và các bước tay, ghi kết quả vào [tasks.md](./tasks.md).

| AC | Cách kiểm |
|----|-----------|
| AC-1 | Ghi số dòng từng bảng trước → `db:upgrade` → so sánh; `SHOW server_version`; đăng nhập 4 role; `GET /api/positions`; `prisma migrate status` |
| AC-2 | `n8n:up`, `n8n:check`; grep log n8n; chạy workflow mẫu dùng credential (rồi xoá) |
| AC-3 | Xem `tmp/db-backups/`, `docker volume ls` có volume `-pg16` |
| AC-4 | Biến test `DB_UPGRADE_TEST_FAIL=verify` làm lệch số dòng sau khi khôi phục → dừng, exit 1, volume trở lại Postgres 16, không còn `-pg16` |
| AC-5 | Chạy lần 2 ngay sau khi nâng |
| AC-6 | Lần lượt tạo từng tình huống ở bảng |
| AC-7 | `db:backup` khi `db` đang chạy; kiểm file dump khôi phục được vào một container thử |
| AC-8 | `grep` version trong compose và docs; thử trên volume trống: `db:up` → migrate → seed |

---

## Quyết định (2026-11-07)

| # | Câu hỏi | Đã chốt |
|---|---------|---------|
| PQ1 | Dữ liệu dev khi nâng | **Dump / restore** (giữ đơn, HR, database `n8n`), không tạo volume trống |
| PQ2 | `docker-compose.prod.yml` | **Cố định `postgres:17-alpine`** (bỏ `latest`) |
| — | Volume cũ | Giữ lại với hậu tố `-pg16` để quay lại, xoá tay khi chắc chắn |
| — | Vì sao phải dump / restore | Data directory của Postgres không dùng chung giữa 2 bản major (khác `pg_upgrade`, vốn cần cả 2 bộ binary) |

### Ghi chú kỹ thuật (đã kiểm / cần kiểm khi làm)

- Image `postgres:17-alpine` là 17.11 (đã pull thử).
- `pg_dumpall` mang theo cả role và mật khẩu (dạng hash), nên 3 role của n8n và các `GRANT` được khôi phục nguyên trạng.
- Khôi phục vào container 17 mới sẽ báo "đã tồn tại" cho role `POSTGRES_USER` và database `POSTGRES_DB` do image tự tạo: cần xử lý (bỏ qua có kiểm soát), không được che lỗi thật.
- Đơn thử hiện có tham chiếu một file trên Google Drive; dump / restore giữ nguyên đường dẫn đó.
