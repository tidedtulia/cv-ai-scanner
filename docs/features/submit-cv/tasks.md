# Tasks: Submit CV Page

Feature branch: `feature/fe-submit-cv-page`  
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Documentation

- [x] Tạo `docs/features/submit-cv/requirements.md`
- [x] Tạo `docs/features/submit-cv/tasks.md`

---

## Data & Constants

- [x] Tạo `packages/frontend/src/data/positions.ts`
  - Định nghĩa interface `Position { id, title, requirements[] }`
  - Export mảng `POSITIONS` với 3 vị trí hardcode

---

## Mock API

- [x] Tạo `packages/frontend/src/app/api/submit-cv/route.ts`
  - POST handler nhận `FormData`
  - Validate có đủ các field: `name`, `email`, `position`, `cv` (`cv` phải là `File`)
  - Trả `{ success: true, message: "Submit CV successfully" }` nếu hợp lệ
  - Trả `{ success: false, message: "Missing fields" }` (400) nếu thiếu field
  - Trả `{ success: false, message: "File size must not exceed 10MB" }` (400) nếu file > 10MB

---

## Components

- [x] Tạo `packages/frontend/src/components/submit-cv/PositionSelect.tsx`
  - Props: `value: string`, `onChange: (id: string) => void`, `error?: string`
  - Render `<select>` với danh sách từ `POSITIONS`
  - Hiện placeholder "Select a position" khi chưa chọn

- [x] Tạo `packages/frontend/src/components/submit-cv/PositionRequirements.tsx`
  - Props: `positionId: string`
  - Tìm position trong `POSITIONS` theo `positionId`
  - Hiện danh sách requirements dạng bullet list
  - Không render gì nếu `positionId` rỗng

- [x] Tạo `packages/frontend/src/components/submit-cv/CvUploadField.tsx`
  - Props: `onChange: (file: File | null) => void`, `error?: string`
  - File input chấp nhận `.pdf,.doc,.docx`
  - Export `isAcceptedCvFile(file)` — kiểm tra theo đuôi file
  - Hiện tên file đã chọn ("Selected: <tên file>")
  - Hiện error message nếu có

- [x] Tạo `packages/frontend/src/components/submit-cv/SubmitCvForm.tsx`
  - Quản lý state: `name`, `email`, `positionId`, `cvFile`, `submitted`, `loading`, `errors`
  - Validate trước khi submit (dùng `isValidEmail` từ `@org/shared`), gồm giới hạn 10MB
  - Submit: `FormData` + `fetch('/api/submit-cv', { method: 'POST' })`
  - Khi success: hiện thông báo "Submit CV successfully" + button "Back to home" (link về `/`)
  - Khi fail / network error: hiện lỗi submit, giữ form (AC-5)
  - Xoá lỗi của trường khi người dùng sửa trường đó
  - Gắn `aria-invalid` / `aria-describedby` cho các input có lỗi

---

## Config

- [x] Thêm `CV_MAX_FILE_SIZE_MB` / `CV_MAX_FILE_SIZE_BYTES` (10MB) vào `packages/shared/src/constants/cv.constants.ts`
- [x] Thêm `@org/shared` vào dependencies của `packages/frontend/package.json` + `transpilePackages` trong `next.config.js`
- [x] Chạy Next bằng webpack (`--webpack` trong nx targets `dev`/`build`) + `resolve.extensionAlias` cho `.js` → `.ts`

---

## Page

- [x] Tạo `packages/frontend/src/app/submit-cv/page.tsx`
  - Metadata: `title: "Submit CV"`
  - Render `<SubmitCvForm />`

---

## Tests

Frontend: scenario viết bằng Gherkin (Cucumber), chạy như unit test với Jest + Testing Library qua `jest-cucumber` — không mở browser, không e2e.

- [x] `packages/frontend/src/components/submit-cv/__tests__/submit-cv.feature` — scenario cho AC-1 → AC-5
- [x] `packages/frontend/src/components/submit-cv/__tests__/submit-cv.steps.spec.tsx` — step definitions (render `SubmitCvForm`, `user-event`, mock `fetch`)
- [x] `packages/frontend/src/components/submit-cv/__tests__/CvUploadField.spec.ts` — unit test `isAcceptedCvFile`
- [x] `packages/frontend/src/app/api/submit-cv/route.spec.ts` — unit test mock API (`@jest-environment node`)
- [x] `packages/shared/src/utils/validation.utils.spec.ts` — unit test `isValidEmail`
- [x] Backend: sửa `users.service.spec.ts` / `users.controller.spec.ts` (mock `UsersRepository` / `UsersService`)

Chạy: `npx jest` trong từng package (Node ≥ 20.9). Backend cần `npx prisma generate` trước khi test.

---

## Kiểm tra (Verification)

- [x] `next build --webpack` pass (bao gồm type check)
- [x] API: đủ field → 200 `success: true`; thiếu field, `cv` không phải file, hoặc file > 10MB → 400 (đã test bằng curl)
- [ ] Chạy `npm run dev`, vào `http://localhost:3000/submit-cv`
- [x] Form render đủ 4 field (Name, Email, Position, Upload) — đã kiểm tra HTML render
- [ ] Chọn position → requirements hiện đúng
- [ ] Submit thiếu field → lỗi validation hiện ra
- [ ] Điền đủ + upload file → submit → hiện "Submit CV successfully" + button "Back to home"
- [ ] Nhấn "Back to home" → về trang chủ `/`
- [ ] Chọn file > 10MB → hiện "File size must not exceed 10MB"
- [ ] Upload `.docx` trên máy không có MIME type → không bị báo sai định dạng
- [ ] Tắt mạng / API lỗi → hiện "Failed to submit CV. Please try again.", form giữ dữ liệu
- [ ] Kiểm tra network tab: request `POST /api/submit-cv` với FormData đúng
