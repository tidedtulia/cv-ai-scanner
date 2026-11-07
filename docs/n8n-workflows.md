# Các workflow n8n

Hệ thống có **3 workflow n8n**, lưu trong `n8n/workflows/` và được `npm run n8n:up` tự import và publish. Repo là nguồn chính: workflow sửa trên giao diện n8n sẽ bị ghi đè ở lần `n8n:up` sau, nên sửa xong phải chạy `npm run n8n:export` rồi commit.

```
WF-1 — Đánh giá CV  (chạy 00:00 mỗi đêm)
   │  với mỗi đơn: AI Agent (Claude) cần tiêu chí của vị trí
   ▼  gọi tool qua MCP (HTTP + Bearer token)
MCP — CV Scanner  (MCP server, chỉ có 1 tool)
   │  tool get_position_requirements gọi sub-workflow
   ▼
Tool — get_position_requirements  (đọc DB bằng role chỉ đọc mcp_readonly)
```

| Workflow | File | Id | Yêu cầu chi tiết |
|----------|------|----|------------------|
| WF-1 — Đánh giá CV | `n8n/workflows/cvScannerWf1.json` | `cvScannerWf1` | [n8n-evaluate-cv-workflow](./features/n8n-evaluate-cv-workflow/requirements.md) |
| MCP — CV Scanner | `n8n/workflows/cvScannerMcpServer.json` | `cvScannerMcpServer` | [n8n-mcp-server](./features/n8n-mcp-server/requirements.md) |
| Tool — get_position_requirements | `n8n/workflows/cvScannerToolPositionRequirements.json` | `cvScannerToolPositionRequirements` | [n8n-mcp-server](./features/n8n-mcp-server/requirements.md) |

