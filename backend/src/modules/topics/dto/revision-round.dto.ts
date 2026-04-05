import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { RevisionRoundStatus, RevisionApprovalStatus } from '../../../infrastructure/google-sheets';

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

export class ApproveRevisionDto {
  @ApiPropertyOptional({
    description: 'Comments from approver',
    example: 'Đã chỉnh sửa đầy đủ theo yêu cầu',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comments?: string;
}

export class RejectRevisionDto {
  @ApiProperty({
    description: 'Reason for rejection',
    example: 'Chưa chỉnh sửa đúng góp ý tại mục 3.2',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  reason!: string;
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

  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'REJECTED'], description: 'GVHD approval status' })
  gvhdApprovalStatus?: RevisionApprovalStatus;

  @ApiPropertyOptional({ description: 'GVHD approved at timestamp' })
  gvhdApprovedAt?: string;

  @ApiPropertyOptional({ description: 'GVHD comments' })
  gvhdComments?: string;

  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'REJECTED'], description: 'CT_HD approval status' })
  ctHdApprovalStatus?: RevisionApprovalStatus;

  @ApiPropertyOptional({ description: 'CT_HD approved at timestamp' })
  ctHdApprovedAt?: string;

  @ApiPropertyOptional({ description: 'CT_HD comments' })
  ctHdComments?: string;
}

export class RevisionRoundActionResponseDto {
  @ApiProperty({ description: 'Revision round ID', example: 'rr_ab12cd34ef56' })
  id!: string;

  @ApiProperty({ enum: ['OPEN', 'CLOSED'], example: 'OPEN' })
  status!: RevisionRoundStatus;
}

export class RevisionApprovalResponseDto {
  @ApiProperty({ description: 'Revision round ID' })
  roundId!: string;

  @ApiProperty({ enum: ['GVHD', 'CT_HD'], description: 'Approver role' })
  role!: 'GVHD' | 'CT_HD';

  @ApiProperty({ enum: ['APPROVED', 'REJECTED'], description: 'Approval decision' })
  decision!: 'APPROVED' | 'REJECTED';

  @ApiProperty({ description: 'Approved at timestamp' })
  approvedAt!: string;

  @ApiPropertyOptional({ description: 'Comments' })
  comments?: string;
}
