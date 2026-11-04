# Tasks: API nộp đơn + upload CV lên Google Drive

Feature branch: `feature/submit-application-api`
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md) · Thiết lập Drive: [google-drive-setup.md](./google-drive-setup.md)

---

## Shared (`@org/shared`)

- [x] `constants/application.constants.ts`: `APPLICATION_FORM_FIELDS`, `APPLICATION_MESSAGES` (dùng chung FE / BE), `APPLICATION_TEXT_MAX_LENGTH`
- [x] `API_ROUTES.APPLICATIONS`

## Backend — module `applications`

- [x] `POST /api/applications` (multipart): field `name`, `email`, `position`, `cv` — giữ đúng tên field form đang gửi
  - Multer: memory storage, dừng ngay khi file > 10MB; `defParamCharset: 'utf8'` để tên file tiếng Việt không bị lỗi font
  - `CvTooLargeFilter`: giữ mã 413 nhưng trả đúng thông báo của form
- [x] Service: validate → kiểm tra job `OPEN` → upload → lưu đơn + lịch sử; DB lỗi thì xoá file vừa upload
  - PDF thật: đuôi `.pdf` **và** nội dung bắt đầu bằng `%PDF-`
  - Id đơn sinh trước (`randomUUID`) để dùng chung cho tên file và dòng `applications`
- [x] Repository: `findOpenPosition` (so mã không phân biệt hoa thường), `create` (đơn + lịch sử `NULL → SUBMITTED` trong 1 câu lệnh)
- [x] `cv-file-name.ts`: `<YYYYMMDD-HHmmss giờ VN>_<mã job>_<họ-tên không dấu>_<8 ký tự id>.pdf`
- [x] Lưu trữ qua `CvStorage`, chọn bằng `CV_STORAGE` (sai cấu hình → lỗi ngay khi khởi động):
  - `LocalCvStorage` (`CV_LOCAL_DIR`, mặc định `tmp/cv-uploads`; không ghi đè file, không cho path traversal)
  - `GoogleDriveCvStorage` + `google-drive.client.ts`: REST qua `fetch` (không thêm dependency), upload kiểu resumable (CV có thể > 5MB), tự làm mới access token
- [x] Script `npm run drive:auth`: lấy refresh token (scope `drive.file`) + tạo thư mục `cv-ai-scanner/cv`
- [x] `.env.example`: `CV_STORAGE`, `CV_LOCAL_DIR`, `GOOGLE_*`; `.env` local: `CV_STORAGE=local`
- [x] GitNexus impact `AppModule`, `API_ROUTES`: LOW

## Tests

- [x] 8 file test mới (42 test): service (validation, AC-3, AC-4, xoá file mồ côi), repository, controller, tên file, local storage, Google Drive client (mock `fetch`), token cache, chọn storage theo env
- [x] Backend 78/78 pass; `tsc -b` + `nx build` sạch; type-check script `drive-auth.ts`
- [x] Kiểm tra trên DB thật với `CV_STORAGE=local` (dữ liệu test đã xoá):
  - AC-1: 201; tên + tên file tiếng Việt đúng; email chữ thường; lịch sử `NULL → SUBMITTED`; cùng email nộp 2 lần → 2 đơn
  - AC-2: đủ 7 trường hợp lỗi với đúng thông báo; file text đổi đuôi `.pdf` bị chặn; 11MB → 413
  - AC-3: job không tồn tại / `CLOSED` → 400, không upload, không lưu
  - Chỉ đơn hợp lệ có file trên đĩa; `cv_drive_file_id` khớp file
  - AC-5: thiếu `CV_STORAGE` hoặc thiếu biến Google → backend dừng khi khởi động, nêu rõ biến thiếu
- [ ] **Google Drive thật:** chạy khi có OAuth client — làm theo [google-drive-setup.md](./google-drive-setup.md), rồi nộp thử 1 CV

## Ghi nhận (ngoài phạm vi)

- Chống spam / rate limit cho endpoint công khai
- Checkbox đồng ý xử lý dữ liệu (Q7)
- Frontend gọi API thật, đổi từ kiểm tra `success` sang `res.ok`, chỉ nhận PDF (bước 1.4)
