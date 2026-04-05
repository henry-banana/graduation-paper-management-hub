import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  SendPersonalNotificationDto,
  NotificationResponseDto,
  NotificationScope,
  NotificationType,
  GetNotificationsQueryDto,
} from './dto';
import { AuthUser } from '../../common/types';
import {
  AssignmentsRepository,
  NotificationsRepository,
  TopicsRepository,
  UsersRepository,
} from '../../infrastructure/google-sheets';

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
  SCORE_APPEAL_REQUESTED: {
    title: 'Có yêu cầu phúc khảo điểm',
    body: (ctx) => `Sinh viên đã gửi yêu cầu phúc khảo cho đề tài "${ctx.topicTitle}".`,
    deepLinkPattern: '/gvhd/scoring?topicId={topicId}',
  },
  SCORE_APPEAL_RESOLVED: {
    title: 'Yêu cầu phúc khảo đã được xử lý',
    body: (ctx) => `Yêu cầu phúc khảo cho đề tài "${ctx.topicTitle}" đã được GVHD xử lý.`,
    deepLinkPattern: '/student/scores?topicId={topicId}',
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
  private readonly logger = new Logger(NotificationsService.name);

  private static readonly GLOBAL_RECEIVER_IDS = new Set([
    'ALL',
    'COMMON',
    'GLOBAL',
    'PUBLIC',
    '*',
  ]);

  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly topicsRepository: TopicsRepository,
    private readonly assignmentsRepository: AssignmentsRepository,
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
    this.logger.log(
      `[findAll:start] userId=${user.userId} role=${user.role} isRead=${query.isRead ?? '-'} page=${query.page ?? 1} size=${query.size ?? 20}`,
    );
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
    this.logger.log(
      `[findAll:success] userId=${user.userId} totalRaw=${notifications.length} accessible=${total} returned=${paginatedNotifications.length}`,
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
    this.logger.log(
      `[findById:start] notificationId=${notificationId} requesterUserId=${user.userId}`,
    );
    const notification = await this.notificationsRepository.findById(notificationId);
    if (!notification) {
      this.logger.warn(`[findById:notFound] notificationId=${notificationId}`);
      return null;
    }

    if (!this.canAccessNotification(notification, user)) {
      this.logger.warn(
        `[findById:forbidden] notificationId=${notificationId} requesterUserId=${user.userId} receiverUserId=${notification.receiverUserId}`,
      );
      throw new ForbiddenException('Cannot access this notification');
    }

    this.logger.log(
      `[findById:success] notificationId=${notificationId} requesterUserId=${user.userId}`,
    );
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
    this.logger.log(
      `[markRead:start] notificationId=${notificationId} isRead=${isRead} requesterUserId=${user.userId}`,
    );
    const notification = await this.notificationsRepository.findById(notificationId);
    if (!notification) {
      this.logger.warn(`[markRead:notFound] notificationId=${notificationId}`);
      throw new NotFoundException(
        `Notification with ID ${notificationId} not found`,
      );
    }

    if (!this.canAccessNotification(notification, user)) {
      this.logger.warn(
        `[markRead:forbidden] notificationId=${notificationId} requesterUserId=${user.userId} receiverUserId=${notification.receiverUserId}`,
      );
      throw new ForbiddenException('Cannot modify this notification');
    }

    notification.isRead = isRead;
    notification.readAt = isRead ? new Date().toISOString() : undefined;
    await this.notificationsRepository.update(notification.id, notification);
    this.logger.log(
      `[markRead:success] notificationId=${notificationId} isRead=${isRead} requesterUserId=${user.userId}`,
    );

    return { updated: true };
  }

  /**
   * Mark multiple notifications as read
   */
  async markBulkRead(
    notificationIds: string[],
    user: AuthUser,
  ): Promise<{ updatedCount: number }> {
    this.logger.log(
      `[markBulkRead:start] requesterUserId=${user.userId} ids=${notificationIds.join(',')}`,
    );
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
    this.logger.log(
      `[markBulkRead:success] requesterUserId=${user.userId} updatedCount=${updatedCount}`,
    );

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
    this.logger.log(
      `[create:start] receiverUserId=${params.receiverUserId} type=${params.type} scope=${params.scope ?? 'PERSONAL'} topicId=${params.topicId ?? '-'}`,
    );
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
    this.logger.log(
      `[create:success] notificationId=${notification.id} receiverUserId=${notification.receiverUserId} type=${notification.type} scope=${notification.scope ?? 'PERSONAL'}`,
    );

    return notification;
  }

  /**
   * Send a PERSONAL notification with role/topic-aware authorization.
   * - TBM can send to any active user (topicId optional)
   * - Non-TBM must provide topicId and both sender/receiver must be topic participants
   */
  async sendPersonal(
    dto: SendPersonalNotificationDto,
    sender: AuthUser,
  ): Promise<NotificationRecord> {
    this.logger.log(
      `[sendPersonal:start] senderUserId=${sender.userId} senderRole=${sender.role} receiverUserId=${dto.receiverUserId} topicId=${dto.topicId ?? '-'} type=${dto.type ?? 'GENERAL'}`,
    );

    if (sender.role === 'STUDENT') {
      throw new ForbiddenException(
        'Only lecturers and TBM can send personal notifications',
      );
    }

    const receiver = await this.usersRepository.findById(dto.receiverUserId);
    if (!receiver || receiver.isActive === false) {
      throw new NotFoundException('Receiver user not found');
    }

    const topicId = dto.topicId?.trim() || undefined;

    if (sender.role !== 'TBM' && !topicId) {
      throw new BadRequestException(
        'topicId is required for non-TBM personal notifications',
      );
    }

    if (topicId) {
      const topic = await this.topicsRepository.findById(topicId);
      if (!topic) {
        throw new NotFoundException(`Topic with ID ${topicId} not found`);
      }

      if (sender.role !== 'TBM') {
        const [senderInTopic, receiverInTopic] = await Promise.all([
          this.isTopicParticipant(topicId, sender.userId, topic.studentUserId, topic.supervisorUserId),
          this.isTopicParticipant(topicId, dto.receiverUserId, topic.studentUserId, topic.supervisorUserId),
        ]);

        if (!senderInTopic) {
          throw new ForbiddenException(
            'Sender is not a participant of the related topic',
          );
        }

        if (!receiverInTopic) {
          throw new ForbiddenException(
            'Receiver is not a participant of the related topic',
          );
        }
      }
    }

    const type = dto.type ?? 'GENERAL';
    const title = dto.title?.trim() || (type === 'SYSTEM' ? 'Thông báo hệ thống' : 'Thông báo');
    const body = dto.body.trim();
    const deepLink = dto.deepLink?.trim() || (topicId ? `/topics/${topicId}` : '/notifications');

    const notification: NotificationRecord = {
      id: this.generateId(),
      receiverUserId: dto.receiverUserId,
      scope: 'PERSONAL',
      topicId,
      type,
      title,
      body,
      deepLink,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    await this.notificationsRepository.create(notification);
    this.logger.log(
      `[sendPersonal:success] notificationId=${notification.id} senderUserId=${sender.userId} receiverUserId=${notification.receiverUserId}`,
    );

    return notification;
  }

  /**
   * Broadcast a notification to all users (GLOBAL scope).
   * Used by TBM to send system-wide announcements.
   */
  async broadcast(params: {
    type: NotificationType;
    title?: string;
    body?: string;
    context?: Record<string, string>;
  }): Promise<NotificationRecord> {
    this.logger.log(
      `[broadcast:start] type=${params.type} customTitle=${Boolean(params.title)} customBody=${Boolean(params.body)}`,
    );
    const template = NOTIFICATION_TEMPLATES[params.type];
    const ctx = params.context ?? {};

    const notification: NotificationRecord = {
      id: this.generateId(),
      receiverUserId: 'ALL',
      scope: 'GLOBAL',
      type: params.type,
      title: params.title ?? template.title,
      body: params.body ?? template.body(ctx),
      deepLink: template.deepLinkPattern,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    await this.notificationsRepository.create(notification);
    this.logger.log(
      `[broadcast:success] notificationId=${notification.id} type=${notification.type}`,
    );

    return notification;
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(user: AuthUser): Promise<number> {
    this.logger.log(`[getUnreadCount:start] userId=${user.userId}`);
    const notifications = await this.notificationsRepository.findAll();
    const unreadCount = notifications.filter(
      (n) => this.canAccessNotification(n, user) && !n.isRead,
    ).length;

    this.logger.log(
      `[getUnreadCount:success] userId=${user.userId} unreadCount=${unreadCount}`,
    );
    return unreadCount;
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

  private async isTopicParticipant(
    topicId: string,
    userId: string,
    studentUserId: string,
    supervisorUserId: string,
  ): Promise<boolean> {
    if (userId === studentUserId || userId === supervisorUserId) {
      return true;
    }

    const assignments = await this.assignmentsRepository.findByTopicId(topicId);
    return assignments.some((assignment) => assignment.userId === userId && assignment.status === 'ACTIVE');
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
