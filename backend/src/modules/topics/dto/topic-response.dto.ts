import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TopicType, TopicState } from '../topic-state.enum';

export class TopicPersonDto {
  @ApiProperty({ example: 'usr_123' })
  id!: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName!: string;

  @ApiPropertyOptional({ example: '20123456' })
  studentId?: string;
}

export class TopicPeriodDto {
  @ApiProperty({ example: 'HK241' })
  code!: string;
}

export class TopicLatestSubmissionDto {
  @ApiProperty({ example: 'sub_123' })
  id!: string;

  @ApiProperty({ example: 'https://drive.google.com/file/d/abc123/view' })
  driveLink!: string;

  @ApiProperty({ example: 2 })
  version!: number;
}

export class TopicScoresDto {
  @ApiPropertyOptional({ example: 8.2, nullable: true })
  gvhd!: number | null;

  @ApiPropertyOptional({ example: 7.8, nullable: true })
  gvpb!: number | null;

  @ApiPropertyOptional({ example: 8.0, nullable: true })
  councilAvg!: number | null;

  @ApiPropertyOptional({ example: 8.0, nullable: true })
  council!: number | null;

  @ApiPropertyOptional({ example: 8.0, nullable: true })
  final!: number | null;

  @ApiPropertyOptional({ example: true })
  isReady!: boolean;

  @ApiPropertyOptional({ example: true })
  isSummarized!: boolean;

  @ApiPropertyOptional({ example: true })
  gvhdConfirmed!: boolean;

  @ApiPropertyOptional({ example: true })
  ctHdConfirmed!: boolean;

  @ApiPropertyOptional({ example: true })
  published!: boolean;
}

export class TopicResponseDto {
  @ApiProperty({ example: 'tp_123' })
  id!: string;

  @ApiProperty({ enum: ['BCTT', 'KLTN'], example: 'BCTT' })
  type!: TopicType;

  @ApiProperty({ example: 'AI assistant for thesis workflow' })
  title!: string;

  @ApiProperty({ example: 'Software Engineering' })
  domain!: string;

  @ApiPropertyOptional({ example: 'ABC Co' })
  companyName?: string;

  @ApiProperty({ example: 'PENDING_GV' })
  state!: TopicState;

  @ApiProperty({ example: 'usr_student_1' })
  studentUserId!: string;

  @ApiProperty({ example: 'usr_gvhd_1' })
  supervisorUserId!: string;

  @ApiProperty({ example: 'prd_2026_hk1' })
  periodId!: string;

  @ApiPropertyOptional({ example: '2026-05-10T00:00:00Z' })
  approvalDeadlineAt?: string;

  @ApiPropertyOptional({ example: '2026-05-10T00:00:00Z' })
  submitStartAt?: string;

  @ApiPropertyOptional({ example: '2026-05-20T23:59:59Z' })
  submitEndAt?: string;

  @ApiPropertyOptional({ example: 'Topic scope is too broad' })
  reasonRejected?: string;

  /** DB-06 fix: was `string?` — semantically a boolean flag */
  @ApiPropertyOptional({ example: true })
  revisionsAllowed?: boolean;

  @ApiPropertyOptional({ example: '2026-01-15T00:00:00Z' })
  createdAt?: string;

  @ApiPropertyOptional({ example: '2026-01-20T00:00:00Z' })
  updatedAt?: string;

  @ApiProperty({ type: TopicPersonDto })
  student!: TopicPersonDto;

  @ApiPropertyOptional({ type: TopicPersonDto })
  supervisor?: TopicPersonDto;

  @ApiPropertyOptional({ type: TopicPersonDto })
  reviewer?: TopicPersonDto;

  @ApiProperty({ type: TopicPeriodDto })
  period!: TopicPeriodDto;

  @ApiProperty({ type: TopicLatestSubmissionDto })
  latestSubmission!: TopicLatestSubmissionDto;

  @ApiPropertyOptional({ type: TopicLatestSubmissionDto })
  latestReportSubmission?: TopicLatestSubmissionDto;

  @ApiPropertyOptional({ type: TopicLatestSubmissionDto })
  latestTurnitinSubmission?: TopicLatestSubmissionDto;

  @ApiProperty({ type: TopicScoresDto })
  scores!: TopicScoresDto;

  @ApiPropertyOptional({ enum: ['TV_HD', 'TK_HD', 'CT_HD'] })
  councilRole?: 'TV_HD' | 'TK_HD' | 'CT_HD';

  @ApiPropertyOptional({ example: false })
  isPublished?: boolean;

  @ApiPropertyOptional({ example: 'https://drive.google.com/file/d/minutes123/view' })
  councilMinutesLink?: string;
}

export class TopicListResponseDto {
  @ApiProperty({ type: [TopicResponseDto] })
  data!: TopicResponseDto[];

  @ApiProperty({
    example: { page: 1, size: 20, total: 57 },
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

export class TopicDetailResponseDto {
  @ApiProperty({ type: TopicResponseDto })
  data!: TopicResponseDto;

  @ApiProperty({ example: { requestId: 'req_123' } })
  meta!: {
    requestId: string;
  };
}

export class TopicCreateResponseDto {
  @ApiProperty({ example: { id: 'tp_123', state: 'PENDING_GV' } })
  data!: {
    id: string;
    state: TopicState;
  };

  @ApiProperty({ example: { requestId: 'req_123' } })
  meta!: {
    requestId: string;
  };
}

export class TopicTransitionResponseDto {
  @ApiProperty({ example: { fromState: 'IN_PROGRESS', toState: 'GRADING' } })
  data!: {
    fromState: TopicState;
    toState: TopicState;
  };

  @ApiProperty({ example: { requestId: 'req_123' } })
  meta!: {
    requestId: string;
  };
}
