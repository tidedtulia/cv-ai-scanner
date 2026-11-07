import { join } from 'path';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { defineFeature, loadFeature, type DefineStepFunction } from 'jest-cucumber';
import { hrNavigation } from '../../../lib/hr-client';
import { answer } from '../../../test-utils/hr-backend.mock';
import { mockRequest, resetMockRequest } from '../../../test-utils/next-headers.mock';
import { mockRouter, resetMockRouter } from '../../../test-utils/next-navigation.mock';
import { renderPage } from '../../../test-utils/render-page';
import { DecisionActions } from '../DecisionActions';

jest.mock('next/headers', () => require('../../../test-utils/next-headers.mock'));
jest.mock('next/navigation', () => require('../../../test-utils/next-navigation.mock'));

const feature = loadFeature(join(__dirname, 'hr-decision.feature'));

let user: UserEvent;
let flags = { canDecide: true, canReEvaluate: true };
let respond: () => Promise<unknown>;
const fetchMock = jest.fn();
const assign = jest.fn();

const openActions = () =>
  act(async () => {
    await renderPage(<DecisionActions application={{ id: 'a1', fullName: 'Nguyễn Văn An', positionTitle: 'Backend Developer', ...flags }} />);
  });
const click = (name: string) => user.click(screen.getByRole('button', { name }));
const dialog = () => screen.getByRole('dialog');
const posts = () => fetchMock.mock.calls;
const status = (step: DefineStepFunction) =>
  step(/^I see the status "(.*)"$/, (text: string) => expect(screen.getByRole('status').textContent).toBe(text));
