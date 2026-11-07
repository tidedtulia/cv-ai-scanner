import { join } from 'path';
import { screen } from '@testing-library/react';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { list } from '../../../test-utils/fixtures';
import { mockRequest, resetMockRequest } from '../../../test-utils/next-headers.mock';
import { renderPage } from '../../../test-utils/render-page';
import PrivacyPage from '../page';

jest.mock('next/headers', () => require('../../../test-utils/next-headers.mock'));

const feature = loadFeature(join(__dirname, 'privacy.feature'));

defineFeature(feature, (test) => {
  beforeEach(() => resetMockRequest());

  test('Explain how personal data is handled', ({ given, when, then, and }) => {
    given(/^my browser prefers "(.*)"$/, (language: string) => {
      mockRequest.acceptLanguage = language;
    });

    when('I open the privacy page', async () => {
      await renderPage(PrivacyPage());
    });

    then(/^I see the main heading "(.*)"$/, (title: string) => {
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(title);
    });

    and('the page shows when it was last updated', () => {
      expect(screen.getByText(/2026-11-07/)).toBeTruthy();
    });

    and(/^I see the sections "(.*)"$/, (sections: string) => {
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(list(sections));
    });

    const says = (step: typeof and) =>
      step(/^the page says "(.*)"$/, (text: string) => {
        expect(document.body.textContent).toContain(text);
      });
    says(and);
    says(and);
    says(and);
  });
});
