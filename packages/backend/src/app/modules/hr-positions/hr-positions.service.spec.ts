import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HrPositionsRepository } from './hr-positions.repository';
import { row } from './hr-positions.fixtures';
import { HrPositionsService } from './hr-positions.service';

const ID = '5d0c9a3e-1b2c-4d3e-8f4a-5b6c7d8e9f01';
const unique = () => new Prisma.PrismaClientKnownRequestError('x', { code: 'P2002', clientVersion: 't' });
const fk = () => new Prisma.PrismaClientKnownRequestError('x', { code: 'P2003', clientVersion: 't' });

describe('HrPositionsService (hr-positions AC-1 → AC-6)', () => {
  let repo: jest.Mocked<HrPositionsRepository>;
  let service: HrPositionsService;
  const fail = async (promise: Promise<unknown>) => {
    const error = (await promise.catch((e) => e)) as HttpException;
    expect(error).toBeInstanceOf(HttpException);
    return { status: error.getStatus(), ...(error.getResponse() as Record<string, unknown>) };
  };
  const input = (over: Record<string, unknown> = {}) => ({ title: ' Lập trình viên Backend ', categoryCode: 'DEVELOPER', levelCode: 'MIDDLE', minYearsExperience: 2, description: ' JD ', ...over });

  beforeEach(() => {
    repo = {
      list: jest.fn().mockResolvedValue([row()]),
      findById: jest.fn().mockResolvedValue(row()),
      findCategory: jest.fn().mockResolvedValue({ id: 'cat-1', code: 'DEVELOPER', isActive: true }),
      findLevel: jest.fn().mockResolvedValue({ id: 'lvl-1', code: 'MIDDLE', isActive: true }),
      codeExists: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockResolvedValue({ id: ID }),
      update: jest.fn().mockResolvedValue({ id: ID }),
      deleteIfUnused: jest.fn(),
    } as unknown as jest.Mocked<HrPositionsRepository>;
    service = new HrPositionsService(repo);
  });

  describe('list() (AC-1)', () => {
    it('maps every job with the counts; the status filter is passed on', async () => {
      const [item] = await service.list({ status: 'OPEN' });
      expect(repo.list).toHaveBeenCalledWith('OPEN');
      expect(item).toEqual({ id: ID, code: 'backend-dev', title: 'Backend Developer', category: { code: 'DEVELOPER', name: 'Developer' }, level: { code: 'MIDDLE', name: 'Middle' }, minYearsExperience: 2, status: 'DRAFT', criteriaCount: 1, applicationCount: 0, createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-02T00:00:00.000Z' });
    });

    it.each([['open'], ['ALL'], [['OPEN', 'DRAFT']], [1]])('status %p → 400 INVALID_QUERY', async (status) => {
      expect(await fail(service.list({ status }))).toMatchObject({ status: 400, code: 'INVALID_QUERY' });
    });
  });

  describe('create() (AC-2)', () => {
    it('is always a DRAFT; trims; the code comes from the title without accents', async () => {
      await service.create(input());
      expect(repo.create).toHaveBeenCalledWith({ code: 'lap-trinh-vien-backend', title: 'Lập trình viên Backend', categoryId: 'cat-1', levelId: 'lvl-1', minYearsExperience: 2, description: 'JD' });
    });

    it('a taken generated code gets -2, -3…; a race (unique violation) moves on to the next one', async () => {
      repo.codeExists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      repo.create.mockRejectedValueOnce(unique()).mockResolvedValueOnce({ id: ID });
      await service.create(input({ title: 'Backend Dev' }));
      expect(repo.codeExists.mock.calls.map(([c]) => c)).toEqual(['backend-dev', 'backend-dev-2', 'backend-dev-3']);
      expect(repo.create.mock.calls.map(([d]) => d.code)).toEqual(['backend-dev-2', 'backend-dev-3']);
    });

    it('a title with no letters falls back to "job"', async () => {
      await service.create(input({ title: '???' }));
      expect(repo.create.mock.calls[0][0].code).toBe('job');
    });

    it('a given code is used as is; taken → 409 CODE_TAKEN; bad format → 400 CODE_INVALID', async () => {
      await service.create(input({ code: 'senior-java' }));
      expect(repo.create.mock.calls[0][0].code).toBe('senior-java');
      repo.create.mockRejectedValueOnce(unique());
      expect(await fail(service.create(input({ code: 'senior-java' })))).toMatchObject({ status: 409, code: 'CODE_TAKEN' });
      for (const code of ['Senior Java', 'a', '-x', 'x-', 'a--b', 'é-é', 'x'.repeat(65)]) {
        expect(await fail(service.create(input({ code })))).toMatchObject({ status: 400, code: 'CODE_INVALID' });
      }
    });

    it('the category and level must exist and be shown', async () => {
      repo.findCategory.mockResolvedValueOnce(null);
      expect(await fail(service.create(input()))).toMatchObject({ code: 'CATEGORY_INVALID' });
      repo.findLevel.mockResolvedValueOnce({ id: 'l', code: 'MIDDLE', isActive: false });
      expect(await fail(service.create(input()))).toMatchObject({ code: 'LEVEL_INVALID' });
    });

    it.each([
      [{ title: '  ' }, 'TITLE_REQUIRED'],
      [{ title: 'x'.repeat(256) }, 'TITLE_TOO_LONG'],
      [{ description: '' }, 'DESCRIPTION_REQUIRED'],
      [{ description: 'x'.repeat(20001) }, 'DESCRIPTION_TOO_LONG'],
      [{ minYearsExperience: -1 }, 'YEARS_INVALID'],
      [{ minYearsExperience: 51 }, 'YEARS_INVALID'],
      [{ minYearsExperience: 1.5 }, 'YEARS_INVALID'],
      [{ minYearsExperience: '2' }, 'YEARS_INVALID'],
      [{ categoryCode: '' }, 'CATEGORY_INVALID'],
      [{ levelCode: undefined }, 'LEVEL_INVALID'],
    ])('%p → 400 %s, nothing written', async (over, code) => {
      expect(await fail(service.create(input(over)))).toMatchObject({ status: 400, code });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('limits are inclusive (255-char title, 20 000-char JD, 0 and 50 years)', async () => {
      await service.create(input({ title: 'x'.repeat(255), description: 'y'.repeat(20000), minYearsExperience: 0 }));
      await service.create(input({ minYearsExperience: 50 }));
      expect(repo.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('detail() / update() (AC-3, AC-4)', () => {
    it('unknown id → 404 POSITION_NOT_FOUND', async () => {
      repo.findById.mockResolvedValue(null);
      expect(await fail(service.detail(ID))).toMatchObject({ status: 404, code: 'POSITION_NOT_FOUND' });
      expect(await fail(service.update(ID, { title: 'x' }))).toMatchObject({ status: 404 });
    });

    it('only the fields sent change; the code is ignored; any status can be edited', async () => {
      repo.findById.mockResolvedValue(row({ status: 'CLOSED' }) as never);
      await service.update(ID, { title: ' New title ', code: 'hacked' });
      expect(repo.update).toHaveBeenCalledWith(ID, { title: 'New title' });
    });

    it('a hidden category already on the job is kept; another hidden one is refused', async () => {
      repo.findById.mockResolvedValue(row({ category: { code: 'OLDCAT', name: 'Old', isActive: false } }) as never);
      await service.update(ID, { categoryCode: 'oldcat', title: 'x' });
      expect(repo.findCategory).not.toHaveBeenCalled();
      repo.findCategory.mockResolvedValueOnce({ id: 'c2', code: 'HIDDEN', isActive: false });
      expect(await fail(service.update(ID, { categoryCode: 'HIDDEN' }))).toMatchObject({ code: 'CATEGORY_INVALID' });
    });

    it('with applications: HAS_APPLICATIONS only when level, years or JD really change', async () => {
      repo.findById.mockResolvedValue(row({}, 3) as never);
      expect(await service.update(ID, { title: 'New' })).not.toHaveProperty('warning');
      expect(await service.update(ID, { minYearsExperience: 2 })).not.toHaveProperty('warning'); // same value
      expect(await service.update(ID, { minYearsExperience: 4 })).toHaveProperty('warning', 'HAS_APPLICATIONS');
      expect(await service.update(ID, { description: 'new JD' })).toHaveProperty('warning', 'HAS_APPLICATIONS');
      repo.findLevel.mockResolvedValueOnce({ id: 'l2', code: 'SENIOR', isActive: true });
      expect(await service.update(ID, { levelCode: 'SENIOR' })).toHaveProperty('warning', 'HAS_APPLICATIONS');
    });

    it('without applications there is never a warning', async () => {
      expect(await service.update(ID, { minYearsExperience: 9 })).not.toHaveProperty('warning');
    });
  });

  describe('setStatus() (AC-5)', () => {
    it.each([['DRAFT', 'OPEN'], ['OPEN', 'CLOSED'], ['CLOSED', 'OPEN'], ['OPEN', 'DRAFT'], ['CLOSED', 'DRAFT']])('%s → %s is allowed', async (from, to) => {
      repo.findById.mockResolvedValue(row({ status: from }, 0, 2) as never);
      await service.setStatus(ID, { status: to });
      expect(repo.update).toHaveBeenCalledWith(ID, { status: to });
    });

    it('the same status is a no-op', async () => {
      repo.findById.mockResolvedValue(row({ status: 'OPEN' }) as never);
      await service.setStatus(ID, { status: 'OPEN' });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('OPEN needs at least one criterion and a JD → 409 CRITERIA_REQUIRED; closing never does', async () => {
      repo.findById.mockResolvedValue(row({}, 0, 0) as never);
      expect(await fail(service.setStatus(ID, { status: 'OPEN' }))).toMatchObject({ status: 409, code: 'CRITERIA_REQUIRED' });
      repo.findById.mockResolvedValue(row({ description: '  ' }, 0, 2) as never);
      expect(await fail(service.setStatus(ID, { status: 'OPEN' }))).toMatchObject({ status: 409 });
      repo.findById.mockResolvedValue(row({ status: 'OPEN' }, 0, 0) as never);
      await service.setStatus(ID, { status: 'CLOSED' });
      expect(repo.update).toHaveBeenCalledWith(ID, { status: 'CLOSED' });
    });

    it.each([[{}], [{ status: 'open' }], [{ status: 'ARCHIVED' }], [undefined]])('%p → 400 STATUS_INVALID', async (body) => {
      expect(await fail(service.setStatus(ID, body))).toMatchObject({ status: 400, code: 'STATUS_INVALID' });
    });
  });

  describe('remove() (AC-6)', () => {
    it('deletes a job without applications', async () => {
      repo.deleteIfUnused.mockResolvedValue({ result: 'deleted' });
      await expect(service.remove(ID)).resolves.toEqual({ deleted: true });
    });

    it('a job with applications → 409 POSITION_HAS_APPLICATIONS with the count; a late FK violation too; unknown → 404', async () => {
      repo.deleteIfUnused.mockResolvedValueOnce({ result: 'has-applications', applicationCount: 4 });
      expect(await fail(service.remove(ID))).toMatchObject({ status: 409, code: 'POSITION_HAS_APPLICATIONS', applicationCount: 4 });
      repo.deleteIfUnused.mockRejectedValueOnce(fk());
      expect(await fail(service.remove(ID))).toMatchObject({ status: 409, code: 'POSITION_HAS_APPLICATIONS' });
      repo.deleteIfUnused.mockResolvedValueOnce({ result: 'not-found' });
      expect(await fail(service.remove(ID))).toMatchObject({ status: 404, code: 'POSITION_NOT_FOUND' });
    });
  });
});
