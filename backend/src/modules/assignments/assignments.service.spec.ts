import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { AssignmentsService, AssignmentRecord } from './assignments.service';
import { AuthUser } from '../../common/types';
import {
  AssignmentsRepository,
  SchedulesRepository,
  TopicsRepository,
  UsersRepository,
} from '../../infrastructure/google-sheets';
import { NotificationsService } from '../notifications/notifications.service';
import { TopicRecord } from '../topics/topics.service';
import { UserRecord } from '../users/users.service';

describe('AssignmentsService', () => {
  let service: AssignmentsService;
  let assignmentsData: AssignmentRecord[];
  let topicsData: TopicRecord[];
  let usersData: UserRecord[];

  const tbmUser: AuthUser = {
    userId: 'USR_TBM',
    email: 'tbm@hcmute.edu.vn',
    role: 'TBM',
  };

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

  beforeEach(async () => {
    assignmentsData = [
      {
        id: 'as_001',
        topicId: 'tp_001',
        userId: 'USR002',
        topicRole: 'GVHD',
        status: 'ACTIVE',
        assignedAt: '2026-01-15T10:00:00Z',
      },
    ];

    topicsData = [
      {
        id: 'tp_001',
        periodId: 'pd_001',
        type: 'KLTN',
        title: 'KLTN Topic 1',
        domain: 'AI',
        studentUserId: 'USR001',
        supervisorUserId: 'USR002',
        state: 'CONFIRMED',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'tp_002',
        periodId: 'pd_001',
        type: 'BCTT',
        title: 'BCTT Topic 2',
        domain: 'Web',
        studentUserId: 'USR001',
        supervisorUserId: 'USR002',
        state: 'CONFIRMED',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    usersData = [
      {
        id: 'USR001',
        email: 'student@hcmute.edu.vn',
        name: 'Student 1',
        role: 'STUDENT',
      },
      {
        id: 'USR002',
        email: 'lecturer@hcmute.edu.vn',
        name: 'Lecturer 1',
        role: 'LECTURER',
        totalQuota: 10,
        quotaUsed: 1,
      },
      {
        id: 'USR_TBM',
        email: 'tbm@hcmute.edu.vn',
        name: 'TBM',
        role: 'TBM',
      },
      {
        id: 'USR_GVPB_1',
        email: 'gvpb1@hcmute.edu.vn',
        name: 'GVPB 1',
        role: 'LECTURER',
        totalQuota: 10,
        quotaUsed: 0,
      },
      {
        id: 'USR_CT_1',
        email: 'ct1@hcmute.edu.vn',
        name: 'CT 1',
        role: 'LECTURER',
        totalQuota: 10,
        quotaUsed: 0,
      },
      {
        id: 'USR_TK_1',
        email: 'tk1@hcmute.edu.vn',
        name: 'TK 1',
        role: 'LECTURER',
        totalQuota: 10,
        quotaUsed: 0,
      },
      {
        id: 'USR_TV_1',
        email: 'tv1@hcmute.edu.vn',
        name: 'TV 1',
        role: 'LECTURER',
        totalQuota: 10,
        quotaUsed: 0,
      },
      {
        id: 'USR_TV_2',
        email: 'tv2@hcmute.edu.vn',
        name: 'TV 2',
        role: 'LECTURER',
        totalQuota: 10,
        quotaUsed: 0,
      },
      {
        id: 'USR_TV_3',
        email: 'tv3@hcmute.edu.vn',
        name: 'TV 3',
        role: 'LECTURER',
        totalQuota: 10,
        quotaUsed: 0,
      },
      {
        id: 'USR_NEW_1',
        email: 'new1@hcmute.edu.vn',
        name: 'New Lecturer 1',
        role: 'LECTURER',
        totalQuota: 10,
        quotaUsed: 0,
      },
      {
        id: 'USR_QUOTA_FULL',
        email: 'full@hcmute.edu.vn',
        name: 'Quota Full',
        role: 'LECTURER',
        totalQuota: 1,
        quotaUsed: 1,
      },
    ];

    const assignmentsRepositoryMock = {
      findAll: jest.fn(async () => assignmentsData),
      findById: jest.fn(
        async (id: string) =>
          assignmentsData.find((assignment) => assignment.id === id) ?? null,
      ),
      create: jest.fn(async (entity: AssignmentRecord) => {
        assignmentsData.push(entity);
        return entity;
      }),
      update: jest.fn(async (id: string, entity: AssignmentRecord) => {
        const index = assignmentsData.findIndex((assignment) => assignment.id === id);
        if (index < 0) {
          throw new Error(`Assignment ${id} not found`);
        }
        assignmentsData[index] = entity;
        return entity;
      }),
    };

    const topicsRepositoryMock = {
      findById: jest.fn(async (id: string) => topicsData.find((topic) => topic.id === id) ?? null),
    };

    const usersRepositoryMock = {
      findById: jest.fn(async (id: string) => usersData.find((user) => user.id === id) ?? null),
      update: jest.fn(async (id: string, entity: UserRecord) => {
        const index = usersData.findIndex((user) => user.id === id);
        if (index < 0) {
          throw new Error(`User ${id} not found`);
        }
        usersData[index] = entity;
        return entity;
      }),
    };

    const schedulesRepositoryMock = {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async (entity: unknown) => entity),
      update: jest.fn(async (_id: string, entity: unknown) => entity),
    };

    const notificationsServiceMock = {
      create: jest.fn(async () => ({ id: 'nt_mock' })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: AssignmentsRepository, useValue: assignmentsRepositoryMock },
        { provide: SchedulesRepository, useValue: schedulesRepositoryMock },
        { provide: TopicsRepository, useValue: topicsRepositoryMock },
        { provide: UsersRepository, useValue: usersRepositoryMock },
        { provide: NotificationsService, useValue: notificationsServiceMock },
      ],
    }).compile();

    service = module.get<AssignmentsService>(AssignmentsService);
  });

  describe('findByTopicId', () => {
    it('should return assignments for TBM', async () => {
      const result = await service.findByTopicId('tp_001', tbmUser);
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should return assignments for student who owns the topic', async () => {
      const result = await service.findByTopicId('tp_001', studentUser);
      expect(result).toBeInstanceOf(Array);
    });

    it('should throw ForbiddenException for student viewing other topic', async () => {
      const otherStudent: AuthUser = {
        userId: 'USR_OTHER',
        email: 'other@hcmute.edu.vn',
        role: 'STUDENT',
      };
      await expect(
        service.findByTopicId('tp_001', otherStudent),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(service.findByTopicId('nonexistent', tbmUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assignGvpb', () => {
    it('should assign GVPB successfully for TBM', async () => {
      const result = await service.assignGvpb(
        'tp_001',
        { userId: 'USR_GVPB_1' },
        tbmUser,
      );
      expect(result.assignmentId).toBeDefined();
      expect(result.topicRole).toBe('GVPB');
    });

    it('should throw ForbiddenException for non-TBM', async () => {
      await expect(
        service.assignGvpb('tp_001', { userId: 'USR_GVPB_1' }, lecturerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(
        service.assignGvpb('nonexistent', { userId: 'USR_GVPB_1' }, tbmUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for BCTT topic', async () => {
      await expect(
        service.assignGvpb('tp_002', { userId: 'USR_GVPB_1' }, tbmUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if GVHD is assigned as GVPB', async () => {
      await expect(
        service.assignGvpb('tp_001', { userId: 'USR002' }, tbmUser),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if GVPB already exists', async () => {
      // Assign first GVPB
      await service.assignGvpb('tp_001', { userId: 'USR_GVPB_1' }, tbmUser);

      // Try to assign second GVPB
      await expect(
        service.assignGvpb('tp_001', { userId: 'USR_CT_1' }, tbmUser),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when lecturer quota is full', async () => {
      await expect(
        service.assignGvpb('tp_001', { userId: 'USR_QUOTA_FULL' }, tbmUser),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('assignCouncil', () => {
    it('should throw ForbiddenException for non-TBM', async () => {
      await expect(
        service.assignCouncil(
          'tp_001',
          {
            chairUserId: 'USR_CT_1',
            secretaryUserId: 'USR_TK_1',
            memberUserIds: ['USR_TV_1', 'USR_TV_2', 'USR_TV_3'],
            defenseAt: '2026-07-15T08:30:00.000Z',
            location: 'Phong B2-01',
          },
          lecturerUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(
        service.assignCouncil(
          'nonexistent',
          {
            chairUserId: 'USR_CT_1',
            secretaryUserId: 'USR_TK_1',
            memberUserIds: ['USR_TV_1', 'USR_TV_2', 'USR_TV_3'],
            defenseAt: '2026-07-15T08:30:00.000Z',
            location: 'Phong B2-01',
          },
          tbmUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for BCTT topic', async () => {
      await expect(
        service.assignCouncil(
          'tp_002',
          {
            chairUserId: 'USR_CT_1',
            secretaryUserId: 'USR_TK_1',
            memberUserIds: ['USR_TV_1', 'USR_TV_2', 'USR_TV_3'],
            defenseAt: '2026-07-15T08:30:00.000Z',
            location: 'Phong B2-01',
          },
          tbmUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException for duplicate members', async () => {
      const topic = topicsData.find((item) => item.id === 'tp_001');
      if (!topic) throw new Error('tp_001 fixture missing');
      topic.state = 'DEFENSE';

      await expect(
        service.assignCouncil(
          'tp_001',
          {
            chairUserId: 'USR_CT_1',
            secretaryUserId: 'USR_CT_1', // Duplicate
            memberUserIds: ['USR_TV_1', 'USR_TV_2', 'USR_TV_3'],
            defenseAt: '2026-07-15T08:30:00.000Z',
            location: 'Phong B2-01',
          },
          tbmUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if GVHD is in council', async () => {
      const topic = topicsData.find((item) => item.id === 'tp_001');
      if (!topic) throw new Error('tp_001 fixture missing');
      topic.state = 'DEFENSE';

      await expect(
        service.assignCouncil(
          'tp_001',
          {
            chairUserId: 'USR002', // GVHD of tp_001
            secretaryUserId: 'USR_TK_1',
            memberUserIds: ['USR_TV_1', 'USR_TV_2', 'USR_TV_3'],
            defenseAt: '2026-07-15T08:30:00.000Z',
            location: 'Phong B2-01',
          },
          tbmUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if GVPB is in council', async () => {
      const topic = topicsData.find((item) => item.id === 'tp_001');
      if (!topic) throw new Error('tp_001 fixture missing');
      topic.state = 'DEFENSE';

      await service.assignGvpb('tp_001', { userId: 'USR_GVPB_1' }, tbmUser);

      await expect(
        service.assignCouncil(
          'tp_001',
          {
            chairUserId: 'USR_GVPB_1',
            secretaryUserId: 'USR_TK_1',
            memberUserIds: ['USR_TV_1', 'USR_TV_2', 'USR_TV_3'],
            defenseAt: '2026-07-15T08:30:00.000Z',
            location: 'Phong B2-01',
          },
          tbmUser,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('replaceAssignment', () => {
    it('should throw ForbiddenException for non-TBM', async () => {
      await expect(
        service.replaceAssignment(
          'as_001',
          { newUserId: 'USR_NEW_1', reason: 'Test' },
          lecturerUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent assignment', async () => {
      await expect(
        service.replaceAssignment(
          'nonexistent',
          { newUserId: 'USR_NEW_1', reason: 'Test' },
          tbmUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when replacing with same user', async () => {
      await expect(
        service.replaceAssignment(
          'as_001',
          { newUserId: 'USR002', reason: 'Test' }, // USR002 is current assignee
          tbmUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when new user already has active role on topic', async () => {
      await service.assignGvpb('tp_001', { userId: 'USR_GVPB_1' }, tbmUser);

      await expect(
        service.replaceAssignment(
          'as_001',
          { newUserId: 'USR_GVPB_1', reason: 'Test' },
          tbmUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when replacing with quota-full lecturer', async () => {
      const created = await service.assignGvpb(
        'tp_001',
        { userId: 'USR_GVPB_1' },
        tbmUser,
      );

      await expect(
        service.replaceAssignment(
          created.assignmentId,
          { newUserId: 'USR_QUOTA_FULL', reason: 'Test' },
          tbmUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should successfully replace assignment', async () => {
      const result = await service.replaceAssignment(
        'as_001',
        { newUserId: 'USR_NEW_1', reason: 'Supervisor unavailable' },
        tbmUser,
      );
      expect(result.replaced).toBe(true);

      const oldQuota = usersData.find((user) => user.id === 'USR002');
      const newQuota = usersData.find((user) => user.id === 'USR_NEW_1');

      expect(oldQuota?.quotaUsed).toBe(0);
      expect(newQuota?.quotaUsed).toBe(1);
    });
  });

  describe('hasRoleOnTopic', () => {
    it('should return true if user has role on topic', async () => {
      const result = await service.hasRoleOnTopic('tp_001', 'USR002', ['GVHD']);
      expect(result).toBe(true);
    });

    it('should return false if user does not have role on topic', async () => {
      const result = await service.hasRoleOnTopic('tp_001', 'USR003', ['GVHD']);
      expect(result).toBe(false);
    });
  });

  describe('getUserRoleOnTopic', () => {
    it('should return role if user has assignment', async () => {
      const result = await service.getUserRoleOnTopic('tp_001', 'USR002');
      expect(result).toBe('GVHD');
    });

    it('should return null if user has no assignment', async () => {
      const result = await service.getUserRoleOnTopic('tp_001', 'USR999');
      expect(result).toBeNull();
    });
  });

  describe('mapToDto', () => {
    it('should map AssignmentRecord to AssignmentResponseDto', () => {
      const record = {
        id: 'as_test',
        topicId: 'tp_test',
        userId: 'usr_test',
        topicRole: 'GVHD' as const,
        status: 'ACTIVE' as const,
        assignedAt: '2026-01-01T00:00:00Z',
      };

      const dto = service.mapToDto(record);

      expect(dto.id).toBe('as_test');
      expect(dto.topicId).toBe('tp_test');
      expect(dto.userId).toBe('usr_test');
      expect(dto.topicRole).toBe('GVHD');
      expect(dto.status).toBe('ACTIVE');
    });
  });
});
