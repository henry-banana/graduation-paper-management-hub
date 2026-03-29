import { Injectable } from '@nestjs/common';
import { AuditLogsRepository } from '../../infrastructure/google-sheets';

export type AuditAction =
  | 'TOPIC_CREATED'
  | 'TOPIC_APPROVED'
  | 'TOPIC_REJECTED'
  | 'TOPIC_TRANSITION'
  | 'DEADLINE_SET'
  | 'DEADLINE_EXTENDED'
  | 'ASSIGNMENT_CREATED'
  | 'ASSIGNMENT_REVOKED'
  | 'COUNCIL_ASSIGNED'
  | 'SCHEDULE_CREATED'
  | 'SCHEDULE_UPDATED'
  | 'SCORE_DRAFT_SAVED'
  | 'SCORE_SUBMITTED'
  | 'SCORE_SUMMARY_GENERATED'
  | 'SCORE_CONFIRMED'
  | 'SCORE_PUBLISHED'
  | 'SUBMISSION_UPLOADED'
  | 'EXPORT_CREATED'
  | 'TOPIC_AUTO_CANCELLED';

export interface AuditLogRecord {
  id: string;
  action: AuditAction;
  actorId: string;
  actorRole: string;
  topicId?: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  async log(params: {
    action: AuditAction;
    actorId: string;
    actorRole: string;
    topicId?: string;
    detail?: Record<string, unknown>;
  }): Promise<AuditLogRecord> {
    const record: AuditLogRecord = {
      id: `audit_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
      action: params.action,
      actorId: params.actorId,
      actorRole: params.actorRole,
      topicId: params.topicId,
      detail: params.detail ?? {},
      createdAt: new Date().toISOString(),
    };

    await this.auditLogsRepository.create(record);
    return record;
  }

  async findByTopic(topicId: string): Promise<AuditLogRecord[]> {
    const logs = await this.auditLogsRepository.findAll();
    return logs
      .filter((l) => l.topicId === topicId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }

  async findAll(limit = 100): Promise<AuditLogRecord[]> {
    const logs = await this.auditLogsRepository.findAll();
    return logs
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, limit);
  }
}
