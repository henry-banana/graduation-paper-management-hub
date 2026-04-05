import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class SendPersonalNotificationDto {
  @ApiProperty({
    description: 'Receiver user ID',
    example: 'USR001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  receiverUserId!: string;

  @ApiPropertyOptional({
    description: 'Related topic ID (required for non-TBM sender)',
    example: 'tp_001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  topicId?: string;

  @ApiPropertyOptional({
    description: 'Notification type for manual send',
    enum: ['GENERAL', 'SYSTEM'],
    default: 'GENERAL',
  })
  @IsOptional()
  @IsIn(['GENERAL', 'SYSTEM'])
  type?: 'GENERAL' | 'SYSTEM';

  @ApiPropertyOptional({
    description: 'Custom title override',
    example: 'Nhắc việc chỉnh sửa báo cáo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({
    description: 'Notification message body',
    example: 'Vui lòng cập nhật chương 3 trước 17:00 hôm nay.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body!: string;

  @ApiPropertyOptional({
    description: 'Optional in-app deep link. Must be a relative path.',
    example: '/gvhd/topics/tp_001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^\/.+$/, { message: 'deepLink must start with /' })
  deepLink?: string;
}
