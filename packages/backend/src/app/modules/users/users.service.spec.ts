import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<UsersRepository>;

  const user = {
    id: 'u1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repo = module.get(UsersRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create() stores a password hash and a lowercased email', async () => {
    repo.create.mockResolvedValue(user);

    await expect(
      service.create({ name: user.name, email: 'Jane@Example.com', password: 's3cret-pass' }),
    ).resolves.toBe(user);

    const data = repo.create.mock.calls[0][0];
    expect(data).toMatchObject({ name: user.name, email: 'jane@example.com' });
    expect(data.passwordHash).toMatch(/^scrypt\$/);
    expect(data).not.toHaveProperty('password');
  });

  it('create() rejects a missing password', async () => {
    await expect(
      service.create({ name: user.name, email: user.email, password: '' }),
    ).rejects.toThrow('password is required');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('findAll() returns all users from repository', async () => {
    repo.findAll.mockResolvedValue([user]);

    await expect(service.findAll()).resolves.toEqual([user]);
  });

  it('findOne() looks up the user by id', async () => {
    repo.findById.mockResolvedValue(user);

    await expect(service.findOne('u1')).resolves.toBe(user);
    expect(repo.findById).toHaveBeenCalledWith('u1');
  });

  it('findOne() returns null when the user does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(service.findOne('missing')).resolves.toBeNull();
  });

  it('update() passes id and dto to repository.update', async () => {
    const updated = { ...user, name: 'Janet' };
    repo.update.mockResolvedValue(updated);

    await expect(service.update('u1', { name: 'Janet' })).resolves.toBe(updated);
    expect(repo.update).toHaveBeenCalledWith('u1', { name: 'Janet' });
  });

  it('update() hashes a new password and lowercases the email', async () => {
    repo.update.mockResolvedValue(user);

    await service.update('u1', { email: 'Janet@Example.com', password: 'n3w-pass' });

    const [, data] = repo.update.mock.calls[0];
    expect(data).toMatchObject({ email: 'janet@example.com' });
    expect(data.passwordHash).toMatch(/^scrypt\$/);
    expect(data).not.toHaveProperty('password');
  });

  it('remove() deletes the user by id', async () => {
    repo.delete.mockResolvedValue(user);

    await expect(service.remove('u1')).resolves.toBe(user);
    expect(repo.delete).toHaveBeenCalledWith('u1');
  });
});
