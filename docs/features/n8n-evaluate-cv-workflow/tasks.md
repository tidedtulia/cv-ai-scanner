# Tasks: WF-1 — workflow n8n đánh giá CV

Feature branch: `feature/n8n-evaluate-cv-workflow` (tách từ `feature/n8n-mcp-server`; merge sau PR của n8n, Postgres 17, MCP)
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Phân tích & scenario

- [x] PoC (2026-11-07): ban đầu kết luận sai là Agent không nhận PDF; đã đính chính: node AI Agent 3.1 có `passthroughBinaryPdfs` và **đã đọc được PDF CV mẫu từ Drive** (Drive → Agent + Claude Sonnet 5.5). Node Anthropic "Analyze document" cũng đọc được PDF nhưng không dùng được MCP
- [x] Chốt WQ1 (Agent đọc PDF trực tiếp — chọn lại sau khi đính chính PoC), WQ2 (credential Drive từ `.env`), WQ3 (`ANTHROPIC_API_KEY` trong `.env`), WQ4 (`claude-sonnet-5-5`)
- [x] Scenario AC-1 → AC-16 trong [requirements.md](./requirements.md)
- [x] Bạn review scenario (AC-9 đã chốt trường của `criteria_scores`)
- [x] Bạn thêm `ANTHROPIC_API_KEY` vào `.env`; khoá + credit gọi được `claude-sonnet-5-5` (HTTP 200)

## Làm

- [x] Biến `ANTHROPIC_API_KEY` + 3 biến Google bắt buộc với `n8n:up`: `.env.example`, compose, `entrypoint.sh` (bỏ khỏi môi trường trước khi n8n start)
- [x] `credentials.cjs`: `cvScannerAnthropic`, `cvScannerGoogleDrive` (access token giả đã hết hạn → n8n tự refresh; đã kiểm tải được CV)
- [x] Workflow `n8n/workflows/cvScannerWf1.json` (17 node): 00:00 + Manual → Cấu hình → Dọn đơn treo → Nhận lô đơn (10) → Tải CV từ Drive → Chấm điểm (AI Agent đọc PDF + Claude + MCP + parser) → Đọc tiêu chí từ DB → Kiểm tra và tính điểm → Lưu kết quả → lô tiếp; 3 nhánh lỗi → Đánh dấu lỗi
- [x] `n8n/wf1/scoring.test.cjs` (`npm run wf1:test`): 11 test chạy đúng code của node "Kiểm tra và tính điểm"
- [x] `scripts/wf1/`: `pdf.mjs` (PDF chữ + PDF chỉ có ảnh), `fixtures.mjs` (5 CV mẫu), `wf1-check.mjs` (`npm run wf1:check`)
- [x] `clean-export.cjs` bỏ thêm `versionId` (export ổn định sau `n8n:up`)
- [x] Tài liệu: project-overview (D31, Q5 đã chốt, kết quả PoC, lộ trình 2.3), n8n-setup, CLAUDE.md

## Kiểm chứng (2026-11-07, n8n thật + Drive thật + Claude thật; dữ liệu thử đã xoá)

- [x] `npm run wf1:test`: 11/11 (bảng AC-9, ngưỡng 75 / 50 / bắt buộc 5, thiếu / thừa / trùng tiêu chí, điểm ngoài khoảng, level / số năm, D12)
- [x] `npm run wf1:check` pass (khoảng 2 phút, khoảng 7 lượt Claude). Lần chạy cuối:
  - CV tốt **90** `RECOMMENDED` > trung bình **39.09** > không phù hợp **0** `NOT_RECOMMENDED`
  - CV scan (chỉ có ảnh) đọc được nội dung, **48.18**; CV có lệnh chèn **0** `NOT_RECOMMENDED` (AC-14)
  - mọi đơn: đủ tiêu chí theo thứ tự, tên / trọng số từ DB, `overall_score` đúng công thức, khuyến nghị đúng ngưỡng, `model` / `prompt_version`, đúng 1 dòng lịch sử mỗi bước (AC-5, AC-8 → AC-10)
  - đơn mất file Drive → `EVALUATION_FAILED` + "Không tải được CV từ Google Drive", các đơn khác vẫn xong (AC-11)
  - đơn treo 2 giờ được đưa lại hàng đợi rồi chấm; đơn `EVALUATING` 5 phút không bị đụng (AC-4)
  - đánh giá lại ghi đè cùng dòng `evaluations` (AC-10); không có đơn → không gọi Drive / Claude (AC-6)
  - dọn sạch 8 đơn thử + 5 file trên Drive
- [x] AC-1: WF-1 import + publish tự động; 2 credential mới có sẵn; không có khoá trong file
- [x] AC-2: thiếu `ANTHROPIC_API_KEY` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` → n8n dừng, nêu đúng tên biến
- [x] AC-3: Schedule 00:00, timezone `Asia/Ho_Chi_Minh`, có Manual Trigger
- [x] AC-12, AC-13: chạy chính các câu SQL của workflow bằng role `n8n_app` trong 1 transaction (ROLLBACK): đều chạy được; khi HR đã `ACCEPTED` thì `evaluations` vẫn lưu nhưng trạng thái giữ nguyên, không thêm lịch sử `EVALUATED`
- [x] AC-15: export không có email / khoá; export → `n8n:up` → export giống hệt
- [x] `n8n:check`, `mcp:check` vẫn pass
- [x] Chạy thử lần đầu trên đơn thật duy nhất trong DB dev (CV mẫu "Jane Nguyen", `fullstack-dev`): **25.45 `NOT_RECOMMENDED`**, level ước tính `INTERN`. Đơn này giờ ở trạng thái `EVALUATED` (giữ lại, không xoá)

## Còn lại

- [ ] Từ đêm nay WF-1 tự chạy 00:00 trên máy local khi n8n đang chạy (mỗi đơn `SUBMITTED` tốn 1 lượt Claude)
- [ ] Refresh token Google hết hạn khoảng 2026-11-11 (OAuth app còn ở Testing) → `npm run drive:auth` rồi `npm run n8n:up`
- [ ] Phase 3: trang HR hiển thị `evaluations`
