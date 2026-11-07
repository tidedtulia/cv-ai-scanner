# Tasks: Triển khai Azure

Feature branch: `feature/azure-deploy` (tách từ `main` sau khi Phase 4 đã merge)
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md) · Hướng dẫn triển khai: [runbook.md](./runbook.md)

---

## Phân tích & scenario

- [x] Chốt AQ1 (Bicep, chưa CI/CD), AQ2 (Container Apps ×3 + PG Flexible Server), AQ3 (azurecontainerapps.io), AQ4 (Gmail) (2026-11-07)
- [x] Scenario AC-1 → AC-11 trong [requirements.md](./requirements.md)
- [x] Bạn review scenario (2026-11-07)

## Làm

- [x] Backend: `modules/health` (`GET /api/health`, `GET /api/health/ready`, timeout DB 3 giây, không lộ lỗi) + 6 test (đơn vị + HTTP với Nest app thật)
- [x] n8n: `credentials.cjs` đọc `APP_DB_HOST` / `APP_DB_PORT` / `APP_DB_SSL` / `APP_DB_SSL_ALLOW_UNAUTHORIZED` (mặc định = Docker dev) + `credentials.test.cjs` (5 test, chạy trong `npm run wf1:test`)
- [x] `init-db.sh`: admin không phải superuser (chỉ đặt login + mật khẩu; `GRANT n8n TO <admin> WITH SET TRUE, INHERIT TRUE`), `PGHOST` / `PGSSLMODE` có sẵn
- [x] `prisma/seed.ts`: `SEED_SAMPLE_DATA=false` bỏ job mẫu; lỗi chỉ in thông điệp (không in chuỗi kết nối); `packages/backend/scripts/migrate-and-seed.sh`
- [x] Dockerfile + `.dockerignore`: `packages/backend/Dockerfile` (630 MB, gồm Prisma CLI, bỏ `next` / `react`), `packages/frontend/Dockerfile` (393 MB, Next `standalone` qua `NEXT_STANDALONE=true`, `BACKEND_URL` là build arg bắt buộc), `n8n/Dockerfile` (từ `n8nio/n8n:2.46.6`, đóng sẵn `n8n/setup` + `n8n/workflows`)
- [x] `infra/azure/main.bicep` + `main.example.bicepparam` (bí mật đọc từ biến môi trường, `main.bicepparam` nằm trong `.gitignore`); hai pha `deployApps`
- [x] `scripts/deploy/docker-check.mjs` (`npm run docker:check`) và `scripts/deploy/bicep-check.mjs` (`npm run bicep:check`)
- [x] Xoá `docker-compose.prod.yml`
- [x] `runbook.md`; cập nhật `CLAUDE.md`, `project-overview.md` (Phase 5, Q12 → D36), `.gitignore`

## Điều chỉnh khi làm

- AC-6: `SEED_SAMPLE_DATA` mặc định **có** job mẫu (không đổi cách dev), môi trường thật đặt `false` (job migrate của Bicep đặt sẵn).
- AC-7: thay "image giữ chỗ" bằng hai pha `deployApps` (hạ tầng → build image → app); `deployApps` / `imageTag` đọc từ `DEPLOY_APPS` / `IMAGE_TAG`.
- AC-10: xoá hẳn `docker-compose.prod.yml` thay vì dựng compose khác (đã có `docker:check`).
- AC-8: kiểm `X-Forwarded-For` dựa vào test hr-auth hiện có, không thêm test mới.
- Runbook: migrate + seed lần đầu và `init-db.sh` chạy **từ máy bạn** (cần Docker + `adminIp`) *trước* khi tạo n8n, vì n8n cần database `n8n` ngay khi khởi động; job `migrate` dùng cho các lần cập nhật sau.

## Kiểm chứng (2026-11-07)

- [x] Test: backend 350/350 (37 suite), frontend 297/297, shared 20/20, `wf1:test` 16/16. Type-check sạch; lint không có lỗi mới
- [x] `npm run docker:check`: **51 kiểm tra đạt** (dựng 3 image, Postgres tạm với admin không phải superuser): ảnh chạy bằng user `node`, không có `.env`, backend không có `next` / `react`; migrate + seed hai lần (7 nhóm, 7 level, 0 job, 1 HR; chạy lại không đổi, không in mật khẩu); `init-db.sh` hai lần và đúng quyền (`n8n_app` chỉ sửa `status` / `updated_at`, `mcp_readonly` không đọc được ứng viên, mỗi role chỉ vào database của mình); `/api/health`, `/api/health/ready` 200, dừng Postgres → `ready` 503 còn `health` 200, bật lại → 200; frontend `/` 200, proxy `/api/health` và `/api/positions`, `/hr` → 307, đăng nhập HR (cookie HttpOnly + Secure), CV 9 MB qua proxy; n8n khởi động, import credentials + workflow (đang active), 5 credential đúng id, múi giờ `Asia/Ho_Chi_Minh`; **không bí mật ngẫu nhiên nào xuất hiện trong log của 4 container**; dọn sạch container / mạng / image sau khi chạy
- [x] `npm run bicep:check`: `az bicep build` / `lint` / `build-params` sạch; backend ingress nội bộ, n8n min = max = 1, backend max 1, probe đúng đường dẫn, mọi bí mật là `@secure()` + `secretRef`, tệp tham số chỉ đọc từ biến môi trường, không có `MAIL_REDIRECT_TO`
- [x] Thử làm hỏng để chắc kiểm tra bắt lỗi (đều đỏ, đã khôi phục): mở backend ra internet, n8n về 0 replica, ghi bí mật vào file tham số, thêm `MAIL_REDIRECT_TO`
- [x] Đường dev không hỏng: `npm run n8n:up` (tạo lại n8n với `init-db.sh` + `credentials.cjs` đã sửa), `npm run n8n:check`, `npm run mcp:check` đều đạt
- [ ] **Bạn triển khai thật theo [runbook](./runbook.md)** và ghi kết quả vào đây (AC-7, AC-11). Những điểm **chưa kiểm chứng được ngoài Azure**: quyền của admin Flexible Server khi chạy `init-db.sh` (`CREATEROLE` + `GRANT ... WITH SET TRUE`), chứng chỉ TLS của Postgres với n8n (có `verifyDatabaseCertificate = false` để dự phòng), tên nội bộ `http://cvs-backend` giữa các app, `az acr build` trên subscription của bạn, thời gian khởi động n8n so với probe (5 phút)

## Còn lại

- [ ] CI/CD (GitHub Actions) — ngoài phạm vi, làm sau nếu cần
- [ ] Tên miền riêng + chứng chỉ; Key Vault; VNet / private endpoint cho Postgres; dịch vụ gửi mail có SPF / DKIM (khi có domain)
- [ ] Tự động xoá CV sau 12 tháng (Q7)
