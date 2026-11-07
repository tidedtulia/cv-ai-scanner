import { formatDate, formatDateTime, formatScore } from './format-date';

describe('HR dates and scores (hr-applications AC-11, AC-18)', () => {
  it('always shows Vietnam time (UTC+7), dd/MM/yyyy HH:mm', () => {
    expect(formatDateTime('2026-11-06T17:30:00.000Z')).toBe('07/11/2026 00:30');
    expect(formatDate('2026-11-06T17:30:00.000Z')).toBe('07/11/2026');
    expect(formatDateTime('2026-01-01T00:05:00.000Z')).toBe('01/01/2026 07:05');
  });

  it('rounds the score to one decimal, without a trailing .0', () => {
    expect(formatScore(83.33)).toBe('83.3');
    expect(formatScore(90)).toBe('90');
    expect(formatScore(71.67)).toBe('71.7');
    expect(formatScore(0)).toBe('0');
  });
});
