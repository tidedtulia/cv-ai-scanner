import { join } from 'path';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { defineFeature, loadFeature, type DefineStepFunction } from 'jest-cucumber';
import { CV_MAX_FILE_SIZE_BYTES } from '@org/shared';
import { SubmitCvForm } from '../SubmitCvForm';

const feature = loadFeature(join(__dirname, 'submit-cv.feature'));

const VALID_NAME = 'Jane Doe';
const VALID_EMAIL = 'jane@example.com';
const VALID_POSITION = 'Frontend Developer';

const fetchMock = jest.fn();

let user: UserEvent;

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

async function fillAllFields(cv: File) {
  await user.type(field('Name'), VALID_NAME);
  await user.type(field('Email'), VALID_EMAIL);
  await user.selectOptions(field('Position'), VALID_POSITION);
  await user.upload(field('Upload CV') as HTMLInputElement, cv);
}

const givenOnSubmitCvPage = (step: DefineStepFunction) => {
  step('I am on the Submit CV page', () => {
    render(<SubmitCvForm />);
  });
};

const givenApiRespondsSuccessfully = (step: DefineStepFunction) => {
  step('the submit CV API responds successfully', () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'Submit CV successfully' }),
    });
  });
};

const whenFillAllFields = (step: DefineStepFunction) => {
  step(/^I fill in all fields with a valid CV "(.*)"$/, async (cv: string) => {
    await fillAllFields(makeFile(cv));
  });
};

const whenClickSubmit = (step: DefineStepFunction) => {
  step('I click the Submit button', async () => {
    await user.click(screen.getByRole('button', { name: 'Submit CV' }));
  });
};

const thenSeeError = (step: DefineStepFunction) => {
  step(/^I see the error "(.*)"$/, (error: string) => {
    expect(screen.getByText(error)).toBeTruthy();
  });
};

const thenSeeSubmitError = (step: DefineStepFunction) => {
  step(/^I see the submit error "(.*)"$/, async (message: string) => {
    expect((await screen.findByRole('alert')).textContent).toBe(message);
  });
};

const thenFormKeepsData = (step: DefineStepFunction) => {
  step('the form keeps the entered data', () => {
    expect((field('Name') as HTMLInputElement).value).toBe(VALID_NAME);
    expect((field('Email') as HTMLInputElement).value).toBe(VALID_EMAIL);
    expect((field('Position') as HTMLSelectElement).value).toBe('frontend-dev');
    expect(screen.getByText('Selected: cv.pdf')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Submit CV' })).toBeTruthy();
  });
};

defineFeature(feature, (test) => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
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
  });

  test('Show requirements of the selected position', ({ given, when, then }) => {
    givenOnSubmitCvPage(given);

    when(/^I select the position "(.*)"$/, async (position: string) => {
      await user.selectOptions(field('Position'), position);
    });

    then(/^I see the requirements "(.*)"$/, (requirements: string) => {
      const items = screen.getAllByRole('listitem').map((li) => li.textContent);
      expect(items).toEqual(requirements.split(', '));
    });
  });

  test('Submit CV successfully', ({ given, and, when, then }) => {
    givenOnSubmitCvPage(given);
    givenApiRespondsSuccessfully(and);
    whenFillAllFields(when);
    whenClickSubmit(and);

    then(/^I see the message "(.*)"$/, async (message: string) => {
      expect(await screen.findByText(message)).toBeTruthy();
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/submit-cv');
      const body = init.body as FormData;
      expect(body.get('name')).toBe(VALID_NAME);
      expect(body.get('email')).toBe(VALID_EMAIL);
      expect(body.get('position')).toBe('frontend-dev');
      expect((body.get('cv') as File).name).toBe('cv.pdf');
    });

    and(/^I see a "(.*)" link to "(.*)"$/, (name: string, href: string) => {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
    });
  });

  test('Show validation error for invalid <field>', ({ given, and, when, then }) => {
    givenOnSubmitCvPage(given);
    whenFillAllFields(and);

    when(/^I set "(.*)" to "(.*)"$/, async (label: string, value: string) => {
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

    whenClickSubmit(and);
    thenSeeError(then);

    and('the submit CV API is not called', () => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  test('Accept a .docx file without MIME type', ({ given, and, when, then }) => {
    givenOnSubmitCvPage(given);
    givenApiRespondsSuccessfully(and);

    when(/^I fill in all fields with a valid CV "(.*)" without MIME type$/, async (cv: string) => {
      await fillAllFields(makeFile(cv, { withoutMime: true }));
    });

    whenClickSubmit(and);

    then(/^I see the message "(.*)"$/, async (message: string) => {
      expect(await screen.findByText(message)).toBeTruthy();
    });
  });

  test('Clear a field error when the field is edited', ({ given, and, when, then }) => {
    givenOnSubmitCvPage(given);
    whenClickSubmit(and);
    thenSeeError(and);

    when(/^I type "(.*)" into "(.*)"$/, async (value: string, label: string) => {
      await user.type(field(label), value);
    });

    then(/^I no longer see the error "(.*)"$/, (error: string) => {
      expect(screen.queryByText(error)).toBeNull();
    });
  });

  test('Show the API error message when submission is rejected', ({ given, and, when, then }) => {
    givenOnSubmitCvPage(given);

    and(/^the submit CV API responds with error "(.*)"$/, (message: string) => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, message }),
      });
    });

    whenFillAllFields(when);
    whenClickSubmit(and);
    thenSeeSubmitError(then);
    thenFormKeepsData(and);
  });

  test('Show a generic error when the network fails', ({ given, and, when, then }) => {
    givenOnSubmitCvPage(given);

    and('the network is down', () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    });

    whenFillAllFields(when);
    whenClickSubmit(and);
    thenSeeSubmitError(then);
    thenFormKeepsData(and);
  });
});
