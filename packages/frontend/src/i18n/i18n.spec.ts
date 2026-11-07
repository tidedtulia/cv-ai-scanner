import { isLocale, resolveLocale } from './config';
import { format } from './format';

describe('resolveLocale (AC-15)', () => {
  it('uses the cookie when the visitor picked a language', () => {
    expect(resolveLocale('en', 'vi-VN,vi;q=0.9')).toBe('en');
    expect(resolveLocale('vi', 'en-US,en;q=0.9')).toBe('vi');
  });

  it.each([
    ['en-US,en;q=0.9', 'en'],
    ['vi-VN,vi;q=0.9,en;q=0.8', 'vi'],
    ['fr-FR,fr;q=0.9,en;q=0.5', 'en'],
    ['vi;q=0.5,en;q=0.9', 'en'],
    ['ja,zh;q=0.8', 'vi'],
    ['en;q=0,vi;q=0.2', 'vi'],
    ['', 'vi'],
  ])('Accept-Language "%s" → %s', (header, expected) => {
    expect(resolveLocale(undefined, header)).toBe(expected);
  });

  it('ignores an unknown cookie value and a missing header', () => {
    expect(resolveLocale('fr', null)).toBe('vi');
    expect(resolveLocale(undefined, undefined)).toBe('vi');
  });

  it('isLocale() only accepts vi / en', () => {
    expect(isLocale('vi')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('EN')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('format', () => {
  it('fills placeholders and keeps unknown ones', () => {
    expect(format('{years}+ years, max {maxMb}MB', { years: 2, maxMb: 10 })).toBe('2+ years, max 10MB');
    expect(format('Hello {name} {missing}', { name: 'An' })).toBe('Hello An {missing}');
  });
});
