import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateTitleDto {
  @ApiProperty({
    description: 'Tên đề tài mới',
    example: 'Hệ thống quản lý đề tài KLTN (Cập nhật)',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty({ message: 'Tên đề tài không được để trống' })
  @MaxLength(255, { message: 'Tên đề tài không được vượt quá 255 ký tự' })
  title!: string;
}

export class UpdateTitleResponseDto {
  @ApiProperty({ description: 'Topic ID' })
  id!: string;

  @ApiProperty({ description: 'Tên đề tài mới' })
  title!: string;

  @ApiProperty({ description: 'Thời gian cập nhật' })
  updatedAt!: string;
}
