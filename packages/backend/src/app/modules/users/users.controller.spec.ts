import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  const user = { id: 'u1', name: 'Jane Doe', email: 'jane@example.com', createdAt: new Date(), updatedAt: new Date() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() forwards the body to the service', async () => {
    service.create.mockResolvedValue(user);
    const dto = { name: user.name, email: user.email };

    await expect(controller.create(dto)).resolves.toBe(user);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('findAll() returns users from the service', async () => {
    service.findAll.mockResolvedValue([user]);

    await expect(controller.findAll()).resolves.toEqual([user]);
  });

  it('findOne() forwards the id param', async () => {
    service.findOne.mockResolvedValue(user);

    await expect(controller.findOne('u1')).resolves.toBe(user);
    expect(service.findOne).toHaveBeenCalledWith('u1');
  });

  it('update() forwards id and body', async () => {
    const updated = { ...user, email: 'janet@example.com' };
    service.update.mockResolvedValue(updated);

    await expect(controller.update('u1', { email: 'janet@example.com' })).resolves.toBe(updated);
    expect(service.update).toHaveBeenCalledWith('u1', { email: 'janet@example.com' });
  });

  it('remove() forwards the id param', async () => {
    service.remove.mockResolvedValue(user);

    await expect(controller.remove('u1')).resolves.toBe(user);
    expect(service.remove).toHaveBeenCalledWith('u1');
  });
});
