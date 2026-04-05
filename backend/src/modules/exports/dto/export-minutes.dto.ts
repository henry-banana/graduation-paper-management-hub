import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Body cho endpoint POST /exports/minutes/:topicId.
 *
 * Các trường này được hội đồng nhập vào lúc kết thúc buổi bảo vệ
 * trước khi xuất biên bản PDF. Backend sẽ merge chúng với dữ liệu
 * thật từ Schedules sheet (defenseAt, location) và ScoreSummaries.
 */
export class ExportMinutesDto {
  @ApiPropertyOptional({ description: 'Nhận xét của GVHD (nếu có)' })
  @IsOptional()
  @IsString()
  supervisorComments?: string;

  @ApiPropertyOptional({ description: 'Nhận xét của Chủ tịch hội đồng' })
  @IsOptional()
  @IsString()
  chairComments?: string;

  @ApiPropertyOptional({ description: 'Yêu cầu chỉnh sửa (nếu có)' })
  @IsOptional()
  @IsString()
  revisionRequirements?: string;

  @ApiPropertyOptional({
    description: 'Địa điểm bảo vệ (ghi đè nếu khác với lịch đã đặt)',
  })
  @IsOptional()
  @IsString()
  defenseLocation?: string;

  @ApiPropertyOptional({
    description: 'Hạn chỉnh sửa (ISO string hoặc chuỗi ngày VN)',
  })
  @IsOptional()
  @IsString()
  revisionDeadline?: string;
}
