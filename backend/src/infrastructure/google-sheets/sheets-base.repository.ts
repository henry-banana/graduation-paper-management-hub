import { Logger } from '@nestjs/common';
import { GoogleSheetsClient, SheetRow } from './google-sheets.client';

/**
 * Base class for all Google Sheets repository implementations.
 * Each sheet tab is treated as a table where:
 *   - Row 1: header (column names) — managed manually in the sheet
 *   - Row 2+: data rows
 *
 * T = domain entity type
 * Raw data is stored as string arrays in Sheets.
 */
export abstract class SheetsBaseRepository<T extends { id: string }> {
  protected readonly logger: Logger;

  constructor(
    protected readonly sheetsClient: GoogleSheetsClient,
    protected readonly sheetName: string,
  ) {
    this.logger = new Logger(`${sheetName}Repository`);
  }

  /** Convert a Sheets row (string[]) to domain entity */
  protected abstract fromRow(row: SheetRow): T;

  /** Convert domain entity to a Sheets row (string[]) */
  protected abstract toRow(entity: T): (string | number | boolean | null)[];

  /** Read all non-deleted entities */
  async findAll(): Promise<T[]> {
    const rows = await this.sheetsClient.getRows(this.sheetName);
    return rows
      .filter((r) => r.values[0] !== '__DELETED__' && r.values[0])
      .map((r) => this.fromRow(r));
  }

  /** Find by id */
  async findById(id: string): Promise<T | null> {
    const rows = await this.sheetsClient.getRows(this.sheetName);
    const row = rows.find(
      (r) => r.values[0] === id && r.values[0] !== '__DELETED__',
    );
    return row ? this.fromRow(row) : null;
  }

  /** Find first matching entity */
  async findOne(predicate: (entity: T) => boolean): Promise<T | null> {
    const all = await this.findAll();
    return all.find(predicate) ?? null;
  }

  /** Compatibility alias for findOne */
  async findFirst(predicate: (entity: T) => boolean): Promise<T | null> {
    return this.findOne(predicate);
  }

  /** Find all matching entities */
  async findWhere(predicate: (entity: T) => boolean): Promise<T[]> {
    const all = await this.findAll();
    return all.filter(predicate);
  }

  /** Insert a new entity (append row) */
  async insert(entity: T): Promise<T> {
    const row = this.toRow(entity);
    await this.sheetsClient.appendRow(this.sheetName, row);
    this.logger.log(`Inserted ${this.sheetName} id=${entity.id}`);
    return entity;
  }

  /** Compatibility alias for insert */
  async create(entity: T): Promise<T> {
    return this.insert(entity);
  }

  /** Update an existing entity by id */
  async update(id: string, updated: T): Promise<T> {
    const rows = await this.sheetsClient.getRows(this.sheetName);
    const row = rows.find((r) => r.values[0] === id);
    if (!row) {
      throw new Error(`${this.sheetName}: row with id=${id} not found`);
    }
    const newValues = this.toRow(updated);
    await this.sheetsClient.updateRow(this.sheetName, row.sheetRowNumber, newValues);
    this.logger.log(`Updated ${this.sheetName} id=${id} at row=${row.sheetRowNumber}`);
    return updated;
  }

  /** Patch specific fields (partial update) */
  async patch(id: string, changes: Partial<T>): Promise<T> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`${this.sheetName}: id=${id} not found`);
    const patched = { ...existing, ...changes } as T;
    return this.update(id, patched);
  }

  /** Soft delete by marking row as __DELETED__ */
  async softDelete(id: string): Promise<void> {
    const rows = await this.sheetsClient.getRows(this.sheetName);
    const row = rows.find((r) => r.values[0] === id);
    if (!row) throw new Error(`${this.sheetName}: id=${id} not found`);
    await this.sheetsClient.markRowDeleted(this.sheetName, row.sheetRowNumber);
    this.logger.log(`Soft-deleted ${this.sheetName} id=${id}`);
  }

  /** Check if entity with id exists */
  async exists(id: string): Promise<boolean> {
    return (await this.findById(id)) !== null;
  }

  protected str(v: string | undefined | null): string {
    return v ?? '';
  }

  protected num(v: string | undefined | null, defaultValue = 0): number {
    const n = parseFloat(v ?? '');
    return isNaN(n) ? defaultValue : n;
  }

  protected optionalStr(v: string | undefined | null): string | undefined {
    const value = this.str(v).trim();
    return value === '' ? undefined : value;
  }

  protected optionalNum(v: string | undefined | null): number | undefined {
    const raw = this.str(v).trim();
    if (raw === '') {
      return undefined;
    }

    const n = parseFloat(raw);
    return isNaN(n) ? undefined : n;
  }

  protected bool(v: string | number | boolean | undefined | null): boolean {
    if (typeof v === 'boolean') {
      return v;
    }
    if (typeof v === 'number') {
      return v === 1;
    }
    return v === 'TRUE' || v === 'true' || v === '1';
  }

  protected boolStr(v: boolean): string {
    return v ? 'TRUE' : 'FALSE';
  }
}
