import { Injectable } from '@nestjs/common';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SHEET_NAMES } from '../sheets.constants';
import type { AccountRole } from '../../../common/types';
import type { UserRecord } from '../../../modules/users/users.service';

/**
 * Data tab column layout (v3.2 + earnedCredits/requiredCredits):
 * [0]=Email  [1]=MS    [2]=Ten   [3]=Role  [4]=Major [5]=HeDaoTao
 * [6]=id     [7]=phone [8]=completedBcttScore
 * [9]=totalQuota  [10]=quotaUsed  [11]=expertise  [12]=isActive  [13]=createdAt
 * [14]=earnedCredits  [15]=requiredCredits
 *
 * NOTE: Unlike other sheets where ID is at col A (index 0),
 * the Data (Users) sheet has Email at col A and ID at col G (index 6).
 * All id-based lookups MUST search values[6], not values[0].
 *
 * Teacher Role mapping: SV→STUDENT | GV→LECTURER | TBM→TBM
 */
@Injectable()
export class UsersRepository extends SheetsBaseRepository<UserRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    // Data tab: id is at col G = index 6 (after 6 teacher cols: Email,MS,Ten,Role,Major,HeDaoTao)
    super(sheetsClient, SHEET_NAMES.DATA, 6);
  }

  protected fromRow(row: SheetRow): UserRecord {
    const v = row.values;

    const roleValue = this.str(v[3]).toUpperCase();
    const role: AccountRole =
      roleValue === 'GV' ? 'LECTURER'
      : roleValue === 'TBM' ? 'TBM'
      : roleValue === 'LECTURER' ? 'LECTURER'
      : 'STUDENT';

    return {
      id: this.str(v[6]),
      email: this.str(v[0]),
      name: this.str(v[2]),
      role,
      studentId: this.str(v[1]) || undefined,
      lecturerId: this.str(v[1]) || undefined,
      department: this.str(v[4]) || undefined,
      heDaoTao: this.str(v[5]) || undefined,
      phone: this.optionalStr(v[7]),
      completedBcttScore: this.parseOptionalNumber(v[8]),
      totalQuota: this.parseOptionalNumber(v[9]),
      quotaUsed: this.parseOptionalNumber(v[10]),
      expertise: this.optionalStr(v[11]),
      isActive: this.str(v[12]) ? this.bool(v[12]) : true,
      createdAt: this.optionalStr(v[13]),
      earnedCredits: this.parseOptionalNumber(v[14]),
      requiredCredits: this.parseOptionalNumber(v[15]),
    };
  }

  protected toRow(entity: UserRecord): (string | number | boolean | null)[] {
    const teacherRole =
      entity.role === 'LECTURER' ? 'GV'
      : entity.role === 'TBM' ? 'TBM'
      : 'SV';

    const ms = entity.studentId || entity.lecturerId || '';

    return [
      this.str(entity.email),
      ms,
      this.str(entity.name),
      teacherRole,
      this.str(entity.department),
      this.str(entity.heDaoTao ?? ''),
      entity.id,                          // G: id at index 6
      this.str(entity.phone ?? ''),
      entity.completedBcttScore ?? '',
      entity.totalQuota ?? '',
      entity.quotaUsed ?? '',
      this.str(entity.expertise ?? ''),
      this.boolStr(entity.isActive ?? true),
      this.str(entity.createdAt ?? ''),
      entity.earnedCredits ?? '',         // O: earnedCredits
      entity.requiredCredits ?? '',        // P: requiredCredits
    ];
  }

  /**
   * Override: ID is at values[6] (col G), not values[0] (col A = Email).
   */
  override async findById(id: string): Promise<UserRecord | null> {
    const rows = await this.sheetsClient.getRows(this.sheetName);
    const row = rows.find(
      (r) => this.str(r.values[6]) === id && r.values[0] !== '__DELETED__',
    );
    return row ? this.fromRow(row) : null;
  }

  /**
   * Override: update by matching ID at values[6].
   */
  override async update(id: string, updated: UserRecord): Promise<UserRecord> {
    const rows = await this.sheetsClient.getRows(this.sheetName);
    const row = rows.find((r) => this.str(r.values[6]) === id);
    if (!row) {
      throw new Error(`${this.sheetName}: user row with id=${id} not found`);
    }
    const newValues = this.toRow(updated);
    await this.sheetsClient.updateRow(this.sheetName, row.sheetRowNumber, newValues);
    this.logger.log(`Updated user id=${id} at row=${row.sheetRowNumber}`);
    return updated;
  }

  /**
   * Override: soft-delete by matching ID at values[6].
   */
  override async softDelete(id: string): Promise<void> {
    const rows = await this.sheetsClient.getRows(this.sheetName);
    const row = rows.find((r) => this.str(r.values[6]) === id);
    if (!row) throw new Error(`${this.sheetName}: user id=${id} not found`);
    await this.sheetsClient.markRowDeleted(this.sheetName, row.sheetRowNumber);
    this.logger.log(`Soft-deleted user id=${id}`);
  }

  private parseOptionalNumber(value: string | undefined): number | undefined {
    const raw = this.str(value).trim();
    if (!raw) return undefined;
    const normalized = raw.replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : undefined;
  }
}
