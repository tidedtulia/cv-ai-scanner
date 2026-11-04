import { PrismaService } from '../../database/prisma.service';
import { PositionsRepository } from './positions.repository';

describe('PositionsRepository', () => {
  const prisma = {
    position: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
  const repo = new PositionsRepository(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('findOpen() only queries OPEN positions, newest first', async () => {
    await repo.findOpen({});

    expect(prisma.position.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'OPEN' }, orderBy: { createdAt: 'desc' } }),
    );
  });

  it('findOpen() filters by category and level code, case-insensitively', async () => {
    await repo.findOpen({ category: 'developer', level: 'Senior' });

    const { where } = prisma.position.findMany.mock.calls[0][0];
    expect(where).toEqual({
      status: 'OPEN',
      category: { code: { equals: 'developer', mode: 'insensitive' } },
      level: { code: { equals: 'Senior', mode: 'insensitive' } },
    });
  });

  it('findOpen() selects only public columns (AC-1)', async () => {
    await repo.findOpen({});

    const { select } = prisma.position.findMany.mock.calls[0][0];
    expect(Object.keys(select).sort()).toEqual(['category', 'code', 'criteria', 'level', 'minYearsExperience', 'title']);
    expect(select.category.select).toEqual({ code: true, name: true });
    expect(select.level.select).toEqual({ code: true, name: true });
    expect(select.criteria).toEqual({ select: { name: true, type: true }, orderBy: { sortOrder: 'asc' } });
  });

  it('findOpenByCode() requires OPEN and adds the JD to the public columns', async () => {
    await repo.findOpenByCode('frontend-dev');

    const { where, select } = prisma.position.findFirst.mock.calls[0][0];
    expect(where).toEqual({ status: 'OPEN', code: { equals: 'frontend-dev', mode: 'insensitive' } });
    expect(Object.keys(select).sort()).toEqual([
      'category',
      'code',
      'criteria',
      'description',
      'level',
      'minYearsExperience',
      'title',
    ]);
  });
});
