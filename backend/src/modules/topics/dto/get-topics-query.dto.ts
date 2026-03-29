import { IsOptional, IsIn, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';
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
    description: 'Filter by role context (e.g., my topics as student, as GVHD)',
    enum: ['student', 'supervisor', 'reviewer'],
  })
  @IsOptional()
  @IsIn(['student', 'supervisor', 'reviewer'])
  role?: 'student' | 'supervisor' | 'reviewer';

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
}
