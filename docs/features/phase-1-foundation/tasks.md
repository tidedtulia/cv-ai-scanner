# Tasks: Phase 1 — Nền tảng dữ liệu & trang công khai

Feature branch: `feature/phase-1-foundation`
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md) · Thiết kế DB: [database.md](../../database.md)

---

## 1.1 Database

### Môi trường & công cụ

- [x] `.nvmrc` = 22 (Prisma 7 không chạy trên Node 18)
- [x] `.env.example` ở thư mục gốc; `.env` local (không commit)
- [x] Script `db:up` / `db:down` / `db:logs` dùng `docker compose -f docker-compose.dev.yml` (trước đó gọi `docker-compose.yml` không tồn tại)
- [x] Chuyển `prisma.config.ts` về `packages/backend/` (đúng chỗ Prisma CLI tìm); đọc `.env` ở cả `packages/backend` và thư mục gốc; khai báo lệnh seed
- [x] Bỏ khai báo `prisma.schema` trong `packages/backend/package.json` (đã có trong `prisma.config.ts`)
- [x] Bỏ ignore `packages/backend/prisma/migrations/` trong `.gitignore` → migration được commit

### Schema & migration

- [x] `prisma/schema.prisma`: 8 model, 4 enum theo database.md v0.5
  - `id` = `gen_random_uuid()` ở DB; `updated_at` có default `now()` ở DB
  - Tên bảng / cột / enum dạng `snake_case` qua `@map` / `@@map`
  - `evaluations.model` → field Prisma `aiModel` (`@map("model")`)
- [ ] Migration `init` + CHECK constraint viết tay (weight 1–5, min_years ≥ 0, overall_score 0–100, estimated_years ≥ 0)

### Seed

- [x] `prisma/seed.ts`: 7 nhóm vị trí, 7 level (bước 10), 3 vị trí `OPEN` (Developer / Middle / 2 năm) + tiêu chí, 1 tài khoản HR từ `SEED_HR_*`
- [x] Idempotent: chỉ tạo khi chưa có (khớp theo `code` / `email`), không ghi đè

### Module users (giữ API CRUD)

- [x] `common/password.ts`: `hashPassword` / `verifyPassword` (scrypt, không thêm dependency)
- [x] Shared: `CreateUserDto` / `UpdateUserDto` thêm `password`; `IUser` thêm `isActive`, không có `passwordHash`
- [x] Repository: chỉ select các cột công khai (không bao giờ trả `passwordHash`)
- [x] Service: hash mật khẩu, email chữ thường; thiếu `password` → 400
- [x] Controller: `ParseUUIDPipe` cho `:id`
- [ ] Phase 3: thêm guard đăng nhập HR cho `/api/users` (hiện API vẫn mở)

### Tests

- [x] `common/password.spec.ts`
- [x] Cập nhật `users.service.spec.ts`, `users.controller.spec.ts`
- [x] `npx jest` (backend): 22/22 pass
- [x] `nx build @org/backend` + `tsc -b` sạch; type-check `prisma/seed.ts`

### Kiểm tra trên DB thật

- [ ] `npm run db:up` → container healthy
- [ ] `npx prisma migrate dev` áp dụng migration
- [ ] AC-1: INSERT bằng SQL thuần không cần `id` / `created_at` / `updated_at`
- [ ] AC-2: CHECK constraint và `ON DELETE RESTRICT` chặn dữ liệu sai
- [ ] AC-3: `npx prisma db seed` chạy 2 lần → số dòng không đổi
- [ ] AC-4: `GET /api/users` không có `passwordHash`; `:id` sai định dạng → 400

---

## 1.2 API công khai — *chưa bắt đầu*

## 1.3 API nộp đơn + Google Drive — *chưa bắt đầu*

## 1.4 Frontend — *chưa bắt đầu*
