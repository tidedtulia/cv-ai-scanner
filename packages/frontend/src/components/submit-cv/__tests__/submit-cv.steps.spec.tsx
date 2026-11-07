import { join } from 'path';
import { fireEvent, render, screen, within, type RenderResult } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { defineFeature, loadFeature, type DefineStepFunction } from 'jest-cucumber';
import { CV_MAX_FILE_SIZE_BYTES } from '@org/shared';
import type { Locale } from '../../../i18n/config';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { list, POSITIONS, positionDetail } from '../../../test-utils/fixtures';
import { SubmitCvForm } from '../SubmitCvForm';

jest.mock('react-markdown', () => require('../../../test-utils/react-markdown.mock'));

const feature = loadFeature(join(__dirname, 'submit-cv.feature'));

const VALID_NAME = 'Jane Doe';
const VALID_EMAIL = 'jane@example.com';
const VALID_POSITION = 'Frontend Developer';
const APPLICATIONS_URL = '/api/applications';

const fetchMock = jest.fn();
let applicationResponse: () => Promise<unknown>;
let detailsAvailable = true;

let user: UserEvent;
let view: RenderResult;

/** Routes the mocked fetch: job details for PositionDetails, POST /api/applications for the form. */
function routeFetch(url: string) {
  if (url.startsWith('/api/positions/')) {
    const detail = detailsAvailable && positionDetail(decodeURIComponent(url.split('/').pop() ?? ''));
    return Promise.resolve(detail ? { ok: true, json: async () => detail } : { ok: false, status: 503, json: async () => ({}) });
  }
  if (url === APPLICATIONS_URL) return applicationResponse();
  return Promise.reject(new Error(`unexpected fetch ${url}`));
}

const applicationCalls = () => fetchMock.mock.calls.filter(([url]) => url === APPLICATIONS_URL);

function field(label: string): HTMLElement {
  return screen.getByLabelText(new RegExp(`^${label}`));
}

function makeFile(spec: string, options: { withoutMime?: boolean } = {}): File {
  const [name, sizeHint] = spec.split(' ');
  const types: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
  };
  const ext = name.split('.').pop() ?? '';
  const file = new File(['dummy'], name, { type: options.withoutMime ? '' : types[ext] ?? '' });
  if (sizeHint) {
    // Fake the size instead of allocating a real >10MB buffer
    Object.defineProperty(file, 'size', { value: CV_MAX_FILE_SIZE_BYTES + 1024 * 1024 });
  }
  return file;
}

/** The form inside the provider the root layout gives it; re-rendering with another locale = switching language. */
const formUi = (locale: Locale) => (
  <I18nProvider locale={locale}>
    <SubmitCvForm positions={POSITIONS} />
  </I18nProvider>
);

async function fillAllFields(cv: File) {
  await user.type(field('Name'), VALID_NAME);
  await user.type(field('Email'), VALID_EMAIL);
  await user.selectOptions(field('Position'), VALID_POSITION);
  await user.upload(field('Upload CV') as HTMLInputElement, cv);
  await user.click(field('I agree'));
}

const givenOnSubmitCvPage = (step: DefineStepFunction) => {
  step('I am on the Submit CV page', () => {
    view = render(formUi('en'));
  });
};

const givenApiRespondsSuccessfully = (step: DefineStepFunction) => {
  step('the submit CV API responds successfully', () => {
    applicationResponse = async () => ({ ok: true, status: 201, json: async () => ({ message: 'Submit CV successfully' }) });
  });
};

const givenApiRespondsWith = (status: number, body: unknown) => {
  applicationResponse = async () => ({ ok: false, status, json: async () => body });
};

const thenApiToldLanguage = (step: DefineStepFunction) => {
  step(/^the API was told the language is "(.*)"$/, (locale: string) => {
    const [[, init]] = applicationCalls();
    expect((init.body as FormData).get('locale')).toBe(locale);
  });
};

const whenFillAllFields = (step: DefineStepFunction) => {
  step(/^I fill in all fields with a valid CV "(.*)"$/, async (cv: string) => {
    await fillAllFields(makeFile(cv));
  });
};

const whenClickButton = (step: DefineStepFunction) => {
  step(/^I click the "(.*)" button$/, async (name: string) => {
    await user.click(screen.getByRole('button', { name }));
  });
};

const whenSelectPosition = (step: DefineStepFunction) => {
  step(/^I select the position "(.*)"$/, async (position: string) => {
    await user.selectOptions(field('Position'), position);
  });
};

const whenTypeInto = (step: DefineStepFunction) => {
  step(/^I type "(.*)" into "(.*)"$/, async (value: string, label: string) => {
    await user.type(field(label), value);
  });
};

