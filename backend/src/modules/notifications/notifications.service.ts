import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  NotificationResponseDto,
  NotificationScope,
  NotificationType,
  GetNotificationsQueryDto,
} from './dto';
import { AuthUser } from '../../common/types';
import { NotificationsRepository } from '../../infrastructure/google-sheets';

export interface NotificationRecord {
  id: string;
  receiverUserId: string;
  scope?: NotificationScope;
  topicId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  deepLink?: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

// Event templates for generating notifications
const NOTIFICATION_TEMPLATES: Record<
  NotificationType,
  { title: string; body: (ctx: Record<string, string>) => string; deepLinkPattern: string }
> = {
  TOPIC_APPROVED: {
    title: 'Đề tài đã được duyệt',
    body: (ctx) => `Đề tài "${ctx.topicTitle}" đã được GVHD phê duyệt.`,
    deepLinkPattern: '/topics/{topicId}',
  },
  TOPIC_REJECTED: {
    title: 'Đề tài bị từ chối',
    body: (ctx) => `Đề tài "${ctx.topicTitle}" đã bị từ chối. Lý do: ${ctx.reason || 'Không rõ'}`,
    deepLinkPattern: '/topics/{topicId}',
  },
  TOPIC_PENDING: {
    title: 'Đề tài mới chờ duyệt',
    body: (ctx) => `Sinh viên ${ctx.studentName} đã nộp đề tài "${ctx.topicTitle}" chờ bạn duyệt.`,
    deepLinkPattern: '/topics/{topicId}/review',
  },
  DEADLINE_SET: {
    title: 'Deadline đã được đặt',
    body: (ctx) => `Deadline nộp bài cho đề tài "${ctx.topicTitle}" là ${ctx.deadline}.`,
    deepLinkPattern: '/topics/{topicId}',
  },
  DEADLINE_REMINDER: {
    title: 'Nhắc nhở deadline',
    body: (ctx) => `Còn ${ctx.daysLeft} ngày để nộp bài cho đề tài "${ctx.topicTitle}".`,
    deepLinkPattern: '/topics/{topicId}/submissions',
  },
  DEADLINE_OVERDUE: {
    title: 'Đề tài đã quá hạn nộp',
    body: (ctx) =>
      `Đề tài "${ctx.topicTitle}" đã quá hạn nộp vào ${ctx.deadline}. Vui lòng liên hệ GVHD để được hướng dẫn tiếp theo.`,
    deepLinkPattern: '/topics/{topicId}/submissions',
  },
  REVISION_ROUND_OPENED: {
    title: 'Đợt chỉnh sửa mới đã mở',
    body: (ctx) =>
      `Đợt chỉnh sửa vòng ${ctx.roundNumber} cho đề tài "${ctx.topicTitle}" đã được mở. Hạn nộp: ${ctx.deadline}.`,
    deepLinkPattern: '/topics/{topicId}/submissions',
  },
  REVISION_ROUND_CLOSED: {
    title: 'Đợt chỉnh sửa đã đóng',
    body: (ctx) =>
      `Đợt chỉnh sửa vòng ${ctx.roundNumber} cho đề tài "${ctx.topicTitle}" đã được đóng.`,
    deepLinkPattern: '/topics/{topicId}/submissions',
  },
  SUBMISSION_UPLOADED: {
    title: 'File mới được nộp',
    body: (ctx) => `Sinh viên đã nộp ${ctx.fileType} phiên bản ${ctx.version} cho đề tài "${ctx.topicTitle}".`,
    deepLinkPattern: '/topics/{topicId}/submissions',
  },
  SUBMISSION_CONFIRMED: {
    title: 'Sinh viên đã xác nhận bài nộp',
    body: (ctx) =>
      `Sinh viên đã xác nhận phiên bản ${ctx.version} cho đề tài "${ctx.topicTitle}".`,
    deepLinkPattern: '/topics/{topicId}/submissions',
  },
  SCORE_SUBMITTED: {
    title: 'Điểm đã được gửi',
    body: (ctx) => `${ctx.scorerRole} đã gửi điểm cho đề tài "${ctx.topicTitle}".`,
    deepLinkPattern: '/topics/{topicId}/scores',
  },
  SCORE_PUBLISHED: {
    title: 'Điểm đã được công bố',
    body: (ctx) => `Điểm tổng kết cho đề tài "${ctx.topicTitle}" đã được công bố.`,
    deepLinkPattern: '/topics/{topicId}/scores',
  },
  ASSIGNMENT_ADDED: {
    title: 'Vai trò mới được gán',
    body: (ctx) => `Bạn đã được gán vai trò ${ctx.role} cho đề tài "${ctx.topicTitle}".`,
    deepLinkPattern: '/topics/{topicId}',
  },
  SYSTEM: {
    title: 'Thông báo hệ thống',
    body: (ctx) => ctx.message || 'Bạn có thông báo hệ thống mới.',
    deepLinkPattern: '/notifications',
  },
  GENERAL: {
    title: 'Thông báo',
    body: (ctx) => ctx.message || 'Bạn có thông báo mới.',
    deepLinkPattern: '/notifications',
  },
};

@Injectable()
export class NotificationsService {
  private static readonly GLOBAL_RECEIVER_IDS = new Set([
    'ALL',
    'COMMON',
    'GLOBAL',
    'PUBLIC',
    '*',
  ]);

