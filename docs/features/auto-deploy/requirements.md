# Feature: Tự động build và deploy khi merge vào `main`

## Mục tiêu

Khi một PR được merge vào `main`: chạy test, build 3 image, đẩy lên `ghcr.io`, rồi **tự cập nhật Azure** (migrate database, cập nhật `cvs-frontend`, `cvs-backend`, `cvs-n8n`), kiểm tra sức khoẻ và quay lại bản cũ nếu hỏng. Nếu lại có merge mới trong lúc đang chạy thì **dừng phần build cũ** và chạy bản mới; phần **deploy đang chạy không bị ngắt** (bản mới xếp hàng chờ).

Bối cảnh: [azure-deploy](../azure-deploy/requirements.md) (hiện bạn build bằng workflow chạy tay `images.yml`, deploy bằng lệnh `az`), [runbook](../azure-deploy/runbook.md) mục 6.1.

---

## Phạm vi

- **Workflow `.github/workflows/deploy.yml`** thay `images.yml`: `test` → `build` → `deploy` (+ chạy khi PR để kiểm tra, không deploy).
- **Script hỗ trợ** (`scripts/deploy/`): `setup-github-oidc.sh` (bạn chạy một lần để GitHub được phép đăng nhập Azure), `n8n-window.mjs` (tính khung giờ n8n), `current-tag.sh` (xem tag đang chạy), `workflow-check.mjs` (`npm run workflow:check`).
- **Triển khai theo cách "chỉ cập nhật image"**: không chạy lại Bicep, nên **không** cần đưa bí mật ứng dụng (JWT, mật khẩu DB, khoá API…) vào GitHub. Hạ tầng (Bicep) vẫn do bạn chạy tay khi cần.
- **Không làm:** deploy hạ tầng tự động; môi trường staging; chấp thuận thủ công; thông báo qua Slack / email; xoá image cũ trên `ghcr.io`; deploy từ nhánh khác `main`.

### Quyết định đã chốt (2026-11-12)

| # | Câu hỏi | Đã chốt |
|---|---------|---------|
| AD1 | Merge mới khi workflow đang chạy | **Dừng build cũ, deploy thì chờ** (không ngắt migrate / cập nhật n8n giữa chừng; hàng chờ chỉ giữ bản mới nhất) |
| AD2 | Cách deploy | **Chỉ cập nhật image của 3 app + chạy migrate** (không chạy lại Bicep, không đưa bí mật ứng dụng vào GitHub) |
| AD3 | Cổng trước deploy | **Test tự động rồi deploy tự động**, không chờ bấm duyệt. Cổng chặn = test + type-check + build; **lint chạy nhưng chỉ báo cáo** vì còn ~43 lỗi `enforce-module-boundaries` có từ trước (sẽ chặn khi dọn xong) |
| AD4 | Đăng nhập Azure | **OIDC** (federated credential, không lưu bí mật) — đề xuất, chờ bạn xác nhận; cả hai cách đều miễn phí |

---

## Acceptance Criteria

### Kích hoạt và cổng kiểm tra

#### AC-1: Khi nào chạy

**Then:**
| Sự kiện | Chạy | Deploy |
|---------|------|--------|
| push vào `main` (tức PR được merge), có đổi file ngoài `docs/**` và `*.md` | `test` → `build` → `deploy` | **Có** |
| push vào `main` chỉ đổi `docs/**` / `*.md` | không chạy | không |
| mở / cập nhật PR vào `main` (cả PR từ fork) | chỉ `test` (không đẩy image, không có quyền Azure) | không |
| chạy tay (**Run workflow**) kèm ô `tag` (tuỳ chọn) | có `tag`: bỏ qua test và build, **deploy lại image `tag` đã có** (quay lui); không có `tag`: như push vào `main` | có, chỉ từ nhánh `main` |

- Không dùng `pull_request_target`; PR từ fork không bao giờ chạm bí mật hoặc Azure.

#### AC-2: Cổng kiểm tra (job `test`)

**Then:** chạy trên bản checkout sạch với Node 22 (`.nvmrc`):
- `npm ci`, sinh Prisma Client, **test** của `@org/shared`, `@org/backend`, `@org/frontend`, `npm run wf1:test`, **type-check** và **build** của backend và frontend.
- **Lint** (`nx run-many -t lint`) chạy và ghi kết quả vào trang tóm tắt, **không chặn** (còn lỗi cũ); chặn lại khi đã dọn hết.
- Bất kỳ bước chặn nào đỏ → dừng: **không build, không đẩy image, không deploy**.

### Build và đẩy image

#### AC-3: Build

