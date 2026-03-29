import { Injectable } from '@nestjs/common';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SHEET_NAMES } from '../sheets.constants';
import type { AuditAction, AuditLogRecord } from '../../../modules/audit/audit.service';

@Injectable()
export class AuditLogsRepository extends SheetsBaseRepository<AuditLogRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    super(sheetsClient, SHEET_NAMES.AUDIT_LOGS);
  }

  protected fromRow(row: SheetRow): AuditLogRecord {
    const v = row.values;

    return {
      id: this.str(v[0]),
      action: this.parseAction(this.str(v[1])),
      actorId: this.str(v[2]),
      actorRole: this.str(v[3]),
      topicId: this.optionalStr(v[4]),
      detail: this.parseDetail(v[5]),
      createdAt: this.str(v[6]),
    };
  }

  protected toRow(entity: AuditLogRecord): (string | number | boolean | null)[] {
    return [
      entity.id,
      this.str(entity.action),
      this.str(entity.actorId),
      this.str(entity.actorRole),
      this.str(entity.topicId ?? ''),
      JSON.stringify(entity.detail ?? {}),
      this.str(entity.createdAt),
    ];
  }

  private parseDetail(value: unknown): Record<string, unknown> {
    if (typeof value !== 'string' || value.trim() === '') {
      return {};
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }

  private parseAction(value: string): AuditAction {
    const validActions: AuditAction[] = [
      'TOPIC_CREATED',
      'TOPIC_APPROVED',
      'TOPIC_REJECTED',
      'TOPIC_TRANSITION',
      'DEADLINE_SET',
      'DEADLINE_EXTENDED',
      'ASSIGNMENT_CREATED',
      'ASSIGNMENT_REVOKED',
      'COUNCIL_ASSIGNED',
      'SCHEDULE_CREATED',
      'SCHEDULE_UPDATED',
      'SCORE_DRAFT_SAVED',
      'SCORE_SUBMITTED',
      'SCORE_SUMMARY_GENERATED',
      'SCORE_CONFIRMED',
      'SCORE_PUBLISHED',
      'SUBMISSION_UPLOADED',
      'EXPORT_CREATED',
      'TOPIC_AUTO_CANCELLED',
    ];

    return validActions.includes(value as AuditAction)
      ? (value as AuditAction)
      : 'TOPIC_CREATED';
  }
}
