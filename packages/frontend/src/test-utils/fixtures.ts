import type { IJobCategory, IJobLevel, IPublicPositionDetail, IPublicPositionSummary } from '@org/shared';

/** Sample data shared by the page / form scenarios — content written "by HR" in English. */
export const CATEGORIES: IJobCategory[] = [
  { code: 'DEVELOPER', name: 'Developer' },
  { code: 'QA', name: 'QA / Tester' },
];

export const LEVELS: IJobLevel[] = [
  { code: 'INTERN', name: 'Intern' },
  { code: 'MIDDLE', name: 'Middle' },
  { code: 'SENIOR', name: 'Senior' },
];

const position = (
  code: string,
  title: string,
  category: IJobCategory,
  level: IJobLevel,
  minYearsExperience: number,
  criteria: string[],
): IPublicPositionSummary => ({
  code,
  title,
  category,
  level,
  minYearsExperience,
  criteria: criteria.map((name) => ({ name, type: 'TECHNICAL' })),
});

export const POSITIONS: IPublicPositionSummary[] = [
  position('frontend-dev', 'Frontend Developer', CATEGORIES[0], LEVELS[1], 2, ['React / Next.js', 'TypeScript', 'Tailwind CSS']),
  position('backend-dev', 'Backend Developer', CATEGORIES[0], LEVELS[1], 3, ['NestJS', 'PostgreSQL', 'Prisma ORM']),
  position('qa-intern', 'QA Intern', CATEGORIES[1], LEVELS[0], 0, ['Manual testing', 'English']),
];

const DESCRIPTIONS: Record<string, string> = {
  'frontend-dev': '## About the role\nBuild our web applications with React and Next.js.',
  'backend-dev': '## About the role\nDesign and build the APIs behind our products.',
  'qa-intern': '## About the role\nHelp us test new features.',
};

export const positionByTitle = (title: string): IPublicPositionSummary => {
  const found = POSITIONS.find((p) => p.title === title);
  if (!found) throw new Error(`No fixture position "${title}"`);
  return found;
};

export const positionDetail = (code: string): IPublicPositionDetail | undefined => {
  const summary = POSITIONS.find((p) => p.code === code);
  return summary && { ...summary, description: DESCRIPTIONS[code] };
};

/** "A, B" → ["A", "B"] (lists in Gherkin steps) */
export const list = (text: string) => text.split(',').map((item) => item.trim()).filter(Boolean);
