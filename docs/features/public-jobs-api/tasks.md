# Tasks: API công khai cho job

Feature branch: `feature/public-jobs-api`
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Shared (`@org/shared`)

- [x] `types/position.types.ts`: `CriterionType`, `IJobCategory`, `IJobLevel`, `IPublicCriterion`, `IPublicPositionSummary`, `IPublicPositionDetail`; export trong `types/index.ts`
- [x] `API_ROUTES`: thêm `POSITIONS`, `JOB_CATEGORIES`, `JOB_LEVELS` (controller mới dùng hằng số này thay vì chuỗi)

## Backend

- [x] Module `positions` (controller / service / repository / module, cùng cấu trúc với module `users`)
  - `GET /positions?category=&level=`: chỉ `OPEN`, `created_at` giảm dần, so mã không phân biệt hoa thường
  - `GET /positions/:code`: 404 `Position not found` nếu không có hoặc không `OPEN`
  - Repository chỉ select cột công khai (`PUBLIC_POSITION_SELECT`)
  - Query param trống hoặc bị lặp (`?level=a&level=b`) → bỏ qua, không lọc
- [x] Module `job-catalog`: `GET /job-categories`, `GET /job-levels` — `is_active` + có job `OPEN`, sắp theo `sort_order`
- [x] Đăng ký 2 module trong `AppModule` (GitNexus impact: LOW, chỉ `main.ts` phụ thuộc)

## Tests

- [x] Unit test repository / service / controller cho cả 2 module (5 file, 14 test), gồm 404 và lọc theo mã
- [x] Test query chỉ select cột công khai (AC-1) — `positions.repository.spec.ts`
- [x] Backend 36/36 pass; `tsc -b` + `nx build @org/backend` sạch; test `shared` / `frontend` không bị ảnh hưởng
- [x] Kiểm tra trên DB thật bằng `curl` (tạm thêm job `DRAFT`, `CLOSED`, 1 job `OPEN` thuộc nhóm đã ẩn — đã xoá sau khi kiểm tra):
  - AC-1: chỉ job `OPEN`, mới nhất trước, không có trường nội bộ
  - AC-2: `developer` = `DEVELOPER`; mã không tồn tại → `[]`
  - AC-3: chi tiết có JD; `DRAFT` / `CLOSED` / không tồn tại → 404
  - AC-4: bộ lọc chỉ còn `DEVELOPER`, `MIDDLE` (nhóm ẩn và level chỉ có job đóng bị loại)
  - AC-5: job `OPEN` thuộc nhóm đã ẩn vẫn hiện trong danh sách

## Docs

- [x] `requirements.md` + quyết định PQ1–PQ4
- [x] Liên kết feature trong `phase-1-foundation/requirements.md` và roadmap `project-overview.md`
