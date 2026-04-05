import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

/**
 * DTO để Thư ký hội đồng cập nhật góp ý bổ sung của hội đồng
 */
export class UpdateCouncilCommentsDto {
  @ApiProperty({
    description: 'Góp ý bổ sung của hội đồng (do Thư ký nhập)',
    example: 'Cần bổ sung phần đánh giá hiệu năng của hệ thống. Kiến trúc tốt nhưng thiếu test cases.',
    maxLength: 2000,
  })
  @IsString()
  @MaxLength(2000)
  councilComments!: string;
}

export class CouncilCommentsResponseDto {
  @ApiProperty({ description: 'Topic ID' })
  topicId!: string;

  @ApiProperty({ description: 'Góp ý hội đồng đã được lưu' })
  councilComments!: string;

  @ApiProperty({ description: 'Thời gian cập nhật' })
  updatedAt!: string;
}
