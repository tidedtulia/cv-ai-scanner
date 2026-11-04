# Feature: API nộp đơn + upload CV lên Google Drive (Phase 1 — bước 1.3)

## Mục tiêu

Thay API mock `POST /api/submit-cv` (Next.js) bằng API thật ở backend:
- Kiểm tra dữ liệu ứng viên gửi lên.
- Upload CV lên Google Drive (thư mục `cv-ai-scanner/cv/`).
- Lưu đơn vào bảng `applications` với trạng thái `SUBMITTED` + 1 dòng lịch sử.

Đơn ở trạng thái `SUBMITTED` sẽ được n8n chấm lúc 00:00 (Phase 2).

Bối cảnh: [project-overview.md](../../project-overview.md) (D1, D2, D14) · DB: [database.md §4.6](../../database.md#46-applications--đơn-ứng-tuyển) · Feature trước: [public-jobs-api](../public-jobs-api/)

---

## Phạm vi

- Backend: module `applications` với `POST /api/applications` (multipart).
- Lưu trữ CV qua interface `CvStorage`, có 2 bản cài đặt:
  - `google-drive` — OAuth của **tài khoản Google thường** (không dùng Workspace / service account).
  - `local` — lưu file vào thư mục trên máy, dùng khi dev / test khi chưa có credentials.
- Script một lần để lấy refresh token và tạo thư mục trên Drive.
- Thông báo lỗi dùng chung FE / BE đặt trong `@org/shared`.
- **Không làm ở feature này:**
  - Frontend gọi API thật (bước 1.4).
  - Chống spam / giới hạn tần suất nộp đơn (ghi nhận, làm sau).
  - Checkbox đồng ý xử lý dữ liệu (Q7 chưa chốt).

---

## API

`POST /api/applications` — `multipart/form-data`, giữ đúng tên field mà form hiện tại đang gửi:

| Field | Bắt buộc | Kiểm tra |
|-------|----------|----------|
| `name` | ✔ | trim, ≤ 255 ký tự |
| `email` | ✔ | `isValidEmail` (shared), ≤ 255, lưu chữ thường |
| `position` | ✔ | `code` của 1 job đang `OPEN` (PQ4) |
| `cv` | ✔ | PDF thật (đuôi `.pdf` **và** nội dung bắt đầu bằng `%PDF-`), ≤ 10MB (`CV_MAX_FILE_SIZE_BYTES`) |

- Thành công → **201** `{ "message": "Submit CV successfully" }`.
- Lỗi → mã lỗi + `{ "statusCode", "message", "error" }` (định dạng mặc định của NestJS). Form hiện đã đọc `message` khi lỗi; ở bước 1.4 form sẽ đổi từ kiểm tra `success` sang kiểm tra `res.ok`.

### Luồng xử lý

1. Multer nhận file và **dừng ngay khi vượt 10MB**, không đọc hết file vào RAM.
2. Kiểm tra field. Job phải tồn tại và đang `OPEN` — kiểm tra **trước** khi upload để không tạo file thừa trên Drive.
3. Upload CV qua `CvStorage` → nhận `fileId` + `url`.
4. Ghi `applications` + `application_status_history` (`NULL → SUBMITTED`, `changed_by_id = NULL`) trong 1 câu lệnh.
5. Nếu bước 4 lỗi → xoá file vừa upload (best effort, có ghi log) rồi trả lỗi.

---

## Acceptance Criteria

### AC-1: Nộp đơn hợp lệ

**Then:**
- Trả 201.
- Có 1 dòng `applications`:
  - `status = SUBMITTED`, email chữ thường;
  - `cv_file_name` = tên file gốc;
  - `cv_drive_file_id` + `cv_drive_url` của file vừa upload.
- Có 1 dòng lịch sử `NULL → SUBMITTED`.
- Cùng 1 email nộp nhiều lần → nhiều đơn (D1).

### AC-2: Validation — cùng thông báo với form (`APPLICATION_MESSAGES` trong `@org/shared`)

| Trường hợp | HTTP | `message` |
|------------|------|-----------|
| Thiếu `name` | 400 | `Name is required` |
| `name` > 255 ký tự | 400 | `Name must not exceed 255 characters` |
| Thiếu `email` | 400 | `Email is required` |
| Email sai định dạng (hoặc > 255 ký tự) | 400 | `Invalid email address` |
| Thiếu `position` | 400 | `Please select a position` |
| Thiếu `cv` | 400 | `Please upload your CV` |
| Không phải PDF (theo đuôi hoặc nội dung) | 400 | `Only PDF files are accepted` |
| File > 10MB | **413** | `File size must not exceed 10MB` |

Field gửi lặp (`name=a&name=b`) bị coi là thiếu.

### AC-3: Job không nhận đơn

- `position` không tồn tại hoặc không ở trạng thái `OPEN` → **400** `This position is not accepting applications`. Không upload, không lưu đơn.

### AC-4: Lỗi lưu trữ

- Upload thất bại → **503** `Failed to upload CV. Please try again.` Không lưu đơn.
- Lưu DB thất bại sau khi đã upload → xoá file vừa upload, trả 500. Không để lại file mồ côi trên Drive.

### AC-5: Chọn nơi lưu bằng cấu hình

- `CV_STORAGE=local` → file lưu vào `CV_LOCAL_DIR`; `cv_drive_file_id` / `cv_drive_url` là giá trị local (chỉ dùng khi dev).
- `CV_STORAGE=google-drive` → upload vào thư mục `cv-ai-scanner/cv/`.
- Thiếu biến môi trường bắt buộc → backend báo lỗi rõ ràng **ngay khi khởi động**, không đợi tới lúc có người nộp đơn.

---

## Google Drive (OAuth tài khoản thường)

Thiết lập một lần — hướng dẫn chi tiết: [google-drive-setup.md](./google-drive-setup.md):
1. Google Cloud Console: tạo project, bật **Google Drive API**, cấu hình OAuth consent screen (External), tạo OAuth client.
2. Chạy script `drive:auth` → mở trình duyệt, đăng nhập tài khoản Google sẽ chứa CV → script in ra `GOOGLE_REFRESH_TOKEN` và `GOOGLE_DRIVE_CV_FOLDER_ID`.
3. Điền vào `.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_DRIVE_CV_FOLDER_ID`.
4. Chia sẻ thư mục `cv-ai-scanner/cv/` cho HR (Q11: HR xem CV bằng link Drive).

> **Lưu ý về refresh token:** app OAuth ở trạng thái *Testing* thì refresh token **hết hạn sau 7 ngày**. Để token không hết hạn, phải chuyển app sang *In production*. Với scope không nhạy cảm như `drive.file` thì Google không yêu cầu xác minh app. Xem câu hỏi AQ1.

### Ảnh hưởng tới Phase 2

n8n cũng phải tải được CV. Nếu dùng scope `drive.file`, chỉ OAuth client **đã tạo ra file** mới đọc được file đó. Vì vậy n8n phải dùng chung OAuth client này (credential "Google OAuth2 API" + node HTTP Request), thay vì credential Google Drive có sẵn của n8n.

---

## Quyết định (2026-11-04)

| # | Câu hỏi | Đã chốt |
|---|---------|---------|
| AQ0 | Cách xác thực Google Drive | OAuth của **tài khoản Google thường**; CV nằm ở `cv-ai-scanner/cv/` |
| AQ1 | Scope OAuth | `drive.file` — app tự tạo thư mục `cv-ai-scanner/cv/` và chỉ thấy file nó tạo ra |
| AQ2 | Đã có OAuth client chưa? | Chưa → làm trước với `CV_STORAGE=local`, gắn Drive khi có credentials |
| AQ3 | Tên file trên Drive | `<YYYYMMDD-HHmmss>_<mã job>_<họ-tên>_<8 ký tự đầu id đơn>.pdf` (giờ Việt Nam) |
| AQ4 | Có tách thư mục con theo job không? | Không — để chung trong `cv/`; tên file đã có mã job |
