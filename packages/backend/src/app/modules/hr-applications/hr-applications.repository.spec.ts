import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { HrApplicationsRepository, likePattern, whereClause } from './hr-applications.repository';

const sqlOf = (sql: Prisma.Sql) => sql.sql.replace(/\s+/g, ' ').trim();

describe('HrApplicationsRepository (hr-applications AC-1, AC-2, AC-6, AC-7)', () => {
  describe('whereClause', () => {
    it('no filter, no status → no WHERE', () => {
      expect(sqlOf(whereClause({}))).toBe('');
    });

    it('every filter is a bound parameter (never concatenated)', () => {
      const where = whereClause(
        { position: 'backend-dev', category: 'DEVELOPER', level: 'MIDDLE', recommendation: 'RECOMMENDED', q: "O'Brien; DROP TABLE x" },
        ['EVALUATED', 'EVALUATION_FAILED'],
      );
      expect(sqlOf(where)).toBe(
        "WHERE a.status::text IN (?,?) AND lower(p.code) = lower(?) AND lower(c.code) = lower(?) AND lower(l.code) = lower(?) AND e.recommendation::text = ? AND (a.full_name ILIKE ? ESCAPE '\\' OR a.email ILIKE ? ESCAPE '\\')",
      );
      expect(where.values).toEqual(['EVALUATED', 'EVALUATION_FAILED', 'backend-dev', 'DEVELOPER', 'MIDDLE', 'RECOMMENDED', "%O'Brien; DROP TABLE x%", "%O'Brien; DROP TABLE x%"]);
    });

    it('the search matches %, _ and \\ literally', () => {
      expect(likePattern('50%_a\\b')).toBe('%50\\%\\_a\\\\b%');
    });
  });

  describe('queries', () => {
    const prisma = { $queryRaw: jest.fn(), $transaction: jest.fn() };
    const repo = new HrApplicationsRepository(prisma as unknown as PrismaService);
    beforeEach(() => jest.clearAllMocks());

    const lastSql = () => {
      const [strings, ...values] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
      const sql = Prisma.sql(strings, ...values);
      return { text: sqlOf(sql), values: sql.values };
    };

    it('listPage(score): highest score first, not yet evaluated last, then newest, then id (stable pages)', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      await repo.listPage({}, ['EVALUATED'], 'score', 40, 20);
      const { text, values } = lastSql();
      expect(text).toContain('LEFT JOIN evaluations e ON e.application_id = a.id');
      expect(text).toMatch(/ORDER BY e\.overall_score DESC NULLS LAST, a\.created_at DESC, a\.id ASC LIMIT \? OFFSET \?$/);
      expect(values.slice(-2)).toEqual([20, 40]);
    });

    it('listPage(newest): newest first, then id', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      await repo.listPage({ q: 'nguyen' }, ['SUBMITTED'], 'newest', 0, 20);
      expect(lastSql().text).toMatch(/ORDER BY a\.created_at DESC, a\.id ASC LIMIT/);
    });

    it('countByStatus(): same filters without the status condition, mapped per status', async () => {
      prisma.$queryRaw.mockResolvedValue([{ status: 'EVALUATED', n: 3 }, { status: 'SUBMITTED', n: 1 }]);
      await expect(repo.countByStatus({ position: 'backend-dev' })).resolves.toEqual({ EVALUATED: 3, SUBMITTED: 1 });
      const { text } = lastSql();
      expect(text).toContain('WHERE lower(p.code) = lower(?) GROUP BY a.status');
      expect(text).not.toContain('a.status::text IN');
    });

    describe('changeStatus()', () => {
      const tx = { application: { findUnique: jest.fn(), updateMany: jest.fn() }, applicationStatusHistory: { create: jest.fn() } };
      beforeEach(() => {
        Object.values(tx.application).forEach((f) => f.mockReset());
        tx.applicationStatusHistory.create.mockReset();
        prisma.$transaction.mockImplementation((run: (t: typeof tx) => unknown) => run(tx));
      });
      const change = () => repo.changeStatus('app-1', ['EVALUATED', 'EVALUATION_FAILED'], 'ACCEPTED', 'Good fit', 'hr-1');

      it('updates only from the current status (compare-and-set) and writes one history row', async () => {
        tx.application.findUnique.mockResolvedValue({ status: 'EVALUATED' });
        tx.application.updateMany.mockResolvedValue({ count: 1 });
        await expect(change()).resolves.toEqual({ result: 'done' });
        expect(tx.application.updateMany).toHaveBeenCalledWith({ where: { id: 'app-1', status: 'EVALUATED' }, data: { status: 'ACCEPTED' } });
        expect(tx.applicationStatusHistory.create).toHaveBeenCalledWith({
          data: { applicationId: 'app-1', fromStatus: 'EVALUATED', toStatus: 'ACCEPTED', note: 'Good fit', changedById: 'hr-1' },
        });
      });

      it('not found / status not allowed / changed meanwhile → no history row', async () => {
        tx.application.findUnique.mockResolvedValueOnce(null);
        await expect(change()).resolves.toEqual({ result: 'not-found' });
        tx.application.findUnique.mockResolvedValueOnce({ status: 'ACCEPTED' });
        await expect(change()).resolves.toEqual({ result: 'not-allowed', status: 'ACCEPTED' });
        tx.application.findUnique.mockResolvedValueOnce({ status: 'EVALUATED' });
        tx.application.updateMany.mockResolvedValueOnce({ count: 0 }); // another HR (or n8n) changed it in between
        await expect(change()).resolves.toEqual({ result: 'not-allowed', status: undefined });
        expect(tx.applicationStatusHistory.create).not.toHaveBeenCalled();
      });
    });
  });
});
