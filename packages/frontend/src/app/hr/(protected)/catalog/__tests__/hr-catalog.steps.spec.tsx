import { join } from 'path';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { defineFeature, loadFeature, type DefineStepFunction } from 'jest-cucumber';
import { hrCatalogItem, list } from '../../../../../test-utils/fixtures';
import { hrApi, HrBackendError, resetHrApi } from '../../../../../test-utils/hr-api.mock';
import { answer } from '../../../../../test-utils/hr-backend.mock';
import { mockRequest, resetMockRequest } from '../../../../../test-utils/next-headers.mock';
import { mockRouter, resetMockRouter } from '../../../../../test-utils/next-navigation.mock';
import { renderPage } from '../../../../../test-utils/render-page';
import HrCatalogPage from '../page';

jest.mock('next/headers', () => require('../../../../../test-utils/next-headers.mock'));
jest.mock('next/navigation', () => require('../../../../../test-utils/next-navigation.mock'));
jest.mock('../../../../../lib/hr-backend', () => require('../../../../../test-utils/hr-api.mock'));

const feature = loadFeature(join(__dirname, 'hr-catalog.feature'));

let user: UserEvent;
let categories: ReturnType<typeof hrCatalogItem>[];
let levels: ReturnType<typeof hrCatalogItem>[];
let respond: () => Promise<unknown>;
const fetchMock = jest.fn();
const calls = () => fetchMock.mock.calls;
const bodyOf = () => JSON.parse(calls()[0][1].body);
const dialog = () => screen.getByRole('dialog');
const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement;
const table = (name: string) => screen.getByRole('table', { name });

/** "Developer (2 jobs), QA (0 jobs, hidden)" → catalog rows with ids i0, i1… */
const parseCatalog = (text: string) =>
  text.split(/\), /).map((entry, i) => {
    const m = entry.replace(/\)$/, '').match(/^(.*) \((\d+) jobs?(, hidden)?$/)!;
    return hrCatalogItem({ id: `i${i}`, code: m[1].toUpperCase().replace(/\W+/g, '_'), name: m[1], sortOrder: (i + 1) * 10, isActive: !m[3], positionCount: Number(m[2]) });
  });

