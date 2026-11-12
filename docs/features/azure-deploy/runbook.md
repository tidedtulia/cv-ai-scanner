# Runbook: triển khai CV AI Scanner lên Azure

Dành cho người chưa từng dùng Azure. Mỗi bước là lệnh chép chạy được trong **terminal bash/zsh**, tại **thư mục gốc của repo**. Yêu cầu: [requirements.md](./requirements.md) (AC-7, AC-11 → AC-13). Kiến trúc: frontend (công khai) → backend (nội bộ) → PostgreSQL; n8n (giới hạn IP, **chỉ chạy theo khung giờ**) → PostgreSQL. Image nằm trên **`ghcr.io` (public)**, build bằng GitHub Actions.

> **Trạng thái:** các file Docker và Bicep đã được kiểm tra trên máy (`npm run docker:check`, `npm run bicep:check`). **Chưa từng triển khai thật lên Azure** — lần đầu có thể gặp lỗi riêng của tài khoản/subscription; xem mục [Sự cố thường gặp](#7-sự-cố-thường-gặp) và ghi kết quả vào [tasks.md](./tasks.md).

> **Không muốn cài `az` / Docker trên máy?** Mục [10](#10-làm-bằng-azure-portal-và-cloud-shell) làm gần hết bằng trình duyệt: Portal + Azure Cloud Shell.

## 0. Trước khi bắt đầu

| Cần | Cách có |
|-----|---------|
| Tài khoản Azure có **subscription** còn hạn mức | https://portal.azure.com |
| Azure CLI (`az`), Docker Desktop đang chạy, `openssl` | `az --version`, `docker version` |
| Quyền **Contributor** trên resource group (không còn role assignment: image public, không có ACR) | Subscription → Access control (IAM) |
| Quyền chạy **GitHub Actions** và đổi gói sang Public trên repo `tidedtulia/cv-ai-scanner` | GitHub → Actions đã bật |
| Ứng dụng Google OAuth chuyển sang **Production** (cần URL của frontend nên làm **sau** khi triển khai) | bước 1.3 và 5.6 |
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
export RG=cvs-rg CVS_PREFIX=cvs LOCATION=southeastasia
```

`CVS_PREFIX` phải trùng `namePrefix` trong file tham số (mặc định `cvs`). Đừng đặt tên là `PREFIX`: nvm từ chối chạy khi biến môi trường `PREFIX` tồn tại; tên app là `cvs-frontend`, `cvs-backend`, `cvs-n8n`.

### 1.3 Google OAuth: chuẩn bị (xuất bản làm ở bước 5.6)

Khi ứng dụng OAuth còn ở chế độ **Testing**, refresh token **hết hạn sau 7 ngày** → CV upload và n8n tải CV sẽ ngừng chạy. Phải chuyển sang **In production**, nhưng Google **bắt buộc** có *Application home page* và *Application privacy policy link* thì nút **Publish app** mới bấm được (tooltip: "Valid app name, support email, homepage url, and privacy policy url are required for switching the app to external production mode"). Bạn chưa có hai URL đó trước khi triển khai, và frontend đã có sẵn cả hai: trang chủ `/` và chính sách `/privacy`. Vì vậy:

1. **Bây giờ:** Google Cloud Console → **Google Auth Platform → Branding**: điền App name, User support email, Developer contact email (**không** tải logo, vì logo buộc phải xác minh). Để trống phần App domain.
2. **Triển khai với refresh token hiện có** (còn hạn trong 7 ngày kể từ lúc cấp: chạy `nvm use && npm run drive:auth` (thư mục gốc repo, cần Node ≥ 22; cần `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` trong `.env`) ngay trước khi bắt đầu bước 1.4 để token mới). Phải xong bước 5 trong vòng 7 ngày.
3. **Sau khi có URL frontend:** xuất bản ở **bước 5.6**, rồi cập nhật token mới vào secrets.

### 1.4 Tạo bí mật

Các giá trị **mới**, không dùng lại mật khẩu của môi trường dev. Lưu tất cả vào trình quản lý mật khẩu — `N8N_ENCRYPTION_KEY` **không bao giờ được đổi** (đổi là n8n mất toàn bộ credentials), `POSTGRES_ADMIN_PASSWORD` cần cho mọi lần khởi tạo/cập nhật.

```bash
export POSTGRES_ADMIN_PASSWORD="Aa1-$(openssl rand -hex 16)"   # Azure đòi ≥ 3 trong 4 loại ký tự (hoa, thường, số, ký hiệu): hex thuần chỉ có 2 loại nên bị từ chối
export JWT_SECRET=$(openssl rand -hex 32)
export N8N_DB_PASSWORD=$(openssl rand -hex 24)
export N8N_APP_DB_PASSWORD=$(openssl rand -hex 24)
export MCP_DB_PASSWORD=$(openssl rand -hex 24)
export MCP_AUTH_TOKEN=$(openssl rand -hex 32)
export N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)
export N8N_OWNER_PASSWORD="Aa1$(openssl rand -hex 12)"      # n8n: 8-64 ký tự, có số và chữ hoa
export SEED_HR_PASSWORD="Hr1!$(openssl rand -hex 10)"       # mật khẩu HR đầu tiên (đổi sau khi đăng nhập)
# những giá trị bạn đã có (nhập, không hiện lên màn hình). Hàm này chạy được ở cả bash lẫn zsh
# (không dùng `read -p`: trong zsh `-p` có nghĩa khác):
ask() { printf '%s: ' "$1"; stty -echo; read -r _v; stty echo; echo; export "$1=$_v"; unset _v; }
ask ANTHROPIC_API_KEY
ask GOOGLE_CLIENT_ID
ask GOOGLE_CLIENT_SECRET
ask GOOGLE_REFRESH_TOKEN      # token mới nhất, sau khi chạy npm run drive:auth
ask SMTP_PASSWORD             # Gmail App Password
```

**Cách B: dùng lại các giá trị trong `.env` của dev** (chạy ở máy có file `.env`, không in giá trị ra màn hình; không dùng được trong Cloud Shell vì `.env` không ở đó):

```bash
nvm use
eval "$(node scripts/deploy/env-to-exports.mjs)"
```

Lệnh này nạp đủ 14 biến của khối trên từ `.env` (`POSTGRES_PASSWORD` thành `POSTGRES_ADMIN_PASSWORD`) và chỉ in **tên** biến đã nạp, tên biến thiếu và cảnh báo. Hai lưu ý:
- **`POSTGRES_ADMIN_PASSWORD` phải đủ phức tạp.** Azure từ chối mật khẩu admin có dưới 3 loại ký tự; lệnh bỏ qua biến này nếu `.env` không đạt, khi đó tạo mới bằng dòng `export POSTGRES_ADMIN_PASSWORD=...` ở trên. (Mật khẩu 3 role còn lại do `init-db.sh` đặt nên không bị Azure kiểm tra độ phức tạp.)
- Dùng lại giá trị dev nghĩa là **ai có file `.env` dev cũng có `JWT_SECRET` của bản chạy thật** (giả mạo được phiên HR) và các mật khẩu DB. Mật khẩu HR đầu tiên (`SEED_HR_PASSWORD`) cũng là mật khẩu dev: đổi ngay sau khi đăng nhập lần đầu (mục 5).

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

### 1.6 Kiểm tra các biến bí mật đã được đặt (trước mỗi lần `az deployment`)

`az deployment group validate` **không** phát hiện biến rỗng: Azure chỉ báo lỗi giữa chừng khi tạo tài nguyên (ví dụ `Parameter 'AdministratorLoginPassword' must be specified`). Kiểm tra trước, trong **đúng cửa sổ terminal** sẽ chạy `az` (biến không dùng chung giữa các cửa sổ):

```bash
for v in POSTGRES_ADMIN_PASSWORD JWT_SECRET N8N_DB_PASSWORD N8N_APP_DB_PASSWORD MCP_DB_PASSWORD MCP_AUTH_TOKEN N8N_ENCRYPTION_KEY N8N_OWNER_PASSWORD ANTHROPIC_API_KEY GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_REFRESH_TOKEN SMTP_PASSWORD SEED_HR_PASSWORD; do
  [ -n "$(printenv $v)" ] && echo "ok       $v" || echo "THIẾU    $v"
done
```

Pha 1 chỉ cần `POSTGRES_ADMIN_PASSWORD`; pha 2 cần cả 14 biến (Container Apps không nhận secret rỗng).

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

1. Nếu `namePrefix` **không** phải `cvs`: GitHub → repo → Settings → Secrets and variables → Actions → **Variables** → thêm `NAME_PREFIX` = giá trị đó (frontend bị nướng địa chỉ `http://<CVS_PREFIX>-backend` lúc build).
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
az containerapp show -g $RG -n $CVS_PREFIX-backend --query "properties.configuration.ingress.external" -o tsv   # false
```

Rồi làm bằng tay:
1. Mở `$FRONTEND_URL/hr/login`, đăng nhập bằng `SEED_HR_EMAIL` / `SEED_HR_PASSWORD`; tạo một job thử (DRAFT → có tiêu chí → OPEN) và đổi mật khẩu HR.
2. Mở `$FRONTEND_URL/submit-cv`, nộp một CV PDF thử (kiểm tra Google Drive và đơn xuất hiện ở `/hr`).
3. n8n: mở `$N8N_URL` (chỉ IP trong `n8nAllowedCidr` vào được), đăng nhập `n8nOwnerEmail` / `N8N_OWNER_PASSWORD`; kiểm tra workflow **CV Scanner WF-1** và **MCP server** đang *Active*; bấm chạy tay WF-1 để chấm đơn thử, rồi xem kết quả ở `/hr`.
4. Email: trên máy bạn, `SMTP_*` / `MAIL_FROM` đặt trong `.env`, chạy `npm run mail:check <email của bạn>`; rồi chốt Nhận/Từ chối một đơn thử **của chính bạn** (email thật gửi tới địa chỉ ứng viên đã nhập — dùng email của bạn khi nộp).
5. Log nếu có lỗi: mục [6.2](#62-xem-log).
6. **Xuất bản ứng dụng Google OAuth (bắt buộc, làm trong vòng 7 ngày kể từ lúc cấp refresh token):**
   1. Google Cloud Console → **Google Auth Platform → Branding → App domain**: *Application home page* = `$FRONTEND_URL/`, *Application privacy policy link* = `$FRONTEND_URL/privacy`. Mục **Authorized domains → Add domain**: tên miền của `$FRONTEND_URL` (ví dụ `cvs-frontend.<mã>.southeastasia.azurecontainerapps.io`). Bấm **Save**. Nếu Google từ chối tên miền này (tên miền dùng chung của Azure), dùng tên miền riêng của bạn (mục 9) hoặc một trang tĩnh trên tên miền bạn kiểm soát có nội dung chính sách riêng tư.
   2. **Audience → Publish app → Confirm** (trạng thái thành *In production*). Scope `drive.file` không cần Google xét duyệt.
   3. Lấy refresh token mới: `nvm use && npm run drive:auth` (chạy ở thư mục gốc repo; cần Node ≥ 22) (hướng dẫn: `docs/features/submit-application-api/google-drive-setup.md`; nếu Google báo "chưa xác minh ứng dụng" thì **Advanced → Go to … (unsafe)**, đây là ứng dụng của bạn).
   4. Cập nhật vào Azure: đặt lại `GOOGLE_REFRESH_TOKEN` rồi chạy lại mục 4, hoặc Portal → `cvs-backend` và `cvs-n8n` → **Secrets** → `google-refresh-token` → sửa → **Save**; sau đó tạo revision mới cho `cvs-backend` (**Revisions → Create new revision**, hoặc Restart); n8n lấy giá trị mới ở lần khởi động kế tiếp (khung giờ tối nay).
   5. Kiểm tra: nộp một CV thử ở `$FRONTEND_URL/submit-cv`, đơn phải xuất hiện ở `/hr` và CV tải về được.

## 6. Vận hành

### 6.1 Cập nhật phiên bản mới (tự động khi merge)

Từ khi có [auto-deploy](../auto-deploy/requirements.md): **merge PR vào `main` là xong**. Workflow **Deploy** (`.github/workflows/deploy.yml`) chạy test, build 3 image, quét, đẩy lên `ghcr.io`, rồi cập nhật Azure theo thứ tự: migrate (job `cvs-migrate`) → backend → frontend → kiểm tra `/api/health/ready` (không đạt thì tự đưa backend và frontend về tag cũ) → n8n (chỉ ngoài khung giờ 23:50–02:00). Merge chỉ đổi `docs/` hoặc `*.md` thì không chạy. Xem kết quả: GitHub → **Actions → Deploy** (trang tóm tắt có bảng tag trước / sau).

- **Có merge mới khi đang chạy:** build và test của lần cũ bị huỷ; **deploy đang chạy không bị ngắt** (bản mới xếp hàng chờ, chỉ giữ bản mới nhất).
- **Quay lui:** Actions → Deploy → **Run workflow** → nhập `tag` cũ (xem tag đang chạy bằng `sh scripts/deploy/current-tag.sh`). Migration không tự quay lui.
- **Thiết lập một lần** (xem 6.9).

**Chạy Bicep bằng tay** (đổi hạ tầng, đổi secret…): Bicep là nguồn cấu hình, nếu `IMAGE_TAG` trong lệnh khác tag đang chạy thì **app bị đưa về tag cũ**. Luôn đặt:
```bash
export DEPLOY_APPS=true IMAGE_TAG=$(sh scripts/deploy/current-tag.sh --backend)
az deployment group create -g $RG -f infra/azure/main.bicep -p infra/azure/main.bicepparam
```

**Cách làm tay** (khi chưa thiết lập auto-deploy, hoặc dựng lại từ đầu): chạy workflow **Build images** (chỉ build, không deploy), rồi:
```bash
export TAG=<tag vừa build>
docker run --rm -e DATABASE_URL -e SEED_SAMPLE_DATA=false $IMAGE_REGISTRY/cv-backend:$TAG sh packages/backend/scripts/migrate-and-seed.sh   # migration trước (bước 3.2, cần adminIp)
export DEPLOY_APPS=true IMAGE_TAG=$TAG
az deployment group create -g $RG -f infra/azure/main.bicep -p infra/azure/main.bicepparam
```
Không có `adminIp` (hoặc không có Docker cục bộ)? Chạy job sau `az deployment`: `az containerapp job start -g $RG -n $CVS_PREFIX-migrate`, rồi `az containerapp job execution list -g $RG -n $CVS_PREFIX-migrate -o table` (phải là *Succeeded*). Giữa hai việc, bản app mới chạy với schema cũ trong thời gian ngắn — chỉ chấp nhận được khi migration chỉ **thêm**.

### 6.2 Xem log

```bash
az containerapp logs show -g $RG -n $CVS_PREFIX-backend --follow --tail 100
az containerapp logs show -g $RG -n $CVS_PREFIX-n8n --follow --tail 100
az containerapp job execution list -g $RG -n $CVS_PREFIX-migrate -o table
```

### 6.3 Quay lui

App: deploy lại với tag cũ (`export IMAGE_TAG=<tag cũ>` rồi chạy `az deployment group create` như mục 4), hoặc kích hoạt revision cũ: `az containerapp revision list -g $RG -n $CVS_PREFIX-backend -o table` rồi `az containerapp revision activate ...`. **Migration không tự quay lui**: nếu migration sai, khôi phục DB (6.6) rồi triển khai tag cũ.

### 6.4 Đổi bí mật

Đặt lại biến môi trường rồi chạy lại `az deployment group create` (mục 4). Riêng: `N8N_ENCRYPTION_KEY` **không đổi được**; mật khẩu DB của role `n8n` / `n8n_app` / `mcp_readonly` phải chạy lại bước 3.3 với mật khẩu mới **trước** khi deploy; `POSTGRES_ADMIN_PASSWORD` đổi bằng `az postgres flexible-server update -g $RG -n <tên server> --admin-password ...` rồi deploy lại.

### 6.5 IP của bạn đã đổi (PostgreSQL và editor n8n)

Nhà mạng cấp IP khác theo thời gian. Khi đó `psql` / `docker run … psql` báo `Connection refused` (hoặc timeout) và editor n8n không mở được. Cập nhật cả hai nơi (không cần deploy lại Bicep):

```bash
export MY_IP=$(curl -s https://api.ipify.org); echo $MY_IP
PGSERVER=$(az deployment group show -g $RG -n main --query properties.outputs.postgresName.value -o tsv)
az postgres flexible-server firewall-rule update -g $RG -n $PGSERVER --rule-name AdminIp --start-ip-address $MY_IP --end-ip-address $MY_IP
az containerapp ingress access-restriction set -g $RG -n $CVS_PREFIX-n8n --rule-name allow-0 --ip-address $MY_IP/32 --action Allow
```

Rồi sửa luôn `adminIp` và `n8nAllowedCidr` trong `infra/azure/main.bicepparam`: nếu không, lần chạy Bicep kế tiếp sẽ đặt lại IP cũ. Xoá `adminIp` (để rỗng) khi không cần chạy lệnh DB từ máy bạn nữa.

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

n8n đã tự về 0 ngoài khung giờ (6.8) nên không cần làm gì thêm cho n8n; nếu bạn đặt `n8nAlwaysOn = true` thì chạy thêm `az containerapp update -g $RG -n $CVS_PREFIX-n8n --min-replicas 0` khi ngủ đông và `--min-replicas 1` khi bật lại (lần deploy Bicep kế tiếp sẽ đặt lại giá trị theo tham số).

### 6.8 n8n theo khung giờ

Mặc định n8n **không chạy cả ngày**: chỉ có replica từ `n8nWindowStart` (23:50) đến `n8nWindowEnd` (02:00) giờ Việt Nam, để tiết kiệm khoảng 10–15 USD/tháng. n8n cần 60–90 giây để khởi động (import credentials + workflow) nên phải lên **trước** 00:00; lịch 00:00 chỉ chạy khi n8n đang chạy.

- **Đổi khung giờ:** sửa `n8nWindowStart` / `n8nWindowEnd` trong `main.bicepparam` (cú pháp cron 5 trường, giờ Việt Nam) rồi chạy lại mục 4. Khung giờ phải đủ rộng để chấm hết đơn của đêm đó; dừng giữa chừng sẽ ngắt đơn đang chấm (đơn kẹt ở *EVALUATING* và được xử lý ở lần sau, xem n8n-workflows.md). Container được chờ 600 giây trước khi bị dừng.
- **Luôn bật** (nếu từng bỏ lỡ lịch): `n8nAlwaysOn = true` rồi chạy lại mục 4. Tốn thêm khoảng 10–15 USD/tháng.
- **Mở editor ngoài khung giờ:** vào `$N8N_URL` (IP phải nằm trong `n8nAllowedCidr`); rule HTTP đánh thức n8n, chờ 1–2 phút ở lần đầu, rồi tự tắt sau vài phút không dùng. Không có `n8nAllowedCidr` thì không có ingress và không mở editor được ngoài khung giờ.
- **Kiểm tra lịch 00:00 có chạy:** sáng hôm sau xem đơn mới ở `/hr` (đã có điểm) hoặc `az containerapp logs show -g $RG -n $CVS_PREFIX-n8n --tail 200`, và *Executions* trong n8n. Chưa kiểm chứng trên Azure thật rằng rule cron kết hợp `minReplicas = 0` hoạt động như mong đợi: **sau lần triển khai đầu, hãy theo dõi vài đêm liền**.

### 6.9 Thiết lập tự động deploy (một lần)

1. **Cho GitHub đăng nhập Azure bằng OIDC** (không lưu bí mật). Trên máy đã `az login` bằng tài khoản được tạo app registration và gán quyền:
   ```bash
   sh scripts/deploy/setup-github-oidc.sh --dry-run     # xem các lệnh sẽ chạy
   sh scripts/deploy/setup-github-oidc.sh               # chạy thật; chạy lại không tạo trùng
   ```
   Script tạo app registration `cv-ai-scanner-github-deploy`, credential cho `repo:tidedtulia/cv-ai-scanner:environment:production`, vai trò **Contributor chỉ trên `cvs-rg`**, rồi in ra 3 giá trị.
2. GitHub → repo → **Settings → Secrets and variables → Actions → Variables** → thêm `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (**biến**, không phải secret). Nếu `namePrefix` không phải `cvs`: thêm `NAME_PREFIX`; nếu resource group khác `cvs-rg`: thêm `AZURE_RESOURCE_GROUP`.
3. GitHub → **Settings → Environments → production → Deployment branches → Selected branches → `main`**.
4. Thử: merge một thay đổi nhỏ (không chỉ docs); xem Actions → Deploy xanh; mở trang web kiểm tra.

Chưa kiểm chứng ngoài Azure thật: quyền Contributor ở cấp resource group đủ cho `az containerapp update` và job (mình nghĩ đủ); nếu lỗi `AuthorizationFailed`, gửi nguyên văn lỗi.

## 7. Sự cố thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
|-------------|--------------------------|
| `docker pull` hoặc app báo `denied` / `unauthorized` / `manifest unknown` khi kéo image | Gói trên `ghcr.io` còn *private* hoặc sai tag: đổi sang **Public** (bước 3.1), kiểm tra `IMAGE_TAG` và `imageRegistry` (chữ thường) |
| Workflow *Build images* dừng ở bước Scan | Image có `.env` hoặc chuỗi giống khoá bí mật — **không** đẩy. Xem tên file trong log, loại ra khỏi image (`.dockerignore` / Dockerfile) rồi chạy lại |
| Sáng ra đơn chưa được chấm, n8n không có log đêm qua | n8n chưa lên kịp lúc 00:00 hoặc rule cron không hoạt động: dịch `n8nWindowStart` sớm hơn, hoặc `n8nAlwaysOn = true` (mục 6.8) |
| `az deployment` báo `Parameter 'AdministratorLoginPassword' must be specified` (hoặc secret rỗng) | Biến bí mật rỗng trong cửa sổ terminal này (mở cửa sổ mới, hoặc quên `export`): nạp lại (mục 1.4) và kiểm tra bằng mục 1.6, rồi chạy lại lệnh; chạy lại được vì Bicep idempotent |
| Bước 3.3 báo thiếu quyền / `must be able to SET ROLE` | Admin của Azure thiếu `CREATEROLE`: kiểm tra `az postgres flexible-server show`; script đã `GRANT n8n TO <admin> WITH SET TRUE, INHERIT TRUE`; gửi nguyên văn lỗi để xử lý |
| `psql: could not connect` / timeout | IP chưa nằm trong `adminIp` (IP đổi theo nhà mạng) → cập nhật và deploy lại |
| n8n không sẵn sàng, log nêu `self-signed certificate` / `unable to verify` | Đặt `verifyDatabaseCertificate = false` (chỉ khi bắt buộc), deploy lại |
| n8n `Unhealthy / Failed`, log có `permission denied for schema public` (khi tạo bảng migrations) | Trên Azure schema `public` của database `n8n` không thuộc chủ database nên role `n8n` thiếu quyền `CREATE`. `init-db.sh` bản mới đã cấp quyền: chạy lại bước 3.3 rồi tạo revision mới cho n8n (`az containerapp update -g $RG -n $CVS_PREFIX-n8n --revision-suffix "r$(date +%m%d%H%M)"`) |
| n8n `Failed` lặp lại, log `You do not have permission to deactivate this workflow` ở bước *importing workflows* (database `n8n` ở trạng thái dở dang vì lần khởi tạo đầu bị ngắt, ví dụ tạo revision mới trong lúc n8n đang chạy migration lần đầu; migration lần đầu trên PostgreSQL B1ms mất 1–2 phút) | Đặt lại database `n8n` (chỉ chứa dữ liệu nội bộ của n8n; workflow và credentials được nạp lại từ repo và biến môi trường, dữ liệu CV nằm ở database khác): đợi n8n về 0 replica (sau 02:05 giờ Việt Nam, hoặc `az containerapp revision list` cho thấy 0 replica), `psql -d postgres -c "DROP DATABASE IF EXISTS n8n"` bằng tài khoản admin (qua `docker run postgres:17-alpine`, như bước 3.3), chạy lại bước 3.3 để tạo lại, rồi đánh thức **một** replica (mở `$N8N_URL`) và đợi 2–3 phút. Đừng tạo revision mới trong lúc n8n khởi tạo lần đầu |
| n8n *crash loop* với `database "n8n" does not exist` | Chưa chạy bước 3.3 → chạy rồi `az containerapp revision restart ...` |
| Trang chạy nhưng `/api/*` lỗi 502/504 sau thời gian không dùng | Backend vừa tỉnh dậy từ 0 replica (vài giây); lần thứ hai bình thường. Muốn không bao giờ chậm: `backendMinReplicas = 1` (tốn thêm ~5–8 USD/tháng) |
| `/api/*` luôn 404 qua frontend | `BACKEND_URL` lúc **build** frontend sai → build lại với đúng `http://<CVS_PREFIX>-backend` |
| Đăng nhập HR bị khoá vì nhiều lần sai | Bộ đếm nằm trong bộ nhớ backend: khởi động lại backend (`az containerapp revision restart`) hoặc đợi 15 phút |
| Email vào thư rác | Gmail cá nhân không có SPF/DKIM theo tên miền của bạn; xem rủi ro bên dưới |
| Refresh token Google hết hạn sau 7 ngày | Chưa xuất bản OAuth (bước 5.6) |
| Nút **Publish app** của Google bị mờ | Thiếu *Application home page* hoặc *privacy policy link* trong Branding (bước 5.6); chỉ điền được khi đã có URL frontend |

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

## 10. Làm bằng Azure Portal và Cloud Shell

Dùng khi bạn không muốn cài Azure CLI, Docker hay Bicep trên máy. **Cloud Shell** là terminal chạy trong trình duyệt (nút `>_` ở thanh trên của https://portal.azure.com), đã đăng nhập sẵn, có `az` (kèm Bicep), `git`, `openssl`, `psql`. **Không có Docker.** Mọi thứ khác trong runbook (Google OAuth, GitHub Actions build image, đổi gói sang Public, Gmail App Password) không đổi.

> **Chưa kiểm chứng trên Cloud Shell thật.** Các điểm cần xác nhận khi làm: phiên bản `psql` (cần ≥ 15), tường lửa PostgreSQL có cho Cloud Shell kết nối không, và giao diện Portal (thay đổi thường xuyên). Gặp khác thì ghi lại vào [tasks.md](./tasks.md).

### 10.1 Mỗi bước của runbook làm ở đâu

| Bước runbook | Làm trên Portal / Cloud Shell |
|--------------|-------------------------------|
| 1.1 Đăng ký provider | Portal → **Subscriptions** → subscription của bạn → **Resource providers** → tìm và **Register**: `Microsoft.App`, `Microsoft.DBforPostgreSQL`, `Microsoft.OperationalInsights` |
| 1.2 Tạo resource group | Portal → **Resource groups → Create** (tên `cvs-rg`, vùng *Southeast Asia*) |
| 1.3, 1.4 Google OAuth, bí mật | OAuth làm trên Google Cloud Console. Bí mật: Cloud Shell (`openssl rand`, như 1.4) |
| 1.5 File tham số | Cloud Shell (10.2) |
| 2 Dựng hạ tầng | Cloud Shell `az deployment group create` (10.2), hoặc Portal **Deploy a custom template** (10.3) |
| 3.1 Build image | GitHub Actions (không đổi) |
| 3.2 Migrate + seed | Sau pha 2: Portal → **Container Apps Jobs → `cvs-migrate` → Run now** (10.4) |
| 3.3 `init-db.sh` | Cloud Shell, `psql` (10.4) |
| 4 Pha 2 | như bước 2 với `DEPLOY_APPS=true` |
| 5 Kiểm tra | Portal (10.5) |
| 6 Vận hành | Portal (10.6) |

### 10.2 Dựng hạ tầng bằng Cloud Shell

Mở Cloud Shell, chọn **Bash**, rồi:

```bash
git clone https://github.com/tidedtulia/cv-ai-scanner && cd cv-ai-scanner
export RG=cvs-rg CVS_PREFIX=cvs LOCATION=southeastasia
# đặt các bí mật như mục 1.4 (openssl rand / read -rs), lưu vào trình quản lý mật khẩu ngay
cp infra/azure/main.example.bicepparam infra/azure/main.bicepparam
nano infra/azure/main.bicepparam            # sửa các giá trị thường (mục 1.5); adminIp: xem dưới
az deployment group create -g $RG -f infra/azure/main.bicep -p infra/azure/main.bicepparam
```

Biến môi trường mất khi Cloud Shell hết phiên (khoảng 20 phút không dùng): mở lại thì đặt lại biến (bí mật lấy từ trình quản lý mật khẩu). Repo nằm trong ổ đĩa của Cloud Shell nên còn lại.

### 10.3 Hoặc dựng bằng form của Portal ("Deploy a custom template")

Portal không biên dịch Bicep, nên cần file ARM JSON:
- Cloud Shell: `az bicep build --file infra/azure/main.bicep --outfile main.json`, rồi nút **Manage files → Download** để tải `main.json`. (Trên máy có Node: `npm run bicep:build` tạo `tmp/azure/main.json`.)
- Portal → ô tìm kiếm **Deploy a custom template → Build your own template in the editor → Load file** → chọn `main.json` → **Save**.
- Chọn resource group `cvs-rg`, điền tham số. Các tham số bí mật (`postgresAdminPassword`, `jwtSecret`, …) là ô nhập mật khẩu; `deployApps` và `imageTag` nhập tay (pha 1: `false`; pha 2: `true` + tag). `n8nAllowedCidr` nhập dạng mảng JSON, ví dụ `["203.0.113.7/32"]`.
- **Review + create** → **Create**.

File `main.json` không chứa bí mật (bí mật chỉ nhập lúc triển khai); nó nằm trong `tmp/` (không commit).

### 10.4 Khởi tạo database mà không cần Docker

Thứ tự khác runbook gốc, vì không có Docker để chạy migrate trước: **pha 1 → build image → pha 2 → migrate → init-db**.

1. Pha 1 (`deployApps=false`), build image bằng GitHub Actions, rồi **pha 2** (`DEPLOY_APPS=true IMAGE_TAG=<tag>`).
   **Đừng triển khai pha 2 trong khung giờ 23:50–02:00** (giờ Việt Nam): n8n sẽ bật lên khi database `n8n` chưa có và lặp lại lỗi cho tới khi xong bước dưới (ngoài khung giờ n8n ở 0 replica nên không sao).
2. **Migrate + seed:** Portal → **Container Apps Jobs → `cvs-migrate` → Run now**; xem **Execution history** phải là *Succeeded* (log: tab Logs / `az containerapp job execution list -g $RG -n $CVS_PREFIX-migrate -o table`). Job đã đặt sẵn `SEED_SAMPLE_DATA=false`, `SEED_HR_EMAIL`, `SEED_HR_PASSWORD`.
3. **`init-db.sh`** từ Cloud Shell (cần `psql` ≥ 15: kiểm tra `psql --version`):

```bash
out() { az deployment group show -g $RG -n main --query "properties.outputs.$1.value" -o tsv; }
export PGHOST=$(out postgresHost) DBNAME=$(out appDatabaseName) PGSERVER=$(out postgresName)
# cho Cloud Shell kết nối vào PostgreSQL (IP của Cloud Shell thay đổi theo phiên)
export MY_IP=$(curl -s https://api.ipify.org)
az postgres flexible-server firewall-rule create -g $RG -n $PGSERVER --rule-name CloudShell --start-ip-address $MY_IP --end-ip-address $MY_IP
PGSSLMODE=require POSTGRES_USER=cvsadmin POSTGRES_PASSWORD=$POSTGRES_ADMIN_PASSWORD POSTGRES_DB=$DBNAME \
  N8N_DB_PASSWORD=$N8N_DB_PASSWORD N8N_APP_DB_PASSWORD=$N8N_APP_DB_PASSWORD MCP_DB_PASSWORD=$MCP_DB_PASSWORD \
  sh n8n/setup/init-db.sh
az postgres flexible-server firewall-rule delete -g $RG -n $PGSERVER --rule-name CloudShell --yes     # đóng lại
```

Thành công: `n8n-init: database n8n + roles n8n / n8n_app / mcp_readonly are up to date`. Nếu `psql` cũ hơn 15 (lỗi ở `\getenv`), chạy bước này từ máy có Docker (mục 3.3).

### 10.5 Kiểm tra trên Portal

- **Resource group `cvs-rg`** phải có: Container Apps Environment, `cvs-frontend`, `cvs-backend`, `cvs-n8n`, job `cvs-migrate`, PostgreSQL flexible server, Log Analytics workspace (**không** có Container Registry).
- **`cvs-frontend` → Overview → Application Url**: mở trang, thêm `/api/health/ready` để xem `{"status":"ok","database":"up"}`; đăng nhập `/hr/login`.
- **`cvs-backend` → Ingress**: *Ingress traffic* phải là **Limited to Container Apps Environment** (không công khai).
- **`cvs-n8n` → Scale**: có rule `night-window` (cron) và `editor` (HTTP); **Revisions and replicas**: ngoài khung giờ không có replica là đúng.
- **Log**: Container App → **Log stream** (đang chạy) hoặc **Logs** (Log Analytics, truy vấn `ContainerAppConsoleLogs_CL`).
- **PostgreSQL → Overview**: *Compute* `Standard_B1ms`; **Cost Management → Free services** để xem giờ miễn phí đang dùng.

### 10.6 Vận hành trên Portal

| Việc | Ở đâu |
|------|-------|
| Đổi secret (ví dụ `smtp-password`) | Container App → **Secrets** → sửa → **Save**; rồi app → **Revisions** → tạo revision mới / Restart để áp dụng |
| Đổi biến môi trường | Container App → **Containerization → Containers → Edit** → **Environment variables** |
| Đổi khung giờ n8n | `cvs-n8n` → **Scale** → rule `night-window` → sửa `start` / `end` (hoặc chạy lại Bicep để giữ cấu hình nhất quán; sửa tay trên Portal sẽ bị Bicep ghi đè ở lần deploy sau) |
| Cập nhật phiên bản | chạy workflow *Build images* với tag mới → Container App → **Containerization → Edit** → đổi *Image tag* → **Save**; migrate: **Jobs → `cvs-migrate` → Run now** (job cũng cần đổi tag) |
| Quay lui | Container App → **Revisions** → chọn revision cũ → **Activate** |
| Mở IP vào n8n | `cvs-n8n` → **Networking → Ingress → IP restrictions** (hoặc `n8nAllowedCidr` trong Bicep) |
| Dừng / bật PostgreSQL | PostgreSQL → **Overview → Stop / Start** |
| Xoá tất cả | Resource group → **Delete resource group** |

Sửa tay trên Portal lệch khỏi Bicep: lần chạy Bicep sau sẽ **ghi đè** các giá trị đó. Với thay đổi lâu dài hãy sửa trong `main.bicepparam` rồi deploy lại (10.2).
