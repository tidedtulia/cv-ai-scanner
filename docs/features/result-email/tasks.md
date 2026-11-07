# Tasks: Email kết quả cho ứng viên

Feature branch: `feature/result-email` (tách từ `feature/hr-positions`; merge sau các PR trước)
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Phân tích & scenario

- [x] Chốt EQ1 (Gmail), EQ2 (lưu ngôn ngữ lúc nộp), EQ3 (gửi ngay khi xác nhận), EQ4 (nội dung không có điểm), EQ5 (địa chỉ gửi / trả lời) (2026-11-07)
- [x] Scenario AC-1 → AC-14 trong [requirements.md](./requirements.md)
- [x] Bạn review scenario (2026-11-07)
- [x] Bạn tạo Gmail **App Password** và điền `SMTP_*`, `MAIL_FROM` vào `.env`

## Làm

- [x] Prisma: cột `applications.locale` (`VARCHAR(5) NOT NULL DEFAULT 'vi'` + CHECK) — migration `20261107120000_application_locale`. Quyền DB của n8n không đổi (`SELECT` cả bảng)
- [x] Shared: field `locale` của form, `APPLICATION_LOCALES` / `normalizeApplicationLocale`, `HR_DECIDED_STATUSES`, mã lỗi `EMAIL_ALREADY_SENT` / `EMAIL_SEND_FAILED`, type `IHrDecisionResponse`, `IHrEmailPreview`, `locale` / `resultEmailSentAt` / `canResendEmail` (chi tiết), `emailPending` (danh sách)
- [x] Backend: `nodemailer` 7; module `mail` (`mail.config.ts`, `mail-templates.ts`, `mail.service.ts`); `POST /api/applications` nhận `locale`; `hr-applications`: `email-preview`, gửi sau khi quyết định (lưu → giữ chỗ → gửi → trả chỗ nếu lỗi), `resend-email`, `canResendEmail` / `emailPending`
- [x] Frontend: form nộp CV gửi `locale`; `EmailPreview` + hộp thoại quyết định (thông báo gửi email, kết quả thành công / cảnh báo); `ResultEmailStatus` (trạng thái, Gửi lại); nhãn "Chưa gửi email" ở danh sách; từ điển vi / en
- [x] `scripts/mail/mail-check.mjs` + `npm run mail:check`
- [x] Test theo bảng "Kiểm thử"
- [x] Docs: project-overview (D35, lộ trình Phase 4), database.md, `.env.example`, CLAUDE.md

## Điều chỉnh khi làm

- AC-3: nút **Gửi lại** (AC-11) cần bản xem trước của đơn đã quyết định, nên xem trước cho phép thêm trường hợp đơn đã `ACCEPTED` / `REJECTED` **với đúng quyết định đó**; quyết định kia vẫn 409. Đã sửa trong requirements.
- Nhãn ô ghi chú đổi thành "…chỉ HR thấy, không gửi trong email" (AC-9).

## Kiểm chứng (2026-11-07)

- [x] Test: backend 344/344 (35 suite; mới: `mail` 20 gồm máy chủ SMTP giả trên cổng cục bộ, `hr-applications.email` 36), frontend 297/297 (30 suite; mới: `hr-email` 13, thêm vào `hr-decision`, `submit-cv`, danh sách, chi tiết), shared 20/20. Type-check code + test sạch; lint không có lỗi mới (chỉ lỗi `enforce-module-boundaries` có sẵn); `next build --webpack` sạch
- [x] Thử làm hỏng code để chắc test bắt lỗi (đều có test đỏ, đã khôi phục): bỏ `locale` khỏi form, đảo màu cảnh báo, mất câu "Email đã được gửi trước đó", bỏ chặn gửi trùng, không trả chỗ khi gửi lỗi
- [x] `npm run mail:check`: thiếu cấu hình → nêu `SMTP_HOST, MAIL_FROM`, exit 1 (AC-14); thật qua Gmail → kết nối + đăng nhập + 1 email thử tới `trantrieu491@gmail.com` (AC-14)
- [x] Chạy thật: bản build production của Next.js (cổng 3010) → backend build (3001, `CV_STORAGE=local`, `MAIL_REDIRECT_TO` đặt → mọi email chỉ về hộp thư của bạn) → DB dev + Gmail thật; 4 đơn tạm `mail-probe-*` (đã xoá, đơn thật còn nguyên):
  - AC-1: nộp với `locale` en / vi / fr / không có → 201; lưu en / vi / vi / vi
  - AC-3: xem trước EN accepted / VI rejected đúng ngôn ngữ, người nhận là ứng viên, không điểm; không đổi dữ liệu; `decision` sai → 400; đơn `SUBMITTED` → 409
  - AC-4: chốt Nhận (EN) và Từ chối (VI) → 200, `emailSent: true`, `resultEmailSentAt` có giá trị; **2 email thật** về hộp thư redirect
  - AC-4 (SMTP hỏng, cổng 1, timeout 15 giây): quyết định vẫn lưu, `emailSent: false`, `result_email_sent_at` NULL, lịch sử ghi đúng 1 dòng; log chỉ có `ETIMEDOUT CONN`, không có mật khẩu (đã tìm trong cả 4 file log)
  - AC-5: gửi lại khi SMTP vẫn hỏng → 502 `EMAIL_SEND_FAILED`, NULL giữ nguyên; khi SMTP trở lại → 200; gửi lại lần nữa → 409 `EMAIL_ALREADY_SENT`; gửi lại trước khi có quyết định → 409 `STATUS_NOT_ALLOWED`; **hai lần bấm cùng lúc → 200 và 409**, chỉ một email
  - AC-7, AC-11, AC-12: danh sách `emailPending` đúng (2 chưa gửi, 2 đã gửi); `/hr` hiện 2 nhãn "Chưa gửi email"; trang chi tiết hiện "Chưa gửi được email" + Gửi lại, sau khi gửi hiện "Đã gửi lúc dd/MM/yyyy HH:mm (giờ Việt Nam)"; đơn `EVALUATED` không có mục email
  - Tổng cộng 4 email thật đã gửi về hộp thư của bạn (EN accepted, VI rejected, gửi lại, một trong cặp bấm đồng thời)
- [ ] Bạn mở hộp thư `trantrieu491@gmail.com` (cả thư rác) xem 4 email thử có hiển thị đúng; thử trên trình duyệt: hộp thoại Nhận / Từ chối có xem trước, nút Gửi lại (cần `npm run dev` chạy lại)

## Còn lại

- [ ] Khi deploy (Phase 5): chuyển từ Gmail cá nhân sang dịch vụ gửi mail có xác thực tên miền (SPF / DKIM) để email không vào thư rác; đặt biến `SMTP_*` / `MAIL_FROM` trên môi trường chạy thật và **không** đặt `MAIL_REDIRECT_TO`
- [ ] Quyết định đã chốt thì không sửa được (RQ1); email gửi nhầm không có đường rút lại — cân nhắc nếu thực tế cần
