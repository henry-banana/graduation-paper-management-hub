import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  MAX_SUBMISSION_FILE_SIZE,
  PDF_MIME_TYPE,
} from './submission.constants';

export interface SubmissionFileInfo {
  originalFileName: string;
  fileSize: number;
  mimeType: string;
}

@Injectable()
export class SubmissionFileValidatorService {
  validate(fileInfo: SubmissionFileInfo | undefined): SubmissionFileInfo {
    if (!fileInfo) {
      throw new BadRequestException('file is required');
    }

    if (fileInfo.mimeType !== PDF_MIME_TYPE) {
      throw new BadRequestException('Only PDF files are allowed');
    }

    if (fileInfo.fileSize > MAX_SUBMISSION_FILE_SIZE) {
      throw new PayloadTooLargeException(
        `File size exceeds maximum allowed (${MAX_SUBMISSION_FILE_SIZE / 1024 / 1024}MB)`,
      );
    }

    return fileInfo;
  }
}