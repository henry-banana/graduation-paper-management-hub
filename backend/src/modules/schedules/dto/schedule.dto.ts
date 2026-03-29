import {
  IsString,
  IsDateString,
  IsEnum,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type LocationType = 'ONLINE' | 'OFFLINE';

export class CreateScheduleDto {
  @ApiProperty({ description: 'Defense date and time (ISO 8601)', example: '2026-06-20T08:00:00Z' })
  @IsDateString()
  defenseAt!: string;

  @ApiProperty({ enum: ['ONLINE', 'OFFLINE'], description: 'Location type' })
  @IsEnum(['ONLINE', 'OFFLINE'])
  locationType!: LocationType;

  @ApiPropertyOptional({ description: 'Meeting link (ONLINE) or room code (OFFLINE e.g. A101)', example: 'A101' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  locationDetail?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateScheduleDto {
  @ApiPropertyOptional({ description: 'Defense date and time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  defenseAt?: string;

  @ApiPropertyOptional({ enum: ['ONLINE', 'OFFLINE'] })
  @IsOptional()
  @IsEnum(['ONLINE', 'OFFLINE'])
  locationType?: LocationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  locationDetail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export interface ScheduleResponseDto {
  id: string;
  topicId: string;
  defenseAt: string;
  locationType: LocationType;
  locationDetail?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
