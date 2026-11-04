# Phase 1: Nền tảng dữ liệu & trang công khai

## Mục tiêu

Thay dữ liệu hardcode và API mock bằng dữ liệu thật:
- Database theo [database.md](../../database.md).
- API công khai cho job.
- API nộp đơn (upload CV lên Google Drive).
- Các trang công khai `/`, `/jobs`, `/submit-cv`.

Bối cảnh và các quyết định (D1–D19): [project-overview.md](../../project-overview.md).

---

## Các bước

Mỗi bước là **1 feature riêng** (branch + thư mục docs riêng). Thư mục này chỉ chứa bước 1.1.

| Bước | Nội dung | Feature | Trạng thái |
|------|----------|---------|------------|
| 1.1 | Database: Prisma schema, migration, seed | `phase-1-foundation` (thư mục này) | ✅ Xong |
| 1.2 | API công khai: job + danh mục | feature riêng — tạo khi bắt đầu | Chưa làm |
| 1.3 | API nộp đơn + upload Google Drive | feature riêng — tạo khi bắt đầu | Chưa làm |
| 1.4 | Frontend: trang chủ, `/jobs`, cập nhật `/submit-cv` | feature riêng — tạo khi bắt đầu | Chưa làm |

Yêu cầu chi tiết của bước 1.2–1.4 nằm trong `requirements.md` của từng feature.

---

## 1.1 Database

### Phạm vi

- Prisma schema đúng [database.md](../../database.md) v0.5: 8 bảng, 4 enum.
- Migration đầu tiên, **commit vào repo**; CHECK constraint thêm bằng SQL viết tay trong migration.
- Seed: 7 nhóm vị trí, 7 level, 3 vị trí đang hardcode ở frontend (kèm tiêu chí), 1 tài khoản HR.
- Module `users`: giữ API CRUD `/api/users`, thêm trường `password` (lưu hash scrypt), **không bao giờ trả `password_hash`**.
- **Không làm ở bước này:** role DB `n8n_app` / `mcp_readonly` (Phase 2), đăng nhập HR + guard cho `/api/users` (Phase 3).

### Acceptance Criteria

#### AC-1: Schema dùng được từ SQL thuần

**Given:** DB đã chạy migration
**Then:**
- Có đủ 8 bảng và 4 enum, tên dạng `snake_case` như database.md.
- `id` có default `gen_random_uuid()`; `created_at` / `updated_at` có default `now()`.
- Một câu `INSERT` bằng SQL thuần (như n8n sẽ làm) không cần truyền `id`, `created_at`, `updated_at`.

#### AC-2: Ràng buộc dữ liệu

**Then:** DB từ chối:
- `position_criteria.weight` ngoài khoảng 1–5
- `positions.min_years_experience` < 0
- `evaluations.overall_score` ngoài khoảng 0–100
- `evaluations.estimated_years_experience` < 0
- Xoá `job_categories` / `job_levels` / `positions` đang được tham chiếu (`ON DELETE RESTRICT`)

#### AC-3: Seed chạy lại an toàn

**When:** chạy `npx prisma db seed` nhiều lần
**Then:**
- Không tạo dòng trùng.
- Không ghi đè dữ liệu đã có (khớp theo `code` / `email`).
- Bỏ qua tài khoản HR nếu chưa đặt `SEED_HR_EMAIL` / `SEED_HR_PASSWORD`.

#### AC-4: API users không lộ mật khẩu

- Mọi response của `/api/users` không có `passwordHash`.
- `POST /api/users` lưu hash scrypt, email chữ thường; thiếu `password` → 400.
- `:id` không phải UUID → 400 (thay vì lỗi 500 từ Prisma).

---

## Môi trường

- **Node ≥ 22** — Prisma 7 không chạy trên Node 18. Repo có `.nvmrc` (`nvm use`).
- **`.env` ở thư mục gốc** (mẫu: `.env.example`), dùng chung cho Docker Compose, backend và Prisma CLI.
- **DB local:** `npm run db:up` (dùng `docker-compose.dev.yml`). Máy đã có PostgreSQL ở port 5432 thì đặt `POSTGRES_PORT` khác (vd 5433).