const thenSeeError = (step: DefineStepFunction) => {
  step(/^I see the error "(.*)"$/, (error: string) => {
    expect(screen.getByText(error)).toBeTruthy();
  });
};

const thenNoLongerSeeError = (step: DefineStepFunction) => {
  step(/^I no longer see the error "(.*)"$/, (error: string) => {
    expect(screen.queryByText(error)).toBeNull();
  });
};

const thenSeeSubmitError = (step: DefineStepFunction) => {
  step(/^I see the submit error "(.*)"$/, async (message: string) => {
    expect((await screen.findByRole('alert')).textContent).toBe(message);
  });
};

const thenSeeMessage = (step: DefineStepFunction) => {
  step(/^I see the message "(.*)"$/, async (message: string) => {
    expect(await screen.findByText(message)).toBeTruthy();
  });
};

const thenSeeLink = (step: DefineStepFunction) => {
  step(/^I see a "(.*)" link to "(.*)"$/, (name: string, href: string) => {
    expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
  });
};

const thenFormKeepsData = (step: DefineStepFunction) => {
  step('the form keeps the entered data', () => {
    expect((field('Name') as HTMLInputElement).value).toBe(VALID_NAME);
    expect((field('Email') as HTMLInputElement).value).toBe(VALID_EMAIL);
    expect((field('Position') as HTMLSelectElement).value).toBe('frontend-dev');
    expect(screen.getByText('Selected: cv.pdf')).toBeTruthy();
    expect((field('I agree') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Submit CV' })).toBeTruthy();
  });
};

defineFeature(feature, (test) => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(routeFetch);
    global.fetch = fetchMock;
    detailsAvailable = true;
    applicationResponse = () => Promise.reject(new Error('submit CV API not configured'));
    // applyAccept: false — the `accept` attribute only filters the browser's file picker,
    // so invalid files must still reach the form's own validation
    user = userEvent.setup({ applyAccept: false });
  });

  test('Show the submit CV form', ({ given, then, and }) => {
    givenOnSubmitCvPage(given);

    const seeField = (step: DefineStepFunction) =>
      step(/^I see the "(.*)" field$/, (label: string) => {
        expect(field(label)).toBeTruthy();
      });
    seeField(then);
    seeField(and);
    seeField(and);
    seeField(and);
    seeField(and);

    and(/^the upload hint says "(.*)"$/, (hint: string) => {
      expect(screen.getByText(hint)).toBeTruthy();
      expect(field('Upload CV').getAttribute('accept')).toBe('.pdf,application/pdf');
    });

    and(/^the "(.*)" link opens "(.*)" in a new tab$/, (name: string, href: string) => {
      const link = screen.getByRole('link', { name });
      expect(link.getAttribute('href')).toBe(href);
      expect(link.getAttribute('target')).toBe('_blank');
    });
  });

  test('Show the job description of the selected position', ({ given, when, then, and }) => {
    givenOnSubmitCvPage(given);
    whenSelectPosition(when);

    then(/^I see the job summary "(.*)"$/, async (summary: string) => {
      expect(await screen.findByText(summary)).toBeTruthy();
    });

    and(/^I see the job description containing "(.*)"$/, async (text: string) => {
      expect((await screen.findByTestId('markdown')).textContent).toContain(text);
      expect(fetchMock).toHaveBeenCalledWith('/api/positions/backend-dev', expect.anything());
    });

    and(/^I see the criteria "(.*)"$/, async (criteria: string) => {
      const listEl = await screen.findByRole('list', { name: 'What we look for' });
      expect(within(listEl).getAllByRole('listitem').map((li) => li.textContent)).toEqual(list(criteria));
    });
  });

  test('The job description cannot be loaded', ({ given, and, when, then }) => {
    givenOnSubmitCvPage(given);

    and('the job description API is unavailable', () => {
      detailsAvailable = false;
    });

    whenSelectPosition(when);

    then(/^I see the text "(.*)"$/, async (text: string) => {
      expect(await screen.findByText(text)).toBeTruthy();
      expect(screen.queryByTestId('markdown')).toBeNull();
    });
  });

  test('Submit CV successfully', ({ given, and, when, then }) => {
    givenOnSubmitCvPage(given);
    givenApiRespondsSuccessfully(and);
    whenFillAllFields(when);
    whenClickButton(and);
    thenSeeMessage(then);

    and('the API received the form fields and the consent', () => {
      const [[, init]] = applicationCalls();
      expect(init.method).toBe('POST');
      const body = init.body as FormData;
      expect(body.get('name')).toBe(VALID_NAME);
      expect(body.get('email')).toBe(VALID_EMAIL);
      expect(body.get('position')).toBe('frontend-dev');
      expect((body.get('cv') as File).name).toBe('cv.pdf');
      expect(body.get('consent')).toBe('true');
    });
    thenApiToldLanguage(and);

    thenSeeLink(and);
    thenSeeLink(and);
  });

  test('The language of the visitor is sent with the application', ({ given, and, when, then }) => {
    given('I am on the Submit CV page in Vietnamese', () => {
      view = render(formUi('vi'));
    });
    givenApiRespondsSuccessfully(and);
    when(/^I fill in all the Vietnamese fields with a valid CV "(.*)"$/, async (cv: string) => {
      await user.type(field('Họ tên'), VALID_NAME);
      await user.type(field('Email'), VALID_EMAIL);
      await user.selectOptions(field('Vị trí'), VALID_POSITION);
      await user.upload(field('Tải CV') as HTMLInputElement, makeFile(cv));
      await user.click(field('Tôi đồng ý'));
    });
    whenClickButton(and);
    thenSeeMessage(then);
    thenApiToldLanguage(and);
  });

  test('Show validation error for invalid <field>', ({ given, and, when, then }) => {
    givenOnSubmitCvPage(given);
    whenFillAllFields(and);

    when(/^I set "(.*)" to "(.*)"$/, async (label: string, value: string) => {
      if (label === 'Consent') {
        await user.click(field('I agree')); // was ticked by "fill in all fields"
        return;
      }
      const input = field(label);
      if (label === 'Position') {
        await user.selectOptions(input, value === '<empty>' ? '' : value);
      } else if (label === 'Upload CV') {
        if (value === '<empty>') {
          fireEvent.change(input, { target: { files: [] } });
        } else {
          await user.upload(input as HTMLInputElement, makeFile(value));
        }
      } else {
        await user.clear(input);
        if (value !== '<empty>') await user.type(input, value);
      }
    });

    whenClickButton(and);
    thenSeeError(then);

    and('the submit CV API is not called', () => {
      expect(applicationCalls()).toHaveLength(0);
    });
  });

  test('Accept a PDF without MIME type', ({ given, and, when, then }) => {
    givenOnSubmitCvPage(given);
    givenApiRespondsSuccessfully(and);

    when(/^I fill in all fields with a valid CV "(.*)" without MIME type$/, async (cv: string) => {
      await fillAllFields(makeFile(cv, { withoutMime: true }));
    });

    whenClickButton(and);
    thenSeeMessage(then);
  });

  test('Clear a field error when the field is edited', ({ given, and, when, then }) => {
    givenOnSubmitCvPage(given);
    whenClickButton(and);
    thenSeeError(and);
    whenTypeInto(when);
    thenNoLongerSeeError(then);
  });

  test('Show validation errors in Vietnamese', ({ given, when, then, and }) => {
    given('I am on the Submit CV page in Vietnamese', () => {
      view = render(formUi('vi'));
    });
    whenClickButton(when);
    thenSeeError(then);
    thenSeeError(and);
  });

  test('Show the translated API error when submission is rejected', ({ given, and, when, then }) => {
    givenOnSubmitCvPage(given);

    and(/^the submit CV API rejects the application with code "(.*)"$/, (code: string) => {
      givenApiRespondsWith(400, { statusCode: 400, error: 'Bad Request', code, message: 'english message from the API' });
    });

    whenFillAllFields(when);
    whenClickButton(and);
    thenSeeSubmitError(then);
    thenFormKeepsData(and);
  });

  test('Show the API message when the error has no known code', ({ given, and, when, then }) => {
    givenOnSubmitCvPage(given);

    and(/^the submit CV API responds with error "(.*)"$/, (message: string) => {
      givenApiRespondsWith(500, { statusCode: 500, message });
    });

    whenFillAllFields(when);
    whenClickButton(and);
    thenSeeSubmitError(then);
  });

  test('Show a generic error when the network fails', ({ given, and, when, then }) => {
    givenOnSubmitCvPage(given);

    and('the network is down', () => {
      applicationResponse = () => Promise.reject(new TypeError('Failed to fetch'));
    });

    whenFillAllFields(when);
    whenClickButton(and);
    thenSeeSubmitError(then);
    thenFormKeepsData(and);
  });

  test('Switch the language while filling in the form', ({ given, and, when, then }) => {
    givenOnSubmitCvPage(given);
    whenTypeInto(and);
    whenClickButton(and);
    thenSeeError(and);

    // What router.refresh() does after the language switcher saved the cookie:
    // the layout renders again with the new locale, client components keep their state
    when('the page is shown again in Vietnamese', () => {
      view.rerender(formUi('vi'));
    });

    then(/^the "(.*)" field still contains "(.*)"$/, (label: string, value: string) => {
      expect((field(label) as HTMLInputElement).value).toBe(value);
    });

    thenSeeError(and);
    thenNoLongerSeeError(and);
  });
});
