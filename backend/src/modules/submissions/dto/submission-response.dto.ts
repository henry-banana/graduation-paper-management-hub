import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FileType,
  SUBMISSION_FILE_TYPES,
} from '../submission.constants';

export { FileType } from '../submission.constants';

export class SubmissionResponseDto {
  @ApiProperty({ description: 'Submission ID', example: 'sub_001' })
  id!: string;

  @ApiProperty({ description: 'Topic ID', example: 'tp_001' })
  topicId!: string;

  @ApiProperty({
    description: 'User ID who uploaded the file',
    example: 'USR001',
  })
  uploaderUserId!: string;

  @ApiProperty({
    description: 'Type of file submitted',
    enum: SUBMISSION_FILE_TYPES,
    example: 'REPORT',
  })
  fileType!: FileType;

  @ApiProperty({
    description: 'Version number (auto-incremented per fileType)',
    example: 1,
  })
  version!: number;

  @ApiPropertyOptional({
    description: 'Google Drive file ID',
    example: 'drv_1abc2def3',
  })
  driveFileId?: string;

  @ApiPropertyOptional({
    description: 'Direct link to Google Drive file',
    example: 'https://drive.google.com/file/d/...',
  })
  driveLink?: string;

  @ApiProperty({
    description: 'When the file was uploaded',
    example: '2026-05-15T14:30:00Z',
  })
  uploadedAt!: string;

  @ApiPropertyOptional({
    description: 'Original filename',
    example: 'report_v1.pdf',
  })
  originalFileName?: string;

  @ApiPropertyOptional({
    description: 'File size in bytes',
    example: 2048000,
  })
  fileSize?: number;
}

export class CreateSubmissionResponseDto {
  @ApiProperty({ description: 'New submission ID', example: 'sub_002' })
  id!: string;

  @ApiProperty({ description: 'Version number', example: 2 })
  version!: number;

  @ApiPropertyOptional({
    description: 'Google Drive file ID',
    example: 'drv_123abc',
  })
  driveFileId?: string;
}

export class DownloadResponseDto {
  @ApiProperty({
    description: 'Download URL (signed or direct)',
    example: 'https://drive.google.com/uc?id=...',
  })
  downloadUrl!: string;

  @ApiProperty({
    description: 'URL expiration time',
    example: '2026-05-15T15:30:00Z',
  })
  expiresAt!: string;
}
