# Feature: Triển khai Azure (Phase 5)

## Mục tiêu

Đưa cả hệ thống (frontend, backend, n8n, PostgreSQL) lên **Azure Container Apps + PostgreSQL Flexible Server** bằng những file trong repo: Dockerfile, endpoint kiểm tra sức khoẻ, Bicep dựng hạ tầng và một runbook từng bước. Mình **không có quyền vào Azure của bạn**, nên phần việc trên Azure do bạn chạy theo runbook; phần trong repo được kiểm chứng bằng cách dựng đúng 3 image đó và chạy thử trên máy (Docker).

Bối cảnh: [project-overview.md §3, Phase 5, Q12](../../project-overview.md) · n8n: [n8n-docker-setup](../n8n-docker-setup/requirements.md) · DB: [database.md §6](../../database.md#6-phân-quyền-db-cho-n8n) · Email: [result-email](../result-email/requirements.md)

---

## Phạm vi

- **Backend:** `GET /api/health` (sống) và `GET /api/health/ready` (sẵn sàng, kiểm tra DB) để Container Apps dùng làm probe.
- **Image (3 Dockerfile + `.dockerignore`):** `backend`, `frontend` (Next.js `standalone`), `n8n` (từ `n8nio/n8n:2.46.6`, đóng sẵn `n8n/setup` + `n8n/workflows`).
- **n8n:** host / SSL của Postgres và các URL của n8n đọc từ biến môi trường (hiện đang gắn cứng `db` và `localhost`).
- **Postgres do Azure quản lý:** `init-db.sh` chạy được với tài khoản admin **không phải superuser** và qua SSL; có script chạy migrate + seed.
- **Hạ tầng (Bicep):** Log Analytics, Azure Container Registry, Container Apps Environment, PostgreSQL Flexible Server, 3 Container Apps, 1 Container Apps Job (migrate + seed), secrets.
- **Kiểm tra trên máy:** `npm run docker:check` dựng 3 image, chạy cùng Postgres cục bộ và kiểm tra từng AC có thể kiểm tra được.
- **Tài liệu:** [runbook.md](./runbook.md) (từng bước, chi phí, cập nhật, quay lui, xoá), cập nhật `CLAUDE.md` và `project-overview.md`; thay `docker-compose.prod.yml` đang lỗi thời.
- **Không làm:** CI/CD (GitHub Actions), tên miền riêng và chứng chỉ (dùng `*.azurecontainerapps.io`), Key Vault (dùng secrets của Container Apps, runbook ghi cách chuyển sau), VNet / private endpoint cho Postgres, nhiều replica cho backend, đổi nhà cung cấp email (vẫn Gmail), sao lưu ngoài cơ chế sẵn có của Flexible Server.

### Kiến trúc đích

```
Internet ──https──► frontend (Container App, ingress ngoài, Next.js)
                        │  /api/* proxy (Next rewrites) ── http nội bộ ──► backend (Container App, ingress NỘI BỘ)
                        │                                                      │ SQL (TLS)        │ SMTP / Google Drive
Internet ──https──► n8n (Container App, ingress ngoài, giới hạn IP)           ▼
                        │ SQL (TLS)                                    PostgreSQL Flexible Server
                        └──────────────────────────────────────────►  (db app + db n8n, 3 role n8n)
migrate Job (image backend): prisma migrate deploy + seed HR đầu tiên
```

---

## Acceptance Criteria

### Kiểm tra sức khoẻ

#### AC-1: `/api/health` và `/api/health/ready`

**Given:** backend đang chạy
**When:** gọi `GET /api/health` không cần đăng nhập
**Then:** 200 `{ "status": "ok" }`, không truy cập DB (chạy được khi DB chết, để probe "sống" không khởi động lại container vô ích).

**When:** gọi `GET /api/health/ready`
**Then:**

| DB | Kết quả |
|----|---------|
| trả lời `SELECT 1` trong 3 giây | 200 `{ "status": "ok", "database": "up" }` |
| lỗi hoặc quá 3 giây | 503 `{ "status": "error", "database": "down" }`, lỗi chi tiết chỉ vào log (không có chuỗi kết nối, mật khẩu, tên host) |

- Cả hai không nằm dưới `/api/hr/*`, không cần cookie, không có `Set-Cookie`, không lộ phiên bản hay biến môi trường.

### Image

#### AC-2: Image backend

**When:** `docker build -f packages/backend/Dockerfile .` (ngữ cảnh là thư mục gốc)
**Then:**
- Build thành công, **không cần** `.env`; trong image không có `.env`, `tmp/`, `node_modules` của dev, mã test.
- Chạy bằng người dùng **không phải root**; lắng nghe `PORT` (mặc định 3001); `/api/health` trả 200 chỉ với các biến bắt buộc.
- Biến môi trường bắt buộc nêu rõ trong runbook: `DATABASE_URL`, `JWT_SECRET`, `CV_STORAGE`, `GOOGLE_*` (khi `CV_STORAGE=google-drive`), `SMTP_*` / `MAIL_FROM`, `NODE_ENV=production`.
- Thiếu `JWT_SECRET` hoặc `CV_STORAGE` hợp lệ → container thoát với thông báo rõ (hành vi hiện có, kiểm tra lại trong image).
- Image chứa Prisma CLI + thư mục `migrations` + seed để chạy `migrate deploy` / `db seed` (AC-6).
- Cookie phiên HR có `Secure` khi `NODE_ENV=production` (hành vi hiện có, giữ nguyên).

#### AC-3: Image frontend

**When:** `docker build -f packages/frontend/Dockerfile --build-arg BACKEND_URL=http://backend .`
**Then:**
- Next.js ở chế độ `standalone`, chạy bằng người dùng không phải root, lắng nghe `PORT` (mặc định 3000), `GET /` trả 200.
- `BACKEND_URL` (đích của rewrite `/api/*`) được **nướng lúc build** (Next ghi vào bảng route); đồng thời đọc lại lúc chạy cho các lời gọi phía server (`hrBackendGet`, danh sách job). Hai giá trị phải trùng; runbook ghi rõ và `docker:check` kiểm tra.
- `GET /api/positions` qua frontend tới được backend; `/hr/*` không cookie → 307 `/hr/login` (hành vi hiện có của `proxy.ts`); CV 10MB đi qua proxy được (cấu hình `proxyClientMaxBodySize` hiện có).
- Không có biến bí mật nào trong image (chỉ `BACKEND_URL` và biến `NEXT_PUBLIC_*` công khai).

#### AC-4: Image n8n

**When:** `docker build -f n8n/Dockerfile .`
**Then:**
- Dựa trên `n8nio/n8n:2.46.6` (ghim phiên bản), chứa sẵn `n8n/setup/*` và `n8n/workflows/*` (trên Azure không có bind mount), dùng cùng `entrypoint.sh`.
- `credentials.cjs` đọc host và SSL của Postgres từ biến môi trường: `APP_DB_HOST` (mặc định `db`), `APP_DB_PORT` (mặc định `5432`), `APP_DB_SSL` (`true` khi dùng Azure) — mặc định **giữ nguyên** cho Docker cục bộ, `npm run n8n:check` vẫn đạt.
- URL của n8n lấy từ biến môi trường: `N8N_HOST`, `N8N_PROTOCOL`, `N8N_EDITOR_BASE_URL`, `N8N_WEBHOOK_URL`; endpoint MCP của WF-1 vẫn gọi `http://localhost:5678/...` (cùng container).
- Container khởi động, import credentials + workflow, publish WF-1 và MCP server, `/healthz/readiness` trả 200; múi giờ `Asia/Ho_Chi_Minh` (lịch 00:00).
- Không biến bí mật nào nằm trong image; `N8N_ENCRYPTION_KEY` luôn do biến môi trường cấp.

### Database do Azure quản lý

#### AC-5: `init-db.sh` với admin không phải superuser, qua SSL

**Given:** một Postgres mà tài khoản admin có `CREATEROLE` + `CREATEDB` nhưng **không phải superuser** (giống `azure_pg_admin`)
**When:** chạy `init-db.sh` với `PGHOST`, `PGSSLMODE=require` (biến chuẩn của `psql`)
**Then:**
- Tạo database `n8n` và 3 role `n8n`, `n8n_app`, `mcp_readonly` với đúng quyền như [database.md §6](../../database.md#6-phân-quyền-db-cho-n8n); chạy lại không lỗi (idempotent).
- Admin được cấp tư cách thành viên role `n8n` để `CREATE DATABASE ... OWNER n8n` và `ALTER DATABASE ... OWNER` chạy được (Azure cấm admin tự là superuser).
- Với Postgres Docker cục bộ (superuser) vẫn chạy như cũ, `npm run n8n:check` đạt.
- Mật khẩu vẫn đọc bằng `\getenv`, không xuất hiện trên dòng lệnh hay log.

#### AC-6: Migrate và seed bằng image backend

**When:** chạy lệnh `migrate` của image backend với `DATABASE_URL` trỏ tới DB trống (và `SEED_HR_*`)
**Then:**
- Áp dụng toàn bộ migration theo thứ tự (`prisma migrate deploy`), rồi seed idempotent: danh mục nhóm / level, job mẫu (mặc định có, như khi dev; **đặt `SEED_SAMPLE_DATA=false` thì bỏ qua** — môi trường thật đặt như vậy), và HR đầu tiên từ `SEED_HR_EMAIL` / `SEED_HR_PASSWORD` (không đặt thì bỏ qua, không lỗi).
- Chạy lại lần 2: không đổi gì, không lỗi, không tạo trùng.
- Thất bại (không kết nối được DB, migration lỗi) → thoát mã ≠ 0 và in nguyên nhân (không in chuỗi kết nối).
- Chạy được như **Container Apps Job** (một lần, theo yêu cầu).

### Hạ tầng

#### AC-7: Bicep dựng toàn bộ hạ tầng

**When:** `az deployment group create -g <nhóm> -f infra/azure/main.bicep -p infra/azure/main.bicepparam`
**Then:** tạo (hoặc cập nhật, idempotent) trong **một resource group**:

| Tài nguyên | Cấu hình mặc định |
|------------|-------------------|
| Log Analytics workspace | lưu 30 ngày, trần 0,5 GB mỗi ngày |
| Azure Container Registry | SKU Basic, không bật tài khoản admin; Container Apps kéo image bằng managed identity (`AcrPull`) |
| Container Apps Environment | gắn Log Analytics |
| PostgreSQL Flexible Server 17 | Burstable `Standard_B1ms`, 32 GB, sao lưu 7 ngày, bắt buộc TLS, database ứng dụng; tường lửa chỉ "Azure services" + IP của bạn khi có tham số |
| `frontend` | ingress **ngoài** (https), cổng 3000, min 0 / max 2 replica, 0,25 vCPU / 0,5 GiB, probe `GET /` |
| `backend` | ingress **nội bộ**, cổng 3001, min 0 / **max 1** replica (bộ đếm đăng nhập sai nằm trong bộ nhớ), 0,25 vCPU / 0,5 GiB, probe liveness `/api/health`, readiness `/api/health/ready` |
| `n8n` | min **1** / max 1 replica (scale về 0 thì lịch 00:00 không chạy), 0,5 vCPU / 1 GiB, probe `/healthz/readiness`; ingress ngoài **chỉ cho các IP/CIDR trong `n8nAllowedCidr`** (rỗng → tắt ingress, n8n chỉ chạy lịch) |
| Job `migrate` | image backend, chạy tay (`az containerapp job start`) |

- Tham số có đặt tên rõ, kèm file mẫu `main.example.bicepparam` **không chứa bí mật**; bí mật truyền qua tham số `@secure()` lúc triển khai, lưu thành **secrets của Container Apps** và nạp vào biến môi trường bằng `secretRef`.
- `BACKEND_URL` của frontend (build và chạy) là địa chỉ nội bộ của backend; `N8N_*` URL lấy từ FQDN thực của n8n; `NODE_ENV=production`.
- Mặc định vùng `southeastasia`; mọi kích thước, vùng, số replica là tham số.
- `az bicep build` và `az bicep lint` không có lỗi hay cảnh báo; đầu ra (`outputs`) gồm URL frontend, URL n8n, tên ACR, tên Postgres, tên job migrate.
- **Hai pha trong cùng một file:** `deployApps=false` (mặc định) chỉ dựng hạ tầng; build image bằng `az acr build`, khởi tạo DB, rồi `deployApps=true` + `imageTag` để tạo 3 app và job (thay cho image giữ chỗ). `deployApps` và `imageTag` đọc từ biến môi trường `DEPLOY_APPS` / `IMAGE_TAG` vì không trộn được file `.bicepparam` với tham số dòng lệnh.

#### AC-8: Bảo mật cấu hình

**Then:**
- Trong repo, image và log **không có** bí mật (mật khẩu DB, `JWT_SECRET`, token, App Password, khoá Anthropic / Google); `.dockerignore` loại `.env*`, `tmp`, `dist`, `node_modules`, `.git`.
- Backend **không** có ingress công khai: trình duyệt luôn đi qua frontend; không có CORS mở.
- Chỉ frontend (https) và n8n (giới hạn IP) có địa chỉ công khai; Postgres bắt buộc TLS.
- `trust proxy` của backend đã nhận dải mạng riêng (envoy → frontend → backend), giữ nguyên hành vi đã được [hr-auth](../hr-auth/requirements.md) kiểm thử; giới hạn đã biết (qua Next mọi người có thể trông như cùng một IP) ghi trong runbook.
- `SMTP_*` / `MAIL_FROM` bắt buộc trong runbook; **không** đặt `MAIL_REDIRECT_TO` trên môi trường thật (runbook nêu rõ, Bicep không có tham số này).

### Kiểm tra trên máy

#### AC-9: `npm run docker:check`

**When:** chạy `npm run docker:check`
**Then:** dùng Docker build 3 image, chạy cùng Postgres cục bộ (cổng tạm, dữ liệu tạm, **không đụng DB dev của bạn**), rồi kiểm tra và in ✓ / ✗:
- AC-1 (cả khi dừng Postgres → `ready` 503, `health` vẫn 200), AC-2 (người dùng không phải root, không có `.env`, thiếu `JWT_SECRET` thì thoát), AC-3 (`/`, proxy `/api/positions`, redirect `/hr/*`), AC-4 (workflow đã import và active, `/healthz/readiness`), AC-5 (admin không superuser), AC-6 (migrate + seed hai lần);
- thiếu Docker → báo rõ và thoát ≠ 0; luôn dọn container, mạng, volume tạm kể cả khi lỗi.

#### AC-10: Dọn file cũ

**Then:** `docker-compose.prod.yml` (tham chiếu `Dockerfile` và `.env.prod` không tồn tại) bị **xoá** vì `docker:check` đã dựng và chạy đúng 3 image thật; `CLAUDE.md` cập nhật lệnh (`docker:check`, `bicep:check`) và ghi chú Azure.

### Tài liệu

#### AC-11: Runbook

**Then:** [runbook.md](./runbook.md) cho người chưa từng dùng Azure, mỗi bước là lệnh chép chạy được (biến ở đầu file), theo thứ tự:
1. Điều kiện: tài khoản Azure + `az login`, đăng ký provider, **xuất bản ứng dụng Google OAuth lên Production** (nếu không thì refresh token hết hạn sau 7 ngày), tạo các bí mật (`openssl rand`), Gmail App Password.
2. Dựng hạ tầng (Bicep) → build image (`az acr build`) → cập nhật app.
3. Khởi tạo DB: `init-db.sh` (qua `docker run postgres:17-alpine` với tường lửa mở tạm cho IP của bạn), rồi Job `migrate`.
4. Kiểm tra: URL frontend, `/api/health/ready`, đăng nhập HR, nộp CV thử, n8n (IP được phép, WF-1 đang active, thử chạy tay), email thử qua `mail:check`.
5. Vận hành: cập nhật phiên bản, xem log, **quay lui**, thay bí mật, đổi `n8nAllowedCidr`, sao lưu / khôi phục DB, **dừng để tiết kiệm** và xoá toàn bộ.
6. Chi phí ước tính theo từng tài nguyên và những núm vặn (scale về 0, SKU, trần log), các rủi ro đã biết (cold start khi scale về 0, Gmail vào thư rác, bộ đếm đăng nhập theo từng instance, một IP ra ngoài, giới hạn Gmail ~500 email/ngày).

---

## Kiểm thử

Theo [CLAUDE.md — Feature workflow](../../../CLAUDE.md): backend có Jest; phần hạ tầng kiểm bằng script thật.

| AC | Test |
|----|------|
| AC-1 | backend `health/health.controller.spec.ts` (đơn vị: DB lên / lỗi / quá 3 giây, không lộ lỗi) + `health/health.http.spec.ts` (Nest app thật: không cần cookie, không `Set-Cookie`, ngoài `HrAuthGuard`) · `docker:check` |
| AC-2, AC-3, AC-4 | `scripts/deploy/docker-check.mjs` (dựng và chạy 3 image thật) |
| AC-4 | thêm `n8n/setup/credentials.test.cjs` (host / cổng / SSL từ biến môi trường, mặc định giữ nguyên) chạy trong `npm run wf1:test` |
| AC-5 | `docker-check.mjs` (tạo admin `NOSUPERUSER CREATEROLE CREATEDB`, chạy `init-db.sh` hai lần, kiểm quyền) + `npm run n8n:check` (đường superuser) |
| AC-6 | `docker-check.mjs` (migrate + seed hai lần trên DB trống) · backend `prisma/seed` (nếu tách hàm thì có test) |
| AC-7 | `az bicep build` + `az bicep lint` không lỗi; kiểm tra tĩnh bằng script (`scripts/deploy/bicep-check.mjs`: không có giá trị bí mật trong file, backend ingress nội bộ, n8n min 1, backend max 1, probe đúng đường dẫn) · **triển khai thật: bạn chạy theo runbook, ghi vào tasks.md** |
| AC-8 | `docker-check.mjs` (không có `.env` trong image; không bí mật ngẫu nhiên nào của lần chạy xuất hiện trong log 4 container; cookie `Secure`) + `bicep-check.mjs` · `trust proxy`: test hr-auth hiện có |
| AC-9, AC-10 | chạy `npm run docker:check`; file `docker-compose.prod.yml` đã xoá |
| AC-11 | rà soát bằng mắt + chạy thử từng lệnh có thể chạy cục bộ (`az bicep build`, `docker build`) |

---

## Quyết định (2026-11-07)

| # | Câu hỏi | Đã chốt |
|---|---------|---------|
| AQ1 | Phạm vi | Dockerfile + health + **Bicep** + runbook; **chưa** CI/CD |
| AQ2 | Dịch vụ Azure (Q12) | **Container Apps cho cả 3** + PostgreSQL Flexible Server |
| AQ3 | Tên miền | `*.azurecontainerapps.io` trước, gắn domain riêng sau |
| AQ4 | Email thật | Giữ **Gmail** lúc đầu (đổi dịch vụ có SPF / DKIM khi có domain) |
| — | Secrets | Secrets của Container Apps (tham số `@secure()`), chưa dùng Key Vault; runbook ghi cách chuyển |
| — | Registry | ACR Basic, kéo bằng managed identity, build bằng `az acr build` (không cần Docker cục bộ để đẩy image) |
| — | Mạng DB | Truy cập công khai + TLS + tường lửa "Azure services" (không VNet) cho MVP |
| — | Số replica | frontend 0–2, **backend 0–1**, **n8n 1–1**; scale về 0 gây cold start vài giây cho người dùng đầu tiên, đổi bằng tham số |
| — | n8n | Editor ngoài internet nhưng **giới hạn theo IP** (`n8nAllowedCidr`); rỗng thì tắt ingress |
| — | Vùng | `southeastasia` (gần Việt Nam) |

### Ghi chú kỹ thuật

- **`BACKEND_URL` bị nướng lúc build:** `next.config.js` đọc biến này trong `rewrites()` khi `next build`; vì thế image frontend cần build arg, và địa chỉ nội bộ của Container Apps (`http://backend`) phải biết trước khi build — đặt tên app cố định.
- **n8n gắn cứng:** `credentials.cjs` dùng host `db` và `entrypoint.sh` đọc `/setup`, `/workflows` từ bind mount; image n8n riêng thay cả hai.
- **`init-db.sh` hiện cần superuser** để `CREATE DATABASE ... OWNER n8n` (cần là thành viên của role `n8n`): thêm `GRANT n8n TO <admin>` khi chưa là superuser.
- **Backend bundle bằng webpack nhưng để dependency ngoài (`externalDependencies`)**: image cần `node_modules` production (`npm ci --omit=dev` theo lockfile đã prune) và Prisma Client đã generate.
- **Google OAuth ở chế độ Testing:** refresh token hết hạn sau 7 ngày — bắt buộc xuất bản ứng dụng (chuyển sang Production) trước khi chạy thật (runbook bước 1). Đây là việc ngoài code.
- **Giới hạn đã biết:** bộ đếm đăng nhập sai nằm trong bộ nhớ của một instance (nên backend `max 1`); mọi người dùng ra qua cùng IP của envoy / Next nên bộ đếm theo IP thực chất là theo email + một IP chung — đã ghi ở phase hr-auth, chưa đổi ở đây.
- **Chi phí ước tính (chưa tính thuế, tham khảo):** Postgres B1ms + 32 GB khoảng 15–25 USD/tháng; n8n chạy 24/7 (0,5 vCPU / 1 GiB) khoảng 15–20 USD; frontend / backend scale về 0 gần như chỉ tính khi có người dùng; ACR Basic khoảng 5 USD; Log Analytics có trần ngày. Tổng khoảng 40–60 USD/tháng — con số chính xác sẽ ghi lại trong runbook sau khi tra bảng giá.
