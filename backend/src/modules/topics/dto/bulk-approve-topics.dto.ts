import { IsArray, IsNotEmpty, IsOptional, IsString, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkApproveTopicsDto {
  @ApiProperty({
    description: 'Array of topic IDs to approve',
    example: ['tp_001', 'tp_002', 'tp_003'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one topic ID is required' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  topicIds!: string[];

  @ApiProperty({
    description: 'Optional note for all approvals',
    example: 'Bulk approved topics for period HK1-2024',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class BulkApproveResultDto {
  @ApiProperty({
    description: 'Successfully approved topic IDs',
    type: [String],
  })
  succeeded!: string[];

  @ApiProperty({
    description: 'Failed approvals with reasons',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  failed!: Record<string, string>;

  @ApiProperty({
    description: 'Total count',
  })
  total!: number;

  @ApiProperty({
    description: 'Success count',
  })
  successCount!: number;

  @ApiProperty({
    description: 'Failure count',
  })
  failureCount!: number;
}
