import { IsOptional, IsDateString, MaxLength, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePeriodDto {
  @ApiPropertyOptional({ example: 'HK1-2026-Updated', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ example: '2026-02-02', description: 'Open date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  openDate?: string;

  @ApiPropertyOptional({ example: '2026-02-12', description: 'Close date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  closeDate?: string;
}
