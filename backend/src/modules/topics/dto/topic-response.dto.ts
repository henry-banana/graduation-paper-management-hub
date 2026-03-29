import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TopicType, TopicState } from '../topic-state.enum';

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

  @ApiPropertyOptional({ example: '2026-01-15T00:00:00Z' })
  createdAt?: string;

  @ApiPropertyOptional({ example: '2026-01-20T00:00:00Z' })
  updatedAt?: string;
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
