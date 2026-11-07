import { join } from 'path';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { defineFeature, loadFeature, type DefineStepFunction } from 'jest-cucumber';
import { hrNavigation } from '../../../lib/hr-client';
import { answer } from '../../../test-utils/hr-backend.mock';
import { mockRequest, resetMockRequest } from '../../../test-utils/next-headers.mock';
import { mockRouter, resetMockRouter } from '../../../test-utils/next-navigation.mock';
import { renderPage } from '../../../test-utils/render-page';
import { ResultEmailStatus } from '../ResultEmailStatus';

jest.mock('next/headers', () => require('../../../test-utils/next-headers.mock'));
jest.mock('next/navigation', () => require('../../../test-utils/next-navigation.mock'));

const feature = loadFeature(join(__dirname, 'hr-email.feature'));

type Props = Parameters<typeof ResultEmailStatus>[0]['application'];

let application: Props;
let user: UserEvent;
let respond: () => Promise<unknown>;
const fetchMock = jest.fn();
const assign = jest.fn();

const base = { id: 'a1', fullName: 'Nguyễn Văn An', email: 'an@example.com' };
const decided = (status: 'ACCEPTED' | 'REJECTED', sentAt: string | null): Props => ({ ...base, status, resultEmailSentAt: sentAt, canResendEmail: sentAt === null });

const preview = (decision: string) => ({
  locale: 'vi',
  to: 'an@example.com',
  subject: 'Kết quả ứng tuyển: Backend Developer',
  text: decision === 'ACCEPTED' ? 'Chúng tôi vui mừng thông báo bạn được nhận.' : 'Lần này chúng tôi chưa thể tiếp tục.',
  html: '<p>x</p>',
});

const openSection = () =>
  act(async () => {
    await renderPage(<ResultEmailStatus application={application} />);
  });
const click = (name: string) => user.click(screen.getByRole('button', { name }));
const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
const previews = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/email-preview'));

