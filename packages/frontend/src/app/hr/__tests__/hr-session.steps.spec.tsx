import { join } from 'path';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { defineFeature, loadFeature, type DefineStepFunction } from 'jest-cucumber';
import { hrFetch, HrSessionExpiredError, hrNavigation } from '../../../lib/hr-client';
import { answer, callsTo, hrBackend, installHrBackend } from '../../../test-utils/hr-backend.mock';
import { mockRequest, resetMockRequest } from '../../../test-utils/next-headers.mock';
import { mockRouter, RedirectError, resetMockRouter } from '../../../test-utils/next-navigation.mock';
import { pageTitle, renderPage } from '../../../test-utils/render-page';
import HrProtectedLayout from '../(protected)/layout';
import { generateMetadata as listMetadata } from '../(protected)/page';
import { metadata as hrAreaMetadata } from '../layout';

jest.mock('next/headers', () => require('../../../test-utils/next-headers.mock'));
jest.mock('next/navigation', () => require('../../../test-utils/next-navigation.mock'));

const feature = loadFeature(join(__dirname, 'hr-session.feature'));

let redirectedTo: string | undefined;

/** Renders /hr/... as Next.js does: the protected layout around the page (the proxy already set x-hr-path) */
async function openHrPage(path: string) {
  mockRequest.hrPath = path;
  redirectedTo = undefined;
  try {
    await act(async () => {
      await renderPage(HrProtectedLayout({ children: <p>PAGE BODY</p> }));
    });
  } catch (error) {
    if (!(error instanceof RedirectError)) throw error;
    redirectedTo = error.url;
  }
}

const signedInAs = (step: DefineStepFunction) =>
  step(/^I am signed in as "(.*)"$/, (name: string) => {
    mockRequest.hrSession = 'valid-token';
    hrBackend.user = { ...hrBackend.user, name };
  });
const whenOpen = (step: DefineStepFunction) => step(/^I open the HR page "(.*)"$/, openHrPage);
const header = () => screen.getByRole('banner');

defineFeature(feature, (test) => {
  beforeEach(() => {
    resetMockRequest();
    resetMockRouter();
    installHrBackend();
    mockRequest.acceptLanguage = 'en-US,en;q=0.9';
  });

  test('A cookie that is no longer valid sends me to the sign-in page (AC-11)', ({ given, when, then }) => {
    given(/^my session cookie is (.*)$/, (state: string) => {
      mockRequest.hrSession = 'some-token';
      hrBackend.session = state === 'expired' ? 'expired' : 'invalid';
    });
    whenOpen(when);
    then(/^I am redirected to "(.*)"$/, (target: string) => {
      expect(redirectedTo).toBe(target);
    });
  });

  test('The HR frame around a page (AC-12)', ({ given, and, when, then }) => {
    given('my browser prefers Vietnamese', () => {
      mockRequest.acceptLanguage = 'vi-VN,vi;q=0.9';
    });
    signedInAs(and);
    whenOpen(when);
    then(/^the header shows "(.*)" with the badge "(.*)"$/, (site: string, badge: string) => {
      const home = within(header()).getByRole('link');
      expect(home.getAttribute('href')).toBe('/hr');
      expect(home.textContent).toBe(`${site}${badge}`);
    });
    and(/^the header shows "(.*)", a "(.*)" button and the language switch$/, (who: string, logout: string) => {
      expect(within(header()).getByTestId('hr-user').textContent).toBe(who);
      expect(within(header()).getByRole('button', { name: logout })).toBeTruthy();
      expect(within(header()).getByRole('group', { name: 'Ngôn ngữ' })).toBeTruthy();
    });
    and('the public navigation and footer are not shown', () => {
      expect(screen.queryByRole('link', { name: 'Việc làm' })).toBeNull();
      expect(screen.queryByRole('contentinfo')).toBeNull();
    });
    and(/^I see the page content "(.*)"$/, (text: string) => {
      expect(screen.getByText(text)).toBeTruthy();
    });
    and(/^the tab title of the applications page is "(.*)"$/, async (title: string) => {
      expect(await pageTitle(listMetadata)).toBe(title);
    });
    and('search engines are told not to index the HR area', () => {
      expect(hrAreaMetadata.robots).toEqual({ index: false, follow: false });
    });
  });

  test('Sign out (AC-12)', ({ given, when, and, then }) => {
    signedInAs(given);
    whenOpen(when);
    and(/^I click "(.*)"$/, (name: string) => userEvent.setup().click(screen.getByRole('button', { name })));
    then('the sign-out API is called', () => {
      expect(callsTo('/api/auth/logout')[0][1]).toMatchObject({ method: 'POST' });
    });
    and(/^I am sent to "(.*)"$/, (target: string) => {
      expect(mockRouter.replace).toHaveBeenCalledWith(target);
      expect(mockRouter.refresh).toHaveBeenCalled();
    });
  });

  test('The backend cannot be reached (AC-12)', ({ given, but, when, then, and }) => {
    signedInAs(given);
    but('the backend is down', () => {
      hrBackend.session = 'down';
    });
    whenOpen(when);
    then(/^I see the alert "(.*)"$/, (message: string) => {
      expect(screen.getByRole('alert').textContent).toBe(message);
    });
    and(/^no "(.*)" button is shown$/, (name: string) => {
      expect(screen.queryByRole('button', { name })).toBeNull();
    });
  });

  describe('hrFetch', () => {
    let result: Response | Error;
    const assign = jest.fn();
    beforeEach(() => {
      assign.mockReset();
      hrNavigation.assign = assign;
    });
    const givenPage = (step: DefineStepFunction) =>
      step(/^I am on "(.*)"$/, (path: string) => {
        window.history.pushState({}, '', path);
      });
    const whenAnswers = (step: DefineStepFunction) =>
      step(/^a request to the HR API answers (\d+)$/, async (status: string) => {
        global.fetch = jest.fn(async () => answer(Number(status), { ok: true })) as unknown as typeof fetch;
        result = await hrFetch('/api/hr/applications').catch((error: Error) => error);
      });

    test('The session expires while I am working (AC-13)', ({ given, when, then, and }) => {
      givenPage(given);
      whenAnswers(when);
      then(/^I am sent to "(.*)"$/, (target: string) => {
        expect(assign).toHaveBeenCalledWith(target);
      });
      and('the page does not get the response', () => {
        expect(result).toBeInstanceOf(HrSessionExpiredError);
      });
    });

    test('Other HR API answers are passed to the page (AC-13)', ({ given, when, then, and }) => {
      givenPage(given);
      whenAnswers(when);
      then('the page gets the response', () => {
        expect((result as Response).status).toBe(200);
      });
      and('I stay on the page', () => {
        expect(assign).not.toHaveBeenCalled();
      });
    });
  });
});
