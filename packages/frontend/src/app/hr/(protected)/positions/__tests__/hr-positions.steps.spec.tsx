import { join } from 'path';
import { act, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { defineFeature, loadFeature, type DefineStepFunction } from 'jest-cucumber';
import { hrCatalogItem, hrJob, list } from '../../../../../test-utils/fixtures';
import { hrApi, HrBackendError, resetHrApi } from '../../../../../test-utils/hr-api.mock';
import { answer } from '../../../../../test-utils/hr-backend.mock';
import { mockRequest, resetMockRequest } from '../../../../../test-utils/next-headers.mock';
import { mockRouter, resetMockRouter } from '../../../../../test-utils/next-navigation.mock';
import { renderPage } from '../../../../../test-utils/render-page';
import NewPositionPage from '../new/page';
import HrPositionsPage from '../page';

jest.mock('next/headers', () => require('../../../../../test-utils/next-headers.mock'));
jest.mock('next/navigation', () => require('../../../../../test-utils/next-navigation.mock'));
jest.mock('../../../../../lib/hr-backend', () => require('../../../../../test-utils/hr-api.mock'));

const feature = loadFeature(join(__dirname, 'hr-positions.feature'));

let user: UserEvent;
let jobs: ReturnType<typeof hrJob>[];
let categories: ReturnType<typeof hrCatalogItem>[];
let levels: ReturnType<typeof hrCatalogItem>[];
let respond: () => Promise<unknown>;
const fetchMock = jest.fn();

const vi = (step: DefineStepFunction) => step('my browser prefers Vietnamese', () => (mockRequest.acceptLanguage = 'vi-VN,vi;q=0.9'));
const handler = (path: string) => {
  if (path === 'hr/positions') return jobs;
  if (path === 'hr/job-categories') return categories;
  if (path === 'hr/job-levels') return levels;
  return new HrBackendError(404);
};
const field = (label: string) => screen.getByLabelText(new RegExp(`^${label.replace(/[()]/g, '\\$&')}`)) as HTMLInputElement;
const errorUnder = (label: string) => document.getElementById(field(label).getAttribute('aria-describedby') ?? '')?.textContent;
const posts = () => fetchMock.mock.calls;
const catalogOf = (names: string) =>
  list(names).map((entry, i) => hrCatalogItem({ id: `i${i}`, code: entry.replace(/ \(hidden\)/, '').toUpperCase(), name: entry.replace(/ \(hidden\)/, ''), isActive: !entry.includes('(hidden)') }));

async function openList(query: string) {
  hrApi.handler = handler;
  const status = new URLSearchParams(query.replace('?', '')).get('status') ?? undefined;
  await act(async () => {
    await renderPage(HrPositionsPage({ searchParams: Promise.resolve(status ? { status } : {}) }));
  });
}
async function openNew() {
  hrApi.handler = handler;
  await act(async () => {
    await renderPage(NewPositionPage());
  });
}
const rowOf = (title: string) => screen.getByRole('link', { name: title }).closest('tr') as HTMLElement;

async function fillValid(years: string) {
  await user.type(field('Title'), 'Backend Developer');
  await user.selectOptions(field('Category'), 'DEVELOPER');
  await user.selectOptions(field('Level'), 'MIDDLE');
  await user.clear(field('Minimum years of experience'));
  await user.type(field('Minimum years of experience'), years);
  await user.type(field('Job description (markdown)'), 'Build APIs');
}

defineFeature(feature, (test) => {
  beforeEach(() => {
    resetMockRequest();
    resetMockRouter();
    resetHrApi();
    mockRequest.acceptLanguage = 'en-US,en;q=0.9';
    user = userEvent.setup();
    jobs = [];
    categories = [hrCatalogItem()];
    levels = [hrCatalogItem({ id: 'l1', code: 'MIDDLE', name: 'Middle' })];
    respond = async () => answer(201, { id: 'new-id' });
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => respond());
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const twoJobs = (step: DefineStepFunction) =>
    step('there are the jobs "Backend Developer" (open, 3 criteria, 4 applications) and "Old Job" (closed)', () => {
      jobs = [hrJob(), hrJob({ id: 'old-id', code: 'old-job', title: 'Old Job', status: 'CLOSED', criteriaCount: 1, applicationCount: 0 })];
    });
  const whenOpenList = (step: DefineStepFunction) => step(/^I open the jobs page "(.*)"$/, openList);
  const link = (step: DefineStepFunction) => step(/^I see the link "(.*)" to "(.*)"$/, (name: string, href: string) => expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href));

  test('Table of jobs (AC-13)', ({ given, and, when, then }) => {
    vi(given);
    twoJobs(and);
    whenOpenList(when);
    then(/^the table has the columns "(.*)"$/, (columns: string) => expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(list(columns)));
    and(/^the row "Backend Developer" shows (.*)$/, (cells: string) => {
      for (const text of cells.match(/"([^"]*)"/g)!.map((c) => c.slice(1, -1))) expect(rowOf('Backend Developer').textContent).toContain(text);
    });
    and(/^"(.*)" links to "(.*)"$/, (name: string, href: string) => expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href));
    and(/^the number of applications of "(.*)" links to "(.*)"$/, (title: string, href: string) => expect(within(rowOf(title)).getByRole('link', { name: '4' }).getAttribute('href')).toBe(href));
    link(and);
  });

  test('Filter by status with links and counts (AC-13)', ({ given, and, when, then }) => {
    vi(given);
    twoJobs(and);
    whenOpenList(when);
    then(/^the status links are "(.*)"$/, (links: string) => {
      const nav = screen.getByRole('navigation', { name: 'Trạng thái' });
      expect(within(nav).getAllByRole('link').map((a) => `${a.textContent} → ${a.getAttribute('href')}`)).toEqual(list(links));
    });
    and(/^the current status link is "(.*)"$/, (name: string) => {
      expect(screen.getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent!.replace(/\s*\d+$/, ''))).toEqual([name]);
    });
    and(/^only the job "(.*)" is listed$/, (title: string) => {
      expect(screen.getByRole('link', { name: title })).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Backend Developer' })).toBeNull();
    });
  });

  test('No jobs yet (AC-13)', ({ given, and, when, then }) => {
    vi(given);
    and('there are no jobs', () => (jobs = []));
    whenOpenList(when);
    then(/^I see "(.*)"$/, (text: string) => expect(screen.getByText(text)).toBeTruthy());
    link(and);
  });

  test('The backend fails (AC-13)', ({ given, when, then }) => {
    given('the HR API is down', () => undefined);
    when(/^I open the jobs page "(.*)"$/, async () => {
      hrApi.handler = () => new HrBackendError(500);
      await act(async () => {
        await renderPage(HrPositionsPage({ searchParams: Promise.resolve({}) }));
      });
    });
    then(/^I see the alert "(.*)"$/, (message: string) => expect(screen.getByRole('alert').textContent).toBe(message));
  });

  const givenCatalog = (step: DefineStepFunction) =>
    step(/^the catalog has the categories "(.*)" and the levels "(.*)"$/, (c: string, l: string) => {
      categories = catalogOf(c);
      levels = catalogOf(l);
    });

  test('The create form (AC-14)', ({ given, and, when, then }) => {
    vi(given);
    and(/^the catalog has the categories "(.*)" and the levels "(.*)"$/, (c: string, l: string) => {
      categories = catalogOf(c);
      levels = catalogOf(l);
    });
    when('I open the new job page', openNew);
    then(/^I see the fields "(.*)"$/, (labels: string) => {
      for (const label of list(labels)) expect(field(label)).toBeTruthy();
    });
    and(/^the category list offers "(.*)" but not "(.*)"$/, (yes: string, no: string) => {
      const options = within(field('Nhóm')).getAllByRole('option').map((o) => o.textContent);
      expect(options).toContain(yes);
      expect(options).not.toContain(no);
    });
    and(/^the level list offers "(.*)" and "(.*)"$/, (a: string, b: string) => {
      const options = within(field('Level')).getAllByRole('option').map((o) => o.textContent);
      expect(options).toEqual(expect.arrayContaining([a, b]));
    });
  });

  test('The code hint follows the title (AC-14)', ({ given, when, and, then }) => {
    givenCatalog(given);
    when('I open the new job page', openNew);
    and(/^I type "(.*)" in "(.*)"$/, (text: string, label: string) => user.type(field(label), text));
    then(/^I see the hint '(.*)'$/, (hint: string) => expect(screen.getByText((content) => content.includes(hint))).toBeTruthy());
  });

  test('The form is checked in the browser (AC-14)', ({ given, when, and, then }) => {
    givenCatalog(given);
    when('I open the new job page', openNew);
    and(/^I press "(.*)"$/, (name: string) => user.click(screen.getByRole('button', { name })));
    then(/^I see under "(.*)" "(.*)"$/, (label: string, message: string) => expect(errorUnder(label)).toBe(message));
    and(/^I see under "(.*)" "(.*)"$/, (label: string, message: string) => expect(errorUnder(label)).toBe(message));
    and(/^I see under "(.*)" "(.*)"$/, (label: string, message: string) => expect(errorUnder(label)).toBe(message));
    and(/^I see under "(.*)" "(.*)"$/, (label: string, message: string) => expect(errorUnder(label)).toBe(message));
    and('no request is sent', () => expect(posts()).toHaveLength(0));
  });

  test('Years of experience (AC-14)', ({ given, when, and, then }) => {
    givenCatalog(given);
    when('I open the new job page', openNew);
    and(/^I fill in a valid job with "(.*)" years$/, (years: string) => fillValid(years));
    and(/^I press "(.*)"$/, (name: string) => user.click(screen.getByRole('button', { name })));
    then(/^(.*)$/, (outcome: string) => {
      const under = outcome.match(/^I see under "(.*)" "(.*)"$/);
      if (under) {
        expect(errorUnder(under[1])).toBe(under[2]);
        expect(posts()).toHaveLength(0);
      } else {
        const years = Number(outcome.match(/with (\d+) years/)![1]);
        expect(JSON.parse(posts()[0][1].body).minYearsExperience).toBe(years);
      }
    });
  });

  test('Creating a job goes to its page (AC-14)', ({ given, and, when, then }) => {
    givenCatalog(given);
    and(/^the server creates the job with id "(.*)"$/, (id: string) => (respond = async () => answer(201, { id })));
    when('I open the new job page', openNew);
    and(/^I fill in a valid job with "(.*)" years$/, (years: string) => fillValid(years));
    and(/^I press "(.*)"$/, (name: string) => user.click(screen.getByRole('button', { name })));
    then(/^"POST (.*)" is sent as JSON with the title "(.*)", category "(.*)", level "(.*)", (\d+) years and no code$/, (url: string, title: string, category: string, level: string, years: string) => {
      const [calledUrl, init] = posts()[0];
      expect(calledUrl).toBe(url);
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(JSON.parse(init.body)).toEqual({ title, categoryCode: category, levelCode: level, minYearsExperience: Number(years), description: 'Build APIs' });
    });
    and(/^I am sent to "(.*)"$/, (target: string) => expect(mockRouter.replace).toHaveBeenCalledWith(target));
  });

  test('A code typed by hand is sent (AC-14)', ({ given, when, and, then }) => {
    givenCatalog(given);
    when('I open the new job page', openNew);
    and(/^I fill in a valid job with "(.*)" years$/, (years: string) => fillValid(years));
    and(/^I type "(.*)" in "(.*)"$/, (text: string, label: string) => user.type(field(label), text));
    and(/^I press "(.*)"$/, (name: string) => user.click(screen.getByRole('button', { name })));
    then(/^the request has the code "(.*)"$/, (code: string) => expect(JSON.parse(posts()[0][1].body).code).toBe(code));
  });

  test('Errors of the server (AC-14)', ({ given, and, when, then }) => {
    givenCatalog(given);
    and(/^the server answers (\d+) (\w+)$/, (status: string, code: string) => (respond = async () => answer(Number(status), code === 'none' ? {} : { code })));
    when('I open the new job page', openNew);
    and(/^I fill in a valid job with "(.*)" years$/, (years: string) => fillValid(years));
    and(/^I press "(.*)"$/, (name: string) => user.click(screen.getByRole('button', { name })));
    then(/^(.*)$/, async (where: string) => {
      const under = where.match(/^I see under "(.*)" "(.*)"$/);
      if (under) expect(errorUnder(under[1])).toBe(under[2]);
      else expect((await screen.findByRole('alert')).textContent).toBe(where.match(/alert "(.*)"$/)![1]);
    });
    and('I stay on the form', () => expect(mockRouter.replace).not.toHaveBeenCalled());
  });
});
