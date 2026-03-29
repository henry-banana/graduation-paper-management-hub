import { Injectable } from '@nestjs/common';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SHEET_NAMES } from '../sheets.constants';
import type { PeriodRecord } from '../../../modules/periods/periods.service';
import type { PeriodStatus, PeriodType } from '../../../modules/periods/dto';

@Injectable()
export class PeriodsRepository extends SheetsBaseRepository<PeriodRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    super(sheetsClient, SHEET_NAMES.PERIODS);
  }

  protected fromRow(row: SheetRow): PeriodRecord {
    const v = row.values;
    const typeValue = this.str(v[2]);
    const statusValue = this.str(v[5]);

    const type: PeriodType = typeValue === 'KLTN' ? 'KLTN' : 'BCTT';
    const status: PeriodStatus =
      statusValue === 'OPEN' || statusValue === 'CLOSED' || statusValue === 'DRAFT'
        ? statusValue
        : 'DRAFT';

    return {
      id: this.str(v[0]),
      code: this.str(v[1]),
      type,
      openDate: this.parseDateCell(v[3]),
      closeDate: this.parseDateCell(v[4]),
      status,
      createdAt: this.str(v[6]),
      updatedAt: this.str(v[7]),
    };
  }

  protected toRow(entity: PeriodRecord): (string | number | boolean | null)[] {
    return [
      entity.id,
      this.str(entity.code),
      this.str(entity.type),
      this.str(entity.openDate),
      this.str(entity.closeDate),
      this.str(entity.status),
      this.str(entity.createdAt),
      this.str(entity.updatedAt),
    ];
  }

  private parseDateCell(value: string | undefined | null): string {
    const raw = this.str(value);
    if (/^\d+(\.\d+)?$/.test(raw)) {
      const serial = Number(raw);
      if (Number.isFinite(serial)) {
        // Google Sheets date serial origin is 1899-12-30.
        const epochMs = Date.UTC(1899, 11, 30);
        const date = new Date(epochMs + Math.round(serial * 24 * 60 * 60 * 1000));
        if (!Number.isNaN(date.getTime())) {
          return date.toISOString().slice(0, 10);
        }
      }
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return raw.slice(0, 10);
    }

    return raw;
  }
}
