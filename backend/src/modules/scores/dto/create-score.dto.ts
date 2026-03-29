import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  ValidateNested,
  IsNumber,
  IsIn,
  IsString,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ScorerRole, RubricItem } from './score-response.dto';
import { SCORE_SCORER_ROLES } from '../scores.constants';

export class RubricItemDto implements RubricItem {
  @ApiProperty({
    description: 'Criterion name',
    example: 'quality',
  })
  @IsString()
  criterion!: string;

  @ApiProperty({
    description: 'Score for this criterion',
    example: 2.0,
  })
  @IsNumber()
  @Min(0)
  score!: number;

  @ApiProperty({
    description: 'Maximum score for this criterion',
    example: 2.5,
  })
  @IsNumber()
  @Min(0)
  max!: number;

  @ApiPropertyOptional({
    description: 'Note or comment',
    example: 'Good implementation',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateDraftScoreDto {
  @ApiProperty({
    description: 'Role of the scorer',
    enum: [...SCORE_SCORER_ROLES],
    example: 'GVHD',
  })
  @IsIn([...SCORE_SCORER_ROLES])
  scorerRole!: ScorerRole;

  @ApiProperty({
    description: 'Rubric data with scores per criterion',
    type: [RubricItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RubricItemDto)
  rubricData!: RubricItemDto[];
}
