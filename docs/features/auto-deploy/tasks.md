# Tasks: Tự động build và deploy khi merge

Feature branch: `feature/auto-deploy` (tách từ `main`, 2026-11-12)
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Phân tích & scenario

- [x] Chốt AD1 (dừng build cũ, deploy chờ), AD2 (chỉ cập nhật image + migrate), AD3 (test tự động rồi deploy; lint chỉ báo cáo vì còn lỗi cũ), AD4 (OIDC, chờ xác nhận) (2026-11-12)
- [x] Scenario AC-1 → AC-10 trong [requirements.md](./requirements.md)
- [ ] Bạn review scenario và xác nhận AD3 (lint không chặn) và AD4 (OIDC)

## Làm

- [ ] `scripts/deploy/n8n-window.mjs` + `n8n-window.test.mjs`
- [ ] `scripts/deploy/current-tag.sh`; cập nhật runbook (cảnh báo Bicep ghi đè tag)
- [ ] `scripts/deploy/setup-github-oidc.sh`
- [ ] `.github/workflows/deploy.yml` (test → build → deploy; thay `images.yml`)
- [ ] `scripts/deploy/workflow-check.mjs` + `npm run workflow:check`
- [ ] Docs: runbook (mục 6.1 dùng workflow, cách quay lui), CLAUDE.md, project-overview (D37)

## Kiểm chứng

- [ ] AC-1 → AC-10: `workflow:check`, test khung giờ n8n, thử làm hỏng
- [ ] Bạn chạy `setup-github-oidc.sh` một lần và đặt 3 biến vào repo
- [ ] Merge thật: workflow xanh, trang chạy bản mới; merge hai lần liên tiếp; kịch bản quay lui
