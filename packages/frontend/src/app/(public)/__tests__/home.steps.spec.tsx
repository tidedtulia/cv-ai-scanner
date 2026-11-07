import { join } from 'path';
import { screen, within } from '@testing-library/react';
import { defineFeature, loadFeature, type DefineStepFunction } from 'jest-cucumber';
import { list } from '../../../test-utils/fixtures';
import { mockRequest, resetMockRequest } from '../../../test-utils/next-headers.mock';
import { renderLayout, renderPage } from '../../../test-utils/render-page';
import HomePage from '../page';

jest.mock('next/headers', () => require('../../../test-utils/next-headers.mock'));
jest.mock('next/navigation', () => require('../../../test-utils/next-navigation.mock'));

const feature = loadFeature(join(__dirname, 'home.feature'));

const givenVietnamese = (step: DefineStepFunction) => {
  step('my browser prefers Vietnamese', () => {
    mockRequest.acceptLanguage = 'vi-VN,vi;q=0.9';
  });
};

/** "Label → /href, …" */
const linkPairs = (text: string) => list(text).map((pair) => pair.split('→').map((part) => part.trim()));

defineFeature(feature, (test) => {
  beforeEach(() => resetMockRequest());

  test('Introduce the project', ({ given, when, then, and }) => {
    givenVietnamese(given);

    when('I open the home page', async () => {
      await renderPage(HomePage());
    });

    then(/^I see the main heading "(.*)"$/, (heading: string) => {
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(heading);
    });

    and(/^I see a "(.*)" link to "(.*)"$/, (name: string, href: string) => {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
    });

    and(/^I see the steps "(.*)"$/, (steps: string) => {
      const items = screen.getAllByRole('listitem');
      expect(items.map((li) => within(li).getByRole('heading').textContent)).toEqual(list(steps));
    });

    const mentions = (step: DefineStepFunction) =>
      step(/^the steps mention "(.*)"$/, (text: string) => {
        expect(screen.getAllByRole('listitem').some((li) => li.textContent?.includes(text))).toBe(true);
      });
    mentions(and);
    mentions(and);
  });

  test('Show the header and footer on every page', ({ given, when, then, and }) => {
    givenVietnamese(given);

    when('I open a public page', async () => {
      await renderLayout(<p>page content</p>);
    });

    then(/^the header has the links "(.*)"$/, (links: string) => {
      const header = within(screen.getByRole('banner'));
      const actual = header.getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]);
      expect(actual).toEqual(linkPairs(links));
    });

    and(/^the header has the language buttons "(.*)"$/, (buttons: string) => {
      const group = within(screen.getByRole('banner')).getByRole('group', { name: 'Ngôn ngữ' });
      expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(list(buttons));
    });

    and(/^the footer has a "(.*)" link to "(.*)"$/, (name: string, href: string) => {
      expect(within(screen.getByRole('contentinfo')).getByRole('link', { name }).getAttribute('href')).toBe(href);
    });

    and(/^the footer says "(.*)"$/, (text: string) => {
      expect(within(screen.getByRole('contentinfo')).getByText(text)).toBeTruthy();
    });
  });
});
