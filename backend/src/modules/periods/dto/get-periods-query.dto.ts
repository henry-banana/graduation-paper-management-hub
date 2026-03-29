import { IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PeriodType, PeriodStatus } from './period-response.dto';

export class GetPeriodsQueryDto {
  @ApiPropertyOptional({ enum: ['BCTT', 'KLTN'] })
  @IsOptional()
  @IsIn(['BCTT', 'KLTN'])
  type?: PeriodType;

  @ApiPropertyOptional({ enum: ['DRAFT', 'OPEN', 'CLOSED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'OPEN', 'CLOSED'])
  status?: PeriodStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number = 20;
}
