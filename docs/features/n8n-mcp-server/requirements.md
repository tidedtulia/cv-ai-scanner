# Feature: Workflow MCP server — tool `get_position_requirements` (Phase 2 — bước 2.2)

## Mục tiêu

Dựng trong n8n một **MCP server chỉ đọc** có đúng 1 tool, để Claude (trong WF-1, bước 2.3) lấy dữ liệu chấm điểm của một vị trí: JD, level, số năm kinh nghiệm, tiêu chí kèm hướng dẫn chấm, và danh sách level để ước tính.

Bối cảnh: [project-overview.md §7 MCP server](../../project-overview.md#mcp-server) (D13) · SQL: [database.md §5.2](../../database.md#52-tool-mcp-get_position_requirements) · Nền: [n8n-docker-setup](../n8n-docker-setup/requirements.md)

---

## Phạm vi

- **2 workflow**, lưu trong `n8n/workflows/` (export bằng `npm run n8n:export`):
  - `MCP — CV Scanner` (id `cvScannerMcpServer`): **MCP Server Trigger** (xác thực Bearer) + 1 node **Call n8n Workflow Tool** tên `get_position_requirements`, mô tả rõ cho Claude.
  - `Tool — get_position_requirements` (id `cvScannerToolPositionRequirements`): sub-workflow do tool gọi. Nhận `position_id`, chạy **SQL cố định** bằng credential `mcp_readonly` (id `cvScannerMcpRead`), trả 1 object JSON.
- Credential mới `CV Scanner MCP token` (id `cvScannerMcpToken`, loại Bearer) do `entrypoint.sh` tạo từ biến `MCP_AUTH_TOKEN` trong `.env` (cùng cách với 2 credential Postgres).
- Cả 2 workflow được **import và publish** tự động khi `npm run n8n:up`, không phải bấm tay trên UI. n8n 2.x chỉ chạy một sub-workflow đã publish, nên sub-workflow cũng phải publish.
- `npm run n8n:up` **tạo lại container n8n mỗi lần chạy** (Postgres giữ nguyên), để `.env` và workflow trong repo luôn được áp dụng lại.
- `npm run mcp:check`: client MCP nhỏ kiểm tra từng AC trên n8n thật, không cần Claude.
- **Không làm:** WF-1 và node AI Agent (bước 2.3); PoC AI Agent đọc PDF; MCP trên URL public (Azure, Phase 5).

### Biến môi trường mới (`.env` gốc)

| Biến | Bắt buộc | Dùng cho |
|------|----------|----------|
| `MCP_AUTH_TOKEN` | Có (với `n8n:up`) | Bearer token của MCP server, tối thiểu 32 ký tự (sinh bằng `openssl rand -hex 32`) |

### Endpoint

MCP Server Trigger với path `cv-scanner`, transport Streamable HTTP, chỉ trong mạng Docker và trên `127.0.0.1`:
- Từ máy local: `http://localhost:5678/mcp/cv-scanner`
- Từ container n8n (WF-1 sau này): `http://localhost:5678/mcp/cv-scanner`; từ container khác trong cùng Compose: `http://n8n:5678/mcp/cv-scanner`

---

## Acceptance Criteria

Mỗi AC là một scenario. Gọi MCP theo giao thức JSON-RPC (`initialize`, `tools/list`, `tools/call`) kèm header `Authorization: Bearer <MCP_AUTH_TOKEN>`, trừ khi AC nói khác.

### Khởi động

#### AC-1: Có sẵn sau `n8n:up`

**Given:** `.env` có `MCP_AUTH_TOKEN`, đã chạy `npm run n8n:up`
**Then:**
- Trong n8n có 2 workflow `MCP — CV Scanner` và `Tool — get_position_requirements`, cả hai đã publish.
- Trong **Credentials** có `CV Scanner MCP token`; **không** phải nhập tay gì trên UI.
- `initialize` tới `/mcp/cv-scanner` thành công.

#### AC-2: Chạy lại không tạo bản trùng, theo `.env`

**When:** chạy lại `npm run n8n:up`, hoặc đổi `MCP_AUTH_TOKEN` trong `.env` rồi chạy lại
**Then:**
- Vẫn đúng 2 workflow và 1 credential token (không trùng).
- Token mới dùng được, token cũ bị từ chối (AC-3).
- Workflow bạn sửa tay trên UI bị ghi đè bằng bản trong repo (repo là nguồn chính).

#### AC-3: Thiếu hoặc sai biến

| Trường hợp | Kết quả |
|------------|---------|
| Thiếu `MCP_AUTH_TOKEN` | `n8n` dừng trước khi start, nêu đúng tên biến |
| `MCP_AUTH_TOKEN` ngắn hơn 32 ký tự | `n8n` dừng, nêu yêu cầu độ dài |

### Xác thực

#### AC-4: Không token, sai token

**When:** gọi `/mcp/cv-scanner` không có header `Authorization`, hoặc với token sai
**Then:** trả **401 / 403**, không liệt kê tool, không chạy truy vấn nào.

### Tool

#### AC-5: Liệt kê tool

**When:** gọi `tools/list` với token đúng
**Then:**
- Có **đúng 1 tool** tên `get_position_requirements`.
- Mô tả tool (tiếng Anh) nói rõ: lấy JD, level, số năm kinh nghiệm tối thiểu, tiêu chí chấm và danh sách level của **một vị trí** theo `position_id`.
- Input schema có đúng 1 tham số bắt buộc `position_id` (chuỗi, uuid). Không có tham số nào cho phép truyền SQL hay tên bảng.

#### AC-6: Lấy yêu cầu của vị trí

**Given:** vị trí `backend-dev` có JD và các tiêu chí trong DB
**When:** gọi `tools/call` `get_position_requirements` với `position_id` = id của vị trí đó
**Then:** kết quả là 1 object JSON có (n8n bọc các output của sub-workflow thành mảng, nên Claude nhận `[ { … } ]` với đúng 1 phần tử):

| Trường | Nội dung |
|--------|----------|
| `position_id`, `title`, `description` | id, tên vị trí và JD (markdown, nguyên văn) |
| `category` | tên nhóm vị trí |
| `level` | `{ code, name }` của level yêu cầu |
| `min_years_experience` | số năm tối thiểu |
| `criteria[]` | mỗi tiêu chí: `id`, `name`, `type`, `description` (hướng dẫn chấm), `weight`, `is_required`; **theo `sort_order`** |
| `levels[]` | `{ code, name }` của các level `is_active`, theo `sort_order` |

- Số tiêu chí và giá trị trả về khớp từng dòng với bảng `position_criteria`.
- Mọi vị trí (kể cả không `OPEN`) đều tra được: WF-1 đánh giá lại được đơn của job đã đóng.

#### AC-7: Vị trí không có tiêu chí

**Given:** vị trí tồn tại nhưng chưa có tiêu chí nào
**When:** gọi tool
**Then:** vẫn trả `title`, `description`, `level`…; `criteria` là mảng rỗng `[]` (không lỗi, không `null`).

#### AC-8: `position_id` không hợp lệ

| Input | Kết quả |
|-------|---------|
| uuid hợp lệ nhưng không có vị trí | lỗi rõ: "position not found" (không trả object rỗng) |
| chuỗi không phải uuid (vd `abc`) | lỗi rõ: "position_id must be a UUID", **không** có lỗi SQL thô |
| thiếu `position_id` | lỗi tham số, không chạy truy vấn |

#### AC-9: Chống SQL injection

**When:** `position_id` = `' OR 1=1; DROP TABLE positions; --`, hoặc chứa dấu nháy / `;`
**Then:** bị từ chối ở bước kiểm uuid (AC-8); bảng `positions` còn nguyên. Câu SQL luôn dùng tham số, không nối chuỗi.

### Bảo mật dữ liệu

#### AC-10: Tool không đọc được dữ liệu ứng viên

**Then:**
- Workflow `Tool — get_position_requirements` chỉ dùng credential `mcp_readonly` (không dùng `n8n_app`).
- Dù ai sửa câu SQL để đọc `applications`, `evaluations` hay `users`, DB trả `permission denied` (đã có ở [n8n-docker-setup AC-8](../n8n-docker-setup/requirements.md)); `mcp:check` chứng minh bằng cách thử đọc `applications` qua đúng credential đó.
- Kết quả của tool không chứa email, tên ứng viên hay đường dẫn CV.

### Kiểm tra

#### AC-11: `npm run mcp:check`

**Given:** n8n đang chạy
**When:** chạy `npm run mcp:check`
**Then:**
- Chạy AC-1, AC-4 → AC-9, in ✓ hoặc ✗ từng mục; exit ≠ 0 nếu có ✗.
- Không ghi dữ liệu vào database; không in token.
- Tự tạo dữ liệu thử (vị trí không có tiêu chí cho AC-7) **trong transaction rồi ROLLBACK**, hoặc dùng vị trí thật có sẵn; không để lại dữ liệu.
- n8n không chạy: báo "n8n is not running — run `npm run n8n:up` first", exit 1.

#### AC-12: Workflow trong repo

**When:** chạy `npm run n8n:export`
**Then:** `n8n/workflows/cvScannerMcpServer.json` và `cvScannerToolPositionRequirements.json` được ghi; chỉ tham chiếu credential bằng id + tên (không secret, không token); export lại không đổi file. Import sang database n8n trống (`n8n:import`) cho workflow chạy y hệt (AC-6).

---

## Kiểm thử

Feature hạ tầng / workflow, không có code FE / BE (D28): kiểm bằng `npm run mcp:check` trên n8n thật và các bước tay, ghi kết quả vào [tasks.md](./tasks.md).

| AC | Cách kiểm |
|----|-----------|
| AC-1 | `mcp:check`: `initialize` OK · SQL: 2 workflow `active`, credential tồn tại |
| AC-2 | Tay: chạy lại `n8n:up` (đếm workflow / credential); đổi `MCP_AUTH_TOKEN` tạm qua biến shell (token cũ 403, token mới 200) |
| AC-3 | Tay: bỏ biến / dùng token ngắn → đọc log |
| AC-4 | `mcp:check`: không header, token sai |
| AC-5 | `mcp:check`: `tools/list` — đúng 1 tool, schema |
| AC-6 | `mcp:check`: so kết quả với truy vấn trực tiếp bảng `position_criteria` của vị trí thật |
| AC-7 | `mcp:check`: vị trí tạm không tiêu chí (transaction + rollback, hoặc tạo rồi xoá) |
| AC-8, AC-9 | `mcp:check`: các input xấu |
| AC-10 | `mcp:check`: đọc `applications` bằng credential `mcp_readonly` → `permission denied`; kiểm file workflow chỉ dùng `cvScannerMcpRead`; kiểm kết quả không có email / tên |
| AC-11 | Chạy khi đúng (exit 0) và khi cố ý làm sai (đổi tên tool, exit ≠ 0) |
| AC-12 | `n8n:export` 2 lần giống nhau; xoá workflow → `n8n:import` → `mcp:check` pass |

---

## Quyết định (2026-11-07)

| # | Câu hỏi | Đã chốt |
|---|---------|---------|
| MQ1 | Dựng tool bằng node nào | **Call n8n Workflow Tool + sub-workflow** với SQL cố định; Claude chỉ truyền `position_id` |
| MQ2 | Xác thực | **Bearer token** từ `MCP_AUTH_TOKEN`; credential tự tạo, id cố định `cvScannerMcpToken` |
| MQ3 | Kiểm thử | **`npm run mcp:check`** gọi MCP thật (không cần credit Anthropic) |
| — | Workflow có tự bật không | Có: import + publish tự động khi `n8n:up` (AC-1) |
| — | Vị trí nào tra được | Mọi trạng thái (không chỉ `OPEN`) để đánh giá lại đơn của job đã đóng |

### Ghi chú kỹ thuật (cần kiểm khi làm)

- MCP Server Trigger có 2 transport (SSE và Streamable HTTP); `mcp:check` dùng Streamable HTTP. Cần kiểm WF-1 (node MCP Client Tool) kết nối được qua cùng endpoint.
- Workflow phải published thì URL `/mcp/...` mới có hiệu lực, **và sub-workflow cũng phải published** (nếu không tool trả "Workflow is not active and cannot be executed"). `entrypoint.sh` chạy: import credential → import workflow → `publish:workflow` các workflow có `"active": true` → start (đã kiểm: chạy được cả trên database trống chưa có owner).
- Sub-workflow của Workflow Tool tham chiếu bằng id cố định `cvScannerToolPositionRequirements`, nên import sang máy khác vẫn trỏ đúng.
- SQL lấy từ [database.md §5.2](../../database.md#52-tool-mcp-get_position_requirements), bổ sung `levels[]`. Dùng `LEFT JOIN position_criteria` để vị trí không có tiêu chí vẫn trả về (AC-7); câu SQL gốc dùng `JOIN` nên sẽ không trả dòng nào.

### Phát hiện khi làm

- `n8n import:workflow` luôn import ở trạng thái **chưa publish** ("Deactivating workflow…"); phải `publish:workflow` sau đó, và chỉ có hiệu lực khi n8n (re)start. Vì entrypoint chỉ chạy lúc container start, `n8n:up` được đổi thành `n8n/setup/up.sh`: Postgres → `n8n-init` → tạo lại `n8n` (`--force-recreate`).
- Kết quả của tool là mảng 1 phần tử (xem AC-6). WF-1 (bước 2.3) cần dùng `[0]` hoặc để Claude đọc nguyên mảng.
- Node Workflow Tool lấy **tên node làm tên tool** (từ typeVersion 2.1), nên node phải tên đúng `get_position_requirements`.
- Không có token / token sai trả **403** (không phải 401).
- Node 18 (mặc định của máy này) phân giải `localhost` ra IPv6, trong khi cổng chỉ mở trên 127.0.0.1 → `mcp-check` dùng `127.0.0.1`.
- `mcp:check` lấy cổng từ cấu hình Compose, nên chạy được cả trên một project Docker tạm (đã kiểm trên database n8n trống).
- Sau khi thêm `MCP_AUTH_TOKEN` thành biến bắt buộc, n8n **không khởi động** nếu `.env` chưa có biến này (kể cả khi Docker tự khởi động lại container).
