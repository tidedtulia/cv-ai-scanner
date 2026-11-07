import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HrCatalogRepository } from './hr-catalog.repository';
import { HrCatalogService } from './hr-catalog.service';

const ID = '9b8a7c6d-0000-4000-8000-000000000001';
const item = (over: Record<string, unknown> = {}) => ({ id: ID, code: 'QA', name: 'QA', sortOrder: 20, isActive: true, _count: { positions: 2 }, ...over });
const unique = () => new Prisma.PrismaClientKnownRequestError('x', { code: 'P2002', clientVersion: 't' });

describe('HrCatalogService (hr-positions AC-9 → AC-11)', () => {
  let repo: jest.Mocked<HrCatalogRepository>;
  let service: HrCatalogService;
  const fail = async (promise: Promise<unknown>) => {
    const error = (await promise.catch((e) => e)) as HttpException;
    expect(error).toBeInstanceOf(HttpException);
    return { status: error.getStatus(), ...(error.getResponse() as Record<string, unknown>) };
  };

  beforeEach(() => {
    repo = {
      list: jest.fn().mockResolvedValue([item(), item({ id: 'x', code: 'BA', name: 'BA', isActive: false, _count: { positions: 0 } })]),
      findById: jest.fn().mockResolvedValue({ id: ID }),
      codeExists: jest.fn().mockResolvedValue(false),
      nameExists: jest.fn().mockResolvedValue(false),
      nextSortOrder: jest.fn().mockResolvedValue(80),
      create: jest.fn().mockResolvedValue({ id: ID }),
      update: jest.fn().mockResolvedValue({ id: ID }),
    } as unknown as jest.Mocked<HrCatalogRepository>;
    service = new HrCatalogService(repo);
  });

  it('list() (AC-9): hidden ones included, with the number of jobs using each', async () => {
    expect(await service.list('category')).toEqual([
      { id: ID, code: 'QA', name: 'QA', sortOrder: 20, isActive: true, positionCount: 2 },
      { id: 'x', code: 'BA', name: 'BA', sortOrder: 20, isActive: false, positionCount: 0 },
    ]);
  });

  it('create() (AC-10): the code is built from the name (upper case, no accents) and the order goes last', async () => {
    await service.create('category', { name: ' Quản lý sản phẩm ' });
    expect(repo.create).toHaveBeenCalledWith('category', { code: 'QUAN_LY_SAN_PHAM', name: 'Quản lý sản phẩm', sortOrder: 80 });
  });

  it('create() (AC-10): a level can be put in between with its own order; a taken code gets _2', async () => {
    repo.codeExists.mockResolvedValueOnce(true);
    await service.create('level', { name: 'Senior', sortOrder: 35 });
    expect(repo.create).toHaveBeenCalledWith('level', { code: 'SENIOR_2', name: 'Senior', sortOrder: 35 });
    expect(repo.nextSortOrder).not.toHaveBeenCalled();
  });

  it('create() (AC-10): a given code is checked and used; taken → 409 CODE_TAKEN', async () => {
    await service.create('category', { name: 'Data', code: 'DATA_AI' });
    expect(repo.create.mock.calls[0][1].code).toBe('DATA_AI');
    repo.create.mockRejectedValueOnce(unique());
    expect(await fail(service.create('category', { name: 'Data 2', code: 'DATA_AI' }))).toMatchObject({ status: 409, code: 'CODE_TAKEN' });
    for (const code of ['data', 'A', '_A', 'A__B', 'Đ']) {
      expect(await fail(service.create('category', { name: 'X', code }))).toMatchObject({ status: 400, code: 'CODE_INVALID' });
    }
  });

  it.each([
    [{ name: ' ' }, 'NAME_REQUIRED'],
    [{ name: 'x'.repeat(256) }, 'NAME_TOO_LONG'],
    [{ name: 'X', sortOrder: 1.5 }, 'SORT_ORDER_INVALID'],
    [{ name: 'X', sortOrder: '5' }, 'SORT_ORDER_INVALID'],
  ])('create() %p → 400 %s', async (body, code) => {
    expect(await fail(service.create('level', body))).toMatchObject({ status: 400, code });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('create() / update(): the same name (any case) → 409 NAME_TAKEN', async () => {
    repo.nameExists.mockResolvedValue(true);
    expect(await fail(service.create('category', { name: 'qa' }))).toMatchObject({ status: 409, code: 'NAME_TAKEN' });
    expect(await fail(service.update('category', ID, { name: 'QA' }))).toMatchObject({ status: 409, code: 'NAME_TAKEN' });
    expect(repo.nameExists).toHaveBeenLastCalledWith('category', 'QA', ID);
  });

  it('update() (AC-11): rename, reorder, hide / show; only the fields sent; the code never changes', async () => {
    await service.update('level', ID, { name: ' Lead ', sortOrder: 55, isActive: false, code: 'HACK' });
    expect(repo.update).toHaveBeenCalledWith('level', ID, { name: 'Lead', sortOrder: 55, isActive: false });
    await service.update('level', ID, { isActive: true });
    expect(repo.update).toHaveBeenLastCalledWith('level', ID, { isActive: true });
  });

  it('update() (AC-11): bad isActive → 400; unknown id → 404 with the right code', async () => {
    expect(await fail(service.update('category', ID, { isActive: 'no' }))).toMatchObject({ status: 400, code: 'IS_ACTIVE_INVALID' });
    repo.findById.mockResolvedValue(null);
    expect(await fail(service.update('category', ID, { name: 'x' }))).toMatchObject({ status: 404, code: 'CATEGORY_NOT_FOUND' });
    expect(await fail(service.update('level', ID, { name: 'x' }))).toMatchObject({ status: 404, code: 'LEVEL_NOT_FOUND' });
  });
});
