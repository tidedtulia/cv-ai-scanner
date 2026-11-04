import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { APPLICATION_MESSAGES, APPLICATION_TEXT_MAX_LENGTH, isValidEmail } from '@org/shared';
import { ApplicationsRepository } from './applications.repository';
import { buildCvFileName } from './cv-file-name';
import { CvStorage, StoredCv } from './storage/cv-storage';

/** Text fields of the multipart form, as received (not validated yet). */
export interface SubmitApplicationBody {
  name?: unknown;
  email?: unknown;
  position?: unknown;
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
      throw new BadRequestException(APPLICATION_MESSAGES.POSITION_NOT_OPEN);
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
      throw new ServiceUnavailableException(APPLICATION_MESSAGES.UPLOAD_FAILED);
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

  /** Same rules and messages as the form's client-side validation (AC-2). */
  private validate(body: SubmitApplicationBody, cv?: UploadedCvFile) {
    const fullName = asTrimmedString(body.name);
    if (!fullName) throw new BadRequestException(APPLICATION_MESSAGES.NAME_REQUIRED);
    if (fullName.length > APPLICATION_TEXT_MAX_LENGTH) throw new BadRequestException(APPLICATION_MESSAGES.NAME_TOO_LONG);

    const email = asTrimmedString(body.email).toLowerCase();
    if (!email) throw new BadRequestException(APPLICATION_MESSAGES.EMAIL_REQUIRED);
    if (email.length > APPLICATION_TEXT_MAX_LENGTH || !isValidEmail(email)) {
      throw new BadRequestException(APPLICATION_MESSAGES.EMAIL_INVALID);
    }

    const positionCode = asTrimmedString(body.position);
    if (!positionCode) throw new BadRequestException(APPLICATION_MESSAGES.POSITION_REQUIRED);

    if (!cv) throw new BadRequestException(APPLICATION_MESSAGES.CV_REQUIRED);
    if (!isPdf(cv)) throw new BadRequestException(APPLICATION_MESSAGES.CV_NOT_PDF);

    return { fullName, email, positionCode, file: cv };
  }
}
