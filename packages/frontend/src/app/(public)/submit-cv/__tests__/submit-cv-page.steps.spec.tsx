import { join } from 'path';
import { screen, within } from '@testing-library/react';
import { defineFeature, loadFeature, type DefineStepFunction } from 'jest-cucumber';
import * as backend from '../../../../test-utils/backend.mock';
import { list, positionByTitle, positionDetail } from '../../../../test-utils/fixtures';
import { mockRequest, resetMockRequest } from '../../../../test-utils/next-headers.mock';
import { renderPage } from '../../../../test-utils/render-page';
import SubmitCvPage from '../page';

jest.mock('next/headers', () => require('../../../../test-utils/next-headers.mock'));
jest.mock('next/navigation', () => require('../../../../test-utils/next-navigation.mock'));
jest.mock('../../../../lib/backend', () => require('../../../../test-utils/backend.mock'));
jest.mock('react-markdown', () => require('../../../../test-utils/react-markdown.mock'));

const feature = loadFeature(join(__dirname, 'submit-cv-page.feature'));

const positionSelect = () => screen.getByLabelText(/^Position/) as HTMLSelectElement;

const givenEnglish = (step: DefineStepFunction) => {
  step('my browser prefers English', () => {
    mockRequest.acceptLanguage = 'en-US,en;q=0.9';
  });
};

const givenOpenJobs = (step: DefineStepFunction) => {
  step(/^the API has the open jobs "(.*)"$/, (titles: string) => {
    backend.fetchOpenPositions.mockResolvedValue(list(titles).map(positionByTitle));
  });
};

const whenOpen = (step: DefineStepFunction) => {
  step(/^I open the submit CV page(?: with "(.*)")?$/, async (query?: string) => {
    const searchParams = Promise.resolve(Object.fromEntries(new URLSearchParams(query ?? '')));
    await renderPage(SubmitCvPage({ searchParams }));
  });
};

const thenNoForm = (step: DefineStepFunction) => {
  step('I do not see the form', () => {
    expect(screen.queryByRole('button', { name: 'Submit CV' })).toBeNull();
    expect(screen.queryByLabelText(/^Position/)).toBeNull();
  });
};

defineFeature(feature, (test) => {
  beforeEach(() => {
    resetMockRequest();
    backend.resetMockBackend();
    // The job description is loaded in the browser through the /api rewrite
    global.fetch = jest.fn(async (url: string) => {
      const detail = positionDetail(decodeURIComponent(url.split('/').pop() ?? ''));
      return detail ? { ok: true, json: async () => detail } : { ok: false, status: 404, json: async () => ({}) };
    }) as unknown as typeof fetch;
  });

  test('Preselect the job chosen on the jobs page', ({ given, and, when, then }) => {
    givenEnglish(given);
    givenOpenJobs(and);
    whenOpen(when);

    then(/^the position "(.*)" is selected$/, (title: string) => {
      expect(positionSelect().options[positionSelect().selectedIndex].textContent).toBe(title);
    });

    and(/^I see the criteria "(.*)"$/, async (criteria: string) => {
      const listEl = await screen.findByRole('list', { name: 'What we look for' });
      expect(within(listEl).getAllByRole('listitem').map((li) => li.textContent)).toEqual(list(criteria));
    });
  });

  test('An unknown or closed job is not preselected', ({ given, and, when, then }) => {
    givenEnglish(given);
    givenOpenJobs(and);
    whenOpen(when);

    then('no position is selected', () => {
      expect(positionSelect().value).toBe('');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    and(/^the position list has "(.*)"$/, (titles: string) => {
      const options = Array.from(positionSelect().options).filter((o) => o.value);
      expect(options.map((o) => o.textContent)).toEqual(list(titles));
    });
  });

  test('No open jobs to apply for', ({ given, and, when, then }) => {
    givenEnglish(given);

    and('the API has no open jobs', () => {
      backend.fetchOpenPositions.mockResolvedValue([]);
    });

    whenOpen(when);

    then(/^I see the message "(.*)"$/, (message: string) => {
      expect(screen.getByText(message)).toBeTruthy();
    });

    and(/^I see a "(.*)" link to "(.*)"$/, (name: string, href: string) => {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
    });

    thenNoForm(and);
  });

  test('The backend is unavailable', ({ given, and, when, then }) => {
    givenEnglish(given);

    and('the backend is unavailable', () => {
      backend.mockBackendUnavailable();
    });

    whenOpen(when);

    then(/^I see the alert "(.*)"$/, (message: string) => {
      expect(screen.getByRole('alert').textContent).toBe(message);
    });

    thenNoForm(and);
  });
});
