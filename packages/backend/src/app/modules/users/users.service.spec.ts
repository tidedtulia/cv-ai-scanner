import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { USER_MESSAGES } from '@org/shared';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersService (hr-auth AC-8)', () => {
  let service: UsersService;
  let repo: jest.Mocked<UsersRepository>;
  const ME = '11111111-1111-4111-8111-111111111111';
  const OTHER = '22222222-2222-4222-8222-222222222222';
  const user = { id: OTHER, name: 'Jane Doe', email: 'jane@example.com', isActive: true, createdAt: new Date(), updatedAt: new Date() };
  const prismaError = (code: string) => new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: 'test' });
  const codeOf = async (promise: Promise<unknown>) => {
    const error = (await promise.catch((e) => e)) as HttpException;
    return { status: error.getStatus(), ...(error.getResponse() as object) } as { status: number; code: string; message: string };
  };

  beforeEach(() => {
    repo = { create: jest.fn().mockResolvedValue(user), findAll: jest.fn(), findById: jest.fn(), update: jest.fn().mockResolvedValue(user), delete: jest.fn().mockResolvedValue(user) } as unknown as jest.Mocked<UsersRepository>;
    service = new UsersService(repo);
  });

  it('create() trims, lowercases the email, stores an scrypt hash, never the password', async () => {
    await expect(service.create({ name: ' Jane Doe ', email: ' Jane@Example.com ', password: 's3cret-pass', role: 'admin' })).resolves.toBe(user);
    const data = repo.create.mock.calls[0][0];
    expect(data).toEqual({ name: 'Jane Doe', email: 'jane@example.com', passwordHash: expect.stringMatching(/^scrypt\$/) });
  });

  it.each([
    ['empty name', { name: '  ', email: 'a@b.co', password: 'longenough' }, 'NAME_REQUIRED'],
    ['name too long', { name: 'a'.repeat(256), email: 'a@b.co', password: 'longenough' }, 'NAME_TOO_LONG'],
    ['bad email', { name: 'A', email: 'nope', password: 'longenough' }, 'EMAIL_INVALID'],
    ['missing email', { name: 'A', password: 'longenough' }, 'EMAIL_INVALID'],
    ['short password', { name: 'A', email: 'a@b.co', password: '1234567' }, 'PASSWORD_LENGTH'],
    ['long password', { name: 'A', email: 'a@b.co', password: 'x'.repeat(73) }, 'PASSWORD_LENGTH'],
    ['missing password', { name: 'A', email: 'a@b.co' }, 'PASSWORD_LENGTH'],
    ['no body', undefined, 'NAME_REQUIRED'],
  ])('create() rejects %s with 400 %s', async (_case, body, code) => {
    const error = await codeOf(service.create(body));
    expect(error).toMatchObject({ status: 400, code, message: USER_MESSAGES[code as keyof typeof USER_MESSAGES] });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('create() / update(): an email already used → 409 EMAIL_TAKEN', async () => {
    repo.create.mockRejectedValue(prismaError('P2002'));
    expect(await codeOf(service.create({ name: 'A', email: 'jane@example.com', password: 'longenough' }))).toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });
    repo.update.mockRejectedValue(prismaError('P2002'));
    expect(await codeOf(service.update(OTHER, { email: 'jane@example.com' }, ME))).toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });
  });

  it('findOne() / update() / remove(): unknown id → 404 USER_NOT_FOUND', async () => {
    repo.findById.mockResolvedValue(null);
    expect(await codeOf(service.findOne(OTHER))).toMatchObject({ status: 404, code: 'USER_NOT_FOUND' });
    repo.update.mockRejectedValue(prismaError('P2025'));
    expect(await codeOf(service.update(OTHER, { name: 'B' }, ME))).toMatchObject({ status: 404, code: 'USER_NOT_FOUND' });
    repo.delete.mockRejectedValue(prismaError('P2025'));
    expect(await codeOf(service.remove(OTHER, ME))).toMatchObject({ status: 404, code: 'USER_NOT_FOUND' });
  });

  it('update(): only the fields sent are changed; a new password is hashed', async () => {
    await service.update(OTHER, { password: 'new-password-1', isActive: false }, ME);
    expect(repo.update).toHaveBeenCalledWith(OTHER, { isActive: false, passwordHash: expect.stringMatching(/^scrypt\$/) });
    await service.update(OTHER, { name: ' New Name ' }, ME);
    expect(repo.update).toHaveBeenLastCalledWith(OTHER, { name: 'New Name' });
  });

  it('update(): isActive must be a boolean', async () => {
    expect(await codeOf(service.update(OTHER, { isActive: 'no' }, ME))).toMatchObject({ status: 400, code: 'IS_ACTIVE_INVALID' });
  });

  it('an HR cannot delete or deactivate their own account → 400 CANNOT_CHANGE_OWN_ACCOUNT', async () => {
    expect(await codeOf(service.remove(ME, ME))).toMatchObject({ status: 400, code: 'CANNOT_CHANGE_OWN_ACCOUNT' });
    expect(await codeOf(service.update(ME, { isActive: false }, ME))).toMatchObject({ status: 400, code: 'CANNOT_CHANGE_OWN_ACCOUNT' });
    expect(repo.delete).not.toHaveBeenCalled();
    await expect(service.update(ME, { name: 'Still me' }, ME)).resolves.toBe(user); // other changes to oneself are fine
  });
});
