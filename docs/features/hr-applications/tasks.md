# Tasks: Đơn ứng tuyển cho HR

Feature branch: `feature/hr-applications` (tách từ `feature/hr-auth`; merge sau các PR trước)
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Phân tích & scenario

- [x] Chốt RQ1 (quyết định chốt luôn), RQ2 (ghi chú không bắt buộc), RQ3 (tab theo giai đoạn), RQ4 (CV nhúng trong trang) (2026-11-07)
- [x] Scenario AC-1 → AC-18 trong [requirements.md](./requirements.md)
- [ ] Bạn review scenario

## Làm

- [ ] Shared: route, tham số danh sách, mã lỗi, type danh sách / chi tiết / quyết định
- [ ] Backend: `CvStorage.download` (local + Google Drive); module `hr-applications` (repository, service, controller)
- [ ] Frontend: helper gọi backend phía server (chuyển tiếp cookie); trang `/hr` (danh sách), `/hr/applications/[id]` (chi tiết, CV, hộp thoại); từ điển vi / en
- [ ] Test theo bảng "Kiểm thử"
- [ ] Docs: project-overview (D33, lộ trình 3.2), CLAUDE.md nếu có quy ước mới

## Kiểm chứng

- [ ] AC-1 → AC-18
