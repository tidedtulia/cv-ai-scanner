import { loginUrl, safeNextPath } from './hr-paths';

describe('safeNextPath (hr-auth AC-10)', () => {
  it.each([
    ['/hr', '/hr'],
    ['/hr/applications', '/hr/applications'],
    ['/hr/applications?status=EVALUATED&page=2', '/hr/applications?status=EVALUATED&page=2'],
    ['/hr/applications/12#history', '/hr/applications/12#history'],
  ])('keeps the HR path %s', (next, expected) => {
    expect(safeNextPath(next)).toBe(expected);
  });

  it.each([
    [undefined],
    [''],
    ['hr'],
    ['//evil.example'],
    ['//evil.example/hr'],
    ['/\\evil.example'],
    ['/hr\\..\\jobs'],
    ['https://evil.example/hr'],
    ['javascript:alert(1)'],
    ['/jobs'],
    ['/hrx'],
    ['/hr/../jobs'],
    ['/hr/login'],
    ['/hr/login?next=/hr'],
    [['/hr/applications']],
  ])('falls back to /hr for %p', (next) => {
    expect(safeNextPath(next)).toBe('/hr');
  });
});

describe('loginUrl (hr-auth AC-11, AC-13)', () => {
  it('adds next (encoded) and the expired reason', () => {
    expect(loginUrl('/hr/applications?page=2', true)).toBe('/hr/login?next=%2Fhr%2Fapplications%3Fpage%3D2&reason=expired');
    expect(loginUrl('/hr/applications')).toBe('/hr/login?next=%2Fhr%2Fapplications');
  });

  it('leaves out the default /hr and unsafe targets', () => {
    expect(loginUrl('/hr')).toBe('/hr/login');
    expect(loginUrl('//evil.example', true)).toBe('/hr/login?reason=expired');
    expect(loginUrl()).toBe('/hr/login');
  });
});
