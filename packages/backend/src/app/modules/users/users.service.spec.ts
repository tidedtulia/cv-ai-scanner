import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<UsersRepository>;

  const user = { id: 'u1', name: 'Jane Doe', email: 'jane@example.com', createdAt: new Date(), updatedAt: new Date() };

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

  it('create() delegates to repository.create', async () => {
    repo.create.mockResolvedValue(user);
    const dto = { name: user.name, email: user.email };

    await expect(service.create(dto)).resolves.toBe(user);
    expect(repo.create).toHaveBeenCalledWith(dto);
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

  it('remove() deletes the user by id', async () => {
    repo.delete.mockResolvedValue(user);

    await expect(service.remove('u1')).resolves.toBe(user);
    expect(repo.delete).toHaveBeenCalledWith('u1');
  });
});
