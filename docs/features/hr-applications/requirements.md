# Feature: Đơn ứng tuyển cho HR (Phase 3 — bước 3.2)

## Mục tiêu

HR đã đăng nhập (bước 3.1) xem được các đơn ứng tuyển cùng kết quả AI chấm (WF-1), xem CV ngay trong trang, rồi **chốt kết quả** (Accept / Reject, kèm ghi chú) hoặc **yêu cầu đánh giá lại**. Email báo kết quả cho ứng viên thuộc Phase 4: ở bước này quyết định chỉ được lưu.

Bối cảnh: [project-overview.md §5 (vòng đời trạng thái), §8.2, §8.3](../../project-overview.md#82-trang-hr) (D5, D10, D12, D16, D32) · Bảng: [database.md §4.6 → §4.8](../../database.md#46-applications--đơn-ứng-tuyển) · Đăng nhập: [hr-auth](../hr-auth/requirements.md) · Kết quả AI: [n8n-evaluate-cv-workflow](../n8n-evaluate-cv-workflow/requirements.md)

---

## Phạm vi

- **Backend** — module `hr-applications`, mọi route nằm dưới `/api/hr` (guard đăng nhập của 3.1):

| Method | Endpoint | Dùng cho |
|--------|----------|----------|
| GET | `/api/hr/applications` | Danh sách: tab, lọc, tìm, sắp xếp, phân trang + số đơn của từng tab |
| GET | `/api/hr/application-filters` | Danh sách job (cả job đã đóng), nhóm, level cho bộ lọc |
| GET | `/api/hr/applications/:id` | Chi tiết: ứng viên, job, kết quả AI, lịch sử trạng thái, các đơn khác cùng email |
| GET | `/api/hr/applications/:id/cv` | File CV (PDF) lấy từ Google Drive / thư mục local |
| POST | `/api/hr/applications/:id/decision` | Chốt kết quả `ACCEPTED` / `REJECTED` + ghi chú |
| POST | `/api/hr/applications/:id/re-evaluate` | Đưa đơn về `SUBMITTED`, chấm lại ở lần chạy 00:00 kế tiếp |

- `CvStorage` thêm `download(fileId)` cho cả `google-drive` và `local`.
- **Frontend:**
  - `/hr`: danh sách đơn, thay cho lời chào của 3.1;
  - `/hr/applications/[id]`: chi tiết đơn, CV nhúng trong trang, hộp thoại quyết định / đánh giá lại;
  - song ngữ vi / en.
- **Không làm:** gửi email kết quả, xem trước email, "Gửi lại email" (Phase 4); quản lý job / tiêu chí / danh mục (3.3); "Đánh giá ngay" không chờ 00:00 (sau MVP); ghi chú tự do nhiều HR trao đổi (DQ5); xoá đơn.

---

## Acceptance Criteria

Mỗi AC là một scenario. "HR" là người đã đăng nhập (3.1); mọi API dưới đây khi không có phiên đều trả 401 như [hr-auth AC-6](../hr-auth/requirements.md).

### Trạng thái và quyền thao tác

Bảng dùng chung cho các AC bên dưới. Nhãn hiển thị (tiếng Việt / tiếng Anh):

| Trạng thái | Nhãn | Tab | Accept / Reject | Đánh giá lại |
|------------|------|-----|-----------------|--------------|
| `SUBMITTED` | Chờ chấm / Waiting for AI | Đang chờ chấm | Không | Không |
| `EVALUATING` | Đang chấm / Being evaluated | Đang chờ chấm | Không | Không |
| `EVALUATED` | Đã chấm / Evaluated | Cần quyết định | **Có** | **Có** |
| `EVALUATION_FAILED` | Chấm lỗi / Evaluation failed | Cần quyết định | **Có** (HR tự xem CV) | **Có** |
| `ACCEPTED` | Đã nhận / Accepted | Đã quyết định | Không | Không |
| `REJECTED` | Đã từ chối / Rejected | Đã quyết định | Không | Không |

`ACCEPTED` / `REJECTED` là trạng thái cuối: quyết định **không sửa được** (RQ1).

### Backend — danh sách

#### AC-1: Danh sách theo tab, kèm số đơn

**Given:** có đơn ở nhiều trạng thái
**When:** `GET /api/hr/applications?tab=<tab>`
**Then:**
- Chỉ trả các đơn thuộc tab (bảng trên); `tab` mặc định là `to-decide` (Cần quyết định). Các giá trị: `to-decide`, `pending`, `decided`, `all`.
- Mỗi dòng gồm: `id`, `fullName`, `email`, `status`, `createdAt` (ngày nộp), job (`code`, `title`, tên nhóm, tên level), và nếu đã có kết quả AI: `overallScore`, `recommendation`.
- Kèm `counts` = số đơn của **cả 4 tab**, tính theo cùng bộ lọc job / nhóm / level / khuyến nghị / tìm kiếm (không tính tab đang chọn).
- Kèm `total`, `page`, `pageSize` (20).

#### AC-2: Lọc, tìm, sắp xếp, phân trang

| Tham số | Ý nghĩa |
|---------|---------|
| `position` | mã job (cả job `CLOSED`) |
| `category`, `level` | mã nhóm / mã level của job |
| `recommendation` | `RECOMMENDED` / `CONSIDER` / `NOT_RECOMMENDED` (chỉ các đơn đã có kết quả AI) |
| `q` | tìm trong họ tên **hoặc** email, không phân biệt hoa thường, bỏ khoảng trắng hai đầu |
| `sort` | `score` (điểm cao trước; đơn chưa có điểm ở cuối, sau đó mới nộp trước) hoặc `newest` (mới nộp trước). Mặc định: `score` cho tab `to-decide`, `newest` cho các tab còn lại |
| `page` | từ 1; quá trang cuối thì `items` rỗng, `total` vẫn đúng |

- Tham số sai (tab / sort / recommendation không có trong danh sách, `page` không phải số nguyên dương, `q` dài hơn 255 ký tự) → 400 `code: INVALID_QUERY`.
- Mã job / nhóm / level không tồn tại → danh sách rỗng (không lỗi).
- Hai đơn cùng điểm / cùng ngày luôn có thứ tự ổn định (xếp thêm theo `id`), nên chuyển trang không lặp hay sót đơn.

#### AC-3: Danh sách cho bộ lọc

**When:** `GET /api/hr/application-filters`
**Then:** trả mọi job (kể cả `DRAFT` / `CLOSED`, kèm trạng thái job), mọi nhóm và level (kể cả đã ẩn), theo `sort_order` / tên.

### Backend — chi tiết & CV

#### AC-4: Chi tiết đơn

**When:** `GET /api/hr/applications/:id`
**Then:** trả:

| Phần | Nội dung |
|------|----------|
| Ứng viên | `fullName`, `email`, `createdAt`, `cvFileName`, `status` |
| Job | `code`, `title`, nhóm, level yêu cầu (`code`, `name`), `minYearsExperience`, trạng thái job |
| Kết quả AI (nếu có) | `overallScore`, `recommendation`, `summary`, `strengths`, `weaknesses`, `criteriaScores` (đúng như n8n lưu, theo thứ tự), `estimatedYearsExperience`, level ước tính (`code`, `name`, hoặc `null`), `model`, `promptVersion`, `evaluatedAt` |
| Lịch sử | mọi dòng `application_status_history`, cũ trước: `fromStatus`, `toStatus`, `note`, `createdAt`, người đổi (`name` của HR, hoặc `null` nếu do hệ thống / n8n) |
| Đơn khác cùng email | các đơn khác của cùng email (không gồm đơn này), mới trước: `id`, job `title`, `status`, `createdAt`, `overallScore` |
| Quyền thao tác | `canDecide`, `canReEvaluate` theo bảng trạng thái |

- `id` không phải uuid → 400; không có đơn → 404 `code: APPLICATION_NOT_FOUND`.
- Không trả `cv_drive_file_id` / `cv_drive_url` (HR xem CV qua AC-5).

#### AC-5: Xem file CV

**When:** `GET /api/hr/applications/:id/cv`
**Then:**
- 200, `Content-Type: application/pdf`, `Content-Disposition: inline; filename="<tên file gốc>"` (tên tiếng Việt được mã hoá đúng chuẩn, `filename*=UTF-8''…`), `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`.
- Nội dung đúng từng byte với file đã lưu (Google Drive hoặc thư mục local, theo `CV_STORAGE`).

| Trường hợp | Kết quả |
|------------|---------|
| Không có đơn | 404 `APPLICATION_NOT_FOUND` |
| File không còn trên Drive / thư mục local | 404 `CV_NOT_FOUND` |
| Drive lỗi / hết hạn refresh token | 502 `CV_UNAVAILABLE` (log lỗi, không lộ chi tiết) |

### Backend — quyết định & đánh giá lại

#### AC-6: Chốt kết quả

**Given:** đơn ở `EVALUATED` hoặc `EVALUATION_FAILED`
**When:** `POST /api/hr/applications/:id/decision` với `{ "decision": "ACCEPTED" | "REJECTED", "note": "…" }`
**Then:** trong **một transaction**:
- `applications.status` = quyết định, `updated_at = now()`; `result_email_sent_at` vẫn `NULL` (Phase 4 gửi email).
- Thêm 1 dòng lịch sử: `from_status` = trạng thái cũ, `to_status` = quyết định, `note` = ghi chú (đã bỏ khoảng trắng hai đầu; rỗng → `NULL`), `changed_by_id` = HR đang đăng nhập.
- Trả 200 chi tiết đơn mới (như AC-4).

| Trường hợp | Kết quả |
|------------|---------|
| `decision` thiếu / khác 2 giá trị trên | 400 `DECISION_INVALID` |
| `note` không phải chuỗi / dài hơn 2000 ký tự | 400 `NOTE_TOO_LONG` |
| Đơn ở `SUBMITTED`, `EVALUATING`, `ACCEPTED`, `REJECTED` | 409 `STATUS_NOT_ALLOWED`, kèm trạng thái hiện tại; không đổi gì |
| Hai HR quyết định cùng lúc | chỉ một người thành công; người kia nhận 409 `STATUS_NOT_ALLOWED` (cập nhật có điều kiện theo trạng thái) |
| Không có đơn | 404 `APPLICATION_NOT_FOUND` |

#### AC-7: Đánh giá lại

**Given:** đơn ở `EVALUATED` hoặc `EVALUATION_FAILED`
**When:** `POST /api/hr/applications/:id/re-evaluate`
**Then:**
- `status = SUBMITTED` + 1 dòng lịch sử (`note` "HR yêu cầu đánh giá lại", `changed_by_id` = HR), trong một transaction; WF-1 chấm lại ở lần chạy 00:00 kế tiếp ([D17](../../project-overview.md#11-nhật-ký-quyết-định)).
- Kết quả AI cũ **vẫn giữ** tới khi WF-1 ghi đè (DQ1).
- Trạng thái khác → 409 `STATUS_NOT_ALLOWED`; không có đơn → 404.

#### AC-8: Ghi dữ liệu an toàn

- Hai API ghi (AC-6, AC-7) chỉ nhận `Content-Type: application/json` (415 như [hr-auth](../hr-auth/requirements.md)) và yêu cầu đăng nhập.
- Không API nào của feature này sửa `evaluations` (chỉ n8n ghi bảng này) hay xoá lịch sử.

### Frontend — danh sách `/hr`

#### AC-9: Tab theo giai đoạn

**Given:** HR mở `/hr`
**Then:**
- 4 tab, mỗi tab kèm số đơn: **Cần quyết định** (mặc định), **Đang chờ chấm**, **Đã quyết định**, **Tất cả**.
- Tab "Cần quyết định" xếp **điểm cao trước**; các tab khác xếp **mới nộp trước** (người dùng đổi được, AC-10).
- Đổi tab thì về trang 1 và giữ các bộ lọc khác.

#### AC-10: Lọc, tìm, sắp xếp, phân trang qua URL

**Given:** HR ở `/hr`
**When:** chọn job / nhóm / level / khuyến nghị, gõ tìm tên / email, đổi cách sắp xếp, chuyển trang
**Then:**
- URL đổi theo (vd `/hr?tab=all&position=backend-dev&q=nguyen&sort=newest&page=2`); mở lại URL đó cho đúng kết quả. Giá trị mặc định không ghi vào URL.
- Ô tìm kiếm gửi khi bấm Enter / nút Tìm (không gọi API mỗi lần gõ phím).
- Đổi bộ lọc hoặc tìm kiếm → về trang 1.
- Có link **Bỏ lọc** khi đang có bộ lọc / tìm kiếm.
- Danh sách job trong bộ lọc có cả job đã đóng (ghi "(đã đóng)").

#### AC-11: Mỗi dòng của danh sách

**Then:** mỗi đơn hiện: họ tên, email, job, ngày nộp (`dd/MM/yyyy`, giờ Việt Nam), nhãn trạng thái (bảng trên), và:
- đã có kết quả AI: điểm tổng (vd `83.3`) + nhãn khuyến nghị (Nên nhận / Cân nhắc / Không nên nhận — Recommended / Consider / Not recommended) có màu khác nhau;
- chưa có: "—".
- Bấm vào dòng → `/hr/applications/<id>`.

#### AC-12: Trạng thái rỗng và lỗi

| Trường hợp | Hiển thị |
|------------|----------|
| Tab không có đơn, không lọc | "Chưa có đơn nào trong mục này." |
| Có lọc / tìm mà không có kết quả | "Không có đơn nào khớp bộ lọc." + link **Bỏ lọc** |
| Backend lỗi | thông báo lỗi thân thiện (như trang công khai), không lỗi thô |
| Phiên hết hạn | về trang đăng nhập rồi quay lại đúng URL (hr-auth AC-11, AC-13) |

### Frontend — chi tiết `/hr/applications/[id]`

#### AC-13: Bố cục trang chi tiết

**Then:**
- Đầu trang: link **← Danh sách đơn** (quay lại đúng tab / bộ lọc vừa xem), họ tên, email, job (nhóm · level), ngày nộp, nhãn trạng thái.
- 2 cột trên màn hình rộng (1 cột trên điện thoại):
  - **Trái — kết quả AI:**
    - điểm tổng + khuyến nghị;
    - "Yêu cầu: {level}, từ {N} năm" cạnh "AI ước tính: {level}, {X} năm" (chưa có thì "—");
    - bảng tiêu chí theo thứ tự: tên, loại, trọng số, nhãn **Bắt buộc**, điểm `/10`, lý do, trích dẫn từ CV;
    - điểm mạnh / điểm yếu;
    - dòng nhỏ "Chấm bởi {model} · prompt {version} · {thời điểm}".
  - **Phải — CV:** trình xem PDF nhúng trong trang (gọi AC-5), nút **Mở trong tab mới** và **Tải về**. CV không tải được → thông báo lỗi trong khung CV, phần còn lại vẫn dùng được.
- Nội dung AI viết (tóm tắt, lý do…) hiển thị nguyên văn (tiếng Việt) ở cả 2 ngôn ngữ giao diện.

#### AC-14: Đơn chưa có hoặc lỗi kết quả AI

| Trạng thái | Cột kết quả AI hiển thị |
|------------|------------------------|
| `SUBMITTED` / `EVALUATING`, chưa từng chấm | "AI sẽ chấm đơn này trong lần chạy 00:00 kế tiếp." |
| `EVALUATION_FAILED` | "AI chấm lỗi: {ghi chú lỗi gần nhất trong lịch sử}" + gợi ý tự xem CV hoặc **Đánh giá lại** |
| `SUBMITTED` sau khi HR yêu cầu đánh giá lại, còn kết quả cũ | kết quả cũ, kèm nhãn "Kết quả cũ — đang chờ chấm lại" |

#### AC-15: Lịch sử và các đơn khác

**Then:**
- **Lịch sử trạng thái** dạng timeline, cũ trước: thời điểm, "{từ} → {sang}", người đổi (tên HR, hoặc "Hệ thống"), ghi chú.
- **Đơn khác của ứng viên này** (cùng email): job, ngày nộp, trạng thái, điểm; bấm để mở đơn đó. Không có thì ẩn mục này.

#### AC-16: Chốt kết quả trên giao diện

**Given:** đơn ở `EVALUATED` hoặc `EVALUATION_FAILED`
**Then:** có nút **Nhận** và **Từ chối** (ẩn ở các trạng thái khác).

**When:** bấm một nút
**Then:**
- Hộp thoại xác nhận: "Nhận ứng viên {tên} cho vị trí {job}?" (hoặc "Từ chối…"), dòng "Quyết định này không sửa được.", ô **Ghi chú (không bắt buộc, chỉ HR thấy)** tối đa 2000 ký tự (có đếm ký tự), nút **Xác nhận** / **Huỷ**.
- **Huỷ** hoặc phím Esc: đóng hộp thoại, không gọi API.
- **Xác nhận** → gọi AC-6; đang gửi thì khoá nút. Thành công: đóng hộp thoại, trang cập nhật (nhãn trạng thái mới, nút quyết định / đánh giá lại biến mất, lịch sử có dòng mới với tên HR và ghi chú), thông báo "Đã lưu quyết định."
- 409: "Đơn này vừa được cập nhật bởi người khác." và trang tải lại trạng thái mới. Lỗi khác: thông báo lỗi trong hộp thoại, giữ nguyên ghi chú đã gõ.

#### AC-17: Đánh giá lại trên giao diện

**Given:** đơn ở `EVALUATED` hoặc `EVALUATION_FAILED`
**When:** bấm **Đánh giá lại** → hộp thoại "AI sẽ chấm lại đơn này trong lần chạy 00:00 kế tiếp. Kết quả hiện tại được giữ tới khi có kết quả mới." → **Xác nhận**
**Then:** gọi AC-7; trang cập nhật: nhãn "Chờ chấm", nút quyết định / đánh giá lại biến mất, kết quả cũ có nhãn của AC-14, lịch sử có dòng mới. 409 xử lý như AC-16.

#### AC-18: Song ngữ và truy cập

- Mọi nhãn (tab, trạng thái, khuyến nghị, loại tiêu chí, nút, hộp thoại, thông báo) có cả vi / en; ngày theo `dd/MM/yyyy HH:mm` giờ Việt Nam ở cả 2 ngôn ngữ.
- Hộp thoại dùng đúng vai trò `dialog` (có tiêu đề, focus vào hộp thoại khi mở, trả focus khi đóng); bảng tiêu chí là bảng có tiêu đề cột.
- Đơn không tồn tại / id sai → trang "Không tìm thấy đơn" + link về danh sách.

---

## Kiểm thử

Theo [CLAUDE.md — Feature workflow](../../../CLAUDE.md): Gherkin + unit cho frontend, Jest unit + HTTP spec cho backend; mỗi test ghi mã AC.

| AC | Test |
|----|------|
| AC-1, AC-2 | backend `hr-applications.service.spec.ts` (tab → trạng thái, tham số, mặc định sắp xếp, 400) · `hr-applications.repository.spec.ts` (câu truy vấn: lọc, tìm, thứ tự ổn định, đơn chưa có điểm ở cuối) |
| AC-3, AC-4 | `hr-applications.service.spec.ts` (ghép chi tiết, quyền thao tác, 404) |
| AC-5 | `hr-applications.http.spec.ts` (Nest app thật: header PDF, tên file tiếng Việt, 404 / 502) · `local-cv-storage.spec.ts`, `google-drive-cv-storage.spec.ts` (`download`) |
| AC-6, AC-7 | `hr-applications.service.spec.ts` (bảng trạng thái, ghi chú, transaction, cập nhật có điều kiện → 409) · `hr-applications.http.spec.ts` (cần đăng nhập, 415, `changed_by_id` = HR đang đăng nhập) |
| AC-8 | `hr-applications.http.spec.ts` |
| AC-9 → AC-12 | frontend `src/app/hr/(protected)/__tests__/hr-applications-list.feature` |
| AC-13 → AC-15, AC-18 | `src/app/hr/(protected)/applications/[id]/__tests__/hr-application-detail.feature` |
| AC-16, AC-17 | `src/components/hr/__tests__/hr-decision.feature` (hộp thoại, Esc, khoá nút, 409, lỗi giữ ghi chú) |
| Chạy thật | [tasks.md](./tasks.md): DB dev + backend + Next.js production build; đơn thật đã được WF-1 chấm, CV mở được từ Google Drive, Accept / Reject / đánh giá lại ghi đúng DB; WF-1 chấm lại đơn vừa yêu cầu |

---

## Quyết định (2026-11-07)

| # | Câu hỏi | Đã chốt |
|---|---------|---------|
| RQ1 | Quyết định có sửa được không (chưa có email) | **Chốt luôn**: `ACCEPTED` / `REJECTED` là trạng thái cuối; chỉ quyết định từ `EVALUATED` / `EVALUATION_FAILED`; có hộp thoại xác nhận |
| RQ2 | Ghi chú khi quyết định | **Không bắt buộc**, tối đa 2000 ký tự, chỉ HR thấy |
| RQ3 | Trang danh sách | **Tab theo giai đoạn** (Cần quyết định mặc định, xếp điểm cao trước), lọc / tìm / sắp xếp trong URL, 20 đơn / trang |
| RQ4 | Xem CV | **Nhúng trong trang** chi tiết + mở tab mới / tải về; backend trả PDF (Q11, D32) |
| — | Đánh giá lại khi đã có kết quả | Giữ kết quả cũ (gắn nhãn "Kết quả cũ") tới khi WF-1 ghi đè (DQ1) |
| — | Bộ lọc job | Gồm cả job đã đóng / nháp, nhóm / level đã ẩn — đơn cũ vẫn lọc được |
| — | Tìm kiếm | Chứa chuỗi, không phân biệt hoa thường, trong họ tên hoặc email; chưa cần index full-text (dữ liệu nhỏ) |

### Ghi chú kỹ thuật

- Danh sách và chi tiết được Server Component lấy từ backend (chuyển tiếp cookie phiên như `getHrSession`); hai thao tác ghi gọi từ trình duyệt qua `hrFetch` rồi `router.refresh()`.
- Cập nhật trạng thái dùng `UPDATE … WHERE id = $1 AND status IN ('EVALUATED','EVALUATION_FAILED')`: n8n ([WF-1](../n8n-evaluate-cv-workflow/requirements.md)) cũng chỉ đổi trạng thái khi đơn còn `EVALUATING`, nên HR và n8n không ghi đè lẫn nhau.
- Lấy file từ Drive: `GET https://www.googleapis.com/drive/v3/files/{id}?alt=media` bằng OAuth sẵn có của backend (scope `drive.file`).
- Trình xem PDF dùng `<iframe>` trỏ tới `/api/hr/applications/:id/cv` (cùng origin nên cookie phiên được gửi kèm).

### Phát hiện khi làm

- **Danh sách dùng SQL thô (`$queryRaw` có tham số)** vì Prisma không sắp xếp `điểm DESC` với đơn chưa có điểm ở cuối; mọi bộ lọc là tham số, ký tự `%` / `_` trong ô tìm kiếm được coi là chữ thường (đã kiểm: tìm "%" không khớp tất cả).
- **Số đơn của tab** lấy bằng một truy vấn `GROUP BY status` với cùng bộ lọc rồi cộng theo tab; `total` của danh sách chính là số đơn của tab đang chọn.
- **Lỗi 409 có thêm `currentStatus`** (trạng thái hiện tại của đơn) để giao diện báo đúng; `api-error.ts` cho phép thêm field phụ.
- **`/hr` (trang danh sách) thay lời chào của 3.1**: bỏ nhóm chữ `hr.home`; test khung HR kiểm layout với nội dung giả.
- **Link "Bỏ lọc" giữ cách sắp xếp** (sắp xếp không phải bộ lọc).
- **Bộ lọc là form GET thường** (nút Tìm gửi cả ô tìm kiếm lẫn các ô chọn): không cần JavaScript, URL luôn phản ánh trạng thái; các tab và phân trang là link.
- **`CvStorage.download`** trả `null` khi file không còn (404 ở Drive; `ENOENT` ở thư mục local; id không phải `local:…` khi dev). Id local chỉ lấy `basename`, không thoát khỏi thư mục.
- **Đã kiểm với Drive thật** qua bản build production: CV 54.9 KB tải về đúng `%PDF-`, `Cache-Control: private, no-store`.

