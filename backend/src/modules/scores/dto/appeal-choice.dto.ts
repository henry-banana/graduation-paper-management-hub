import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

/**
 * Choice sinh viên đưa ra sau khi xem điểm published
 */
export type AppealChoice = 'NO_APPEAL' | 'ACCEPT';

export class SubmitAppealChoiceDto {
  @ApiProperty({
    description: 'Lựa chọn của sinh viên về việc phúc khảo',
    enum: ['NO_APPEAL', 'ACCEPT'],
    example: 'NO_APPEAL',
    required: true,
  })
  @IsString()
  @IsIn(['NO_APPEAL', 'ACCEPT'])
  choice!: AppealChoice;
}

export class AppealChoiceResponseDto {
  @ApiProperty({
    description: 'Choice đã được ghi nhận',
    enum: ['NO_APPEAL', 'ACCEPT'],
    example: 'NO_APPEAL',
  })
  choice!: AppealChoice;

  @ApiProperty({
    description: 'Message cho sinh viên',
    example: 'Bạn đã chấp nhận điểm. Hệ thống đang tự động hoàn tất đề tài và upload phiếu chấm điểm.',
  })
  message!: string;

  @ApiProperty({
    description: 'Trạng thái topic sau khi xử lý (chỉ có khi NO_APPEAL)',
    example: 'COMPLETED',
    required: false,
  })
  topicState?: string;

  @ApiProperty({
    description: 'Link xem rubric trên Google Drive (chỉ có khi NO_APPEAL)',
    example: 'https://drive.google.com/file/d/ABCXYZ/view',
    required: false,
  })
  rubricLink?: string;
}
