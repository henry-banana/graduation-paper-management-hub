import {
  IsString,
  IsDateString,
  IsIn,
  IsNotEmpty,
  MaxLength,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PeriodType } from './period-response.dto';

export class CreatePeriodDto {
  @ApiProperty({ example: 'HK1-2026', description: 'Period code', maxLength: 50 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ enum: ['BCTT', 'KLTN'], example: 'BCTT' })
  @IsNotEmpty()
  @IsIn(['BCTT', 'KLTN'])
  type!: PeriodType;

  @ApiProperty({ example: '2026-02-01', description: 'Registration start date (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  openDate!: string;

  @ApiProperty({ example: '2026-02-10', description: 'Registration end date (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  closeDate!: string;

  @ApiPropertyOptional({ example: '2026-02-15', description: 'Submission start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  submitStartAt?: string;

  @ApiPropertyOptional({ example: '2026-05-15', description: 'Submission end date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  submitEndAt?: string;
}