**Then:**
- Dựng 3 image từ đúng 3 Dockerfile hiện có (frontend nhận `BACKEND_URL=http://<NAME_PREFIX>-backend`, `NAME_PREFIX` lấy từ biến repo, mặc định `cvs`) — như `images.yml`.
- **Quét** từng image (`scripts/deploy/scan-image.sh`): có `.env` hoặc chuỗi giống khoá bí mật → dừng, không đẩy.
- Tag = `YYYYMMDD.<số lần chạy>` (ví dụ `20261112.7`) và thêm tag `sha-<7 ký tự commit>` để truy ngược; đẩy bằng `GITHUB_TOKEN`, quyền `packages: write` chỉ ở job `build`.
- Đẩy **sau cùng** (sau khi cả ba image đã build và quét sạch) để không để lại hai trong ba image khi bị huỷ.

### Hàng chờ

#### AC-4: Dừng build cũ, deploy thì chờ

**Given:** workflow A đang chạy và có merge mới B
**Then:**
- `test` và `build` của A **bị huỷ**, B bắt đầu ngay (`concurrency` nhóm `ci-<ref>`, `cancel-in-progress: true`; riêng PR: nhóm theo số PR).
- `deploy` dùng nhóm **`deploy-production` với `cancel-in-progress: false`**: nếu `deploy` của A đang chạy, B **chờ** A xong rồi mới deploy (A không bị ngắt giữa migrate / cập nhật n8n). Nếu đã có một deploy khác đang chờ, GitHub tự huỷ cái chờ cũ và giữ **bản mới nhất** (bản cũ không bao giờ deploy sau bản mới).
- Hai lần deploy **không bao giờ chạy song song**.

### Deploy

#### AC-5: Đăng nhập Azure (OIDC)

**Then:**
- Job `deploy` chạy trong **environment `production`** (chỉ cho nhánh `main`), dùng `azure/login` với **OIDC**; `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` là **biến** của repo (không phải bí mật); quyền workflow: `id-token: write`, `contents: read`.
- Danh tính Azure chỉ có vai trò **Contributor trên resource group `cvs-rg`** (không phải toàn subscription).
- `setup-github-oidc.sh` (bạn chạy một lần, từ máy có `az` đã đăng nhập) tạo app registration + service principal + federated credential cho `repo:tidedtulia/cv-ai-scanner:environment:production` + vai trò, **in ra ba giá trị** cần đặt vào biến của repo; chạy lại không tạo trùng; không in bí mật (không có bí mật nào).

#### AC-6: Các bước deploy (thứ tự)

**Given:** `test` và `build` đã xanh, hoặc chạy tay với `tag` có sẵn
**Then:** theo thứ tự, mỗi bước thất bại thì các bước sau **không chạy**:
1. **Ghi lại tag đang chạy** của từng app (để quay lui).
2. **Migrate:** cập nhật image của job `cvs-migrate` sang tag mới, chạy job và **đợi** `Succeeded` (tối đa 10 phút); lỗi → dừng, **không cập nhật app nào**.
3. **Cập nhật** `cvs-backend`, rồi `cvs-frontend` (`az containerapp update --image …:<tag>`, đặt tên revision `r<tag>`); app scale-to-zero chỉ nhận cấu hình mới, **không bị đánh thức**.
4. **Cập nhật `cvs-n8n` chỉ ngoài khung giờ n8n** (23:50–02:00 giờ Việt Nam, đọc từ cùng giá trị `n8nWindowStart` / `n8nWindowEnd` như Bicep): nếu đang trong khung giờ, **đợi** tới hết khung giờ + 5 phút (tối đa 3 giờ) để không thay n8n giữa lúc chấm đơn; nếu quá thời hạn → bước này báo lỗi rõ và các app khác giữ nguyên bản mới.
5. **Kiểm tra** (AC-7).
6. Ghi **tóm tắt** vào trang kết quả: tag, thời gian từng bước, revision mới của từng app.

#### AC-7: Kiểm tra sau deploy và quay lui

**Then:**
- Gọi `GET <frontend>/` và `GET <frontend>/api/health/ready` (qua proxy của frontend): phải 200 và `database: up`, thử lại tối đa 5 phút (có thể đang khởi động nguội).
- Mỗi app (trừ n8n đang ngủ) có revision mới `Healthy`; `cvs-n8n`: `provisioningState = Succeeded` và image đúng tag.
- **Không đạt** → tự quay `cvs-frontend` và `cvs-backend` về tag ghi ở bước 1, in rõ lý do; workflow **đỏ**. **Migration không tự quay lui** (runbook: khôi phục database nếu migration sai) — workflow ghi rõ điều này khi migrate đã chạy.
- Quay lui chạy tay: Run workflow với `tag` cũ (AC-1).

