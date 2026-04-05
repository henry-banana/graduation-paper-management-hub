import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
  ArrayUnique,
  MaxLength,
} from 'class-validator';

export class AssignCouncilDto {
  @ApiProperty({
    description: 'User ID of the council chair (CT_HD)',
    example: 'USR_CT_1',
  })
  @IsString()
  @IsNotEmpty()
  chairUserId!: string;

  @ApiProperty({
    description: 'User ID of the council secretary (TK_HD)',
    example: 'USR_TK_1',
  })
  @IsString()
  @IsNotEmpty()
  secretaryUserId!: string;

  @ApiProperty({
    description: 'List of council member user IDs (TV_HD)',
    example: ['USR_TV_1', 'USR_TV_2', 'USR_TV_3'],
    type: [String],
    minItems: 3,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Council must have at least 1 member (TV_HD)' })
  @ArrayUnique({ message: 'Council members must be unique' })
  @IsNotEmpty({ each: true })
  @IsString({ each: true })
  memberUserIds!: string[];

  @ApiProperty({
    description: 'Defense datetime (ISO)',
    example: '2026-07-15T08:30:00.000Z',
  })
  @IsDateString({}, { message: 'defenseAt must be a valid ISO datetime' })
  defenseAt!: string;

  @ApiProperty({
    description: 'Defense location detail (room/link)',
    example: 'Phòng B2-01',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  location!: string;
}
