import { catalogCodeFromName, positionCodeFromTitle, withSuffix } from './slug.utils';

describe('slug utils (hr-positions AC-2, AC-10)', () => {
  it.each([
    ['Lập trình viên Backend (NestJS)', 'lap-trinh-vien-backend-nestjs'],
    ['Đỗ Quyên — Quản lý  sản phẩm!', 'do-quyen-quan-ly-san-pham'],
    ['  Senior Backend Developer (Java) ', 'senior-backend-developer-java'],
    ['C++ / C#', 'c-c'],
    ['---', ''],
  ])('position code of %p → %p', (title, code) => expect(positionCodeFromTitle(title)).toBe(code));

  it('cuts at 64 characters without a trailing dash', () => {
    const code = positionCodeFromTitle(`${'a'.repeat(63)} bbb`);
    expect(code).toBe('a'.repeat(63));
    expect(positionCodeFromTitle('word '.repeat(30)).length).toBeLessThanOrEqual(64);
    expect(positionCodeFromTitle('word '.repeat(30))).not.toMatch(/-$/);
  });

  it.each([
    ['Quản lý sản phẩm', 'QUAN_LY_SAN_PHAM'],
    ['Data & AI', 'DATA_AI'],
    ['  đồ họa  ', 'DO_HOA'],
  ])('catalog code of %p → %p', (name, code) => expect(catalogCodeFromName(name)).toBe(code));

  it('adds -2, -3… (or _2) and keeps the limit', () => {
    expect(withSuffix('backend-dev', 1, '-')).toBe('backend-dev');
    expect(withSuffix('backend-dev', 2, '-')).toBe('backend-dev-2');
    expect(withSuffix('DATA', 3, '_')).toBe('DATA_3');
    const long = withSuffix('a'.repeat(64), 12, '-');
    expect(long).toBe(`${'a'.repeat(61)}-12`);
    expect(long.length).toBe(64);
  });
});
