import { Injectable, Logger } from '@nestjs/common';
import { AuditLogsRepository } from '../../infrastructure/google-sheets';

export type AuditAction =
  | 'TOPIC_CREATED'
  | 'TOPIC_APPROVED'
  | 'TOPIC_REJECTED'
  | 'TOPIC_TRANSITION'
  | 'TOPIC_TITLE_UPDATED'
  | 'REVISION_ROUND_OPENED'
  | 'REVISION_ROUND_CLOSED'
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
  | 'SCORE_AGGREGATED_BY_TK_HD'
  | 'COUNCIL_COMMENTS_UPDATED'
  | 'SUBMISSION_UPLOADED'
  | 'SUBMISSION_CONFIRMED'
  | 'SUBMISSION_REPLACED_IN_DEADLINE'
  | 'SUBMISSION_LOCKED_OVERDUE'
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
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  async log(params: {
    action: AuditAction;
    actorId: string;
    actorRole: string;
    topicId?: string;
    detail?: Record<string, unknown>;
  }): Promise<AuditLogRecord> {
    this.logger.log(
      `[log:start] action=${params.action} actorId=${params.actorId} actorRole=${params.actorRole} topicId=${params.topicId ?? '-'}`,
    );
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
    this.logger.log(
      `[log:success] auditId=${record.id} action=${record.action} actorId=${record.actorId}`,
    );
    return record;
  }

  async findByTopic(topicId: string): Promise<AuditLogRecord[]> {
    this.logger.log(`[findByTopic:start] topicId=${topicId}`);
    const logs = await this.auditLogsRepository.findAll();
    const result = logs
      .filter((l) => l.topicId === topicId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    this.logger.log(
      `[findByTopic:success] topicId=${topicId} matched=${result.length} total=${logs.length}`,
    );
    return result;
  }

  async findAll(limit = 100): Promise<AuditLogRecord[]> {
    this.logger.log(`[findAll:start] limit=${limit}`);
    const logs = await this.auditLogsRepository.findAll();
    const result = logs
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, limit);
    this.logger.log(
      `[findAll:success] returned=${result.length} total=${logs.length} limit=${limit}`,
    );
    return result;
  }
}
