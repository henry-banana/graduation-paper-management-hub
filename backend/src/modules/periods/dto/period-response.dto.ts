import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type PeriodType = 'BCTT' | 'KLTN';
export type PeriodStatus = 'DRAFT' | 'OPEN' | 'CLOSED';

export class PeriodResponseDto {
  @ApiProperty({ example: 'prd_2026_hk1' })
  id!: string;

  @ApiProperty({ example: 'HK1-2026' })
  code!: string;

  @ApiPropertyOptional({ example: 'Đợt BCTT HK1 2026', description: 'Display name for the period' })
  name?: string;

  @ApiProperty({ enum: ['BCTT', 'KLTN'], example: 'BCTT' })
  type!: PeriodType;

  @ApiProperty({ example: '2026-02-01', description: 'Registration start date (openDate)' })
  openDate!: string;

  @ApiProperty({ example: '2026-02-10', description: 'Registration end date (closeDate)' })
  closeDate!: string;

  @ApiPropertyOptional({ example: '2026-02-15', description: 'Submission start date' })
  submitStartAt?: string;

  @ApiPropertyOptional({ example: '2026-05-15', description: 'Submission end date' })
  submitEndAt?: string;

  @ApiPropertyOptional({ example: 5, description: 'Default supervisor quota for this period' })
  supervisorQuota?: number;

  @ApiProperty({ enum: ['DRAFT', 'OPEN', 'CLOSED'], example: 'OPEN' })
  status!: PeriodStatus;

  @ApiPropertyOptional({ example: '2026-01-15T00:00:00.000Z' })
  createdAt?: string;

  @ApiPropertyOptional({ example: '2026-01-20T00:00:00.000Z' })
  updatedAt?: string;
}

export class PeriodListResponseDto {
  @ApiProperty({ type: [PeriodResponseDto] })
  data!: PeriodResponseDto[];

  @ApiProperty({
    example: { page: 1, size: 20, total: 4 },
  })
  pagination!: {
    page: number;
    size: number;
    total: number;
  };

  @ApiProperty({ example: { requestId: 'req_123' } })
  meta!: {
    requestId: string;
  };
}

export class PeriodDetailResponseDto {
  @ApiProperty({ type: PeriodResponseDto })
  data!: PeriodResponseDto;

  @ApiProperty({ example: { requestId: 'req_123' } })
  meta!: {
    requestId: string;
  };
}
