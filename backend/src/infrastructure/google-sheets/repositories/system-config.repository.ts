import { Injectable } from '@nestjs/common';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SHEET_NAMES } from '../sheets.constants';

/**
 * SystemConfig tab column layout (v3.2 — app-specific):
 * [0]=key [1]=value [2]=description [3]=updatedAt
 *
 * Note: `key` acts as the unique identifier (used as `id` in base repo).
 * Base class `findById(key)` finds rows where values[0] === key — this matches
 * because key is at position [0].
 */
export interface SystemConfigRecord {
  id: string;          // Same as key — required by SheetsBaseRepository constraint
  key: string;         // Config key (e.g. 'score.weight.gvhd')
  value: string;       // Config value (always string; parse as needed)
  description?: string;
  updatedAt?: string;
}

@Injectable()
export class SystemConfigRepository extends SheetsBaseRepository<SystemConfigRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    super(sheetsClient, SHEET_NAMES.SYSTEM_CONFIG);
  }

  async findByKey(key: string): Promise<SystemConfigRecord | null> {
    return this.findById(key); // base class finds by values[0] === id === key
  }

  async getValue(key: string, defaultValue: string): Promise<string> {
    const record = await this.findByKey(key);
    return record?.value ?? defaultValue;
  }

  async getNumber(key: string, defaultValue: number): Promise<number> {
    const val = await this.getValue(key, String(defaultValue));
    const n = Number(val);
    return Number.isFinite(n) ? n : defaultValue;
  }

  async setValue(key: string, value: string, description?: string): Promise<void> {
    const existing = await this.findByKey(key);
    const now = new Date().toISOString();

    if (existing) {
      await this.update(key, { ...existing, value, updatedAt: now });
    } else {
      await this.create({ id: key, key, value, description, updatedAt: now });
    }
  }

  protected fromRow(row: SheetRow): SystemConfigRecord {
    const v = row.values;
    const key = this.str(v[0]);
    return {
      id: key,        // id === key for base class compatibility
      key,
      value: this.str(v[1]),
      description: this.optionalStr(v[2]),
      updatedAt: this.optionalStr(v[3]),
    };
  }

  protected toRow(entity: SystemConfigRecord): (string | number | boolean | null)[] {
    return [
      entity.key,                        // [0]: key (also the row identifier)
      entity.value,                      // [1]: value
      entity.description ?? '',          // [2]: description
      entity.updatedAt ?? new Date().toISOString(), // [3]: updatedAt
    ];
  }
}
