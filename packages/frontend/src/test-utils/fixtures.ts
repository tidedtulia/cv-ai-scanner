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

// ---- HR applications (hr-applications) ----

export const hrListItem = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  fullName: 'Nguyễn Văn An',
  email: 'an@example.com',
  status: 'EVALUATED',
  createdAt: '2026-11-06T17:30:00.000Z', // 07/11/2026 00:30 in Vietnam
  position: { code: 'backend-dev', title: 'Backend Developer', category: 'Developer', level: 'Middle' },
  overallScore: 83.33,
  recommendation: 'RECOMMENDED',
  ...over,
});

export const hrListResponse = (items = [hrListItem()], over: Record<string, unknown> = {}) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 20,
  counts: { 'to-decide': 5, pending: 3, decided: 2, all: 10 },
  tab: 'to-decide',
  sort: 'score',
  ...over,
});

export const hrFilters = () => ({
  positions: [
    { code: 'backend-dev', title: 'Backend Developer', status: 'OPEN' },
    { code: 'old-job', title: 'Old Job', status: 'CLOSED' },
  ],
  categories: [{ code: 'DEVELOPER', name: 'Developer', isActive: true }],
  levels: [{ code: 'MIDDLE', name: 'Middle', isActive: true }],
});

export const hrDetail = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  fullName: 'Nguyễn Văn An',
  email: 'an@example.com',
  status: 'EVALUATED',
  createdAt: '2026-11-06T17:30:00.000Z',
  cvFileName: 'CV An.pdf',
  position: { code: 'backend-dev', title: 'Backend Developer', category: 'Developer', level: { code: 'MIDDLE', name: 'Middle' }, minYearsExperience: 2, status: 'OPEN' },
  evaluation: {
    overallScore: 83.33,
    recommendation: 'RECOMMENDED',
    summary: 'Ứng viên phù hợp.',
    strengths: ['Thành thạo NestJS'],
    weaknesses: ['Ít kinh nghiệm Prisma'],
    criteriaScores: [
      { criterion_id: 'c1', name: 'NestJS', type: 'TECHNICAL', weight: 5, is_required: true, score: 9, reasoning: 'Có 3 năm NestJS', evidence: 'Built NestJS APIs' },
      { criterion_id: 'c2', name: 'English', type: 'LANGUAGE', weight: 1, is_required: false, score: 6, reasoning: 'Đọc hiểu tốt', evidence: '' },
    ],
    estimatedYearsExperience: 3.5,
    estimatedLevel: { code: 'MIDDLE', name: 'Middle' },
    model: 'claude-sonnet-5-5',
    promptVersion: 'v1',
    evaluatedAt: '2026-11-07T17:01:00.000Z',
  },
  history: [
    { fromStatus: null, toStatus: 'SUBMITTED', note: null, createdAt: '2026-11-06T17:30:00.000Z', changedBy: null },
    { fromStatus: 'EVALUATING', toStatus: 'EVALUATED', note: 'n8n: đánh giá xong', createdAt: '2026-11-07T17:01:00.000Z', changedBy: null },
  ],
  otherApplications: [],
  canDecide: true,
  canReEvaluate: true,
  ...over,
});

// ---- HR positions / catalog (hr-positions) ----

export const hrJob = (over: Record<string, unknown> = {}) => ({
  id: '5d0c9a3e-1b2c-4d3e-8f4a-5b6c7d8e9f01',
  code: 'backend-dev',
  title: 'Backend Developer',
  category: { code: 'DEVELOPER', name: 'Developer' },
  level: { code: 'MIDDLE', name: 'Middle' },
  minYearsExperience: 2,
  status: 'OPEN',
  criteriaCount: 3,
  applicationCount: 4,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-06T17:30:00.000Z', // 07/11/2026 in Vietnam
  ...over,
});

export const hrCatalogItem = (over: Record<string, unknown> = {}) => ({ id: 'cat-1', code: 'DEVELOPER', name: 'Developer', sortOrder: 10, isActive: true, positionCount: 2, ...over });

export const hrCriterion = (over: Record<string, unknown> = {}) => ({ id: 'c1', name: 'NestJS', type: 'TECHNICAL', description: '≥ 2 years in production', weight: 5, isRequired: true, sortOrder: 10, ...over });

export const hrJobDetail = (over: Record<string, unknown> = {}) => ({
  ...hrJob(),
  description: '## About the role\nBuild APIs.',
  criteria: [hrCriterion(), hrCriterion({ id: 'c2', name: 'PostgreSQL', weight: 4, isRequired: false, description: null, sortOrder: 20 }), hrCriterion({ id: 'c3', name: 'English', type: 'LANGUAGE', weight: 1, isRequired: false, description: 'B1', sortOrder: 30 })],
  ...over,
});
