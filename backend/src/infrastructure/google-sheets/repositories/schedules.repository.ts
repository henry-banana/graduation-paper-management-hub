import { Injectable } from '@nestjs/common';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SHEET_NAMES } from '../sheets.constants';
import type { ScheduleRecord } from '../../../modules/schedules/schedules.service';

@Injectable()
export class SchedulesRepository extends SheetsBaseRepository<ScheduleRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    super(sheetsClient, SHEET_NAMES.SCHEDULES);
  }

  protected fromRow(row: SheetRow): ScheduleRecord {
    const v = row.values;

    return {
      id: this.str(v[0]),
      topicId: this.str(v[1]),
      defenseAt: this.str(v[2]),
      locationType: this.parseLocationType(this.str(v[3])),
      locationDetail: this.optionalStr(v[4]),
      notes: this.optionalStr(v[5]),
      createdBy: this.str(v[6]),
      createdAt: this.str(v[7]),
      updatedAt: this.str(v[8]),
    };
  }

  protected toRow(entity: ScheduleRecord): (string | number | boolean | null)[] {
    return [
      entity.id,
      this.str(entity.topicId),
      this.str(entity.defenseAt),
      this.str(entity.locationType),
      this.str(entity.locationDetail ?? ''),
      this.str(entity.notes ?? ''),
      this.str(entity.createdBy),
      this.str(entity.createdAt),
      this.str(entity.updatedAt),
    ];
  }

  private parseLocationType(value: string): 'ONLINE' | 'OFFLINE' {
    return value === 'ONLINE' ? 'ONLINE' : 'OFFLINE';
  }
}
