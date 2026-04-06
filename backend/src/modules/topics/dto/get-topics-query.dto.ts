import { IsOptional, IsIn, IsInt, Min, Max, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TopicType, TopicState } from '../topic-state.enum';

export class GetTopicsQueryDto {
  private static readonly TOPIC_STATES = [
    'DRAFT',
    'PENDING_GV',
    'CONFIRMED',
    'IN_PROGRESS',
    'PENDING_CONFIRM',
    'DEFENSE',
    'GRADING',
    'SCORING',
    'COMPLETED',
    'CANCELLED',
  ] as const;

  @ApiPropertyOptional({ enum: ['BCTT', 'KLTN'] })
  @IsOptional()
  @IsIn(['BCTT', 'KLTN'])
  type?: TopicType;

  @ApiPropertyOptional({
    enum: [
      'DRAFT',
      'PENDING_GV',
      'CONFIRMED',
      'IN_PROGRESS',
      'PENDING_CONFIRM',
      'DEFENSE',
      'GRADING',
      'SCORING',
      'COMPLETED',
      'CANCELLED',
    ],
  })
  @IsOptional()
  @IsIn(GetTopicsQueryDto.TOPIC_STATES)
  state?: TopicState;

  @ApiPropertyOptional({
    description:
      'Filter by multiple states (comma-separated or repeated query params)',
    enum: GetTopicsQueryDto.TOPIC_STATES,
    isArray: true,
    example: ['DEFENSE', 'SCORING'],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value
        .flatMap((item) => String(item).split(','))
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }

    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }

    return undefined;
  })
  @IsIn(GetTopicsQueryDto.TOPIC_STATES, { each: true })
  states?: TopicState[];

  @ApiPropertyOptional({
    description: 'Filter by role context',
    enum: ['student', 'supervisor', 'reviewer', 'gvhd', 'gvpb', 'tv_hd', 'ct_hd', 'tk_hd', 'tbm'],
  })
  @IsOptional()
  @IsIn(['student', 'supervisor', 'reviewer', 'gvhd', 'gvpb', 'tv_hd', 'ct_hd', 'tk_hd', 'tbm'])
  role?: 'student' | 'supervisor' | 'reviewer' | 'gvhd' | 'gvpb' | 'tv_hd' | 'ct_hd' | 'tk_hd' | 'tbm';

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

  @ApiPropertyOptional({ description: 'Sort field', example: 'createdAt' })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ description: 'Filter by period ID', example: 'period-bctt-now' })
  @IsOptional()
  @IsString()
  periodId?: string;

  @ApiPropertyOptional({ description: 'Filter by supervisor user ID' })
  @IsOptional()
  @IsString()
  supervisorUserId?: string;
}
