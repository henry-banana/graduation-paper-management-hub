import { Injectable } from '@nestjs/common';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SHEET_NAMES } from '../sheets.constants';
import type { NotificationRecord } from '../../../modules/notifications/notifications.service';
import type { NotificationScope, NotificationType } from '../../../modules/notifications/dto';

@Injectable()
export class NotificationsRepository extends SheetsBaseRepository<NotificationRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    super(sheetsClient, SHEET_NAMES.NOTIFICATIONS);
  }

  protected fromRow(row: SheetRow): NotificationRecord {
    const v = row.values;

    return {
      id: this.str(v[0]),
      receiverUserId: this.str(v[1]),
      scope: this.parseScope(this.optionalStr(v[10]), this.str(v[1])),
      topicId: this.optionalStr(v[2]),
      type: this.parseType(this.str(v[3])),
      title: this.str(v[4]),
      body: this.optionalStr(v[5]),
      deepLink: this.optionalStr(v[6]),
      isRead: this.bool(v[7]),
      createdAt: this.str(v[8]),
      readAt: this.optionalStr(v[9]),
    };
  }

  protected toRow(entity: NotificationRecord): (string | number | boolean | null)[] {
    return [
      entity.id,
      this.str(entity.receiverUserId),
      this.str(entity.topicId ?? ''),
      this.str(entity.type),
      this.str(entity.title),
      this.str(entity.body ?? ''),
      this.str(entity.deepLink ?? ''),
      entity.isRead,
      this.str(entity.createdAt),
      this.str(entity.readAt ?? ''),
      this.str(entity.scope ?? this.deriveScopeFromReceiver(entity.receiverUserId)),
    ];
  }

  private parseType(value: string): NotificationType {
    const valid: NotificationType[] = [
      'TOPIC_APPROVED',
      'TOPIC_REJECTED',
      'TOPIC_PENDING',
      'DEADLINE_SET',
      'DEADLINE_REMINDER',
      'DEADLINE_OVERDUE',
      'REVISION_ROUND_OPENED',
      'REVISION_ROUND_CLOSED',
      'SUBMISSION_UPLOADED',
      'SUBMISSION_CONFIRMED',
      'SCORE_SUBMITTED',
      'SCORE_PUBLISHED',
      'ASSIGNMENT_ADDED',
      'SYSTEM',
      'GENERAL',
    ];
    return valid.includes(value as NotificationType)
      ? (value as NotificationType)
      : 'GENERAL';
  }

  private parseScope(
    value: string | undefined,
    receiverUserId: string,
  ): NotificationScope {
    if (value === 'GLOBAL' || value === 'PERSONAL') {
      return value;
    }

    return this.deriveScopeFromReceiver(receiverUserId);
  }

  private deriveScopeFromReceiver(receiverUserId: string): NotificationScope {
    const normalized = receiverUserId.trim().toUpperCase();
    if (!normalized || ['ALL', 'COMMON', 'GLOBAL', 'PUBLIC', '*'].includes(normalized)) {
      return 'GLOBAL';
    }

    return 'PERSONAL';
  }
}
