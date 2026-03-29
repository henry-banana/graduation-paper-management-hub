import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService, NotificationRecord } from './notifications.service';
import { AuthUser } from '../../common/types';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: jest.Mocked<NotificationsService>;

  const mockNotification: NotificationRecord = {
    id: 'nt_001',
    receiverUserId: 'USR001',
    topicId: 'tp_001',
    type: 'TOPIC_APPROVED',
    title: 'Đề tài đã được duyệt',
    body: 'Đề tài "Test" đã được duyệt.',
    deepLink: '/topics/tp_001',
    isRead: false,
    createdAt: '2026-06-10T10:00:00Z',
  };

  const studentUser: AuthUser = {
    userId: 'USR001',
    email: 'student@hcmute.edu.vn',
    role: 'STUDENT',
  };

  beforeEach(async () => {
    const mockNotificationsService = {
      findAll: jest.fn(),
      findById: jest.fn(),
      markRead: jest.fn(),
      markBulkRead: jest.fn(),
      getUnreadCount: jest.fn(),
      mapToDto: jest.fn((record: NotificationRecord) => ({
        id: record.id,
        receiverUserId: record.receiverUserId,
        topicId: record.topicId,
        type: record.type,
        title: record.title,
        body: record.body,
        deepLink: record.deepLink,
        isRead: record.isRead,
        createdAt: record.createdAt,
        readAt: record.readAt,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    notificationsService = module.get(NotificationsService);
  });

  describe('getNotifications', () => {
    it('should return notifications with pagination', async () => {
      notificationsService.findAll.mockResolvedValue({
        data: [notificationsService.mapToDto(mockNotification)],
        pagination: { page: 1, size: 20, total: 1 },
      });

      const result = await controller.getNotifications(
        { page: 1, size: 20 },
        studentUser,
      );

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.meta.requestId).toBeDefined();
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      notificationsService.getUnreadCount.mockResolvedValue(5);

      const result = await controller.getUnreadCount(studentUser);

      expect(result.data.unreadCount).toBe(5);
      expect(result.meta.requestId).toBeDefined();
    });
  });

  describe('getNotification', () => {
    it('should return notification by ID', async () => {
      notificationsService.findById.mockResolvedValue(mockNotification);

      const result = await controller.getNotification('nt_001', studentUser);

      expect(result.data.id).toBe('nt_001');
      expect(result.meta.requestId).toBeDefined();
    });

    it('should throw NotFoundException when notification not found', async () => {
      notificationsService.findById.mockResolvedValue(null);

      await expect(
        controller.getNotification('nonexistent', studentUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markRead', () => {
    it('should mark notification as read', async () => {
      notificationsService.markRead.mockResolvedValue({ updated: true });

      const result = await controller.markRead(
        'nt_001',
        { isRead: true },
        studentUser,
      );

      expect(result.data.updated).toBe(true);
      expect(result.meta.requestId).toBeDefined();
    });
  });

  describe('markBulkRead', () => {
    it('should mark multiple notifications as read', async () => {
      notificationsService.markBulkRead.mockResolvedValue({ updatedCount: 2 });

      const result = await controller.markBulkRead(
        { notificationIds: ['nt_001', 'nt_002'] },
        studentUser,
      );

      expect(result.data.updatedCount).toBe(2);
      expect(result.meta.requestId).toBeDefined();
    });
  });
});
