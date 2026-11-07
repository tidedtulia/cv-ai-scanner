# Feature: Đăng nhập HR (Phase 3 — bước 3.1)

## Mục tiêu

HR đăng nhập bằng email + mật khẩu để vào khu vực `/hr` (các bước 3.2, 3.3 xây trên đó). Mọi API dành cho HR (`/api/hr/*`) chỉ dùng được khi đã đăng nhập. Đóng lỗ hổng hiện tại: `/api/users` cho **bất kỳ ai** tạo / sửa / xoá tài khoản HR và không kiểm tra dữ liệu đầu vào.

Bối cảnh: [project-overview.md §8.2, §8.3](../../project-overview.md#82-trang-hr) (D5, Q6) · Bảng `users`: [database.md §4.1](../../database.md#41-users--tài-khoản-hr) · Mật khẩu: `packages/backend/src/app/common/password.ts` (scrypt, đã có)

---

## Phạm vi

- **Backend:**
  - module `auth`: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`;
  - guard JWT cho mọi route `/api/hr/*`;
  - giới hạn số lần đăng nhập sai;
  - `/api/users` chuyển thành `/api/hr/users` (cần đăng nhập, có validation).
- **Frontend:**
  - trang `/hr/login`, khung trang HR (`/hr`, header có tên HR + đăng xuất + VI | EN);
  - tự chuyển về trang đăng nhập khi chưa đăng nhập hoặc phiên hết hạn.
- **Shared:** đường dẫn API, mã lỗi, DTO đăng nhập / người dùng, thời hạn phiên.
- Thêm dependency `@nestjs/jwt` (HQ1).
- **Không làm:**
  - danh sách / chi tiết đơn (3.2), quản lý job (3.3);
  - trang UI quản lý tài khoản HR;
  - quên mật khẩu / đổi mật khẩu trên UI;
  - nhiều vai trò (Q6: 1 vai trò cho MVP).

### Biến môi trường mới (`.env` gốc)

| Biến | Bắt buộc | Dùng cho |
|------|----------|----------|
| `JWT_SECRET` | Có (backend) | Khoá ký JWT, tối thiểu 32 ký tự (`openssl rand -hex 32`). Đổi khoá thì mọi phiên đang mở bị đăng xuất |

### Hằng số

| Tên | Giá trị |
|-----|---------|
| Thời hạn phiên | **8 giờ** (HQ4), không có refresh token |
| Cookie | `cvs_hr_session`: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` 8 giờ; `Secure` khi `NODE_ENV=production` |
| Chống dò | **5 lần sai trong 15 phút** cho cùng email + IP → chặn **15 phút** (HQ2) |
| Mật khẩu (tạo / sửa tài khoản) | 8–72 ký tự |

---

## Acceptance Criteria

Mỗi AC là một scenario. "HR" là một dòng `users` có `is_active = true`; tài khoản đầu tiên do `prisma db seed` tạo (`SEED_HR_EMAIL` / `SEED_HR_PASSWORD`).

### Backend — đăng nhập

#### AC-1: Đăng nhập thành công

**Given:** HR có email `hr@example.com` và mật khẩu đúng
**When:** `POST /api/auth/login` với `{ "email": "HR@Example.com ", "password": "<đúng>" }`
**Then:**
- 200, body `{ "user": { "id", "name", "email" } }` (email chữ thường, không bao giờ có `passwordHash`).
- Header `Set-Cookie: cvs_hr_session=<JWT>; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800` (thêm `Secure` ở production). Token **không** nằm trong body.
- Email được so không phân biệt hoa thường và bỏ khoảng trắng hai đầu.

#### AC-2: Sai thông tin đăng nhập

**Given:** một trong các trường hợp: email không tồn tại · sai mật khẩu · tài khoản bị khoá (`is_active = false`)
**When:** `POST /api/auth/login`
**Then:**
- 401, body `{ statusCode, error, code: "INVALID_CREDENTIALS", message }`; **cùng một thông báo** cho cả 3 trường hợp (không lộ email nào tồn tại).
- Không có cookie.
- Thời gian trả lời gần như nhau dù email có tồn tại hay không (luôn chạy kiểm mật khẩu).

#### AC-3: Dữ liệu đăng nhập không hợp lệ

| Body | Kết quả |
|------|---------|
| thiếu `email` hoặc sai định dạng | 400 `code: EMAIL_INVALID` |
| thiếu `password` / chuỗi rỗng | 400 `code: PASSWORD_REQUIRED` |
| `Content-Type` không phải `application/json` (vd form HTML) | 415 `code: JSON_REQUIRED`, không đăng nhập |
| thừa field lạ | bỏ qua field lạ |

#### AC-4: Chặn dò mật khẩu

**Given:** đã đăng nhập sai 5 lần trong 15 phút với cùng email từ cùng IP
**When:** đăng nhập lần thứ 6 (kể cả đúng mật khẩu)
**Then:**
- 429, `code: TOO_MANY_ATTEMPTS`, header `Retry-After` (giây); không kiểm mật khẩu.
- Hết 15 phút thì đăng nhập lại được. Đăng nhập **thành công** trước khi bị chặn thì xoá bộ đếm.
- Email khác hoặc IP khác không bị ảnh hưởng.
- Bộ đếm nằm trong bộ nhớ backend (đủ cho 1 instance; mất khi restart; ghi chú cho Azure).

### Backend — phiên & bảo vệ API

#### AC-5: `GET /api/auth/me` và đăng xuất

**Given:** đã đăng nhập
**Then:**
- `GET /api/auth/me` → 200 `{ "user": { "id", "name", "email" } }`.
- `POST /api/auth/logout` → 204 và xoá cookie (`Max-Age=0`); sau đó `/api/auth/me` → 401. Gọi logout khi chưa đăng nhập cũng 204.

#### AC-6: Mọi `/api/hr/*` cần đăng nhập

**When:** gọi bất kỳ route `/api/hr/*` (vd `GET /api/hr/users`)
**Then:**

| Trường hợp | Kết quả |
|------------|---------|
| Không có cookie | 401 `code: UNAUTHENTICATED` |
| JWT sai chữ ký / bị sửa / sai định dạng | 401 `code: UNAUTHENTICATED` |
| JWT hết hạn (quá 8 giờ) | 401 `code: SESSION_EXPIRED` |
| Tài khoản đã bị xoá hoặc khoá sau khi đăng nhập | 401 `code: UNAUTHENTICATED`, xoá cookie (bị đăng xuất **ngay** ở request kế tiếp) |
| JWT hợp lệ, tài khoản còn hoạt động | qua guard; request biết HR nào đang gọi (dùng cho lịch sử quyết định ở 3.2) |

- Các API công khai (`/api/positions`, `/api/job-categories`, `/api/job-levels`, `POST /api/applications`) **không** đổi, không cần đăng nhập.
- Đổi `JWT_SECRET` → mọi phiên cũ bị 401.

#### AC-7: Thiếu `JWT_SECRET`

**Given:** `.env` không có `JWT_SECRET`, hoặc ngắn hơn 32 ký tự
**When:** khởi động backend
**Then:** backend **không khởi động**, log nêu đúng tên biến và yêu cầu độ dài (giống cách xử lý `CV_STORAGE`).

### Backend — tài khoản HR

#### AC-8: `/api/hr/users` thay cho `/api/users`

**Then:**
- `/api/users` không còn (404). `GET / POST /api/hr/users`, `GET / PATCH / DELETE /api/hr/users/:id` cần đăng nhập (AC-6).
- Không response nào chứa `passwordHash`.
- Kiểm dữ liệu:

| Trường hợp | Kết quả |
|------------|---------|
| `name` rỗng / quá 255 ký tự | 400 `NAME_REQUIRED` / `NAME_TOO_LONG` |
| `email` sai định dạng | 400 `EMAIL_INVALID` |
| `email` đã có (không phân biệt hoa thường) | 409 `EMAIL_TAKEN` |
| `password` dưới 8 hoặc quá 72 ký tự | 400 `PASSWORD_LENGTH` |
| `id` không phải uuid / không tồn tại | 400 / 404 |

- HR **không được xoá hoặc khoá chính mình** (`DELETE` hoặc `PATCH { isActive: false }` với id của mình) → 400 `CANNOT_CHANGE_OWN_ACCOUNT`, để không ai tự làm mất quyền truy cập cuối cùng.
- Đổi mật khẩu qua `PATCH { password }` thì mật khẩu được hash lại bằng scrypt.

### Frontend

#### AC-9: Trang `/hr/login`

**Given:** chưa đăng nhập, mở `/hr/login`
**Then:**
- Form: Email, Mật khẩu (ẩn ký tự), nút **Đăng nhập**; song ngữ VI / EN theo cookie `locale` như trang công khai; tiêu đề tab "Đăng nhập HR · CV AI Scanner" (cùng mẫu `%s · CV AI Scanner` của các trang khác).
- Kiểm tra phía trình duyệt: email trống / sai định dạng, mật khẩu trống → báo lỗi ngay dưới ô, không gọi API.
- Đang gửi: nút bị khoá, hiện "Đang đăng nhập…".
- Trang có `<meta name="robots" content="noindex">` (cả khu vực `/hr`).

#### AC-10: Kết quả đăng nhập trên giao diện

| Trường hợp | Hiển thị |
|------------|----------|
| Thành công | chuyển tới `?next=` nếu là đường dẫn bắt đầu bằng `/hr` (không phải `//` hay URL ngoài), không thì `/hr` |
| 401 `INVALID_CREDENTIALS` | "Email hoặc mật khẩu không đúng." |
| 429 `TOO_MANY_ATTEMPTS` | "Bạn đã nhập sai quá nhiều lần. Thử lại sau N phút." (N từ `Retry-After`) |
| Lỗi mạng / 5xx | "Không kết nối được máy chủ. Vui lòng thử lại." |

Dữ liệu đã nhập (email) được giữ khi báo lỗi; mật khẩu bị xoá.

#### AC-11: Khu vực `/hr` cần đăng nhập

**Given:** chưa đăng nhập (hoặc cookie không hợp lệ / hết hạn)
**When:** mở `/hr` hoặc bất kỳ trang `/hr/...` (trừ `/hr/login`)
**Then:** chuyển tới `/hr/login?next=<đường dẫn đang mở>`; phiên hết hạn thì trang đăng nhập hiện thêm "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại."

**Given:** đã đăng nhập
**When:** mở `/hr/login`
**Then:** chuyển tới `/hr`.

#### AC-12: Khung trang HR

**Given:** đã đăng nhập, mở `/hr`
**Then:**
- Header riêng cho HR: tên dự án + "HR", tên HR đang đăng nhập, nút **Đăng xuất**, nút **VI | EN**. Không dùng header / footer của trang công khai.
- `/hr` hiện lời chào "Xin chào, {tên}" (chỗ đặt danh sách đơn ở 3.2).
- **Đăng xuất** → gọi logout → về `/hr/login`; bấm Back không xem lại được trang HR (trang được render theo phiên, không cache).

#### AC-13: Phiên hết hạn khi đang làm việc

**Given:** đang ở một trang HR, phiên hết hạn hoặc tài khoản bị khoá
**When:** trang gọi một API `/api/hr/*` và nhận 401
**Then:** chuyển tới `/hr/login?next=<trang hiện tại>` kèm thông báo hết hạn (AC-11), không hiện lỗi thô.

#### AC-14: Trang công khai không đổi

**Then:** các trang `/`, `/jobs`, `/submit-cv`, `/privacy` và test của chúng không đổi; trang công khai không có link vào `/hr`.

---

## Kiểm thử

Theo [CLAUDE.md — Feature workflow](../../../CLAUDE.md): Gherkin + unit cho frontend, Jest unit + HTTP spec cho backend; mỗi test ghi mã AC.

| AC | Test |
|----|------|
| AC-1 → AC-4 | backend `auth/auth.service.spec.ts` (đăng nhập, lỗi, thời gian khi email lạ, chặn sau 5 lần), `auth/login-attempts.service.spec.ts` (cửa sổ 15 phút, reset, khác email / IP) · HTTP spec `auth/hr-auth.http.spec.ts` (thuộc tính cookie, `Secure` ở production, 401 / 400 / 415 / 429 + `Retry-After`) |
| AC-5, AC-6 | `auth/hr-auth.http.spec.ts` (Nest app thật + guard toàn cục, bảng `users` giả trong bộ nhớ): `/me`, logout, không cookie, token rác / bị sửa / sai khoá / hết hạn, tài khoản bị khoá giữa phiên, API công khai |
| AC-7 | `auth/auth.config.spec.ts` (thiếu / rỗng / ngắn `JWT_SECRET`) |
| AC-8 | `users/users.service.spec.ts` (validation, 409, 404, chỉ đổi field gửi lên, hash lại mật khẩu, tự xoá / tự khoá) · `auth/hr-auth.http.spec.ts` (`/api/users` 404, `/api/hr/users` cần đăng nhập, không có `passwordHash`, 415 khi không phải JSON) |
| AC-9, AC-10, AC-11 (trang đăng nhập) | frontend `src/app/hr/login/__tests__/hr-login.feature` (form, kiểm phía trình duyệt, nút bị khoá, `next` an toàn, các lỗi, thông báo hết hạn, đã đăng nhập) |
| AC-11 → AC-13 | `src/app/hr/__tests__/hr-session.feature` (cookie hết hạn / tài khoản khoá, header HR, đăng xuất, backend lỗi, `hrFetch` gặp 401) · unit `src/lib/hr-paths.spec.ts` (`safeNextPath`, `loginUrl`), `src/proxy.spec.ts` (chuyển hướng khi không cookie, `no-store`, `noindex`) |
| AC-14 | các test trang công khai (đã chuyển vào `src/app/(public)/`) vẫn pass, nội dung không đổi |
| Chạy thật | [tasks.md](./tasks.md): qua bản build production của Next.js → backend dev, tài khoản seed |
---

## Quyết định (2026-11-07)

| # | Câu hỏi | Đã chốt |
|---|---------|---------|
| PQ-3 | Chia Phase 3 | **3 feature:** 3.1 đăng nhập (feature này), 3.2 đơn ứng tuyển (danh sách, chi tiết, quyết định, đánh giá lại; chưa email), 3.3 quản lý job / tiêu chí / danh mục |
| HQ0 | Lưu phiên | **Cookie httpOnly**, `SameSite=Lax`, cùng origin nhờ Next.js rewrites |
| HQ1 | Thư viện JWT | **`@nestjs/jwt`** |
| HQ2 | Chống dò mật khẩu | **5 lần sai / 15 phút** theo email + IP → chặn 15 phút |
| HQ3 | API tài khoản | **`/api/hr/users` + bắt đăng nhập**; không tự xoá / tự khoá; chưa có UI |
| HQ4 | Thời hạn phiên | **8 giờ** |
| — | Xem CV (Q11, cho 3.2) | **Backend trả file PDF** qua API cần đăng nhập |
| — | Ngôn ngữ trang HR | **Song ngữ vi / en**, dùng lại từ điển và nút VI \| EN |
| — | Vai trò (Q6) | 1 vai trò cho MVP: mọi HR có quyền như nhau |

### Ghi chú kỹ thuật

- **CSRF:** cookie `SameSite=Lax` không gửi kèm POST từ trang khác. Các API ghi dữ liệu của HR chỉ nhận `Content-Type: application/json`, nên form HTML của trang khác không gọi được.
- **Đổi mật khẩu không vô hiệu hoá phiên cũ** trong MVP (JWT không lưu phiên); khoá tài khoản thì có (guard đọc `is_active` ở mỗi request).
- **Bộ đếm đăng nhập sai nằm trong bộ nhớ:** khi chạy nhiều instance trên Azure cần chuyển sang nơi dùng chung (Redis / DB) — ghi vào Phase 5.
- **IP sau proxy:** frontend gọi backend qua Next.js rewrites, nên backend thấy IP của Next.js. Cần đọc `X-Forwarded-For` từ proxy tin cậy (Next.js) thì bộ đếm theo IP mới đúng; kiểm khi làm.

### Phát hiện khi làm

- **`@nestjs/jwt` 12.x chỉ có bản ESM**, Jest (CommonJS) của backend không nạp được → dùng **11.0.2** (CommonJS, cùng API). `npm audit` không đổi (102 lỗ hổng có sẵn).
- **Khu vực `/hr` cần header riêng:** các trang công khai chuyển vào route group `src/app/(public)/` (layout có header / footer công khai); `src/app/layout.tsx` chỉ còn `<html>` + i18n. URL không đổi; test của trang công khai chuyển theo, chỉ sửa đường dẫn import.
- **Next.js 16 dùng `src/proxy.ts`** (tên mới của middleware) để chặn `/hr/*` khi không có cookie và truyền đường dẫn hiện tại (`x-hr-path`) cho layout, vì layout không biết pathname.
- **Layout chỉ chạy lại khi tải trang / `router.refresh()`**: khi chuyển giữa các trang con của `/hr` ở phía trình duyệt, layout không kiểm lại phiên. Không lộ dữ liệu vì mọi dữ liệu HR đi qua `/api/hr/*` (backend kiểm cookie mỗi lần) và `hrFetch` đưa về trang đăng nhập khi gặp 401 (AC-13). Các trang 3.2 cũng gọi `getHrSession()` / API phía server.
- **Đăng xuất chỉ xoá cookie**: JWT là stateless nên token đã bị sao chép vẫn dùng được tới khi hết hạn (tối đa 8 giờ) hoặc tài khoản bị khoá / đổi `JWT_SECRET`.
- **IP sau proxy:** backend đặt `trust proxy` = `loopback, linklocal, uniquelocal` và Next.js chuyển tiếp `X-Forwarded-For`. Trên máy local (người gọi cũng là loopback), giá trị `X-Forwarded-For` tự đặt sẽ được tin nên bộ đếm theo IP vượt qua được; trên Azure, IP thật do ingress thêm vào là địa chỉ public đầu tiên không được tin, phần giả mạo phía trước bị bỏ qua. Bộ đếm theo **email + IP** không chặn việc thử nhiều email từ một IP (password spraying) — cân nhắc thêm giới hạn theo IP ở Phase 5.
- **Tiêu đề tab** theo mẫu sẵn có `%s · CV AI Scanner` (không dùng `|`).

