import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TopicAction } from '../topic-state.enum';

export class ApproveTopicDto {
  @ApiPropertyOptional({ example: 'Approved with minor revisions' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class RejectTopicDto {
  @ApiPropertyOptional({ example: 'Topic scope is too broad' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SetDeadlineDto {
  @ApiProperty({ example: '2026-05-10T00:00:00Z' })
  @IsNotEmpty()
  @IsDateString()
  submitStartAt!: string;

  @ApiProperty({ example: '2026-05-20T23:59:59Z' })
  @IsNotEmpty()
  @IsDateString()
  submitEndAt!: string;

  @ApiPropertyOptional({
    enum: ['SET_OR_EXTEND', 'REOPEN'],
    default: 'SET_OR_EXTEND',
  })
  @IsOptional()
  @IsIn(['SET_OR_EXTEND', 'REOPEN'])
  action?: 'SET_OR_EXTEND' | 'REOPEN';
}

export class TransitionTopicDto {
  private static readonly TRANSITION_ACTIONS = [
    'SUBMIT_TO_GV',
    'APPROVE',
    'REJECT',
    'START_PROGRESS',
    'MOVE_TO_GRADING',
    'REQUEST_CONFIRM',
    'CONFIRM_DEFENSE',
    'START_SCORING',
    'COMPLETE',
    'CANCEL',
  ] as const;

  @ApiProperty({
    enum: [
      'SUBMIT_TO_GV',
      'APPROVE',
      'REJECT',
      'START_PROGRESS',
      'MOVE_TO_GRADING',
      'REQUEST_CONFIRM',
      'CONFIRM_DEFENSE',
      'START_SCORING',
      'COMPLETE',
      'CANCEL',
    ],
    example: 'MOVE_TO_GRADING',
  })
  @IsNotEmpty()
  @IsIn(TransitionTopicDto.TRANSITION_ACTIONS)
  action!: TopicAction;
}
