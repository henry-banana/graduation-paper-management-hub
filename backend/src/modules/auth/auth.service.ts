import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { UsersService, UserRecord } from '../users/users.service';
import { GoogleUser } from './strategies/google.strategy';
import { AuthResponseDto, AuthUserDto, TokenPairDto, RefreshTokenDto } from './dto';
import { AccountRole } from '../../common/types';

interface JwtPayload {
  sub: string;
  email: string;
  role: AccountRole;
}

@Injectable()
export class AuthService {
  private readonly accessTokenTtl: number;
  private readonly refreshTokenTtl: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    this.accessTokenTtl = this.configService.get<number>('JWT_ACCESS_TTL', 900);
    this.refreshTokenTtl = this.configService.get<number>('JWT_REFRESH_TTL', 604800);
  }

  async validateGoogleUser(googleUser: GoogleUser): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(googleUser.email);

    if (!user) {
      throw new ForbiddenException({
        message: 'Email chưa được cấp quyền truy cập. Vui lòng liên hệ Bộ môn.',
        code: 'USER_NOT_WHITELISTED',
      });
    }

    const authUser = this.mapToAuthUser(user, googleUser.picture);
    const tokens = await this.generateTokens(authUser);

    return { user: authUser, tokens };
  }

  async refreshAccessToken(refreshToken: string): Promise<RefreshTokenDto> {
    const isBlacklisted = await this.cacheManager.get<boolean>(`blacklist:${refreshToken}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token đã bị thu hồi');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const accessToken = this.jwtService.sign(
        { sub: payload.sub, email: payload.email, role: payload.role },
        { expiresIn: this.accessTokenTtl },
      );

      return { accessToken, expiresIn: this.accessTokenTtl };
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.decode(refreshToken) as JwtPayload & { exp: number };
      if (payload?.exp) {
        const ttl = payload.exp * 1000 - Date.now();
        if (ttl > 0) {
          await this.cacheManager.set(`blacklist:${refreshToken}`, true, ttl);
        }
      }
    } catch {
      // Token invalid, nothing to blacklist
    }
  }

  private async generateTokens(user: AuthUserDto): Promise<TokenPairDto> {
    const payload: JwtPayload = {
      sub: user.userId,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: this.accessTokenTtl }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.refreshTokenTtl,
      }),
    ]);

    return { accessToken, refreshToken, expiresIn: this.accessTokenTtl };
  }

  private mapToAuthUser(user: UserRecord, picture?: string): AuthUserDto {
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      picture,
    };
  }
}