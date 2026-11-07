import { join } from 'path';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { defineFeature, loadFeature, type DefineStepFunction } from 'jest-cucumber';
import { hrCatalogItem, hrJobDetail, list } from '../../../../../../test-utils/fixtures';
import { hrApi, HrBackendError, resetHrApi } from '../../../../../../test-utils/hr-api.mock';
import { answer } from '../../../../../../test-utils/hr-backend.mock';
import { mockRequest, resetMockRequest } from '../../../../../../test-utils/next-headers.mock';
import { mockRouter, resetMockRouter } from '../../../../../../test-utils/next-navigation.mock';
import { renderPage } from '../../../../../../test-utils/render-page';
import EditPositionPage from '../page';

jest.mock('next/headers', () => require('../../../../../../test-utils/next-headers.mock'));
jest.mock('next/navigation', () => require('../../../../../../test-utils/next-navigation.mock'));
jest.mock('../../../../../../lib/hr-backend', () => require('../../../../../../test-utils/hr-api.mock'));

const feature = loadFeature(join(__dirname, 'hr-position-edit.feature'));
const JOB = '5d0c9a3e-1b2c-4d3e-8f4a-5b6c7d8e9f01';

let user: UserEvent;
let job: ReturnType<typeof hrJobDetail>;
let categories: ReturnType<typeof hrCatalogItem>[];
let respond: () => Promise<unknown>;
const fetchMock = jest.fn();
const calls = () => fetchMock.mock.calls;
const dialog = () => screen.getByRole('dialog');
const field = (label: string) => screen.getByLabelText(new RegExp(`^${label.replace(/[()]/g, '\\$&')}`)) as HTMLInputElement;
const bodyOf = (index = 0) => JSON.parse(calls()[index][1].body);

async function openJob(id = JOB) {
  hrApi.handler = (path) => {
    if (path === `hr/positions/${id}`) return job;
    if (path === 'hr/job-categories') return categories;
    if (path === 'hr/job-levels') return [hrCatalogItem({ id: 'l1', code: 'MIDDLE', name: 'Middle' })];
    return new HrBackendError(404);
  };
  await act(async () => {
    await renderPage(EditPositionPage({ params: Promise.resolve({ id }) }));
  });
}

