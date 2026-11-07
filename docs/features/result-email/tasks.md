# Tasks: Email kết quả cho ứng viên

Feature branch: `feature/result-email` (tách từ `feature/hr-positions`; merge sau các PR trước)
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Phân tích & scenario

- [x] Chốt EQ1 (Gmail), EQ2 (lưu ngôn ngữ lúc nộp), EQ3 (gửi ngay khi xác nhận), EQ4 (nội dung không có điểm) (2026-11-07)
- [x] Scenario AC-1 → AC-14 trong [requirements.md](./requirements.md)
- [ ] Bạn review scenario
- [ ] Bạn tạo Gmail **App Password** và điền `SMTP_*`, `MAIL_FROM` vào `.env` (cần cho bước chạy thật qua Gmail; các test tự động và bước thử bằng máy chủ SMTP giả không cần)

## Làm

- [ ] Prisma: cột `applications.locale` + migration (CHECK)
- [ ] Shared: field `locale` của form, hằng số / mã lỗi mới, type
- [ ] Backend: nhận `locale` ở `POST /api/applications`; module `mail` (cấu hình, mẫu, gửi); `hr-applications` (preview, gửi sau khi quyết định, gửi lại, trạng thái email)
- [ ] Frontend: form nộp CV gửi `locale`; hộp thoại có xem trước; trạng thái email + Gửi lại; nhãn ở danh sách; từ điển vi / en
- [ ] `scripts/mail/mail-check.mjs` + npm script `mail:check`
- [ ] Test theo bảng "Kiểm thử"
- [ ] Docs: project-overview (D35, lộ trình Phase 4), `.env.example`, CLAUDE.md

## Kiểm chứng

- [ ] AC-1 → AC-14
