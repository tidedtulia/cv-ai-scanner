import React from 'react';
import { render, screen } from '@testing-library/react';
import { HomeContent } from '../src/components/home/HomeContent';
import { en } from '../src/i18n/dictionaries/en';
import { vi } from '../src/i18n/dictionaries/vi';

// The page itself is an async Server Component (reads the locale); its content is rendered here.
describe('Home page (AC-1)', () => {
  it('introduces the project and links to the jobs page', () => {
    render(<HomeContent dict={en.home} />);

    expect(screen.getByRole('heading', { level: 1, name: en.home.title })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View open jobs' }).getAttribute('href')).toBe('/jobs');
  });

  it('explains the 3 steps, including the AI-assisted review and the PDF size limit', () => {
    render(<HomeContent dict={en.home} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText(/upload your CV as a PDF \(max 10MB\)/)).toBeTruthy();
    expect(screen.getByText(/An AI assistant scores your CV/)).toBeTruthy();
  });

  it('renders in Vietnamese', () => {
    render(<HomeContent dict={vi.home} />);

    expect(screen.getByRole('link', { name: 'Xem việc làm đang tuyển' })).toBeTruthy();
    expect(screen.getByText(/tối đa 10MB/)).toBeTruthy();
  });
});