#### AC-8: Tag đang chạy và Bicep

**Then:**
- `scripts/deploy/current-tag.sh` in tag image đang chạy của 3 app (đọc từ Azure, chỉ đọc), để khi chạy lại Bicep bằng tay đặt `IMAGE_TAG` đúng (nếu không, lần chạy Bicep sẽ **đưa các app về tag cũ**). Runbook ghi cảnh báo này và dùng lệnh đó ở các bước có chạy Bicep.

### An toàn

#### AC-9: Bảo mật workflow

**Then:**
- Quyền mặc định của workflow là `contents: read`; `packages: write` chỉ ở `build`, `id-token: write` chỉ ở `deploy`.
- Không có bí mật ứng dụng trong GitHub (JWT, mật khẩu DB, khoá Claude, Gmail…); không `echo` biến Azure; log không chứa bí mật.
- Action của bên thứ ba ghim theo phiên bản chính (`@v4`…) như `images.yml`; lệnh `az` không nhận giá trị từ tiêu đề PR / tên nhánh (không chèn lệnh).
- Chỉ `main` deploy được (environment `production` giới hạn nhánh).

### Công cụ

#### AC-10: `npm run workflow:check`

**Then:** đọc `.github/workflows/deploy.yml` (không cần Azure, không cần mạng) và kiểm: triggers, `paths-ignore`, `concurrency` của `ci` (cancel) và `deploy` (không cancel, nhóm cố định), `permissions` từng job, `environment: production`, `needs`, **không có** `pull_request_target`, không có bí mật nhúng (`secrets.` chỉ `GITHUB_TOKEN`), thứ tự các bước deploy, và logic khung giờ n8n (`n8n-window.mjs`: trong / ngoài khung giờ, qua nửa đêm, múi giờ Việt Nam); in ✓ / ✗, thoát ≠ 0 nếu sai.

---

## Kiểm thử

| AC | Test |
|----|------|
| AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-9, AC-10 | `scripts/deploy/workflow-check.mjs` (cấu trúc YAML; thử làm hỏng: bật `cancel-in-progress` ở deploy, thêm `pull_request_target`, bỏ `paths-ignore`, đổi thứ tự bước, thêm `secrets.X`) |
| AC-6 (khung giờ n8n) | `scripts/deploy/n8n-window.test.mjs` (`node --test`: 23:49 / 23:50 / 00:00 / 01:59 / 02:00 / 02:04, múi giờ Việt Nam, `n8nWindowStart` / `End` lấy từ `main.bicep`) |
| AC-3 | `scan-image.sh` (đã có) trên image dựng thật |
| AC-5 | `setup-github-oidc.sh --dry-run` in các lệnh sẽ chạy (kiểm bằng test) · **chạy thật: bạn làm, ghi vào tasks.md** |
| AC-7, AC-8 | `current-tag.sh` chạy thật (chỉ đọc) trên Azure của bạn · kịch bản quay lui: **bạn / mình cố tình làm hỏng một bản và xem workflow quay lui, ghi vào tasks.md** |
| Chạy thật | merge một thay đổi nhỏ → workflow xanh → trang chạy bản mới; merge hai lần liên tiếp → build cũ bị huỷ, deploy xếp hàng |

---

## Ghi chú kỹ thuật

- **Vì sao deploy không bị huỷ:** mình từng thấy database `n8n` dở dang vì lần khởi tạo bị ngắt. `cancel-in-progress` ở bước deploy có thể ngắt migrate hoặc cập nhật n8n giữa chừng, nên chỉ huỷ phần build và test (không có tác dụng phụ).
- **`concurrency` ở mức job:** GitHub giữ tối đa **một** chạy và **một** đang chờ mỗi nhóm; cái chờ cũ bị thay bằng cái mới hơn. Đúng cho yêu cầu "chỉ bản mới nhất".
- **PR từ fork** chỉ chạy `test` (không có `id-token`, không có `packages: write`).
- **Tag `sha-…`** giúp tìm commit của một image; Container Apps ghi tag ngày trong tên revision.
- **Chạy lại Bicep bằng tay** vẫn được; luôn đặt `IMAGE_TAG=$(sh scripts/deploy/current-tag.sh --backend)` (AC-8), vì Bicep là nguồn cấu hình: nếu không, app quay về tag trong tham số.
- **Chi phí:** GitHub Actions trên repo public miễn phí; việc deploy không tạo tài nguyên Azure mới (chỉ revision mới).
- **Rủi ro chưa kiểm chứng:** quyền Contributor ở cấp resource group đủ cho `az containerapp update` và `az containerapp job` (mình nghĩ đủ; sẽ biết khi chạy thật); thời gian job `cvs-migrate` thành công trên B1ms.
