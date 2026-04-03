import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmSubmissionDto {
  @ApiPropertyOptional({
    description: 'Optional student note when confirming submission',
    example: 'Em đã cập nhật theo góp ý mới nhất của GVHD',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ReplaceSubmissionDto {
  @ApiPropertyOptional({
    description: 'Optional note for replacement reason',
    example: 'Sửa lỗi chính tả và cập nhật tài liệu tham khảo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
