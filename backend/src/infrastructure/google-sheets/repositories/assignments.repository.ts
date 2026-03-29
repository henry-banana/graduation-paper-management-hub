import { Injectable } from '@nestjs/common';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SHEET_NAMES } from '../sheets.constants';
import type { AssignmentRecord } from '../../../modules/assignments/assignments.service';
import type { AssignmentStatus } from '../../../modules/assignments/dto';
import type { TopicRole } from '../../../common/types';

@Injectable()
export class AssignmentsRepository extends SheetsBaseRepository<AssignmentRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    super(sheetsClient, SHEET_NAMES.ASSIGNMENTS);
  }

  protected fromRow(row: SheetRow): AssignmentRecord {
    const v = row.values;
    const topicRole = this.parseTopicRole(this.str(v[3]));
    const status = this.parseStatus(this.str(v[4]));

    return {
      id: this.str(v[0]),
      topicId: this.str(v[1]),
      userId: this.str(v[2]),
      topicRole,
      status,
      assignedAt: this.str(v[5]),
      revokedAt: this.optionalStr(v[6]),
    };
  }

  protected toRow(entity: AssignmentRecord): (string | number | boolean | null)[] {
    return [
      entity.id,
      this.str(entity.topicId),
      this.str(entity.userId),
      this.str(entity.topicRole),
      this.str(entity.status),
      this.str(entity.assignedAt),
      this.str(entity.revokedAt ?? ''),
    ];
  }

  private parseTopicRole(value: string): TopicRole {
    const validRoles: TopicRole[] = ['GVHD', 'GVPB', 'CT_HD', 'TK_HD', 'TV_HD'];
    return validRoles.includes(value as TopicRole)
      ? (value as TopicRole)
      : 'GVHD';
  }

  private parseStatus(value: string): AssignmentStatus {
    const validStatuses: AssignmentStatus[] = ['ACTIVE', 'REVOKED'];
    return validStatuses.includes(value as AssignmentStatus)
      ? (value as AssignmentStatus)
      : 'ACTIVE';
  }
}
