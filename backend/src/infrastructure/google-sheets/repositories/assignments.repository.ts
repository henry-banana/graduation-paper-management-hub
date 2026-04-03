import { Injectable } from '@nestjs/common';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SHEET_NAMES } from '../sheets.constants';
import type { AssignmentRecord } from '../../../modules/assignments/assignments.service';
import type { AssignmentStatus } from '../../../modules/assignments/dto';
import type { TopicRole } from '../../../common/types';

/**
 * Trangthaidetai tab column layout (v3.2):
 * [0]=EmailSV [1]=EmailGV [2]=Role [3]=Diadiem [4]=Diem [5]=End
 * [6]=id [7]=topicId [8]=userId [9]=status [10]=assignedAt [11]=revokedAt
 *
 * Teacher Role mapping:
 *   GVHD   → GVHD
 *   GVPB   → GVPB
 *   CTHD   → CT_HD
 *   TVHD   → TV_HD
 *   ThukyHD → TK_HD
 */
@Injectable()
export class AssignmentsRepository extends SheetsBaseRepository<AssignmentRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    // Trangthaidetai tab: id at col G = index 6 (after 6 teacher cols: EmailSV,EmailGV,Role,Diadiem,Diem,End)
    super(sheetsClient, SHEET_NAMES.TRANGTHAIDETAI, 6);
  }

  protected fromRow(row: SheetRow): AssignmentRecord {
    const v = row.values;

    return {
      id: this.str(v[6]),                                       // G: id
      topicId: this.str(v[7]),                                  // H: topicId
      userId: this.str(v[8]),                                   // I: userId
      topicRole: this.parseTopicRole(this.str(v[2])),           // C: Role
      status: this.parseStatus(this.str(v[9])),                 // J: status
      assignedAt: this.str(v[10]),                             // K: assignedAt
      revokedAt: this.optionalStr(v[11]),                      // L: revokedAt
      // Teacher reference fields (kept for cross-referencing)
      _emailSV: this.optionalStr(v[0]),
      _emailGV: this.optionalStr(v[1]),
      _diadiem: this.optionalStr(v[3]),
      _diem: this.optionalStr(v[4]),
      _end: this.optionalStr(v[5]),
    } as AssignmentRecord;
  }

  protected toRow(entity: AssignmentRecord): (string | number | boolean | null)[] {
    const rec = entity as AssignmentRecord & {
      _emailSV?: string;
      _emailGV?: string;
      _diadiem?: string;
      _diem?: string;
      _end?: string;
    };

    // Map app topicRole back to teacher role values
    const teacherRole = this.toTeacherRole(entity.topicRole);

    return [
      rec._emailSV ?? '',             // A: EmailSV
      rec._emailGV ?? '',             // B: EmailGV
      teacherRole,                    // C: Role
      rec._diadiem ?? '',             // D: Diadiem
      rec._diem ?? '',                // E: Diem
      rec._end ?? '',                 // F: End
      entity.id,                      // G: id
      this.str(entity.topicId),       // H: topicId
      this.str(entity.userId),        // I: userId
      this.str(entity.status),        // J: status
      this.str(entity.assignedAt),    // K: assignedAt
      this.str(entity.revokedAt ?? ''), // L: revokedAt
    ];
  }

  private parseTopicRole(value: string): TopicRole {
    const normalized = value.trim().toUpperCase();
    const mapping: Record<string, TopicRole> = {
      'GVHD': 'GVHD',
      'GVPB': 'GVPB',
      'CT_HD': 'CT_HD',
      'CTHD': 'CT_HD',
      'TV_HD': 'TV_HD',
      'TVHD': 'TV_HD',
      'TK_HD': 'TK_HD',
      'THUKYHDONG': 'TK_HD',
      'THUKYHD': 'TK_HD',
    };
    return mapping[normalized] ?? 'GVHD';
  }

  private toTeacherRole(role: TopicRole): string {
    const mapping: Record<TopicRole, string> = {
      'GVHD': 'GVHD',
      'GVPB': 'GVPB',
      'CT_HD': 'CTHD',
      'TV_HD': 'TVHD',
      'TK_HD': 'ThukyHD',
    };
    return mapping[role] ?? role;
  }

  private parseStatus(value: string): AssignmentStatus {
    const validStatuses: AssignmentStatus[] = ['ACTIVE', 'REVOKED'];
    return validStatuses.includes(value as AssignmentStatus)
      ? (value as AssignmentStatus)
      : 'ACTIVE';
  }

  async findByTopicId(topicId: string): Promise<AssignmentRecord[]> {
    return this.findWhere((a) => a.topicId === topicId);
  }
}
