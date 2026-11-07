# Tasks: Đăng nhập HR

Feature branch: `feature/hr-auth` (tách từ `feature/n8n-evaluate-cv-workflow`; merge sau các PR của Phase 2)
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Phân tích & scenario

- [x] Chốt PQ-3 (3 feature), HQ0 (cookie httpOnly), HQ1 (`@nestjs/jwt`), HQ2 (5 lần / 15 phút), HQ3 (`/api/hr/users`), HQ4 (8 giờ), Q11 (backend trả PDF), HR song ngữ (2026-11-07)
- [x] Phát hiện: `/api/users` đang mở cho mọi người và không có validation → sửa trong feature này
- [x] Scenario AC-1 → AC-14 trong [requirements.md](./requirements.md)
- [x] Bạn review scenario (2026-11-07)
- [x] Bạn thêm `JWT_SECRET` vào `.env`

## Làm

- [x] Shared: `API_ROUTES.AUTH_LOGIN / AUTH_LOGOUT / AUTH_ME / HR / HR_USERS` (bỏ `USERS`), `auth.constants.ts` (cookie, 8 giờ, giới hạn đăng nhập, mã lỗi auth / users), `auth.types.ts`, `UpdateUserDto.isActive`
- [x] Backend: `@nestjs/jwt` **11.0.2** (12.x chỉ có ESM, Jest không nạp được); `common/api-error.ts`; module `auth`:
  - `auth.config.ts` (`JWT_SECRET` ≥ 32 ký tự, không có thì backend không khởi động);
  - `auth.service.ts` (đăng nhập, hash giả khi email lạ, phát JWT HS256 8 giờ, đọc phiên);
  - `login-attempts.service.ts` (5 lần / 15 phút theo email + IP, trong bộ nhớ);
  - `hr-auth.guard.ts` (guard toàn cục: mọi `/api/hr/*` + `@RequireHrSession()`; 415 khi ghi mà không phải JSON);
  - `auth.controller.ts` (`login` / `logout` / `me`, cookie `cvs_hr_session`), `session-cookie.ts`.
- [x] Backend: `main.ts` `trust proxy` (loopback / mạng riêng) để lấy IP thật sau Next.js
- [x] Backend: `users` → `/api/hr/users` + validation + 404 / 409 + chặn tự xoá / tự khoá; bỏ `users.controller.spec.ts` (thay bằng HTTP spec)
- [x] Frontend: trang công khai chuyển vào route group `src/app/(public)/` (layout header / footer), root layout chỉ còn `<html>` + i18n
- [x] Frontend: `src/proxy.ts`, `lib/hr-paths.ts` (`safeNextPath`, `loginUrl`), `lib/hr-session.ts` (`getHrSession` hỏi `/api/auth/me`), `lib/hr-client.ts` (`hrFetch`)
- [x] Frontend: `app/hr/layout.tsx` (noindex), `app/hr/login/page.tsx`, `app/hr/(protected)/layout.tsx` + `page.tsx`, `components/hr/HrHeader.tsx`, `HrLoginForm.tsx`; từ điển `hr.*` vi / en
- [x] Test theo bảng "Kiểm thử"; mock `next/headers` (cookie phiên, `x-hr-path`), `next/navigation` (`replace`, `redirect`), `test-utils/hr-backend.mock.ts`
- [x] Docs: project-overview (D32, lộ trình 3.1, Q6 + Q11 đã chốt), CLAUDE.md, `.env.example` (`JWT_SECRET`)

## Kiểm chứng (2026-11-07)

- [x] Backend: 120/120 test (23 suite), trong đó auth + users 51 (`hr-auth.http.spec.ts` 14 test với Nest app thật). Type-check code + test sạch
- [x] Frontend: 146/146 test (18 suite): 93 test cũ vẫn pass sau khi chuyển vào `(public)` (AC-14) + `hr-login.feature` 17, `hr-session.feature` 7, `hr-paths.spec` 21, `proxy.spec` 8. Shared 10/10
- [x] Thử làm hỏng code để chắc test bắt lỗi: 401 hiện sai thông báo, bỏ lý do `expired`, bỏ `Cache-Control`, cho `next` trỏ về `/hr/login`, bỏ kiểm tra phía trình duyệt → đều có test đỏ (đã khôi phục)
- [x] Lint: không có lỗi mới (chỉ lỗi `@nx/enforce-module-boundaries` có sẵn); `next build --webpack` sạch, nhận `Proxy (Middleware)`, route `/hr`, `/hr/login`
- [x] Chạy thật qua bản build production của Next.js (cổng 3010) → backend dev (3001), tài khoản seed:
  - AC-11: không cookie, `/hr/applications?status=EVALUATED` → 307 `/hr/login?next=…`; cookie bị sửa → về trang đăng nhập; đã đăng nhập mở `/hr/login?next=/hr/applications` → 307 `/hr/applications`
  - AC-9 / AC-12: `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow`, `<meta name="robots" content="noindex, nofollow">`
  - AC-1 / AC-2: sai mật khẩu → 401 không cookie; đúng (email viết hoa) → 200, cookie `HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`, token không nằm trong body
  - AC-12: `/hr` có cookie → 200, có tên HR + nút đăng xuất; AC-5: `/api/auth/me` qua proxy đúng user, logout → 204 + xoá cookie
  - AC-6 / AC-8: `/api/hr/users` qua proxy: không cookie 401 `UNAUTHENTICATED`, có cookie 200, không có `passwordHash`; `/api/users` → 404
  - AC-4: email không tồn tại sai 5 lần → lần 6 `429`, `Retry-After: 900`; email HR thật vẫn đăng nhập được. Ghi chú: trên máy local, `X-Forwarded-For` tự đặt vượt qua bộ đếm theo IP (xem requirements, "Phát hiện khi làm")
- [ ] Bạn thử trên trình duyệt: http://localhost:3000/hr/login (dev server cần khởi động lại, xem dưới)

## Còn lại

- [ ] Dev server Next.js đang chạy (khởi động từ phiên trước, 13:08) không áp dụng rewrites `/api/*` (mọi `/api/*` qua cổng 3000 trả 404, kể cả `/api/positions`) → dừng và chạy lại `npm run dev`
- [ ] Phase 5: bộ đếm đăng nhập sai dùng chung giữa các instance; cân nhắc giới hạn theo IP (password spraying)
