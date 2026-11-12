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
- [x] **Phương án B (2026-11-07, theo yêu cầu giảm chi phí)**: bỏ ACR + managed identity, image `ghcr.io` public (`imageRegistry`); n8n theo khung giờ (`n8nAlwaysOn=false`: min 0 + rule cron 23:50 → 02:00 + rule HTTP khi có ingress, chờ dừng 600 giây); trần log 0,1 GB/ngày
- [x] Runbook mục 10: làm bằng Azure Portal + Cloud Shell (không cần cài `az` / Docker; migrate bằng Job, `init-db.sh` bằng `psql` của Cloud Shell) và `npm run bicep:build` (file ARM JSON để tải lên Portal; kiểm tra: 46 tham số, không có bí mật)
- [x] `.github/workflows/images.yml` (build 3 image từ bản checkout sạch → `scripts/deploy/scan-image.sh` → đẩy bằng `GITHUB_TOKEN`) và AC-12, AC-13 trong requirements
- [x] `scripts/deploy/docker-check.mjs` (`npm run docker:check`) và `scripts/deploy/bicep-check.mjs` (`npm run bicep:check`)
- [x] Xoá `docker-compose.prod.yml`
- [x] `runbook.md`; cập nhật `CLAUDE.md`, `project-overview.md` (Phase 5, Q12 → D36), `.gitignore`

## Điều chỉnh khi làm

