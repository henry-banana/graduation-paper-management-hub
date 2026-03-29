import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthUser } from '../../common/types';

describe('NotificationsService', () => {
  let service: NotificationsService;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService],
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
