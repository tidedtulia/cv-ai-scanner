import { BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { APPLICATION_MESSAGES } from '@org/shared';
import { ApplicationsRepository } from './applications.repository';
import { ApplicationsService, UploadedCvFile } from './applications.service';
import { CvStorage } from './storage/cv-storage';

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  let repo: jest.Mocked<ApplicationsRepository>;
  let storage: jest.Mocked<CvStorage>;
  let logError: jest.SpyInstance;

  const pdf = (originalname = 'CV Nguyễn Văn A.pdf', content = '%PDF-1.7 fake'): UploadedCvFile => {
    const buffer = Buffer.from(content);
    return { originalname, size: buffer.length, buffer };
  };
  const body = { name: '  Nguyễn Văn A ', email: ' Jane.Doe@Example.com ', position: 'frontend-dev' };

  beforeEach(async () => {
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        {
          provide: ApplicationsRepository,
          useValue: {
            findOpenPosition: jest.fn().mockResolvedValue({ id: 'position-uuid', code: 'frontend-dev' }),
            create: jest.fn().mockResolvedValue({ id: 'new-id' }),
          },
        },
        {
          provide: CvStorage,
          useValue: {
            upload: jest.fn().mockResolvedValue({ fileId: 'drive-file-id', url: 'https://drive.google.com/file/d/drive-file-id/view' }),
            remove: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(ApplicationsService);
    repo = module.get(ApplicationsRepository);
    storage = module.get(CvStorage);
  });

  it('submit() uploads the CV, then saves the application (AC-1)', async () => {
    await expect(service.submit(body, pdf())).resolves.toEqual({ message: APPLICATION_MESSAGES.SUBMITTED });

    const upload = storage.upload.mock.calls[0][0];
    expect(upload.mimeType).toBe('application/pdf');
    expect(upload.fileName).toMatch(/^\d{8}-\d{6}_frontend-dev_nguyen-van-a_[0-9a-f]{8}\.pdf$/);

    const saved = repo.create.mock.calls[0][0];
    expect(saved).toMatchObject({
      fullName: 'Nguyễn Văn A',
      email: 'jane.doe@example.com',
      positionId: 'position-uuid',
      cvFileName: 'CV Nguyễn Văn A.pdf',
      cvDriveFileId: 'drive-file-id',
      cvDriveUrl: 'https://drive.google.com/file/d/drive-file-id/view',
    });
    // The id used in the Drive file name is the application id
    expect(upload.fileName).toContain(`_${saved.id.slice(0, 8)}.pdf`);
  });

  it.each([
    ['missing name', { ...body, name: '   ' }, pdf(), APPLICATION_MESSAGES.NAME_REQUIRED],
    ['name too long', { ...body, name: 'a'.repeat(256) }, pdf(), APPLICATION_MESSAGES.NAME_TOO_LONG],
    ['missing email', { ...body, email: undefined }, pdf(), APPLICATION_MESSAGES.EMAIL_REQUIRED],
    ['invalid email', { ...body, email: 'not-an-email' }, pdf(), APPLICATION_MESSAGES.EMAIL_INVALID],
    ['missing position', { ...body, position: '' }, pdf(), APPLICATION_MESSAGES.POSITION_REQUIRED],
    ['missing CV', body, undefined, APPLICATION_MESSAGES.CV_REQUIRED],
    ['not a .pdf file', body, pdf('cv.docx'), APPLICATION_MESSAGES.CV_NOT_PDF],
    ['.pdf name but not PDF content', body, pdf('cv.pdf', 'PK\u0003\u0004 a zip/docx'), APPLICATION_MESSAGES.CV_NOT_PDF],
    ['repeated field (array)', { ...body, name: ['a', 'b'] }, pdf(), APPLICATION_MESSAGES.NAME_REQUIRED],
  ])('submit() rejects %s with 400 (AC-2)', async (_case, input, file, message) => {
    const error = await service.submit(input, file).catch((e) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe(message);
    expect(storage.upload).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('submit() rejects a position that is missing or not OPEN before uploading (AC-3)', async () => {
    repo.findOpenPosition.mockResolvedValue(null);

    await expect(service.submit(body, pdf())).rejects.toThrow(APPLICATION_MESSAGES.POSITION_NOT_OPEN);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('submit() returns 503 and saves nothing when the upload fails (AC-4)', async () => {
    storage.upload.mockRejectedValue(new Error('Google Drive upload failed: 500'));

    const error = await service.submit(body, pdf()).catch((e) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.message).toBe(APPLICATION_MESSAGES.UPLOAD_FAILED);
    expect(repo.create).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith('CV upload failed for position frontend-dev', expect.any(String));
  });

  it('submit() removes the uploaded CV when saving the application fails (AC-4)', async () => {
    repo.create.mockRejectedValue(new Error('db down'));

    await expect(service.submit(body, pdf())).rejects.toThrow('db down');
    expect(storage.remove).toHaveBeenCalledWith('drive-file-id');
  });

  it('submit() still reports the DB error when removing the orphan CV also fails', async () => {
    repo.create.mockRejectedValue(new Error('db down'));
    storage.remove.mockRejectedValue(new Error('drive down'));

    await expect(service.submit(body, pdf())).rejects.toThrow('db down');
    expect(logError).toHaveBeenCalledWith('Could not remove orphan CV drive-file-id', expect.any(String));
  });
});
