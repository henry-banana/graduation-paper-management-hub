import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UsersService, UserRecord } from '../../src/modules/users/users.service';
import { UsersRepository } from '../../src/infrastructure/google-sheets';

describe('UsersService', () => {
  let usersService: UsersService;
  let cacheManager: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let usersStore: UserRecord[];

  beforeEach(async () => {
    cacheManager = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    usersStore = [
      {
        id: 'USR001',
        email: 'student@hcmute.edu.vn',
        name: 'Student User',
        role: 'STUDENT',
        studentId: '20110001',
      },
      {
        id: 'USR002',
        email: 'lecturer@hcmute.edu.vn',
        name: 'Lecturer User',
        role: 'LECTURER',
        lecturerId: 'GV001',
      },
      {
        id: 'USR003',
        email: 'tbm@hcmute.edu.vn',
        name: 'TBM User',
        role: 'TBM',
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
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
        {
          provide: UsersRepository,
          useValue: usersRepository,
        },
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
  });

  describe('findByEmail', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      delete process.env.NODE_ENV;
    });

    it('should return cached user if available', async () => {
      const cachedUser: UserRecord = {
        id: 'USR001',
        email: 'cached@hcmute.edu.vn',
        name: 'Cached User',
        role: 'STUDENT',
      };
      cacheManager.get.mockResolvedValue(cachedUser);

      const result = await usersService.findByEmail('cached@hcmute.edu.vn');

      expect(result).toEqual(cachedUser);
      expect(cacheManager.get).toHaveBeenCalledWith('user:email:cached@hcmute.edu.vn');
    });

    it('should return mock student user in dev mode', async () => {
      cacheManager.get.mockResolvedValue(null);

      const result = await usersService.findByEmail('student@hcmute.edu.vn');

      expect(result).not.toBeNull();
      expect(result?.role).toBe('STUDENT');
      expect(cacheManager.set).toHaveBeenCalled();
    });

    it('should return mock lecturer user in dev mode', async () => {
      cacheManager.get.mockResolvedValue(null);

      const result = await usersService.findByEmail('lecturer@hcmute.edu.vn');

      expect(result).not.toBeNull();
      expect(result?.role).toBe('LECTURER');
    });

    it('should return mock TBM user in dev mode', async () => {
      cacheManager.get.mockResolvedValue(null);

      const result = await usersService.findByEmail('tbm@hcmute.edu.vn');

      expect(result).not.toBeNull();
      expect(result?.role).toBe('TBM');
    });

    it('should return null for unknown email in dev mode', async () => {
      cacheManager.get.mockResolvedValue(null);

      const result = await usersService.findByEmail('unknown@hcmute.edu.vn');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      delete process.env.NODE_ENV;
    });

    it('should return cached user if available', async () => {
      const cachedUser: UserRecord = {
        id: 'USR001',
        email: 'cached@hcmute.edu.vn',
        name: 'Cached User',
        role: 'STUDENT',
      };
      cacheManager.get.mockResolvedValue(cachedUser);

      const result = await usersService.findById('USR001');

      expect(result).toEqual(cachedUser);
      expect(cacheManager.get).toHaveBeenCalledWith('user:id:USR001');
    });

    it('should return mock user by ID in dev mode', async () => {
      cacheManager.get.mockResolvedValue(null);

      const result = await usersService.findById('USR001');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('USR001');
    });
  });

  describe('invalidateUserCache', () => {
    it('should delete both email and id cache entries', async () => {
      await usersService.invalidateUserCache('test@hcmute.edu.vn', 'USR001');

      expect(cacheManager.del).toHaveBeenCalledWith('user:email:test@hcmute.edu.vn');
      expect(cacheManager.del).toHaveBeenCalledWith('user:id:USR001');
    });
  });
});