const openCatalog = async () => {
  hrApi.handler = (path) => (path === 'hr/job-categories' ? categories : path === 'hr/job-levels' ? levels : new HrBackendError(404));
  await act(async () => {
    await renderPage(HrCatalogPage());
  });
};
const rowOf = (name: string, tableName: string) => within(table(tableName)).getAllByRole('cell', { name })[0].closest('tr') as HTMLElement;
const clickButton = (step: DefineStepFunction) => step(/^I click "(.*)"$/, (name: string) => user.click(screen.getByRole('button', { name })));
const dialogAlert = (step: DefineStepFunction) => step(/^the dialog shows the alert "(.*)"$/, (message: string) => expect(within(dialog()).getByRole('alert').textContent).toBe(message));
const saveForm = (step: DefineStepFunction) => step('I save the catalog form', () => user.click(within(dialog()).getByRole('button', { name: /^(Save|Lưu)$/ })));
const closedAndRefreshed = (step: DefineStepFunction) =>
  step('the dialog is closed and the page is refreshed', async () => {
    await waitFor(() => expect(mockRouter.refresh).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
const noRequest = (step: DefineStepFunction) => step('no request is sent', () => expect(calls()).toHaveLength(0));
const fill = async (name: string, order?: string, code?: string) => {
  await user.clear(field('Name'));
  if (name) await user.type(field('Name'), name);
  if (order !== undefined) {
    await user.clear(field('Order'));
    if (order) await user.type(field('Order'), order);
  }
  if (code) await user.type(field('Code'), code);
};

defineFeature(feature, (test) => {
  beforeEach(() => {
    resetMockRequest();
    resetMockRouter();
    resetHrApi();
    mockRequest.acceptLanguage = 'en-US,en;q=0.9';
    user = userEvent.setup();
    respond = async () => answer(200, {});
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => respond());
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const givenVi = (step: DefineStepFunction) => step('my browser prefers Vietnamese', () => (mockRequest.acceptLanguage = 'vi-VN,vi;q=0.9'));
  const givenCatalog = (step: DefineStepFunction) =>
    step(/^the catalog has the categories "(.*)" and the levels "(.*)"$/, (c: string, l: string) => {
      categories = parseCatalog(c);
      levels = parseCatalog(l);
    });
  const whenOpen = (step: DefineStepFunction) => step('I open the catalog page', openCatalog);

  test('Both tables (AC-17)', ({ given, and, when, then }) => {
    givenVi(given);
    givenCatalog(and);
    whenOpen(when);
    then(/^I see the tables "(.*)" and "(.*)"$/, (a: string, b: string) => {
      expect(table(a)).toBeTruthy();
      expect(table(b)).toBeTruthy();
    });
    and(/^the table "(.*)" has the columns "(.*)"$/, (name: string, columns: string) => expect(within(table(name)).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(list(columns)));
    and(/^the row "Developer" in "(.*)" shows "(.*)", "(.*)" and "(.*)"$/, (tableName: string, ...texts: string[]) => {
      for (const text of texts) expect(rowOf('Developer', tableName).textContent).toContain(text);
    });
    and(/^the row "QA" in "(.*)" shows "(.*)" and is dimmed$/, (tableName: string, text: string) => {
      expect(rowOf('QA', tableName).textContent).toContain(text);
      expect(rowOf('QA', tableName).className).toContain('text-gray-400');
    });
    and(/^I see "(.*)"$/, (text: string) => expect(screen.getByText(text)).toBeTruthy());
  });

  test('Adding a category (AC-17)', ({ given, and, when, then }) => {
    givenCatalog(given);
    whenOpen(when);
    clickButton(and);
    then(/^the dialog "(.*)" opens with an empty name, code and order$/, (title: string) => {
      expect(screen.getByRole('dialog', { name: title })).toBeTruthy();
      expect([field('Name').value, field('Code').value, field('Order').value]).toEqual(['', '', '']);
    });
    when('I save the catalog form without a name', () => user.click(within(dialog()).getByRole('button', { name: 'Save' })));
    then(/^the dialog shows the alert "(.*)"$/, (message: string) => expect(within(dialog()).getByRole('alert').textContent).toBe(message));
    noRequest(and);
    when(/^I fill in the name "(.*)" and the order "(.*)"$/, (name: string, order: string) => fill(name, order));
    saveForm(and);
    then(/^"POST (\S+)" is sent with the name "(.*)", the order (\d+) and no code$/, (url: string, name: string, order: string) => {
      expect(calls()[0][0]).toBe(url);
      expect(bodyOf()).toEqual({ name, sortOrder: Number(order) });
    });
    closedAndRefreshed(and);
    and(/^I see the status "(.*)"$/, (text: string) => expect(screen.getByRole('status').textContent).toBe(text));
  });

  test('Adding a level with a code of my own (AC-17)', ({ given, when, and, then }) => {
    givenCatalog(given);
    whenOpen(when);
    clickButton(and);
    and(/^I fill in the name "(.*)" and the code "(.*)"$/, (name: string, code: string) => fill(name, undefined, code));
    saveForm(and);
    then(/^"POST (\S+)" is sent with the name "(.*)", the code "(.*)" and no order$/, (url: string, name: string, code: string) => {
      expect(calls()[0][0]).toBe(url);
      expect(bodyOf()).toEqual({ name, code });
    });
  });

  test('Errors of the server (AC-17)', ({ given, and, when, then }) => {
    givenCatalog(given);
    and(/^the server answers (\d+) (\w+)$/, (status: string, code: string) => (respond = async () => answer(Number(status), code === 'none' ? {} : { code })));
    whenOpen(when);
    clickButton(and);
    and(/^I fill in the name "(.*)" and the order "(.*)"$/, (name: string, order: string) => fill(name, order));
    saveForm(and);
    dialogAlert(then);
    and('the page is not refreshed', () => expect(mockRouter.refresh).not.toHaveBeenCalled());
  });

  test('Renaming and reordering (AC-17)', ({ given, when, and, then }) => {
    givenCatalog(given);
    whenOpen(when);
    clickButton(and);
    then(/^the dialog '(.*)' opens with the name "(.*)" and the order "(.*)" and no code field$/, (title: string, name: string, order: string) => {
      expect(screen.getByRole('dialog', { name: title })).toBeTruthy();
      expect([field('Name').value, field('Order').value]).toEqual([name, order]);
      expect(screen.queryByLabelText(/^Code/)).toBeNull();
    });
    when(/^I fill in the name "(.*)" and the order "(.*)"$/, (name: string, order: string) => fill(name, order));
    saveForm(and);
    then(/^"PATCH (\S+)" is sent with the name "(.*)" and the order (\d+)$/, (url: string, name: string, order: string) => {
      expect(calls()[0][0]).toBe(url);
      expect(bodyOf()).toEqual({ name, sortOrder: Number(order) });
    });
    closedAndRefreshed(and);
  });

  test('Hiding a category in use asks first (AC-17)', ({ given, and, when, then }) => {
    givenVi(given);
    givenCatalog(and);
    whenOpen(when);
    clickButton(and);
    then(/^the dialog '(.*)' says "(.*)"$/, (title: string, text: string) => expect(within(screen.getByRole('dialog', { name: title })).getByText(text)).toBeTruthy());
    when(/^I click "(.*)"$/, (name: string) => user.click(screen.getByRole('button', { name })));
    then('the dialog is closed and no request is sent', () => {
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(calls()).toHaveLength(0);
    });
    when(/^I click "(.*)"$/, (name: string) => user.click(screen.getByRole('button', { name })));
    and(/^I click "(.*)" in the dialog$/, (name: string) => user.click(within(dialog()).getByRole('button', { name })));
    then(/^"PATCH (\S+)" is sent with isActive false$/, (url: string) => {
      expect(calls()[0][0]).toBe(url);
      expect(bodyOf()).toEqual({ isActive: false });
    });
    closedAndRefreshed(and);
  });

  test('Showing a hidden level again needs no question (AC-17)', ({ given, when, and, then }) => {
    givenCatalog(given);
    whenOpen(when);
    clickButton(and);
    then(/^"PATCH (\S+)" is sent with isActive true$/, (url: string) => {
      expect(calls()[0][0]).toBe(url);
      expect(bodyOf()).toEqual({ isActive: true });
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    and('the page is refreshed', () => waitFor(() => expect(mockRouter.refresh).toHaveBeenCalled()));
  });

  test('The backend fails (AC-17)', ({ when, then }) => {
    when('the HR API fails for the catalog', async () => {
      hrApi.handler = () => new HrBackendError(500);
      await act(async () => {
        await renderPage(HrCatalogPage());
      });
    });
    then(/^I see the alert "(.*)"$/, (message: string) => expect(screen.getByRole('alert').textContent).toBe(message));
  });
});
