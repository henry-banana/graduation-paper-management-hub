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

interface GoogleIdTokenPayload {
  email?: string;
  name?: string;
  picture?: string;
  sub?: string;
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

  async authenticateWithGoogleIdToken(idToken: string): Promise<AuthResponseDto> {
    const googleUser = this.extractGoogleUserFromIdToken(idToken);
    return this.validateGoogleUser(googleUser);
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

  async getCurrentProfile(userId: string): Promise<AuthUserDto | null> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      return null;
    }

    return this.mapToAuthUser(user);
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

  private extractGoogleUserFromIdToken(idToken: string): GoogleUser {
    const parts = idToken.split('.');
    if (parts.length < 2) {
      throw new UnauthorizedException('Invalid Google ID token format');
    }

    try {
      const payloadJson = this.decodeBase64Url(parts[1]);
      const payload = JSON.parse(payloadJson) as GoogleIdTokenPayload;

      if (!payload.email) {
        throw new UnauthorizedException('Google ID token does not include email');
      }

      return {
        email: payload.email,
        name: payload.name || payload.email,
        picture: payload.picture,
        accessToken: idToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Unable to parse Google ID token');
    }
  }

  private decodeBase64Url(value: string): string {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return Buffer.from(padded, 'base64').toString('utf-8');
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