import { join } from 'path';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { defineFeature, loadFeature, type DefineStepFunction } from 'jest-cucumber';
import type { Metadata } from 'next';
import { isLocale } from '../../../i18n/config';
import { dictionaries } from '../../../i18n/dictionaries';
import { mockRouter, resetMockRouter } from '../../../test-utils/next-navigation.mock';
import { mockRequest, resetMockRequest } from '../../../test-utils/next-headers.mock';
import { resetMockBackend } from '../../../test-utils/backend.mock';
import { pageTitle, renderLayout } from '../../../test-utils/render-page';
import HomePage from '../page';
import { generateMetadata as jobsMetadata } from '../jobs/page';
import { generateMetadata as privacyMetadata } from '../privacy/page';
import { generateMetadata as submitMetadata } from '../submit-cv/page';

jest.mock('next/headers', () => require('../../../test-utils/next-headers.mock'));
jest.mock('next/navigation', () => require('../../../test-utils/next-navigation.mock'));
jest.mock('../../../lib/backend', () => require('../../../test-utils/backend.mock'));
jest.mock('react-markdown', () => require('../../../test-utils/react-markdown.mock'));

const feature = loadFeature(join(__dirname, 'language.feature'));

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const PAGE_METADATA: Record<string, (() => Promise<Metadata>) | undefined> = {
  home: undefined,
  jobs: jobsMetadata,
  'submit CV': submitMetadata,
  privacy: privacyMetadata,
};

let htmlLang = '';

const givenNoChoice = (step: DefineStepFunction) => {
  step('I have not chosen a language', () => {
    mockRequest.cookieLocale = undefined;
  });
};

const givenAcceptLanguage = (step: DefineStepFunction) => {
  step(/^my browser sends Accept-Language "(.*)"$/, (header: string) => {
    mockRequest.acceptLanguage = header === '<none>' ? null : header;
  });
};

const openHome = (step: DefineStepFunction) => {
  step('I open the home page', async () => {
    ({ lang: htmlLang } = await renderLayout(await HomePage()));
  });
};

const thenPageIn = (step: DefineStepFunction) => {
  step(/^the page is in "(.*)"$/, (language: string) => {
    if (!isLocale(language)) throw new Error(`unknown language ${language}`);
    expect(htmlLang).toBe(language);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(dictionaries[language].home.title);
    expect(screen.getByRole('link', { name: dictionaries[language].nav.jobs })).toBeTruthy();
  });
};

defineFeature(feature, (test) => {
  let cookieWrites: jest.SpyInstance;

  beforeEach(() => {
    resetMockRequest();
    resetMockRouter();
    resetMockBackend();
    htmlLang = '';
    cookieWrites = jest.spyOn(document, 'cookie', 'set');
  });

  afterEach(() => cookieWrites.mockRestore());

  test('Pick the language from the browser on the first visit', ({ given, and, when, then }) => {
    givenNoChoice(given);
    givenAcceptLanguage(and);
    openHome(when);
    thenPageIn(then);
  });

  test('The chosen language wins over the browser', ({ given, and, when, then }) => {
    given(/^I chose the language "(.*)" before$/, (language: string) => {
      mockRequest.cookieLocale = language;
    });
    givenAcceptLanguage(and);
    openHome(when);
    thenPageIn(then);
  });

  test('Switch to English', ({ given, and, when, then }) => {
    givenNoChoice(given);
    givenAcceptLanguage(and);
    openHome(and);

    when(/^I click the language button "(.*)"$/, async (button: string) => {
      await userEvent.setup().click(screen.getByRole('button', { name: button }));
    });

    then(/^the cookie "(.*)" is saved for 1 year$/, (cookie: string) => {
      expect(cookieWrites).toHaveBeenCalledTimes(1);
      const written = cookieWrites.mock.calls[0][0] as string;
      expect(written.startsWith(`${cookie};`)).toBe(true);
      expect(written).toContain(`max-age=${ONE_YEAR_SECONDS}`);
      expect(written).toContain('path=/');
    });

    and('the page is rendered again without changing the URL', () => {
      expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });

  test('Clicking the current language does nothing', ({ given, and, when, then }) => {
    givenNoChoice(given);
    givenAcceptLanguage(and);
    openHome(and);

    when(/^I click the language button "(.*)"$/, async (button: string) => {
      expect(screen.getByRole('button', { name: button }).getAttribute('aria-pressed')).toBe('true');
      await userEvent.setup().click(screen.getByRole('button', { name: button }));
    });

    then('the page is not rendered again', () => {
      expect(mockRouter.refresh).not.toHaveBeenCalled();
      expect(cookieWrites).not.toHaveBeenCalled();
    });
  });

  test('html lang and the tab title follow the language', ({ given, and, when, then }) => {
    let title = '';
    givenNoChoice(given);
    givenAcceptLanguage(and);

    when(/^I open the "(.*)" page$/, async (page: string) => {
      ({ lang: htmlLang } = await renderLayout(<p>{page}</p>));
      title = await pageTitle(PAGE_METADATA[page]);
    });

    then(/^the html lang is "(.*)"$/, (language: string) => {
      expect(htmlLang).toBe(language);
    });

    and(/^the browser tab title is "(.*)"$/, (expected: string) => {
      expect(title).toBe(expected);
    });
  });
});
