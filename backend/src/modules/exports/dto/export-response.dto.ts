import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ExportType = 'RUBRIC_BCTT' | 'RUBRIC_KLTN' | 'SCORE_SHEET' | 'TOPIC_LIST' | 'MINUTES';
export type ExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export class ExportResponseDto {
  @ApiProperty({ example: 'exp_abc123' })
  id!: string;

  @ApiProperty({ example: 'tp_001' })
  topicId!: string;

  @ApiProperty({
    enum: ['RUBRIC_BCTT', 'RUBRIC_KLTN', 'SCORE_SHEET', 'TOPIC_LIST', 'MINUTES'],
    example: 'MINUTES',
  })
  exportType!: ExportType;

  @ApiProperty({
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
    example: 'COMPLETED',
  })
  status!: ExportStatus;

  @ApiPropertyOptional({ example: 'https://storage.example.com/exports/rubric.xlsx' })
  downloadUrl?: string;

  @ApiPropertyOptional({ example: 'drv_abc123' })
  driveFileId?: string;

  @ApiPropertyOptional({ example: 'https://drive.google.com/file/d/drv_abc123/view' })
  driveLink?: string;

  @ApiPropertyOptional({ example: 'rubric_bctt_tp001.xlsx' })
  fileName?: string;

  @ApiPropertyOptional({ example: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  mimeType?: string;

  @ApiPropertyOptional({ example: 'Processing failed due to missing data' })
  errorMessage?: string;

  @ApiProperty({ example: 'USR001' })
  requestedBy!: string;

  @ApiProperty({ example: '2026-06-15T10:00:00Z' })
  createdAt!: string;

  @ApiPropertyOptional({ example: '2026-06-15T10:02:00Z' })
  completedAt?: string;

  @ApiPropertyOptional({ example: '2026-06-15T11:00:00Z' })
  expiresAt?: string;
}
