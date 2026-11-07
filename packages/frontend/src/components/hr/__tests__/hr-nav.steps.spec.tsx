import { join } from 'path';
import { render, screen, within } from '@testing-library/react';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { list } from '../../../test-utils/fixtures';
import { mockPathname, resetMockRouter } from '../../../test-utils/next-navigation.mock';
import { HrHeader } from '../HrHeader';

jest.mock('next/navigation', () => require('../../../test-utils/next-navigation.mock'));

const feature = loadFeature(join(__dirname, 'hr-nav.feature'));

let locale: 'vi' | 'en';
let user: { id: string; name: string; email: string } | undefined;

const show = (path: string, signedIn = true) => {
  mockPathname.value = path;
  render(
    <I18nProvider locale={locale}>
      <HrHeader user={signedIn ? user : undefined} />
    </I18nProvider>,
  );
};

defineFeature(feature, (test) => {
  beforeEach(() => {
    resetMockRouter();
    locale = 'en';
    user = undefined;
  });

  test('The menu marks the current page', ({ given, and, when, then }) => {
    given('my browser prefers Vietnamese', () => {
      locale = 'vi';
    });
    and(/^I am signed in as "(.*)"$/, (name: string) => {
      user = { id: '1', name, email: 'x@y.co' };
    });
    when(/^I open the HR header on "(.*)"$/, (path: string) => show(path));
    then(/^the menu "(.*)" has the links "(.*)"$/, (label: string, links: string) => {
      const nav = screen.getByRole('navigation', { name: label });
      const found = within(nav).getAllByRole('link').map((a) => `${a.textContent} → ${a.getAttribute('href')}`);
      expect(found).toEqual(list(links));
    });
    and(/^the current page is "(.*)"$/, (name: string) => {
      const current = screen.getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
      expect(current.map((a) => a.textContent)).toEqual([name]);
    });
  });

  test('The menu is in English too', ({ given, when, then }) => {
    given(/^I am signed in as "(.*)"$/, (name: string) => {
      user = { id: '1', name, email: 'x@y.co' };
    });
    when(/^I open the HR header on "(.*)"$/, (path: string) => show(path));
    then(/^the menu "(.*)" has the links "(.*)"$/, (label: string, links: string) => {
      const nav = screen.getByRole('navigation', { name: label });
      expect(within(nav).getAllByRole('link').map((a) => `${a.textContent} → ${a.getAttribute('href')}`)).toEqual(list(links));
    });
  });

  test('No menu before signing in', ({ when, then }) => {
    when(/^I open the HR header without a session on "(.*)"$/, (path: string) => show(path, false));
    then('I see no menu', () => {
      expect(screen.queryByRole('navigation')).toBeNull();
    });
  });
});
