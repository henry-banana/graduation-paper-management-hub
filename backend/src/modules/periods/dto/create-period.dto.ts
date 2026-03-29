import {
  IsString,
  IsDateString,
  IsIn,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
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

  @ApiProperty({ example: '2026-02-01', description: 'Open date (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  openDate!: string;

  @ApiProperty({ example: '2026-02-10', description: 'Close date (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  closeDate!: string;
}