defineFeature(feature, (test) => {
  beforeEach(() => {
    resetMockRequest();
    resetMockRouter();
    mockRequest.acceptLanguage = 'en-US,en;q=0.9';
    user = userEvent.setup();
    respond = async () => answer(200, { emailSent: true });
    fetchMock.mockReset();
    fetchMock.mockImplementation((url: string) => {
      const match = String(url).match(/email-preview\?decision=(\w+)/);
      return match ? Promise.resolve(answer(200, preview(match[1]))) : respond();
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    assign.mockReset();
    hrNavigation.assign = assign;
  });

  const vi = (step: DefineStepFunction) =>
    step('my browser prefers Vietnamese', () => {
      mockRequest.acceptLanguage = 'vi-VN,vi;q=0.9';
    });
  const whenOpen = (step: DefineStepFunction) => step('I open the result email section', openSection);
  const andClick = (step: DefineStepFunction) => step(/^I click "(.*)"$/, (name: string) => click(name));
  const notSent = (step: DefineStepFunction) =>
    step(/^the application was (accepted|rejected) and the email is not sent$/, (what: string) => {
      application = decided(what === 'accepted' ? 'ACCEPTED' : 'REJECTED', null);
    });
  const see = (step: DefineStepFunction) => step(/^I see "(.*)"$/, (text: string) => expect(screen.getByText(text)).toBeTruthy());
  const alertIs = (step: DefineStepFunction) =>
    step(/^the dialog shows the alert "(.*)"$/, async (message: string) => expect((await screen.findByRole('alert')).textContent).toBe(message));
  const refreshed = (step: DefineStepFunction) =>
    step(/^the (?:dialog is closed and the )?page is refreshed$/, async () => {
      await waitFor(() => expect(mockRouter.refresh).toHaveBeenCalled());
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  const noButton = (step: DefineStepFunction) => step(/^there is no "(.*)" button$/, (name: string) => expect(screen.queryByRole('button', { name })).toBeNull());

  test('The email was sent (AC-11)', ({ given, and, when, then }) => {
    vi(given);
    and(/^the application was accepted and the email was sent at "(.*)"$/, (at: string) => {
      application = decided('ACCEPTED', at);
    });
    whenOpen(when);
    then(/^I see the heading "(.*)"$/, (name: string) => expect(screen.getByRole('heading', { name })).toBeTruthy());
    see(and);
    noButton(and);
  });

  test('The email was not sent (AC-11)', ({ given, and, when, then }) => {
    vi(given);
    notSent(and);
    whenOpen(when);
    see(then);
    and(/^there is a "(.*)" button$/, (name: string) => expect(screen.getByRole('button', { name })).toBeTruthy());
  });

  test('No section before a decision (AC-11)', ({ given, when, then }) => {
    given(/^the application is "(.*)"$/, (status: string) => {
      application = { ...base, status: status as Props['status'], resultEmailSentAt: null, canResendEmail: false };
    });
    whenOpen(when);
    then('there is no result email section', () => {
      expect(screen.queryByRole('heading')).toBeNull();
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  test('Resend asks for confirmation with the email preview (AC-11)', ({ given, when, and, then }) => {
    notSent(given);
    whenOpen(when);
    andClick(and);
    then(/^the dialog is titled "(.*)"$/, (title: string) => expect(screen.getByRole('dialog', { name: title })).toBeTruthy());
    and(/^it says "(.*)"$/, (text: string) => expect(screen.getByText(text)).toBeTruthy());
    and(/^the API is asked for the preview "(.*)"$/, async (url: string) => {
      await waitFor(() => expect(previews().map(([u]) => u)).toEqual([url]));
      expect((await screen.findByRole('region', { name: 'Email preview' })).textContent).toContain('chưa thể tiếp tục');
    });
    and('the focus is in the dialog', () => expect(document.activeElement).toBe(screen.getByRole('dialog')));
  });

  test('Cancel does nothing (AC-11)', ({ given, when, and, then }) => {
    notSent(given);
    whenOpen(when);
    andClick(and);
    and(/^I (click Cancel|press Escape)$/, async (how: string) => {
      if (how === 'click Cancel') await click('Cancel');
      else await user.keyboard('{Escape}');
    });
    then('the dialog is closed', () => expect(screen.queryByRole('dialog')).toBeNull());
    and('no change request was sent', () => expect(posts()).toHaveLength(0));
  });

  test('Resending successfully (AC-11)', ({ given, when, and, then }) => {
    notSent(given);
    whenOpen(when);
    andClick(and);
    andClick(and);
    then(/^"POST (.*)" is sent as JSON with an empty body$/, (url: string) => {
      const [calledUrl, init] = posts()[0];
      expect(calledUrl).toBe(url);
      expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } });
      expect(JSON.parse(init.body)).toEqual({});
    });
    refreshed(and);
    and(/^I see the status "(.*)"$/, (text: string) => expect(screen.getByRole('status').textContent).toBe(text));
  });

  test('Resending fails (AC-11)', ({ given, and, when, then }) => {
    given(/^the server (answers 502 EMAIL_SEND_FAILED|cannot be reached)$/, (failure: string) => {
      respond = failure.startsWith('answers') ? async () => answer(502, { code: 'EMAIL_SEND_FAILED' }) : () => Promise.reject(new TypeError('Failed to fetch'));
    });
    notSent(and);
    whenOpen(when);
    andClick(and);
    andClick(and);
    alertIs(then);
    and('the page is not refreshed', () => expect(mockRouter.refresh).not.toHaveBeenCalled());
    and(/^"(.*)" can be pressed again$/, (name: string) => {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  test('Somebody sent it already (AC-11)', ({ given, and, when, then }) => {
    given('the server answers 409 EMAIL_ALREADY_SENT', () => {
      respond = async () => answer(409, { code: 'EMAIL_ALREADY_SENT' });
    });
    notSent(and);
    whenOpen(when);
    andClick(and);
    andClick(and);
    then(/^I see the status "(.*)"$/, (text: string) => expect(screen.getByRole('status').textContent).toBe(text));
    refreshed(and);
  });

  test('The session expired (AC-11)', ({ given, and, when, then }) => {
    given('the server answers 401', () => {
      respond = async () => answer(401, { code: 'SESSION_EXPIRED' });
    });
    notSent(and);
    whenOpen(when);
    andClick(and);
    andClick(and);
    then('I am sent to the sign-in page', async () => {
      await waitFor(() => expect(assign).toHaveBeenCalledWith(expect.stringMatching(/^\/hr\/login\?.*reason=expired/)));
    });
    and('no error is shown in the dialog', () => expect(screen.queryByRole('alert')).toBeNull());
  });
});
