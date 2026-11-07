import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { API_PREFIX, API_ROUTES, CV_MAX_FILE_SIZE_BYTES } from '@org/shared';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

/**
 * The upload limit lives in multer's options on the controller, so it is only exercised through
 * a real HTTP request: a Nest app with the real interceptor + filter, the service mocked.
 */
describe('POST /api/applications — upload limit (fe-public-pages AC-21)', () => {
  let app: INestApplication;
  let url: string;
  const submit = jest.fn().mockResolvedValue({ message: 'Submit CV successfully' });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: [{ provide: ApplicationsService, useValue: { submit } }],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix(API_PREFIX);
    await app.listen(0);
    url = `${await app.getUrl()}/${API_PREFIX}/${API_ROUTES.APPLICATIONS}`.replace('[::1]', 'localhost');
  });

  afterAll(() => app.close());

  beforeEach(() => submit.mockClear());

  /** A "PDF" of exactly `size` bytes */
  const pdfOfSize = (size: number) => {
    const bytes = Buffer.alloc(size);
    bytes.write('%PDF-1.4');
    return bytes;
  };

  const post = (cv: Buffer, fileName = 'cv.pdf') => {
    const form = new FormData();
    form.append('name', 'Jane Doe');
    form.append('email', 'jane@example.com');
    form.append('position', 'frontend-dev');
    form.append('consent', 'true');
    form.append('cv', new Blob([cv], { type: 'application/pdf' }), fileName);
    return fetch(url, { method: 'POST', body: form });
  };

  it('accepts a CV of exactly 10MB (CV_MAX_FILE_SIZE_BYTES)', async () => {
    const res = await post(pdfOfSize(CV_MAX_FILE_SIZE_BYTES));

    expect(res.status).toBe(201);
    const [body, cv] = submit.mock.calls[0];
    expect(cv.size).toBe(CV_MAX_FILE_SIZE_BYTES);
    expect(body).toMatchObject({ name: 'Jane Doe', email: 'jane@example.com', position: 'frontend-dev', consent: 'true' });
  });

  it('rejects 10MB + 1 byte with 413 and code CV_TOO_LARGE, without reaching the service', async () => {
    const res = await post(pdfOfSize(CV_MAX_FILE_SIZE_BYTES + 1));

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      statusCode: 413,
      error: 'Payload Too Large',
      code: 'CV_TOO_LARGE',
      message: 'File size must not exceed 10MB',
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it('keeps a Vietnamese file name intact (UTF-8, not latin1)', async () => {
    await post(pdfOfSize(1024), 'CV Nguyễn Văn Đức.pdf');

    expect(submit.mock.calls[0][1].originalname).toBe('CV Nguyễn Văn Đức.pdf');
  });
});
