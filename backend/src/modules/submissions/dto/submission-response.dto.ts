import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FileType,
  SUBMISSION_STATUSES,
  SUBMISSION_FILE_TYPES,
  SubmissionStatus,
  VersionLabel,
} from '../submission.constants';

export { FileType, SubmissionStatus, VersionLabel } from '../submission.constants';

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
    description: 'Revision round ID for this submission',
    example: 'rr_ab12cd34ef56',
  })
  revisionRoundId?: string;

  @ApiPropertyOptional({
    description: 'Revision round number',
    example: 2,
  })
  revisionRoundNumber?: number;

  @ApiProperty({
    description: 'Submission version label',
    example: 'V2',
  })
  versionLabel!: VersionLabel;

  @ApiProperty({
    description: 'Submission lifecycle status',
    enum: SUBMISSION_STATUSES,
    example: 'DRAFT',
  })
  status!: SubmissionStatus;

  @ApiPropertyOptional({
    description: 'Deadline timestamp for this submission version',
    example: '2026-04-10T16:59:59.000Z',
  })
  deadlineAt?: string;

  @ApiPropertyOptional({
    description: 'Confirm submit timestamp',
    example: '2026-04-05T09:30:00.000Z',
  })
  confirmedAt?: string;

  @ApiProperty({
    description: 'Whether this submission is locked immutable',
    example: false,
  })
  isLocked!: boolean;

  @ApiProperty({
    description: 'Whether student can replace the submission file now',
    example: true,
  })
  canReplace!: boolean;

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

  @ApiPropertyOptional({ description: 'Revision round number', example: 2 })
  revisionRoundNumber?: number;

  @ApiProperty({
    description: 'Submission version label',
    example: 'V2',
  })
  versionLabel!: VersionLabel;

  @ApiPropertyOptional({
    description: 'Google Drive file ID',
    example: 'drv_123abc',
  })
  driveFileId?: string;

  @ApiPropertyOptional({
    description: 'Submission deadline timestamp',
    example: '2026-04-10T16:59:59.000Z',
  })
  deadlineAt?: string;

  @ApiProperty({ description: 'Whether this submission can be replaced', example: true })
  canReplace!: boolean;
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
