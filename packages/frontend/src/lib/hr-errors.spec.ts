import { HR_POSITION_MESSAGES } from '@org/shared';
import { dictionaries } from '../i18n/dictionaries';
import { positionErrorMessage } from './hr-errors';

describe('positionErrorMessage (hr-positions AC-14 → AC-18)', () => {
  it.each(['vi', 'en'] as const)('every API code has a text in %s', (locale) => {
    for (const code of Object.keys(HR_POSITION_MESSAGES)) {
      const text = positionErrorMessage(dictionaries[locale], code);
      expect(text).toBeTruthy();
      expect(text).not.toBe(dictionaries[locale].hrPositions.genericError);
    }
  });

  it('an unknown or missing code falls back to the generic message', () => {
    expect(positionErrorMessage(dictionaries.en, 'SOMETHING_NEW')).toBe('Could not save. Please try again.');
    expect(positionErrorMessage(dictionaries.vi, undefined)).toBe('Chưa lưu được. Vui lòng thử lại.');
  });

  it('the Vietnamese texts of the rules the UI shows most', () => {
    expect(positionErrorMessage(dictionaries.vi, 'CRITERIA_REQUIRED')).toBe('Cần ít nhất 1 tiêu chí trước khi mở job.');
    expect(positionErrorMessage(dictionaries.vi, 'LAST_CRITERION')).toBe('Hãy đóng job trước khi xoá tiêu chí cuối cùng.');
  });
});
