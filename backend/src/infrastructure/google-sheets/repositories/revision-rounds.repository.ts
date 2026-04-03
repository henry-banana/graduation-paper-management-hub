import { Injectable } from '@nestjs/common';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SHEET_NAMES } from '../sheets.constants';

export type RevisionRoundStatus = 'OPEN' | 'CLOSED';

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
}

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
    ];
  }

  private parseStatus(value: string): RevisionRoundStatus {
    return value === 'CLOSED' ? 'CLOSED' : 'OPEN';
  }
}
