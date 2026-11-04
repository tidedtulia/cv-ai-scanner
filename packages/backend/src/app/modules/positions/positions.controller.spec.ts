import { Test, TestingModule } from '@nestjs/testing';
import { PositionsController } from './positions.controller';
import { PositionsService } from './positions.service';

describe('PositionsController', () => {
  let controller: PositionsController;
  let service: jest.Mocked<PositionsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PositionsController],
      providers: [
        {
          provide: PositionsService,
          useValue: {
            findOpen: jest.fn().mockResolvedValue([]),
            findOpenByCode: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PositionsController>(PositionsController);
    service = module.get(PositionsService);
  });

  it('findOpen() forwards the category / level query params', async () => {
    await controller.findOpen('DEVELOPER', 'SENIOR');

    expect(service.findOpen).toHaveBeenCalledWith({ category: 'DEVELOPER', level: 'SENIOR' });
  });

  it('findOne() forwards the code param', async () => {
    await controller.findOne('frontend-dev');

    expect(service.findOpenByCode).toHaveBeenCalledWith('frontend-dev');
  });
});
