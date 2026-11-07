import { PrismaService } from '../../database/prisma.service';
import { HrPositionsRepository } from './hr-positions.repository';

describe('HrPositionsRepository (hr-positions AC-6, AC-7, AC-8)', () => {
  const tx = {
    position: { findUnique: jest.fn(), delete: jest.fn() },
    positionCriterion: { findFirst: jest.fn(), findMany: jest.fn(), aggregate: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  };
  const prisma = { $transaction: jest.fn((run: (t: typeof tx) => unknown) => run(tx)) };
  const repo = new HrPositionsRepository(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(tx.position).forEach((f) => f.mockReset());
    Object.values(tx.positionCriterion).forEach((f) => f.mockReset());
  });

  it('deleteIfUnused(): deletes only a job without applications', async () => {
    tx.position.findUnique.mockResolvedValueOnce({ _count: { applications: 0 } });
    await expect(repo.deleteIfUnused('p')).resolves.toEqual({ result: 'deleted' });
    expect(tx.position.delete).toHaveBeenCalledWith({ where: { id: 'p' } });
    tx.position.findUnique.mockResolvedValueOnce({ _count: { applications: 2 } });
    await expect(repo.deleteIfUnused('p')).resolves.toEqual({ result: 'has-applications', applicationCount: 2 });
    tx.position.findUnique.mockResolvedValueOnce(null);
    await expect(repo.deleteIfUnused('p')).resolves.toEqual({ result: 'not-found' });
    expect(tx.position.delete).toHaveBeenCalledTimes(1);
  });

  it('addCriterion(): goes to the end (largest sort order + 10)', async () => {
    tx.position.findUnique.mockResolvedValue({ id: 'p' });
    tx.positionCriterion.aggregate.mockResolvedValue({ _max: { sortOrder: 30 } });
    await repo.addCriterion('p', { name: 'A', type: 'TECHNICAL', description: null, weight: 1, isRequired: false });
    expect(tx.positionCriterion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ positionId: 'p', sortOrder: 40 }) });
    tx.positionCriterion.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
    await repo.addCriterion('p', { name: 'B', type: 'TECHNICAL', description: null, weight: 1, isRequired: false });
    expect(tx.positionCriterion.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ sortOrder: 10 }) });
  });

  it('removeCriterion(): an OPEN job keeps its last criterion; a DRAFT does not need to', async () => {
    tx.positionCriterion.findFirst.mockResolvedValue({ id: 'c' });
    tx.position.findUnique.mockResolvedValue({ status: 'OPEN', _count: { criteria: 1 } });
    await expect(repo.removeCriterion('p', 'c')).resolves.toEqual({ result: 'last-criterion' });
    tx.position.findUnique.mockResolvedValue({ status: 'OPEN', _count: { criteria: 2 } });
    await expect(repo.removeCriterion('p', 'c')).resolves.toEqual({ result: 'done' });
    tx.position.findUnique.mockResolvedValue({ status: 'DRAFT', _count: { criteria: 1 } });
    await expect(repo.removeCriterion('p', 'c')).resolves.toEqual({ result: 'done' });
    expect(tx.positionCriterion.delete).toHaveBeenCalledTimes(2);
    tx.positionCriterion.findFirst.mockResolvedValue(null);
    await expect(repo.removeCriterion('p', 'c')).resolves.toEqual({ result: 'not-found' });
  });

  describe('moveCriterion() (AC-8)', () => {
    const rows = (...orders: number[]) => orders.map((sortOrder, i) => ({ id: `c${i + 1}`, sortOrder }));
    const writes = () => tx.positionCriterion.update.mock.calls.map(([arg]) => [arg.where.id, arg.data.sortOrder]);

    it('swaps with the neighbour and renumbers in steps of 10', async () => {
      tx.positionCriterion.findMany.mockResolvedValue(rows(10, 20, 30));
      await repo.moveCriterion('p', 'c2', 'up');
      expect(writes()).toEqual([['c2', 10], ['c1', 20]]);
    });

    it('down: swaps with the next one', async () => {
      tx.positionCriterion.findMany.mockResolvedValue(rows(10, 20, 30));
      await repo.moveCriterion('p', 'c2', 'down');
      expect(writes()).toEqual([['c3', 20], ['c2', 30]]);
    });

    it('the first going up and the last going down: nothing changes', async () => {
      tx.positionCriterion.findMany.mockResolvedValue(rows(10, 20));
      await expect(repo.moveCriterion('p', 'c1', 'up')).resolves.toEqual({ result: 'done' });
      await expect(repo.moveCriterion('p', 'c2', 'down')).resolves.toEqual({ result: 'done' });
      expect(writes()).toEqual([]);
    });

    it('repeated sort orders (old data) are normalised so that the swap is visible', async () => {
      tx.positionCriterion.findMany.mockResolvedValue(rows(0, 0, 0));
      await repo.moveCriterion('p', 'c3', 'up');
      expect(writes()).toEqual([['c1', 10], ['c3', 20], ['c2', 30]]);
    });

    it('unknown criterion → not-found', async () => {
      tx.positionCriterion.findMany.mockResolvedValue(rows(10));
      await expect(repo.moveCriterion('p', 'zzz', 'up')).resolves.toEqual({ result: 'not-found' });
    });
  });
});
