import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export type ScoreAppealStatus = 'PENDING' | 'RESOLVED';

export class RequestScoreAppealDto {
  @ApiProperty({
    description: 'Lý do phúc khảo điểm (chỉ được gửi 1 lần)',
    example: 'Em mong thầy/cô xem lại mục nội dung chuyên môn vì có phần minh chứng chưa được tính.',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;
}

export class ResolveScoreAppealDto {
  @ApiPropertyOptional({
    description:
      'Ghi chú phản hồi khi kết thúc phúc khảo (dùng khi GVHD giữ nguyên điểm hoặc bổ sung giải thích)',
    example: 'Đã rà soát lại rubric và giữ nguyên điểm.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNote?: string;
}

export class ScoreAppealInfoDto {
  @ApiPropertyOptional({ description: 'Thời điểm gửi phúc khảo', example: '2026-04-05T13:15:00.000Z' })
  requestedAt?: string;

  @ApiPropertyOptional({ description: 'Người gửi phúc khảo', example: 'USR_STUDENT_001' })
  requestedBy?: string;

  @ApiPropertyOptional({ description: 'Lý do phúc khảo', example: 'Em mong thầy/cô xem lại mục nội dung chuyên môn.' })
  reason?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái xử lý phúc khảo',
    enum: ['PENDING', 'RESOLVED'],
    example: 'PENDING',
  })
  status?: ScoreAppealStatus;

  @ApiPropertyOptional({ description: 'Thời điểm GVHD xử lý xong', example: '2026-04-06T08:00:00.000Z' })
  resolvedAt?: string;

  @ApiPropertyOptional({ description: 'Người xử lý phúc khảo', example: 'USR_GVHD_001' })
  resolvedBy?: string;

  @ApiPropertyOptional({ description: 'Ghi chú phản hồi của GVHD', example: 'Đã rà soát lại rubric và giữ nguyên điểm.' })
  resolutionNote?: string;

  @ApiPropertyOptional({
    description: 'Điểm cuối có thay đổi sau khi xử lý phúc khảo hay không',
    example: false,
  })
  scoreAdjusted?: boolean;
}

export class RequestScoreAppealResponseDto {
  @ApiProperty({ description: 'Trạng thái phúc khảo sau khi gửi', enum: ['PENDING'], example: 'PENDING' })
  status!: 'PENDING';

  @ApiProperty({ description: 'Thời điểm gửi phúc khảo', example: '2026-04-05T13:15:00.000Z' })
  requestedAt!: string;
}

export class ResolveScoreAppealResponseDto {
  @ApiProperty({ description: 'Trạng thái phúc khảo sau khi xử lý', enum: ['RESOLVED'], example: 'RESOLVED' })
  status!: 'RESOLVED';

  @ApiProperty({ description: 'Thời điểm xử lý xong', example: '2026-04-06T08:00:00.000Z' })
  resolvedAt!: string;

  @ApiProperty({
    description: 'Điểm cuối có thay đổi sau khi xử lý phúc khảo hay không',
    example: true,
  })
  scoreAdjusted!: boolean;
}
