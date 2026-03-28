import { AccountRole } from '../../../common/types';

export class AuthUserDto {
  userId!: string;
  email!: string;
  name!: string;
  role!: AccountRole;
  picture?: string;
}

export class TokenPairDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;
}

export class AuthResponseDto {
  user!: AuthUserDto;
  tokens!: TokenPairDto;
}

export class RefreshTokenDto {
  accessToken!: string;
  expiresIn!: number;
}