- AC-6: `SEED_SAMPLE_DATA` mặc định **có** job mẫu (không đổi cách dev), môi trường thật đặt `false` (job migrate của Bicep đặt sẵn).
- AC-7: thay "image giữ chỗ" bằng hai pha `deployApps` (hạ tầng → build image → app); `deployApps` / `imageTag` đọc từ `DEPLOY_APPS` / `IMAGE_TAG`.
- AC-10: xoá hẳn `docker-compose.prod.yml` thay vì dựng compose khác (đã có `docker:check`).
- AC-7: **bỏ ACR + managed identity** (image `ghcr.io` public), **n8n min 0 theo khung giờ** (trước đây min = max = 1), trần log 0,1 GB/ngày (trước đây 0,5); thêm AC-12 (workflow) và AC-13 (khung giờ n8n) — phương án B để giảm chi phí, xem [runbook §8](./runbook.md#8-chi-phí-và-núm-vặn).
- AC-8: kiểm `X-Forwarded-For` dựa vào test hr-auth hiện có, không thêm test mới.
- Runbook: migrate + seed lần đầu và `init-db.sh` chạy **từ máy bạn** (cần Docker + `adminIp`) *trước* khi tạo n8n, vì n8n cần database `n8n` ngay khi khởi động; job `migrate` dùng cho các lần cập nhật sau.

## Kiểm chứng (2026-11-07)

- [x] Test: backend 350/350 (37 suite), frontend 297/297, shared 20/20, `wf1:test` 16/16. Type-check sạch; lint không có lỗi mới
- [x] `npm run docker:check`: **51 kiểm tra đạt** (dựng 3 image, Postgres tạm với admin không phải superuser): ảnh chạy bằng user `node`, không có `.env`, backend không có `next` / `react`; migrate + seed hai lần (7 nhóm, 7 level, 0 job, 1 HR; chạy lại không đổi, không in mật khẩu); `init-db.sh` hai lần và đúng quyền (`n8n_app` chỉ sửa `status` / `updated_at`, `mcp_readonly` không đọc được ứng viên, mỗi role chỉ vào database của mình); `/api/health`, `/api/health/ready` 200, dừng Postgres → `ready` 503 còn `health` 200, bật lại → 200; frontend `/` 200, proxy `/api/health` và `/api/positions`, `/hr` → 307, đăng nhập HR (cookie HttpOnly + Secure), CV 9 MB qua proxy; n8n khởi động, import credentials + workflow (đang active), 5 credential đúng id, múi giờ `Asia/Ho_Chi_Minh`; **không bí mật ngẫu nhiên nào xuất hiện trong log của 4 container**; dọn sạch container / mạng / image sau khi chạy
- [x] `npm run bicep:check` (sau phương án B): `az bicep build` / `lint` / `build-params` sạch; không có ACR / managed identity / role assignment, image từ `ghcr.io` chữ thường, trần log 0,1 GB, backend ingress nội bộ và max 1, n8n max 1 + min theo `n8nAlwaysOn` + rule cron đúng tham số và múi giờ Việt Nam + rule HTTP chỉ khi có ingress + chờ dừng 600 giây, probe đúng đường dẫn, mọi bí mật là `@secure()` + `secretRef`, tệp tham số chỉ đọc từ biến môi trường, không có `MAIL_REDIRECT_TO`
- [x] Thử làm hỏng để chắc kiểm tra bắt lỗi (đều đỏ, đã khôi phục): mở backend ra internet, n8n về 0 replica (bản cũ), ghi bí mật vào file tham số, thêm `MAIL_REDIRECT_TO`; sau phương án B: n8n luôn min 1, trần log 0,5, giờ bắt đầu cron cố định, chờ dừng 30 giây
- [x] `scripts/deploy/scan-image.sh` chạy thật: backend và n8n sạch (exit 0); image cố tình chứa `.env` và khoá giả `sk-ant-…` bị chặn (exit 1, nêu đúng hai tệp). Cú pháp workflow kiểm bằng js-yaml (10 bước, quyền `contents: read` + `packages: write`)
- [x] Đường dev không hỏng: `npm run n8n:up` (tạo lại n8n với `init-db.sh` + `credentials.cjs` đã sửa), `npm run n8n:check`, `npm run mcp:check` đều đạt
- [ ] **Bạn chạy workflow *Build images* trên GitHub** (mình không chạy được Actions), đổi 3 gói sang Public, và kiểm tra `docker pull` không đăng nhập
- [ ] **Bạn triển khai thật theo [runbook](./runbook.md)** và ghi kết quả vào đây (AC-7, AC-11). Những điểm **chưa kiểm chứng được ngoài Azure**: quyền của admin Flexible Server khi chạy `init-db.sh` (`CREATEROLE` + `GRANT ... WITH SET TRUE`), chứng chỉ TLS của Postgres với n8n (có `verifyDatabaseCertificate = false` để dự phòng), tên nội bộ `http://cvs-backend` giữa các app, `az acr build` trên subscription của bạn, thời gian khởi động n8n so với probe (5 phút), phiên bản `psql` và quyền kết nối của **Cloud Shell** (runbook 10.4), **rule cron + `minReplicas = 0` của n8n có bật đúng lúc 23:50 và lịch 00:00 có chạy không** (theo dõi vài đêm đầu), thời gian kéo image từ `ghcr.io` khi scale từ 0, và các thuộc tính `terminationGracePeriodSeconds` / rule `cron` được Azure chấp nhận khi triển khai thật

## Còn lại

- [ ] Google OAuth: Google đòi *Application home page* + *privacy policy link* mới cho xuất bản (tooltip của nút Publish app); làm ở runbook bước 5.6 sau khi có URL frontend. **Chưa biết** Google có chấp nhận tên miền `*.azurecontainerapps.io` làm Authorized domain không; nếu không thì cần tên miền riêng hoặc trang tĩnh trên tên miền do bạn kiểm soát
- [ ] CI/CD (GitHub Actions) — ngoài phạm vi, làm sau nếu cần
- [ ] Tên miền riêng + chứng chỉ; Key Vault; VNet / private endpoint cho Postgres; dịch vụ gửi mail có SPF / DKIM (khi có domain)
- [ ] Tự động xoá CV sau 12 tháng (Q7)
- [x] **Lỗi thấy khi triển khai thật (2026-11-08):** n8n `Failed` với `permission denied for schema public` vì trên Azure schema `public` của database `n8n` không thuộc chủ database; `init-db.sh` giờ `GRANT USAGE, CREATE ON SCHEMA public TO n8n` trong database `n8n`, và `docker:check` mô phỏng điều kiện này

## Triển khai thật lên Azure (2026-11-07 → 2026-11-12, bạn chạy, mình hỗ trợ từ xa)

- [x] Pha 1 (`deployApps=false`) `Succeeded` sau 7 phút: Log Analytics, môi trường Container Apps, PostgreSQL Flexible Server `Standard_B1ms`, database `cv_scanner`, firewall (Azure services + IP của bạn). Pha 2 (`deployApps=true`, tag `20261108.3`) `Succeeded`: `cvs-frontend`, `cvs-backend` (ingress nội bộ), `cvs-n8n` (IP được phép + rule cron + HTTP), job `cvs-migrate`
- [x] Image `ghcr.io/tidedtulia/cv-backend | cv-frontend | cv-n8n` (workflow *Build images*, 3 gói đã Public, kéo được không cần đăng nhập)
- [x] Migrate + seed và `init-db.sh` chạy từ máy (Docker) với admin không phải superuser của Azure
- [x] Kiểm tra từ internet: `/`, `/privacy`, `/submit-cv`, `/jobs`, `/hr/login` 200; `/api/health` và `/api/health/ready` (`database: up`) 200; `/api/positions` `[]`; backend không có đường vào công khai
- [x] Ứng dụng Google OAuth chuyển sang **In production** (Branding: tên app, email hỗ trợ, email liên hệ, trang chủ và chính sách riêng tư của frontend, Authorized domain); lấy lại refresh token sau khi xuất bản và cập nhật secrets
- [x] n8n chạy được: 3 workflow import + publish, `/healthz` và `/healthz/readiness` 200, đăng nhập owner được; **khởi động lại 3 lần liên tiếp trên database đã có dữ liệu đều thành công**
- [ ] Chưa kiểm chứng: đêm nay (23:50 bật, 00:00 chấm) rule cron + `minReplicas = 0` có bật n8n đúng giờ và WF-1 có chạy; nộp CV thật qua Drive; email kết quả qua Gmail trên bản chạy thật

### Lỗi gặp khi triển khai thật và cách đã xử lý

| Lỗi | Nguyên nhân | Đã làm |
|-----|-------------|--------|
| `Parameter 'AdministratorLoginPassword' must be specified` | biến `POSTGRES_ADMIN_PASSWORD` rỗng trong terminal; `validate` không bắt được; mật khẩu `openssl rand -hex` cũng chỉ có 2 loại ký tự (Azure đòi ≥ 3) | `@minLength(8)` + không còn giá trị mặc định rỗng; runbook 1.4 và 1.6; `env-to-exports` bỏ qua mật khẩu không đủ phức tạp |
| `nvm` từ chối chạy | biến shell `PREFIX` | đổi thành `CVS_PREFIX` |
| `read -p` lỗi trong zsh | cú pháp bash | hàm `ask` chạy được ở cả hai |
| `npm run drive:auth` không chạy | script chỉ có ở `packages/backend`; Node 18 | thêm script ở thư mục gốc; ghi `nvm use` |
| `Connection refused` tới PostgreSQL và editor n8n | IP công khai của máy đổi | runbook 6.5 (cập nhật firewall và `allow-0`) |
| n8n `permission denied for schema public` | trên Azure schema `public` của database `n8n` không thuộc chủ database | `init-db.sh` cấp `CREATE`; `docker:check` mô phỏng |
| n8n `Failed` lặp (`permission to deactivate this workflow`) | database `n8n` dở dang do lần khởi tạo đầu bị ngắt (tạo revision mới giữa lúc migration) | xoá và tạo lại database `n8n`, một replica; runbook bảng sự cố. Không tái hiện được trên máy |
| Tài khoản HR là `<email hr thật>` (401) | dòng lệnh mẫu chưa thay chỗ mẫu | seed từ chối email không hợp lệ; xoá tài khoản mẫu |
| Mật khẩu n8n owner bị cắt tại `#` | `#` không nháy trong `.env`: dotenv cắt, Docker Compose thì không | quote đơn; `env-to-exports` cảnh báo |
