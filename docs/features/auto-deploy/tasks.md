# Tasks: Tự động build và deploy khi merge

Feature branch: `feature/auto-deploy` (tách từ `main`, 2026-11-12)
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Phân tích & scenario

- [x] Chốt AD1 (dừng build cũ, deploy chờ), AD2 (chỉ cập nhật image + migrate), AD3 (test tự động rồi deploy; lint chỉ báo cáo vì còn lỗi cũ), AD4 (OIDC, chờ xác nhận) (2026-11-12)
- [x] Scenario AC-1 → AC-10 trong [requirements.md](./requirements.md)
- [x] Bạn review scenario và xác nhận AD3 (lint không chặn) và AD4 (OIDC) (2026-11-12)

## Làm

- [x] `scripts/deploy/n8n-window.mjs` + `n8n-window.test.mjs` (7 test: trong / ngoài khung giờ, qua nửa đêm, múi giờ Việt Nam, giá trị mặc định lấy từ `main.bicep`)
- [x] `scripts/deploy/current-tag.sh` (`--backend` cho `IMAGE_TAG`); runbook cảnh báo Bicep ghi đè tag
- [x] `scripts/deploy/setup-github-oidc.sh` (`--dry-run`, idempotent, Contributor chỉ trên `cvs-rg`)
- [x] `scripts/deploy/deploy.sh` + `deploy.test.mjs` (10 test với `az` và `curl` giả)
- [x] `.github/workflows/deploy.yml` (test → build → deploy; `images.yml` giữ lại cho lần dựng đầu)
- [x] `scripts/deploy/workflow-check.mjs` + `npm run workflow:check` (+ thêm `js-yaml` vào devDependencies)
- [x] Docs: runbook mục 6.1 và 6.9, CLAUDE.md, project-overview (D37)

## Kiểm chứng (2026-11-12)

- [x] `npm run workflow:check`: toàn bộ kiểm tra tĩnh (triggers, `paths-ignore`, concurrency, quyền, environment, OIDC không bí mật, thứ tự bước) + 17 test script đạt
- [x] Thử làm hỏng để chắc kiểm tra bắt lỗi (đều đỏ, đã khôi phục): `cancel-in-progress` ở deploy, `pull_request_target`, bỏ `paths-ignore`, bỏ bước quét, thêm `secrets.X`, chèn `${{ inputs.tag }}` vào `run`, bỏ `environment`, `concurrency` cấp workflow, cập nhật n8n trước khi đợi khung giờ
- [x] Test hiện có vẫn đạt sau khi thêm `js-yaml` (shared 20, backend 350, frontend 297, wf1 16); `npm ci` khớp lockfile
- [ ] Các điểm chỉ kiểm chứng được trên GitHub và Azure thật (xem bên dưới)
- [ ] Bạn chạy `setup-github-oidc.sh` một lần và đặt 3 biến vào repo
- [ ] Merge thật: workflow xanh, trang chạy bản mới; merge hai lần liên tiếp; kịch bản quay lui
- [ ] Bạn chạy `setup-github-oidc.sh`, đặt 3 biến vào repo, giới hạn environment `production` ở `main` (runbook 6.9)
- [ ] Merge thật: workflow xanh, trang chạy bản mới; merge hai lần liên tiếp (build cũ bị huỷ, deploy xếp hàng); kịch bản quay lui (chạy tay với tag cũ)
- [ ] Chưa kiểm chứng ngoài Azure / GitHub: quyền Contributor ở cấp resource group đủ cho `az containerapp update` và job; `az containerapp job execution show` trả `Succeeded` đúng như script chờ; tên revision `r<tag>-HHMMSS` được Azure chấp nhận; thời gian job `cvs-migrate` trên B1ms

## Điều chỉnh sau lần chạy đầu (2026-11-12)

- [x] Theo yêu cầu của bạn: workflow **chỉ chạy trên `main` sau khi merge**, bỏ trigger `pull_request` (nhánh `fix/main-only`); `workflow-check` đòi không có `pull_request`, test / build / deploy đều giới hạn ở `refs/heads/main`, nhóm concurrency là `ci-<ref>`

## Lần chạy thật đầu tiên (2026-11-12, run #2 của PR #11)

- [x] `test` xanh (1 phút 19 giây; lint báo lỗi nhưng không chặn, đúng thiết kế), `build` xanh (5 phút 22 giây, 3 image đã đẩy lên `ghcr.io`)
- [x] **Lỗi:** `deploy` đỏ ở bước *Sign in to Azure*: `AADSTS700213 No matching federated identity record … 'repo:tidedtulia@92788899/cv-ai-scanner@1445764401:environment:production'`. **Nguyên nhân:** GitHub gửi subject có ID bất biến của chủ và repo; credential do `setup-github-oidc.sh` bản đầu tạo chỉ có tên. **Đã sửa** (nhánh `fix/oidc-subject`): script đọc ID từ API công khai của GitHub, tạo credential `github-production-id`, nhắc xoá credential cũ; thêm `setup-github-oidc.test.mjs` (5 test)
- [ ] Bạn thêm credential đúng (lệnh trong chat hoặc chạy lại script), rồi **Re-run failed jobs** của run #2 và theo dõi bước *Deploy*
