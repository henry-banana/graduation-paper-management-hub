import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TopicsService, TopicRecord } from './topics.service';
import { AuthUser } from '../../common/types';
import {
  AssignmentsRepository,
  PeriodsRepository,
  RevisionRoundRecord,
  RevisionRoundsRepository,
  TopicsRepository,
  UsersRepository,
} from '../../infrastructure/google-sheets';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRecord } from '../users/users.service';
import { PeriodRecord } from '../periods/periods.service';

describe('TopicsService', () => {
  let service: TopicsService;
  let topicsData: TopicRecord[];
  let usersData: UserRecord[];
  let periodsData: PeriodRecord[];
  let revisionRoundsData: RevisionRoundRecord[];
  let assignmentsData: Array<{
    id: string;
    topicId: string;
    userId: string;
    topicRole: 'GVHD' | 'GVPB' | 'CT_HD' | 'TK_HD' | 'TV_HD';
    status: 'ACTIVE' | 'INACTIVE';
    assignedAt?: string;
    revokedAt?: string;
  }>;

  const studentUser: AuthUser = {
    userId: 'USR001',
    email: 'student@hcmute.edu.vn',
    role: 'STUDENT',
  };

  const lecturerUser: AuthUser = {
    userId: 'USR002',
    email: 'lecturer@hcmute.edu.vn',
    role: 'LECTURER',
  };

  const tbmUser: AuthUser = {
    userId: 'USR003',
    email: 'tbm@hcmute.edu.vn',
    role: 'TBM',
  };

  const gvpbUser: AuthUser = {
    userId: 'USR010',
    email: 'gvpb@hcmute.edu.vn',
    role: 'LECTURER',
  };

  const tkHdUser: AuthUser = {
    userId: 'USR011',
    email: 'tkhd@hcmute.edu.vn',
    role: 'LECTURER',
  };

  const ctHdUser: AuthUser = {
    userId: 'USR012',
    email: 'cthd@hcmute.edu.vn',
    role: 'LECTURER',
  };

  const unassignedLecturerUser: AuthUser = {
    userId: 'USR014',
    email: 'unassigned@hcmute.edu.vn',
    role: 'LECTURER',
  };

  const student5User: AuthUser = {
    userId: 'USR005',
    email: 'student5@hcmute.edu.vn',
    role: 'STUDENT',
  };

  beforeEach(async () => {
    const now = new Date().toISOString();

    topicsData = [
      {
        id: 'tp_001',
        type: 'BCTT',
        title: 'Xây dựng hệ thống quản lý thực tập',
        domain: 'Software Engineering',
        companyName: 'HCMUTE',
        state: 'IN_PROGRESS',
        studentUserId: 'USR001',
        supervisorUserId: 'USR002',
        periodId: 'prd_2026_hk1_bctt',
        submitStartAt: '2026-06-01T00:00:00Z',
        submitEndAt: '2026-06-15T23:59:59Z',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'tp_002',
        type: 'BCTT',
        title: 'Nghiên cứu giải pháp theo dõi tiến độ',
        domain: 'Information Systems',
        companyName: 'ABC Co',
        state: 'PENDING_GV',
        studentUserId: 'USR001',
        supervisorUserId: 'USR002',
        periodId: 'prd_2026_hk1_bctt',
        approvalDeadlineAt: '2026-01-20T00:00:00Z',
        createdAt: '2026-01-10T00:00:00Z',
        updatedAt: '2026-01-10T00:00:00Z',
      },
      {
        id: 'tp_003',
        type: 'KLTN',
        title: 'Đề tài KLTN đang chờ xác nhận bảo vệ',
        domain: 'Artificial Intelligence',
        state: 'PENDING_CONFIRM',
        studentUserId: 'USR005',
        supervisorUserId: 'USR002',
        periodId: 'prd_2026_hk1_kltn',
        createdAt: '2026-02-01T00:00:00Z',
        updatedAt: '2026-02-01T00:00:00Z',
      },
      {
        id: 'tp_004',
        type: 'KLTN',
        title: 'Đề tài KLTN đã xác nhận và sẵn sàng thực hiện',
        domain: 'Software Architecture',
        state: 'CONFIRMED',
        studentUserId: 'USR005',
        supervisorUserId: 'USR002',
        periodId: 'prd_2026_hk1_kltn',
        createdAt: '2026-02-05T00:00:00Z',
        updatedAt: '2026-02-05T00:00:00Z',
      },
      {
        id: 'tp_005',
        type: 'KLTN',
        title: 'Đề tài KLTN song song để test lock theo topic',
        domain: 'Data Engineering',
        state: 'CONFIRMED',
        studentUserId: 'USR006',
        supervisorUserId: 'USR002',
        periodId: 'prd_2026_hk1_kltn',
        createdAt: '2026-02-06T00:00:00Z',
        updatedAt: '2026-02-06T00:00:00Z',
      },
    ];

    usersData = [
      {
        id: 'USR001',
        email: 'student@hcmute.edu.vn',
        name: 'Student 1',
        role: 'STUDENT',
        earnedCredits: 120,
        requiredCredits: 120,
        completedBcttScore: 8,
        isActive: true,
      },
      {
        id: 'USR002',
        email: 'lecturer@hcmute.edu.vn',
        name: 'Lecturer 1',
        role: 'LECTURER',
        totalQuota: 10,
        quotaUsed: 1,
        isActive: true,
      },
      {
        id: 'USR003',
        email: 'tbm@hcmute.edu.vn',
        name: 'TBM 1',
        role: 'TBM',
        isActive: true,
      },
      {
        id: 'USR004',
        email: 'low-eligibility@hcmute.edu.vn',
        name: 'Student 4',
        role: 'STUDENT',
        earnedCredits: 150,
        requiredCredits: 120,
        completedBcttScore: 5,
        isActive: true,
      },
      {
        id: 'USR005',
        email: 'student5@hcmute.edu.vn',
        name: 'Student 5',
        role: 'STUDENT',
        earnedCredits: 130,
        requiredCredits: 120,
        completedBcttScore: 8,
        isActive: true,
      },
      {
        id: 'USR006',
        email: 'student6@hcmute.edu.vn',
        name: 'Student 6',
        role: 'STUDENT',
        earnedCredits: 130,
        requiredCredits: 120,
        completedBcttScore: 8,
        isActive: true,
      },
      {
        id: 'USR010',
        email: 'gvpb@hcmute.edu.vn',
        name: 'Lecturer GVPB',
        role: 'LECTURER',
        totalQuota: 10,
        quotaUsed: 0,
        isActive: true,
      },
      {
        id: 'USR011',
        email: 'tkhd@hcmute.edu.vn',
        name: 'Lecturer TK_HD',
        role: 'LECTURER',
        totalQuota: 10,
        quotaUsed: 0,
        isActive: true,
      },
      {
        id: 'USR012',
        email: 'cthd@hcmute.edu.vn',
        name: 'Lecturer CT_HD',
        role: 'LECTURER',
        totalQuota: 10,
        quotaUsed: 0,
        isActive: true,
      },
      {
        id: 'USR013',
        email: 'tvhd@hcmute.edu.vn',
        name: 'Lecturer TV_HD',
        role: 'LECTURER',
        totalQuota: 10,
        quotaUsed: 0,
        isActive: true,
      },
      {
        id: 'USR014',
        email: 'unassigned@hcmute.edu.vn',
        name: 'Lecturer Unassigned',
        role: 'LECTURER',
        totalQuota: 10,
        quotaUsed: 0,
        isActive: true,
      },
    ];

    assignmentsData = [
      {
        id: 'as_gvhd_001',
        topicId: 'tp_001',
        userId: 'USR002',
        topicRole: 'GVHD',
        status: 'ACTIVE',
      },
      {
        id: 'as_gvhd_002',
        topicId: 'tp_002',
        userId: 'USR002',
        topicRole: 'GVHD',
        status: 'ACTIVE',
      },
      {
        id: 'as_gvhd_003',
        topicId: 'tp_003',
        userId: 'USR002',
        topicRole: 'GVHD',
        status: 'ACTIVE',
      },
      {
        id: 'as_gvhd_004',
        topicId: 'tp_004',
        userId: 'USR002',
        topicRole: 'GVHD',
        status: 'ACTIVE',
      },
      {
        id: 'as_gvhd_005',
        topicId: 'tp_005',
        userId: 'USR002',
        topicRole: 'GVHD',
        status: 'ACTIVE',
      },
      {
        id: 'as_001',
        topicId: 'tp_003',
        userId: 'USR010',
        topicRole: 'GVPB',
        status: 'ACTIVE',
      },
      {
        id: 'as_002',
        topicId: 'tp_003',
        userId: 'USR011',
        topicRole: 'TK_HD',
        status: 'ACTIVE',
      },
      {
        id: 'as_003',
        topicId: 'tp_003',
        userId: 'USR012',
        topicRole: 'CT_HD',
        status: 'ACTIVE',
      },
      {
        id: 'as_004',
        topicId: 'tp_003',
        userId: 'USR013',
        topicRole: 'TV_HD',
        status: 'ACTIVE',
      },
    ];

    periodsData = [
      {
        id: 'prd_2026_hk1_bctt',
        code: 'HK261_BCTT',
        type: 'BCTT',
        openDate: '2000-01-01',
        closeDate: '2099-12-31',
        status: 'OPEN',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prd_2026_hk1_kltn',
        code: 'HK261_KLTN',
        type: 'KLTN',
        openDate: '2000-01-01',
        closeDate: '2099-12-31',
        status: 'OPEN',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prd_2026_hk2_bctt',
        code: 'HK262_BCTT',
        type: 'BCTT',
        openDate: '2000-01-01',
        closeDate: '2099-12-31',
        status: 'CLOSED',
        isActive: false,
        createdAt: now,
        updatedAt: now,
      },
    ];

    revisionRoundsData = [];

    const topicsRepositoryMock = {
      findAll: jest.fn(async () => topicsData),
      findById: jest.fn(
        async (id: string) => topicsData.find((topic) => topic.id === id) ?? null,
      ),
      findFirst: jest.fn(
        async (predicate: (topic: TopicRecord) => boolean) =>
          topicsData.find(predicate) ?? null,
      ),
      create: jest.fn(async (entity: TopicRecord) => {
        topicsData.push(entity);
        return entity;
      }),
      update: jest.fn(async (id: string, entity: TopicRecord) => {
        const index = topicsData.findIndex((topic) => topic.id === id);
        if (index < 0) {
          throw new Error(`Topic ${id} not found`);
        }
        topicsData[index] = entity;
        return entity;
      }),
    };

    const revisionRoundsRepositoryMock = {
      findWhere: jest.fn(
        async (predicate: (round: RevisionRoundRecord) => boolean) =>
          revisionRoundsData.filter(predicate),
      ),
      findById: jest.fn(
        async (id: string) =>
          revisionRoundsData.find((round) => round.id === id) ?? null,
      ),
      create: jest.fn(async (entity: RevisionRoundRecord) => {
        revisionRoundsData.push(entity);
        return entity;
      }),
      update: jest.fn(async (id: string, entity: RevisionRoundRecord) => {
        const index = revisionRoundsData.findIndex((round) => round.id === id);
        if (index < 0) {
          throw new Error(`Revision round ${id} not found`);
        }
        revisionRoundsData[index] = entity;
        return entity;
      }),
    };

    const periodsRepositoryMock = {
      findById: jest.fn(
        async (id: string) => periodsData.find((period) => period.id === id) ?? null,
      ),
      findAll: jest.fn(async () => periodsData),
    };

    const usersRepositoryMock = {
      findById: jest.fn(
        async (id: string) => usersData.find((user) => user.id === id) ?? null,
      ),
      findAll: jest.fn(async () => usersData),
      update: jest.fn(async (id: string, entity: UserRecord) => {
        const index = usersData.findIndex((user) => user.id === id);
        if (index < 0) {
          throw new Error(`User ${id} not found`);
        }
        usersData[index] = entity;
        return entity;
      }),
    };

    const assignmentsRepositoryMock = {
      findAll: jest.fn(async () => assignmentsData),
    };

    const notificationsServiceMock = {
      create: jest.fn(async () => ({ id: 'nt_mock' })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TopicsService,
        { provide: TopicsRepository, useValue: topicsRepositoryMock },
        {
          provide: RevisionRoundsRepository,
          useValue: revisionRoundsRepositoryMock,
        },
        { provide: PeriodsRepository, useValue: periodsRepositoryMock },
        { provide: UsersRepository, useValue: usersRepositoryMock },
        { provide: AssignmentsRepository, useValue: assignmentsRepositoryMock },
        { provide: NotificationsService, useValue: notificationsServiceMock },
      ],
    }).compile();

    service = module.get<TopicsService>(TopicsService);
  });

  describe('findAll', () => {
    it('should return all topics for TBM', async () => {
      const result = await service.findAll({}, tbmUser);

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should filter topics by type', async () => {
      const result = await service.findAll({ type: 'BCTT' }, tbmUser);

      expect(result.data.every((t) => t.type === 'BCTT')).toBe(true);
    });

    it('should filter topics by state', async () => {
      const result = await service.findAll({ state: 'PENDING_GV' }, tbmUser);

      expect(result.data.every((t) => t.state === 'PENDING_GV')).toBe(true);
    });

    it('should only return student own topics when role is STUDENT', async () => {
      const result = await service.findAll({}, studentUser);

      expect(result.data.every((t) => t.studentUserId === studentUser.userId)).toBe(true);
    });
  });

  describe('findById', () => {
    it('should return topic by ID', async () => {
      const result = await service.findById('tp_001');

      expect(result).toBeDefined();
      expect(result?.title).toBe('Xây dựng hệ thống quản lý thực tập');
    });

    it('should return null for non-existent ID', async () => {
      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdForUser', () => {
    it('should allow assigned reviewer to read topic details', async () => {
      const topic = await service.findByIdForUser('tp_003', gvpbUser);

      expect(topic.id).toBe('tp_003');
    });

    it('should allow assigned supervisor to read topic details', async () => {
      const topic = await service.findByIdForUser('tp_004', lecturerUser);

      expect(topic.id).toBe('tp_004');
    });

    it('should reject unassigned lecturer from reading topic details', async () => {
      await expect(
        service.findByIdForUser('tp_003', unassignedLecturerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject lecturer listed as supervisor when no ACTIVE assignment exists', async () => {
      topicsData.push({
        id: 'tp_unassigned_supervisor',
        type: 'BCTT',
        title: 'Supervisor set but assignment missing',
        domain: 'Software Engineering',
        state: 'PENDING_GV',
        studentUserId: 'USR005',
        supervisorUserId: 'USR014',
        periodId: 'prd_2026_hk1_bctt',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await expect(
        service.findByIdForUser('tp_unassigned_supervisor', unassignedLecturerUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('should throw ForbiddenException if non-student creates topic', async () => {
      await expect(
        service.create(
          {
            type: 'BCTT',
            title: 'Test topic',
            domain: 'Test',
            periodId: 'prd_123',
            supervisorUserId: 'USR002',
          },
          lecturerUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException for duplicate active topic', async () => {
      await expect(
        service.create(
          {
            type: 'BCTT',
            title: 'Another BCTT',
            domain: 'Test',
            periodId: 'prd_2026_hk1_bctt',
            supervisorUserId: 'USR002',
          },
          studentUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when period does not exist', async () => {
      const newStudent: AuthUser = {
        userId: 'USR_PERIOD_MISSING',
        email: 'new@hcmute.edu.vn',
        role: 'STUDENT',
      };

      await expect(
        service.create(
          {
            type: 'BCTT',
            title: 'BCTT Topic',
            domain: 'Test',
            periodId: 'prd_not_found',
            supervisorUserId: 'USR002',
          },
          newStudent,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when period type mismatches topic type', async () => {
      const newStudent: AuthUser = {
        userId: 'USR_PERIOD_MISMATCH',
        email: 'new@hcmute.edu.vn',
        role: 'STUDENT',
      };

      await expect(
        service.create(
          {
            type: 'KLTN',
            title: 'KLTN Topic',
            domain: 'Test',
            periodId: 'prd_2026_hk1_bctt',
            supervisorUserId: 'USR002',
          },
          newStudent,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when registration period is not open', async () => {
      const newStudent: AuthUser = {
        userId: 'USR_PERIOD_CLOSED',
        email: 'new@hcmute.edu.vn',
        role: 'STUDENT',
      };

      await expect(
        service.create(
          {
            type: 'BCTT',
            title: 'BCTT Topic',
            domain: 'Test',
            periodId: 'prd_2026_hk2_bctt',
            supervisorUserId: 'USR002',
          },
          newStudent,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for KLTN without completed BCTT', async () => {
      const newStudent: AuthUser = {
        userId: 'USR_NEW',
        email: 'new@hcmute.edu.vn',
        role: 'STUDENT',
      };

      await expect(
        service.create(
          {
            type: 'KLTN',
            title: 'KLTN Topic',
            domain: 'Test',
            periodId: 'prd_2026_hk1_kltn',
            supervisorUserId: 'USR002',
          },
          newStudent,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should enforce single active workflow across topic types', async () => {
      await expect(
        service.create(
          {
            type: 'KLTN',
            title: 'KLTN while BCTT active',
            domain: 'Test',
            periodId: 'prd_2026_hk1_kltn',
            supervisorUserId: 'USR002',
          },
          studentUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when KLTN score eligibility is not met', async () => {
      const lowEligibilityStudent: AuthUser = {
        userId: 'USR004',
        email: 'low-eligibility@hcmute.edu.vn',
        role: 'STUDENT',
      };

      const activeTopic = topicsData.find(
        (topic) =>
          topic.studentUserId === lowEligibilityStudent.userId &&
          topic.state !== 'COMPLETED' &&
          topic.state !== 'CANCELLED',
      );
      if (activeTopic) {
        activeTopic.state = 'COMPLETED';
      }

      topicsData.push({
        id: 'tp_low_eligibility_bctt',
        periodId: 'prd_2026_hk1_bctt',
        studentUserId: lowEligibilityStudent.userId,
        supervisorUserId: 'USR002',
        type: 'BCTT' as const,
        title: 'Completed BCTT for eligibility check',
        domain: 'Software Engineering',
        state: 'COMPLETED' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await expect(
        service.create(
          {
            type: 'KLTN',
            title: 'KLTN Topic',
            domain: 'Test',
            periodId: 'prd_2026_hk1_kltn',
            supervisorUserId: 'USR002',
          },
          lowEligibilityStudent,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(
        service.update('nonexistent', { title: 'New title' }, tbmUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when editing non-editable state', async () => {
      // tp_001 is IN_PROGRESS which is not editable
      await expect(
        service.update('tp_001', { title: 'New title' }, tbmUser),
      ).rejects.toThrow(ConflictException);
    });

    it('should update topic in PENDING_GV state', async () => {
      const result = await service.update(
        'tp_002',
        { title: 'Updated title' },
        tbmUser,
      );

      expect(result.updated).toBe(true);
    });

    it('should throw ForbiddenException when student edits other topic', async () => {
      const otherStudent: AuthUser = {
        userId: 'USR_OTHER',
        email: 'other@hcmute.edu.vn',
        role: 'STUDENT',
      };

      await expect(
        service.update('tp_002', { title: 'New title' }, otherStudent),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('approve', () => {
    it('should approve topic in PENDING_GV state', async () => {
      const result = await service.approve('tp_002', undefined, lecturerUser);

      expect(result.state).toBe('CONFIRMED');
    });

    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(
        service.approve('nonexistent', undefined, lecturerUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if non-supervisor approves', async () => {
      const otherLecturer: AuthUser = {
        userId: 'USR_OTHER',
        email: 'other@hcmute.edu.vn',
        role: 'LECTURER',
      };

      // First reset the topic state
      const topic = await service.findById('tp_002');
      if (topic) {
        topic.state = 'PENDING_GV';
      }

      await expect(
        service.approve('tp_002', undefined, otherLecturer),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('reject', () => {
    it('should reject topic in PENDING_GV state', async () => {
      // Reset state for test
      const topic = await service.findById('tp_002');
      if (topic) {
        topic.state = 'PENDING_GV';
      }

      const result = await service.reject(
        'tp_002',
        'Scope too broad',
        lecturerUser,
      );

      expect(result.state).toBe('DRAFT');
    });

    it('should throw ConflictException when rejecting non-PENDING_GV topic', async () => {
      await expect(
        service.reject('tp_001', 'Reason', lecturerUser),
      ).rejects.toThrow(ConflictException);
    });

    it('should forbid TBM from early-phase reject endpoint', async () => {
      await expect(service.reject('tp_002', 'TBM reject', tbmUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should keep KLTN IN_PROGRESS topic in deterministic IN_PROGRESS reject branch', async () => {
      const topic = await service.findById('tp_004');
      if (topic) {
        topic.state = 'IN_PROGRESS';
      }

      const result = await service.reject(
        'tp_004',
        'Need to revise proposal before confirmation',
        lecturerUser,
      );

      expect(result.state).toBe('IN_PROGRESS');
    });

    it('should forbid TBM from rejecting KLTN IN_PROGRESS in early phase', async () => {
      const topic = await service.findById('tp_004');
      if (topic) {
        topic.state = 'IN_PROGRESS';
      }

      await expect(
        service.reject('tp_004', 'TBM cannot reject early phase', tbmUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('setDeadline', () => {
    it('should set deadline for topic in allowed state', async () => {
      const result = await service.setDeadline(
        'tp_001',
        {
          submitStartAt: '2026-06-01T00:00:00Z',
          submitEndAt: '2026-06-30T23:59:59Z',
        },
        lecturerUser,
      );

      expect(result.deadlineUpdated).toBe(true);
    });

    it('should throw BadRequestException for invalid date range', async () => {
      await expect(
        service.setDeadline(
          'tp_001',
          {
            submitStartAt: '2026-06-30T00:00:00Z',
            submitEndAt: '2026-06-01T00:00:00Z',
          },
          lecturerUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when non-supervisor sets deadline', async () => {
      await expect(
        service.setDeadline(
          'tp_001',
          {
            submitStartAt: '2026-06-01T00:00:00Z',
            submitEndAt: '2026-06-30T23:59:59Z',
          },
          studentUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException when reopening before current deadline ends', async () => {
      const topic = await service.findById('tp_001');
      if (topic) {
        topic.submitEndAt = '2099-01-01T00:00:00Z';
      }

      await expect(
        service.setDeadline(
          'tp_001',
          {
            submitStartAt: '2099-01-02T00:00:00Z',
            submitEndAt: '2099-01-20T23:59:59Z',
            action: 'REOPEN',
          },
          lecturerUser,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('transition', () => {
    it('should transition topic state', async () => {
      const result = await service.transition(
        'tp_001',
        'MOVE_TO_GRADING',
        lecturerUser,
      );

      expect(result.fromState).toBe('IN_PROGRESS');
      expect(result.toState).toBe('GRADING');
    });

    it('should allow KLTN assigned supervisor to request confirmation', async () => {
      const topic = await service.findById('tp_004');
      if (topic) {
        topic.state = 'IN_PROGRESS';
      }

      const result = await service.transition(
        'tp_004',
        'REQUEST_CONFIRM',
        lecturerUser,
      );

      expect(result.fromState).toBe('IN_PROGRESS');
      expect(result.toState).toBe('PENDING_CONFIRM');
    });

    it('should reject KLTN student owner requesting confirmation directly', async () => {
      const topic = await service.findById('tp_004');
      if (topic) {
        topic.state = 'IN_PROGRESS';
      }

      await expect(
        service.transition('tp_004', 'REQUEST_CONFIRM', student5User),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow assigned GVPB to confirm KLTN defense schedule', async () => {
      const result = await service.transition('tp_003', 'CONFIRM_DEFENSE', gvpbUser);

      expect(result.fromState).toBe('PENDING_CONFIRM');
      expect(result.toState).toBe('DEFENSE');
    });

    it('should still allow TBM to confirm KLTN defense schedule as override', async () => {
      const result = await service.transition('tp_003', 'CONFIRM_DEFENSE', tbmUser);

      expect(result.fromState).toBe('PENDING_CONFIRM');
      expect(result.toState).toBe('DEFENSE');
    });

    it('should allow assigned reviewer/council member to start KLTN scoring', async () => {
      const topic = await service.findById('tp_003');
      if (topic) {
        topic.state = 'DEFENSE';
      }

      const result = await service.transition('tp_003', 'START_SCORING', gvpbUser);

      expect(result.fromState).toBe('DEFENSE');
      expect(result.toState).toBe('SCORING');
    });

    it('should reject TBM starting KLTN scoring without topic assignment role', async () => {
      const topic = await service.findById('tp_003');
      if (topic) {
        topic.state = 'DEFENSE';
      }

      await expect(
        service.transition('tp_003', 'START_SCORING', tbmUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow assigned CT_HD to complete KLTN after scoring', async () => {
      const topic = await service.findById('tp_003');
      if (topic) {
        topic.state = 'SCORING';
      }

      const result = await service.transition('tp_003', 'COMPLETE', ctHdUser);

      expect(result.fromState).toBe('SCORING');
      expect(result.toState).toBe('COMPLETED');
    });

    it('should allow assigned supervisor to complete BCTT after grading', async () => {
      const topic = await service.findById('tp_001');
      if (topic) {
        topic.state = 'GRADING';
      }

      const result = await service.transition('tp_001', 'COMPLETE', lecturerUser);

      expect(result.fromState).toBe('GRADING');
      expect(result.toState).toBe('COMPLETED');
    });

    it('should reject TBM completing KLTN without CT_HD assignment role', async () => {
      const topic = await service.findById('tp_003');
      if (topic) {
        topic.state = 'SCORING';
      }

      await expect(
        service.transition('tp_003', 'COMPLETE', tbmUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject unassigned lecturer confirming KLTN defense', async () => {
      await expect(
        service.transition('tp_003', 'CONFIRM_DEFENSE', unassignedLecturerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException for invalid transition', async () => {
      await expect(
        service.transition('tp_001', 'APPROVE', lecturerUser),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(
        service.transition('nonexistent', 'APPROVE', lecturerUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject transition REJECT alias in early phase with POLICY_CONFLICT', async () => {
      await expect(service.transition('tp_002', 'REJECT', lecturerUser)).rejects.toMatchObject(
        {
          response: expect.objectContaining({
            error: 'POLICY_CONFLICT',
          }),
        },
      );
    });

    it('should allow assigned GVPB to reject pending-confirm back to IN_PROGRESS via canonical reject endpoint', async () => {
      const result = await service.reject('tp_003', 'Need revisions', gvpbUser);

      expect(result.state).toBe('IN_PROGRESS');
    });

    it('should allow assigned TK_HD to reject pending-confirm back to IN_PROGRESS via canonical reject endpoint', async () => {
      const result = await service.reject('tp_003', 'Need more evidence', tkHdUser);

      expect(result.state).toBe('IN_PROGRESS');
    });

    it('should allow TBM to reject pending-confirm back to IN_PROGRESS in later phase', async () => {
      const result = await service.reject('tp_003', 'TBM review loopback', tbmUser);

      expect(result.state).toBe('IN_PROGRESS');
    });

    it('should reject pending-confirm reject when lecturer has no active assignment role', async () => {
      await expect(
        service.reject('tp_003', 'No assignment', unassignedLecturerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return STALE_WRITE on same-topic concurrent transitions with same expectedState', async () => {
      const [first, second] = await Promise.allSettled([
        service.transition('tp_004', 'START_PROGRESS', lecturerUser, {
          expectedState: 'CONFIRMED',
        }),
        service.transition('tp_004', 'CANCEL', lecturerUser, {
          expectedState: 'CONFIRMED',
        }),
      ]);

      const fulfilled = [first, second].filter((result) => result.status === 'fulfilled');
      const rejected = [first, second].filter((result) => result.status === 'rejected') as Array<PromiseRejectedResult>;

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toMatchObject({
        response: expect.objectContaining({
          error: 'STALE_WRITE',
          topicId: 'tp_004',
          expectedState: 'CONFIRMED',
          actualState: expect.any(String),
          retryable: true,
        }),
      });
    });

    it('should allow different-topic transitions to run in parallel', async () => {
      const serviceInternals = service as unknown as {
        topicsRepository: { update: jest.Mock };
      };
      const updateMock = serviceInternals.topicsRepository.update;
      const originalImplementation = updateMock.getMockImplementation();

      let inFlight = 0;
      let maxInFlight = 0;

      updateMock.mockImplementation(async (id: string, entity: TopicRecord) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);

        await new Promise((resolve) => setTimeout(resolve, 25));

        const index = topicsData.findIndex((topic) => topic.id === id);
        topicsData[index] = entity;

        inFlight -= 1;
        return entity;
      });

      await Promise.all([
        service.transition('tp_004', 'START_PROGRESS', lecturerUser, {
          expectedState: 'CONFIRMED',
        }),
        service.transition('tp_005', 'START_PROGRESS', lecturerUser, {
          expectedState: 'CONFIRMED',
        }),
      ]);

      updateMock.mockImplementation(originalImplementation);

      expect(maxInFlight).toBeGreaterThan(1);
    });
  });

  describe('mapToDto', () => {
    it('should map TopicRecord to TopicResponseDto correctly', () => {
      const topic = {
        id: 'tp_test',
        type: 'BCTT' as const,
        title: 'Test Topic',
        domain: 'Test Domain',
        companyName: 'Test Co',
        state: 'DRAFT' as const,
        studentUserId: 'USR001',
        supervisorUserId: 'USR002',
        periodId: 'prd_123',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const dto = service.mapToDto(topic);

      expect(dto.id).toBe(topic.id);
      expect(dto.type).toBe(topic.type);
      expect(dto.title).toBe(topic.title);
      expect(dto.domain).toBe(topic.domain);
      expect(dto.state).toBe(topic.state);
    });
  });
});
