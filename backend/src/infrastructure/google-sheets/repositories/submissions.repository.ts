import { Injectable } from '@nestjs/common';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SHEET_NAMES } from '../sheets.constants';
import type { SubmissionRecord } from '../../../modules/submissions/submissions.service';
import type { FileType } from '../../../modules/submissions/submission.constants';

@Injectable()
export class SubmissionsRepository extends SheetsBaseRepository<SubmissionRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    super(sheetsClient, SHEET_NAMES.SUBMISSIONS);
  }

  protected fromRow(row: SheetRow): SubmissionRecord {
    const v = row.values;

    return {
      id: this.str(v[0]),
      topicId: this.str(v[1]),
      uploaderUserId: this.str(v[2]),
      fileType: this.parseFileType(this.str(v[3])),
      version: this.num(v[4], 1),
      driveFileId: this.optionalStr(v[5]),
      driveLink: this.optionalStr(v[6]),
      uploadedAt: this.str(v[7]),
      originalFileName: this.optionalStr(v[8]),
      fileSize: this.optionalNum(v[9]),
    };
  }

  protected toRow(entity: SubmissionRecord): (string | number | boolean | null)[] {
    return [
      entity.id,
      this.str(entity.topicId),
      this.str(entity.uploaderUserId),
      this.str(entity.fileType),
      Number.isFinite(entity.version) ? entity.version : 1,
      this.str(entity.driveFileId ?? ''),
      this.str(entity.driveLink ?? ''),
      this.str(entity.uploadedAt),
      this.str(entity.originalFileName ?? ''),
      entity.fileSize ?? '',
    ];
  }

  private parseFileType(value: string): FileType {
    const valid: FileType[] = ['REPORT', 'TURNITIN', 'REVISION'];
    return valid.includes(value as FileType) ? (value as FileType) : 'REPORT';
  }
}
