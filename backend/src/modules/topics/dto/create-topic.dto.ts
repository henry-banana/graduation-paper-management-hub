import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TopicType } from '../topic-state.enum';

export class CreateTopicDto {
  @ApiProperty({ enum: ['BCTT', 'KLTN'], example: 'BCTT' })
  @IsNotEmpty()
  @IsIn(['BCTT', 'KLTN'])
  type!: TopicType;

  @ApiProperty({ example: 'AI assistant for thesis workflow', maxLength: 200 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'Software Engineering', maxLength: 100 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  domain!: string;

  @ApiProperty({ example: 'prd_2026_hk1' })
  @IsNotEmpty()
  @IsString()
  periodId!: string;

  @ApiProperty({ example: 'usr_gvhd_1' })
  @IsNotEmpty()
  @IsString()
  supervisorUserId!: string;

  @ApiPropertyOptional({ example: 'ABC Co', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyName?: string;
}
