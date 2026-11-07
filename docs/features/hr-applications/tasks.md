# Tasks: Đơn ứng tuyển cho HR

Feature branch: `feature/hr-applications` (tách từ `feature/hr-auth`; merge sau các PR trước)
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Phân tích & scenario

- [x] Chốt RQ1 (quyết định chốt luôn), RQ2 (ghi chú không bắt buộc), RQ3 (tab theo giai đoạn), RQ4 (CV nhúng trong trang) (2026-11-07)
- [x] Scenario AC-1 → AC-18 trong [requirements.md](./requirements.md)
- [x] Bạn review scenario (2026-11-07)

## Làm

- [x] Shared: `hr-applications.constants.ts` (tab → trạng thái, kích thước trang, mã lỗi), `hr-applications.types.ts`, `API_ROUTES.HR_APPLICATIONS / HR_APPLICATION_FILTERS`
- [x] Backend: `CvStorage.download` (local + Google Drive, `downloadFile` ở client Drive); module `hr-applications` (repository SQL có tham số + so sánh-và-ghi trong transaction, service, controller, PDF inline với tên file tiếng Việt); `api-error.ts` cho phép field phụ
- [x] Frontend: `lib/hr-backend.ts` (`hrBackendGet`), `lib/hr-list-url.ts`, `i18n/format-date.ts` (giờ Việt Nam); trang `/hr` (danh sách) và `/hr/applications/[id]`; `StatusBadges`, `DecisionActions` (hộp thoại, Esc, trả focus); từ điển `hrApplications.*` vi / en
- [x] Test theo bảng "Kiểm thử"; `test-utils/hr-api.mock.ts`, fixtures `hr*`
- [x] Docs: project-overview (D33, lộ trình 3.2, DQ5), CLAUDE.md

## Kiểm chứng (2026-11-07)

- [x] Test: backend 185/185 (26 suite; hr-applications 61 gồm HTTP spec), frontend 201/201 (24 suite; thêm `hr-applications-list` 10, `hr-application-detail` 12, `hr-decision` 14, `hr-list-url` + `format-date` + `hr-backend` unit), shared 10/10. Type-check code + test sạch; lint chỉ còn lỗi `enforce-module-boundaries` có sẵn và cảnh báo `!` trong file test; `next build --webpack` sạch (route `/hr/applications/[id]`)
- [x] Chạy thật qua bản build production của Next.js (cổng 3010) → backend build (3001) → DB dev + Google Drive thật, 3 đơn tạm (`hr-probe+…`, đã xoá sau khi thử; đơn thật còn nguyên `EVALUATED`, 1 kết quả AI):
  - AC-1 / AC-2: lọc theo tab + tìm kiếm; số đơn từng tab đúng; tìm "%" không khớp tất cả
  - AC-9 → AC-14, AC-18: trang `/hr` và chi tiết render đủ; đơn `SUBMITTED` không có nút quyết định; id lạ → trang "Không tìm thấy đơn"
  - AC-5: CV qua proxy Next.js → `application/pdf`, `%PDF-`, `private, no-store`
  - AC-6: `SUBMITTED` → 409 (kèm `currentStatus`); quyết định sai → 400; REJECTED + ghi chú "  …  " → 200, ghi chú đã cắt khoảng trắng, lịch sử có tên HR và `from = EVALUATED`; quyết định lần 2 → 409; **hai HR cùng lúc → 200 và 409**; AC-8: form HTML → 415
  - AC-7: đơn `EVALUATED` → `SUBMITTED`, lịch sử "HR yêu cầu đánh giá lại"; đơn `SUBMITTED` → 409
- [ ] Bạn thử trên trình duyệt: http://localhost:3000/hr (cần chạy lại `npm run dev`)

## Còn lại

- [ ] Phase 4: email kết quả sau khi quyết định (`result_email_sent_at`), xem trước email trong hộp thoại, "Gửi lại"
- [ ] Đơn `REJECTED` / `ACCEPTED` hiện chưa có chỗ để HR sửa lỡ tay (RQ1): xem lại khi làm Phase 4
