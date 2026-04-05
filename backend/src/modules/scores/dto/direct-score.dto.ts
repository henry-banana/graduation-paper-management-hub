import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { SCORE_SCORER_ROLES } from '../scores.constants';
import { ScorerRole } from './score-response.dto';

/**
 * DTO for the simplified "direct" score submission endpoints.
 * Accepts a flat criteria map (e.g. { attitude: 2.0, content: 5.5 })
 * instead of the full rubricData array, to match the frontend UI.
 */
export class DirectScoreDto {
  @ApiProperty({
    description: 'Role of the scorer',
    enum: [...SCORE_SCORER_ROLES],
    example: 'GVHD',
  })
  @IsIn([...SCORE_SCORER_ROLES])
  role!: ScorerRole;

  @ApiProperty({
    description: 'Flat map of criterion id → score value',
    example: { attitude: 1.5, presentation: 1.8, content: 5.0 },
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  @IsObject()
  criteria!: Record<string, number>;

  @ApiPropertyOptional({
    description: 'Optional Turnitin link (GVHD only)',
    example: 'https://turnitin.com/...',
  })
  @IsOptional()
  @IsString()
  turnitinLink?: string;

  @ApiPropertyOptional({
    description: 'General comments',
    example: 'Bài làm tốt, cần cải thiện phần trình bày.',
  })
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiPropertyOptional({
    description: 'Review questions (GVPB only)',
    example: 'Tại sao chọn thuật toán X?',
  })
  @IsOptional()
  @IsString()
  questions?: string;
}

export interface MyDraftResponseDto {
  scoreId?: string;
  criteria: Record<string, number>;
  turnitinLink?: string;
  comments?: string;
  questions?: string;
  isSubmitted: boolean;
  isLocked: boolean;
  lockReason?: string;
  totalScore: number;
}
