# Tasks: Workflow MCP server (`get_position_requirements`)

Feature branch: `feature/n8n-mcp-server` (tách từ `feature/postgres-17-upgrade`; merge sau PR của n8n và Postgres 17)
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Phân tích & scenario

- [x] Chốt MQ1 (Workflow Tool + sub-workflow), MQ2 (Bearer từ `.env`), MQ3 (`mcp:check`) (2026-11-07)
- [x] Scenario AC-1 → AC-12 trong [requirements.md](./requirements.md)
- [x] Bạn review scenario (2026-11-07)

## Làm

- [x] Biến `MCP_AUTH_TOKEN`: `.env.example`, `docker-compose.dev.yml`, kiểm tra (bắt buộc, ≥ 32 ký tự) trong `entrypoint.sh`
- [x] `credentials.cjs`: credential Bearer `cvScannerMcpToken`
- [x] 2 workflow trong `n8n/workflows/`: `cvScannerMcpServer` (MCP Server Trigger + Workflow Tool `get_position_requirements`) và `cvScannerToolPositionRequirements` (Execute Workflow Trigger → kiểm uuid → Postgres `mcp_readonly` → trả object hoặc lỗi); export lại bằng `n8n:export`
- [x] `entrypoint.sh`: import workflow + `publish:workflow` (`active-workflows.cjs`) trước khi start
- [x] `n8n/setup/up.sh` (`npm run n8n:up`): chạy lại setup và tạo lại container n8n mỗi lần
- [x] `scripts/mcp/mcp-check.mjs` + npm script `mcp:check`
- [x] Tài liệu: project-overview (D30, lộ trình 2.2), n8n-setup, CLAUDE.md

## Kiểm chứng (2026-11-07, token tạm qua biến shell; `.env` của bạn chưa có `MCP_AUTH_TOKEN`)

- [x] `npm run mcp:check` pass (AC-1, AC-4 → AC-10), trên instance thật **và** trên project Docker tạm với database n8n trống (cổng 5688)
- [x] AC-1: 2 workflow + credential token có sẵn sau `n8n:up`, không thao tác tay; `initialize` OK
- [x] AC-2: chạy lại `n8n:up` vẫn 2 workflow + 3 credential `cvScanner*`; đổi token → token mới 200, token cũ 403
- [x] AC-3: thiếu biến → `MCP_AUTH_TOKEN` nêu đúng tên; `tooshort` → "must be at least 32 characters"; n8n không start
- [x] AC-4: không token / token sai → 403
- [x] AC-5: đúng 1 tool; schema chỉ có `position_id` (bắt buộc)
- [x] AC-6: kết quả của `backend-dev` (3 tiêu chí) bằng từng trường với truy vấn trực tiếp DB
- [x] AC-7: vị trí tạm không có tiêu chí → `criteria: []`; vị trí tạm đã xoá (0 dòng còn lại)
- [x] AC-8, AC-9: uuid lạ → "position not found"; `abc` → "must be a UUID"; thiếu tham số → lỗi schema; 3 chuỗi injection bị từ chối, số dòng `positions` không đổi
- [x] AC-10: `mcp_readonly` đọc `applications` → permission denied; workflow tool chỉ dùng `cvScannerMcpRead`; kết quả không có tên / email ứng viên
- [x] AC-11: không in token; n8n tắt → "n8n is not running…"
- [x] AC-12: export 2 lần giống hệt, không secret / email; import trên database n8n trống (project tạm) → workflow tự publish và chạy được
- [x] `n8n:check` vẫn pass; test FE / BE không bị ảnh hưởng (không đụng code)

## Còn lại

- [ ] **Bạn thêm `MCP_AUTH_TOKEN` vào `.env`** (`openssl rand -hex 32`) rồi chạy `npm run n8n:up`. Hiện n8n đang chạy với token tạm của mình; nếu container khởi động lại khi `.env` chưa có biến này, n8n sẽ không lên.
- [ ] Bước 2.3 (WF-1): MCP Client Tool trỏ `http://localhost:5678/mcp/cv-scanner` + credential `cvScannerMcpToken`; xử lý kết quả dạng mảng 1 phần tử
