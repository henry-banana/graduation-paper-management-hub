import { IsOptional, IsDateString, MaxLength, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePeriodDto {
  @ApiPropertyOptional({ example: 'HK1-2026-Updated', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ example: '2026-02-02', description: 'Registration start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  openDate?: string;

  @ApiPropertyOptional({ example: '2026-02-12', description: 'Registration end date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  closeDate?: string;

  @ApiPropertyOptional({ example: '2026-02-15', description: 'Submission start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  submitStartAt?: string;

  @ApiPropertyOptional({ example: '2026-05-15', description: 'Submission end date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  submitEndAt?: string;
}
