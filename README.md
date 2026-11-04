# 🚀 Project Setup Guide

Tài liệu này hướng dẫn bạn cách cài đặt và chạy dự án từ đầu.

---

## 📦 Yêu cầu hệ thống

Trước khi bắt đầu, hãy đảm bảo bạn đã cài đặt:

- Node.js (>= 18)
- npm hoặc yarn
- Docker & Docker Compose
- Git

---

## 📁 Cấu trúc dự án (tham khảo)



---

## ⚙️ Hướng dẫn cài đặt

### 1. Clone project

```bash
git clone <your-repo-url>
cd <project-folder>

npm install

POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=your_db
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/your_db

cd packages/backend
npx prisma generate
cd ../../
docker compose up
docker compose -f docker-compose.dev.yml up -d

npm run dev

npm start