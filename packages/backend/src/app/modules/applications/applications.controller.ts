import { Body, Controller, Post, UploadedFile, UseFilters, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { API_ROUTES, APPLICATION_FORM_FIELDS, CV_MAX_FILE_SIZE_BYTES } from '@org/shared';
import { ApplicationsService } from './applications.service';
import type { SubmitApplicationBody, UploadedCvFile } from './applications.service';
import { CvTooLargeFilter } from './cv-too-large.filter';

/** Public, no auth: the candidate apply form (multipart/form-data). */
@Controller(API_ROUTES.APPLICATIONS)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @UseFilters(CvTooLargeFilter)
  @UseInterceptors(
    FileInterceptor(APPLICATION_FORM_FIELDS.CV, {
      // Memory storage; multer stops reading once the file passes the limit
      limits: { fileSize: CV_MAX_FILE_SIZE_BYTES, files: 1 },
      // Busboy defaults to latin1, which garbles Vietnamese file names
      defParamCharset: 'utf8',
    }),
  )
  submit(@Body() body: SubmitApplicationBody, @UploadedFile() cv?: UploadedCvFile) {
    return this.applicationsService.submit(body, cv);
  }
}
