import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService, UserRecord } from './users.service';
import { AuthUser } from '../../common/types';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const mockUser: UserRecord = {
    id: 'USR001',
    email: 'student@hcmute.edu.vn',
    name: 'Nguyễn Văn A',
    role: 'STUDENT',
    studentId: '20110001',
    earnedCredits: 120,
    isActive: true,
  };

  const mockLecturer: UserRecord = {
    id: 'USR002',
    email: 'lecturer@hcmute.edu.vn',
    name: 'Trần Văn B',
    role: 'LECTURER',
    lecturerId: 'GV001',
    isActive: true,
  };

  beforeEach(async () => {
    const mockUsersService = {
      findById: jest.fn(),
      findAll: jest.fn(),
      updateProfile: jest.fn(),
      mapToDto: jest.fn((user: UserRecord) => ({
        id: user.id,
        email: user.email,
        fullName: user.name,
        accountRole: user.role,
        studentId: user.studentId,
        lecturerId: user.lecturerId,
        earnedCredits: user.earnedCredits,
        isActive: user.isActive,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  describe('getMe', () => {
    it('should return current user profile', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      const currentUser: AuthUser = {
        userId: 'USR001',
        email: 'student@hcmute.edu.vn',
        role: 'STUDENT',
      };

      const result = await controller.getMe(currentUser);

      expect(result.data.fullName).toBe('Nguyễn Văn A');
      expect(result.meta.requestId).toBeDefined();
    });

    it('should throw NotFoundException if user not found', async () => {
      usersService.findById.mockResolvedValue(null);
      const currentUser: AuthUser = {
        userId: 'NONEXISTENT',
        email: 'none@hcmute.edu.vn',
        role: 'STUDENT',
      };

      await expect(controller.getMe(currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return list of users with pagination', async () => {
      usersService.findAll.mockResolvedValue({
        data: [usersService.mapToDto(mockUser)],
        pagination: { page: 1, size: 20, total: 1 },
      });

      const result = await controller.findAll({ page: 1, size: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.meta.requestId).toBeDefined();
    });

    it('should filter users by role', async () => {
      usersService.findAll.mockResolvedValue({
        data: [usersService.mapToDto(mockLecturer)],
        pagination: { page: 1, size: 20, total: 1 },
      });

      const result = await controller.findAll({ role: 'LECTURER' });

      expect(result.data[0].accountRole).toBe('LECTURER');
    });
  });

  describe('findOne', () => {
    it('should return user by ID for TBM', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      const currentUser: AuthUser = {
        userId: 'USR003',
        email: 'tbm@hcmute.edu.vn',
        role: 'TBM',
      };

      const result = await controller.findOne('USR001', currentUser);

      expect(result.data.id).toBe('USR001');
    });

    it('should allow student to view their own profile', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      const currentUser: AuthUser = {
        userId: 'USR001',
        email: 'student@hcmute.edu.vn',
        role: 'STUDENT',
      };

      const result = await controller.findOne('USR001', currentUser);

      expect(result.data.id).toBe('USR001');
    });

    it('should throw ForbiddenException when student views another profile', async () => {
      const currentUser: AuthUser = {
        userId: 'USR001',
        email: 'student@hcmute.edu.vn',
        role: 'STUDENT',
      };

      await expect(controller.findOne('USR002', currentUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException for non-existent user', async () => {
      usersService.findById.mockResolvedValue(null);
      const currentUser: AuthUser = {
        userId: 'USR003',
        email: 'tbm@hcmute.edu.vn',
        role: 'TBM',
      };

      await expect(
        controller.findOne('NONEXISTENT', currentUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should allow user to update their own profile', async () => {
      usersService.updateProfile.mockResolvedValue({ updated: true });
      const currentUser: AuthUser = {
        userId: 'USR001',
        email: 'student@hcmute.edu.vn',
        role: 'STUDENT',
      };

      const result = await controller.updateProfile(
        'USR001',
        { fullName: 'New Name' },
        currentUser,
      );

      expect(result.data.updated).toBe(true);
    });

    it('should allow TBM to update any profile', async () => {
      usersService.updateProfile.mockResolvedValue({ updated: true });
      const currentUser: AuthUser = {
        userId: 'USR003',
        email: 'tbm@hcmute.edu.vn',
        role: 'TBM',
      };

      const result = await controller.updateProfile(
        'USR001',
        { fullName: 'New Name' },
        currentUser,
      );

      expect(result.data.updated).toBe(true);
    });

    it('should throw ForbiddenException when updating another user profile', async () => {
      const currentUser: AuthUser = {
        userId: 'USR001',
        email: 'student@hcmute.edu.vn',
        role: 'STUDENT',
      };

      await expect(
        controller.updateProfile('USR002', { fullName: 'New Name' }, currentUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
