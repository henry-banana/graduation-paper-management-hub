import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  IsArray,
  IsString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetNotificationsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by read status',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isRead?: boolean;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Page size',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  size?: number = 20;
}

export class MarkReadDto {
  @ApiProperty({
    description: 'Mark as read or unread',
    example: true,
  })
  @IsBoolean()
  isRead!: boolean;
}

export class MarkBulkReadDto {
  @ApiProperty({
    description: 'List of notification IDs to mark as read',
    example: ['nt_001', 'nt_002'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  notificationIds!: string[];
}
