# Feature: API công khai cho job (Phase 1 — bước 1.2)

## Mục tiêu

Cung cấp API **không cần đăng nhập** để trang `/jobs` và form `/submit-cv` lấy danh sách job đang tuyển cùng các danh mục để lọc. Đây là bước đầu tiên thay danh sách vị trí đang hardcode ở frontend (`packages/frontend/src/data/positions.ts`).

Bối cảnh: [project-overview.md §8](../../project-overview.md#8-các-trang-api--email-mvp) · DB: [database.md](../../database.md) · Feature trước: [phase-1-foundation](../phase-1-foundation/)

---

## Phạm vi

- Backend NestJS: 4 endpoint `GET` công khai (bên dưới).
- Shared (`@org/shared`): type cho response + hằng số route.
- **Chỉ trả dữ liệu công khai (D9):** tiêu chí chỉ có `name` + `type`; không trả `description` (hướng dẫn chấm), `weight`, `is_required`, `id` nội bộ, `status`.
- **Không làm ở feature này:**
  - API quản lý job cho HR (Phase 3).
  - Frontend gọi API, CORS / proxy (bước 1.4).
  - Nộp đơn (bước 1.3).

---

## API

| Method | Endpoint | Trả về |
|--------|----------|--------|
| GET | `/api/positions?category=<code>&level=<code>` | Danh sách job `OPEN` (tóm tắt) |
| GET | `/api/positions/:code` | Chi tiết 1 job `OPEN` (kèm JD) |
| GET | `/api/job-categories` | Nhóm vị trí đang dùng, cho bộ lọc |
| GET | `/api/job-levels` | Level đang dùng, cho bộ lọc |

### Dữ liệu trả về (dự kiến)

```jsonc
// GET /api/positions → IPublicPositionSummary[]
[
  {
    "code": "frontend-dev",
    "title": "Frontend Developer",
    "category": { "code": "DEVELOPER", "name": "Developer" },
    "level": { "code": "MIDDLE", "name": "Middle" },
    "minYearsExperience": 2,
    "criteria": [
      { "name": "React / Next.js", "type": "TECHNICAL" },
      { "name": "TypeScript", "type": "TECHNICAL" },
      { "name": "Tailwind CSS", "type": "TECHNICAL" }
    ]
  }
]

// GET /api/positions/frontend-dev → IPublicPositionDetail = summary + "description" (JD markdown)

// GET /api/job-categories, /api/job-levels → [{ "code": "DEVELOPER", "name": "Developer" }, …]
```

---

## Acceptance Criteria

### AC-1: Danh sách job

**When:** gọi `GET /api/positions`
**Then:**
- Chỉ có job `status = OPEN` (không có `DRAFT` / `CLOSED`).
- Job mới mở trước (`created_at` giảm dần); không phân trang — trả toàn bộ (PQ1, PQ2).
- Mỗi job có đúng các trường như ví dụ trên; `criteria` sắp theo `sort_order`.
- Không có trường nội bộ nào (`id`, `status`, `description` của tiêu chí, `weight`, `isRequired`…).

### AC-2: Lọc theo nhóm / level

- `?category=DEVELOPER` → chỉ job thuộc nhóm đó; `?level=SENIOR` tương tự; dùng cả 2 → thoả cả 2.
- Mã không tồn tại → mảng rỗng `[]` (không lỗi).
- So khớp mã không phân biệt hoa thường (`developer` = `DEVELOPER`).

### AC-3: Chi tiết job

- `GET /api/positions/frontend-dev` → giống 1 phần tử của AC-1 + `description` (JD markdown).
- Mã không tồn tại, hoặc job không ở trạng thái `OPEN` → **404** `Position not found` (để form không cho nộp vào job đã đóng).

### AC-4: Danh mục cho bộ lọc

- Chỉ trả mục `is_active = true` **và đang có ít nhất 1 job `OPEN`** (PQ3) → chọn bộ lọc nào cũng ra kết quả.
- Sắp theo `sort_order`; mỗi mục chỉ có `code` + `name`.

### AC-5: Job thuộc danh mục đã ẩn

- Job `OPEN` vẫn hiển thị dù nhóm / level của nó đã bị ẩn (`is_active = false`). "Ẩn" chỉ có nghĩa là không cho chọn khi tạo job mới và không có trong bộ lọc.

---

## Quyết định (2026-11-04)

| # | Câu hỏi | Đã chốt |
|---|---------|---------|
| PQ1 | Thứ tự danh sách job? | Job mới mở trước (`created_at` giảm dần) |
| PQ2 | Có cần phân trang? | Chưa — số job đang tuyển ít (vài chục) |
| PQ3 | Bộ lọc hiện danh mục nào? | Chỉ danh mục đang có job `OPEN` |
| PQ4 | Định danh job ở API công khai? | Chỉ dùng `code`, không lộ UUID. API nộp đơn (1.3) cũng nhận `code` |
