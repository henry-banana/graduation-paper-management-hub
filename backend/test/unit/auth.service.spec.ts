import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../src/modules/auth/auth.service';
import { UsersService, UserRecord } from '../../src/modules/users/users.service';
import { GoogleUser } from '../../src/modules/auth/strategies/google.strategy';

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: JwtService;
  let usersService: UsersService;
  let cacheManager: { get: jest.Mock; set: jest.Mock };

  const mockUser: UserRecord = {
    id: 'USR001',
    email: 'student@hcmute.edu.vn',
    name: 'Nguyễn Văn A',
    role: 'STUDENT',
    studentId: '20110001',
  };

  const mockGoogleUser: GoogleUser = {
    email: 'student@hcmute.edu.vn',
    name: 'Nguyễn Văn A',
    picture: 'https://example.com/pic.jpg',
    accessToken: 'google-access-token',
    refreshToken: 'google-refresh-token',
  };

  beforeEach(async () => {
    cacheManager = { get: jest.fn(), set: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-access-token'),
            signAsync: jest.fn().mockResolvedValue('mock-token'),
            verify: jest.fn(),
            decode: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              const config: Record<string, unknown> = {
                JWT_ACCESS_TTL: 900,
                JWT_REFRESH_TTL: 604800,
                JWT_REFRESH_SECRET: 'test-refresh-secret',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    usersService = module.get<UsersService>(UsersService);
  });

  describe('validateGoogleUser', () => {
    it('should return auth response for whitelisted user', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser);

      const result = await authService.validateGoogleUser(mockGoogleUser);

      expect(result.user.email).toBe(mockUser.email);
      expect(result.user.role).toBe(mockUser.role);
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should throw ForbiddenException for non-whitelisted user', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

      await expect(authService.validateGoogleUser(mockGoogleUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('should return new access token for valid refresh token', async () => {
      cacheManager.get.mockResolvedValue(null);
      jest.spyOn(jwtService, 'verify').mockReturnValue({
        sub: 'USR001',
        email: 'student@hcmute.edu.vn',
        role: 'STUDENT',
      });
      jest.spyOn(jwtService, 'sign').mockReturnValue('new-access-token');

      const result = await authService.refreshAccessToken('valid-refresh-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.expiresIn).toBe(900);
    });

    it('should throw UnauthorizedException for blacklisted token', async () => {
      cacheManager.get.mockResolvedValue(true);

      await expect(authService.refreshAccessToken('blacklisted-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      cacheManager.get.mockResolvedValue(null);
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.refreshAccessToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should blacklist refresh token', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      jest.spyOn(jwtService, 'decode').mockReturnValue({
        sub: 'USR001',
        exp: futureExp,
      });

      await authService.logout('valid-refresh-token');

      expect(cacheManager.set).toHaveBeenCalled();
    });

    it('should not throw for invalid token', async () => {
      jest.spyOn(jwtService, 'decode').mockReturnValue(null);

      await expect(authService.logout('invalid-token')).resolves.not.toThrow();
    });
  });
});
