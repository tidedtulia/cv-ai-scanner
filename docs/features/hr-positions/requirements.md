# Feature: Quản lý job, tiêu chí và danh mục cho HR (Phase 3 — bước 3.3)

## Mục tiêu

HR tự tạo, sửa, mở / đóng, xoá job và tiêu chí chấm điểm của job; tự thêm, sửa, ẩn nhóm vị trí và level. Hiện các dữ liệu này chỉ có qua seed script. Sau bước này HR không cần nhờ lập trình viên để đăng tuyển một vị trí mới.

Bối cảnh: [project-overview.md §8.2, §8.3](../../project-overview.md#82-trang-hr) (D6, D7, D9, D10, D11, D32, D33) · Bảng: [database.md §4.2 → §4.5](../../database.md#42-job_categories--nhóm-vị-trí) · Đăng nhập: [hr-auth](../hr-auth/requirements.md) · Trang công khai đọc dữ liệu này: [public-jobs-api](../public-jobs-api/requirements.md)

---

## Phạm vi

- **Backend** — module `hr-positions`, mọi route dưới `/api/hr` (guard của 3.1):

| Method | Endpoint | Dùng cho |
|--------|----------|----------|
| GET | `/api/hr/positions` | Danh sách job (mọi trạng thái) kèm số đơn, số tiêu chí |
| POST | `/api/hr/positions` | Tạo job (luôn là `DRAFT`) |
| GET / PATCH / DELETE | `/api/hr/positions/:id` | Chi tiết (kèm tiêu chí) / sửa / xoá job |
| POST | `/api/hr/positions/:id/status` | Chuyển `DRAFT` / `OPEN` / `CLOSED` |
| POST | `/api/hr/positions/:id/criteria` | Thêm tiêu chí |
| PATCH / DELETE | `/api/hr/positions/:id/criteria/:criterionId` | Sửa / xoá tiêu chí |
| POST | `/api/hr/positions/:id/criteria/:criterionId/move` | Đưa tiêu chí lên / xuống một bậc |
| GET / POST | `/api/hr/job-categories`, `/api/hr/job-levels` | Danh mục (kể cả đã ẩn, kèm số job đang dùng) / thêm |
| PATCH | `/api/hr/job-categories/:id`, `/api/hr/job-levels/:id` | Đổi tên, thứ tự, ẩn / hiện |

- **Frontend** (song ngữ vi / en): `/hr/positions` (danh sách), `/hr/positions/new`, `/hr/positions/[id]` (sửa job + tiêu chí), `/hr/catalog` (nhóm và level); header HR thêm menu **Đơn ứng tuyển | Job | Danh mục**.
- **Không làm:** thống kê theo nhóm / level; xem trước trang công khai của job; nhân bản job; xoá nhóm / level (chỉ ẩn); sửa mã (code) sau khi tạo.

### Hằng số

| Tên | Giá trị |
|-----|---------|
| `title`, tên nhóm / level, tên tiêu chí | 1–255 ký tự |
| JD (`description`) | tối đa 20 000 ký tự |
| Hướng dẫn chấm (`description` của tiêu chí) | tối đa 2 000 ký tự |
| `minYearsExperience` | số nguyên 0–50 |
| `weight` | số nguyên 1–5 |
| `code` job | `a-z`, `0-9`, `-`; 2–64 ký tự |
| `code` nhóm / level | `A-Z`, `0-9`, `_`; 2–64 ký tự |

---

## Acceptance Criteria

Mỗi AC là một scenario. Mọi API khi không có phiên đều trả 401 như [hr-auth AC-6](../hr-auth/requirements.md); mọi API ghi chỉ nhận JSON (415).

### Job — backend

#### AC-1: Danh sách job

**When:** `GET /api/hr/positions`
**Then:** trả **mọi** job (`DRAFT`, `OPEN`, `CLOSED`), mới tạo trước; mỗi job: `id`, `code`, `title`, nhóm (`code`, `name`), level (`code`, `name`), `minYearsExperience`, `status`, `criteriaCount`, `applicationCount`, `createdAt`, `updatedAt`. Lọc tuỳ chọn `?status=OPEN|DRAFT|CLOSED` (giá trị khác → 400 `INVALID_QUERY`).

#### AC-2: Tạo job

**When:** `POST /api/hr/positions` với `{ title, categoryCode, levelCode, minYearsExperience, description, code? }`
**Then:**
- 201; job mới luôn ở **`DRAFT`** (chưa hiện cho ứng viên), trả chi tiết (AC-3) với `criteria: []`.
- `code` không gửi → sinh từ `title`: bỏ dấu tiếng Việt, chữ thường, `đ → d`, ký tự khác chữ / số thành `-`, gộp `-` liền nhau, cắt 64 ký tự (vd "Lập trình viên Backend (NestJS)" → `lap-trinh-vien-backend-nestjs`); trùng thì thêm `-2`, `-3`…
- Có gửi `code` → dùng đúng giá trị đó nếu hợp lệ và chưa dùng (trùng → 409 `CODE_TAKEN`).
- Nhóm / level phải **tồn tại và đang hiện** (`is_active`), nếu không → 400 `CATEGORY_INVALID` / `LEVEL_INVALID`.

| Dữ liệu sai | Kết quả |
|-------------|---------|
| `title` rỗng / quá dài | 400 `TITLE_REQUIRED` / `TITLE_TOO_LONG` |
| `description` rỗng / quá 20 000 ký tự | 400 `DESCRIPTION_REQUIRED` / `DESCRIPTION_TOO_LONG` |
| `minYearsExperience` không phải số nguyên 0–50 | 400 `YEARS_INVALID` |
| `code` sai định dạng | 400 `CODE_INVALID` |

#### AC-3: Chi tiết job

**When:** `GET /api/hr/positions/:id`
**Then:** mọi field của AC-1, `description` (JD), và `criteria[]` theo `sortOrder`: `id`, `name`, `type`, `description` (hướng dẫn chấm), `weight`, `isRequired`, `sortOrder`. Không có → 404 `POSITION_NOT_FOUND`; `id` không phải uuid → 400.

#### AC-4: Sửa job

**When:** `PATCH /api/hr/positions/:id` với một phần của `{ title, categoryCode, levelCode, minYearsExperience, description }`
**Then:**
- Chỉ các field gửi lên được đổi, kiểm như AC-2; `code` **không sửa được** (gửi `code` → bỏ qua).
- Job ở **mọi trạng thái** đều sửa được, kể cả `OPEN` / `CLOSED` và đã có đơn. Nhóm / level đã **bị ẩn** vẫn giữ nguyên nếu job đang dùng và không đổi; chỉ khi đổi sang nhóm / level khác mới phải chọn loại đang hiện.
- Trả chi tiết mới; có `applicationCount > 0` thì kèm `warning: "HAS_APPLICATIONS"` khi sửa `levelCode`, `minYearsExperience` hoặc `description` (giao diện nhắc: đơn đã chấm giữ kết quả cũ, đơn chưa chấm dùng nội dung mới).

#### AC-5: Chuyển trạng thái job

**When:** `POST /api/hr/positions/:id/status` với `{ "status": "OPEN" | "CLOSED" | "DRAFT" }`
**Then:**
- Chuyển tự do giữa 3 trạng thái (mở lại job đã đóng được). Cùng trạng thái hiện tại → 200, không đổi gì.
- Sang **`OPEN`** chỉ khi job có **ít nhất 1 tiêu chí** (WF-1 không chấm được nếu thiếu) và JD không rỗng; thiếu → 409 `CRITERIA_REQUIRED`. Job `OPEN` hiện ở `/jobs`, `/submit-cv` ngay.
- Sang `CLOSED` / `DRAFT`: job biến mất khỏi trang công khai, **link `/submit-cv?position=<code>` đã chia sẻ không còn nộp được** (đơn mới bị từ chối `POSITION_NOT_OPEN`, như [submit-application-api AC-3](../submit-application-api/requirements.md)); đơn đã nộp giữ nguyên và vẫn xem / quyết định được.
- `status` ngoài 3 giá trị → 400 `STATUS_INVALID`.

#### AC-6: Xoá job

**When:** `DELETE /api/hr/positions/:id`
**Then:**
- Job **chưa có đơn nào** (mọi trạng thái job): xoá cả job và tiêu chí, 200.
- Job **đã có đơn** → 409 `POSITION_HAS_APPLICATIONS` kèm `applicationCount`; không xoá gì (giao diện gợi ý "Đóng job").

### Tiêu chí — backend

#### AC-7: Thêm, sửa, xoá tiêu chí

**When:** `POST /api/hr/positions/:id/criteria` với `{ name, type, description?, weight, isRequired }` · `PATCH …/criteria/:criterionId` (một phần) · `DELETE …/criteria/:criterionId`
**Then:**
- `type` là một trong 5 loại cố định `TECHNICAL`, `EXPERIENCE`, `SOFT_SKILL`, `LANGUAGE`, `EDUCATION` (D11) → sai: 400 `TYPE_INVALID`. `weight` số nguyên 1–5 → 400 `WEIGHT_INVALID`. `name` 1–255 ký tự (400 `NAME_REQUIRED` / `NAME_TOO_LONG`). Hướng dẫn chấm tối đa 2 000 ký tự (400 `GUIDE_TOO_LONG`); rỗng → `NULL`.
- Tiêu chí mới đứng **cuối** danh sách (`sortOrder` lớn nhất + 10).
- Trả chi tiết job mới; job `OPEN` và tiêu chí bị xoá là **tiêu chí cuối cùng** → 409 `LAST_CRITERION` (phải đóng job trước, để job đang nhận đơn luôn chấm được).
- Tiêu chí không thuộc job đó / không tồn tại → 404 `CRITERION_NOT_FOUND`.
- Job đã có đơn (`applicationCount > 0`): thao tác vẫn thực hiện, kèm `warning: "HAS_APPLICATIONS"` (kết quả đã chấm giữ nguyên nhờ snapshot; đơn chưa chấm dùng tiêu chí mới).

#### AC-8: Thứ tự tiêu chí

**When:** `POST …/criteria/:criterionId/move` với `{ "direction": "up" | "down" }`
**Then:** đổi chỗ với tiêu chí liền kề (theo `sortOrder`, cùng `sortOrder` thì theo ngày tạo); tiêu chí đầu / cuối mà đi tiếp ra ngoài → 200, không đổi. Trả chi tiết job với thứ tự mới; `direction` khác → 400 `DIRECTION_INVALID`.

### Nhóm vị trí và level — backend

#### AC-9: Danh sách danh mục

**When:** `GET /api/hr/job-categories` hoặc `/api/hr/job-levels`
**Then:** trả **mọi** dòng kể cả đã ẩn, theo `sortOrder` rồi tên: `id`, `code`, `name`, `sortOrder`, `isActive`, `positionCount` (số job đang dùng).

#### AC-10: Thêm nhóm / level

**When:** `POST /api/hr/job-categories` (hoặc `job-levels`) với `{ name, code?, sortOrder? }`
**Then:**
- 201. `code` không gửi → sinh từ tên: bỏ dấu, chữ **hoa**, ký tự khác chữ / số thành `_` (vd "Quản lý sản phẩm" → `QUAN_LY_SAN_PHAM`), trùng thì thêm `_2`…; có gửi thì kiểm định dạng (400 `CODE_INVALID`) và trùng (409 `CODE_TAKEN`). `code` **không sửa được** sau đó.
- `sortOrder` không gửi → **cuối** danh sách (lớn nhất + 10). Với level, thứ tự là **thứ bậc** (nhỏ = thấp) nên HR có thể chèn giữa bằng số tuỳ chọn (vd 35 nằm giữa 30 và 40).
- `name` 1–255 ký tự (400 `NAME_REQUIRED` / `NAME_TOO_LONG`), tên trùng (không phân biệt hoa thường) → 409 `NAME_TAKEN`. `sortOrder` phải là số nguyên (400 `SORT_ORDER_INVALID`).

#### AC-11: Sửa, ẩn / hiện nhóm / level

**When:** `PATCH /api/hr/job-categories/:id` (hoặc `job-levels`) với một phần của `{ name, sortOrder, isActive }`
**Then:**
- Đổi tên, đổi thứ tự, ẩn (`isActive: false`) / hiện lại. Kiểm như AC-10.
- **Ẩn** một nhóm / level: không còn trong danh sách chọn khi tạo job, bộ lọc công khai `/jobs` (`GET /api/job-categories`, `/api/job-levels`) và danh sách level của tool MCP; **job đang dùng và đơn cũ giữ nguyên**, trang công khai vẫn hiện tên nhóm / level của job đó.
- Đổi **tên** có hiệu lực ngay ở mọi nơi (job, đơn, trang công khai). Không có thao tác xoá.
- Không có → 404 `CATEGORY_NOT_FOUND` / `LEVEL_NOT_FOUND`.

### Frontend

#### AC-12: Menu của khu vực HR

**Then:** header HR có menu **Đơn ứng tuyển** (`/hr`), **Job** (`/hr/positions`), **Danh mục** (`/hr/catalog`); mục của trang đang mở được đánh dấu (`aria-current`); chưa đăng nhập thì không có menu. Các trang mới theo cùng cơ chế bảo vệ và `noindex` của `/hr/*`.

#### AC-13: Danh sách job `/hr/positions`

**Then:**
- Bảng: tiêu đề (link sang trang sửa), mã, nhóm · level, trạng thái (nhãn có màu: Nháp / Đang mở / Đã đóng), số tiêu chí, số đơn (link sang `/hr?tab=all&position=<code>`), ngày cập nhật (`dd/MM/yyyy`, giờ Việt Nam).
- Lọc theo trạng thái bằng link (Tất cả | Nháp | Đang mở | Đã đóng), mỗi mục kèm số job; nút **Tạo job** → `/hr/positions/new`.
- Chưa có job: "Chưa có job nào." + nút tạo; backend lỗi: thông báo thân thiện.

#### AC-14: Tạo và sửa job

**Then:**
- Form: Tiêu đề, Nhóm (chỉ nhóm đang hiện), Level (chỉ level đang hiện, theo thứ bậc), Số năm kinh nghiệm tối thiểu, JD (markdown, ô nhiều dòng, có đếm ký tự); khi tạo có ô **Mã** tuỳ chọn kèm gợi ý mã sẽ sinh từ tiêu đề; khi sửa, mã chỉ hiển thị (không sửa) cùng link công khai `/submit-cv?position=<code>`.
- Kiểm tra phía trình duyệt như AC-2 (báo ngay dưới ô); lỗi từ backend theo `code` bằng tiếng đang dùng; nút bị khoá khi đang gửi.
- Tạo xong chuyển sang trang sửa của job (còn `DRAFT`, nhắc "Thêm tiêu chí rồi mở job"); sửa xong báo "Đã lưu." Job đã có đơn: hiện cảnh báo của AC-4 ở đầu form và sau khi lưu các field đó.
- Nhóm / level của job đã bị ẩn vẫn hiện đúng tên (kèm "(đã ẩn)") trong form.

#### AC-15: Tiêu chí trên trang sửa job

**Then:**
- Bảng tiêu chí theo thứ tự: tên, loại (nhãn), trọng số, nhãn **Bắt buộc**, hướng dẫn chấm; mỗi dòng có **Lên**, **Xuống** (tiêu chí đầu / cuối khoá nút tương ứng), **Sửa**, **Xoá**; nút **Thêm tiêu chí**.
- Thêm / sửa trong hộp thoại (role `dialog`, Esc để huỷ) với các ô: Tên, Loại, Trọng số 1–5, Bắt buộc, Hướng dẫn chấm (không bắt buộc, có đếm ký tự); kiểm tra như AC-7.
- Xoá có hộp thoại xác nhận; tiêu chí cuối của job đang mở: báo "Hãy đóng job trước khi xoá tiêu chí cuối cùng." (lỗi `LAST_CRITERION`).
- Job đã có đơn: có dòng cảnh báo "Job này đã có N đơn: kết quả đã chấm giữ nguyên, đơn chưa chấm sẽ dùng tiêu chí mới." phía trên bảng.
- Ứng viên chỉ thấy tên + loại của tiêu chí (D9): bảng ghi chú "Ứng viên thấy tên và loại; trọng số, bắt buộc, hướng dẫn chấm chỉ nội bộ".

#### AC-16: Mở, đóng, xoá job trên giao diện

**Then:**
- Nút theo trạng thái: `DRAFT` → **Mở job**; `OPEN` → **Đóng job**; `CLOSED` → **Mở lại**; có thêm **Chuyển về nháp** khi đang mở. Mở / đóng cần xác nhận một dòng ("Job sẽ hiện / không còn nhận đơn từ ứng viên").
- **Mở job** khi chưa có tiêu chí: báo lỗi "Cần ít nhất 1 tiêu chí trước khi mở job." (lỗi `CRITERIA_REQUIRED`).
- **Xoá job**: chỉ hiện nút khi `applicationCount = 0`; có hộp thoại xác nhận nêu rõ sẽ xoá cả tiêu chí; thành công về `/hr/positions`. Job đã có đơn: thay bằng dòng "Job đã có N đơn nên không xoá được, hãy đóng job."
- Thao tác thành công cập nhật trang (nhãn, nút) và báo; lỗi giữ nguyên dữ liệu đang nhập.

#### AC-17: Danh mục `/hr/catalog`

**Then:**
- Hai bảng **Nhóm vị trí** và **Level** (level ghi chú "Thứ tự là thứ bậc: số nhỏ = level thấp"): tên, mã, thứ tự, số job đang dùng, trạng thái (Đang hiện / Đã ẩn); các dòng đã ẩn mờ đi.
- **Thêm** (tên, mã tuỳ chọn, thứ tự tuỳ chọn), **Sửa** (tên, thứ tự), **Ẩn / Hiện** trong hộp thoại hoặc dòng sửa trực tiếp; lỗi `NAME_TAKEN`, `CODE_TAKEN`… hiện bằng tiếng đang dùng.
- Ẩn nhóm / level đang có job dùng: có xác nhận "N job đang dùng vẫn giữ nguyên; chỉ không chọn được cho job mới".

#### AC-18: Song ngữ, truy cập và lỗi phiên

- Mọi nhãn, thông báo lỗi theo `code`, hộp thoại có cả vi / en; ngày `dd/MM/yyyy` giờ Việt Nam.
- Hộp thoại có `role="dialog"`, tiêu đề, focus vào hộp thoại khi mở và trả focus khi đóng; bảng có tiêu đề cột; ô nhập có nhãn.
- Phiên hết hạn khi đang thao tác (401) → về trang đăng nhập rồi quay lại đúng trang ([hr-auth AC-13](../hr-auth/requirements.md)); job không tồn tại → trang "Không tìm thấy job" + link về danh sách.

### Tác động lên phần công khai

#### AC-19: Trang công khai và WF-1 theo dữ liệu mới

**Then:**
- Job vừa `OPEN` xuất hiện ở `GET /api/positions`, `/jobs`, dropdown `/submit-cv`; job `CLOSED` / `DRAFT` biến mất khỏi đó (không cần deploy).
- Tiêu chí mới / sửa có hiệu lực cho tool MCP `get_position_requirements` ở lần gọi kế tiếp (đọc thẳng DB), nên WF-1 đêm đó chấm theo thang mới.
- API công khai vẫn **không** trả `description` của tiêu chí, `weight`, `isRequired` ([public-jobs-api](../public-jobs-api/requirements.md)).

---

## Kiểm thử

Theo [CLAUDE.md — Feature workflow](../../../CLAUDE.md): Gherkin + unit cho frontend, Jest unit + HTTP spec cho backend; mỗi test ghi mã AC.

| AC | Test |
|----|------|
| AC-1 → AC-6 | backend `hr-positions.service.spec.ts` (validation, sinh mã, trùng mã, trạng thái, `CRITERIA_REQUIRED`, xoá có đơn, cảnh báo) · `hr-positions.repository.spec.ts` · `slug.spec.ts` (bỏ dấu tiếng Việt, hậu tố) |
| AC-7, AC-8 | `hr-criteria.service.spec.ts` (loại, trọng số, tiêu chí cuối của job mở, đổi chỗ, biên) |
| AC-9 → AC-11 | `hr-catalog.service.spec.ts` (mã sinh từ tên, thứ tự cuối, trùng tên, ẩn / hiện) |
| AC-1 → AC-11 (HTTP) | `hr-positions.http.spec.ts` (Nest app thật: 401, 415, 400 / 404 / 409 giữ `code`, tạo → mở → trang công khai thấy; đóng → không thấy) |
| AC-19 | `hr-positions.http.spec.ts` + chạy thật: tạo job → thêm tiêu chí → mở → `/jobs` và `mcp:check` thấy; đóng → `POSITION_NOT_OPEN` |
| AC-12 | frontend `src/components/hr/__tests__/hr-nav.feature` |
| AC-13, AC-14 | `src/app/hr/(protected)/positions/__tests__/hr-positions.feature` |
| AC-15, AC-16 | `src/app/hr/(protected)/positions/[id]/__tests__/hr-position-edit.feature` (tiêu chí, hộp thoại, mở / đóng / xoá) |
| AC-17 | `src/app/hr/(protected)/catalog/__tests__/hr-catalog.feature` |
| AC-18 | các feature trên + `dictionaries.spec.ts` (đủ khoá vi / en) |
| Chạy thật | [tasks.md](./tasks.md): DB dev + backend + Next.js production; tạo job → tiêu chí → mở → nộp thử CV qua form công khai → đóng; `mcp:check` và `n8n:check` vẫn pass; dọn dữ liệu thử |

---

## Quyết định (2026-11-07)

| # | Câu hỏi | Đã chốt |
|---|---------|---------|
| PQ1 | Sửa tiêu chí của job đã có đơn | **Cho sửa, có cảnh báo**; kết quả đã chấm giữ nguyên (snapshot), đơn chưa chấm dùng tiêu chí mới; muốn chấm lại đơn cũ dùng "Đánh giá lại" (3.2) |
| PQ2 | Chuyển trạng thái job | **Tự do giữa `DRAFT` / `OPEN` / `CLOSED`**; mở job cần ≥ 1 tiêu chí và JD |
| PQ3 | Xoá | **Job xoá được khi chưa có đơn**; nhóm / level chỉ ẩn (không xoá) |
| PQ4 | Mã (code) | **Tự sinh từ tên, đặt xong không đổi**; HR được gõ tay lúc tạo |
| — | Thứ tự tiêu chí | Nút **Lên / Xuống** (không kéo thả: ít phụ thuộc, dùng được bằng bàn phím) |
| — | Thứ tự nhóm / level | Số nguyên nhập trực tiếp, mặc định cuối danh sách (+10); với level là thứ bậc |
| — | Nhóm / level hiển thị | Ẩn thì job cũ vẫn giữ và vẫn hiện tên ở trang công khai |
| — | Trang HR cho nhóm / level | Một trang `/hr/catalog` cho cả hai (dữ liệu nhỏ) |

### Ghi chú kỹ thuật

- Bảng `positions` / `position_criteria` đã có đủ cột; **không cần migration**. Quyền DB của n8n (`mcp_readonly`, `n8n_app`) không đổi vì chỉ backend ghi các bảng này.
- Trang công khai và tool MCP đọc thẳng DB (không cache), nên thay đổi có hiệu lực ngay.
- Sinh mã: bỏ dấu bằng `normalize('NFD')`, `đ → d`; kiểm trùng trong cùng transaction với lúc ghi và bắt lỗi `P2002` để tránh hai HR tạo cùng lúc.
- Đổi chỗ tiêu chí chạy trong transaction; khi nhiều tiêu chí trùng `sortOrder` (dữ liệu seed cũ) thì chuẩn hoá lại `sortOrder` theo bước 10 trước khi đổi.
