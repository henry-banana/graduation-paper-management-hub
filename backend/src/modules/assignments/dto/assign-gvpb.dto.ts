import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class AssignGvpbDto {
  @ApiProperty({
    description: 'User ID of the lecturer to assign as GVPB',
    example: 'USR_GVPB_1',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string;
}
