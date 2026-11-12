# Feature: Giao diện dùng được trên điện thoại

## Mục tiêu

Mọi trang (công khai và khu HR) đọc và thao tác được trên điện thoại (từ 360px chiều ngang): không phải kéo ngang cả trang, chạm bấm dễ, bảng thành thẻ, menu gọn. Trên máy tính (≥ 768px) giao diện **giữ nguyên như hiện nay**.

Hiện trạng (khảo sát 2026-11-12): chỉ có vài lớp `sm:` / `md:` rải rác; thanh menu xếp ngang một hàng; 5 bảng của khu HR (danh sách đơn, danh sách job, danh mục, tiêu chí, điểm từng tiêu chí) rộng quá màn hình nhỏ; chi tiết đơn nhúng PDF bằng iframe cao 80% màn hình (điện thoại thường chỉ hiện được trang đầu của PDF và không cuộn được); ô nhập chữ nhỏ 14px làm iPhone tự phóng to khi chạm vào.

Bối cảnh: [fe-public-pages](../fe-public-pages/requirements.md), [hr-auth](../hr-auth/requirements.md), [hr-applications](../hr-applications/requirements.md), [hr-positions](../hr-positions/requirements.md).

---

## Phạm vi

- **Trang công khai:** `/`, `/jobs`, `/submit-cv`, `/privacy`, header, footer.
- **Khu HR:** `/hr/login`, `/hr` (danh sách đơn), `/hr/applications/[id]`, `/hr/positions`, `/hr/positions/new`, `/hr/positions/[id]`, `/hr/catalog`, header, các hộp thoại.
- **Công cụ:** `npm run mobile:check` chụp ảnh và đo tràn ngang ở màn hình điện thoại bằng Chrome headless.
- **Không làm:** thiết kế lại giao diện máy tính; chế độ tối; ứng dụng cài đặt được (PWA); thay đổi chữ / bố cục theo hướng xoay ngang riêng; thay đổi API hay dữ liệu.

### Quy ước

| Tên | Giá trị | Ghi chú |
|-----|---------|---------|
| Màn hình nhỏ | **< 768px** (dưới `md` của Tailwind) | bảng thành thẻ, menu thu gọn |
| Màn hình rất nhỏ | **< 640px** (dưới `sm`) | nút hộp thoại xếp dọc, ô nhập 16px |
| Màn hình kiểm | 360, 375 và 390px | các cỡ điện thoại phổ biến |
| Vùng chạm tối thiểu | **44 × 44px** | các nút và liên kết chính |

**Cách làm (một DOM, chỉ đổi bằng CSS):** không nhân đôi nội dung cho mobile và desktop (tránh trùng chữ, trùng liên kết cho trình đọc màn hình và cho test). Bảng vẫn là `<table>` có `role` tường minh; dưới 768px các `tr` hiển thị như thẻ và mỗi ô có `data-label` hiện nhãn cột.

---

## Acceptance Criteria

### Nền tảng

#### AC-1: Không tràn ngang

