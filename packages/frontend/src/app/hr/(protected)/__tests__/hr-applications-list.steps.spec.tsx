import { join } from 'path';
import { act, screen, within } from '@testing-library/react';
import { defineFeature, loadFeature, type DefineStepFunction } from 'jest-cucumber';
import { hrFilters, hrListItem, hrListResponse, list } from '../../../../test-utils/fixtures';
import { hrApi, HrBackendError, resetHrApi } from '../../../../test-utils/hr-api.mock';
import { mockRequest, resetMockRequest } from '../../../../test-utils/next-headers.mock';
import { redirect, RedirectError } from '../../../../test-utils/next-navigation.mock';
import { renderPage } from '../../../../test-utils/render-page';
import HrApplicationsPage from '../page';

jest.mock('next/headers', () => require('../../../../test-utils/next-headers.mock'));
jest.mock('next/navigation', () => require('../../../../test-utils/next-navigation.mock'));
jest.mock('../../../../lib/hr-backend', () => require('../../../../test-utils/hr-api.mock'));

const feature = loadFeature(join(__dirname, 'hr-applications-list.feature'));

let items: ReturnType<typeof hrListItem>[];
let total: number | undefined;
let redirectedTo: string | undefined;

const searchOf = (url: string) => Object.fromEntries(new URL(url, 'http://localhost').searchParams);

async function open(url: string) {
  hrApi.handler = (path) => {
    if (path.startsWith('hr/application-filters')) return hrFilters();
    return hrListResponse(items, { ...(total === undefined ? {} : { total }), page: Number(searchOf(`/x?${path.split('?')[1]}`)['page'] ?? 1) });
  };
  redirectedTo = undefined;
  try {
    await act(async () => {
      await renderPage(HrApplicationsPage({ searchParams: Promise.resolve(searchOf(url)) }));
    });
  } catch (error) {
    if (!(error instanceof RedirectError)) throw error;
    redirectedTo = error.url;
  }
}

const listCall = () => hrApi.calls.find((call) => call.startsWith('hr/applications?')) ?? '';
const given_vi = (step: DefineStepFunction) =>
  step('my browser prefers Vietnamese', () => {
    mockRequest.acceptLanguage = 'vi-VN,vi;q=0.9';
  });
const whenOpen = (step: DefineStepFunction) => step(/^I open the HR list "(.*)"$/, open);
const rowOf = (name: string) => screen.getByRole('link', { name }).closest('tr') as HTMLElement;
const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement | HTMLSelectElement;

