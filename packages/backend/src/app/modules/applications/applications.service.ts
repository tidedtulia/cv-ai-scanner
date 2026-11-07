import { randomUUID } from 'node:crypto';
import { BadRequestException, HttpStatus, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  APPLICATION_CONSENT_VALUE,
  APPLICATION_MESSAGES,
  APPLICATION_TEXT_MAX_LENGTH,
  ApplicationErrorResponse,
  ApplicationMessageCode,
  isValidEmail,
} from '@org/shared';
import { ApplicationsRepository } from './applications.repository';
import { buildCvFileName } from './cv-file-name';
import { CvStorage, StoredCv } from './storage/cv-storage';

/** Text fields of the multipart form, as received (not validated yet). */
export interface SubmitApplicationBody {
  name?: unknown;
  email?: unknown;
  position?: unknown;
  consent?: unknown;
}

/** The part of multer's file object (memory storage) this module uses. */
export interface UploadedCvFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

const PDF_MIME_TYPE = 'application/pdf';
const PDF_SIGNATURE = '%PDF-';

const asTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** Error body = Nest's usual shape + `code`, which the bilingual form translates. */
export function applicationErrorBody(statusCode: number, error: string, code: ApplicationMessageCode): ApplicationErrorResponse {
  return { statusCode, error, code, message: APPLICATION_MESSAGES[code] };
}

const badRequest = (code: ApplicationMessageCode) =>
  new BadRequestException(applicationErrorBody(HttpStatus.BAD_REQUEST, 'Bad Request', code));

/** Checks both the extension and the file content — a renamed .docx is not a PDF. */
const isPdf = (file: UploadedCvFile) =>
  file.originalname.toLowerCase().endsWith('.pdf') &&
  file.buffer.subarray(0, PDF_SIGNATURE.length).toString('latin1') === PDF_SIGNATURE;

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly applicationsRepo: ApplicationsRepository,
    private readonly cvStorage: CvStorage,
  ) {}

  async submit(body: SubmitApplicationBody, cv?: UploadedCvFile): Promise<{ message: string }> {
    const { fullName, email, positionCode, file } = this.validate(body, cv);

    // Before uploading, so a closed position never leaves a file behind in Drive
    const position = await this.applicationsRepo.findOpenPosition(positionCode);
    if (!position) {
      throw badRequest('POSITION_NOT_OPEN');
    }

    const applicationId = randomUUID();
    let stored: StoredCv;
    try {
      stored = await this.cvStorage.upload({
        fileName: buildCvFileName({ submittedAt: new Date(), positionCode: position.code, fullName, applicationId }),
        content: file.buffer,
        mimeType: PDF_MIME_TYPE,
      });
    } catch (error) {
      this.logger.error(`CV upload failed for position ${position.code}`, error instanceof Error ? error.stack : error);
      throw new ServiceUnavailableException(
        applicationErrorBody(HttpStatus.SERVICE_UNAVAILABLE, 'Service Unavailable', 'UPLOAD_FAILED'),
      );
    }

    try {
      await this.applicationsRepo.create({
        id: applicationId,
        fullName,
        email,
        positionId: position.id,
        cvFileName: file.originalname.slice(0, APPLICATION_TEXT_MAX_LENGTH),
        cvDriveFileId: stored.fileId,
        cvDriveUrl: stored.url,
      });
    } catch (error) {
      // Don't leave an orphan CV in storage when the application could not be saved
      await this.cvStorage.remove(stored.fileId).catch((removeError) =>
        this.logger.error(`Could not remove orphan CV ${stored.fileId}`, removeError instanceof Error ? removeError.stack : removeError),
      );
      throw error;
    }

    return { message: APPLICATION_MESSAGES.SUBMITTED };
  }

  /** Same rules, order and messages as the form's client-side validation (AC-2). */
  private validate(body: SubmitApplicationBody, cv?: UploadedCvFile) {
    const fullName = asTrimmedString(body.name);
    if (!fullName) throw badRequest('NAME_REQUIRED');
    if (fullName.length > APPLICATION_TEXT_MAX_LENGTH) throw badRequest('NAME_TOO_LONG');

    const email = asTrimmedString(body.email).toLowerCase();
    if (!email) throw badRequest('EMAIL_REQUIRED');
    if (email.length > APPLICATION_TEXT_MAX_LENGTH || !isValidEmail(email)) throw badRequest('EMAIL_INVALID');

    const positionCode = asTrimmedString(body.position);
    if (!positionCode) throw badRequest('POSITION_REQUIRED');

    if (!cv) throw badRequest('CV_REQUIRED');
    if (!isPdf(cv)) throw badRequest('CV_NOT_PDF');

    // Every stored application carries consent, so its time is the application's created_at (FQ2)
    if (asTrimmedString(body.consent) !== APPLICATION_CONSENT_VALUE) throw badRequest('CONSENT_REQUIRED');

    return { fullName, email, positionCode, file: cv };
  }
}
