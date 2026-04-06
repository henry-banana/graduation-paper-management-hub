import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SCORE_RESULTS,
  SCORE_SCORER_ROLES,
  SCORE_STATUSES,
} from '../scores.constants';
import { ScoreAppealInfoDto } from './score-appeal.dto';

export type ScorerRole = (typeof SCORE_SCORER_ROLES)[number];
export type ScoreStatus = (typeof SCORE_STATUSES)[number];
export type ScoreResult = (typeof SCORE_RESULTS)[number];

export interface RubricItem {
  criterion: string;
  score: number;
  max: number;
  note?: string;
}

export class ScoreResponseDto {
  @ApiProperty({ description: 'Score ID', example: 'sc_001' })
  id!: string;

  @ApiProperty({ description: 'Topic ID', example: 'tp_001' })
  topicId!: string;

  @ApiProperty({
    description: 'User ID of the scorer',
    example: 'USR002',
  })
  scorerUserId!: string;

  @ApiProperty({
    description: 'Role of the scorer',
    enum: [...SCORE_SCORER_ROLES],
    example: 'GVHD',
  })
  scorerRole!: ScorerRole;

  @ApiProperty({
    description: 'Score status',
    enum: [...SCORE_STATUSES],
    example: 'DRAFT',
  })
  status!: ScoreStatus;

  @ApiProperty({
    description: 'Total score calculated from rubric',
    example: 8.5,
  })
  totalScore!: number;

  @ApiPropertyOptional({
    description: 'Rubric data (detailed breakdown)',
    example: [{ criterion: 'quality', score: 2.0, max: 2.5, note: 'good' }],
  })
  rubricData?: RubricItem[];

  @ApiPropertyOptional({
    description: 'When the score was submitted',
    example: '2026-06-15T14:30:00Z',
  })
  submittedAt?: string;

  @ApiProperty({
    description: 'Last updated timestamp',
    example: '2026-06-15T14:30:00Z',
  })
  updatedAt!: string;
}

export class ScoreSummaryDto {
  @ApiPropertyOptional({
    description: 'Score from GVHD',
    example: 8.2,
  })
  gvhdScore?: number;

  @ApiPropertyOptional({
    description: 'Score from GVPB',
    example: 8.4,
  })
  gvpbScore?: number;

  @ApiPropertyOptional({
    description: 'Average score from council members',
    example: 8.6,
  })
  councilAvgScore?: number;

  @ApiProperty({
    description: 'Final calculated score',
    example: 8.4,
  })
  finalScore!: number;

  @ApiProperty({
    description: 'Result: PASS or FAIL',
    enum: [...SCORE_RESULTS],
    example: 'PASS',
  })
  result!: ScoreResult;

  @ApiProperty({
    description: 'Whether GVHD confirmed the score',
    example: true,
  })
  confirmedByGvhd!: boolean;

  @ApiProperty({
    description: 'Whether council chair confirmed the score',
    example: true,
  })
  confirmedByCtHd!: boolean;

  @ApiProperty({
    description: 'Whether score is published to student',
    example: false,
  })
  published!: boolean;

  @ApiPropertyOptional({
    description: 'Link DOCX phiếu chấm BCTT đã xuất gần nhất',
    example: 'https://drive.google.com/file/d/abc123/view',
  })
  rubricDocxLink?: string;

  @ApiPropertyOptional({
    description: 'Link DOCX phiếu chấm GVHD (KLTN)',
    example: 'https://drive.google.com/file/d/abc123/view',
  })
  gvhdRubricLink?: string;

  @ApiPropertyOptional({
    description: 'Link DOCX phiếu chấm GVPB (KLTN)',
    example: 'https://drive.google.com/file/d/abc123/view',
  })
  gvpbRubricLink?: string;

  @ApiPropertyOptional({
    description: 'Link DOCX phiếu chấm Hội đồng (KLTN)',
    example: 'https://drive.google.com/file/d/abc123/view',
  })
  councilRubricLink?: string;

  @ApiPropertyOptional({
    description: 'Link PDF biên bản bảo vệ (KLTN)',
    example: 'https://drive.google.com/file/d/abc123/view',
  })
  minutesLink?: string;

  @ApiPropertyOptional({
    description: 'Thông tin phúc khảo điểm (BCTT)',
    type: ScoreAppealInfoDto,
  })
  appeal?: ScoreAppealInfoDto;

  @ApiPropertyOptional({
    description: 'Lựa chọn phúc khảo của sinh viên sau khi điểm được công bố',
    enum: ['NO_APPEAL', 'ACCEPT'],
    example: 'NO_APPEAL',
  })
  appealChoice?: 'NO_APPEAL' | 'ACCEPT';

  @ApiPropertyOptional({
    description: 'Thời điểm sinh viên chọn phúc khảo/không phúc khảo',
    example: '2026-04-05T08:15:00.000Z',
  })
  appealChoiceAt?: string;

  @ApiPropertyOptional({
    description: 'True if TK_HD has completed aggregation (locks all editing)',
    example: false,
  })
  aggregatedByTkHd?: boolean;

  @ApiPropertyOptional({
    description: 'Timestamp when TK_HD completed aggregation',
    example: '2026-04-05T10:30:00.000Z',
  })
  aggregatedByTkHdAt?: string;

  @ApiPropertyOptional({
    description: 'User ID of TK_HD who performed aggregation',
    example: 'user_123',
  })
  aggregatedByTkHdUserId?: string;
}

export class DraftScoreResponseDto {
  @ApiProperty({ description: 'Score ID', example: 'sc_001' })
  scoreId!: string;

  @ApiProperty({
    description: 'Score status',
    enum: [...SCORE_STATUSES],
    example: 'DRAFT',
  })
  status!: ScoreStatus;

  @ApiProperty({
    description: 'Total score',
    example: 8.5,
  })
  totalScore!: number;
}

export class SubmitScoreResponseDto {
  @ApiProperty({ description: 'Score ID', example: 'sc_001' })
  scoreId!: string;

  @ApiProperty({
    description: 'Score status',
    example: 'SUBMITTED',
  })
  status!: ScoreStatus;
}

export class ConfirmScoreResponseDto {
  @ApiProperty({
    description: 'Whether confirmation was successful',
    example: true,
  })
  confirmed!: boolean;

  @ApiProperty({
    description: 'Whether score is now published to student',
    example: false,
  })
  published!: boolean;
}
