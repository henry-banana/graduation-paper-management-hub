import { ApiProperty } from '@nestjs/swagger';
import { TopicRole } from '../../../common/types';

export type AssignmentStatus = 'ACTIVE' | 'REVOKED';

export class AssignmentResponseDto {
  @ApiProperty({ description: 'Assignment ID', example: 'as_001' })
  id!: string;

  @ApiProperty({ description: 'Topic ID', example: 'tp_001' })
  topicId!: string;

  @ApiProperty({
    description: 'User ID of the assigned person',
    example: 'USR001',
  })
  userId!: string;

  @ApiProperty({
    description: 'Role in topic context',
    enum: ['GVHD', 'GVPB', 'CT_HD', 'TK_HD', 'TV_HD'],
    example: 'GVHD',
  })
  topicRole!: TopicRole;

  @ApiProperty({
    description: 'Assignment status',
    enum: ['ACTIVE', 'REVOKED'],
    example: 'ACTIVE',
  })
  status!: AssignmentStatus;

  @ApiProperty({
    description: 'When the assignment was created',
    example: '2026-01-15T10:00:00Z',
  })
  assignedAt!: string;

  @ApiProperty({
    description: 'When the assignment was revoked (if applicable)',
    example: '2026-02-01T10:00:00Z',
    required: false,
  })
  revokedAt?: string;
}
