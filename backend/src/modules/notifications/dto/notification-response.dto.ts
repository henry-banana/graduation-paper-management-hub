import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type NotificationType =
  | 'TOPIC_APPROVED'
  | 'TOPIC_REJECTED'
  | 'TOPIC_PENDING'
  | 'DEADLINE_SET'
  | 'DEADLINE_REMINDER'
  | 'DEADLINE_OVERDUE'
  | 'REVISION_ROUND_OPENED'
  | 'REVISION_ROUND_CLOSED'
  | 'SUBMISSION_UPLOADED'
  | 'SUBMISSION_CONFIRMED'
  | 'SCORE_SUBMITTED'
  | 'SCORE_PUBLISHED'
  | 'SCORE_APPEAL_REQUESTED'
  | 'SCORE_APPEAL_RESOLVED'
  | 'ASSIGNMENT_ADDED'
  | 'SYSTEM'
  | 'GENERAL';

export type NotificationScope = 'PERSONAL' | 'GLOBAL';

export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification ID', example: 'nt_001' })
  id!: string;

  @ApiProperty({
    description: 'User ID of the receiver. GLOBAL notifications can use COMMON.',
    example: 'USR001',
  })
  receiverUserId!: string;

  @ApiProperty({
    description: 'Notification audience scope',
    enum: ['PERSONAL', 'GLOBAL'],
    example: 'PERSONAL',
  })
  scope!: NotificationScope;

  @ApiPropertyOptional({
    description: 'Related topic ID',
    example: 'tp_001',
  })
  topicId?: string;

  @ApiProperty({
    description: 'Notification type',
    enum: [
      'TOPIC_APPROVED',
      'TOPIC_REJECTED',
      'TOPIC_PENDING',
      'DEADLINE_SET',
      'DEADLINE_REMINDER',
      'DEADLINE_OVERDUE',
      'REVISION_ROUND_OPENED',
      'REVISION_ROUND_CLOSED',
      'SUBMISSION_UPLOADED',
      'SUBMISSION_CONFIRMED',
      'SCORE_SUBMITTED',
      'SCORE_PUBLISHED',
      'SCORE_APPEAL_REQUESTED',
      'SCORE_APPEAL_RESOLVED',
      'ASSIGNMENT_ADDED',
      'SYSTEM',
      'GENERAL',
    ],
    example: 'TOPIC_APPROVED',
  })
  type!: NotificationType;

  @ApiProperty({
    description: 'Notification title',
    example: 'Topic approved',
  })
  title!: string;

  @ApiPropertyOptional({
    description: 'Notification body/message',
    example: 'Your topic "KLTN - AI Research" has been approved by GVHD.',
  })
  body?: string;

  @ApiPropertyOptional({
    description: 'Deep link to navigate to related content',
    example: '/topics/tp_001',
  })
  deepLink?: string;

  @ApiProperty({
    description: 'Whether notification has been read',
    example: false,
  })
  isRead!: boolean;

  @ApiProperty({
    description: 'When notification was created',
    example: '2026-06-15T10:00:00Z',
  })
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'When notification was read',
    example: '2026-06-15T10:30:00Z',
  })
  readAt?: string;
}
