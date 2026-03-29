import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn } from 'class-validator';
import {
  SCORE_CONFIRM_ROLES,
  SCORE_SUMMARY_REQUEST_ROLES,
} from '../scores.constants';

export type SummaryRequestRole = (typeof SCORE_SUMMARY_REQUEST_ROLES)[number];
export type ConfirmScoreRole = (typeof SCORE_CONFIRM_ROLES)[number];

export class SubmitScoreDto {
  @ApiProperty({
    description: 'Confirmation to submit the score',
    example: true,
  })
  @IsBoolean()
  confirm!: boolean;
}

export class RequestSummaryDto {
  @ApiProperty({
    description: 'Role requesting the summary',
    enum: [...SCORE_SUMMARY_REQUEST_ROLES],
    example: 'TK_HD',
  })
  @IsIn([...SCORE_SUMMARY_REQUEST_ROLES])
  requestedByRole!: SummaryRequestRole;
}

export class ConfirmScoreDto {
  @ApiProperty({
    description: 'Role confirming the score',
    enum: [...SCORE_CONFIRM_ROLES],
    example: 'GVHD',
  })
  @IsIn([...SCORE_CONFIRM_ROLES])
  role!: ConfirmScoreRole;
}
