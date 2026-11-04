import { buildCvFileName, slugify } from './cv-file-name';

describe('cv-file-name', () => {
  it('slugify() strips Vietnamese diacritics, including đ / Đ', () => {
    expect(slugify('Nguyễn Văn Ánh')).toBe('nguyen-van-anh');
    expect(slugify('  Đặng   Thị Đức!! ')).toBe('dang-thi-duc');
  });

  it('slugify() caps the length without a trailing dash', () => {
    const slug = slugify('a'.repeat(49) + ' bcd');

    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('buildCvFileName() uses Vietnam time, position code, name slug and the first 8 chars of the id', () => {
    const name = buildCvFileName({
      submittedAt: new Date('2026-11-05T02:30:12Z'), // 09:30:12 in Asia/Ho_Chi_Minh
      positionCode: 'frontend-dev',
      fullName: 'Nguyễn Văn A',
      applicationId: '3f1c2b9a-1111-4222-8333-444455556666',
    });

    expect(name).toBe('20261105-093012_frontend-dev_nguyen-van-a_3f1c2b9a.pdf');
  });

  it('buildCvFileName() falls back to "candidate" when the name has no usable characters', () => {
    const name = buildCvFileName({
      submittedAt: new Date('2026-11-04T17:00:00Z'), // midnight in Vietnam → next day, hour 00
      positionCode: 'backend-dev',
      fullName: '???',
      applicationId: 'abcdef12-0000-0000-0000-000000000000',
    });

    expect(name).toBe('20261105-000000_backend-dev_candidate_abcdef12.pdf');
  });
});
