import { join } from 'path';
import { act, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { defineFeature, loadFeature, type DefineStepFunction } from 'jest-cucumber';
import { answer, callsTo, hrBackend, installHrBackend } from '../../../../test-utils/hr-backend.mock';
import { list } from '../../../../test-utils/fixtures';
import { mockRequest, resetMockRequest } from '../../../../test-utils/next-headers.mock';
import { mockRouter, RedirectError, resetMockRouter } from '../../../../test-utils/next-navigation.mock';
import { pageTitle, renderPage } from '../../../../test-utils/render-page';
import HrLoginPage, { generateMetadata } from '../page';

jest.mock('next/headers', () => require('../../../../test-utils/next-headers.mock'));
jest.mock('next/navigation', () => require('../../../../test-utils/next-navigation.mock'));

const feature = loadFeature(join(__dirname, 'hr-login.feature'));

let user: UserEvent;
let redirectedTo: string | undefined;

const searchParamsOf = (path: string) => Promise.resolve(Object.fromEntries(new URL(path, 'http://localhost').searchParams));

async function open(path: string) {
  redirectedTo = undefined;
  try {
    await act(async () => {
      await renderPage(HrLoginPage({ searchParams: searchParamsOf(path) }));
    });
  } catch (error) {
    if (!(error instanceof RedirectError)) throw error;
    redirectedTo = error.url;
  }
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const errorUnder = (label: string) => document.getElementById(field(label).getAttribute('aria-describedby') ?? '')?.textContent;
const loginCalls = () => callsTo('/api/auth/login');

async function signIn(email: string, password: string) {
  await user.type(field('Email'), email);
  await user.type(field(screen.queryByLabelText('Password') ? 'Password' : 'Mật khẩu'), password);
  await user.click(screen.getByRole('button', { name: /^(Sign in|Đăng nhập)$/ }));
}

const givenVietnamese = (step: DefineStepFunction) =>
  step('my browser prefers Vietnamese', () => {
    mockRequest.acceptLanguage = 'vi-VN,vi;q=0.9';
  });
const whenOpen = (step: DefineStepFunction) => step(/^I open "(.*)"$/, (path: string) => open(path));
const whenSignIn = (step: DefineStepFunction) => step(/^I sign in with "(.*)" and "(.*)"$/, signIn);

defineFeature(feature, (test) => {
  beforeEach(() => {
    resetMockRequest();
    resetMockRouter();
    installHrBackend();
    mockRequest.acceptLanguage = 'en-US,en;q=0.9';
    user = userEvent.setup();
  });

  test('The sign-in form (AC-9)', ({ given, when, then, and }) => {
    givenVietnamese(given);
    whenOpen(when);
    then(/^the tab title is "(.*)"$/, async (title: string) => {
      expect(await pageTitle(generateMetadata)).toBe(title);
    });
    and(/^I see the heading "(.*)"$/, (heading: string) => {
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(heading);
    });
    and(/^I see the fields "(.*)" and the button "(.*)"$/, (labels: string, button: string) => {
      for (const label of list(labels)) expect(field(label)).toBeTruthy();
      expect(screen.getByRole('button', { name: button })).toBeTruthy();
    });
    and('the password field hides what I type', () => {
      expect(field('Mật khẩu').type).toBe('password');
    });
    and(/^the HR header shows the language switch but no "(.*)" button$/, (logout: string) => {
      expect(screen.getByRole('group', { name: 'Ngôn ngữ' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: logout })).toBeNull();
    });
  });

  test('The form is checked in the browser before calling the API (AC-9)', ({ when, then, and }) => {
    whenOpen(when);
    const click = () => user.click(screen.getByRole('button', { name: 'Sign in' }));
    and(/^I click "Sign in"$/, click);
    then(/^I see "(.*)" under "(.*)"$/, (message: string, label: string) => {
      expect(errorUnder(label)).toBe(message);
    });
    and(/^I see "(.*)" under "(.*)"$/, (message: string, label: string) => {
      expect(errorUnder(label)).toBe(message);
    });
    and('no sign-in request is sent', () => {
      expect(loginCalls()).toHaveLength(0);
    });
    when(/^I type "(.*)" in "(.*)"$/, (text: string, label: string) => user.type(field(label), text));
    and(/^I type "(.*)" in "(.*)"$/, (text: string, label: string) => user.type(field(label), text));
    and(/^I click "Sign in"$/, click);
    then(/^I see "(.*)" under "(.*)"$/, (message: string, label: string) => {
      expect(errorUnder(label)).toBe(message);
    });
    and('no sign-in request is sent', () => {
      expect(loginCalls()).toHaveLength(0);
    });
  });

  test('The button is disabled while signing in (AC-9)', ({ given, when, then, and }) => {
    given('the API answers slowly', () => {
      hrBackend.login = () => new Promise(() => undefined);
    });
    whenOpen(when);
    whenSignIn(and);
    then(/^the button shows "(.*)" and is disabled$/, (label: string) => {
      const button = screen.getByRole('button', { name: label }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });
  });

  test('Where I go after signing in (AC-10)', ({ when, then, and }) => {
    whenOpen(when);
    whenSignIn(and);
    then(/^the API receives the email "(.*)" and the password as JSON$/, (email: string) => {
      const [, init] = loginCalls()[0];
      expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } });
      expect(JSON.parse(init.body)).toEqual({ email, password: 'Correct-horse-1' });
    });
    and(/^I am sent to "(.*)"$/, (target: string) => {
      expect(mockRouter.replace).toHaveBeenCalledWith(target);
      expect(mockRouter.refresh).toHaveBeenCalled();
    });
  });

  test('Sign-in errors keep the email and clear the password (AC-10)', ({ given, and, when, then }) => {
    givenVietnamese(given);
    and(/^the API answers (.*)$/, (kind: string) => {
      const retry = kind.match(/^429 with Retry-After (\d+)$/);
      if (kind === '401 INVALID_CREDENTIALS') hrBackend.login = async () => answer(401, { code: 'INVALID_CREDENTIALS' });
      else if (retry) hrBackend.login = async () => answer(429, { code: 'TOO_MANY_ATTEMPTS' }, { 'Retry-After': retry[1] });
      else if (kind === '500') hrBackend.login = async () => answer(500);
      else hrBackend.login = () => Promise.reject(new TypeError('Failed to fetch'));
    });
    whenOpen(when);
    whenSignIn(and);
    then(/^I see the message "(.*)"$/, async (message: string) => {
      expect((await screen.findByRole('alert')).textContent).toBe(message);
    });
    and(/^the email field still contains "(.*)" and the password field is empty$/, (email: string) => {
      expect(field('Email').value).toBe(email);
      expect(field('Mật khẩu').value).toBe('');
    });
    and('I stay on the sign-in page', () => {
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });
  });

  test('The page says when a session expired (AC-11)', ({ when, then }) => {
    whenOpen(when);
    then(/^I see the status "(.*)"$/, (message: string) => {
      expect(screen.getByRole('status').textContent).toBe(message);
    });
  });

  test('An expired cookie still shows the form (AC-11)', ({ given, when, then }) => {
    given('my session cookie is expired', () => {
      mockRequest.hrSession = 'expired-token';
      hrBackend.session = 'expired';
    });
    whenOpen(when);
    then(/^I see the heading "(.*)"$/, (heading: string) => {
      expect(redirectedTo).toBeUndefined();
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(heading);
    });
  });

  test('Already signed in (AC-11)', ({ given, when, then }) => {
    given(/^I am signed in as "(.*)"$/, (name: string) => {
      mockRequest.hrSession = 'valid-token';
      hrBackend.user = { ...hrBackend.user, name };
    });
    whenOpen(when);
    then(/^I am redirected to "(.*)"$/, (target: string) => {
      expect(redirectedTo).toBe(target);
      expect(callsTo('http://localhost:3001/api/auth/me')[0][1]).toMatchObject({ headers: { Cookie: 'cvs_hr_session=valid-token' }, cache: 'no-store' });
    });
  });
});
