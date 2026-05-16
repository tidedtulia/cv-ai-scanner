# Feature: Submit CV Page

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
- **Upload CV** — file input (chấp nhận `.pdf`, `.doc`, `.docx`), bắt buộc

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
**Then:** Ứng viên thấy thông báo **"Submit CV successfully"**

---

### AC-4: Validation phía client

**Given:** Ứng viên nhấn Submit khi chưa điền đủ thông tin  
**Then:**
- Trường Name trống → hiện lỗi "Name is required"
- Email không hợp lệ → hiện lỗi "Invalid email address"
- Chưa chọn Position → hiện lỗi "Please select a position"
- Chưa upload file → hiện lỗi "Please upload your CV"
- File không đúng định dạng → hiện lỗi "Only PDF, DOC, DOCX files are accepted"

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
                              └─ Response success → "Submit CV successfully"
```

---

## Stack kỹ thuật

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS
- **Validation:** Client-side thuần (dùng `isValidEmail()` từ `@org/shared`)
- **API:** Next.js API Route (mock)
- **Form submission:** Native `FormData` + `fetch`
