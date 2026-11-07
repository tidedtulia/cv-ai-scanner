# Tasks: Quản lý job, tiêu chí và danh mục cho HR

Feature branch: `feature/hr-positions` (tách từ `feature/hr-applications`; merge sau các PR trước)
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Phân tích & scenario

- [x] Chốt PQ1 (sửa tiêu chí có cảnh báo), PQ2 (trạng thái tự do), PQ3 (xoá job chưa có đơn, nhóm / level chỉ ẩn), PQ4 (mã tự sinh, không đổi) (2026-11-07)
- [x] Scenario AC-1 → AC-19 trong [requirements.md](./requirements.md)
- [x] Bạn review scenario (2026-11-07)

## Làm

- [x] Shared: `hr-positions.constants.ts` (giới hạn, mã lỗi), `hr-positions.types.ts`, `slug.utils.ts` (sinh mã bỏ dấu tiếng Việt), route `HR_POSITIONS / HR_JOB_CATEGORIES / HR_JOB_LEVELS`
- [x] Backend: module `hr-positions` — `HrPositionsRepository` (transaction cho xoá có điều kiện, thêm / xoá / đổi chỗ tiêu chí), `HrPositionsService`, `HrCriteriaService`, `HrCatalogRepository` + `HrCatalogService`, 2 controller (13 route)
- [x] Frontend: menu trong `HrHeader`; `lib/hr-errors.ts`, `hrRequest` (JSON); `HrDialog`; `PositionForm`, `PositionActions`, `CriteriaManager`, `CatalogManager`, `PositionStatusBadge`; trang `/hr/positions`, `/hr/positions/new`, `/hr/positions/[id]`, `/hr/catalog`; từ điển `hrNav`, `hrPositions`, `hrCatalog` vi / en
- [x] Test theo bảng "Kiểm thử"
- [x] Docs: project-overview (D34, lộ trình 3.3), CLAUDE.md

## Kiểm chứng (2026-11-07)

- [x] Test: shared 20/20 (+10 `slug.utils`), backend 271/271 (31 suite; hr-positions 85 gồm HTTP spec), frontend 270/270 (29 suite; thêm `hr-nav` 5, `hr-positions` 18, `hr-position-edit` 28, `hr-catalog` 11, `hr-errors`, `dictionaries`). Type-check code + test sạch; lint không có finding nào ngoài `enforce-module-boundaries` có sẵn; `next build --webpack` sạch (4 route mới)
- [x] Chạy thật qua bản build production của Next.js (cổng 3010) → backend build → DB dev + Google Drive thật + n8n / MCP thật (49 mục đều đạt, dữ liệu thử đã xoá; 3 job, 9 tiêu chí, 7 nhóm, 7 level và đơn thật của bạn còn nguyên):
  - AC-9 → AC-11: nhóm "Quản lý sản phẩm HRPROBE" → mã `QUAN_LY_SAN_PHAM_HRPROBE`; trùng tên khác chữ hoa → 409; level đặt thứ tự 35 chen giữa Junior và Middle; mã sai → 400; ẩn nhóm đang dùng → rời bộ lọc `/jobs` nhưng job giữ tên nhóm; đổi tên hiện ngay ở trang công khai
  - AC-2: tiêu đề tiếng Việt → `lap-trinh-vien-backend-hrprobe`, tạo lại → `-2`; mã gõ tay trùng → 409; 51 năm → 400; nhóm ẩn không chọn được cho job mới
  - AC-5: DRAFT không có trên API công khai; mở khi chưa có tiêu chí → 409 `CRITERIA_REQUIRED`; mở → 200; **một ứng viên nộp CV thật vào job mới qua form công khai (201, file lên Drive)**; đóng job → nộp tiếp bị `POSITION_NOT_OPEN`; mở lại và về nháp đều được
  - AC-7 / AC-8: thêm tiêu chí (cuối danh sách, hướng dẫn được cắt khoảng trắng), loại sai → 400, đổi chỗ lên / xuống (tiêu chí đầu đi lên không đổi), sửa chỉ đổi trọng số; tiêu chí cuối của job `OPEN` → 409 `LAST_CRITERION`, job nháp thì xoá được
  - AC-4 / AC-6: job có đơn: sửa JD → 200 + `warning: HAS_APPLICATIONS`, chỉ sửa tiêu đề → không cảnh báo và mã không đổi; xoá → 409 kèm số đơn; job không có đơn xoá được (tiêu chí cũng mất)
  - AC-19: job `OPEN` hiện ở `/api/positions` với tiêu chí chỉ có tên + loại; **tool MCP `get_position_requirements` thấy ngay tiêu chí mới, trọng số, cờ bắt buộc và level mới**
  - AC-12 → AC-17: 4 trang render đủ nội dung, menu có trong header; `mcp:check` và `n8n:check` vẫn pass
- [ ] Bạn thử trên trình duyệt: http://localhost:3000/hr/positions và /hr/catalog (cần chạy lại `npm run dev`)

## Còn lại

- [ ] Thống kê theo nhóm / level, xem trước trang công khai của job, nhân bản job (ngoài phạm vi, ý tưởng sau MVP)
- [ ] Phase 4: email kết quả cho ứng viên
