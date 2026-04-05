import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
  ArrayUnique,
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
}
