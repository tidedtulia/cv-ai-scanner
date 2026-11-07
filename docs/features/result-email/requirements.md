# Feature: Email kết quả cho ứng viên (Phase 4)

## Mục tiêu

Khi HR chốt **Nhận** hoặc **Từ chối** một đơn, backend **tự gửi email** báo kết quả cho ứng viên, bằng đúng ngôn ngữ ứng viên đã dùng khi nộp đơn. HR xem trước nội dung email (chỉ đọc) ngay trong hộp thoại xác nhận; nếu gửi lỗi thì quyết định vẫn được lưu và HR bấm **Gửi lại**.

Bối cảnh: [project-overview.md §8.4](../../project-overview.md#84-email-kết-quả-backend) (D5, D16, D18, D33) · Chốt quyết định: [hr-applications](../hr-applications/requirements.md) (RQ1) · Quyền riêng tư: `/privacy` ([fe-public-pages](../fe-public-pages/requirements.md), D24)

---

## Phạm vi

- **Database:** thêm cột `applications.locale` (`vi` | `en`, mặc định `vi`); cột `result_email_sent_at` đã có.
- **Backend:**
  - module `mail`: gửi qua SMTP (nodemailer), 4 mẫu (ACCEPTED / REJECTED × vi / en) viết trong code;
  - `GET /api/hr/applications/:id/email-preview?decision=ACCEPTED|REJECTED`;
  - `POST /api/hr/applications/:id/decision` gửi email sau khi lưu quyết định;
  - `POST /api/hr/applications/:id/resend-email`;
  - `POST /api/applications` nhận thêm field `locale`.
- **Frontend:** form nộp CV gửi `locale`; hộp thoại Nhận / Từ chối có bản xem trước email; trang chi tiết đơn hiện trạng thái email + nút **Gửi lại**; danh sách đơn đánh dấu đơn chưa gửi được email.
- **Công cụ:** `npm run mail:check` kiểm tra cấu hình SMTP thật.
- **Không làm:** HR sửa nội dung email; email khác (nhắc lịch phỏng vấn, đánh giá lại…); tuỳ chọn gửi theo lô / hẹn giờ; theo dõi email có được mở / bị trả lại (bounce); đính kèm file.

### Biến môi trường mới (`.env` gốc)

| Biến | Bắt buộc | Dùng cho |
|------|----------|----------|
| `SMTP_HOST`, `SMTP_PORT` | Có (để gửi được) | Máy chủ SMTP; Gmail: `smtp.gmail.com` / `465` |
| `SMTP_SECURE` | Không | `true` = TLS ngay từ đầu (cổng 465, mặc định khi cổng là 465); `false` = STARTTLS (cổng 587) |
| `SMTP_USER`, `SMTP_PASSWORD` | Có (với Gmail) | Tài khoản gửi; Gmail dùng **App Password** (cần bật xác minh 2 bước), không dùng mật khẩu thường |
| `MAIL_FROM` | Có | Người gửi, vd `CV AI Scanner <hr@gmail.com>`; với Gmail địa chỉ phải là chính tài khoản `SMTP_USER` |
| `MAIL_REPLY_TO` | Không | Địa chỉ HR nhận thư trả lời của ứng viên (mặc định = địa chỉ trong `MAIL_FROM`) |
| `MAIL_REDIRECT_TO` | Không | **An toàn khi dev / thử:** đặt thì **mọi email** gửi tới địa chỉ này thay vì ứng viên thật (tiêu đề có tiền tố cho biết người nhận thật) |
| `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` | Không | Địa chỉ ghi ở cuối email cho yêu cầu về dữ liệu (đã dùng ở `/privacy`; mặc định `trantrieu491@gmail.com`) |

---

## Acceptance Criteria

Mỗi AC là một scenario. Mọi API HR yêu cầu đăng nhập (401) và chỉ nhận JSON khi ghi (415), như [hr-auth](../hr-auth/requirements.md).

### Ngôn ngữ của ứng viên

#### AC-1: Lưu ngôn ngữ lúc nộp đơn

**Given:** ứng viên đang xem trang `/submit-cv` bằng tiếng Anh (hoặc tiếng Việt)
**When:** nộp đơn
**Then:**
- Form gửi thêm field `locale` = `en` (hoặc `vi`) cùng các field cũ; backend lưu vào `applications.locale`.
- `locale` thiếu hoặc không phải `vi` / `en` → lưu `vi`, đơn vẫn được nhận (không lỗi).
- Đơn đã có trước tính năng này có `locale = 'vi'`.
- Test của form nộp CV hiện có vẫn pass; `locale` không ảnh hưởng validation.

### Mẫu email

#### AC-2: Bốn mẫu email

**Then:** mỗi mẫu có `subject`, bản HTML và bản chữ thuần, theo bảng (ví dụ ứng viên "Nguyễn Văn An", job "Backend Developer"):

| Mẫu | Tiêu đề | Nội dung chính |
|-----|---------|----------------|
| ACCEPTED · vi | `Kết quả ứng tuyển: Backend Developer` | Chào Nguyễn Văn An · cảm ơn đã ứng tuyển · **chúng tôi vui mừng thông báo bạn được nhận vào vị trí Backend Developer** · bộ phận tuyển dụng sẽ liên hệ qua email này để trao đổi bước tiếp theo |
| REJECTED · vi | `Kết quả ứng tuyển: Backend Developer` | Chào … · cảm ơn đã dành thời gian · sau khi xem xét, **lần này chúng tôi chưa thể tiếp tục với hồ sơ của bạn** cho vị trí … · chúc may mắn, hoan nghênh ứng tuyển các vị trí khác trên website |
| ACCEPTED · en | `Your application: Backend Developer` | Hello … · thank you · **we are pleased to let you know you have been accepted** for … · our recruiting team will contact you at this address with the next steps |
| REJECTED · en | `Your application: Backend Developer` | Hello … · thank you for your time · **we will not be moving forward with your application** for … this time · best wishes; you are welcome to apply for other roles |

- Mọi mẫu **không** chứa điểm AI, khuyến nghị, lý do của AI, ghi chú nội bộ của HR, hay tên HR.
- Cuối mỗi email có dòng về dữ liệu cá nhân: yêu cầu xem / xoá dữ liệu gửi tới `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`; và dòng "email này được gửi tự động…" (vi / en).
- Tên ứng viên và tên job được **escape HTML** trong bản HTML (vd `<b>` hay `&` không phá bố cục hay chèn nội dung); xuống dòng trong tên bị bỏ (chống chèn header email).
- Cùng đầu vào cho cùng một nội dung (hàm thuần, không phụ thuộc giờ hệ thống).

#### AC-3: Xem trước email

**When:** `GET /api/hr/applications/:id/email-preview?decision=ACCEPTED` (hoặc `REJECTED`)
**Then:**
- 200 `{ locale, to, subject, text, html }`: nội dung đúng mẫu của **ngôn ngữ của đơn**, với tên và job của đơn đó; `to` là email của ứng viên (kể cả khi `MAIL_REDIRECT_TO` đang bật — HR luôn thấy người nhận thật).
- Không gửi gì, không đổi dữ liệu. Đơn đang ở `EVALUATED` / `EVALUATION_FAILED`: xem trước được cả hai quyết định. Đơn đã `ACCEPTED` / `REJECTED`: chỉ xem trước được email của **chính quyết định đó** (cho hộp thoại **Gửi lại**, AC-11). Còn lại → 409 `STATUS_NOT_ALLOWED`.
- `decision` thiếu / sai → 400 `DECISION_INVALID`; không có đơn → 404 `APPLICATION_NOT_FOUND`.

### Gửi email khi chốt kết quả

#### AC-4: Quyết định + gửi email

**Given:** đơn ở `EVALUATED` hoặc `EVALUATION_FAILED`, SMTP chạy đúng
**When:** `POST /api/hr/applications/:id/decision` ([hr-applications AC-6](../hr-applications/requirements.md))
**Then:**
- Thứ tự: (1) lưu quyết định + lịch sử trong 1 transaction (như cũ); (2) gửi email; (3) đặt `result_email_sent_at = now()`.
- Email đúng mẫu theo AC-2, gửi tới email ứng viên (hoặc `MAIL_REDIRECT_TO`), có `Reply-To`.
- Trả 200 chi tiết đơn (như cũ) kèm `emailSent: true`; `resultEmailSentAt` có giá trị.

**Given:** SMTP lỗi (sai mật khẩu, mất mạng, hết hạn mức, chưa cấu hình, quá 15 giây)
**Then:**
- **Quyết định vẫn được lưu** (đơn đã `ACCEPTED` / `REJECTED`, lịch sử đủ).
- `result_email_sent_at` vẫn `NULL`; API trả 200 kèm `emailSent: false`.
- Lỗi được ghi log (loại lỗi, **không** có mật khẩu hay nội dung email) để dev tìm nguyên nhân; HR chỉ thấy thông báo chung (AC-10).

#### AC-5: Gửi lại email

**Given:** đơn `ACCEPTED` / `REJECTED` có `result_email_sent_at = NULL`
**When:** `POST /api/hr/applications/:id/resend-email`
**Then:**
- Gửi email của quyết định hiện tại (đọc từ trạng thái đơn, không nhận nội dung từ client); thành công → `result_email_sent_at = now()`, 200 chi tiết đơn, `emailSent: true`.
- Gửi lỗi → 502 `EMAIL_SEND_FAILED`, `result_email_sent_at` vẫn `NULL` (bấm lại được).

| Trường hợp | Kết quả |
|------------|---------|
| Đã gửi rồi (`result_email_sent_at` có giá trị) | 409 `EMAIL_ALREADY_SENT`, không gửi gì |
| Đơn chưa có quyết định (`SUBMITTED`, `EVALUATING`, `EVALUATED`, `EVALUATION_FAILED`) | 409 `STATUS_NOT_ALLOWED` |
| Không có đơn | 404 `APPLICATION_NOT_FOUND` |
| HR bấm 2 lần cùng lúc | chỉ **một email** được gửi; lần kia nhận 409 `EMAIL_ALREADY_SENT` (cập nhật có điều kiện `result_email_sent_at IS NULL` làm "chỗ giữ" trước khi gửi, trả về `NULL` nếu gửi lỗi) |

#### AC-6: Cấu hình SMTP và chế độ an toàn

**Then:**
- Cổng 465 mặc định `SMTP_SECURE=true`, cổng khác mặc định STARTTLS; timeout kết nối và gửi **15 giây**.
- Thiếu `SMTP_HOST` hoặc `MAIL_FROM`: backend **vẫn khởi động** (để người chỉ làm FE / n8n không bị chặn), ghi 1 dòng cảnh báo "email is not configured"; mọi lần gửi lỗi như AC-4 / AC-5 (`emailSent: false`, `EMAIL_SEND_FAILED`).
- `MAIL_REDIRECT_TO` có giá trị: **mọi** email (kể cả gửi lại) đi tới địa chỉ này; tiêu đề thêm tiền tố `[gửi tới ứng viên: an@example.com] `; `Reply-To` không đổi. Backend ghi log khi chế độ này đang bật.
- `result_email_sent_at` vẫn được đặt khi email đi vào hộp thư `MAIL_REDIRECT_TO` (vì đã gửi thành công).

### Dữ liệu cho giao diện HR

#### AC-7: Trạng thái email trong API

**Then:**
- Chi tiết đơn (`GET /api/hr/applications/:id`) có thêm: `locale`, `resultEmailSentAt` (ISO hoặc `null`), `canResendEmail` (= đơn `ACCEPTED` / `REJECTED` và `resultEmailSentAt = null`).
- Mỗi dòng của danh sách có `emailPending` (= `ACCEPTED` / `REJECTED` và chưa gửi email).
- Các API khác của 3.2 không đổi hành vi; `re-evaluate` **không** gửi email.

#### AC-8: Bảo mật

**Then:**
- Mọi route mới cần đăng nhập HR; ghi chỉ nhận JSON; ứng viên không có cách nào kích hoạt email.
- Nội dung email chỉ được tạo từ dữ liệu của đơn (tên, job, ngôn ngữ, quyết định); client không gửi được tiêu đề, nội dung hay người nhận.
- Mật khẩu SMTP không xuất hiện trong log, response hay file nào của repo.

### Frontend

#### AC-9: Hộp thoại có bản xem trước

**Given:** HR bấm **Nhận** hoặc **Từ chối** ở trang chi tiết đơn
**Then:** hộp thoại ([hr-applications AC-16](../hr-applications/requirements.md)) hiện thêm:
- Khối **Xem trước email** (chỉ đọc): ngôn ngữ của ứng viên ("Tiếng Việt" / "English"), người nhận (email ứng viên), tiêu đề, nội dung chữ thuần giữ xuống dòng.
- Dòng "Xác nhận sẽ lưu quyết định và gửi email này tới {email}." (thay cho chỉ "Quyết định này không sửa được.", vẫn giữ câu đó).
- Đang tải xem trước: "Đang tải bản xem trước…" (nút Xác nhận vẫn bấm được); tải lỗi: "Không tải được bản xem trước." — HR vẫn xác nhận được.
- Ô ghi chú chỉ HR thấy, ghi rõ **không** nằm trong email.
- **Đánh giá lại** không có bản xem trước (không gửi email).

#### AC-10: Kết quả sau khi xác nhận

**Then:**
- Email gửi được (`emailSent: true`): thông báo "Đã lưu quyết định và gửi email cho ứng viên."
- Email lỗi (`emailSent: false`): thông báo cảnh báo "Đã lưu quyết định nhưng chưa gửi được email. Bạn có thể bấm Gửi lại." (không báo lỗi đỏ vì quyết định đã lưu).
- Trang cập nhật như cũ (nhãn trạng thái, lịch sử); 409 giữ nguyên xử lý của 3.2.

#### AC-11: Trạng thái email và nút Gửi lại ở trang chi tiết

**Given:** đơn `ACCEPTED` / `REJECTED`
**Then:**
- Mục **Email kết quả**: đã gửi → "Đã gửi lúc dd/MM/yyyy HH:mm (giờ Việt Nam)"; chưa gửi → "Chưa gửi được email" kèm nút **Gửi lại**.
- **Gửi lại** hiện hộp thoại xác nhận có bản xem trước (như AC-9); thành công → "Đã gửi email cho ứng viên." và mục chuyển sang "Đã gửi lúc …"; lỗi → "Chưa gửi được email. Vui lòng thử lại." (hộp thoại giữ nguyên, bấm lại được); 409 `EMAIL_ALREADY_SENT` → "Email đã được gửi trước đó." và tải lại trang.
- Đơn chưa có quyết định: không có mục này.

#### AC-12: Danh sách đánh dấu đơn chưa gửi email

**Then:** dòng của đơn `ACCEPTED` / `REJECTED` chưa gửi email có nhãn nhỏ "Chưa gửi email" cạnh trạng thái (tab **Đã quyết định** và **Tất cả**); đơn đã gửi thì không có nhãn.

#### AC-13: Song ngữ

**Then:** mọi nhãn, thông báo, hộp thoại mới có cả vi / en; ngày `dd/MM/yyyy HH:mm` giờ Việt Nam; hộp thoại đúng vai trò `dialog`, focus và Esc như các hộp thoại khác.

### Công cụ

#### AC-14: `npm run mail:check`

**When:** chạy `npm run mail:check [địa-chỉ-nhận]`
**Then:**
- Kiểm tra kết nối + đăng nhập SMTP (`verify`), rồi gửi **1 email thử** tới địa chỉ truyền vào, hoặc `MAIL_REDIRECT_TO`, hoặc chính `SMTP_USER`; in ✓ / ✗ từng bước, không in mật khẩu.
- Thiếu cấu hình → nêu **đúng tên biến thiếu**, exit ≠ 0; lỗi đăng nhập → gợi ý "Gmail cần App Password" ; không gửi email cho ứng viên thật nào.

---

## Kiểm thử

Theo [CLAUDE.md — Feature workflow](../../../CLAUDE.md): Gherkin + unit cho frontend, Jest unit + HTTP spec cho backend; mỗi test ghi mã AC.

| AC | Test |
|----|------|
| AC-1 | backend `applications.service.spec.ts`, `applications.http.spec.ts` (`locale` hợp lệ / thiếu / lạ) · frontend `submit-cv.feature` (form gửi `locale` theo ngôn ngữ) |
| AC-2 | backend `mail/templates.spec.ts` (4 mẫu: tiêu đề, nội dung chính, không có điểm / ghi chú, escape HTML, xuống dòng trong tên, footer) |
| AC-3, AC-7 | `hr-applications.service.spec.ts` (preview, `canResendEmail`, `emailPending`) · `hr-applications.http.spec.ts` |
| AC-4, AC-5 | `hr-applications.service.spec.ts` (thứ tự lưu → gửi → đánh dấu; gửi lỗi vẫn giữ quyết định; gửi lại; 409; cạnh tranh) · `hr-applications.repository.spec.ts` (giữ chỗ có điều kiện, trả về NULL) |
| AC-6 | `mail/mail.service.spec.ts` (cấu hình, cổng 465, redirect, tiền tố tiêu đề, thiếu cấu hình) · `mail/smtp.spec.ts` (máy chủ SMTP giả trên cổng cục bộ: thư thật đi qua nodemailer, header, Reply-To, redirect) |
| AC-8 | `hr-applications.http.spec.ts` (401, 415, không nhận nội dung từ client) + quét log |
| AC-9 → AC-13 | frontend `src/components/hr/__tests__/hr-decision.feature` (xem trước, kết quả), `hr-email.feature` (trạng thái, gửi lại), `hr-applications-list.feature` (nhãn), `hr-application-detail.feature`, `dictionaries.spec.ts` |
| AC-14 | `scripts/mail/mail-check.mjs` chạy thật + test cấu hình thiếu |
| Chạy thật | [tasks.md](./tasks.md): migration trên DB dev; nộp đơn từ form tiếng Anh và tiếng Việt; chốt Nhận / Từ chối → email vào hộp thư thử (`MAIL_REDIRECT_TO`) đúng ngôn ngữ; ngắt SMTP → `emailSent: false` → Gửi lại thành công; bấm 2 lần cùng lúc chỉ 1 email; nếu bạn đã điền Gmail App Password: gửi thật qua Gmail |

---

## Quyết định (2026-11-07)

| # | Câu hỏi | Đã chốt |
|---|---------|---------|
| EQ1 | Dịch vụ gửi | **Gmail** (SMTP + App Password) ngay từ đầu; backend chỉ biết SMTP nên đổi nhà cung cấp là đổi biến môi trường |
| EQ2 | Ngôn ngữ email | **Lưu ngôn ngữ lúc nộp** (`applications.locale`), gửi đúng ngôn ngữ; đơn cũ là `vi` |
| EQ3 | Thời điểm gửi | **Ngay khi HR xác nhận** (D16); lỗi thì giữ quyết định + nút Gửi lại |
| EQ4 | Nội dung | Lời chào + kết quả + bước tiếp, **không điểm AI, không lý do, không ghi chú nội bộ**; Reply-To là hộp thư HR |
| EQ5 | Địa chỉ gửi / trả lời | Dùng chính `trantrieu491@gmail.com` cho cả ba vai trò: `SMTP_USER`, `MAIL_FROM` (người gửi), Reply-To (mặc định = `MAIL_FROM`) và địa chỉ yêu cầu dữ liệu ở chân email (`NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`) |
| — | Bảo vệ khi thử | Biến `MAIL_REDIRECT_TO` đưa mọi email về một hộp thư thử, để test không bao giờ gửi cho ứng viên thật |
| — | Chống gửi trùng | Giữ chỗ bằng cập nhật có điều kiện `result_email_sent_at IS NULL` trước khi gửi, trả về `NULL` nếu lỗi |
| — | Mẫu email | Viết trong code (hàm thuần), không có UI sửa (D18) |

### Ghi chú kỹ thuật

- **Dependency mới:** `nodemailer` (+ `@types/nodemailer`); chạy `npm audit` trước / sau như các lần trước.
- **Migration:** thêm cột `locale varchar(5) NOT NULL DEFAULT 'vi'` kèm `CHECK (locale IN ('vi','en'))` (viết tay trong migration như các ràng buộc khác). Quyền DB của n8n không đổi (`n8n_app` đã `SELECT` cả bảng, chỉ `UPDATE (status, updated_at)`).
- **Gmail:** địa chỉ `MAIL_FROM` phải là tài khoản `SMTP_USER` (hoặc alias đã xác minh), nếu không Gmail ghi đè; hạn mức khoảng 500 email mỗi ngày — dư cho quy mô này; email thư mới từ một tài khoản Gmail cá nhân có thể vào hộp thư rác của người nhận (chuyển sang dịch vụ có xác thực tên miền khi chạy thật — Phase 5).
- **Chờ SMTP trong request:** tối đa 15 giây; chấp nhận cho MVP vì HR chốt từng đơn một.
