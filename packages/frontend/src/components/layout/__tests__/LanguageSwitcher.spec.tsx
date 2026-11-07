import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageSwitcher } from '../LanguageSwitcher';

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

describe('LanguageSwitcher (AC-16)', () => {
  beforeEach(() => {
    mockRefresh.mockReset();
    document.cookie = 'locale=; max-age=0; path=/';
  });

  it('marks the current language', () => {
    render(
      <I18nProvider locale="vi">
        <LanguageSwitcher />
      </I18nProvider>,
    );

    expect(screen.getByRole('group', { name: 'Ngôn ngữ' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'VI' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'EN' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('saves the new language in the cookie and re-renders the page', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider locale="vi">
        <LanguageSwitcher />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'EN' }));

    expect(document.cookie).toContain('locale=en');
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the current language is clicked', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider locale="en">
        <LanguageSwitcher />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'EN' }));

    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
