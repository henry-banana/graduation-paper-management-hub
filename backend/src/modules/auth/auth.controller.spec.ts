import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthUser } from '../../common/types';
import { AssignmentsService } from '../assignments/assignments.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockAuthService = {
    validateGoogleUser: jest.fn(),
    authenticateWithGoogleIdToken: jest.fn(),
    refreshAccessToken: jest.fn(),
    logout: jest.fn(),
    getCurrentProfile: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'FRONTEND_URL') {
        return 'http://localhost:3000';
      }

      return fallback;
    }),
  };

  const mockAssignmentsService = {
    getActiveTopicRolesForUser: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AssignmentsService, useValue: mockAssignmentsService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should authenticate from google id token and return contract payload', async () => {
    authService.authenticateWithGoogleIdToken.mockResolvedValue({
      user: {
        userId: 'USR001',
        email: 'student@hcmute.edu.vn',
        name: 'Student A',
        role: 'STUDENT',
      },
      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
      },
    });

    const result = await controller.googleTokenCallback({ idToken: 'mock.token.payload' });

    expect(authService.authenticateWithGoogleIdToken).toHaveBeenCalledWith('mock.token.payload');
    expect(result.data.accessToken).toBe('access-token');
    expect(result.data.user.id).toBe('USR001');
    expect(result.data.user.accountRole).toBe('STUDENT');
    expect(result.meta.requestId).toBeDefined();
  });

  it('should refresh access token with envelope', async () => {
    authService.refreshAccessToken.mockResolvedValue({
      accessToken: 'new-access-token',
      expiresIn: 900,
    });

    const result = await controller.refreshToken({ refreshToken: 'refresh-token' });

    expect(result.data.accessToken).toBe('new-access-token');
    expect(result.meta.requestId).toBeDefined();
  });

  it('should logout and return success payload', async () => {
    authService.logout.mockResolvedValue(undefined);

    const result = await controller.logout({ refreshToken: 'refresh-token' });

    expect(authService.logout).toHaveBeenCalledWith('refresh-token');
    expect(result.data.success).toBe(true);
    expect(result.meta.requestId).toBeDefined();
  });

  it('should return current user profile payload', async () => {
    const currentUser: AuthUser = {
      userId: 'USR001',
      email: 'student@hcmute.edu.vn',
      role: 'STUDENT',
    };

    authService.getCurrentProfile.mockResolvedValue({
      userId: 'USR001',
      email: 'student@hcmute.edu.vn',
      name: 'Student A',
      role: 'STUDENT',
    });

    const result = await controller.getCurrentUser(currentUser);

    expect(result.data.id).toBe('USR001');
    expect(result.data.fullName).toBe('Student A');
    expect(result.data.accountRole).toBe('STUDENT');
    expect(result.meta.requestId).toBeDefined();
  });
});
