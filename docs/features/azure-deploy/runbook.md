# Runbook: triển khai CV AI Scanner lên Azure

Dành cho người chưa từng dùng Azure. Mỗi bước là lệnh chép chạy được trong **terminal bash/zsh**, tại **thư mục gốc của repo**. Yêu cầu: [requirements.md](./requirements.md) (AC-7, AC-11 → AC-13). Kiến trúc: frontend (công khai) → backend (nội bộ) → PostgreSQL; n8n (giới hạn IP, **chỉ chạy theo khung giờ**) → PostgreSQL. Image nằm trên **`ghcr.io` (public)**, build bằng GitHub Actions.

> **Trạng thái:** các file Docker và Bicep đã được kiểm tra trên máy (`npm run docker:check`, `npm run bicep:check`). **Chưa từng triển khai thật lên Azure** — lần đầu có thể gặp lỗi riêng của tài khoản/subscription; xem mục [Sự cố thường gặp](#7-sự-cố-thường-gặp) và ghi kết quả vào [tasks.md](./tasks.md).

## 0. Trước khi bắt đầu

| Cần | Cách có |
|-----|---------|
| Tài khoản Azure có **subscription** còn hạn mức | https://portal.azure.com |
| Azure CLI (`az`), Docker Desktop đang chạy, `openssl` | `az --version`, `docker version` |
| Quyền **Contributor** trên resource group (không còn role assignment: image public, không có ACR) | Subscription → Access control (IAM) |
| Quyền chạy **GitHub Actions** và đổi gói sang Public trên repo `tidedtulia/cv-ai-scanner` | GitHub → Actions đã bật |
| Ứng dụng Google OAuth đã **xuất bản (Production)** | bước 1.3 |
| Gmail App Password | đã dùng khi dev (`SMTP_PASSWORD`) |

Chi phí khoảng **0–5 USD/tháng** trong 12 tháng ưu đãi PostgreSQL và **17–35 USD/tháng** sau đó (xem [mục 8](#8-chi-phí-và-núm-vặn); ước tính chưa đo); dừng được khi không dùng (mục 6.7).

## 1. Chuẩn bị (làm một lần)

### 1.1 Đăng nhập, chọn subscription, cài Bicep

```bash
az login
az account list -o table
az account set --subscription "<tên hoặc id subscription>"
az bicep install

# đăng ký các dịch vụ sẽ dùng (chỉ cần lần đầu của subscription)
for p in Microsoft.App Microsoft.DBforPostgreSQL Microsoft.OperationalInsights; do az provider register --namespace $p; done
az provider show -n Microsoft.App --query registrationState -o tsv   # đợi tới khi là Registered
```

### 1.2 Biến dùng xuyên suốt

```bash
export RG=cvs-rg PREFIX=cvs LOCATION=southeastasia
```

`PREFIX` phải trùng `namePrefix` trong file tham số (mặc định `cvs`); tên app là `cvs-frontend`, `cvs-backend`, `cvs-n8n`.

### 1.3 Google OAuth: xuất bản ứng dụng (bắt buộc)

Khi ứng dụng OAuth còn ở chế độ **Testing**, refresh token **hết hạn sau 7 ngày** → CV upload và n8n tải CV sẽ ngừng chạy một tuần sau khi deploy.
1. Google Cloud Console → **APIs & Services → OAuth consent screen** → **Publish app** (chuyển sang *In production*). Scope `drive.file` không cần Google xét duyệt.
2. Lấy lại refresh token bằng `cd packages/backend && npm run drive:auth` (làm theo hướng dẫn trong `docs/features/submit-application-api/google-drive-setup.md`) và dùng giá trị mới ở bước 1.4.

### 1.4 Tạo bí mật

Các giá trị **mới**, không dùng lại mật khẩu của môi trường dev. Lưu tất cả vào trình quản lý mật khẩu — `N8N_ENCRYPTION_KEY` **không bao giờ được đổi** (đổi là n8n mất toàn bộ credentials), `POSTGRES_ADMIN_PASSWORD` cần cho mọi lần khởi tạo/cập nhật.

```bash
export POSTGRES_ADMIN_PASSWORD=$(openssl rand -hex 24)
export JWT_SECRET=$(openssl rand -hex 32)
export N8N_DB_PASSWORD=$(openssl rand -hex 24)
export N8N_APP_DB_PASSWORD=$(openssl rand -hex 24)
export MCP_DB_PASSWORD=$(openssl rand -hex 24)
export MCP_AUTH_TOKEN=$(openssl rand -hex 32)
export N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)
export N8N_OWNER_PASSWORD="Aa1$(openssl rand -hex 12)"      # n8n: 8-64 ký tự, có số và chữ hoa
export SEED_HR_PASSWORD="Hr1!$(openssl rand -hex 10)"       # mật khẩu HR đầu tiên (đổi sau khi đăng nhập)
# những giá trị bạn đã có (nhập, không hiện lên màn hình):
read -rs -p "ANTHROPIC_API_KEY: " ANTHROPIC_API_KEY; export ANTHROPIC_API_KEY; echo
read -rs -p "GOOGLE_CLIENT_ID: " GOOGLE_CLIENT_ID; export GOOGLE_CLIENT_ID; echo
read -rs -p "GOOGLE_CLIENT_SECRET: " GOOGLE_CLIENT_SECRET; export GOOGLE_CLIENT_SECRET; echo
read -rs -p "GOOGLE_REFRESH_TOKEN (mới, sau khi xuất bản): " GOOGLE_REFRESH_TOKEN; export GOOGLE_REFRESH_TOKEN; echo
read -rs -p "SMTP_PASSWORD (Gmail App Password): " SMTP_PASSWORD; export SMTP_PASSWORD; echo
```

Các biến này chỉ tồn tại trong cửa sổ terminal này; mở cửa sổ mới thì phải đặt lại (mật khẩu từ trình quản lý). **Đừng** ghi chúng vào file trong repo.

### 1.5 File tham số

```bash
cp infra/azure/main.example.bicepparam infra/azure/main.bicepparam    # đã được .gitignore
```

Sửa các giá trị thường (không phải bí mật) trong `main.bicepparam`: `googleDriveCvFolderId`, `smtpUser`, `mailFrom` (ví dụ `'CV AI Scanner <trantrieu491@gmail.com>'`), `mailReplyTo`, `privacyContactEmail`, `n8nOwnerEmail`, `seedHrEmail`. **Không** đặt `MAIL_REDIRECT_TO` (không có tham số này: môi trường thật gửi cho ứng viên).

```bash
export MY_IP=$(curl -s https://api.ipify.org); echo $MY_IP
```

Đặt `adminIp = '<MY_IP>'` (để chạy bước 3 từ máy bạn) và `n8nAllowedCidr = ['<MY_IP>/32']` (để mở editor n8n); để `n8nAllowedCidr = []` nếu chưa cần.

## 2. Pha 1: dựng hạ tầng

```bash
az group create -n $RG -l $LOCATION
az deployment group create -g $RG -f infra/azure/main.bicep -p infra/azure/main.bicepparam
```

Mất khoảng 5–10 phút (PostgreSQL lâu nhất). Lấy tên tài nguyên:

```bash
out() { az deployment group show -g $RG -n main --query "properties.outputs.$1.value" -o tsv; }
export IMAGE_REGISTRY=$(out imageRegistry) PGHOST=$(out postgresHost) DBNAME=$(out appDatabaseName)
echo "$IMAGE_REGISTRY  $PGHOST  $DBNAME"
```

## 3. Build image, khởi tạo database

### 3.1 Build 3 image bằng GitHub Actions (đẩy lên `ghcr.io`, public)

1. Nếu `namePrefix` **không** phải `cvs`: GitHub → repo → Settings → Secrets and variables → Actions → **Variables** → thêm `NAME_PREFIX` = giá trị đó (frontend bị nướng địa chỉ `http://<PREFIX>-backend` lúc build).
2. GitHub → **Actions → Build images → Run workflow** → nhập `tag` (ví dụ `20261107.1`, chữ / số / `. _ -`). Hoặc push tag `v*`. Workflow dựng 3 image từ bản checkout sạch, **quét** (không có `.env`, không có chuỗi giống khoá bí mật; có là dừng, không đẩy gì), rồi đẩy bằng `GITHUB_TOKEN`.
3. **Chỉ lần đầu:** gói mới tạo mặc định là *private*. Vào GitHub → ảnh đại diện → **Your profile → Packages**; với **từng** gói `cv-backend`, `cv-frontend`, `cv-n8n`: **Package settings → Change visibility → Public** (và *Connect repository* nếu được hỏi).
4. Kiểm tra kéo được **không cần đăng nhập** (cửa sổ khác, chưa `docker login`):

```bash
export TAG=20261107.1                              # đúng tag đã nhập ở bước 2
docker pull $IMAGE_REGISTRY/cv-backend:$TAG && docker pull $IMAGE_REGISTRY/cv-frontend:$TAG && docker pull $IMAGE_REGISTRY/cv-n8n:$TAG
```

Báo `denied` / `unauthorized` nghĩa là gói còn private (bước 3).

### 3.2 Migrate + seed (từ máy bạn, dùng đúng image vừa build)

Cần `docker` cục bộ và địa chỉ IP của bạn đã nằm trong `adminIp`.

```bash
export DATABASE_URL="postgresql://cvsadmin:${POSTGRES_ADMIN_PASSWORD}@${PGHOST}:5432/${DBNAME}?sslmode=require"
docker run --rm -e DATABASE_URL -e SEED_SAMPLE_DATA=false -e SEED_HR_EMAIL="<email HR đầu tiên>" -e SEED_HR_PASSWORD \
  $IMAGE_REGISTRY/cv-backend:$TAG sh packages/backend/scripts/migrate-and-seed.sh
```

Thành công khi thấy `Seed done — categories: 7, levels: 7, positions: 0, … users: 1`. Chạy lại được, không tạo trùng.

### 3.3 Tạo database `n8n` và 3 role

```bash
docker run --rm -v "$PWD/n8n/setup:/setup:ro" \
  -e PGHOST=$PGHOST -e PGSSLMODE=require -e POSTGRES_USER=cvsadmin -e POSTGRES_PASSWORD=$POSTGRES_ADMIN_PASSWORD -e POSTGRES_DB=$DBNAME \
  -e N8N_DB_PASSWORD -e N8N_APP_DB_PASSWORD -e MCP_DB_PASSWORD \
  postgres:17-alpine sh /setup/init-db.sh
```

Kết quả: `n8n-init: database n8n + roles n8n / n8n_app / mcp_readonly are up to date`. Phải chạy **sau** bước 3.2 (script kiểm tra bảng đã có) và **trước** khi n8n khởi động.

## 4. Pha 2: tạo 3 app và job

```bash
export DEPLOY_APPS=true IMAGE_TAG=$TAG
az deployment group create -g $RG -f infra/azure/main.bicep -p infra/azure/main.bicepparam
export FRONTEND_URL=$(out frontendUrl) N8N_URL=$(out n8nUrl); echo "$FRONTEND_URL  $N8N_URL"
```

## 5. Kiểm tra sau khi triển khai

```bash
# 5.1 frontend và backend (qua proxy của frontend)
curl -s -o /dev/null -w "home %{http_code}\n" $FRONTEND_URL/
curl -s $FRONTEND_URL/api/health/ready                    # {"status":"ok","database":"up"}
curl -s $FRONTEND_URL/api/positions | head -c 200         # danh sách rỗng (chưa có job; HR tạo trong /hr/positions)

# 5.2 backend KHÔNG truy cập được từ internet (không có ingress công khai)
az containerapp show -g $RG -n $PREFIX-backend --query "properties.configuration.ingress.external" -o tsv   # false
```

Rồi làm bằng tay:
1. Mở `$FRONTEND_URL/hr/login`, đăng nhập bằng `SEED_HR_EMAIL` / `SEED_HR_PASSWORD`; tạo một job thử (DRAFT → có tiêu chí → OPEN) và đổi mật khẩu HR.
2. Mở `$FRONTEND_URL/submit-cv`, nộp một CV PDF thử (kiểm tra Google Drive và đơn xuất hiện ở `/hr`).
3. n8n: mở `$N8N_URL` (chỉ IP trong `n8nAllowedCidr` vào được), đăng nhập `n8nOwnerEmail` / `N8N_OWNER_PASSWORD`; kiểm tra workflow **CV Scanner WF-1** và **MCP server** đang *Active*; bấm chạy tay WF-1 để chấm đơn thử, rồi xem kết quả ở `/hr`.
4. Email: trên máy bạn, `SMTP_*` / `MAIL_FROM` đặt trong `.env`, chạy `npm run mail:check <email của bạn>`; rồi chốt Nhận/Từ chối một đơn thử **của chính bạn** (email thật gửi tới địa chỉ ứng viên đã nhập — dùng email của bạn khi nộp).
5. Log nếu có lỗi: mục [6.2](#62-xem-log).

## 6. Vận hành

### 6.1 Cập nhật phiên bản mới

```bash
# 1) GitHub → Actions → Build images → Run workflow, tag mới (mục 3.1); gói đã Public từ lần đầu
export TAG=<tag vừa build>
# 2) có migration mới? áp dụng TRƯỚC khi chuyển app sang bản mới (lệnh của bước 3.2, với image mới; cần `adminIp`):
docker run --rm -e DATABASE_URL -e SEED_SAMPLE_DATA=false $IMAGE_REGISTRY/cv-backend:$TAG sh packages/backend/scripts/migrate-and-seed.sh
# rồi chuyển app sang bản mới
export DEPLOY_APPS=true IMAGE_TAG=$TAG
az deployment group create -g $RG -f infra/azure/main.bicep -p infra/azure/main.bicepparam
```

Không có `adminIp` (hoặc không có Docker cục bộ)? Chạy job có sẵn **sau** `az deployment`: `az containerapp job start -g $RG -n $PREFIX-migrate` rồi `az containerapp job execution list -g $RG -n $PREFIX-migrate -o table` (phải là *Succeeded*). Giữa hai việc, bản app mới chạy với schema cũ trong thời gian ngắn — chỉ chấp nhận được khi migration chỉ **thêm** (cột / bảng mới), như các migration của dự án tới giờ.

### 6.2 Xem log

```bash
az containerapp logs show -g $RG -n $PREFIX-backend --follow --tail 100
az containerapp logs show -g $RG -n $PREFIX-n8n --follow --tail 100
az containerapp job execution list -g $RG -n $PREFIX-migrate -o table
```

### 6.3 Quay lui

App: deploy lại với tag cũ (`export IMAGE_TAG=<tag cũ>` rồi chạy `az deployment group create` như mục 4), hoặc kích hoạt revision cũ: `az containerapp revision list -g $RG -n $PREFIX-backend -o table` rồi `az containerapp revision activate ...`. **Migration không tự quay lui**: nếu migration sai, khôi phục DB (6.6) rồi triển khai tag cũ.

### 6.4 Đổi bí mật

Đặt lại biến môi trường rồi chạy lại `az deployment group create` (mục 4). Riêng: `N8N_ENCRYPTION_KEY` **không đổi được**; mật khẩu DB của role `n8n` / `n8n_app` / `mcp_readonly` phải chạy lại bước 3.3 với mật khẩu mới **trước** khi deploy; `POSTGRES_ADMIN_PASSWORD` đổi bằng `az postgres flexible-server update -g $RG -n <tên server> --admin-password ...` rồi deploy lại.

### 6.5 Đổi IP được vào n8n / IP chạy lệnh DB

Sửa `n8nAllowedCidr` / `adminIp` trong `main.bicepparam` và chạy lại mục 4. Xoá `adminIp` (để rỗng) khi không cần nữa — firewall đó sẽ bị gỡ ở lần deploy sau.

### 6.6 Sao lưu và khôi phục DB

Flexible Server tự sao lưu (7 ngày) và cho khôi phục về một thời điểm:
```bash
az postgres flexible-server restore -g $RG -n <tên server mới> --source-server <tên server> --restore-time "2026-11-07T10:00:00Z"
```
Rồi chuyển `DATABASE_URL` / `DB_POSTGRESDB_HOST` sang server mới (tạo lại bằng Bicep với `postgresName` mới hoặc cập nhật secret tay). Có thể dump bằng `pg_dump` từ máy bạn (cần `adminIp`).

### 6.7 Dừng để tiết kiệm, và xoá

```bash
# ngủ đông: dừng PostgreSQL (tự bật lại sau 7 ngày). Trang web và lịch chấm CV sẽ KHÔNG chạy trong lúc dừng.
# Lưu ý: dừng chỉ ngừng tiền máy (compute); tiền ổ đĩa và backup vẫn tính. Muốn hết hẳn thì xoá (phía dưới)
az postgres flexible-server stop -g $RG -n <tên server>
# bật lại
az postgres flexible-server start -g $RG -n <tên server>

# xoá TOÀN BỘ (không hoàn tác, mất dữ liệu):
az group delete -n $RG --yes --no-wait
```

n8n đã tự về 0 ngoài khung giờ (6.8) nên không cần làm gì thêm cho n8n; nếu bạn đặt `n8nAlwaysOn = true` thì chạy thêm `az containerapp update -g $RG -n $PREFIX-n8n --min-replicas 0` khi ngủ đông và `--min-replicas 1` khi bật lại (lần deploy Bicep kế tiếp sẽ đặt lại giá trị theo tham số).

### 6.8 n8n theo khung giờ

Mặc định n8n **không chạy cả ngày**: chỉ có replica từ `n8nWindowStart` (23:50) đến `n8nWindowEnd` (02:00) giờ Việt Nam, để tiết kiệm khoảng 10–15 USD/tháng. n8n cần 60–90 giây để khởi động (import credentials + workflow) nên phải lên **trước** 00:00; lịch 00:00 chỉ chạy khi n8n đang chạy.

- **Đổi khung giờ:** sửa `n8nWindowStart` / `n8nWindowEnd` trong `main.bicepparam` (cú pháp cron 5 trường, giờ Việt Nam) rồi chạy lại mục 4. Khung giờ phải đủ rộng để chấm hết đơn của đêm đó; dừng giữa chừng sẽ ngắt đơn đang chấm (đơn kẹt ở *EVALUATING* và được xử lý ở lần sau, xem n8n-workflows.md). Container được chờ 600 giây trước khi bị dừng.
- **Luôn bật** (nếu từng bỏ lỡ lịch): `n8nAlwaysOn = true` rồi chạy lại mục 4. Tốn thêm khoảng 10–15 USD/tháng.
- **Mở editor ngoài khung giờ:** vào `$N8N_URL` (IP phải nằm trong `n8nAllowedCidr`); rule HTTP đánh thức n8n, chờ 1–2 phút ở lần đầu, rồi tự tắt sau vài phút không dùng. Không có `n8nAllowedCidr` thì không có ingress và không mở editor được ngoài khung giờ.
- **Kiểm tra lịch 00:00 có chạy:** sáng hôm sau xem đơn mới ở `/hr` (đã có điểm) hoặc `az containerapp logs show -g $RG -n $PREFIX-n8n --tail 200`, và *Executions* trong n8n. Chưa kiểm chứng trên Azure thật rằng rule cron kết hợp `minReplicas = 0` hoạt động như mong đợi: **sau lần triển khai đầu, hãy theo dõi vài đêm liền**.

## 7. Sự cố thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
|-------------|--------------------------|
| `docker pull` hoặc app báo `denied` / `unauthorized` / `manifest unknown` khi kéo image | Gói trên `ghcr.io` còn *private* hoặc sai tag: đổi sang **Public** (bước 3.1), kiểm tra `IMAGE_TAG` và `imageRegistry` (chữ thường) |
| Workflow *Build images* dừng ở bước Scan | Image có `.env` hoặc chuỗi giống khoá bí mật — **không** đẩy. Xem tên file trong log, loại ra khỏi image (`.dockerignore` / Dockerfile) rồi chạy lại |
| Sáng ra đơn chưa được chấm, n8n không có log đêm qua | n8n chưa lên kịp lúc 00:00 hoặc rule cron không hoạt động: dịch `n8nWindowStart` sớm hơn, hoặc `n8nAlwaysOn = true` (mục 6.8) |
| Bước 3.3 báo thiếu quyền / `must be able to SET ROLE` | Admin của Azure thiếu `CREATEROLE`: kiểm tra `az postgres flexible-server show`; script đã `GRANT n8n TO <admin> WITH SET TRUE, INHERIT TRUE`; gửi nguyên văn lỗi để xử lý |
| `psql: could not connect` / timeout | IP chưa nằm trong `adminIp` (IP đổi theo nhà mạng) → cập nhật và deploy lại |
| n8n không sẵn sàng, log nêu `self-signed certificate` / `unable to verify` | Đặt `verifyDatabaseCertificate = false` (chỉ khi bắt buộc), deploy lại |
| n8n *crash loop* với `database "n8n" does not exist` | Chưa chạy bước 3.3 → chạy rồi `az containerapp revision restart ...` |
| Trang chạy nhưng `/api/*` lỗi 502/504 sau thời gian không dùng | Backend vừa tỉnh dậy từ 0 replica (vài giây); lần thứ hai bình thường. Muốn không bao giờ chậm: `backendMinReplicas = 1` (tốn thêm ~5–8 USD/tháng) |
| `/api/*` luôn 404 qua frontend | `BACKEND_URL` lúc **build** frontend sai → build lại với đúng `http://<PREFIX>-backend` |
| Đăng nhập HR bị khoá vì nhiều lần sai | Bộ đếm nằm trong bộ nhớ backend: khởi động lại backend (`az containerapp revision restart`) hoặc đợi 15 phút |
| Email vào thư rác | Gmail cá nhân không có SPF/DKIM theo tên miền của bạn; xem rủi ro bên dưới |
| Refresh token Google hết hạn sau 7 ngày | Chưa xuất bản OAuth (bước 1.3) |

## 8. Chi phí và núm vặn

Ước tính **tham khảo** cho vùng Southeast Asia, **chưa gồm thuế**, tính theo USD. Số liệu lấy từ các bảng giá công bố bởi bên thứ ba ([Container Apps](https://azure.microsoft.com/en-us/pricing/details/container-apps/), [Bytebase: B1ms](https://www.bytebase.com/dbcost/azure-flexible/instance/B1ms/)) cùng một số con số ước theo trí nhớ (giá ACR, ổ đĩa theo GB, Log Analytics, hạn mức miễn phí). **Chưa đo trên hóa đơn thật.** Hãy kiểm lại bằng [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/) với đúng vùng và tiền tệ, rồi đặt **Budget** có cảnh báo (Cost Management → Budgets) ngay sau khi triển khai.

### 8.1 Hai cột thời gian

Tài khoản Azure Free (kể cả đã nâng lên Pay-as-you-go) được **750 giờ/tháng PostgreSQL Flexible Server B1ms + 32 GB ổ đĩa + 32 GB sao lưu miễn phí trong 12 tháng** kể từ ngày bắt đầu ưu đãi; mặc định Bicep (`Standard_B1ms`, 32 GB) khớp đúng. Xem ngày hết hạn và mức đã dùng ở **Cost Management + Billing → Free services**. Tài khoản đăng ký thẳng Pay-as-you-go không có ưu đãi này. Ưu đãi tính theo **giờ của một server B1ms**: đừng tạo thêm server PostgreSQL thứ hai. Credit 200 USD của Free Account chỉ có 30 ngày.

### 8.2 Thiết kế hiện tại và thiết kế ban đầu

Cột **B** là **thiết kế hiện tại** của Bicep (n8n theo khung giờ, image `ghcr.io`, trần log 0,1 GB/ngày). Cột A là thiết kế ban đầu, chỉ để so sánh (muốn quay lại: `n8nAlwaysOn = true`, `logDailyCapGb = '0.5'`, và dựng lại ACR, không còn trong Bicep).

| Khoản | A: ban đầu | B: hiện tại | Ghi chú |
|-------|------------|-------------|---------|
| PostgreSQL B1ms + 32 GB | 0 (trong ưu đãi) / 17–30 (sau đó) | như A | không có phương án rẻ hơn trong Azure |
| n8n 0,5 vCPU / 1 GiB | 10–15 (24/7) | 0–2 (khoảng 2 giờ mỗi đêm) | chi phí chính là **giữ container luôn bật** |
| frontend + backend (scale về 0) | 0–3 | 0–3 | dùng chung hạn mức miễn phí hằng tháng với n8n |
| Kho image | ~5 (ACR Basic) | 0 (`ghcr.io` public) | cold start chậm hơn vài chục giây |
| Log Analytics | 0–3 (xấu nhất khoảng 25) | 0 (trần 0,1 GB/ngày ≤ 3 GB/tháng < 5 GB miễn phí) | chạm trần thì ngừng ghi log đến hết ngày |
| **Tổng, trong 12 tháng ưu đãi PostgreSQL** | **~15–25** | **~0–5** | |
| **Tổng, sau ưu đãi** | **~35–55** | **~17–35** | |

Hạn mức miễn phí hằng tháng của Container Apps (180.000 vCPU-giây, 360.000 GiB-giây, 2 triệu request) dùng chung cho cả ba app. n8n theo khung giờ dùng khoảng 108.000 vCPU-giây và 216.000 GiB-giây mỗi tháng, nên chỉ còn lại khoảng 72.000 / 144.000 cho frontend và backend; nếu nhiều người dùng, phần vượt tính phí (khoảng vài USD).

### 8.3 Cái giá của thiết kế hiện tại

| Thay đổi | Đổi lại |
|----------|---------|
| **n8n chạy theo khung giờ** (`n8nAlwaysOn = false`) | n8n khởi động lại mỗi đêm (60–90 giây, import credentials + workflow); lịch **bị bỏ lỡ** nếu n8n chưa lên lúc 00:00; đơn đang chấm bị ngắt nếu khung giờ kết thúc giữa chừng; editor chậm 1–2 phút lần đầu. **Chưa kiểm chứng** rule cron với `minReplicas = 0` trên Azure thật |
| **Image `ghcr.io` public** | gói mặc định là private, phải đổi sang public một lần; cold start chậm hơn vì kéo image từ GitHub; phụ thuộc thêm vào GitHub; image public nên không được có bí mật (workflow build từ bản checkout sạch và quét trước khi đẩy) |
| **Trần log 0,1 GB/ngày** | log lỗi có thể mất đúng lúc nhiều log nếu chạm trần; 5 GB miễn phí dùng chung cho cả tài khoản thanh toán |

Phương án thay thế **không khuyên**: tắt hẳn Log Analytics (mất lịch sử log, mà backend ghi lỗi như email gửi thất bại ra log); Supabase thay Azure PostgreSQL (nhiều đánh đổi về kỹ thuật và bảo mật, gói Pro khoảng 25 USD).

### 8.4 Núm vặn (tham số Bicep hiện có)

`postgresSku` / `postgresStorageGb`, `frontendMinReplicas` / `backendMinReplicas` (0 = rẻ nhưng có cold start), `n8nAlwaysOn` / `n8nWindowStart` / `n8nWindowEnd` (6.8), `logRetentionDays` / `logDailyCapGb`, và dừng / ngủ đông (6.7).

## 9. Rủi ro đã biết

- **Cold start** khi frontend/backend về 0 replica: người dùng đầu tiên chờ, lâu hơn khi image phải kéo từ `ghcr.io` (vài chục giây, chưa đo).
- **n8n chỉ chạy theo khung giờ**: lịch 00:00 bị bỏ lỡ nếu n8n chưa lên hoặc rule cron không hoạt động như mong đợi (chưa kiểm chứng); theo dõi vài đêm đầu (6.8), có `n8nAlwaysOn = true` để quay lại.
- **Phụ thuộc GitHub**: image public trên `ghcr.io`; nếu `ghcr.io` gián đoạn thì không dựng được replica mới.
- **Trần log 0,1 GB/ngày**: chạm trần thì ngừng ghi log đến hết ngày, có thể mất log đúng lúc có lỗi.
- **Gmail** cá nhân: có thể vào thư rác của ứng viên; giới hạn ~500 email/ngày. Cách khắc phục khi có tên miền: dịch vụ gửi mail có SPF/DKIM (ví dụ Azure Communication Services Email) — chỉ cần đổi biến `SMTP_*`.
- **Bộ đếm đăng nhập sai** nằm trong bộ nhớ một instance nên backend để `max 1`; qua Next.js + envoy mọi người dùng có thể trông như cùng một IP nên giới hạn thực chất theo email.
- **PostgreSQL truy cập công khai** (TLS + tường lửa "Azure services"): mọi dịch vụ Azure có thể *thử* kết nối nhưng cần mật khẩu. Muốn chặt hơn: VNet integration + private endpoint (ngoài phạm vi MVP).
- **Secrets** nằm trong Container Apps secrets (mã hoá khi lưu) chứ chưa dùng Key Vault; chuyển sang Key Vault bằng managed identity + `secretRef` kiểu `keyVaultUrl` khi cần chính sách xoay vòng.
- **Chưa có tự động triển khai**: GitHub Actions chỉ build + đẩy image; cập nhật app bằng tay theo 6.1.
