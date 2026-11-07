import { ArgumentsHost, PayloadTooLargeException } from '@nestjs/common';
import { APPLICATION_MESSAGES } from '@org/shared';
import { CvTooLargeFilter } from './cv-too-large.filter';

describe('CvTooLargeFilter', () => {
  it('answers 413 with the form message and code CV_TOO_LARGE (fe-public-pages AC-20)', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;

    new CvTooLargeFilter().catch(new PayloadTooLargeException('File too large'), host);

    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith({
      statusCode: 413,
      error: 'Payload Too Large',
      code: 'CV_TOO_LARGE',
      message: APPLICATION_MESSAGES.CV_TOO_LARGE,
    });
  });
});
