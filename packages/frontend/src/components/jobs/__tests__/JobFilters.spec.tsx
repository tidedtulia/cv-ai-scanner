import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { JobFilters, type JobFilterValues } from '../JobFilters';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

const categories = [
  { code: 'DEVELOPER', name: 'Developer' },
  { code: 'QA', name: 'QA / Tester' },
];
const levels = [
  { code: 'MIDDLE', name: 'Middle' },
  { code: 'SENIOR', name: 'Senior' },
];

function renderFilters(selected: JobFilterValues = {}) {
  render(
    <I18nProvider locale="en">
      <JobFilters categories={categories} levels={levels} selected={selected} />
    </I18nProvider>,
  );
}

describe('JobFilters (AC-4)', () => {
  beforeEach(() => mockPush.mockReset());

  it('shows the filters from the URL, matching codes case-insensitively', () => {
    renderFilters({ category: 'developer', level: 'SENIOR' });

    expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe('DEVELOPER');
    expect((screen.getByLabelText('Level') as HTMLSelectElement).value).toBe('SENIOR');
    expect(screen.getByRole('link', { name: 'Clear filters' }).getAttribute('href')).toBe('/jobs');
  });

  it('puts the chosen filters in the URL', async () => {
    const user = userEvent.setup();
    renderFilters({ category: 'DEVELOPER' });

    await user.selectOptions(screen.getByLabelText('Level'), 'Senior');
    expect(mockPush).toHaveBeenLastCalledWith('/jobs?category=DEVELOPER&level=SENIOR');

    await user.selectOptions(screen.getByLabelText('Category'), 'All categories');
    expect(mockPush).toHaveBeenLastCalledWith('/jobs');
  });

  it('hides "Clear filters" when nothing is filtered', () => {
    renderFilters();

    expect(screen.queryByRole('link', { name: 'Clear filters' })).toBeNull();
  });
});
