# Tasks: Quản lý job, tiêu chí và danh mục cho HR

Feature branch: `feature/hr-positions` (tách từ `feature/hr-applications`; merge sau các PR trước)
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Phân tích & scenario

- [x] Chốt PQ1 (sửa tiêu chí có cảnh báo), PQ2 (trạng thái tự do), PQ3 (xoá job chưa có đơn, nhóm / level chỉ ẩn), PQ4 (mã tự sinh, không đổi) (2026-11-07)
- [x] Scenario AC-1 → AC-19 trong [requirements.md](./requirements.md)
- [ ] Bạn review scenario

## Làm

- [ ] Shared: route, hằng số / giới hạn, mã lỗi, type
- [ ] Backend: module `hr-positions` (job, tiêu chí, danh mục), sinh mã (`slug`)
- [ ] Frontend: menu HR, `/hr/positions`, `/hr/positions/new`, `/hr/positions/[id]`, `/hr/catalog`; từ điển vi / en
- [ ] Test theo bảng "Kiểm thử"
- [ ] Docs: project-overview (D34, lộ trình 3.3), CLAUDE.md nếu có quy ước mới

## Kiểm chứng

- [ ] AC-1 → AC-19
