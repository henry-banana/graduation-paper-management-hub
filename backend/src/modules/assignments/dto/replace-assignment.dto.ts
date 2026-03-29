import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class ReplaceAssignmentDto {
  @ApiProperty({
    description: 'User ID of the new assignee',
    example: 'USR_NEW_1',
  })
  @IsString()
  @IsNotEmpty()
  newUserId!: string;

  @ApiPropertyOptional({
    description: 'Reason for replacement',
    example: 'Original supervisor unavailable due to leave',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
