import { Injectable } from '@nestjs/common';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SHEET_NAMES } from '../sheets.constants';
import type { ExportRecord } from '../../../modules/exports/exports.service';
import type { ExportStatus, ExportType } from '../../../modules/exports/dto/export-response.dto';

@Injectable()
export class ExportFilesRepository extends SheetsBaseRepository<ExportRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    super(sheetsClient, SHEET_NAMES.EXPORT_FILES);
  }

  protected fromRow(row: SheetRow): ExportRecord {
    const v = row.values;

    return {
      id: this.str(v[0]),
      topicId: this.str(v[1]),
      exportType: this.parseExportType(this.str(v[2])),
      status: this.parseExportStatus(this.str(v[3])),
      driveFileId: this.optionalStr(v[4]),
      driveLink: this.optionalStr(v[5]),
      downloadUrl: this.optionalStr(v[6]),
      fileName: this.optionalStr(v[7]),
      mimeType: this.optionalStr(v[8]),
      errorMessage: this.optionalStr(v[9]),
      requestedBy: this.str(v[10]),
      createdAt: this.str(v[11]),
      completedAt: this.optionalStr(v[12]),
      expiresAt: this.optionalStr(v[13]),
    };
  }

  protected toRow(entity: ExportRecord): (string | number | boolean | null)[] {
    return [
      entity.id,
      this.str(entity.topicId),
      this.str(entity.exportType),
      this.str(entity.status),
      this.str(entity.driveFileId ?? ''),
      this.str(entity.driveLink ?? ''),
      this.str(entity.downloadUrl ?? ''),
      this.str(entity.fileName ?? ''),
      this.str(entity.mimeType ?? ''),
      this.str(entity.errorMessage ?? ''),
      this.str(entity.requestedBy),
      this.str(entity.createdAt),
      this.str(entity.completedAt ?? ''),
      this.str(entity.expiresAt ?? ''),
    ];
  }

  private parseExportStatus(value: string): ExportStatus {
    const valid: ExportStatus[] = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];
    return valid.includes(value as ExportStatus)
      ? (value as ExportStatus)
      : 'PENDING';
  }

  private parseExportType(value: string): ExportType {
    const valid: ExportType[] = ['RUBRIC_BCTT', 'RUBRIC_KLTN', 'SCORE_SHEET', 'TOPIC_LIST'];
    return valid.includes(value as ExportType)
      ? (value as ExportType)
      : 'SCORE_SHEET';
  }
}
