import { render, screen, within } from '@testing-library/react';
import type { IPublicPositionSummary } from '@org/shared';
import { en } from '../../../i18n/dictionaries/en';
import { vi } from '../../../i18n/dictionaries/vi';
import { JobCard } from '../JobCard';

const position: IPublicPositionSummary = {
  code: 'frontend-dev',
  title: 'Frontend Developer',
  category: { code: 'DEVELOPER', name: 'Developer' },
  level: { code: 'MIDDLE', name: 'Middle' },
  minYearsExperience: 2,
  criteria: [
    { name: 'React / Next.js', type: 'TECHNICAL' },
    { name: 'TypeScript', type: 'TECHNICAL' },
  ],
};

describe('JobCard', () => {
  it('shows title, category · level · experience and the criteria tags', () => {
    render(<JobCard position={position} dict={en.jobs} />);

    expect(screen.getByRole('heading', { name: 'Frontend Developer' })).toBeTruthy();
    expect(screen.getByText('Developer · Middle · 2+ years of experience')).toBeTruthy();
    const tags = within(screen.getByRole('list', { name: 'Key requirements' })).getAllByRole('listitem');
    expect(tags.map((li) => li.textContent)).toEqual(['React / Next.js', 'TypeScript']);
  });

  it('links Apply to the form with the position preselected (AC-3)', () => {
    render(<JobCard position={position} dict={en.jobs} />);

    expect(screen.getByRole('link', { name: 'Apply' }).getAttribute('href')).toBe('/submit-cv?position=frontend-dev');
  });

  it('translates labels but keeps the job content as HR wrote it (AC-18)', () => {
    render(<JobCard position={{ ...position, minYearsExperience: 0 }} dict={vi.jobs} />);

    expect(screen.getByRole('heading', { name: 'Frontend Developer' })).toBeTruthy();
    expect(screen.getByText('Developer · Middle · Không yêu cầu kinh nghiệm')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ứng tuyển' })).toBeTruthy();
  });
});
