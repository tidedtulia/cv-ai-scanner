const ID = '5d0c9a3e-1b2c-4d3e-8f4a-5b6c7d8e9f01';
/** Prisma row of a job as the repository returns it (test data of the hr-positions specs) */
export const row = (over: Record<string, unknown> = {}, apps = 0, criteria = 1) => ({
  id: ID,
  code: 'backend-dev',
  title: 'Backend Developer',
  description: 'JD',
  minYearsExperience: 2,
  status: 'DRAFT',
  createdAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date('2026-11-02T00:00:00Z'),
  category: { code: 'DEVELOPER', name: 'Developer', isActive: true },
  level: { code: 'MIDDLE', name: 'Middle', isActive: true },
  criteria: [],
  _count: { applications: apps, criteria },
  ...over,
});
