import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleCallbackRequestDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}