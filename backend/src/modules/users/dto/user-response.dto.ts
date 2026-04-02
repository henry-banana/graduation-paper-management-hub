import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountRole } from '../../../common/types';

export class UserResponseDto {
  @ApiProperty({ example: 'USR001' })
  id!: string;

  @ApiProperty({ example: 'student@hcmute.edu.vn' })
  email!: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName!: string;

  @ApiProperty({ enum: ['STUDENT', 'LECTURER', 'TBM'], example: 'STUDENT' })
  accountRole!: AccountRole;

  @ApiPropertyOptional({ example: '20110001' })
  studentId?: string;

  @ApiPropertyOptional({ example: 'GV001' })
  lecturerId?: string;

  @ApiPropertyOptional({ example: 'CNTT' })
  department?: string;

  @ApiPropertyOptional({ example: 120 })
  earnedCredits?: number;

  @ApiPropertyOptional({ example: 140 })
  requiredCredits?: number;

  @ApiPropertyOptional({ example: 7.25 })
  completedBcttScore?: number;

  @ApiPropertyOptional({ example: false })
  canRegisterKltn?: boolean;

  @ApiPropertyOptional({ example: 'INSUFFICIENT_CREDITS' })
  kltnEligibilityReason?: 'OK' | 'BCTT_INCOMPLETE' | 'BCTT_SCORE_TOO_LOW' | 'INSUFFICIENT_CREDITS';

  @ApiPropertyOptional({ example: 10 })
  totalQuota?: number;

  @ApiPropertyOptional({ example: 3 })
  quotaUsed?: number;

  @ApiPropertyOptional({ example: true })
  isActive?: boolean;
}

export class SupervisorOptionDto {
  @ApiProperty({ example: 'USR005' })
  id!: string;

  @ApiProperty({ example: 'gvhd@hcmute.edu.vn' })
  email!: string;

  @ApiProperty({ example: 'Tran Van B' })
  fullName!: string;

  @ApiPropertyOptional({ example: 'GV001' })
  lecturerId?: string;

  @ApiPropertyOptional({ example: 'CNTT' })
  department?: string;

  @ApiPropertyOptional({ example: 10 })
  totalQuota?: number;

  @ApiPropertyOptional({ example: 3 })
  quotaUsed?: number;
}

export class UserListResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  data!: UserResponseDto[];

  @ApiProperty({
    example: { page: 1, size: 20, total: 130 },
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

export class UserDetailResponseDto {
  @ApiProperty({ type: UserResponseDto })
  data!: UserResponseDto;

  @ApiProperty({ example: { requestId: 'req_123' } })
  meta!: {
    requestId: string;
  };
}
