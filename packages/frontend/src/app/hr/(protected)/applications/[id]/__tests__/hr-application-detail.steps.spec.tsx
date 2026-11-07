import { join } from 'path';
import { act, screen, within } from '@testing-library/react';
import { defineFeature, loadFeature, type DefineStepFunction } from 'jest-cucumber';
import { hrDetail, list } from '../../../../../../test-utils/fixtures';
import { hrApi, HrBackendError, resetHrApi } from '../../../../../../test-utils/hr-api.mock';
import { mockRequest, resetMockRequest } from '../../../../../../test-utils/next-headers.mock';
import { renderPage } from '../../../../../../test-utils/render-page';
import HrApplicationDetailPage from '../page';

jest.mock('next/headers', () => require('../../../../../../test-utils/next-headers.mock'));
jest.mock('next/navigation', () => require('../../../../../../test-utils/next-navigation.mock'));
jest.mock('../../../../../../lib/hr-backend', () => require('../../../../../../test-utils/hr-api.mock'));

const feature = loadFeature(join(__dirname, 'hr-application-detail.feature'));

let detail: ReturnType<typeof hrDetail>;

async function openPage(id: string, from?: string) {
  await act(async () => {
    await renderPage(HrApplicationDetailPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve(from ? { from } : {}) }));
  });
}
const open = async (id: string, from: string) => {
  hrApi.handler = () => detail;
  await openPage(id, from);
};
const vi = (step: DefineStepFunction) =>
  step('my browser prefers Vietnamese', () => {
    mockRequest.acceptLanguage = 'vi-VN,vi;q=0.9';
  });
const whenOpen = (step: DefineStepFunction) => step(/^I open the application "(.*)" from the list "(.*)"$/, open);
const see = (step: DefineStepFunction) => step(/^I see "(.*)"$/, (text: string) => expect(screen.getByText(text)).toBeTruthy());
const row = (name: string) => screen.getByRole('cell', { name: new RegExp(`^${name}`) }).closest('tr') as HTMLElement;
const noResult = (status: string) => ({ ...hrDetail({ status, canDecide: false, canReEvaluate: false }), evaluation: null, history: [{ fromStatus: 'EVALUATING', toStatus: 'EVALUATION_FAILED', note: 'Không tải được CV từ Google Drive', createdAt: '2026-11-07T17:01:00.000Z', changedBy: null }] });

