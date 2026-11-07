import { renderResultEmail, escapeHtml, type ResultEmailInput } from './mail-templates';

const base: ResultEmailInput = {
  locale: 'vi',
  decision: 'ACCEPTED',
  fullName: 'Nguyễn Văn An',
  positionTitle: 'Backend Developer',
  privacyEmail: 'privacy@example.com',
};

describe('renderResultEmail (result-email AC-2)', () => {
  it.each([
    ['vi', 'ACCEPTED', 'Kết quả ứng tuyển: Backend Developer', ['Chào Nguyễn Văn An,', 'vui mừng thông báo bạn được nhận vào vị trí Backend Developer', 'liên hệ với bạn qua email này']],
    ['vi', 'REJECTED', 'Kết quả ứng tuyển: Backend Developer', ['Chào Nguyễn Văn An,', 'chưa thể tiếp tục với hồ sơ của bạn cho vị trí Backend Developer', 'hoan nghênh ứng tuyển các vị trí khác']],
    ['en', 'ACCEPTED', 'Your application: Backend Developer', ['Hello Nguyễn Văn An,', 'pleased to let you know you have been accepted for the Backend Developer position', 'contact you at this address']],
    ['en', 'REJECTED', 'Your application: Backend Developer', ['Hello Nguyễn Văn An,', 'will not be moving forward with your application for the Backend Developer position', 'apply for other roles']],
  ] as const)('%s · %s: subject and the key sentences, in text and in html', (locale, decision, subject, sentences) => {
    const email = renderResultEmail({ ...base, locale, decision });
    expect(email.subject).toBe(subject);
    for (const sentence of sentences) {
      expect(email.text).toContain(sentence);
      expect(email.html).toContain(sentence);
    }
    expect(email.html).toContain(`<html lang="${locale}">`);
  });

  it.each(['vi', 'en'] as const)('%s: the data-rights line (with the privacy address) and the automatic-email line are at the foot', (locale) => {
    for (const decision of ['ACCEPTED', 'REJECTED'] as const) {
      const email = renderResultEmail({ ...base, locale, decision });
      expect(email.text).toContain('privacy@example.com');
      expect(email.html).toContain('privacy@example.com');
      expect(email.text.trim().split('\n').at(-1)).toMatch(locale === 'vi' ? /gửi tự động/ : /sent automatically/);
    }
  });

  it('never mentions a score, the AI, a recommendation or an HR note', () => {
    for (const locale of ['vi', 'en'] as const) {
      for (const decision of ['ACCEPTED', 'REJECTED'] as const) {
        const { text, html, subject } = renderResultEmail({ ...base, locale, decision });
        expect(`${subject}\n${text}\n${html}`).not.toMatch(/điểm|score|\bAI\b|\bn8n\b|claude|recommend|khuyến nghị|ghi chú|\bnote\b|\d+(\.\d+)?\s*\/\s*100/i);
      }
    }
  });

  it('escapes HTML in the name and the job title', () => {
    const email = renderResultEmail({ ...base, fullName: '<b>An</b> & "Co"', positionTitle: "Dev <script>alert('x')</script>" });
    expect(email.html).not.toContain('<b>An</b>');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;b&gt;An&lt;/b&gt; &amp; &quot;Co&quot;');
    expect(email.html).toContain('Dev &lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;');
    expect(escapeHtml('a&b<c>"d\'')).toBe('a&amp;b&lt;c&gt;&quot;d&#39;');
  });

  it('removes line breaks from the name and the title (no header injection, no broken sentences)', () => {
    const email = renderResultEmail({ ...base, fullName: 'An\r\nBcc: evil@example.com', positionTitle: 'Back\nend\tDev' });
    expect(email.subject).toBe('Kết quả ứng tuyển: Back end Dev');
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.text).toContain('Chào An Bcc: evil@example.com,');
  });

  it('is a pure function: the same input gives the same email', () => {
    expect(renderResultEmail(base)).toEqual(renderResultEmail({ ...base }));
  });
});
