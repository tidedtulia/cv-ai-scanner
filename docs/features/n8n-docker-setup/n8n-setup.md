# Hướng dẫn: chạy n8n trên máy local

n8n chạy trong Docker, cùng Postgres của dự án, ở http://localhost:5678. Chi tiết yêu cầu và quyết định xem tại [requirements.md](./requirements.md).

## 1. Điền `.env` (thư mục gốc repo, một lần)

```bash
openssl rand -hex 32    # dùng làm N8N_ENCRYPTION_KEY
```

| Biến | Giá trị |
|------|---------|
| `N8N_ENCRYPTION_KEY` | Chuỗi vừa sinh. **Không đổi sau khi đã setup**: đổi thì n8n không mở được credential cũ. |
| `N8N_DB_PASSWORD`, `N8N_APP_DB_PASSWORD`, `MCP_DB_PASSWORD` | 3 mật khẩu bất kỳ, khác nhau. Script tự tạo hoặc cập nhật role theo các giá trị này. |
| `N8N_OWNER_EMAIL`, `N8N_OWNER_PASSWORD` | Tài khoản đăng nhập n8n. Mật khẩu dài 8–64 ký tự, có ít nhất 1 chữ số và 1 chữ in hoa. |
| `MCP_AUTH_TOKEN` | Bearer token của MCP server (≥ 32 ký tự): `openssl rand -hex 32`. Xem [n8n-mcp-server](../n8n-mcp-server/requirements.md). |
| `N8N_OWNER_FIRST_NAME`, `N8N_OWNER_LAST_NAME`, `N8N_HOST_PORT` | Không bắt buộc. Port mặc định là `5678`. |

Docker Compose đọc các giá trị này theo quy tắc riêng: `$` bị hiểu là biến, còn `#` đứng sau dấu cách bị hiểu là bắt đầu comment. Giá trị có `#`, `$` hoặc dấu cách thì đặt trong **dấu nháy đơn**, vd `N8N_OWNER_PASSWORD='Abc#123$x'`.

Database ứng dụng phải đã chạy migration (`cd packages/backend && npx prisma migrate deploy`). Nếu chưa, `n8n-init` sẽ báo lỗi và nhắc lệnh này.

## 2. Bật và kiểm tra

```bash
npm run n8n:up      # db → n8n-init → n8n; chờ đến khi n8n healthy (lần đầu khoảng 30 giây)
npm run n8n:check   # mọi dòng ✓ là đúng
```

Mở http://localhost:5678 và đăng nhập bằng `N8N_OWNER_EMAIL` / `N8N_OWNER_PASSWORD`. Mục **Credentials** đã có sẵn 2 credential:
- `CV Scanner DB (n8n_app)`: dùng cho WF-1;
- `CV Scanner DB (mcp_readonly)`: dùng cho workflow MCP.

Đổi mật khẩu hoặc quyền: sửa `.env` hoặc `n8n/setup/init-db.sh`, rồi chạy lại `npm run n8n:up`. Role, owner và credential sẽ được cập nhật theo.

## MCP server cho Claude

`npm run n8n:up` cũng import và publish 2 workflow trong `n8n/workflows/`; MCP server chạy ở `http://localhost:5678/mcp/cv-scanner` (header `Authorization: Bearer <MCP_AUTH_TOKEN>`). Kiểm tra: `npm run mcp:check`. `n8n:up` tạo lại container n8n mỗi lần chạy, nên workflow sửa trên giao diện sẽ bị ghi đè bằng bản trong repo: sửa xong nhớ `npm run n8n:export`.

## 3. Lưu workflow vào repo

```bash
npm run n8n:export   # n8n → n8n/workflows/<id>.json, rồi commit
npm run n8n:import   # n8n/workflows/*.json → n8n (máy mới / database n8n trống)
```

- File export không chứa mật khẩu. Owner, dữ liệu pin (pinData) và mốc thời gian cũng được bỏ khỏi file (`n8n/setup/clean-export.cjs`).
- Workflow tham chiếu credential bằng id cố định, nên import sang máy khác vẫn trỏ đúng credential.
- Xoá một workflow trong n8n thì file của nó **không** tự mất: xoá tay file đó trong `n8n/workflows/`.

## 4. Lệnh khác

| Lệnh | Việc |
|------|------|
| `npm run n8n:logs` | Xem log của `n8n-init` và `n8n` |
| `npm run n8n:down` | Dừng n8n, Postgres vẫn chạy |
| `npm run db:down` | Dừng tất cả (dữ liệu vẫn giữ trong volume) |
| `npm run db:up` | Chỉ bật Postgres (không bật n8n) |

## Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|------------|------------|
| `n8n-init: missing required variable(s) in .env: …` | Điền biến được nêu trong `.env` |
| `n8n-setup: N8N_OWNER_PASSWORD must be …` | Dùng mật khẩu mạnh hơn |
| Đăng nhập n8n báo sai mật khẩu, dù đã nhập đúng giá trị trong `.env` | Mật khẩu có `$` (bị hiểu là biến) hoặc có `#` đứng sau dấu cách (bị hiểu là comment) → đặt trong dấu nháy đơn, rồi chạy lại `n8n:up` |
| `Mismatching encryption keys` | `N8N_ENCRYPTION_KEY` đã bị đổi → đặt lại khoá cũ |
