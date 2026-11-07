import { backToListHref, hasFilters, listHref, listQuery, parseListParams } from './hr-list-url';

describe('HR list URL (hr-applications AC-9, AC-10, AC-13)', () => {
  it('parses /hr search params with the defaults', () => {
    expect(parseListParams({})).toEqual({ tab: 'to-decide', page: 1, position: undefined, category: undefined, level: undefined, recommendation: undefined, q: undefined, sort: undefined });
    expect(parseListParams({ tab: 'all', q: '  nguyen ', page: '3', sort: 'score', position: ['backend-dev', 'x'] })).toMatchObject({ tab: 'all', q: 'nguyen', page: 3, sort: 'score', position: 'backend-dev' });
    expect(parseListParams({ tab: 'bogus', page: '-2' })).toMatchObject({ tab: 'to-decide', page: 1 });
  });

  it('leaves the default values out of the URL', () => {
    expect(listQuery(parseListParams({}))).toBe('');
    expect(listQuery(parseListParams({ tab: 'to-decide', sort: 'score', page: '1' }))).toBe('');
    expect(listQuery(parseListParams({ tab: 'all', sort: 'newest' }))).toBe('tab=all');
    expect(listQuery(parseListParams({ tab: 'all', sort: 'score', position: 'backend-dev', q: 'nguyen', page: '2' }))).toBe('tab=all&position=backend-dev&q=nguyen&sort=score&page=2');
  });

  it('a change of tab / filter / search / sort goes back to page 1, keeping the other filters', () => {
    const current = parseListParams({ tab: 'all', position: 'backend-dev', page: '3' });
    expect(listHref(current, { tab: 'decided' })).toBe('/hr?tab=decided&position=backend-dev');
    expect(listHref(current, { q: 'lan' })).toBe('/hr?tab=all&position=backend-dev&q=lan');
    expect(listHref(current, { position: undefined })).toBe('/hr?tab=all');
    expect(listHref(current, { page: 4 })).toBe('/hr?tab=all&position=backend-dev&page=4');
  });

  it('changing the tab drops a sort that was only the default of the previous tab', () => {
    expect(listHref(parseListParams({ sort: 'score' }), { tab: 'all' })).toBe('/hr?tab=all');
    expect(listHref(parseListParams({ tab: 'all', sort: 'score' }), { tab: 'decided' })).toBe('/hr?tab=decided&sort=score');
  });

  it('hasFilters()', () => {
    expect(hasFilters(parseListParams({ tab: 'all', sort: 'score', page: '2' }))).toBe(false);
    expect(hasFilters(parseListParams({ q: 'x' }))).toBe(true);
    expect(hasFilters(parseListParams({ recommendation: 'CONSIDER' }))).toBe(true);
  });

  it.each([
    [undefined, '/hr'],
    ['', '/hr'],
    ['tab=all&q=nguyen', '/hr?tab=all&q=nguyen'],
    ['tab=to-decide&page=1', '/hr'],
    ['//evil.example', '/hr'],
    ['https://evil.example', '/hr'],
    ['/jobs', '/hr'],
    ['\\evil', '/hr'],
  ])('back link for from=%p → %s', (from, expected) => {
    expect(backToListHref(from)).toBe(expected);
  });
});
