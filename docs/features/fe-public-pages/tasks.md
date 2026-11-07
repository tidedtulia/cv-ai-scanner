# Tasks: Trang công khai cho ứng viên

Feature branch: `feature/fe-public-pages`
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Song ngữ (i18n)

- [x] `src/i18n/config.ts`: `LOCALES`, cookie `locale`, `resolveLocale` (cookie > `Accept-Language` > `vi`)
- [x] Từ điển `dictionaries/en.ts` + `vi.ts` (type `Dictionary` bắt buộc cùng cấu trúc), `format()` cho `{placeholder}`
- [x] `getI18n()` cho Server Component, `I18nProvider` / `useI18n()` cho Client Component
- [x] `LanguageSwitcher` (VI | EN): ghi cookie + `router.refresh()`, giữ nguyên dữ liệu form

## Gọi backend

- [x] `next.config.js`: rewrite `/api/*` → `BACKEND_URL` (mặc định `http://localhost:3001`); `proxyClientMaxBodySize` 11MB; `outputFileTracingRoot`
- [x] Target `dev` / `start` / `serve-static` của frontend cố định `--port 3000` (Nx nạp `PORT=3001` từ `.env` gốc cho cả frontend)
- [x] `src/lib/backend.ts` (server: `fetchOpenPositions`, `fetchJobCategories`, `fetchJobLevels`, `cache: 'no-store'`) và `src/lib/client-api.ts` (URL cho trình duyệt)

## Trang & component

- [x] Layout: `<html lang>` theo ngôn ngữ, `SiteHeader`, `SiteFooter`, metadata song ngữ; bỏ CSS trang chào của Nx
- [x] `/` — `HomeContent` (hero + 3 bước)
- [x] `/jobs` — `JobCard`, `JobFilters` (lọc qua URL), trạng thái rỗng, `ErrorNotice` khi backend lỗi
- [x] `/submit-cv` — lấy job từ API, chọn sẵn `?position=`, `PositionDetails` (JD bằng react-markdown + tiêu chí), chỉ PDF, checkbox đồng ý, lỗi theo `code`
- [x] `/privacy` — nội dung song ngữ; email `trantrieu491@gmail.com` + lưu 12 tháng từ `src/config/site.ts` (D24)
- [x] Xoá `src/data/positions.ts`, `PositionRequirements.tsx`, `src/app/api/hello`, `src/app/api/submit-cv` (+ test)
- [x] Thêm dependency `react-markdown` 10.1.0 (npm audit: không thêm lỗ hổng — trước / sau đều 102, có sẵn)

## Backend & shared (thay đổi API của bước 1.3)

- [x] Shared: `APPLICATION_FORM_FIELDS.CONSENT`, `APPLICATION_CONSENT_VALUE`, `CONSENT_REQUIRED`, type `ApplicationMessageCode`, `ApplicationErrorResponse`
- [x] Service: bắt buộc `consent=true`; lỗi 400 / 503 có `code`; `CvTooLargeFilter` trả `code: CV_TOO_LARGE`
- [x] Controller: giới hạn multer `CV_MAX_FILE_SIZE_BYTES + 1` (CV đúng 10MB không còn bị 413)
- [x] GitNexus impact trước khi sửa: `SubmitCvForm`, `isAcceptedCvFile`, `PositionSelect`, `RootLayout`, `ApplicationsService`, `ApplicationsController`, `CvTooLargeFilter`, `APPLICATION_MESSAGES` — tất cả LOW

## Tests

Scenario (AC-1 → AC-22) viết trước trong [requirements.md](./requirements.md); bảng "Kiểm thử" ở đó map từng AC sang file test.

- [x] Frontend — Gherkin (jest-cucumber), 6 file `.feature`, 52 test:
  - `src/app/__tests__/home.feature` (AC-1, AC-2) — 2
  - `src/app/__tests__/language.feature` (AC-15 → AC-17) — 13
  - `src/app/jobs/__tests__/jobs.feature` (AC-3 → AC-6, AC-18) — 10
  - `src/app/submit-cv/__tests__/submit-cv-page.feature` (AC-7, AC-8) — 5
  - `src/app/privacy/__tests__/privacy.feature` (AC-14) — 2
  - `src/components/submit-cv/__tests__/submit-cv.feature` (AC-9 → AC-13, AC-16) — 20
- [x] Frontend — unit test, 41 test: `i18n.spec.ts`, `dictionaries.spec.ts`, `lib/backend.spec.ts`, `JobCard`, `JobFilters`, `LanguageSwitcher`, `CvUploadField`, `specs/index.spec.tsx`
- [x] Frontend — `src/test-utils/`: dữ liệu mẫu (`fixtures.ts`), mock `next/headers`, `next/navigation`, `lib/backend`, `react-markdown`; `renderPage()` / `renderLayout()` / `pageTitle()` để render Server Component async
- [x] Backend — unit test:
  - `applications.service.spec.ts`: thiếu / sai consent → 400 `CONSENT_REQUIRED`; mọi lỗi 400 / 503 có body `{statusCode, error, code, message}` (AC-19, AC-20)
  - `cv-too-large.filter.spec.ts`: 413 có `code: CV_TOO_LARGE` (AC-20)
  - `applications.http.spec.ts`: Nest app thật + multer, service mock — đúng 10.485.760 byte → 201; +1 byte → 413, không gọi service; tên file tiếng Việt giữ nguyên (AC-21)
- [x] Kết quả: frontend 93/93 (14 suite), backend 84/84 (20 suite), shared 10/10; type-check file test frontend + backend sạch
- [x] Lint: không có lỗi mới. Lỗi `@nx/enforce-module-boundaries` khi import `@org/shared` **có sẵn trên `main`** (shared không có target build) — xử lý riêng
- [x] Chạy thật (production `next start` + backend `CV_STORAGE=local`, dữ liệu test đã xoá):
  - AC-15: `en-US` → en, `vi` → vi, cookie `en` thắng `Accept-Language: vi`, `fr,en;q=0.5` → en, `ja` / không header → vi
  - AC-3, AC-4, AC-5: `/jobs` 3 job; lọc `category=developer&level=MIDDLE` → 3; `level=SENIOR` → thông báo rỗng; bản tiếng Việt đúng
  - AC-7: `?position=backend-dev` / `BACKEND-DEV` chọn sẵn; mã sai → không chọn sẵn
  - AC-22 (qua proxy): `GET /api/positions/:code` 200; thiếu consent → 400 `CONSENT_REQUIRED`; nộp hợp lệ → 201; CV 10.400.009 byte → 201
  - AC-21: CV **đúng 10.485.760 byte → 201**, 10.485.761 byte → 413 `CV_TOO_LARGE`
  - AC-6, AC-8: backend tắt → `/jobs`, `/submit-cv` vẫn 200 + thông báo lỗi thân thiện

## Còn lại

- [x] Chốt nội dung `/privacy`: email `trantrieu491@gmail.com`, lưu CV 12 tháng (2026-11-07)
- [ ] Review giao diện trên máy local (bạn)
- [ ] Job tự xoá CV / đơn sau 12 tháng để đúng cam kết trên `/privacy` (Q7, sau MVP)
- [ ] Lỗi lint `@nx/enforce-module-boundaries` có sẵn (ngoài phạm vi)
- [ ] 102 lỗ hổng npm có sẵn (gồm `next`, `multer`) — rà soát riêng
