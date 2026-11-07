# Feature: Submit CV Page

> **Đã được thay thế một phần bởi [fe-public-pages](../fe-public-pages/requirements.md) (Phase 1.4):** dữ liệu và API thật, chỉ nhận PDF, hiện JD thay cho danh sách yêu cầu hardcode, checkbox đồng ý, giao diện song ngữ. Tài liệu dưới đây giữ nguyên để tham khảo phiên bản mock ban đầu.

## Mục tiêu

Cho phép ứng viên nộp CV đến hệ thống thông qua một form đơn giản trên web. Ứng viên điền thông tin cá nhân, chọn vị trí ứng tuyển, xem yêu cầu của vị trí đó, upload file CV và submit.

---

## Phạm vi

- **Frontend only** — trang `/submit-cv` trên Next.js
- Positions được hardcode trong frontend (không cần API)
- Submission gửi đến Next.js API Route mock (`POST /api/submit-cv`)
- Không lưu file thực tế vào storage (mock response)

---

## Acceptance Criteria

### AC-1: Hiển thị form khi vào trang

**Given:** Ứng viên điều hướng đến trang Submit CV (`/submit-cv`)  
**Then:** Ứng viên thấy một form gồm các trường:
- **Name** — text input, bắt buộc
- **Email** — text input (email), bắt buộc
- **Position** — dropdown select, bắt buộc
- **Upload CV** — file input (chấp nhận `.pdf`, `.doc`, `.docx`, tối đa 10MB), bắt buộc

---

### AC-2: Xem yêu cầu khi chọn vị trí

**Given:** Ứng viên đang ở trang Submit CV  
**When:** Ứng viên chọn một vị trí từ dropdown  
**Then:** Phần yêu cầu của vị trí đó hiện ra ngay bên dưới dropdown (danh sách dạng bullet)

---

### AC-3: Submit form thành công

**Given:** Ứng viên đang ở trang Submit CV  
**And:** Đã điền đầy đủ: Name, Email, Position, và đã upload file CV  
**When:** Ứng viên nhấn nút Submit  
**Then:**
- Form được thay bằng màn hình thông báo ứng tuyển thành công: **"Submit CV successfully"**
- Có button **"Back to home"** — nhấn vào điều hướng về trang chủ (`/`)

---

### AC-4: Validation phía client

**Given:** Ứng viên nhấn Submit khi chưa điền đủ thông tin  
**Then:**
- Trường Name trống → hiện lỗi "Name is required"
- Email trống → hiện lỗi "Email is required"
- Email không hợp lệ → hiện lỗi "Invalid email address"
- Chưa chọn Position → hiện lỗi "Please select a position"
- Chưa upload file → hiện lỗi "Please upload your CV"
- File không đúng định dạng → hiện lỗi "Only PDF, DOC, DOCX files are accepted" (kiểm tra theo đuôi file, vì một số OS không trả MIME type cho `.doc`/`.docx`)
- File lớn hơn 10MB → hiện lỗi "File size must not exceed 10MB" (API cũng kiểm tra lại, trả 400 với cùng message)
- Lỗi của một trường tự mất khi ứng viên sửa trường đó

---

### AC-5: Submit thất bại

**Given:** Form đã pass validation phía client
**When:** API trả lỗi (`success: false` / status lỗi) hoặc request bị lỗi mạng
**Then:**
- Hiện thông báo lỗi phía trên nút Submit: dùng `message` từ API nếu có, nếu không thì hiện "Failed to submit CV. Please try again."
- Form giữ nguyên dữ liệu đã nhập để ứng viên submit lại

---

## Mô tả UI

### Danh sách Positions (hardcode)

| ID | Tên vị trí | Requirements |
|----|-----------|--------------|
| `frontend-dev` | Frontend Developer | React / Next.js, TypeScript, Tailwind CSS |
| `backend-dev` | Backend Developer | NestJS, PostgreSQL, Prisma ORM |
| `fullstack-dev` | Fullstack Developer | React, NestJS, Docker |

### Luồng người dùng

```
Vào /submit-cv
  └─ Thấy form trống (Name, Email, Position, Upload)
      └─ Chọn position
          └─ Requirements hiện ra bên dưới dropdown
              └─ Upload file CV
                  └─ Điền Name + Email
                      └─ Nhấn Submit
                          ├─ [Validation fail] → Hiện lỗi tương ứng
                          └─ [Validation pass] → POST /api/submit-cv
                              ├─ Response success → "Submit CV successfully" + button "Back to home" → /
                              └─ Response lỗi / network error → Hiện lỗi, giữ form
```

---

## Stack kỹ thuật

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS
- **Bundler:** webpack (`next dev/build --webpack`) — Turbopack không resolve được import `.js` → `.ts` trong `@org/shared`
- **Validation:** Client-side thuần (dùng `isValidEmail()` từ `@org/shared`)
- **API:** Next.js API Route (mock)
- **Form submission:** Native `FormData` + `fetch`
