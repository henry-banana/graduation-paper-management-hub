import { Injectable } from '@nestjs/common';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SHEET_NAMES } from '../sheets.constants';
import type { AccountRole } from '../../../common/types';
import type { UserRecord } from '../../../modules/users/users.service';

@Injectable()
export class UsersRepository extends SheetsBaseRepository<UserRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    super(sheetsClient, SHEET_NAMES.USERS);
  }

  protected fromRow(row: SheetRow): UserRecord {
    const v = row.values;
    const roleValue = this.str(v[3]);
    const role: AccountRole =
      roleValue === 'LECTURER' || roleValue === 'TBM' || roleValue === 'STUDENT'
        ? roleValue
        : 'STUDENT';

    // Backward compatibility:
    // - Canonical layout (current header):
    //   [9]=completedBcttScore [10]=totalQuota [11]=quotaUsed [12]=phone [13]=isActive [14]=createdAt
    // - Legacy layout (older rows):
    //   [9]=totalQuota [10]=quotaUsed [11]=phone [12]=isActive [13]=completedBcttScore [14]=createdAt
    const hasCanonicalBooleanAt13 = this.isBooleanLike(v[13]);
    const completedBcttScore = hasCanonicalBooleanAt13
      ? this.parseOptionalNumber(v[9])
      : this.parseOptionalNumber(v[13]);
    const totalQuota = hasCanonicalBooleanAt13
      ? this.parseOptionalNumber(v[10])
      : this.parseOptionalNumber(v[9]);
    const quotaUsed = hasCanonicalBooleanAt13
      ? this.parseOptionalNumber(v[11])
      : this.parseOptionalNumber(v[10]);
    const phone = hasCanonicalBooleanAt13
      ? this.str(v[12]) || undefined
      : this.str(v[11]) || undefined;
    const isActive = hasCanonicalBooleanAt13
      ? (this.str(v[13]) ? this.bool(v[13]) : true)
      : (this.str(v[12]) ? this.bool(v[12]) : true);

    return {
      id: this.str(v[0]),
      email: this.str(v[1]),
      name: this.str(v[2]),
      role,
      studentId: this.str(v[4]) || undefined,
      lecturerId: this.str(v[5]) || undefined,
      department: this.str(v[6]) || undefined,
      earnedCredits: this.parseOptionalNumber(v[7]),
      requiredCredits: this.parseOptionalNumber(v[8]),
      completedBcttScore,
      totalQuota,
      quotaUsed,
      phone,
      isActive,
      createdAt: this.str(v[14]) || undefined,
    };
  }

  protected toRow(entity: UserRecord): (string | number | boolean | null)[] {
    return [
      entity.id,
      this.str(entity.email),
      this.str(entity.name),
      this.str(entity.role),
      this.str(entity.studentId),
      this.str(entity.lecturerId),
      this.str(entity.department),
      entity.earnedCredits ?? '',
      entity.requiredCredits ?? '',
      entity.completedBcttScore ?? '',
      entity.totalQuota ?? '',
      entity.quotaUsed ?? '',
      this.str(entity.phone),
      this.boolStr(entity.isActive ?? true),
      this.str(entity.createdAt),
    ];
  }

  private parseOptionalNumber(value: string | undefined): number | undefined {
    const raw = this.str(value).trim();
    if (!raw) {
      return undefined;
    }

    // Allow both dot and comma decimal separators from Sheets data entry.
    const normalized = raw.replace(',', '.');
    return this.num(normalized);
  }

  private isBooleanLike(value: string | undefined): boolean {
    const raw = this.str(value).trim().toLowerCase();
    return raw === 'true' || raw === 'false' || raw === '1' || raw === '0';
  }
}
