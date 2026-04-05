import {
  Injectable,
  Logger,
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
import {
  sanitizeErrorForLog,
  serializeForLog,
} from '../../common/logging/log-sanitizer.util';

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
  private readonly logger = new Logger(AuthService.name);
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
    this.logger.log(
      `[validateGoogleUser:start] email=${googleUser.email} picture=${Boolean(googleUser.picture)}`,
    );
    const user = await this.usersService.findByEmail(googleUser.email);

    if (!user) {
      this.logger.warn(
        `[validateGoogleUser:forbidden] email=${googleUser.email} reason=NOT_WHITELISTED`,
      );
      throw new ForbiddenException({
        message: 'Email chưa được cấp quyền truy cập. Vui lòng liên hệ Bộ môn.',
        code: 'USER_NOT_WHITELISTED',
      });
    }

    const authUser = this.mapToAuthUser(user, googleUser.picture);
    const tokens = await this.generateTokens(authUser);
    this.logger.log(
      `[validateGoogleUser:success] userId=${authUser.userId} role=${authUser.role} email=${authUser.email}`,
    );

    return { user: authUser, tokens };
  }

  async authenticateWithGoogleIdToken(idToken: string): Promise<AuthResponseDto> {
    this.logger.log(
      `[authenticateWithGoogleIdToken:start] token=${fingerprintToken(idToken)}`,
    );
    const googleUser = this.extractGoogleUserFromIdToken(idToken);
    const authResult = await this.validateGoogleUser(googleUser);
    this.logger.log(
      `[authenticateWithGoogleIdToken:success] userId=${authResult.user.userId} role=${authResult.user.role}`,
    );
    return authResult;
  }

  async refreshAccessToken(refreshToken: string): Promise<RefreshTokenDto> {
    this.logger.log(
      `[refreshAccessToken:start] refreshToken=${fingerprintToken(refreshToken)}`,
    );
    const isBlacklisted = await this.cacheManager.get<boolean>(`blacklist:${refreshToken}`);
    if (isBlacklisted) {
      this.logger.warn(
        `[refreshAccessToken:forbidden] refreshToken=${fingerprintToken(refreshToken)} reason=BLACKLISTED`,
      );
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

      this.logger.log(
        `[refreshAccessToken:success] userId=${payload.sub} role=${payload.role} expiresIn=${this.accessTokenTtl}`,
      );
      return { accessToken, expiresIn: this.accessTokenTtl };
    } catch (error) {
      this.logger.warn(
        `[refreshAccessToken:failed] refreshToken=${fingerprintToken(refreshToken)} error=${serializeForLog(
          sanitizeErrorForLog(error),
        )}`,
      );
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
  }

  async getCurrentProfile(userId: string): Promise<AuthUserDto | null> {
    this.logger.log(`[getCurrentProfile:start] userId=${userId}`);
    const user = await this.usersService.findById(userId);
    if (!user) {
      this.logger.warn(`[getCurrentProfile:notFound] userId=${userId}`);
      return null;
    }

    this.logger.log(
      `[getCurrentProfile:success] userId=${userId} role=${user.role} email=${user.email}`,
    );
    return this.mapToAuthUser(user);
  }

  async logout(refreshToken: string): Promise<void> {
    this.logger.log(`[logout:start] refreshToken=${fingerprintToken(refreshToken)}`);
    try {
      const payload = this.jwtService.decode(refreshToken) as JwtPayload & { exp: number };
      if (payload?.exp) {
        const ttl = payload.exp * 1000 - Date.now();
        if (ttl > 0) {
          await this.cacheManager.set(`blacklist:${refreshToken}`, true, ttl);
          this.logger.log(
            `[logout:success] userId=${payload.sub} ttlMs=${ttl} refreshToken=${fingerprintToken(
              refreshToken,
            )}`,
          );
          return;
        }

        this.logger.log(
          `[logout:skip] userId=${payload.sub} reason=TOKEN_ALREADY_EXPIRED refreshToken=${fingerprintToken(
            refreshToken,
          )}`,
        );
        return;
      }

      this.logger.log(
        `[logout:skip] reason=TOKEN_HAS_NO_EXP refreshToken=${fingerprintToken(refreshToken)}`,
      );
    } catch {
      this.logger.warn(
        `[logout:skip] reason=TOKEN_INVALID refreshToken=${fingerprintToken(refreshToken)}`,
      );
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

    this.logger.log(
      `[generateTokens:success] userId=${user.userId} role=${user.role} accessTtl=${this.accessTokenTtl} refreshTtl=${this.refreshTokenTtl}`,
    );
    return { accessToken, refreshToken, expiresIn: this.accessTokenTtl };
  }

  private extractGoogleUserFromIdToken(idToken: string): GoogleUser {
    const parts = idToken.split('.');
    if (parts.length < 2) {
      this.logger.warn(
        `[extractGoogleUserFromIdToken:failed] reason=INVALID_FORMAT token=${fingerprintToken(idToken)}`,
      );
      throw new UnauthorizedException('Invalid Google ID token format');
    }

    try {
      const payloadJson = this.decodeBase64Url(parts[1]);
      const payload = JSON.parse(payloadJson) as GoogleIdTokenPayload;

      if (!payload.email) {
        this.logger.warn(
          `[extractGoogleUserFromIdToken:failed] reason=MISSING_EMAIL token=${fingerprintToken(
            idToken,
          )}`,
        );
        throw new UnauthorizedException('Google ID token does not include email');
      }

      this.logger.log(
        `[extractGoogleUserFromIdToken:success] email=${payload.email} subject=${payload.sub ?? '-'}`,
      );
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

      this.logger.warn(
        `[extractGoogleUserFromIdToken:failed] reason=UNPARSEABLE token=${fingerprintToken(
          idToken,
        )} error=${serializeForLog(sanitizeErrorForLog(error))}`,
      );
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

function fingerprintToken(token: string): string {
  if (!token || token.length <= 12) {
    return '[REDACTED]';
  }

  return `${token.slice(0, 6)}...${token.slice(-4)}[len=${token.length}]`;
}