const refreshed = (step: DefineStepFunction) =>
  step(/^the (?:dialog is closed and the )?page is refreshed$/, async () => {
    await waitFor(() => expect(mockRouter.refresh).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

defineFeature(feature, (test) => {
  beforeEach(() => {
    resetMockRequest();
    resetMockRouter();
    mockRequest.acceptLanguage = 'en-US,en;q=0.9';
    user = userEvent.setup();
    flags = { canDecide: true, canReEvaluate: true };
    respond = async () => answer(200, {});
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => respond());
    global.fetch = fetchMock as unknown as typeof fetch;
    assign.mockReset();
    hrNavigation.assign = assign;
  });

  const whenOpen = (step: DefineStepFunction) => step('I open the application actions', openActions);
  const andClick = (step: DefineStepFunction) => step(/^I click "(.*)"$/, (name: string) => click(name));

  test('Which buttons are shown (AC-16, AC-17)', ({ given, when, then }) => {
    given(/^I can decide "(.*)" and re-evaluate "(.*)"$/, (decide: string, re: string) => {
      flags = { canDecide: decide === 'yes', canReEvaluate: re === 'yes' };
    });
    whenOpen(when);
    then(/^I see the buttons "(.*)"$/, (names: string) => {
      const shown = screen.queryAllByRole('button').map((b) => b.textContent);
      expect(shown).toEqual(names ? names.split(', ') : []);
    });
  });

  test('The confirmation dialog (AC-16)', ({ given, when, and, then }) => {
    given('my browser prefers Vietnamese', () => {
      mockRequest.acceptLanguage = 'vi-VN,vi;q=0.9';
    });
    whenOpen(when);
    andClick(and);
    then(/^the dialog is titled "(.*)"$/, (title: string) => expect(screen.getByRole('dialog', { name: title })).toBeTruthy());
    and(/^it says "(.*)"$/, (text: string) => expect(screen.getByText(text)).toBeTruthy());
    and(/^it has an empty note box "(.*)" limited to (\d+) characters$/, (label: string, max: string) => {
      const note = screen.getByLabelText(label) as HTMLTextAreaElement;
      expect([note.value, note.maxLength]).toEqual(['', Number(max)]);
    });
    and('the focus is in the dialog', () => expect(document.activeElement).toBe(dialog()));
  });

  test('The note counts characters (AC-16)', ({ when, and, then }) => {
    whenOpen(when);
    andClick(and);
    and(/^I type the note "(.*)"$/, (text: string) => user.type(screen.getByRole('textbox'), text));
    then(/^I see "(.*)"$/, (text: string) => expect(screen.getByText(text)).toBeTruthy());
  });

  test('Cancel does nothing (AC-16)', ({ when, and, then }) => {
    whenOpen(when);
    andClick(and);
    and(/^I (click Cancel|press Escape)$/, async (how: string) => {
      if (how === 'click Cancel') await click('Cancel');
      else await user.keyboard('{Escape}');
    });
    then('the dialog is closed', () => expect(screen.queryByRole('dialog')).toBeNull());
    and('no request was sent', () => expect(posts()).toHaveLength(0));
    and(/^the focus is back on "(.*)"$/, async (name: string) => {
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name })));
    });
  });

  test('Confirming a decision (AC-16)', ({ when, and, then }) => {
    whenOpen(when);
    andClick(and);
    and(/^I type the note "(.*)"$/, (text: string) => user.type(screen.getByRole('textbox'), text));
    andClick(and);
    then(/^"POST (.*)" is sent as JSON with decision "(.*)" and note "(.*)"$/, (url: string, decision: string, note: string) => {
      const [calledUrl, init] = posts()[0];
      expect(calledUrl).toBe(url);
      expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } });
      expect(JSON.parse(init.body)).toEqual({ decision, note });
    });
    refreshed(and);
    status(and);
  });

  test('The button is locked while saving (AC-16)', ({ given, when, and, then }) => {
    given('the server is slow', () => {
      respond = () => new Promise(() => undefined);
    });
    whenOpen(when);
    andClick(and);
    andClick(and);
    then(/^the confirm button shows "(.*)" and is disabled$/, (label: string) => {
      expect((screen.getByRole('button', { name: label }) as HTMLButtonElement).disabled).toBe(true);
    });
    and('Cancel is disabled', () => expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true));
  });

  test('Somebody else was faster (AC-16)', ({ given, when, and, then }) => {
    given('the server answers 409', () => {
      respond = async () => answer(409, { code: 'STATUS_NOT_ALLOWED' });
    });
    whenOpen(when);
    andClick(and);
    andClick(and);
    status(then);
    refreshed(and);
  });

  test('A failure keeps what I typed (AC-16)', ({ given, when, and, then }) => {
    given(/^the server (answers 500|cannot be reached)$/, (failure: string) => {
      respond = failure === 'answers 500' ? async () => answer(500) : () => Promise.reject(new TypeError('Failed to fetch'));
    });
    whenOpen(when);
    andClick(and);
    and(/^I type the note "(.*)"$/, (text: string) => user.type(screen.getByRole('textbox'), text));
    andClick(and);
    then(/^the dialog shows the alert "(.*)"$/, async (message: string) => {
      expect((await screen.findByRole('alert')).textContent).toBe(message);
    });
    and(/^the note still contains "(.*)"$/, (text: string) => expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(text));
    and('the page is not refreshed', () => expect(mockRouter.refresh).not.toHaveBeenCalled());
  });

  test('Re-evaluate (AC-17)', ({ when, and, then }) => {
    whenOpen(when);
    andClick(and);
    then(/^the dialog is titled "(.*)"$/, (title: string) => expect(screen.getByRole('dialog', { name: title })).toBeTruthy());
    and(/^it says "(.*)"$/, (text: string) => expect(screen.getByText(text)).toBeTruthy());
    when(/^I click "(.*)"$/, (name: string) => click(name));
    then(/^"POST (.*)" is sent as JSON with an empty body$/, (url: string) => {
      const [calledUrl, init] = posts()[0];
      expect(calledUrl).toBe(url);
      expect(JSON.parse(init.body)).toEqual({});
    });
    status(and);
    and('the page is refreshed', () => expect(mockRouter.refresh).toHaveBeenCalled());
  });

  test('The session expired while the dialog was open (AC-13, AC-17)', ({ given, when, and, then }) => {
    given('the server answers 401', () => {
      respond = async () => answer(401, { code: 'SESSION_EXPIRED' });
    });
    whenOpen(when);
    andClick(and);
    andClick(and);
    then('I am sent to the sign-in page', async () => {
      await waitFor(() => expect(assign).toHaveBeenCalledWith(expect.stringMatching(/^\/hr\/login\?.*reason=expired/)));
    });
    and('no error is shown in the dialog', () => expect(screen.queryByRole('alert')).toBeNull());
  });
});
