import { ConflictException } from '@nestjs/common';
import { TopicsService } from '../../src/modules/topics/topics.service';

function toDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('TopicsService - registration period window', () => {
  const currentUser = {
    userId: 'USR_STUDENT_001',
    email: 'student@hcmute.edu.vn',
    role: 'STUDENT' as const,
  };

  const baseSupervisor = {
    id: 'USR_LECTURER_001',
    role: 'LECTURER' as const,
    isActive: true,
    totalQuota: 3,
    quotaUsed: 1,
  };

  const createService = (overrides?: {
    period?: Partial<{
      id: string;
      type: 'BCTT' | 'KLTN';
      status: 'DRAFT' | 'OPEN' | 'CLOSED';
      openDate: string;
      closeDate: string;
    }>;
  }) => {
    const period = {
      id: 'prd_001',
      type: 'BCTT' as const,
      status: 'OPEN' as const,
      openDate: '2020-01-01',
      closeDate: '2099-12-31',
      ...overrides?.period,
    };

    const topicsRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      findWhere: jest.fn(),
      create: jest.fn().mockResolvedValue(undefined),
      update: jest.fn(),
    };

    const revisionRoundsRepository = {
      findWhere: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const periodsRepository = {
      findById: jest.fn().mockResolvedValue(period),
    };

    const usersRepository = {
      findById: jest.fn().mockResolvedValue(baseSupervisor),
    };

    const service = new TopicsService(
      topicsRepository as any,
      revisionRoundsRepository as any,
      periodsRepository as any,
      usersRepository as any,
      undefined,
      undefined,
    );

    return {
      service,
      topicsRepository,
      periodsRepository,
      usersRepository,
      period,
    };
  };

  it('rejects registration when current date is outside period open/close dates', async () => {
    const { service, topicsRepository } = createService({
      period: {
        openDate: '2099-01-01',
        closeDate: '2099-12-31',
      },
    });

    const createPromise = service.create(
      {
        type: 'BCTT',
        title: 'De tai ngoai window',
        domain: 'Web',
        supervisorUserId: 'USR_LECTURER_001',
        periodId: 'prd_001',
      },
      currentUser,
    );

    await expect(createPromise).rejects.toThrow(ConflictException);
    await expect(createPromise).rejects.toThrow('outside the configured date window');

    expect(topicsRepository.create).not.toHaveBeenCalled();
  });

  it('creates topic when period is OPEN and current date is inside open/close dates', async () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const { service, topicsRepository } = createService({
      period: {
        openDate: toDateOnly(yesterday),
        closeDate: toDateOnly(tomorrow),
      },
    });

    const result = await service.create(
      {
        type: 'BCTT',
        title: 'De tai hop le',
        domain: 'AI',
        supervisorUserId: 'USR_LECTURER_001',
        periodId: 'prd_001',
      },
      currentUser,
    );

    expect(result.state).toBe('PENDING_GV');
    expect(result.id).toMatch(/^tp_/);
    expect(topicsRepository.create).toHaveBeenCalledTimes(1);
  });
});

describe('TopicsService - role-based topic filtering', () => {
  const currentLecturer = {
    userId: 'USR_LECTURER_001',
    email: 'lecturer@hcmute.edu.vn',
    role: 'LECTURER' as const,
  };

  const createServiceForFindAll = () => {
    const topics = [
      {
        id: 'tp_001',
        type: 'KLTN',
        title: 'Topic 1',
        domain: 'AI',
        state: 'GRADING',
        studentUserId: 'USR_STUDENT_001',
        supervisorUserId: 'USR_LECTURER_002',
        periodId: 'prd_001',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'tp_002',
        type: 'KLTN',
        title: 'Topic 2',
        domain: 'Web',
        state: 'GRADING',
        studentUserId: 'USR_STUDENT_002',
        supervisorUserId: 'USR_LECTURER_003',
        periodId: 'prd_001',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 'tp_003',
        type: 'KLTN',
        title: 'Topic 3',
        domain: 'IoT',
        state: 'GRADING',
        studentUserId: 'USR_STUDENT_003',
        supervisorUserId: 'USR_LECTURER_004',
        periodId: 'prd_001',
        createdAt: '2026-01-03T00:00:00.000Z',
        updatedAt: '2026-01-03T00:00:00.000Z',
      },
    ];

    const assignments = [
      {
        id: 'as_001',
        topicId: 'tp_001',
        userId: 'USR_LECTURER_001',
        topicRole: 'TK_HD',
        status: 'ACTIVE',
      },
      {
        id: 'as_002',
        topicId: 'tp_002',
        userId: 'USR_LECTURER_001',
        topicRole: 'TV_HD',
        status: 'ACTIVE',
      },
      {
        id: 'as_003',
        topicId: 'tp_003',
        userId: 'USR_LECTURER_001',
        topicRole: 'TK_HD',
        status: 'INACTIVE',
      },
      {
        id: 'as_004',
        topicId: 'tp_003',
        userId: 'USR_LECTURER_999',
        topicRole: 'TK_HD',
        status: 'ACTIVE',
      },
    ];

    const topicsRepository = {
      findAll: jest.fn().mockResolvedValue(topics),
    };

    const revisionRoundsRepository = {
      findWhere: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const periodsRepository = {
      findById: jest.fn(),
    };

    const usersRepository = {
      findById: jest.fn(),
    };

    const assignmentsRepository = {
      findAll: jest.fn().mockResolvedValue(assignments),
    };

    const service = new TopicsService(
      topicsRepository as any,
      revisionRoundsRepository as any,
      periodsRepository as any,
      usersRepository as any,
      assignmentsRepository as any,
      undefined,
    );

    return {
      service,
      topicsRepository,
      assignmentsRepository,
    };
  };

  it('returns only ACTIVE topics where current user is TK_HD when role=tk_hd', async () => {
    const { service } = createServiceForFindAll();

    const result = await service.findAll(
      {
        role: 'tk_hd',
        page: 1,
        size: 20,
      },
      currentLecturer,
    );

    expect(result.data.map((topic) => topic.id)).toEqual(['tp_001']);
    expect(result.pagination.total).toBe(1);
  });

  it('returns all ACTIVE assigned topics for reviewer regardless of topicRole', async () => {
    const { service } = createServiceForFindAll();

    const result = await service.findAll(
      {
        role: 'reviewer',
        page: 1,
        size: 20,
      },
      currentLecturer,
    );

    expect(result.data.map((topic) => topic.id)).toEqual(['tp_002', 'tp_001']);
    expect(result.pagination.total).toBe(2);
  });
});