**Given:** điện thoại rộng 360, 375 hoặc 390px
**When:** mở bất kỳ trang nào của phạm vi (có dữ liệu thật: tên dài, email dài, mã job dài, tiêu đề tiếng Việt dài)
**Then:**
- Trang **không** có thanh cuộn ngang (chiều rộng nội dung ≤ chiều rộng màn hình); chữ dài tự xuống dòng (email, tên file CV, mã job).
- Có `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Không có phần tử nào ngoài mép phải màn hình (trừ vùng được cuộn ngang có chủ đích: không còn vùng nào như vậy sau AC-4 → AC-7).

### Menu

#### AC-2: Header công khai thu gọn

**Given:** màn hình nhỏ (< 768px)
**Then:**
- Header chỉ có: tên dự án, nút chuyển ngôn ngữ **VI | EN** (luôn hiện, không nằm trong menu) và nút **menu** (☰).
- Danh sách mục (Trang chủ, Việc làm) ẩn; bấm nút menu → hiện thành một cột dưới header; bấm lại → ẩn. Nút có `aria-expanded` đúng, `aria-controls` trỏ tới danh sách, nhãn "Mở menu" / "Đóng menu" (vi / en).
- Bấm một mục (đi sang trang khác) hoặc nhấn **Esc** → menu đóng; nhấn Esc trả focus về nút menu.
- Mục của trang hiện tại có `aria-current="page"`.

**Given:** màn hình ≥ 768px
**Then:** không có nút menu; các mục hiện ngang như hiện nay.

#### AC-3: Header HR thu gọn

**Given:** màn hình nhỏ, HR đã đăng nhập
**Then:**
- Header: tên dự án + nhãn "HR", **VI | EN** và nút menu.
- Menu mở ra: 3 mục (Đơn ứng tuyển, Job, Danh mục — mục hiện tại tô đậm và `aria-current`), dòng "Đăng nhập: {tên}" và nút **Đăng xuất**; hành vi đóng / Esc như AC-2; đăng xuất giữ nguyên (AC-12 của hr-auth).
- Chưa đăng nhập (`/hr/login`): chỉ có tên dự án + VI | EN (không có nút menu).
- ≥ 768px: như hiện nay.

### Bảng thành thẻ

#### AC-4: Danh sách đơn ứng tuyển (`/hr`)

**Given:** màn hình nhỏ
**Then:**
- Mỗi đơn là **một thẻ**: tên ứng viên (liên kết sang chi tiết, giữ `?from=`) + email ở trên; các dòng "Vị trí / Ngày nộp / Trạng thái / Điểm AI" có nhãn bên trái, giá trị bên phải; nhãn "Chưa gửi email" (nếu có) nằm cạnh trạng thái.
- Hàng tiêu đề của bảng ẩn trực quan; thông tin, liên kết, thứ tự, số lượng **giống hệt** bản máy tính.
- Tab (Cần quyết định / Đang chờ chấm / Đã quyết định / Tất cả, kèm số) xuống dòng gọn, không bị cắt; form lọc một cột; nút **Tìm** rộng hết dòng; phân trang vẫn thấy cả "Trước", số trang, "Sau" trên một hàng.

**Given:** ≥ 768px: bảng như hiện nay.

#### AC-5: Danh sách job (`/hr/positions`)

**Then:** như AC-4: mỗi job một thẻ (tên job liên kết, mã, nhóm · level, trạng thái, số tiêu chí, số đơn liên kết sang danh sách, ngày cập nhật); nút **Tạo job** và các tab trạng thái dùng được bằng một tay; ≥ 768px như hiện nay.

#### AC-6: Danh mục và tiêu chí

**Given:** màn hình nhỏ
**Then:**
- **Danh mục nhóm / level** (`/hr/catalog`) và **tiêu chí của job** (`/hr/positions/[id]`): mỗi dòng là một thẻ có nhãn cột; các nút hành động (Sửa, Ẩn / Hiện, Lên, Xuống, Xoá) xuống dòng nằm trong thẻ, mỗi nút ≥ 44px; mô tả dài của tiêu chí xuống dòng.
- Form job (`PositionForm`): các ô xếp một cột, nhãn ở trên ô; nút Lưu / Huỷ rộng hết dòng.
- Hành vi, nhãn `aria-label` của từng nút ("Sửa: NestJS") không đổi.

#### AC-7: Chi tiết đơn (`/hr/applications/[id]`)

**Given:** màn hình nhỏ
**Then:**
- Phần đầu (tên, email, job, ngày nộp, trạng thái) xuống dòng, email / tên file dài không làm tràn.
- Nút **Nhận**, **Từ chối**, **Đánh giá lại** xếp thành cột rộng hết dòng (hoặc hai nút một hàng nếu vừa), mỗi nút ≥ 44px cao.
- **Điểm từng tiêu chí** (bảng 6 cột) thành thẻ: tên tiêu chí + nhãn "Bắt buộc", điểm `x/10` nổi bật, loại, trọng số, "Vì sao", "Từ CV".
- **CV:** không hiện khung nhúng PDF (điện thoại không cuộn được PDF trong khung); thay bằng hai nút lớn **Mở trong tab mới** và **Tải về** (cùng đường dẫn như bây giờ). ≥ 768px: khung nhúng như hiện nay.
- Mục "Email kết quả", lịch sử trạng thái, "Đơn khác của ứng viên" xuống dòng gọn.

### Hộp thoại và form

#### AC-8: Hộp thoại

**Given:** màn hình nhỏ
**Then:** mọi hộp thoại (`HrDialog`, hộp thoại Nhận / Từ chối / Đánh giá lại, Gửi lại email):
- Vừa màn hình: tối đa 90% chiều cao thấy được (tính cả thanh địa chỉ co giãn của trình duyệt), nội dung dài (bản xem trước email) cuộn **bên trong** hộp thoại, không cuộn trang nền; lề trái / phải ≥ 8px.
- < 640px: nút **Huỷ / Xác nhận** xếp dọc, rộng hết dòng, nút chính ở trên; ≥ 640px: như hiện nay.
- Vai trò `dialog`, focus vào hộp thoại, Esc, trả focus về nút mở: **không đổi**.
- Bản xem trước email: chữ tự xuống dòng, người nhận / tiêu đề dài không làm tràn.

#### AC-9: Ô nhập và vùng chạm

**Then:**
- Trên màn hình < 640px mọi ô `input`, `select`, `textarea` có cỡ chữ **16px** (iPhone không tự phóng to khi chạm); ≥ 640px giữ cỡ hiện nay.
- Nút và liên kết chính cao ≥ 44px: nút menu, VI | EN, nút gửi form, nút trong thẻ, nút hộp thoại, liên kết vào chi tiết đơn / job (cả thẻ, không chỉ chữ).
- Không có phần tử nào dựa vào **hover** để dùng được.

### Trang công khai

#### AC-10: Trang công khai

**Given:** màn hình nhỏ
**Then:**
- **Trang chủ:** tiêu đề, mô tả, 3 bước xếp một cột; nút chính rộng hết dòng.
- **/jobs:** thẻ job một cột, nút "Ứng tuyển" rộng hết dòng; mô tả job dài xuống dòng.
- **/submit-cv:** form một cột; ô chọn job, ô tải CV (có nút "Chọn file" ≥ 44px, tên file dài cắt gọn nhưng không tràn), ô đồng ý chính sách (vùng chạm cả dòng), nút **Nộp CV** rộng hết dòng; thông báo lỗi hiện ngay dưới từng ô; phần mô tả job (Markdown) không tràn (bảng, khối mã trong mô tả cuộn ngang trong khung riêng).
- **/privacy:** chữ dễ đọc (cỡ ≥ 16px, dòng không quá rộng), tiêu đề xuống dòng.
- **Footer:** xếp dọc.
- **/hr/login:** form vừa màn hình, ô nhập 16px, nút rộng hết dòng.

### Không hỏng giao diện máy tính

#### AC-11: Máy tính giữ nguyên

**Given:** màn hình ≥ 768px
**Then:** bố cục giống bản hiện tại: bảng (không phải thẻ), menu ngang, khung nhúng PDF cạnh kết quả AI, hộp thoại như cũ; toàn bộ test hiện có vẫn pass (một DOM nên không có trùng chữ / liên kết); nội dung và thứ tự các cột không đổi.

### Công cụ

#### AC-12: `npm run mobile:check`

**When:** chạy `npm run mobile:check` (cần Chrome; dùng backend + frontend đang chạy, URL qua `MOBILE_CHECK_URL`, mặc định `http://localhost:3000`; đăng nhập HR bằng `SEED_HR_EMAIL` / `SEED_HR_PASSWORD` trong `.env`)
**Then:** với từng cỡ 360 / 375 / 390px × từng trang của phạm vi (trang HR có dữ liệu thật; trang chi tiết đơn lấy từ danh sách):
- Đo **chiều rộng nội dung ≤ chiều rộng màn hình** và liệt kê phần tử vượt mép phải (chọn tên, kích thước), phát hiện ô nhập có cỡ chữ < 16px và nút / liên kết cao < 44px trong các vùng chính; in ✓ / ✗ từng trang và thoát ≠ 0 nếu có lỗi.
- Chụp ảnh từng trang vào `tmp/mobile/<cỡ>/<trang>.png` (đã trong `.gitignore`) để người xem soát bằng mắt.
- Thiếu Chrome hoặc ứng dụng chưa chạy → nêu rõ, thoát ≠ 0; chỉ **đọc** dữ liệu và đăng nhập, không tạo hay sửa gì.

