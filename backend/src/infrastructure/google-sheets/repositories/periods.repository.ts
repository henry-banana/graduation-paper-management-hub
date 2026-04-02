import { Injectable, Logger } from '@nestjs/common';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SHEET_NAMES } from '../sheets.constants';
import type { PeriodRecord } from '../../../modules/periods/periods.service';
import type { PeriodType } from '../../../modules/periods/dto';

/**
 * Dot tab column layout (v3.2):
 * [0]=StartReg [1]=EndReg [2]=Loaidetai [3]=Major [4]=Dot [5]=Active [6]=StartEx [7]=EndEx
 * [8]=id [9]=createdAt [10]=updatedAt
 *
 * Teacher field mapping:
 *   Dot → code (period code, e.g. HK241)
 *   Loaidetai → type (BCTT | KLTN)
 *   StartReg → openDate, EndReg → closeDate
 *   Active → isActive
 *   StartEx, EndEx → submitStartAt, submitEndAt (period-level submit window)
 */
@Injectable()
export class PeriodsRepository extends SheetsBaseRepository<PeriodRecord> {
  private readonly log = new Logger(PeriodsRepository.name);

  constructor(sheetsClient: GoogleSheetsClient) {
    // Dot tab: id at col I = index 8 (after 8 teacher cols: StartReg,EndReg,Loaidetai,Major,Dot,Active,StartEx,EndEx)
    super(sheetsClient, SHEET_NAMES.DOT, 8);
  }

  protected fromRow(row: SheetRow): PeriodRecord {
    const v = row.values;

    const typeRaw = this.str(v[2]).toUpperCase();
    const type: PeriodType = typeRaw === 'KLTN' ? 'KLTN' : 'BCTT';

    const isActiveRaw = this.str(v[5]).toUpperCase();
    const isActive =
      isActiveRaw === 'TRUE' || isActiveRaw === '1' || isActiveRaw === 'YES';

    return {
      id: this.str(v[8]),                      // I: id
      code: this.str(v[4]),                    // E: Dot (period code)
      type,                                    // C: Loaidetai
      major: this.str(v[3]) || 'ALL',          // D: Major
      openDate: this.parseDateCell(v[0]),      // A: StartReg
      closeDate: this.parseDateCell(v[1]),     // B: EndReg
      status: isActive ? 'OPEN' : 'CLOSED',
      isActive,                                // F: Active
      submitStartAt: this.parseDateCell(v[6]), // G: StartEx
      submitEndAt: this.parseDateCell(v[7]),   // H: EndEx
      createdAt: this.str(v[9]),               // J: createdAt
      updatedAt: this.str(v[10]),              // K: updatedAt
    };
  }

  protected toRow(entity: PeriodRecord): (string | number | boolean | null)[] {
    return [
      this.str(entity.openDate),               // A: StartReg
      this.str(entity.closeDate),              // B: EndReg
      this.str(entity.type),                   // C: Loaidetai
      this.str(entity.major ?? 'ALL'),         // D: Major
      this.str(entity.code),                   // E: Dot
      this.boolStr(entity.isActive ?? entity.status === 'OPEN'), // F: Active
      this.str((entity as any).submitStartAt ?? ''), // G: StartEx
      this.str((entity as any).submitEndAt ?? ''),   // H: EndEx
      entity.id,                               // I: id
      this.str(entity.createdAt),              // J: createdAt
      this.str(entity.updatedAt),              // K: updatedAt
    ];
  }

  private parseDateCell(value: string | undefined | null): string {
    const raw = this.str(value);
    if (!raw) return '';

    // Google Sheets serial date number
    if (/^\d+(\.\d+)?$/.test(raw)) {
      const serial = Number(raw);
      if (Number.isFinite(serial)) {
        const epochMs = Date.UTC(1899, 11, 30);
        const date = new Date(epochMs + Math.round(serial * 24 * 60 * 60 * 1000));
        if (!Number.isNaN(date.getTime())) {
          return date.toISOString().slice(0, 10);
        }
      }
    }

    // ISO date
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return raw.slice(0, 10);
    }

    return raw;
  }
}