const vi = (step: DefineStepFunction) => step('my browser prefers Vietnamese', () => (mockRequest.acceptLanguage = 'vi-VN,vi;q=0.9'));
const whenOpen = (step: DefineStepFunction) => step('I open the job page', () => openJob());
const see = (step: DefineStepFunction) => step(/^I see "(.*)"$/, (text: string) => expect(screen.getByText(text)).toBeTruthy());
const clickButton = (step: DefineStepFunction) => step(/^I click "(.*)"$/, (name: string) => user.click(screen.getByRole('button', { name })));
const press = (step: DefineStepFunction) => step(/^I press "(.*)"$/, (name: string) => user.click(screen.getByRole('button', { name })));
const clickInDialog = (step: DefineStepFunction) => step(/^I click "(.*)" in the dialog$/, (name: string) => user.click(within(dialog()).getByRole('button', { name })));
const refreshed = (step: DefineStepFunction) => step('the page is refreshed', () => waitFor(() => expect(mockRouter.refresh).toHaveBeenCalled()));
const closedAndRefreshed = (step: DefineStepFunction) =>
  step('the dialog is closed and the page is refreshed', async () => {
    await waitFor(() => expect(mockRouter.refresh).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
const sent = (step: DefineStepFunction, check: (init: RequestInit & { body?: string }, rest: string[]) => void) =>
  step(/^"(GET|POST|PATCH|DELETE) (\S+)" is sent(?: (.*))?$/, (method: string, url: string, rest = '') => {
    expect(calls().length).toBeGreaterThan(0);
    const [calledUrl, init] = calls()[0];
    expect([calledUrl, init.method]).toEqual([url, method]);
    check(init, [rest]);
  });
const dialogAlert = (step: DefineStepFunction) => step(/^the dialog shows the alert "(.*)"$/, (message: string) => expect(within(dialog()).getByRole('alert').textContent).toBe(message));
const serverAnswers = (step: DefineStepFunction) => step(/^the server answers (\d+) (\w+)$/, (status: string, code: string) => (respond = async () => answer(Number(status), { code })));
const statusNotice = (step: DefineStepFunction) => step(/^I see the status "(.*)"$/, (text: string) => expect(screen.getByRole('status').textContent).toBe(text));
const criterionRow = (name: string) => screen.getByRole('cell', { name: new RegExp(`^${name}`) }).closest('tr') as HTMLElement;

defineFeature(feature, (test) => {
  beforeEach(() => {
    resetMockRequest();
    resetMockRouter();
    resetHrApi();
    mockRequest.acceptLanguage = 'en-US,en;q=0.9';
    user = userEvent.setup();
    job = hrJobDetail();
    categories = [hrCatalogItem()];
    respond = async () => answer(200, hrJobDetail());
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => respond());
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const givenJob = (step: DefineStepFunction) =>
    step(/^the job is "(DRAFT|OPEN|CLOSED)" with (\d+) applications$/, (status: string, apps: string) => {
      job = hrJobDetail({ status, applicationCount: Number(apps) });
    });

  test('Hints of a draft with applications (AC-14)', ({ given, and, when, then }) => {
    vi(given);
    givenJob(and);
    whenOpen(when);
    see(then);
    see(and);
  });

  test('The form shows the job; the code cannot be changed (AC-14)', ({ given, when, then, and }) => {
    given('the job uses the hidden category "Old Category"', () => {
      job = hrJobDetail({ category: { code: 'OLD', name: 'Old Category' } });
      categories = [hrCatalogItem(), hrCatalogItem({ id: 'o', code: 'OLD', name: 'Old Category', isActive: false })];
    });
    whenOpen(when);
    then(/^the field "(.*)" is "(.*)"$/, (label: string, value: string) => expect(field(label).value).toBe(value));
    and(/^the field "(.*)" is "(.*)"$/, (label: string, value: string) => expect(field(label).value).toBe(value));
    and(/^the field "(.*)" is "(.*)"$/, (label: string, value: string) => expect(field(label).value).toBe(value));
    and(/^the category list shows "(.*)" as chosen$/, (text: string) => {
      const select = field('Category') as unknown as HTMLSelectElement;
      expect(select.options[select.selectedIndex].textContent).toBe(text);
    });
    and(/^I see the code "(.*)" and the link "(.*)"$/, (code: string, path: string) => {
      expect(screen.getByText(code).tagName).toBe('CODE');
      expect(screen.getByText(path).tagName).toBe('CODE');
    });
    and(/^there is no field "(.*)"$/, (label: string) => expect(screen.queryByLabelText(new RegExp(`^${label.replace(/[()]/g, '\\$&')}`))).toBeNull());
  });

  test('Saving the changes (AC-14)', ({ when, and, then }) => {
    whenOpen(when);
    and(/^I change "(.*)" to "(.*)"$/, async (label: string, text: string) => {
      await user.clear(field(label));
      await user.type(field(label), text);
    });
    press(and);
    sent(then, () => {
      expect(bodyOf()).toMatchObject({ title: 'Senior Backend Developer', categoryCode: 'DEVELOPER', levelCode: 'MIDDLE', minYearsExperience: 2 });
      expect(bodyOf()).not.toHaveProperty('code');
    });
    statusNotice(and);
    refreshed(and);
  });

  test('Errors keep what I typed (AC-14)', ({ given, when, and, then }) => {
    serverAnswers(given);
    whenOpen(when);
    and(/^I change "(.*)" to "(.*)"$/, async (label: string, text: string) => {
      await user.clear(field(label));
      await user.type(field(label), text);
    });
    press(and);
    then(/^I see the alert "(.*)"$/, async (message: string) => expect((await screen.findByRole('alert')).textContent).toBe(message));
    and(/^the field "(.*)" is "(.*)"$/, (label: string, value: string) => expect(field(label).value).toBe(value));
  });

  test('The criteria table (AC-15)', ({ given, when, then, and }) => {
    vi(given);
    whenOpen(when);
    then(/^the criteria table has the columns "(.*)"$/, (columns: string) => {
      const table = screen.getByRole('table');
      expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(list(columns));
    });
    and(/^the criterion "NestJS" shows "(.*)", "(.*)" and "(.*)" with the badge "(.*)"$/, (type: string, weight: string, guide: string, badge: string) => {
      const row = criterionRow('NestJS');
      for (const text of [type, weight, guide]) expect(row.textContent).toContain(text);
      expect(within(row).getByText(badge)).toBeTruthy();
    });
    and(/^the criterion "PostgreSQL" has no badge$/, () => expect(within(criterionRow('PostgreSQL')).queryByText('Bắt buộc')).toBeNull());
    and(/^the criteria are listed in the order "(.*)"$/, (order: string) => {
      const names = within(screen.getByRole('table')).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent!.replace('Bắt buộc', ''));
      expect(names).toEqual(list(order));
    });
    and(/^"(.*)" is disabled for "(.*)" and "(.*)" is disabled for "(.*)"$/, (up: string, first: string, down: string, last: string) => {
      expect((screen.getByRole('button', { name: `${up}: ${first}` }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole('button', { name: `${down}: ${last}` }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole('button', { name: `${down}: ${first}` }) as HTMLButtonElement).disabled).toBe(false);
    });
    see(and);
  });

  test('A job without criteria (AC-15)', ({ given, when, then }) => {
    given('the job has no criteria', () => (job = hrJobDetail({ criteria: [], criteriaCount: 0 })));
    whenOpen(when);
    see(then);
  });

  test('Moving a criterion (AC-15)', ({ when, and, then }) => {
    whenOpen(when);
    clickButton(and);
    then(/^"POST (\S+)" is sent with direction "(.*)"$/, (url: string, direction: string) => {
      expect(calls()[0][0]).toBe(url);
      expect(bodyOf()).toEqual({ direction });
    });
    refreshed(and);
  });

  test('Adding a criterion (AC-15)', ({ when, and, then }) => {
    whenOpen(when);
    clickButton(and);
    then(/^the dialog "(.*)" opens with weight "(.*)" and the criterion not required$/, (title: string, weight: string) => {
      expect(screen.getByRole('dialog', { name: title })).toBeTruthy();
      expect(field('Weight').value).toBe(weight);
      expect((field('Required') as HTMLInputElement).checked).toBe(false);
    });
    when('I save the criterion without a name', () => user.click(within(dialog()).getByRole('button', { name: 'Save' })));
    then(/^the dialog shows the alert "(.*)"$/, (message: string) => expect(within(dialog()).getByRole('alert').textContent).toBe(message));
    and('no request is sent', () => expect(calls()).toHaveLength(0));
    when(/^I fill in the criterion "(.*)", type "(.*)", weight "(.*)", required and guide "(.*)"$/, async (name: string, type: string, weight: string, guide: string) => {
      await user.type(field('Name'), name);
      await user.selectOptions(field('Type'), type);
      await user.clear(field('Weight'));
      await user.type(field('Weight'), weight);
      await user.click(field('Required'));
      await user.type(field('Scoring guide'), guide);
    });
    and('I save the criterion', () => user.click(within(dialog()).getByRole('button', { name: 'Save' })));
    then(/^"POST (\S+)" is sent with name "(.*)", type "(.*)", weight (\d+), required and guide "(.*)"$/, (url: string, name: string, type: string, weight: string, guide: string) => {
      expect(calls()[0][0]).toBe(url);
      expect(bodyOf()).toEqual({ name, type, weight: Number(weight), isRequired: true, description: guide });
    });
    closedAndRefreshed(and);
  });

  test('The weight must be 1 to 5 (AC-15)', ({ when, and, then }) => {
    whenOpen(when);
    clickButton(and);
    and(/^I fill in the criterion "(.*)", type "(.*)", weight "(.*)", not required and guide "(.*)"$/, async (name: string, type: string, weight: string) => {
      await user.type(field('Name'), name);
      await user.selectOptions(field('Type'), type);
      await user.clear(field('Weight'));
      await user.type(field('Weight'), weight);
    });
    and('I save the criterion', () => user.click(within(dialog()).getByRole('button', { name: 'Save' })));
    then(/^(.*)$/, async (outcome: string) => {
      const alert = outcome.match(/alert "(.*)"$/);
      if (alert) {
        expect(within(dialog()).getByRole('alert').textContent).toBe(alert[1]);
        expect(calls()).toHaveLength(0);
      } else {
        await waitFor(() => expect(calls()).toHaveLength(1));
        expect(bodyOf().weight).toBe(Number(outcome.match(/weight (\d)/)![1]));
        expect(bodyOf().description).toBe('');
      }
    });
  });

  test('Editing a criterion (AC-15)', ({ when, and, then }) => {
    whenOpen(when);
    clickButton(and);
    then(/^the dialog "(.*)" opens with name "(.*)" and weight "(.*)"$/, (title: string, name: string, weight: string) => {
      expect(screen.getByRole('dialog', { name: title })).toBeTruthy();
      expect(field('Name').value).toBe(name);
      expect(field('Weight').value).toBe(weight);
    });
    when(/^I change the criterion weight to "(.*)"$/, async (weight: string) => {
      await user.clear(field('Weight'));
      await user.type(field('Weight'), weight);
    });
    and('I save the criterion', () => user.click(within(dialog()).getByRole('button', { name: 'Save' })));
    then(/^"PATCH (\S+)" is sent with weight (\d+)$/, (url: string, weight: string) => {
      expect(calls()[0][0]).toBe(url);
      expect(bodyOf().weight).toBe(Number(weight));
    });
    closedAndRefreshed(and);
  });

  test('Deleting a criterion asks first (AC-15)', ({ when, and, then }) => {
    whenOpen(when);
    clickButton(and);
    then(/^the dialog '(.*)' opens$/, (title: string) => expect(screen.getByRole('dialog', { name: title })).toBeTruthy());
    when(/^I click "(.*)"$/, (name: string) => user.click(screen.getByRole('button', { name })));
    then('the dialog is closed and no request is sent', () => {
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(calls()).toHaveLength(0);
    });
    when(/^I click "(.*)"$/, (name: string) => user.click(screen.getByRole('button', { name })));
    and(/^I click "(.*)" in the dialog$/, (name: string) => user.click(within(dialog()).getByRole('button', { name })));
    then(/^"DELETE (\S+)" is sent$/, (url: string) => expect([calls()[0][0], calls()[0][1].method]).toEqual([url, 'DELETE']));
    closedAndRefreshed(and);
  });

  test('The last criterion of an open job stays (AC-15)', ({ given, when, and, then }) => {
    serverAnswers(given);
    whenOpen(when);
    clickButton(and);
    clickInDialog(and);
    dialogAlert(then);
  });

  test('A warning when the job has applications (AC-15)', ({ given, when, then }) => {
    vi(given);
    whenOpen(when);
    see(then);
  });

  test('Buttons of each status (AC-16)', ({ given, when, then }) => {
    givenJob(given);
    whenOpen(when);
    then(/^I see the status buttons "(.*)"$/, (names: string) => {
      for (const name of list(names)) expect(screen.getByRole('button', { name })).toBeTruthy();
      const others = ['Open job', 'Close job', 'Back to draft', 'Reopen'].filter((n) => !list(names).includes(n));
      for (const name of others) expect(screen.queryByRole('button', { name })).toBeNull();
    });
  });

  test('Opening a job needs a confirmation (AC-16)', ({ given, when, and, then }) => {
    givenJob(given);
    whenOpen(when);
    clickButton(and);
    then(/^the dialog "(.*)" says "(.*)"$/, (title: string, text: string) => {
      expect(within(screen.getByRole('dialog', { name: title })).getByText(text)).toBeTruthy();
    });
    when(/^I click "(.*)"$/, (name: string) => user.click(screen.getByRole('button', { name })));
    then(/^"POST (\S+)" is sent with status "(.*)"$/, (url: string, status: string) => {
      expect(calls()[0][0]).toBe(url);
      expect(bodyOf()).toEqual({ status });
    });
    closedAndRefreshed(and);
    statusNotice(and);
  });

  test('Opening a job without criteria is refused (AC-16)', ({ given, and, when, then }) => {
    givenJob(given);
    serverAnswers(and);
    whenOpen(when);
    clickButton(and);
    clickButton(and);
    dialogAlert(then);
    and('the page is not refreshed', () => expect(mockRouter.refresh).not.toHaveBeenCalled());
  });

  test('Closing a job (AC-16)', ({ when, and, then }) => {
    whenOpen(when);
    clickButton(and);
    then(/^the dialog "(.*)" says "(.*)"$/, (title: string, text: string) => {
      expect(within(screen.getByRole('dialog', { name: title })).getByText(text)).toBeTruthy();
    });
  });

  test('Deleting a job without applications (AC-16)', ({ given, when, and, then }) => {
    givenJob(given);
    whenOpen(when);
    clickButton(and);
    then(/^the dialog '(.*)' says "(.*)"$/, (title: string, text: string) => {
      expect(within(screen.getByRole('dialog', { name: title })).getByText(text)).toBeTruthy();
    });
    when(/^I click "(.*)" in the dialog$/, (name: string) => user.click(within(dialog()).getByRole('button', { name })));
    then(/^"DELETE (\S+)" is sent$/, (url: string) => expect([calls()[0][0], calls()[0][1].method]).toEqual([url, 'DELETE']));
    and(/^I am sent to "(.*)"$/, (target: string) => expect(mockRouter.replace).toHaveBeenCalledWith(target));
  });

  test('A job with applications cannot be deleted (AC-16)', ({ when, then, and }) => {
    whenOpen(when);
    then(/^there is no button "(.*)"$/, (name: string) => expect(screen.queryByRole('button', { name })).toBeNull());
    see(and);
    and(/^I see the link "(.*)" to "(.*)"$/, (name: string, href: string) => expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href));
  });

  test('Unknown job (AC-18)', ({ when, then, and }) => {
    when(/^the HR API answers (\d+) for the job$/, async (status: string) => {
      hrApi.handler = () => new HrBackendError(Number(status));
      await act(async () => {
        await renderPage(EditPositionPage({ params: Promise.resolve({ id: 'nope' }) }));
      });
    });
    see(then);
    and(/^I see the link "(.*)" to "(.*)"$/, (name: string, href: string) => expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href));
  });

  test('The backend fails (AC-18)', ({ when, then }) => {
    when(/^the HR API answers (\d+) for the job$/, async (status: string) => {
      hrApi.handler = () => new HrBackendError(Number(status));
      await act(async () => {
        await renderPage(EditPositionPage({ params: Promise.resolve({ id: JOB }) }));
      });
    });
    then(/^I see the alert "(.*)"$/, (message: string) => expect(screen.getByRole('alert').textContent).toBe(message));
  });
});
