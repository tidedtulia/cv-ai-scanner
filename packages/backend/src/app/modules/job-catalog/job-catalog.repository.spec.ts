import { PrismaService } from '../../database/prisma.service';
import { JobCatalogRepository } from './job-catalog.repository';

describe('JobCatalogRepository', () => {
  const prisma = {
    jobCategory: { findMany: jest.fn().mockResolvedValue([]) },
    jobLevel: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const repo = new JobCatalogRepository(prisma as unknown as PrismaService);

  const expectedQuery = {
    where: { isActive: true, positions: { some: { status: 'OPEN' } } },
    orderBy: { sortOrder: 'asc' },
    select: { code: true, name: true },
  };

  beforeEach(() => jest.clearAllMocks());

  it('findFilterableCategories() returns active categories that have an OPEN position, code + name only', async () => {
    await repo.findFilterableCategories();

    expect(prisma.jobCategory.findMany).toHaveBeenCalledWith(expectedQuery);
  });

  it('findFilterableLevels() returns active levels that have an OPEN position, code + name only', async () => {
    await repo.findFilterableLevels();

    expect(prisma.jobLevel.findMany).toHaveBeenCalledWith(expectedQuery);
  });
});
