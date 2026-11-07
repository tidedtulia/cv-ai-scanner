# Tasks: Đăng nhập HR

Feature branch: `feature/hr-auth` (tách từ `feature/n8n-evaluate-cv-workflow`; merge sau các PR của Phase 2)
Tham khảo yêu cầu chi tiết: [requirements.md](./requirements.md)

---

## Phân tích & scenario

- [x] Chốt PQ-3 (3 feature), HQ0 (cookie httpOnly), HQ1 (`@nestjs/jwt`), HQ2 (5 lần / 15 phút), HQ3 (`/api/hr/users`), HQ4 (8 giờ), Q11 (backend trả PDF), HR song ngữ (2026-11-07)
- [x] Phát hiện: `/api/users` đang mở cho mọi người và không có validation → sửa trong feature này
- [x] Scenario AC-1 → AC-14 trong [requirements.md](./requirements.md)
- [ ] Bạn review scenario
- [ ] Bạn thêm `JWT_SECRET` vào `.env` (`openssl rand -hex 32`) — backend sẽ không khởi động nếu thiếu

## Làm

- [ ] Shared: `API_ROUTES.AUTH_*`, `HR_*`, mã lỗi auth / users, DTO, `HR_SESSION_*`
- [ ] Backend: `@nestjs/jwt`; module `auth` (service, controller, guard, bộ đếm đăng nhập sai, config `JWT_SECRET`)
- [ ] Backend: `users` → `/api/hr/users` + validation + chặn tự xoá / tự khoá
- [ ] Frontend: `/hr/login`, layout `/hr` (kiểm phiên phía server), header HR, đăng xuất, xử lý 401; từ điển vi / en
- [ ] Test theo bảng "Kiểm thử"
- [ ] Docs: project-overview (D32, lộ trình 3.1), CLAUDE.md, `.env.example`

## Kiểm chứng

- [ ] AC-1 → AC-14
