import { APPLICATION_TEXT_MAX_LENGTH, CV_MAX_FILE_SIZE_MB } from '@org/shared';
import type { Dictionary } from './en';

/** Vietnamese UI texts — same shape as en.ts. */
export const vi: Dictionary = {
  meta: {
    siteName: 'CV AI Scanner',
    description: 'Xem các vị trí đang tuyển và nộp CV trực tuyến.',
  },
  nav: {
    home: 'Trang chủ',
    jobs: 'Việc làm',
    language: 'Ngôn ngữ',
  },
  footer: {
    privacy: 'Chính sách quyền riêng tư',
    aiNote: 'CV được AI hỗ trợ sàng lọc. Quyết định tuyển dụng luôn do bộ phận HR đưa ra.',
  },
  common: {
    loadError: 'Hiện chưa tải được dữ liệu. Vui lòng thử lại sau ít phút.',
  },
  home: {
    title: 'Tìm công việc phù hợp và ứng tuyển chỉ trong vài phút',
    subtitle: 'Xem các vị trí đang tuyển, đọc mô tả công việc và nộp CV dạng PDF — không cần tạo tài khoản.',
    cta: 'Xem việc làm đang tuyển',
    stepsTitle: 'Cách ứng tuyển',
    steps: [
      {
        title: 'Chọn công việc',
        text: 'Lọc các vị trí đang mở theo nhóm và cấp bậc, rồi đọc mô tả công việc đầy đủ.',
      },
      {
        title: 'Nộp CV',
        text: 'Điền họ tên, email và tải CV dạng PDF lên (tối đa {maxMb}MB).',
      },
      {
        title: 'HR xem xét',
        text: 'Trợ lý AI chấm CV theo tiêu chí của vị trí để hỗ trợ bộ phận HR. Quyết định cuối cùng luôn do con người đưa ra, và bạn sẽ nhận kết quả qua email.',
      },
    ],
  },
  jobs: {
    title: 'Việc làm đang tuyển',
    subtitle: 'Các vị trí công ty đang tuyển dụng.',
    category: 'Nhóm',
    level: 'Cấp bậc',
    allCategories: 'Tất cả nhóm',
    allLevels: 'Tất cả cấp bậc',
    clearFilters: 'Bỏ lọc',
    experience: 'Từ {years} năm kinh nghiệm',
    noExperience: 'Không yêu cầu kinh nghiệm',
    criteria: 'Yêu cầu chính',
    apply: 'Ứng tuyển',
    noMatch: 'Không có việc làm nào phù hợp với bộ lọc.',
    noJobs: 'Hiện chưa có vị trí nào đang tuyển. Vui lòng quay lại sau.',
  },
  submit: {
    title: 'Nộp CV',
    subtitle: 'Điền thông tin và tải CV lên để ứng tuyển.',
    name: 'Họ tên',
    namePlaceholder: 'Họ và tên đầy đủ',
    email: 'Email',
    emailPlaceholder: 'ban@example.com',
    position: 'Vị trí',
    positionPlaceholder: 'Chọn vị trí',
    cv: 'Tải CV',
    cvHint: 'Chỉ nhận PDF, tối đa {maxMb}MB',
    cvSelected: 'Đã chọn: {name}',
    consentBefore: 'Tôi đồng ý cho xử lý dữ liệu cá nhân theo ',
    consentLink: 'chính sách quyền riêng tư',
    consentAfter: '.',
    submit: 'Nộp CV',
    submitting: 'Đang gửi...',
    successText: 'Chúng tôi sẽ xem xét hồ sơ và phản hồi bạn qua email.',
    backHome: 'Về trang chủ',
    otherJobs: 'Xem việc làm khác',
    genericError: 'Không gửi được CV. Vui lòng thử lại.',
    jdLoading: 'Đang tải mô tả công việc...',
    jdError: 'Không tải được mô tả công việc.',
    criteriaTitle: 'Chúng tôi tìm kiếm',
    noJobs: 'Hiện chưa có vị trí nào để ứng tuyển.',
    viewJobs: 'Xem việc làm đang tuyển',
  },
  applicationMessages: {
    SUBMITTED: 'Nộp CV thành công',
    NAME_REQUIRED: 'Vui lòng nhập họ tên',
    NAME_TOO_LONG: `Họ tên không được vượt quá ${APPLICATION_TEXT_MAX_LENGTH} ký tự`,
    EMAIL_REQUIRED: 'Vui lòng nhập email',
    EMAIL_INVALID: 'Email không hợp lệ',
    POSITION_REQUIRED: 'Vui lòng chọn vị trí',
    POSITION_NOT_OPEN: 'Vị trí này hiện không nhận hồ sơ',
    CV_REQUIRED: 'Vui lòng tải CV lên',
    CV_NOT_PDF: 'Chỉ chấp nhận file PDF',
    CV_TOO_LARGE: `Dung lượng file không được vượt quá ${CV_MAX_FILE_SIZE_MB}MB`,
    UPLOAD_FAILED: 'Không tải được CV lên. Vui lòng thử lại.',
    CONSENT_REQUIRED: 'Vui lòng đồng ý với chính sách quyền riêng tư để ứng tuyển',
  },
  hr: {
    areaName: 'HR',
    loadError: 'Hiện chưa kiểm tra được phiên đăng nhập. Vui lòng thử lại sau ít phút.',
    login: {
      title: 'Đăng nhập HR',
      heading: 'Đăng nhập khu vực HR',
      intro: 'Chỉ dành cho bộ phận tuyển dụng.',
      email: 'Email',
      password: 'Mật khẩu',
      submit: 'Đăng nhập',
      submitting: 'Đang đăng nhập…',
      sessionExpired: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
      errors: {
        emailRequired: 'Vui lòng nhập email',
        emailInvalid: 'Email không hợp lệ',
        passwordRequired: 'Vui lòng nhập mật khẩu',
        invalidCredentials: 'Email hoặc mật khẩu không đúng.',
        tooManyAttempts: 'Bạn đã nhập sai quá nhiều lần. Thử lại sau {minutes} phút.',
        network: 'Không kết nối được máy chủ. Vui lòng thử lại.',
      },
    },
    header: {
      signedInAs: 'Đang đăng nhập: {name}',
      logout: 'Đăng xuất',
      loggingOut: 'Đang đăng xuất…',
    },
    home: {
      title: 'HR',
      greeting: 'Xin chào, {name}',
      intro: 'Danh sách đơn ứng tuyển và kết quả đánh giá của AI sẽ hiển thị ở đây.',
    },
  },
  privacy: {
    title: 'Chính sách quyền riêng tư',
    updated: 'Cập nhật lần cuối: {date}',
    intro: 'Chính sách này giải thích cách CV AI Scanner xử lý dữ liệu cá nhân bạn gửi khi ứng tuyển.',
    sections: [
      {
        heading: 'Dữ liệu chúng tôi thu thập',
        paragraphs: [
          'Khi bạn ứng tuyển, chúng tôi thu thập họ tên, địa chỉ email, vị trí bạn ứng tuyển và CV (file PDF) cùng thông tin trong đó.',
        ],
      },
      {
        heading: 'Mục đích sử dụng',
        paragraphs: [
          'Chúng tôi chỉ dùng dữ liệu này để đánh giá hồ sơ của bạn cho vị trí đã chọn và liên hệ với bạn về kết quả.',
        ],
      },
      {
        heading: 'Sàng lọc có hỗ trợ của AI',
        paragraphs: [
          'CV của bạn được một mô hình AI (Claude, của Anthropic) phân tích và chấm điểm theo tiêu chí của vị trí. Điểm số chỉ để hỗ trợ bộ phận HR: mọi quyết định chấp nhận hay từ chối hồ sơ đều do con người đưa ra.',
        ],
      },
      {
        heading: 'Nơi lưu trữ',
        paragraphs: [
          'File CV được lưu trên Google Drive, thông tin ứng tuyển được lưu trong cơ sở dữ liệu của chúng tôi. Chỉ bộ phận HR được truy cập. Các nhà cung cấp dịch vụ — Google (lưu trữ) và Anthropic (phân tích bằng AI) — chỉ xử lý dữ liệu thay mặt chúng tôi và chỉ cho mục đích này.',
        ],
      },
      {
        heading: 'Thời hạn lưu trữ',
        paragraphs: ['Chúng tôi lưu hồ sơ và CV của bạn trong {months} tháng kể từ khi bạn ứng tuyển, sau đó sẽ xoá.'],
      },
      {
        heading: 'Quyền của bạn',
        paragraphs: ['Bạn có thể yêu cầu xem, sửa hoặc xoá dữ liệu của mình, hoặc rút lại sự đồng ý, bằng cách gửi email tới {email}.'],
      },
      {
        heading: 'Sự đồng ý của bạn',
        paragraphs: [
          'Khi đánh dấu ô đồng ý trên form ứng tuyển, bạn đồng ý với việc xử lý dữ liệu như mô tả trên trang này. Mỗi lần ứng tuyển được xử lý riêng.',
        ],
      },
    ],
  },
};
