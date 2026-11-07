# Tasks: WF-1 — workflow n8n đánh giá CV

Feature branch: `feature/n8n-evaluate-cv-workflow` (tách từ `feature/n8n-mcp-server`; merge sau PR của n8n, Postgres 17, MCP)
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Phân tích & scenario

- [x] PoC (2026-11-07): node AI Agent chỉ chuyển tiếp ảnh, không nhận PDF; node Anthropic "Analyze document" đọc được PDF (input binary hoặc URL, có `maxTokens`) nhưng không có tool / MCP
- [x] Chốt WQ1 (Analyze document → Agent), WQ2 (credential Drive từ `.env`), WQ3 (`ANTHROPIC_API_KEY` trong `.env`), WQ4 (`claude-sonnet-5-5`)
- [x] Scenario AC-1 → AC-16 trong [requirements.md](./requirements.md)
- [ ] Bạn review scenario
- [ ] Bạn thêm `ANTHROPIC_API_KEY` vào `.env` (cần trước khi làm tiếp)

## Làm

- [ ] Biến `ANTHROPIC_API_KEY` + 3 biến Google bắt buộc: `.env.example`, compose, `entrypoint.sh`
- [ ] `credentials.cjs`: `cvScannerAnthropic`, `cvScannerGoogleDrive` (kiểm n8n tự refresh token)
- [ ] Code node tính điểm / kiểm tra kết quả Claude (thuần hàm) + Jest
- [ ] Workflow `cvScannerWf1`: Schedule + Manual → dọn đơn treo → nhận lô → tải Drive → Anthropic (Analyze document) → AI Agent (MCP + parser) → hậu xử lý → lưu; nhánh lỗi
- [ ] `scripts/wf1/`: CV mẫu (5 loại) + `wf1-check.mjs` + npm script `wf1:check`
- [ ] Tài liệu: project-overview (D31, lộ trình 2.3), n8n-setup, CLAUDE.md

## Kiểm chứng

- [ ] AC-1 → AC-16 theo bảng "Kiểm thử" trong requirements.md
