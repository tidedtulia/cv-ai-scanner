import type { ApplicationLocale, HrDecision } from '@org/shared';

export interface ResultEmailInput {
  locale: ApplicationLocale;
  decision: HrDecision;
  fullName: string;
  positionTitle: string;
  /** Address for data requests shown at the foot of the email */
  privacyEmail: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/** Collapse line breaks and runs of blanks: names and titles end up in headers and one-line sentences (AC-2) */
const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim();

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);

interface Copy {
  subject: (title: string) => string;
  greeting: (name: string) => string;
  paragraphs: (title: string) => string[];
  closing: string;
  privacy: (email: string) => string;
  automatic: string;
}

/** Four templates: no score, AI reasoning, HR notes or HR name — ever (AC-2) */
const COPY: Record<ApplicationLocale, Record<HrDecision, Copy>> = {
  vi: {
    ACCEPTED: {
      subject: (title) => `Kết quả ứng tuyển: ${title}`,
      greeting: (name) => `Chào ${name},`,
      paragraphs: (title) => [
        `Cảm ơn bạn đã ứng tuyển vào vị trí ${title}.`,
        `Chúng tôi vui mừng thông báo bạn được nhận vào vị trí ${title}.`,
        'Bộ phận tuyển dụng sẽ liên hệ với bạn qua email này để trao đổi về các bước tiếp theo.',
      ],
      closing: 'Trân trọng,\nBộ phận tuyển dụng',
      privacy: (email) => `Nếu bạn muốn xem hoặc xoá dữ liệu cá nhân đã gửi cho chúng tôi, hãy gửi yêu cầu tới ${email}.`,
      automatic: 'Email này được gửi tự động sau khi bộ phận tuyển dụng xem xét hồ sơ của bạn.',
    },
    REJECTED: {
      subject: (title) => `Kết quả ứng tuyển: ${title}`,
      greeting: (name) => `Chào ${name},`,
      paragraphs: (title) => [
        `Cảm ơn bạn đã dành thời gian ứng tuyển vào vị trí ${title}.`,
        `Sau khi xem xét, lần này chúng tôi chưa thể tiếp tục với hồ sơ của bạn cho vị trí ${title}.`,
        'Chúc bạn nhiều may mắn trong hành trình sắp tới. Bạn luôn được hoan nghênh ứng tuyển các vị trí khác trên website của chúng tôi.',
      ],
      closing: 'Trân trọng,\nBộ phận tuyển dụng',
      privacy: (email) => `Nếu bạn muốn xem hoặc xoá dữ liệu cá nhân đã gửi cho chúng tôi, hãy gửi yêu cầu tới ${email}.`,
      automatic: 'Email này được gửi tự động sau khi bộ phận tuyển dụng xem xét hồ sơ của bạn.',
    },
  },
  en: {
    ACCEPTED: {
      subject: (title) => `Your application: ${title}`,
      greeting: (name) => `Hello ${name},`,
      paragraphs: (title) => [
        `Thank you for applying for the ${title} position.`,
        `We are pleased to let you know you have been accepted for the ${title} position.`,
        'Our recruiting team will contact you at this address with the next steps.',
      ],
      closing: 'Best regards,\nThe recruiting team',
      privacy: (email) => `If you would like to see or delete the personal data you sent us, please write to ${email}.`,
      automatic: 'This email was sent automatically after our recruiting team reviewed your application.',
    },
    REJECTED: {
      subject: (title) => `Your application: ${title}`,
      greeting: (name) => `Hello ${name},`,
      paragraphs: (title) => [
        `Thank you for the time you put into applying for the ${title} position.`,
        `After careful consideration, we will not be moving forward with your application for the ${title} position this time.`,
        'We wish you all the best. You are always welcome to apply for other roles on our website.',
      ],
      closing: 'Best regards,\nThe recruiting team',
      privacy: (email) => `If you would like to see or delete the personal data you sent us, please write to ${email}.`,
      automatic: 'This email was sent automatically after our recruiting team reviewed your application.',
    },
  },
};

/** Pure: the same input always gives the same email (AC-2) */
export function renderResultEmail(input: ResultEmailInput): RenderedEmail {
  const copy = COPY[input.locale][input.decision];
  const name = oneLine(input.fullName);
  const title = oneLine(input.positionTitle);
  const privacy = copy.privacy(oneLine(input.privacyEmail));
  const paragraphs = copy.paragraphs(title);

  const text = [copy.greeting(name), ...paragraphs, copy.closing, '--', privacy, copy.automatic].join('\n\n');

  const p = (content: string) => `<p style="margin:0 0 16px">${escapeHtml(content)}</p>`;
  const html = [
    '<!doctype html>',
    `<html lang="${input.locale}"><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;line-height:1.6">`,
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:24px;border-radius:8px">',
    p(copy.greeting(name)),
    ...paragraphs.map(p),
    `<p style="margin:0 0 16px">${escapeHtml(copy.closing).replace(/\n/g, '<br>')}</p>`,
    '<hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">',
    `<p style="margin:0 0 8px;font-size:12px;color:#71717a">${escapeHtml(privacy)}</p>`,
    `<p style="margin:0;font-size:12px;color:#71717a">${escapeHtml(copy.automatic)}</p>`,
    '</div></body></html>',
  ].join('\n');

  return { subject: copy.subject(title), text, html };
}
