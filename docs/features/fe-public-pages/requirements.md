# Feature: Trang công khai cho ứng viên (Phase 1 — bước 1.4)

## Mục tiêu

Hoàn thiện phía ứng viên trên dữ liệu và API thật, **song ngữ vi / en**:
- `/` — giới thiệu dự án.
- `/jobs` — danh sách job đang tuyển.
- `/submit-cv` — form ứng tuyển gọi API thật thay cho mock, chỉ nhận PDF, có bước đồng ý xử lý dữ liệu.
- `/privacy` — chính sách quyền riêng tư.

Bối cảnh: [project-overview.md §8.1](../../project-overview.md#81-trang-công-khai-ứng-viên) (D8, D9, D10, D20–D24) · API dùng: [public-jobs-api](../public-jobs-api/), [submit-application-api](../submit-application-api/) · Trang trước đây: [submit-cv](../submit-cv/)

---

## Phạm vi

- 4 trang trên + header (tên dự án, Trang chủ / Việc làm, nút đổi ngôn ngữ VI | EN) + footer (ghi chú AI, link `/privacy`).
- Song ngữ cho **giao diện**; nội dung job (tiêu đề, JD, tiêu chí, tên nhóm / level) hiển thị đúng như HR nhập (IQ3).
- Bỏ dữ liệu hardcode `src/data/positions.ts`, API mock `src/app/api/submit-cv`, route mẫu `src/app/api/hello`, trang chào mặc định của Nx.
- Dùng hằng số chung trong `@org/shared` (`APPLICATION_FORM_FIELDS`, `APPLICATION_MESSAGES`, `API_ROUTES`) và type `IPublicPositionSummary` / `IPublicPositionDetail`.
- **Backend (API nộp đơn của bước 1.3) đổi theo:** bắt buộc field `consent`; lỗi trả thêm `code` để form dịch đúng ngôn ngữ.
- **Không làm:** trang HR (Phase 3), deploy (Phase 5), job tự xoá CV sau 12 tháng (Q7).

---

## Acceptance Criteria

Mỗi AC là một scenario. Ví dụ dùng giao diện tiếng Việt; tiếng Anh tương ứng trong `src/i18n/dictionaries/en.ts`.

### Trang chủ `/`

#### AC-1: Giới thiệu dự án

**Given:** ứng viên mở trang chủ
**Then:**
- Thấy tiêu đề "Tìm công việc phù hợp và ứng tuyển chỉ trong vài phút" và một câu giới thiệu.
- Có nút **Xem việc làm đang tuyển** dẫn tới `/jobs`.
- Mục **Cách ứng tuyển** có đúng 3 bước:
  1. Chọn công việc.
  2. Nộp CV dạng PDF, tối đa 10MB.
  3. HR xem xét: trợ lý AI chấm CV để hỗ trợ, quyết định cuối do con người.

#### AC-2: Header và footer trên mọi trang

**Given:** ứng viên mở bất kỳ trang công khai nào
**Then:**
- Header có tên dự án (link `/`), link **Trang chủ** (`/`), **Việc làm** (`/jobs`) và nút đổi ngôn ngữ **VI | EN**.
- Footer có ghi chú "CV được AI hỗ trợ sàng lọc…" và link **Chính sách quyền riêng tư** (`/privacy`).

### Việc làm `/jobs`

#### AC-3: Danh sách job đang tuyển

**Given:** đang có job `OPEN`
**When:** ứng viên mở `/jobs`
**Then:**
- Mỗi job là một thẻ, theo đúng thứ tự API trả về (job mới mở trước). Thẻ gồm:
  - tiêu đề;
  - dòng "nhóm · level · Từ N năm kinh nghiệm" (N = 0 → "Không yêu cầu kinh nghiệm");
  - tên các tiêu chí dạng tag;
  - nút **Ứng tuyển** dẫn tới `/submit-cv?position=<code>`.

#### AC-4: Lọc theo nhóm / level qua URL

**Given:** ứng viên đang ở `/jobs`
**When:** chọn một nhóm và / hoặc một level
**Then:**
- URL đổi thành `/jobs?category=<mã>&level=<mã>`, chọn "Tất cả" thì bỏ tham số đó.
- Danh sách chỉ còn job khớp (API được gọi với đúng bộ lọc).

**Given:** ứng viên mở thẳng `/jobs?category=developer` (chữ thường)
**Then:**
- Ô Nhóm hiện đúng "Developer".
- Có link **Bỏ lọc** về `/jobs`. Không có bộ lọc thì không hiện link này.

#### AC-5: Không có job phù hợp

**When:** có bộ lọc nhưng không job nào khớp
**Then:** hiện "Không có việc làm nào phù hợp với bộ lọc." kèm link **Bỏ lọc**.

**When:** không có job `OPEN` nào, và không có bộ lọc
**Then:** hiện "Hiện chưa có vị trí nào đang tuyển. Vui lòng quay lại sau."

#### AC-6: Backend lỗi

**Given:** backend không phản hồi hoặc trả lỗi
**When:** ứng viên mở `/jobs`
**Then:** trang vẫn hiển thị tiêu đề, kèm thông báo "Hiện chưa tải được dữ liệu…"; không có danh sách và bộ lọc.

### Form ứng tuyển `/submit-cv`

#### AC-7: Chọn sẵn job từ `/jobs`

**Given:** job `backend-dev` đang `OPEN`
**When:** ứng viên mở `/submit-cv?position=backend-dev`, hoặc `BACKEND-DEV`
**Then:** ô Vị trí đã chọn sẵn "Backend Developer", và hiện JD cùng tiêu chí của job đó.

**When:** mã job không tồn tại hoặc job đã đóng
**Then:** ô Vị trí để trống, chưa chọn gì.

#### AC-8: Không có job / backend lỗi

- Không có job `OPEN` nào → hiện "Hiện chưa có vị trí nào để ứng tuyển." kèm link tới `/jobs`; không hiện form.
- Backend lỗi → hiện thông báo lỗi thân thiện; không hiện form.

#### AC-9: Các trường của form

**Then:** form có các trường:
- **Họ tên**, **Email**, **Vị trí** (job `OPEN` lấy từ API), **Tải CV** ("Chỉ nhận PDF, tối đa 10MB").
- Checkbox **đồng ý xử lý dữ liệu**, kèm link **chính sách quyền riêng tư** mở `/privacy` ở tab mới.

#### AC-10: JD của vị trí được chọn

**When:** ứng viên chọn một vị trí
**Then:**
- Hiện nhóm · level · số năm kinh nghiệm, JD (định dạng markdown) và danh sách **Chúng tôi tìm kiếm** gồm tên các tiêu chí.

**When:** tải JD thất bại
**Then:** hiện "Không tải được mô tả công việc."

#### AC-11: Kiểm tra dữ liệu phía client

**When:** ứng viên bấm **Nộp CV** khi dữ liệu chưa hợp lệ
**Then:** hiện lỗi tương ứng ở từng trường, **không gọi API**. Cùng thứ tự và cùng mã lỗi với API:

| Trường hợp | Mã | Thông báo (vi) |
|------------|----|----------------|
| Họ tên trống | `NAME_REQUIRED` | Vui lòng nhập họ tên |
| Email trống | `EMAIL_REQUIRED` | Vui lòng nhập email |
| Email sai định dạng | `EMAIL_INVALID` | Email không hợp lệ |
| Chưa chọn vị trí | `POSITION_REQUIRED` | Vui lòng chọn vị trí |
| Chưa chọn file | `CV_REQUIRED` | Vui lòng tải CV lên |
| File không phải `.pdf` | `CV_NOT_PDF` | Chỉ chấp nhận file PDF |
| File > 10MB | `CV_TOO_LARGE` | Dung lượng file không được vượt quá 10MB |
| Chưa tick đồng ý | `CONSENT_REQUIRED` | Vui lòng đồng ý với chính sách quyền riêng tư để ứng tuyển |

- PDF thiếu MIME type vẫn được nhận (kiểm tra theo đuôi file).
- Lỗi của một trường tự mất khi ứng viên sửa trường đó.

#### AC-12: Nộp thành công

**Given:** dữ liệu hợp lệ và đã tick đồng ý
**When:** bấm **Nộp CV**
**Then:**
- Gửi `POST /api/applications` (multipart) với `name`, `email`, `position`, `cv`, `consent=true`.
- API trả 201 → form được thay bằng "Nộp CV thành công", kèm nút **Về trang chủ** (`/`) và **Xem việc làm khác** (`/jobs`).

#### AC-13: Nộp thất bại

**When:** API trả lỗi, hoặc request không tới được API
**Then:** thông báo lỗi hiện phía trên nút Nộp CV:
- Có `code` → thông báo của mã đó bằng ngôn ngữ đang chọn (vd `POSITION_NOT_OPEN` → "Vị trí này hiện không nhận hồ sơ").
- Không có `code` nhưng có `message` → hiện `message` của API.
- Lỗi mạng / proxy → "Không gửi được CV. Vui lòng thử lại."

Trong mọi trường hợp, dữ liệu đã nhập được giữ nguyên.

### Chính sách quyền riêng tư `/privacy`

#### AC-14: Nội dung chính sách

**When:** ứng viên mở `/privacy`
**Then:** trang có ngày cập nhật và các mục sau:
- dữ liệu thu thập;
- mục đích sử dụng;
- sàng lọc có AI hỗ trợ (Claude của Anthropic; mọi quyết định do con người);
- nơi lưu (Google Drive + cơ sở dữ liệu, chỉ HR truy cập);
- thời hạn lưu: **12 tháng** rồi xoá;
- quyền của ứng viên: gửi yêu cầu tới **trantrieu491@gmail.com**;
- sự đồng ý.

### Song ngữ

#### AC-15: Ngôn ngữ khi vào trang lần đầu

**Given:** ứng viên chưa chọn ngôn ngữ (không có cookie `locale`)
**Then:** ngôn ngữ theo header `Accept-Language`:

| `Accept-Language` | Ngôn ngữ |
|-------------------|----------|
| `en-US,en;q=0.9` | en |
| `vi-VN,vi;q=0.9,en;q=0.8` | vi |
| `fr-FR,fr;q=0.9,en;q=0.5` | en (ngôn ngữ đầu tiên trong vi / en) |
| `ja` | vi (mặc định) |
| không có header | vi (mặc định) |

**Given:** đã có cookie `locale=en`
**Then:** dùng tiếng Anh dù `Accept-Language` là tiếng Việt.

#### AC-16: Đổi ngôn ngữ

**When:** ứng viên bấm **EN** (đang ở tiếng Việt)
**Then:**
- Lưu cookie `locale=en` trong 1 năm; trang hiển thị lại bằng tiếng Anh, **URL không đổi**.
- Nút của ngôn ngữ đang dùng được đánh dấu; bấm lại ngôn ngữ đang dùng thì không làm gì.

**When:** đổi ngôn ngữ khi đang điền form
**Then:** dữ liệu đã nhập giữ nguyên; các lỗi đang hiện đổi sang ngôn ngữ mới.

#### AC-17: `lang` và tiêu đề trang

**Then:**
- `<html lang>` là `vi` hoặc `en` theo ngôn ngữ đang dùng.
- Tiêu đề tab có dạng "<tên trang> · CV AI Scanner" bằng ngôn ngữ đó, vd "Việc làm đang tuyển · CV AI Scanner".

#### AC-18: Nội dung job không dịch

**Given:** job do HR nhập bằng tiếng Anh
**When:** xem bằng tiếng Việt
**Then:** nhãn giao diện là tiếng Việt ("Ứng tuyển", "Không yêu cầu kinh nghiệm"); tiêu đề job, tên tiêu chí, tên nhóm / level giữ nguyên như HR nhập.

### Backend — API nộp đơn (thay đổi trong feature này)

#### AC-19: Bắt buộc đồng ý

**When:** `POST /api/applications` thiếu `consent`, hoặc `consent` khác `true`
**Then:** trả 400 `CONSENT_REQUIRED`; không upload CV, không lưu đơn.

#### AC-20: Lỗi có `code`

**Then:** mọi lỗi 400 / 413 / 503 của API nộp đơn có body `{ statusCode, error, code, message }`, trong đó:
- `code` là key của `APPLICATION_MESSAGES`;
- `message` là bản tiếng Anh.

#### AC-21: Giới hạn 10MB đúng biên

- CV **đúng 10.485.760 byte** (10MB) → được nhận (201).
- CV 10.485.761 byte → 413 `CV_TOO_LARGE`.
- Tên file tiếng Việt (`CV Nguyễn Văn A.pdf`) giữ nguyên dấu.

#### AC-22: Qua proxy của Next.js

**Then:** CV đúng 10MB gửi tới `/api/applications` của frontend vẫn tới được backend, vì proxy cho phép tối đa 11MB.

*Kiểm tra khi chạy thật (`next start`), không unit test được.*

---

## Kiểm thử

Frontend: scenario Gherkin (jest-cucumber, Testing Library, không mở trình duyệt) + unit test. Backend: Jest unit test. Mỗi scenario / test ghi mã AC tương ứng.

| AC | Test |
|----|------|
| AC-1, AC-2 | `src/app/__tests__/home.feature` · unit: `specs/index.spec.tsx` |
| AC-3 → AC-6, AC-18 | `src/app/jobs/__tests__/jobs.feature` · unit: `JobCard.spec.tsx`, `JobFilters.spec.tsx`, `lib/backend.spec.ts` |
| AC-7, AC-8 | `src/app/submit-cv/__tests__/submit-cv-page.feature` |
| AC-9 → AC-13, AC-16 (form) | `src/components/submit-cv/__tests__/submit-cv.feature` · unit: `CvUploadField.spec.ts`, `dictionaries.spec.ts` (đủ mã lỗi) |
| AC-14 | `src/app/privacy/__tests__/privacy.feature` |
| AC-15 → AC-17 | `src/app/__tests__/language.feature` · unit: `i18n.spec.ts`, `dictionaries.spec.ts`, `LanguageSwitcher.spec.tsx` |
| AC-19, AC-20 | backend `applications.service.spec.ts`, `cv-too-large.filter.spec.ts` |
| AC-21 | backend `applications.http.spec.ts` (Nest app thật + multer) |
| AC-22 | chạy thật — xem [tasks.md](./tasks.md) |

---

## Quyết định (2026-11-07)

| # | Câu hỏi | Đã chốt |
|---|---------|---------|
| FQ1 | Ngôn ngữ giao diện | **Song ngữ vi / en** |
| FQ2 | Trang `/privacy` + đồng ý xử lý dữ liệu (Q7) | `/privacy` + **checkbox bắt buộc**, FE và BE đều kiểm tra (field `consent`); không thêm cột DB — mọi đơn đã lưu đều có đồng ý, thời điểm = `created_at` |
| FQ3 | Frontend gọi backend thế nào | **Next.js rewrites** `/api/*` → `BACKEND_URL` (không CORS, URL backend không lộ ra trình duyệt) |
| FQ4 | Hiển thị JD (markdown) | **react-markdown** (không render HTML thô, bỏ URL `javascript:`) |
| IQ1 | URL khi song ngữ | **Giữ nguyên URL**, ngôn ngữ lưu trong cookie `locale` (1 năm) |
| IQ2 | Ngôn ngữ lần đầu | Theo `Accept-Language`: ngôn ngữ đầu tiên là vi / en theo thứ tự ưu tiên của trình duyệt; không có → **vi** |
| IQ3 | Nội dung job có song ngữ không | **Không** — chỉ giao diện song ngữ, không đổi DB |
| IQ4 | Làm song ngữ bằng gì | **Từ điển tự viết** (`src/i18n/dictionaries/{en,vi}.ts`), không thêm thư viện i18n |
| — | Nội dung `/privacy` | Email `trantrieu491@gmail.com`, lưu CV **12 tháng** (D24) — trong `src/config/site.ts`, đổi email được qua `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` |

### Ghi chú kỹ thuật phát hiện khi làm

- **Proxy của Next.js cắt body request ở 10MB** (mặc định `experimental.proxyClientMaxBodySize`). CV đúng 10MB + phần đầu multipart sẽ vượt → đặt **11MB** trong `next.config.js`. File > 11MB (vốn đã bị form chặn) qua proxy trả 500 thay vì 413.
- **Multer / busboy coi file "quá lớn" ngay khi đạt đúng `fileSize`** → CV đúng 10MB từng bị backend trả 413. Đã sửa: giới hạn multer = `CV_MAX_FILE_SIZE_BYTES + 1`.
- Next.js tự đoán sai thư mục gốc (lấy một `package-lock.json` ngoài repo) → đặt `outputFileTracingRoot` về gốc monorepo.
- **Nx nạp `.env` gốc cho mọi project**, nên `PORT=3001` của backend làm `next dev` chiếm luôn cổng 3001 → backend không chạy được và `/api/*` bị proxy về chính Next.js (vòng lặp). Đã cố định `--port 3000` cho target `dev` / `start` / `serve-static` của frontend.
- Trang `/privacy` cam kết xoá CV sau 12 tháng → cần job tự xoá (Q7, sau MVP).