  constructor(
    private readonly notificationsRepository: NotificationsRepository,
  ) {}

  private generateId(): string {
    return `nt_${crypto.randomBytes(6).toString('hex')}`;
  }

  /**
   * Get notifications for current user
   */
  async findAll(
    user: AuthUser,
    query: GetNotificationsQueryDto,
  ): Promise<{
    data: NotificationResponseDto[];
    pagination: { page: number; size: number; total: number };
  }> {
    const notifications = await this.notificationsRepository.findAll();
    let userNotifications = notifications.filter(
      (n) => this.canAccessNotification(n, user),
    );

    // Filter by read status if specified
    if (query.isRead !== undefined) {
      userNotifications = userNotifications.filter(
        (n) => n.isRead === query.isRead,
      );
    }

    // Sort by createdAt descending (newest first)
    userNotifications.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const total = userNotifications.length;
    const page = query.page || 1;
    const size = query.size || 20;
    const startIndex = (page - 1) * size;

    const paginatedNotifications = userNotifications.slice(
      startIndex,
      startIndex + size,
    );

    return {
      data: paginatedNotifications.map((n) => this.mapToDto(n)),
      pagination: { page, size, total },
    };
  }

  /**
   * Get notification by ID
   */
  async findById(
    notificationId: string,
    user: AuthUser,
  ): Promise<NotificationRecord | null> {
    const notification = await this.notificationsRepository.findById(notificationId);
    if (!notification) return null;

    if (!this.canAccessNotification(notification, user)) {
      throw new ForbiddenException('Cannot access this notification');
    }

    return notification;
  }

  /**
   * Mark notification as read/unread
   */
  async markRead(
    notificationId: string,
    isRead: boolean,
    user: AuthUser,
  ): Promise<{ updated: boolean }> {
    const notification = await this.notificationsRepository.findById(notificationId);
    if (!notification) {
      throw new NotFoundException(
        `Notification with ID ${notificationId} not found`,
      );
    }

    if (!this.canAccessNotification(notification, user)) {
      throw new ForbiddenException('Cannot modify this notification');
    }

    notification.isRead = isRead;
    notification.readAt = isRead ? new Date().toISOString() : undefined;
    await this.notificationsRepository.update(notification.id, notification);

    return { updated: true };
  }

  /**
   * Mark multiple notifications as read
   */
  async markBulkRead(
    notificationIds: string[],
    user: AuthUser,
  ): Promise<{ updatedCount: number }> {
    const notifications = await this.notificationsRepository.findAll();
    let updatedCount = 0;

    for (const id of notificationIds) {
      const notification = notifications.find((n) => n.id === id);
      if (notification && this.canAccessNotification(notification, user)) {
        if (!notification.isRead) {
          notification.isRead = true;
          notification.readAt = new Date().toISOString();
          await this.notificationsRepository.update(notification.id, notification);
          updatedCount++;
        }
      }
    }

    return { updatedCount };
  }

  /**
   * Create a notification (used internally or by other services)
   */
  async create(params: {
    receiverUserId: string;
    scope?: NotificationScope;
    type: NotificationType;
    context: Record<string, string>;
    topicId?: string;
  }): Promise<NotificationRecord> {
    const template = NOTIFICATION_TEMPLATES[params.type];

    const deepLink = params.topicId
      ? template.deepLinkPattern.replace('{topicId}', params.topicId)
      : template.deepLinkPattern;

    const notification: NotificationRecord = {
      id: this.generateId(),
      receiverUserId: params.receiverUserId,
      scope: params.scope ?? 'PERSONAL',
      topicId: params.topicId,
      type: params.type,
      title: template.title,
      body: template.body(params.context),
      deepLink,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    await this.notificationsRepository.create(notification);

    return notification;
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(user: AuthUser): Promise<number> {
    const notifications = await this.notificationsRepository.findAll();
    return notifications.filter(
      (n) => this.canAccessNotification(n, user) && !n.isRead,
    ).length;
  }

  /**
   * Build deep link for a notification
   */
  buildDeepLink(type: NotificationType, topicId?: string): string {
    const template = NOTIFICATION_TEMPLATES[type];
    if (!topicId) return template.deepLinkPattern;
    return template.deepLinkPattern.replace('{topicId}', topicId);
  }

  /**
   * Map record to DTO
   */
  mapToDto(record: NotificationRecord): NotificationResponseDto {
    return {
      id: record.id,
      receiverUserId: record.receiverUserId,
      scope: this.resolveScope(record),
      topicId: record.topicId,
      type: record.type,
      title: record.title,
      body: record.body,
      deepLink: record.deepLink,
      isRead: record.isRead,
      createdAt: record.createdAt,
      readAt: record.readAt,
    };
  }

  private canAccessNotification(
    notification: NotificationRecord,
    user: AuthUser,
  ): boolean {
    if (this.resolveScope(notification) === 'GLOBAL') {
      return true;
    }

    return notification.receiverUserId === user.userId;
  }

  private resolveScope(notification: NotificationRecord): NotificationScope {
    if (notification.scope === 'GLOBAL') {
      return 'GLOBAL';
    }

    const receiver = notification.receiverUserId.trim().toUpperCase();
    if (NotificationsService.GLOBAL_RECEIVER_IDS.has(receiver)) {
      return 'GLOBAL';
    }

    return 'PERSONAL';
  }
}
