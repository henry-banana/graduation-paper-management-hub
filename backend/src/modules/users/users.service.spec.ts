import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { UsersService, UserRecord } from './users.service';
import { UsersRepository } from '../../infrastructure/google-sheets';

describe('UsersService', () => {
  let service: UsersService;
  let cacheManager: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let usersStore: UserRecord[];

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    usersStore = [
      {
        id: 'USR001',
        email: 'student@hcmute.edu.vn',
        name: 'Nguyễn Văn A',
        role: 'STUDENT',
        studentId: '20110001',
        earnedCredits: 120,
        requiredCredits: 130,
        completedBcttScore: 8.5,
        isActive: true,
      },
      {
        id: 'USR002',
        email: 'lecturer@hcmute.edu.vn',
        name: 'Nguyễn Văn B',
        role: 'LECTURER',
        lecturerId: 'GV001',
        totalQuota: 6,
        quotaUsed: 2,
        isActive: true,
      },
      {
        id: 'USR003',
        email: 'tbm@hcmute.edu.vn',
        name: 'Trần Thị C',
        role: 'TBM',
        isActive: true,
      },
    ];

    const usersRepository = {
      findAll: jest.fn(async () => [...usersStore]),
      findById: jest.fn(async (id: string) => usersStore.find((u) => u.id === id) ?? null),
      findFirst: jest.fn(
        async (predicate: (record: UserRecord) => boolean) =>
          usersStore.find((record) => predicate(record)) ?? null,
      ),
      update: jest.fn(async (id: string, record: UserRecord) => {
        const index = usersStore.findIndex((user) => user.id === id);
        if (index >= 0) {
          usersStore[index] = { ...record };
        }
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: UsersRepository, useValue: usersRepository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    // Set environment for mock data
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByEmail', () => {
    it('should return user from cache if available', async () => {
      const cachedUser: UserRecord = {
        id: 'USR001',
        email: 'student@hcmute.edu.vn',
        name: 'Cached User',
        role: 'STUDENT',
      };
      cacheManager.get.mockResolvedValueOnce(cachedUser);

      const result = await service.findByEmail('student@hcmute.edu.vn');

      expect(result).toEqual(cachedUser);
      expect(cacheManager.get).toHaveBeenCalledWith('user:email:student@hcmute.edu.vn');
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should fetch user and cache it if not in cache', async () => {
      const result = await service.findByEmail('student@hcmute.edu.vn');

      expect(result).toBeDefined();
      expect(result?.email).toBe('student@hcmute.edu.vn');
      expect(cacheManager.set).toHaveBeenCalled();
    });

    it('should return null for non-existent email', async () => {
      const result = await service.findByEmail('nonexistent@hcmute.edu.vn');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return user from cache if available', async () => {
      const cachedUser: UserRecord = {
        id: 'USR001',
        email: 'student@hcmute.edu.vn',
        name: 'Cached User',
        role: 'STUDENT',
      };
      cacheManager.get.mockResolvedValueOnce(cachedUser);

      const result = await service.findById('USR001');

      expect(result).toEqual(cachedUser);
      expect(cacheManager.get).toHaveBeenCalledWith('user:id:USR001');
    });

    it('should fetch user by ID and cache it', async () => {
      const result = await service.findById('USR002');

      expect(result).toBeDefined();
      expect(result?.id).toBe('USR002');
      expect(result?.role).toBe('LECTURER');
      expect(cacheManager.set).toHaveBeenCalled();
    });

    it('should return null for non-existent ID', async () => {
      const result = await service.findById('NONEXISTENT');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all users with default pagination', async () => {
      const result = await service.findAll({});

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.size).toBe(20);
    });

    it('should filter users by role', async () => {
      const result = await service.findAll({ role: 'STUDENT' });

      expect(result.data.every((u) => u.accountRole === 'STUDENT')).toBe(true);
    });

    it('should filter users by search query', async () => {
      const result = await service.findAll({ q: 'Nguyễn' });

      expect(result.data.every((u) => u.fullName.includes('Nguyễn'))).toBe(true);
    });

    it('should handle pagination correctly', async () => {
      const result = await service.findAll({ page: 1, size: 2 });

      expect(result.data.length).toBeLessThanOrEqual(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.size).toBe(2);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const result = await service.updateProfile('USR001', {
        fullName: 'New Name',
      });

      expect(result.updated).toBe(true);
      expect(cacheManager.del).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent user', async () => {
      await expect(
        service.updateProfile('NONEXISTENT', { fullName: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update phone number', async () => {
      const result = await service.updateProfile('USR001', {
        phone: '0901234567',
      });

      expect(result.updated).toBe(true);
    });
  });

  describe('mapToDto', () => {
    it('should map UserRecord to UserResponseDto correctly', () => {
      const user: UserRecord = {
        id: 'USR001',
        email: 'test@hcmute.edu.vn',
        name: 'Test User',
        role: 'STUDENT',
        studentId: '20110001',
        earnedCredits: 120,
        isActive: true,
      };

      const dto = service.mapToDto(user);

      expect(dto.id).toBe(user.id);
      expect(dto.email).toBe(user.email);
      expect(dto.fullName).toBe(user.name);
      expect(dto.accountRole).toBe(user.role);
      expect(dto.studentId).toBe(user.studentId);
      expect(dto.earnedCredits).toBe(user.earnedCredits);
      expect(dto.isActive).toBe(user.isActive);
    });
  });

  describe('invalidateUserCache', () => {
    it('should delete both email and id cache entries', async () => {
      await service.invalidateUserCache('test@hcmute.edu.vn', 'USR001');

      expect(cacheManager.del).toHaveBeenCalledWith('user:email:test@hcmute.edu.vn');
      expect(cacheManager.del).toHaveBeenCalledWith('user:id:USR001');
    });
  });
});
