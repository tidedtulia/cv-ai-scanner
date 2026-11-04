import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

describe('ApplicationsController', () => {
  let controller: ApplicationsController;
  let service: jest.Mocked<ApplicationsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: [
        {
          provide: ApplicationsService,
          useValue: { submit: jest.fn().mockResolvedValue({ message: 'Submit CV successfully' }) },
        },
      ],
    }).compile();

    controller = module.get(ApplicationsController);
    service = module.get(ApplicationsService);
  });

  it('submit() forwards the form fields and the uploaded CV', async () => {
    const body = { name: 'Jane', email: 'jane@example.com', position: 'frontend-dev' };
    const cv = { originalname: 'cv.pdf', size: 5, buffer: Buffer.from('%PDF-') };

    await expect(controller.submit(body, cv)).resolves.toEqual({ message: 'Submit CV successfully' });
    expect(service.submit).toHaveBeenCalledWith(body, cv);
  });
});
