# Tasks: Submit CV Page

Feature branch: `feature/submit-cv`  
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Documentation

- [x] Tạo `docs/features/submit-cv/requirements.md`
- [x] Tạo `docs/features/submit-cv/tasks.md`

---

## Data & Constants

- [ ] Tạo `packages/frontend/src/data/positions.ts`
  - Định nghĩa interface `Position { id, title, requirements[] }`
  - Export mảng `POSITIONS` với 3 vị trí hardcode

---

## Mock API

- [ ] Tạo `packages/frontend/src/app/api/submit-cv/route.ts`
  - POST handler nhận `FormData`
  - Validate có đủ các field: `name`, `email`, `position`, `cv`
  - Trả `{ success: true, message: "Submit CV successfully" }` nếu hợp lệ
  - Trả `{ success: false, message: "Missing fields" }` (400) nếu thiếu field

---

## Components

- [ ] Tạo `packages/frontend/src/components/submit-cv/PositionSelect.tsx`
  - Props: `value: string`, `onChange: (id: string) => void`
  - Render `<select>` với danh sách từ `POSITIONS`
  - Hiện placeholder "Select a position" khi chưa chọn

- [ ] Tạo `packages/frontend/src/components/submit-cv/PositionRequirements.tsx`
  - Props: `positionId: string`
  - Tìm position trong `POSITIONS` theo `positionId`
  - Hiện danh sách requirements dạng bullet list
  - Không render gì nếu `positionId` rỗng

- [ ] Tạo `packages/frontend/src/components/submit-cv/CvUploadField.tsx`
  - Props: `onChange: (file: File | null) => void`, `error?: string`
  - File input chấp nhận `.pdf,.doc,.docx`
  - Hiện tên file đã chọn
  - Hiện error message nếu có

- [ ] Tạo `packages/frontend/src/components/submit-cv/SubmitCvForm.tsx`
  - Quản lý state: `name`, `email`, `positionId`, `cvFile`, `submitted`, `loading`, `errors`
  - Validate trước khi submit (dùng `isValidEmail` từ `@org/shared`)
  - Submit: `FormData` + `fetch('/api/submit-cv', { method: 'POST' })`
  - Khi success: hiện thông báo "Submit CV successfully"

---

## Page

- [ ] Tạo `packages/frontend/src/app/submit-cv/page.tsx`
  - Metadata: `title: "Submit CV"`
  - Render `<SubmitCvForm />`

---

## Kiểm tra (Verification)

- [ ] Chạy `npm run dev`, vào `http://localhost:3000/submit-cv`
- [ ] Form render đủ 4 field (Name, Email, Position, Upload)
- [ ] Chọn position → requirements hiện đúng
- [ ] Submit thiếu field → lỗi validation hiện ra
- [ ] Điền đủ + upload file → submit → hiện "Submit CV successfully"
- [ ] Kiểm tra network tab: request `POST /api/submit-cv` với FormData đúng
