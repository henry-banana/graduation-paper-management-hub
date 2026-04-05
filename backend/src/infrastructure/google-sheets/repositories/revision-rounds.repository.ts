import { Injectable } from '@nestjs/common';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SHEET_NAMES } from '../sheets.constants';

export type RevisionRoundStatus = 'OPEN' | 'CLOSED';
export type RevisionApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface RevisionRoundRecord {
  id: string;
  topicId: string;
  roundNumber: number;
  status: RevisionRoundStatus;
  startAt: string;
  endAt: string;
  requestedBy: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
  // Approval fields
  gvhdApprovalStatus?: RevisionApprovalStatus;
  gvhdApprovedAt?: string;
  gvhdApprovedBy?: string;
  gvhdComments?: string;
  ctHdApprovalStatus?: RevisionApprovalStatus;
  ctHdApprovedAt?: string;
  ctHdApprovedBy?: string;
  ctHdComments?: string;
}

/**
 * RevisionRounds tab column layout:
 * [0]=id [1]=topicId [2]=roundNumber [3]=status [4]=startAt [5]=endAt
 * [6]=requestedBy [7]=reason [8]=createdAt [9]=updatedAt
 * [10]=gvhdApprovalStatus [11]=gvhdApprovedAt [12]=gvhdApprovedBy [13]=gvhdComments
 * [14]=ctHdApprovalStatus [15]=ctHdApprovedAt [16]=ctHdApprovedBy [17]=ctHdComments
 */
@Injectable()
export class RevisionRoundsRepository extends SheetsBaseRepository<RevisionRoundRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    super(sheetsClient, SHEET_NAMES.REVISION_ROUNDS);
  }

  protected fromRow(row: SheetRow): RevisionRoundRecord {
    const v = row.values;

    return {
      id: this.str(v[0]),
      topicId: this.str(v[1]),
      roundNumber: this.num(v[2], 1),
      status: this.parseStatus(this.str(v[3])),
      startAt: this.str(v[4]),
      endAt: this.str(v[5]),
      requestedBy: this.str(v[6]),
      reason: this.optionalStr(v[7]),
      createdAt: this.str(v[8]),
      updatedAt: this.str(v[9]),
      // Approval fields
      gvhdApprovalStatus: this.parseApprovalStatus(this.optionalStr(v[10])),
      gvhdApprovedAt: this.optionalStr(v[11]),
      gvhdApprovedBy: this.optionalStr(v[12]),
      gvhdComments: this.optionalStr(v[13]),
      ctHdApprovalStatus: this.parseApprovalStatus(this.optionalStr(v[14])),
      ctHdApprovedAt: this.optionalStr(v[15]),
      ctHdApprovedBy: this.optionalStr(v[16]),
      ctHdComments: this.optionalStr(v[17]),
    };
  }

  protected toRow(entity: RevisionRoundRecord): (string | number | boolean | null)[] {
    return [
      entity.id,
      this.str(entity.topicId),
      Number.isFinite(entity.roundNumber) ? entity.roundNumber : 1,
      this.str(entity.status),
      this.str(entity.startAt),
      this.str(entity.endAt),
      this.str(entity.requestedBy),
      this.str(entity.reason ?? ''),
      this.str(entity.createdAt),
      this.str(entity.updatedAt),
      // Approval fields
      this.str(entity.gvhdApprovalStatus ?? ''),
      this.str(entity.gvhdApprovedAt ?? ''),
      this.str(entity.gvhdApprovedBy ?? ''),
      this.str(entity.gvhdComments ?? ''),
      this.str(entity.ctHdApprovalStatus ?? ''),
      this.str(entity.ctHdApprovedAt ?? ''),
      this.str(entity.ctHdApprovedBy ?? ''),
      this.str(entity.ctHdComments ?? ''),
    ];
  }

  private parseStatus(value: string): RevisionRoundStatus {
    return value === 'CLOSED' ? 'CLOSED' : 'OPEN';
  }

  private parseApprovalStatus(value: string | undefined): RevisionApprovalStatus | undefined {
    if (!value) return undefined;
    const valid: RevisionApprovalStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
    return valid.includes(value as RevisionApprovalStatus) 
      ? (value as RevisionApprovalStatus) 
      : undefined;
  }
}