Cài đặt n8n, biến `.env` và các lệnh: [n8n-setup.md](./features/n8n-docker-setup/n8n-setup.md). Bối cảnh thiết kế: [project-overview.md §7](./project-overview.md#7-đánh-giá-cv-n8n--mcp--claude).

### Credential

Các credential được tạo tự động từ `.env` mỗi lần `n8n:up` (`n8n/setup/credentials.cjs`), với id cố định để workflow luôn trỏ đúng:

| Id | Loại | Dùng ở | Từ `.env` |
|----|------|--------|-----------|
| `cvScannerN8nApp` | Postgres, role `n8n_app` | WF-1 (mọi node SQL) | `N8N_APP_DB_PASSWORD` |
| `cvScannerMcpRead` | Postgres, role `mcp_readonly` | Tool — get_position_requirements | `MCP_DB_PASSWORD` |
| `cvScannerMcpToken` | Bearer | MCP Server Trigger và MCP Client Tool của WF-1 | `MCP_AUTH_TOKEN` |
| `cvScannerAnthropic` | Anthropic API | Node Claude của WF-1 | `ANTHROPIC_API_KEY` |
| `cvScannerGoogleDrive` | Google Drive OAuth2 | Node tải CV của WF-1 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` |

Quyền của 2 role Postgres: [database.md §6](./database.md#6-phân-quyền-db-cho-n8n).

---

## 1. `Tool — get_position_requirements`

Sub-workflow trả về mọi thông tin cần để chấm một vị trí. Nó không tự chạy, chỉ chạy khi tool MCP gọi tới.

| # | Node | Việc làm |
|---|------|----------|
| 1 | **When called by the MCP tool** (Execute Workflow Trigger) | Nhận đúng 1 tham số `position_id` |
| 2 | **Validate position_id** (Code) | Thiếu → lỗi "position_id is required". Không đúng dạng UUID → lỗi "position_id must be a UUID". Chuỗi kiểu `' OR 1=1; DROP TABLE…` bị chặn trước khi tới DB |
| 3 | **Read position (mcp_readonly)** (Postgres) | Chạy **một câu SQL cố định**, `position_id` truyền dạng tham số `$1::uuid` (không nối chuỗi), ghép kết quả thành 1 object JSON |
| 4 | **Return requirements or fail** (Code) | Không có dòng nào → lỗi "position not found". Có → trả object đó |

Object trả về:

| Trường | Nội dung |
|--------|----------|
| `position_id`, `title`, `description` | id, tên vị trí, JD (markdown) |
| `category` | tên nhóm vị trí |
| `level` | `{ code, name }` của level yêu cầu |
| `min_years_experience` | số năm kinh nghiệm tối thiểu |
| `criteria[]` | `id`, `name`, `type`, `description` (hướng dẫn chấm), `weight` (1–5), `is_required`; theo `sort_order` |
| `levels[]` | `{ code, name }` của các level đang dùng, để Claude chọn khi ước tính level ứng viên |

**Bảo mật:** node Postgres dùng credential `mcp_readonly`. Role này chỉ đọc được 4 bảng job (`job_categories`, `job_levels`, `positions`, `position_criteria`). Dù có ai sửa câu SQL để đọc `applications` hay `users`, DB vẫn trả "permission denied". Đây là lớp chặn chính khi CV chứa câu lệnh độc hại (prompt injection).

---

## 2. `MCP — CV Scanner`

Biến sub-workflow ở mục 1 thành một **tool** mà Claude gọi được qua giao thức MCP.

| Node | Việc làm |
|------|----------|
| **MCP Server Trigger** | Mở endpoint `http://localhost:5678/mcp/cv-scanner` (Streamable HTTP). Chỉ nhận request có header `Authorization: Bearer <MCP_AUTH_TOKEN>`; thiếu hoặc sai token → **403** |
| **get_position_requirements** (Call n8n Workflow Tool) | Tên node chính là tên tool. Phần mô tả nói cho Claude biết tool trả gì và khi nào gọi. Schema chỉ có 1 tham số bắt buộc `position_id`, nên Claude **không thể truyền SQL hay tên bảng**. Khi được gọi, node chạy sub-workflow ở mục 1 |

Một lần gọi MCP diễn ra theo 3 bước:
1. `initialize`: client nhận session (header `mcp-session-id`).
2. `tools/list`: trả về đúng 1 tool.
3. `tools/call` với `{ "position_id": "…" }`: chạy sub-workflow. n8n bọc kết quả thành **mảng 1 phần tử** `[{ … }]`.

n8n 2.x chỉ chạy một sub-workflow đã publish, nên cả 2 workflow này đều được publish.

Kiểm tra: `npm run mcp:check` là một client MCP nhỏ đi đúng 3 bước trên. Nó còn thử token sai, id sai, chuỗi SQL injection, và chứng minh tool không đọc được dữ liệu ứng viên.

---

## 3. `WF-1 — Đánh giá CV`

Workflow chính (17 node): mỗi đêm chấm các đơn `SUBMITTED` và ghi kết quả vào bảng `evaluations`.

### Luồng chính

```
[Mỗi ngày 00:00 (giờ VN)] ─┐
[Chạy thủ công] ───────────┴─▶ Cấu hình ─▶ Dọn đơn treo ─▶ Nhận lô đơn ─▶ Tải CV từ Drive
        ┌─────────────────────────────────────────────────────▲──────────────────┘
        ▼                                                     │ (lô tiếp theo)
  Chấm điểm (AI Agent) ─▶ Đọc tiêu chí từ DB ─▶ Kiểm tra và tính điểm ─▶ Lưu kết quả
     ├ Claude (model)
     ├ get_position_requirements (MCP)
     └ Định dạng kết quả (JSON schema)
```

**1. Hai trigger**
- **Mỗi ngày 00:00 (giờ VN):** workflow đặt múi giờ `Asia/Ho_Chi_Minh` (trong *Settings* của workflow), nên chạy đúng nửa đêm giờ Việt Nam.
- **Chạy thủ công:** bấm *Execute workflow* trên giao diện, hoặc dùng `n8n execute --id=cvScannerWf1` như `wf1:check`.

Cả hai đi vào cùng một luồng.

**2. Cấu hình** (Set): `model = claude-sonnet-5-5`, `prompt_version = v1`. Đổi model ở node này. Hai giá trị được lưu cùng mỗi kết quả, để biết kết quả do model và prompt nào tạo ra. Model không đặt bằng biến `.env`, vì n8n mặc định chặn workflow đọc biến môi trường.

**3. Dọn đơn treo** (Postgres)
- Đơn còn `EVALUATING` quá **1 giờ** (thường do lần chạy trước bị chết giữa chừng) → trả về `SUBMITTED`, ghi lịch sử "lần đánh giá trước bị gián đoạn, đưa lại hàng đợi".
- Đơn `EVALUATING` mới hơn 1 giờ (có thể một lần chạy khác đang xử lý) thì để nguyên.
- Node luôn chạy tiếp (`alwaysOutputData`), kể cả khi không có đơn treo.

**4. Nhận lô đơn** (Postgres, chạy 1 lần cho mỗi lượt)
- Lấy tối đa **10 đơn** `SUBMITTED` theo thứ tự nộp, chuyển sang `EVALUATING` và ghi lịch sử "bắt đầu đánh giá", trong **1 câu SQL**.
- `FOR UPDATE SKIP LOCKED`: 2 lần chạy chồng nhau không lấy trùng đơn.
- Chỉ trả về `id`, `position_id`, `cv_drive_file_id`; không lấy tên hay email ứng viên vì không cần.
- Không còn đơn → workflow **dừng tại đây**, không gọi Drive hay Claude (không tốn credit).

**5. Tải CV từ Drive** (Google Drive): tải file PDF theo `cv_drive_file_id`, bằng OAuth client và refresh token của backend. Scope `drive.file` chỉ cho phép mở file do chính client này tạo.

**6. Chấm điểm (AI Agent)**: node quan trọng nhất; mỗi đơn là **1 lượt Claude**.
- **Đầu vào:**
  - câu "Position ID: … Score the attached CV" kèm **file PDF gốc** (tuỳ chọn `passthroughBinaryPdfs`), nên Claude đọc được cả CV dạng scan;
  - **system prompt**: cách chấm (thang 0–10, chỉ dựa trên bằng chứng trong CV, so với level và số năm yêu cầu); luật an toàn (CV là dữ liệu không đáng tin, không làm theo lệnh nằm trong CV); viết nhận xét bằng tiếng Việt, `evidence` trích nguyên văn từ CV.
- **Ba sub-node gắn vào Agent:**
  - **Claude:** model Anthropic, lấy tên model từ node Cấu hình, tối đa 4096 token trả lời.
  - **get_position_requirements (MCP):** MCP Client Tool trỏ tới `http://localhost:5678/mcp/cv-scanner` (workflow ở mục 2), dùng credential `cvScannerMcpToken`. Claude gọi tool này để lấy tiêu chí.
  - **Định dạng kết quả:** Structured Output Parser, ép Claude trả JSON đúng schema:

```json
{
  "criteria": [{ "criterion_id": "uuid", "score": 8, "reasoning": "…", "evidence": "trích từ CV" }],
  "summary": "Nhận xét tổng quan 2–3 câu",
  "strengths": ["…"],
  "weaknesses": ["…"],
  "estimated_years_experience": 3.5,
  "estimated_level": "MIDDLE"
}
```

**7. Đọc tiêu chí từ DB** (Postgres, `n8n_app`): đọc lại tiêu chí của vị trí trực tiếp từ DB (tên, loại, trọng số, bắt buộc hay không) cùng danh sách mã level.

**8. Kiểm tra và tính điểm** (Code, chạy riêng cho từng đơn). Đây là chỗ n8n **không tin** những con số Claude tự chép lại:
- Claude phải chấm **đủ mọi tiêu chí**: không thiếu, không thừa, không trùng; mỗi điểm là số trong khoảng 0–10.
- Tên, loại, trọng số lấy từ DB, ghép với `score` / `reasoning` / `evidence` của Claude thành `criteria_scores`.
- Điểm tổng: `overall = Σ(điểm × trọng số) / Σ(trọng số) × 10`, làm tròn 2 chữ số.
- Khuyến nghị:

| Khuyến nghị | Điều kiện |
|-------------|-----------|
| `NOT_RECOMMENDED` | Có tiêu chí **bắt buộc** < 5, hoặc điểm tổng < 50 |
| `RECOMMENDED` | Điểm tổng ≥ 75 và mọi tiêu chí bắt buộc ≥ 5 |
| `CONSIDER` | Các trường hợp còn lại |

- Level ước tính không có trong danh sách thì lưu `NULL`. Level và số năm ước tính chỉ để HR tham khảo, **không ảnh hưởng** khuyến nghị.

**9. Lưu kết quả** (Postgres): một câu SQL làm 3 việc:
- upsert bảng `evaluations` (đánh giá lại thì ghi đè đúng dòng cũ);
- chuyển đơn sang `EVALUATED`, nhưng **chỉ khi đơn vẫn đang `EVALUATING`** (không ghi đè nếu HR đã quyết định trong lúc chấm);
- ghi lịch sử "đánh giá xong".

**10. Vòng lặp:** sau khi lưu, workflow quay lại **Nhận lô đơn** để lấy 10 đơn tiếp theo, cho đến khi hết.

### Nhánh lỗi

Ba node có "đầu ra lỗi" riêng, nên **một đơn lỗi không làm hỏng cả lô**:

| Lỗi ở node | Ghi chú lưu vào lịch sử |
|------------|-------------------------|
| Tải CV từ Drive | "Không tải được CV từ Google Drive" |
| Chấm điểm (AI Agent): API lỗi, hết credit, JSON sai schema | "Lỗi khi chấm CV bằng Claude: …" (tối đa 200 ký tự, đã che khoá / token) |
| Kiểm tra và tính điểm | "Kết quả chấm của AI không hợp lệ: …" (vd thiếu tiêu chí, điểm ngoài 0–10) |

Cả ba nhánh đi vào **Đánh dấu lỗi** (Postgres): đơn chuyển sang `EVALUATION_FAILED` kèm ghi chú (chỉ khi đơn còn `EVALUATING`), rồi quay về Nhận lô đơn để xử lý tiếp các đơn khác. Đơn lỗi không có dòng `evaluations`; HR có thể yêu cầu đánh giá lại hoặc tự xem CV.

### Ví dụ một đơn đi qua WF-1

1. **00:00:** Nhận lô đơn lấy đơn của Minh (`backend-dev`). Đơn chuyển `SUBMITTED → EVALUATING`.
2. **Tải CV:** Drive trả về file `…_backend-dev_minh-tran_….pdf`.
3. **Chấm điểm:** Claude đọc PDF, gọi `get_position_requirements` và nhận 3 tiêu chí: NestJS (trọng số 5, bắt buộc), PostgreSQL (4, bắt buộc), Prisma ORM (2). Claude chấm 9, 9, 9 và trả JSON.
4. **Kiểm tra và tính điểm:** đủ 3 tiêu chí, điểm hợp lệ. Điểm tổng (9×5 + 9×4 + 9×2) / 11 × 10 = **90**, nên khuyến nghị `RECOMMENDED`.
5. **Lưu kết quả:** bảng `evaluations` có thêm 1 dòng, đơn chuyển `EVALUATING → EVALUATED`.
6. **Sáng hôm sau:** HR xem kết quả ở trang HR (Phase 3).

### Dữ liệu ghi vào DB

| Bảng | Ghi gì |
|------|--------|
| `evaluations` | 1 dòng / đơn: `overall_score`, `recommendation`, `criteria_scores`, `summary`, `strengths`, `weaknesses`, `estimated_years_experience`, `estimated_level_id`, `model`, `prompt_version` |
| `applications` | `status`: `SUBMITTED → EVALUATING → EVALUATED` hoặc `EVALUATION_FAILED` |
| `application_status_history` | 1 dòng cho mỗi lần đổi trạng thái, `note` của n8n (vd "n8n: đánh giá xong", lý do lỗi) |

Mỗi phần tử `criteria_scores`: `criterion_id`, `name`, `type`, `weight`, `is_required` (từ DB) và `score`, `reasoning`, `evidence` (từ Claude), theo `sort_order` của tiêu chí.

---

## Sửa workflow

| Muốn đổi | Sửa ở đâu | Kiểm lại bằng |
|----------|-----------|---------------|
| Model Claude | node **Cấu hình** (`model`) | `npm run wf1:check` |
| Prompt | system message của node **Chấm điểm (AI Agent)**; nhớ tăng `prompt_version` ở node **Cấu hình** | `npm run wf1:check` |
| Ngưỡng khuyến nghị (75 / 50 / bắt buộc 5) | hằng số đầu đoạn code của node **Kiểm tra và tính điểm** | `npm run wf1:test`, rồi `wf1:check` |
| Kích thước lô (10) / thời gian coi là treo (1 giờ) | câu SQL của node **Nhận lô đơn** / **Dọn đơn treo** | `npm run wf1:check` |
| Dữ liệu tool trả cho Claude | câu SQL của node **Read position (mcp_readonly)** | `npm run mcp:check` |
| Lịch chạy | node **Mỗi ngày 00:00 (giờ VN)** | — |

Quy trình chung:
1. Sửa trên giao diện n8n (http://localhost:5678).
2. Chạy `npm run n8n:export` để lưu vào `n8n/workflows/`.
3. Chạy lại bộ kiểm tra phù hợp ở bảng trên.
4. Commit.

Khi sửa câu SQL, nhớ quyền của role: `n8n_app` và `mcp_readonly` chỉ có đúng các quyền ở [database.md §6](./database.md#6-phân-quyền-db-cho-n8n). Cần thêm quyền thì sửa `n8n/setup/init-db.sh` và danh sách mong đợi trong `n8n/setup/check-db.sh`.

## Kiểm tra & theo dõi

| Lệnh | Kiểm gì | Chi phí |
|------|---------|---------|
| `npm run wf1:test` | Logic tính điểm: chạy đúng đoạn code nằm trong file workflow, không cần n8n | Miễn phí |
| `npm run mcp:check` | MCP server và tool, gọi thật | Miễn phí (không gọi Claude) |
| `npm run wf1:check` | WF-1 đầu cuối với 5 CV mẫu qua backend, Drive và Claude thật, rồi dọn sạch | Khoảng 7 lượt Claude |
| `npm run n8n:check` | Cài đặt n8n: role, quyền, owner, credential, múi giờ | Miễn phí |

- `wf1:check` cần backend đang chạy với `CV_STORAGE=google-drive`. Nó từ chối chạy khi còn đơn thật đang chờ (vì WF-1 chấm mọi đơn `SUBMITTED`), trừ khi thêm `-- --include-real`.
- **Executions** trên giao diện n8n: xem từng lần chạy, dữ liệu vào và ra của mỗi node, kể cả lúc Claude gọi tool MCP. Execution chứa tóm tắt và trích dẫn từ CV; n8n mặc định tự xoá sau **14 ngày**.

## Sự cố thường gặp

| Hiện tượng | Nguyên nhân / cách xử lý |
|------------|--------------------------|
| Mọi đơn `EVALUATION_FAILED` với "Không tải được CV từ Google Drive" | Refresh token Google hết hạn (7 ngày khi OAuth app còn ở chế độ Testing) → `npm run drive:auth`, rồi `npm run n8n:up` |
| "Lỗi khi chấm CV bằng Claude: … credit balance …" | Hết credit Anthropic → nạp ở console.anthropic.com |
| "Kết quả chấm của AI không hợp lệ: missing criteria …" | Claude chấm thiếu tiêu chí, thường do tool MCP lỗi hoặc vị trí không còn tiêu chí → xem execution, chạy `npm run mcp:check` |
| Tool trả "Workflow is not active and cannot be executed" | Sub-workflow chưa publish → `npm run n8n:up` (tự publish các workflow có `"active": true`) |
| Đơn kẹt ở `EVALUATING` | Lần chạy bị ngắt giữa chừng; lần chạy sau tự đưa về `SUBMITTED` khi đã quá 1 giờ |