defineFeature(feature, (test) => {
  beforeEach(() => {
    resetMockRequest();
    resetHrApi();
    mockRequest.acceptLanguage = 'en-US,en;q=0.9';
    detail = hrDetail();
  });

  test('Header and AI result (AC-13)', ({ given, when, then, and }) => {
    vi(given);
    whenOpen(when);
    then(/^the back link "(.*)" goes to "(.*)"$/, (name: string, href: string) => {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
    });
    and(/^I see the heading "(.*)" with (.*)$/, (name: string, rest: string) => {
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading.textContent).toBe(name);
      for (const text of rest.match(/"([^"]*)"/g)!.map((t) => t.slice(1, -1))) expect(heading.parentElement!.textContent).toContain(text);
    });
    and(/^I see the status "(.*)"$/, (status: string) => {
      expect(within(screen.getByRole('heading', { level: 1 }).parentElement!).getByText(status)).toBeTruthy();
    });
    and(/^I see the overall score "(.*)" with "(.*)"$/, (score: string, label: string) => {
      expect(screen.getByText(score).tagName).toBe('STRONG');
      expect(screen.getByText(label)).toBeTruthy();
    });
    and(/^I see "(.*)" and "(.*)"$/, (required: string, estimated: string) => {
      const text = screen.getByText(/Yêu cầu:/).textContent!;
      expect(text).toContain(required);
      expect(text).toContain(estimated);
    });
    and(/^I see the summary "(.*)"$/, (summary: string) => expect(screen.getByText(summary)).toBeTruthy());
    and(/^I see the line "(.*)"$/, (line: string) => expect(screen.getByText(line)).toBeTruthy());
  });

  test('Score per criterion (AC-13, AC-18)', ({ given, when, then, and }) => {
    vi(given);
    whenOpen(when);
    then(/^the table "(.*)" has the columns "(.*)"$/, (name: string, columns: string) => {
      const table = screen.getByRole('table', { name });
      expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(list(columns));
    });
    and(/^the row "NestJS" shows (.*)$/, (cells: string) => {
      for (const text of cells.match(/"([^"]*)"/g)!.map((t) => t.slice(1, -1))) expect(row('NestJS').textContent).toContain(text);
    });
    and(/^the row "NestJS" has the "(.*)" badge and the row "English" does not$/, (badge: string) => {
      expect(within(row('NestJS')).getByText(badge)).toBeTruthy();
      expect(within(row('English')).queryByText(badge)).toBeNull();
    });
    and(/^I see the strengths "(.*)" and the weaknesses "(.*)"$/, (strength: string, weakness: string) => {
      expect(screen.getByText(strength)).toBeTruthy();
      expect(screen.getByText(weakness)).toBeTruthy();
    });
  });

  test('The CV is shown in the page (AC-13)', ({ when, then, and }) => {
    whenOpen(when);
    then(/^the CV frame "(.*)" shows "(.*)"$/, (title: string, src: string) => {
      expect(screen.getByTitle(title).getAttribute('src')).toBe(src);
    });
    and(/^the link "(.*)" opens "(.*)" in a new tab$/, (name: string, href: string) => {
      const link = screen.getByRole('link', { name });
      expect([link.getAttribute('href'), link.getAttribute('target'), link.getAttribute('rel')]).toEqual([href, '_blank', 'noopener noreferrer']);
    });
    and(/^the link "(.*)" downloads "(.*)"$/, (name: string, file: string) => {
      expect(screen.getByRole('link', { name }).getAttribute('download')).toBe(file);
    });
  });

  test('No AI result yet or a failed one (AC-14)', ({ given, and, when, then }) => {
    vi(given);
    and(/^the application is "(.*)" without an AI result$/, (status: string) => {
      detail = noResult(status) as never;
    });
    whenOpen(when);
    see(then);
  });

  test('Re-evaluation requested, the old result is kept (AC-14)', ({ given, and, when, then }) => {
    vi(given);
    and('the application is "SUBMITTED" with the old AI result', () => {
      detail = hrDetail({ status: 'SUBMITTED', canDecide: false, canReEvaluate: false });
    });
    whenOpen(when);
    see(then);
    and(/^I see the overall score "(.*)" with "(.*)"$/, (score: string, label: string) => {
      expect(screen.getByText(score)).toBeTruthy();
      expect(screen.getByText(label)).toBeTruthy();
    });
  });

  test('Status history and other applications (AC-15)', ({ given, and, when, then }) => {
    vi(given);
    and(/^the application has a decision by "(.*)" with the note "(.*)" and another application "(.*)"$/, (hr: string, note: string, other: string) => {
      detail = hrDetail({
        history: [...hrDetail().history, { fromStatus: 'EVALUATED', toStatus: 'ACCEPTED', note, createdAt: '2026-11-08T03:00:00.000Z', changedBy: hr }],
        otherApplications: [{ id: 'o1', positionTitle: other, status: 'REJECTED', createdAt: '2026-01-01T00:00:00.000Z', overallScore: 40 }],
      });
    });
    whenOpen(when);
    then(/^the history lists "(.*)" and "(.*)" in this order$/, (first: string, second: string) => {
      const items = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
      const at = (text: string) => items.findIndex((t) => t.includes(text));
      expect(at(first)).toBeGreaterThanOrEqual(0);
      expect(at(first)).toBeLessThan(at(second));
    });
    and(/^the history row of "(.*)" shows "(.*)" and "(.*)"$/, (hr: string, change: string, note: string) => {
      const li = screen.getAllByRole('listitem').find((l) => l.textContent!.includes(hr))!;
      expect(li.textContent).toContain(change);
      expect(li.textContent).toContain(note);
    });
    and(/^the other application "(.*)" links to "(.*)" and shows "(.*)" and "(.*)"$/, (title: string, href: string, status: string, score: string) => {
      const link = screen.getByRole('link', { name: title });
      expect(link.getAttribute('href')).toBe(href);
      expect(link.parentElement!.textContent).toContain(status);
      expect(link.parentElement!.textContent).toContain(score);
    });
  });

  test('No other applications (AC-15)', ({ when, then }) => {
    whenOpen(when);
    then(/^I see no section "(.*)"$/, (title: string) => expect(screen.queryByText(title)).toBeNull());
  });

  test('Unknown application (AC-18)', ({ when, then, and }) => {
    when(/^the HR API answers (\d+) for the application$/, async (status: string) => {
      hrApi.handler = () => new HrBackendError(Number(status));
      await openPage('nope');
    });
    then(/^I see "(.*)"$/, (text: string) => expect(screen.getByText(text)).toBeTruthy());
    and(/^the back link "(.*)" goes to "(.*)"$/, (name: string, href: string) => expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href));
  });

  test('The backend fails (AC-18)', ({ when, then }) => {
    when(/^the HR API answers (\d+) for the application$/, async (status: string) => {
      hrApi.handler = () => new HrBackendError(Number(status));
      await openPage('a1');
    });
    then(/^I see the alert "(.*)"$/, (message: string) => expect(screen.getByRole('alert').textContent).toBe(message));
  });
});