defineFeature(feature, (test) => {
  beforeEach(() => {
    resetMockRequest();
    resetHrApi();
    mockRequest.acceptLanguage = 'en-US,en;q=0.9';
    items = [hrListItem()];
    total = undefined;
  });

  test('Tabs with the number of applications (AC-9)', ({ given, when, then, and }) => {
    given_vi(given);
    whenOpen(when);
    then(/^I see the tabs "(.*)"$/, (tabs: string) => {
      const nav = screen.getByRole('navigation', { name: 'Đơn ứng tuyển' });
      expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(list(tabs));
    });
    and(/^the tab "(.*)" is the current one$/, (name: string) => {
      expect(screen.getByRole('link', { name: /^Cần quyết định/ }).getAttribute('aria-current')).toBe('page');
      expect(name).toBe('Cần quyết định');
    });
    and(/^the API is asked for "(.*)"$/, (query: string) => {
      expect(listCall()).toBe(`hr/applications?${query}`);
    });
  });

  test('Changing the tab goes back to page 1 and keeps the other filters (AC-9, AC-10)', ({ when, then, and }) => {
    whenOpen(when);
    then(/^the tab "(.*)" links to "(.*)"$/, (name: string, href: string) => {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
    });
    and(/^the tab "(.*)" links to "(.*)"$/, (name: string, href: string) => {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
    });
    and(/^the API is asked for "(.*)"$/, (query: string) => {
      expect(listCall()).toBe(`hr/applications?${query}`);
    });
  });

  test('Each row (AC-11)', ({ given, and, when, then }) => {
    given_vi(given);
    and('the list has an evaluated application and one not yet evaluated', () => {
      items = [hrListItem(), hrListItem({ id: 'a2', fullName: 'Lê Thị Bình', email: 'binh@example.com', status: 'SUBMITTED', overallScore: null, recommendation: null })];
    });
    whenOpen(when);
    then(/^the row of "Nguyễn Văn An" shows (.*)$/, (cells: string) => {
      const row = rowOf('Nguyễn Văn An');
      for (const text of cells.match(/"([^"]*)"/g)!.map((cell) => cell.slice(1, -1))) expect(row.textContent).toContain(text);
    });
    and(/^the row of "Lê Thị Bình" shows "(.*)" and "(.*)" instead of a score$/, (status: string, dash: string) => {
      const row = rowOf('Lê Thị Bình');
      expect(row.textContent).toContain(status);
      expect(within(row).getAllByRole('cell').pop()!.textContent).toBe(dash);
    });
    and(/^"(.*)" links to "(.*)"$/, (name: string, href: string) => {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
    });
  });

  test('Decided applications whose email is not sent are marked (result-email AC-12)', ({ given, and, when, then }) => {
    given_vi(given);
    and('the list has a decided application without email and one with its email sent', () => {
      items = [
        hrListItem({ status: 'ACCEPTED', emailPending: true }),
        hrListItem({ id: 'a2', fullName: 'Lê Thị Bình', email: 'binh@example.com', status: 'REJECTED', emailPending: false }),
      ];
    });
    whenOpen(when);
    then(/^the row of "Nguyễn Văn An" shows "(.*)" and "(.*)"$/, (status: string, label: string) => {
      const row = rowOf('Nguyễn Văn An');
      expect(row.textContent).toContain(status);
      expect(within(row).getByText(label)).toBeTruthy();
    });
    and(/^the row of "Lê Thị Bình" shows "(.*)" but not "(.*)"$/, (status: string, label: string) => {
      const row = rowOf('Lê Thị Bình');
      expect(row.textContent).toContain(status);
      expect(within(row).queryByText(label)).toBeNull();
    });
  });

  test('Filters, search and sort are in the form and in the URL (AC-10)', ({ given, when, then, and }) => {
    given_vi(given);
    whenOpen(when);
    then(/^the filter "(.*)" is "(.*)" and offers "(.*)"$/, (label: string, value: string, option: string) => {
      expect(field(label).value).toBe(value);
      expect(within(field(label)).getByRole('option', { name: option })).toBeTruthy();
    });
    and(/^the filter "(.*)" is "(.*)"$/, (label: string, value: string) => {
      expect(field(label).value).toBe(value);
    });
    and(/^the filter "(.*)" is "(.*)"$/, (label: string, value: string) => {
      expect(field(label).value).toBe(value);
    });
    and(/^the search box contains "(.*)"$/, (text: string) => {
      expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe(text);
    });
    and(/^I see the link "(.*)" to "(.*)"$/, (name: string, href: string) => {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
    });
  });

  test('No clear-filters link without filters (AC-10)', ({ when, then }) => {
    whenOpen(when);
    then(/^I see no link "(.*)"$/, (name: string) => {
      expect(screen.queryByRole('link', { name })).toBeNull();
    });
  });

  test('Empty states (AC-12)', ({ given, and, when, then }) => {
    given_vi(given);
    and('the list is empty', () => {
      items = [];
    });
    whenOpen(when);
    then(/^I see the message "(.*)"$/, (message: string) => {
      expect(screen.getByText(message)).toBeTruthy();
    });
  });

  test('The backend fails (AC-12)', ({ given, when, then }) => {
    given('the HR API is down', () => undefined);
    when(/^I open the HR list "(.*)"$/, async (url: string) => {
      hrApi.handler = () => new HrBackendError(500);
      await act(async () => {
        await renderPage(HrApplicationsPage({ searchParams: Promise.resolve(searchOf(url)) }));
      });
    });
    then(/^I see the alert "(.*)"$/, (message: string) => {
      expect(screen.getByRole('alert').textContent).toBe(message);
    });
  });

  test('The session expired (AC-12)', ({ given, when, then }) => {
    given('the HR API answers 401 for an expired session', () => undefined);
    when(/^I open the HR list "(.*)"$/, async (url: string) => {
      hrApi.handler = () => redirect('/hr/login?next=%2Fhr%3Ftab%3Dall%26page%3D2&reason=expired');
      redirectedTo = undefined;
      await renderPage(HrApplicationsPage({ searchParams: Promise.resolve(searchOf(url)) })).catch((error) => {
        if (error instanceof RedirectError) redirectedTo = error.url;
      });
    });
    then('I am sent to the sign-in page', () => {
      expect(redirectedTo).toMatch(/^\/hr\/login\?next=/);
    });
  });

  test('Pages (AC-10)', ({ given, when, then, and }) => {
    given(/^there are (\d+) applications$/, (count: string) => {
      total = Number(count);
    });
    whenOpen(when);
    then(/^I see "(.*)"$/, (text: string) => {
      expect(screen.getByText(text)).toBeTruthy();
    });
    and(/^the link "(.*)" goes to "(.*)"$/, (name: string, href: string) => {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
    });
    and(/^the link "(.*)" goes to "(.*)"$/, (name: string, href: string) => {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
    });
  });
});
