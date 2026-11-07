import { join } from 'path';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { defineFeature, loadFeature, type DefineStepFunction } from 'jest-cucumber';
import * as backend from '../../../../test-utils/backend.mock';
import { list, positionByTitle } from '../../../../test-utils/fixtures';
import { mockRequest, resetMockRequest } from '../../../../test-utils/next-headers.mock';
import { mockRouter, resetMockRouter } from '../../../../test-utils/next-navigation.mock';
import { renderPage } from '../../../../test-utils/render-page';
import JobsPage from '../page';

jest.mock('next/headers', () => require('../../../../test-utils/next-headers.mock'));
jest.mock('next/navigation', () => require('../../../../test-utils/next-navigation.mock'));
jest.mock('../../../../lib/backend', () => require('../../../../test-utils/backend.mock'));

const feature = loadFeature(join(__dirname, 'jobs.feature'));

const card = (title: string) => within(screen.getByRole('article', { name: title }));

const givenBrowserLanguage = (step: DefineStepFunction) => {
  step(/^my browser prefers (English|Vietnamese)$/, (language: string) => {
    mockRequest.acceptLanguage = language === 'English' ? 'en-US,en;q=0.9' : 'vi-VN,vi;q=0.9';
  });
};

const givenOpenJobs = (step: DefineStepFunction) => {
  step(/^the API has the open jobs "(.*)"$/, (titles: string) => {
    backend.fetchOpenPositions.mockResolvedValue(list(titles).map(positionByTitle));
  });
};

const givenNoJobs = (step: DefineStepFunction) => {
  step('the API has no open jobs', () => {
    backend.fetchOpenPositions.mockResolvedValue([]);
  });
};

const whenOpenJobs = (step: DefineStepFunction) => {
  step('I open the jobs page', async () => {
    await renderPage(JobsPage({ searchParams: Promise.resolve({}) }));
  });
};

const whenOpenJobsWith = (step: DefineStepFunction) => {
  step(/^I open the jobs page with "(.*)"$/, async (query: string) => {
    await renderPage(JobsPage({ searchParams: Promise.resolve(Object.fromEntries(new URLSearchParams(query))) }));
  });
};

const whenChooseFilter = (step: DefineStepFunction) => {
  step(/^I choose "(.*)" in the "(.*)" filter$/, async (option: string, filter: string) => {
    await userEvent.setup().selectOptions(screen.getByLabelText(filter), option);
  });
};

const thenUrlBecomes = (step: DefineStepFunction) => {
  step(/^the URL becomes "(.*)"$/, (url: string) => {
    expect(mockRouter.push).toHaveBeenLastCalledWith(url);
  });
};

const thenCardShows = (step: DefineStepFunction) => {
  step(/^the "(.*)" card shows "(.*)"$/, (title: string, meta: string) => {
    expect(card(title).getByText(meta)).toBeTruthy();
  });
};

const thenCardTags = (step: DefineStepFunction) => {
  step(/^the "(.*)" card has the tags "(.*)"$/, (title: string, tags: string) => {
    expect(card(title).getAllByRole('listitem').map((li) => li.textContent)).toEqual(list(tags));
  });
};

const thenCardLink = (step: DefineStepFunction) => {
  step(/^the "(.*)" card has an "(.*)" link to "(.*)"$/, (title: string, name: string, href: string) => {
    expect(card(title).getByRole('link', { name }).getAttribute('href')).toBe(href);
  });
};

const thenClearFilters = (step: DefineStepFunction) => {
  step(/^I see a "(.*)" link to "(.*)"$/, (name: string, href: string) => {
    expect(screen.getAllByRole('link', { name }).every((a) => a.getAttribute('href') === href)).toBe(true);
  });
};

const thenMessage = (step: DefineStepFunction) => {
  step(/^I see the message "(.*)"$/, (message: string) => {
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });
};

defineFeature(feature, (test) => {
  beforeEach(() => {
    resetMockRequest();
    resetMockRouter();
    backend.resetMockBackend();
  });

  test('List the open jobs in the order of the API', ({ given, and, when, then }) => {
    givenBrowserLanguage(given);
    givenOpenJobs(and);
    whenOpenJobs(when);

    then(/^I see the job cards "(.*)" in that order$/, (titles: string) => {
      expect(screen.getAllByRole('article').map((a) => within(a).getByRole('heading').textContent)).toEqual(list(titles));
    });

    thenCardShows(and);
    thenCardTags(and);
    thenCardLink(and);
  });

  test('A job that needs no experience', ({ given, and, when, then }) => {
    givenBrowserLanguage(given);
    givenOpenJobs(and);
    whenOpenJobs(when);
    thenCardShows(then);
  });

  test('Choosing a level puts it in the URL', ({ given, and, when, then }) => {
    givenBrowserLanguage(given);
    givenOpenJobs(and);
    whenOpenJobsWith(when);
    whenChooseFilter(and);
    thenUrlBecomes(then);
  });

  test('Choosing "All" removes that filter from the URL', ({ given, and, when, then }) => {
    givenBrowserLanguage(given);
    givenOpenJobs(and);
    whenOpenJobsWith(when);
    whenChooseFilter(and);
    thenUrlBecomes(then);
  });

  test('Open a filtered URL directly', ({ given, and, when, then }) => {
    givenBrowserLanguage(given);
    givenOpenJobs(and);
    whenOpenJobsWith(when);

    then(/^the API was asked for the jobs of category "(.*)" and level "(.*)"$/, (category: string, level: string) => {
      expect(backend.fetchOpenPositions).toHaveBeenCalledWith({ category: category || undefined, level: level || undefined });
    });

    and(/^the "(.*)" filter shows "(.*)"$/, (filter: string, option: string) => {
      const select = screen.getByLabelText(filter) as HTMLSelectElement;
      expect(select.options[select.selectedIndex].textContent).toBe(option);
    });

    thenClearFilters(and);
  });

  test('No "Clear filters" link without filters', ({ given, and, when, then }) => {
    givenBrowserLanguage(given);
    givenOpenJobs(and);
    whenOpenJobs(when);

    then(/^I do not see a "(.*)" link$/, (name: string) => {
      expect(screen.queryByRole('link', { name })).toBeNull();
    });
  });

  test('No job matches the filters', ({ given, and, when, then }) => {
    givenBrowserLanguage(given);
    givenNoJobs(and);
    whenOpenJobsWith(when);
    thenMessage(then);
    thenClearFilters(and);
  });

  test('No open jobs at all', ({ given, and, when, then }) => {
    givenBrowserLanguage(given);
    givenNoJobs(and);
    whenOpenJobs(when);
    thenMessage(then);
  });

  test('The backend is unavailable', ({ given, and, when, then }) => {
    givenBrowserLanguage(given);

    and('the backend is unavailable', () => {
      backend.mockBackendUnavailable();
    });

    whenOpenJobs(when);

    then(/^I see the main heading "(.*)"$/, (heading: string) => {
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(heading);
    });

    and(/^I see the alert "(.*)"$/, (message: string) => {
      expect(screen.getByRole('alert').textContent).toBe(message);
    });

    and('I see no job card and no filter', () => {
      expect(screen.queryAllByRole('article')).toHaveLength(0);
      expect(screen.queryByRole('combobox')).toBeNull();
    });
  });

  test('Labels are translated, job content is not', ({ given, and, when, then }) => {
    givenBrowserLanguage(given);
    givenOpenJobs(and);
    whenOpenJobs(when);
    thenCardShows(then);
    thenCardTags(and);
    thenCardLink(and);
  });
});
