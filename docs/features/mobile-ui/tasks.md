# Tasks: Giao diện dùng được trên điện thoại

Feature branch: `feature/mobile-ui` (tách từ `main`, 2026-11-12)
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Phân tích & scenario

- [x] Khảo sát hiện trạng (header, 5 bảng, iframe PDF, cỡ chữ ô nhập) (2026-11-12)
- [x] Chốt MQ1 (cả công khai và HR), MQ2 (thẻ trên điện thoại), MQ3 (hamburger), MQ4 (test cấu trúc + ảnh chụp) (2026-11-12)
- [x] Scenario AC-1 → AC-12 trong [requirements.md](./requirements.md)
- [ ] Bạn review scenario

## Làm

- [ ] `viewport` của root layout; `global.css` (ô nhập 16px dưới 640px); tiện ích dùng chung cho bảng thành thẻ
- [ ] Header công khai + header HR: nút menu (Client Component), VI | EN luôn hiện, đóng khi bấm mục / Esc
- [ ] Bảng thành thẻ: danh sách đơn, danh sách job, danh mục, tiêu chí, điểm từng tiêu chí (`role` + `data-label`)
- [ ] Chi tiết đơn: phần đầu, nút quyết định, thẻ điểm, thay khung PDF bằng hai nút trên điện thoại
- [ ] Hộp thoại (`HrDialog`, quyết định, gửi lại email): chiều cao `dvh`, nút xếp dọc dưới 640px
- [ ] Trang công khai (trang chủ, /jobs, /submit-cv, /privacy, footer) và /hr/login
- [ ] Vùng chạm ≥ 44px cho các nút và liên kết chính
- [ ] `scripts/mobile/mobile-check.mjs` + `npm run mobile:check`
- [ ] Test theo bảng "Kiểm thử"; chụp ảnh ≥ 768px trước / sau để chắc máy tính không đổi
- [ ] Docs: CLAUDE.md, project-overview (D37)

## Kiểm chứng

- [ ] AC-1 → AC-12: test tự động, `mobile:check` (ảnh 360 / 375 / 390px)
- [ ] Bạn xem trên điện thoại thật
