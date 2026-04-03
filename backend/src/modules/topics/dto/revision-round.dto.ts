import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { RevisionRoundStatus } from '../../../infrastructure/google-sheets';

export class CreateRevisionRoundDto {
  @ApiProperty({
    description: 'Round start timestamp (ISO-8601)',
    example: '2026-04-01T08:00:00.000Z',
  })
  @IsDateString()
  startAt!: string;

  @ApiProperty({
    description: 'Round end timestamp (ISO-8601)',
    example: '2026-04-10T16:59:59.000Z',
  })
  @IsDateString()
  endAt!: string;

  @ApiPropertyOptional({
    description: 'Reason for opening this revision round',
    example: 'Hội đồng yêu cầu chỉnh sửa chương 3 và 4',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CloseRevisionRoundDto {
  @ApiPropertyOptional({
    description: 'Reason for closing this revision round',
    example: 'Đã hoàn tất vòng chỉnh sửa',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RevisionRoundResponseDto {
  @ApiProperty({ description: 'Revision round ID', example: 'rr_ab12cd34ef56' })
  id!: string;

  @ApiProperty({ description: 'Related topic ID', example: 'tp_001' })
  topicId!: string;

  @ApiProperty({ description: 'Round number', example: 2 })
  roundNumber!: number;

  @ApiProperty({ enum: ['OPEN', 'CLOSED'], example: 'OPEN' })
  status!: RevisionRoundStatus;

  @ApiProperty({ description: 'Round start timestamp', example: '2026-04-01T08:00:00.000Z' })
  startAt!: string;

  @ApiProperty({ description: 'Round end timestamp', example: '2026-04-10T16:59:59.000Z' })
  endAt!: string;

  @ApiProperty({ description: 'Actor who opened the round', example: 'USR_TBM_001' })
  requestedBy!: string;

  @ApiPropertyOptional({ description: 'Reason for opening/closing round' })
  reason?: string;

  @ApiProperty({ description: 'Created at timestamp', example: '2026-03-30T09:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ description: 'Updated at timestamp', example: '2026-03-30T09:30:00.000Z' })
  updatedAt!: string;
}

export class RevisionRoundActionResponseDto {
  @ApiProperty({ description: 'Revision round ID', example: 'rr_ab12cd34ef56' })
  id!: string;

  @ApiProperty({ enum: ['OPEN', 'CLOSED'], example: 'OPEN' })
  status!: RevisionRoundStatus;
}
