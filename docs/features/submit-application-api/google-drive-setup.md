# Thiết lập Google Drive để lưu CV (OAuth tài khoản thường)

Làm **một lần**, khi chuyển `CV_STORAGE` từ `local` sang `google-drive` (khoảng 10 phút). Bối cảnh: [requirements.md](./requirements.md) (AQ0–AQ4).

---

## 1. Tạo project và bật Drive API

1. Vào <https://console.cloud.google.com/>, tạo project mới (vd `cv-ai-scanner`).
2. **APIs & Services → Library**, tìm **Google Drive API** → **Enable**.

## 2. Cấu hình OAuth consent screen

Trong **Google Auth Platform** (hoặc **APIs & Services → OAuth consent screen**):

1. **Branding:** điền tên app và email hỗ trợ.
2. **Audience:** chọn **External**.
3. **Data access → Add or remove scopes:** chỉ chọn `https://www.googleapis.com/auth/drive.file`.
4. **Audience → Publish app**, chuyển sang **In production**.
   - Vì chỉ dùng `drive.file` (scope không nhạy cảm) nên không phải gửi Google xác minh.
   - Nếu để ở **Testing**, refresh token **hết hạn sau 7 ngày** và upload sẽ lỗi.

## 3. Tạo OAuth client

1. **Clients → Create client**, chọn Application type **Desktop app**.
2. Copy **Client ID** và **Client secret** vào `.env` ở thư mục gốc repo:

```bash
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

## 4. Lấy refresh token và tạo thư mục

```bash
cd packages/backend
nvm use            # Node 22
npm run drive:auth
```

1. Mở URL mà script in ra, đăng nhập **tài khoản Google sẽ chứa CV**, rồi bấm **Allow**.
   - Nếu thấy màn hình "Google hasn't verified this app": chọn **Advanced → Go to …**, vì đây là app của chính bạn.
2. Script tạo (hoặc dùng lại) thư mục `cv-ai-scanner/cv` trong My Drive của tài khoản đó, rồi in ra 3 dòng.
3. Dán 3 dòng đó vào `.env`, đồng thời xoá dòng `CV_STORAGE=local` cũ:

```bash
CV_STORAGE=google-drive
GOOGLE_REFRESH_TOKEN=...
GOOGLE_DRIVE_CV_FOLDER_ID=...
```

## 5. Kiểm tra

1. Khởi động lại backend. Nếu thiếu biến, backend sẽ báo ngay biến nào còn thiếu.
2. Nộp thử 1 CV. File sẽ xuất hiện trong `cv-ai-scanner/cv`, tên dạng `20261105-093012_frontend-dev_nguyen-van-a_3f1c2b9a.pdf`.

## 6. Chia sẻ cho HR

Trong Drive, mở thư mục `cv-ai-scanner/cv` → **Share** → thêm email của HR (quyền **Viewer**). Các file mới tự động có cùng quyền với thư mục.

---

## Lưu ý

- **Scope `drive.file`:** app chỉ thấy file và thư mục do chính nó tạo. Nếu trước đó bạn đã tự tạo một thư mục `cv-ai-scanner/`, Drive sẽ có 2 thư mục trùng tên → xoá hoặc đổi tên thư mục tạo tay.
- **Secret:** `GOOGLE_CLIENT_SECRET` và `GOOGLE_REFRESH_TOKEN` chỉ được nằm trong `.env` (đã gitignore). Khi lên Azure thì đưa vào Key Vault / App Settings.
- **Thu hồi quyền của app:** vào <https://myaccount.google.com/permissions>.
- **Chạy lại `npm run drive:auth`** khi token bị thu hồi hoặc muốn đổi tài khoản. Nếu vẫn dùng OAuth client và tài khoản cũ, script dùng lại thư mục cũ, không tạo trùng.
- **Phase 2 (n8n):** với `drive.file`, chỉ OAuth client đã tạo file mới đọc được file đó. Vì vậy n8n phải dùng **chung OAuth client này** để tải CV: dùng credential "Google OAuth2 API" với scope `drive.file`, gọi Drive API qua node HTTP Request.