---

## Kiểm thử

Theo [CLAUDE.md — Feature workflow](../../../CLAUDE.md). Jest (jsdom) **không chạy CSS đáp ứng**, nên các test kiểm **cấu trúc** (thuộc tính `aria-*`, `data-label`, `role`, lớp Tailwind quyết định hiển thị theo breakpoint, hành vi bấm / Esc); phần nhìn thấy được kiểm bằng `mobile:check` trên Chrome thật.

| AC | Test |
|----|------|
| AC-1, AC-12 | `scripts/mobile/mobile-check.mjs` chạy thật (đo tràn ngang, cỡ chữ, vùng chạm, ảnh) · `viewport.spec.ts` (export `viewport` của root layout) |
| AC-2 | `components/layout/__tests__/site-header.feature` (nút menu, `aria-expanded` / `aria-controls`, mở / đóng, đóng khi bấm mục, Esc trả focus, `aria-current`, lớp ẩn / hiện theo breakpoint; vi / en) |
| AC-3 | `components/hr/__tests__/hr-nav.feature` (menu HR, tên người dùng và Đăng xuất trong menu, chưa đăng nhập không có nút menu) |
| AC-4, AC-5 | `app/hr/(protected)/__tests__/hr-applications-list.feature`, `positions/__tests__/…` (mỗi ô có `data-label` đúng nhãn cột, `role` tường minh của bảng, lớp thẻ / bảng; nội dung và liên kết không đổi) |
| AC-6 | `CatalogManager`, `CriteriaManager`, `PositionForm` features (nhãn cột, nút hành động, `aria-label` giữ nguyên) |
| AC-7 | `applications/[id]/__tests__/hr-application-detail.feature` (thẻ điểm, khung PDF ẩn dưới 768px nhưng vẫn có `title`, hai nút mở / tải về) |
| AC-8 | `components/hr/__tests__/hr-decision.feature`, `hr-email.feature`, `HrDialog.spec.tsx` (lớp giới hạn chiều cao, nút xếp dọc, hành vi không đổi) |
| AC-9 | `global-css.spec.ts` (quy tắc `font-size: 16px` cho `input` / `select` / `textarea` dưới 640px) · lớp `min-h-11` trên các nút chính (feature tương ứng) |
| AC-10 | `components/submit-cv/__tests__/submit-cv.feature`, `components/home`, `jobs`, `privacy` (cấu trúc cột, lớp) |
| AC-11 | toàn bộ test hiện có chạy lại (frontend 297) + so sánh ảnh chụp ≥ 768px trước / sau (xem `tasks.md`) |

