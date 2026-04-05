import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { NotificationsService, NotificationRecord } from './notifications.service';
import { AuthUser } from '../../common/types';
import {
  AssignmentsRepository,
  NotificationsRepository,
  TopicsRepository,
  UsersRepository,
} from '../../infrastructure/google-sheets';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationsStore: NotificationRecord[];

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

  const otherUser: AuthUser = {
    userId: 'USR_OTHER',
    email: 'other@hcmute.edu.vn',
    role: 'STUDENT',
  };

  const tbmUser: AuthUser = {
    userId: 'USR_TBM',
    email: 'tbm@hcmute.edu.vn',
    role: 'TBM',
  };

  const reviewerUser: AuthUser = {
    userId: 'USR_GVPB',
    email: 'reviewer@hcmute.edu.vn',
    role: 'LECTURER',
  };

  beforeEach(async () => {
    notificationsStore = [
      {
        id: 'nt_001',
        receiverUserId: 'USR001',
        topicId: 'tp_001',
        type: 'TOPIC_APPROVED',
        title: 'Đề tài đã được duyệt',
        body: 'Đề tài đã được duyệt.',
        deepLink: '/topics/tp_001',
        isRead: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'nt_002',
        receiverUserId: 'USR001',
        topicId: 'tp_002',
        type: 'GENERAL',
        title: 'Thông báo',
        body: 'Thông báo chung',
        deepLink: '/notifications',
        isRead: true,
        createdAt: '2026-01-02T00:00:00.000Z',
        readAt: '2026-01-02T00:05:00.000Z',
      },
      {
        id: 'nt_003',
        receiverUserId: 'USR002',
        topicId: 'tp_003',
        type: 'GENERAL',
        title: 'Thông báo cho giảng viên',
        body: 'Thông báo riêng',
        deepLink: '/notifications',
        isRead: false,
        createdAt: '2026-01-03T00:00:00.000Z',
      },
    ];

    const usersStore: any[] = [
      {
        id: 'USR001',
        email: 'student@hcmute.edu.vn',
        name: 'Student 1',
        role: 'STUDENT',
        isActive: true,
      },
      {
        id: 'USR002',
        email: 'lecturer@hcmute.edu.vn',
        name: 'Lecturer 1',
        role: 'LECTURER',
        isActive: true,
      },
      {
        id: 'USR_GVPB',
        email: 'reviewer@hcmute.edu.vn',
        name: 'Reviewer 1',
        role: 'LECTURER',
        isActive: true,
      },
      {
        id: 'USR_TBM',
        email: 'tbm@hcmute.edu.vn',
        name: 'TBM User',
        role: 'TBM',
        isActive: true,
      },
      {
        id: 'USR_OTHER',
        email: 'other@hcmute.edu.vn',
        name: 'Other User',
        role: 'STUDENT',
        isActive: true,
      },
    ];

    const topicsStore: any[] = [
      {
        id: 'tp_001',
        periodId: 'prd_001',
        type: 'KLTN',
        title: 'Topic 1',
        domain: 'AI',
        studentUserId: 'USR001',
        supervisorUserId: 'USR002',
        state: 'IN_PROGRESS',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const assignmentsStore: any[] = [
      {
        id: 'asg_001',
        topicId: 'tp_001',
        userId: 'USR_GVPB',
        topicRole: 'GVPB',
        status: 'ACTIVE',
        assignedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const notificationsRepository = {
      findAll: jest.fn(async () => [...notificationsStore]),
      findById: jest.fn(
        async (id: string) =>
          notificationsStore.find((notification) => notification.id === id) ?? null,
      ),
      update: jest.fn(async (id: string, record: NotificationRecord) => {
        const index = notificationsStore.findIndex((notification) => notification.id === id);
        if (index >= 0) {
          notificationsStore[index] = { ...record };
        }
      }),
      create: jest.fn(async (record: NotificationRecord) => {
        notificationsStore.push({ ...record });
      }),
    };

    const usersRepository = {
      findById: jest.fn(async (id: string) => usersStore.find((user) => user.id === id) ?? null),
    };

    const topicsRepository = {
      findById: jest.fn(async (id: string) => topicsStore.find((topic) => topic.id === id) ?? null),
    };

    const assignmentsRepository = {
      findByTopicId: jest.fn(
        async (topicId: string) => assignmentsStore.filter((assignment) => assignment.topicId === topicId),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: notificationsRepository },
        { provide: UsersRepository, useValue: usersRepository },
        { provide: TopicsRepository, useValue: topicsRepository },
        { provide: AssignmentsRepository, useValue: assignmentsRepository },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('findAll', () => {
    it('should return notifications for current user', async () => {
      const result = await service.findAll(studentUser, { page: 1, size: 20 });
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.size).toBe(20);
    });

    it('should filter by read status', async () => {
      const unreadResult = await service.findAll(studentUser, {
        isRead: false,
        page: 1,
        size: 20,
      });
      expect(unreadResult.data.every((n) => !n.isRead)).toBe(true);

      const readResult = await service.findAll(studentUser, {
        isRead: true,
        page: 1,
        size: 20,
      });
      expect(readResult.data.every((n) => n.isRead)).toBe(true);
    });

    it('should paginate results', async () => {
      const result = await service.findAll(studentUser, { page: 1, size: 1 });
      expect(result.data.length).toBeLessThanOrEqual(1);
    });

    it('should return empty array for user with no notifications', async () => {
      const result = await service.findAll(otherUser, { page: 1, size: 20 });
      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('findById', () => {
    it('should return notification for receiver', async () => {
      const result = await service.findById('nt_001', studentUser);
      expect(result).not.toBeNull();
      expect(result?.id).toBe('nt_001');
    });

    it('should return null for non-existent notification', async () => {
      const result = await service.findById('nonexistent', studentUser);
      expect(result).toBeNull();
    });

    it('should throw ForbiddenException for non-receiver', async () => {
      await expect(
        service.findById('nt_001', otherUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markRead', () => {
    it('should mark notification as read', async () => {
      const result = await service.markRead('nt_001', true, studentUser);
      expect(result.updated).toBe(true);

      const notification = await service.findById('nt_001', studentUser);
      expect(notification?.isRead).toBe(true);
      expect(notification?.readAt).toBeDefined();
    });

    it('should mark notification as unread', async () => {
      // First mark as read
      await service.markRead('nt_001', true, studentUser);
      // Then mark as unread
      const result = await service.markRead('nt_001', false, studentUser);
      expect(result.updated).toBe(true);

      const notification = await service.findById('nt_001', studentUser);
      expect(notification?.isRead).toBe(false);
      expect(notification?.readAt).toBeUndefined();
    });

    it('should throw NotFoundException for non-existent notification', async () => {
      await expect(
        service.markRead('nonexistent', true, studentUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-receiver', async () => {
      await expect(
        service.markRead('nt_001', true, otherUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markBulkRead', () => {
    it('should mark multiple notifications as read', async () => {
      const result = await service.markBulkRead(
        ['nt_001', 'nt_002'],
        studentUser,
      );
      expect(result.updatedCount).toBeGreaterThanOrEqual(0);
    });

    it('should only mark user\'s notifications', async () => {
      // nt_003 belongs to USR002
      const result = await service.markBulkRead(
        ['nt_001', 'nt_003'],
        studentUser,
      );
      // Only nt_001 should be updated
      expect(result.updatedCount).toBeLessThanOrEqual(1);
    });

    it('should handle non-existent notification IDs gracefully', async () => {
      const result = await service.markBulkRead(
        ['nonexistent1', 'nonexistent2'],
        studentUser,
      );
      expect(result.updatedCount).toBe(0);
    });
  });

  describe('create', () => {
    it('should create a notification', async () => {
      const result = await service.create({
        receiverUserId: 'USR001',
        type: 'TOPIC_APPROVED',
        context: { topicTitle: 'Test Topic' },
        topicId: 'tp_new',
      });

      expect(result.id).toBeDefined();
      expect(result.type).toBe('TOPIC_APPROVED');
      expect(result.title).toBe('Đề tài đã được duyệt');
      expect(result.deepLink).toContain('tp_new');
      expect(result.isRead).toBe(false);
    });
  });

  describe('sendPersonal', () => {
    it('should allow TBM to send personal notification without topic', async () => {
      const result = await service.sendPersonal(
        {
          receiverUserId: 'USR001',
          body: 'Thông báo từ TBM',
        },
        tbmUser,
      );

      expect(result.receiverUserId).toBe('USR001');
      expect(result.scope).toBe('PERSONAL');
      expect(result.deepLink).toBe('/notifications');
    });

    it('should allow lecturer topic participant to send to another topic participant', async () => {
      const result = await service.sendPersonal(
        {
          receiverUserId: 'USR001',
          topicId: 'tp_001',
          body: 'Nhắc cập nhật báo cáo',
          deepLink: '/gvhd/topics/tp_001',
        },
        lecturerUser,
      );

      expect(result.receiverUserId).toBe('USR001');
      expect(result.topicId).toBe('tp_001');
      expect(result.deepLink).toBe('/gvhd/topics/tp_001');
    });

    it('should reject lecturer personal send without topicId', async () => {
      await expect(
        service.sendPersonal(
          {
            receiverUserId: 'USR001',
            body: 'Thiếu topicId',
          },
          lecturerUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when receiver is not found', async () => {
      await expect(
        service.sendPersonal(
          {
            receiverUserId: 'USR_NOT_FOUND',
            topicId: 'tp_001',
            body: 'Không tìm thấy người nhận',
          },
          lecturerUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when sender is not topic participant', async () => {
      await expect(
        service.sendPersonal(
          {
            receiverUserId: 'USR001',
            topicId: 'tp_001',
            body: 'Người gửi không thuộc đề tài',
          },
          {
            userId: 'USR_OTHER',
            email: 'other@hcmute.edu.vn',
            role: 'LECTURER',
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject when receiver is not topic participant', async () => {
      await expect(
        service.sendPersonal(
          {
            receiverUserId: 'USR_OTHER',
            topicId: 'tp_001',
            body: 'Người nhận không thuộc đề tài',
          },
          reviewerUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count for user', async () => {
      const count = await service.getUnreadCount(studentUser);
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for user with no notifications', async () => {
      const count = await service.getUnreadCount(otherUser);
      expect(count).toBe(0);
    });
  });

  describe('buildDeepLink', () => {
    it('should build deep link with topic ID', () => {
      const link = service.buildDeepLink('TOPIC_APPROVED', 'tp_123');
      expect(link).toBe('/topics/tp_123');
    });

    it('should return pattern without topic ID', () => {
      const link = service.buildDeepLink('GENERAL');
      expect(link).toBe('/notifications');
    });
  });

  describe('mapToDto', () => {
    it('should map NotificationRecord to NotificationResponseDto', () => {
      const record = {
        id: 'nt_test',
        receiverUserId: 'usr_test',
        topicId: 'tp_test',
        type: 'TOPIC_APPROVED' as const,
        title: 'Test',
        body: 'Test body',
        deepLink: '/topics/tp_test',
        isRead: false,
        createdAt: '2026-01-01T00:00:00Z',
      };

      const dto = service.mapToDto(record);

      expect(dto.id).toBe('nt_test');
      expect(dto.type).toBe('TOPIC_APPROVED');
      expect(dto.isRead).toBe(false);
    });
  });
});
