# Tasks: Triển khai Azure

Feature branch: `feature/azure-deploy` (tách từ `main` sau khi Phase 4 đã merge)
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Phân tích & scenario

- [x] Chốt AQ1 (Bicep, chưa CI/CD), AQ2 (Container Apps ×3 + PG Flexible Server), AQ3 (azurecontainerapps.io), AQ4 (Gmail) (2026-11-07)
- [x] Scenario AC-1 → AC-11 trong [requirements.md](./requirements.md)
- [ ] Bạn review scenario

## Làm

- [ ] Backend: `GET /api/health`, `GET /api/health/ready` + test
- [ ] n8n: `credentials.cjs` đọc `APP_DB_HOST` / `APP_DB_PORT` / `APP_DB_SSL` + test; `entrypoint.sh` / URL n8n từ biến môi trường
- [ ] `init-db.sh` chạy được với admin không phải superuser, qua SSL
- [ ] Prisma: lệnh migrate + seed idempotent chạy được trong image (`SEED_SAMPLE_DATA`, `SEED_HR_*`)
- [ ] Dockerfile + `.dockerignore`: backend, frontend, n8n
- [ ] `infra/azure/main.bicep` (+ module) + `main.example.bicepparam`; `az bicep build` / `lint` sạch
- [ ] `scripts/deploy/docker-check.mjs` + `npm run docker:check`; `scripts/deploy/bicep-check.mjs`
- [ ] Thay / xoá `docker-compose.prod.yml`
- [ ] `runbook.md`; cập nhật `CLAUDE.md`, `project-overview.md` (Phase 5, Q12 → D36)

## Kiểm chứng

- [ ] AC-1 → AC-10 trên máy (`docker:check`, `bicep-check`, test)
- [ ] Bạn triển khai thật theo runbook và ghi lại kết quả (AC-7, AC-11)
