# Tasks: Nâng PostgreSQL 16 → 17

Feature branch: `feature/postgres-17-upgrade` (tách từ `feature/n8n-docker-setup`; merge sau PR của n8n)
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Phân tích & scenario

- [x] Chốt PQ1 (dump / restore), PQ2 (prod cố định 17) (2026-11-07)
- [x] Scenario AC-1 → AC-8 trong [requirements.md](./requirements.md)
- [x] Bạn review scenario (2026-11-07)

## Làm

- [x] `scripts/db/lib.sh`, `db-backup.sh` (`npm run db:backup`), `db-upgrade.sh` (`npm run db:upgrade`):
  - dump bằng container tạm chạy đúng version cũ trên volume;
  - sao chép volume cũ thành `<volume>-pg16`;
  - volume mới cho 17, khôi phục (chỉ bỏ qua lỗi "đã tồn tại" của role / database do image tạo), `vacuumdb --analyze-only`;
  - so sánh số dòng từng bảng; lỗi ở bước đổi volume / khôi phục / so sánh thì tự trả volume về như cũ.
- [x] `docker-compose.dev.yml` (`db`, `n8n-init`) và `docker-compose.prod.yml`: `postgres:17-alpine`
- [x] npm script `db:backup`, `db:upgrade`
- [x] Tài liệu: project-overview (D29, Q13 đã chốt, bảng môi trường), n8n-setup, n8n-docker-setup, CLAUDE.md

## Kiểm chứng (2026-11-07, máy local)

- [x] AC-7: `db:backup` khi `db` đang chạy → `tmp/db-backups/dump-*-pg16.sql` (610 KB, quyền 600, 0 mật khẩu plain). Khôi phục thử vào container Postgres 17 trống: không lỗi, `positions` = 3.
- [x] AC-6: n8n đang chạy → từ chối; thiếu `POSTGRES_DB` → nêu đúng tên biến; project không có volume → "no Postgres data volume found". Với backend dev server đang chạy, không còn kết nối mở nên lệnh được phép nâng (kiểm tra kết nối chỉ chặn khi còn kết nối thật).
- [x] AC-1: nâng 16 → **17.11**; số dòng 182 bảng của 2 database giống hệt trước (1 đơn, 3 vị trí, 1 HR, 3 credential n8n…); 3 role vẫn có; `GET /api/positions` 200; `prisma migrate status` "up to date"
- [x] AC-2: `n8n:up` + `n8n:check` pass; log n8n không còn "outside the supported range" sau khi khởi động; workflow mẫu dùng credential `mcp_readonly` chạy được (đã xoá)
- [x] AC-3: có file dump trong `tmp/db-backups/` và volume `cv-ai-scanner_postgres_data-pg16` (Postgres 16) được giữ lại
- [x] AC-4: dựng lại volume Postgres 16 từ bản sao, chạy với `DB_UPGRADE_TEST_FAIL=verify` → báo lệch số dòng, exit 1, volume về Postgres 16 như cũ, không còn `-pg16`, dump được giữ. Sau đó nâng thật lần nữa thành công.
- [x] AC-5: chạy lại khi đã là 17 → "already 17", exit 0
- [x] AC-8: không còn `postgres:16` / `latest` trong compose; project Docker tạm (volume trống): `db:up` → 17.11, `prisma migrate deploy` + `db seed` OK (3 vị trí, 1 HR); đã xoá project tạm

## Còn lại

- [ ] Xoá volume `cv-ai-scanner_postgres_data-pg16` khi bạn chắc chắn không cần quay lại 16 (`docker volume rm cv-ai-scanner_postgres_data-pg16`)