---

## Quyết định (2026-11-12)

| # | Câu hỏi | Đã chốt |
|---|---------|---------|
| MQ1 | Phạm vi | **Cả trang công khai và khu HR** |
| MQ2 | Bảng của khu HR | **Thẻ trên điện thoại, bảng trên máy tính** |
| MQ3 | Menu | **Nút menu (hamburger)** mở danh sách; VI | EN luôn hiện ngoài menu |
| MQ4 | Kiểm tra | **Test cấu trúc + ảnh chụp giả lập điện thoại** (`mobile:check`, Chrome headless); bạn xem thêm trên điện thoại thật |
| — | Mốc đổi bố cục | `md` = **768px** (thẻ / menu), `sm` = **640px** (nút hộp thoại, cỡ chữ ô nhập) |
| — | Cách làm bảng | **Một DOM**, đổi bằng CSS (`role` tường minh + `data-label`), không nhân đôi nội dung |
| — | CV trên điện thoại | Không nhúng PDF; hai nút **Mở** và **Tải về** |

### Ghi chú kỹ thuật

- Tailwind **3.4.3** (`tailwind.config`), `global.css` là nơi đặt quy tắc chung (cỡ chữ ô nhập). Lớp tùy biến cho thẻ (nhãn từ `data-label`) viết bằng `before:content-[attr(data-label)]`.
- `display: block` trên `<table>` làm mất vai trò bảng trong Safari / Chrome nếu không có `role` tường minh: thêm `role="table|rowgroup|row|columnheader|cell"`; hàng tiêu đề dùng `sr-only` (không `display: none`) để trình đọc màn hình vẫn đọc được.
- Menu cần thành phần client (`'use client'`) cho `SiteHeader` / `HrHeader`; `SiteHeader` hiện là Server Component nên tách phần nút menu thành một Client Component nhỏ, phần còn lại giữ nguyên.
- `100vh` trên điện thoại gồm cả thanh địa chỉ nên hộp thoại dùng `max-h-[90dvh]` (kèm dự phòng `90vh`).
- iframe PDF dùng `hidden md:block` (vẫn có trong DOM và `title`, để test và trình đọc màn hình không đổi).
- **Rủi ro:** các test hiện có tìm ô bảng theo `role="cell"` và `closest('tr')`; vì có `role` tường minh nên vẫn chạy. Các `getByText` không bị trùng vì một DOM.
- `mobile:check` cần Chrome (có ở `/Applications/Google Chrome.app`); dùng `puppeteer-core` (không tải trình duyệt) hoặc Chrome DevTools Protocol trực tiếp: chốt khi làm.
