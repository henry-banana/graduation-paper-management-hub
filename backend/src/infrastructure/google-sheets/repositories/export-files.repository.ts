import { Injectable } from '@nestjs/common';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SHEET_NAMES } from '../sheets.constants';
import type { ExportRecord } from '../../../modules/exports/exports.service';
import type { ExportStatus, ExportType } from '../../../modules/exports/dto/export-response.dto';

/**
 * Bienban tab column layout (v3.2):
 * [0]=Email (teacher) [1]=Bienban (teacher — original drive link)
 * [2]=id [3]=topicId [4]=exportType [5]=status [6]=driveFileId
 * [7]=driveLink [8]=downloadUrl [9]=fileName [10]=mimeType
 * [11]=errorMessage [12]=requestedBy [13]=createdAt [14]=completedAt
 */
@Injectable()
export class ExportFilesRepository extends SheetsBaseRepository<ExportRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    // Bienban tab: id at col C = index 2 (after 2 teacher cols: Email, Bienban)
    super(sheetsClient, SHEET_NAMES.BIENBAN, 2);
  }

  protected fromRow(row: SheetRow): ExportRecord {
    const v = row.values;

    // Detect legacy teacher-only rows (just Email + Bienban link, no app cols)
    if (v.length <= 2 || !this.str(v[2])) {
      return {
        id: `tmp_${this.str(v[0])}`,
        topicId: '',
        exportType: 'MINUTES',
        status: 'COMPLETED',
        driveLink: this.optionalStr(v[1]),
        requestedBy: '',
        createdAt: '',
      } as ExportRecord;
    }

    return {
      id: this.str(v[2]),
      topicId: this.str(v[3]),
      exportType: this.parseExportType(this.str(v[4])),
      status: this.parseExportStatus(this.str(v[5])),
      driveFileId: this.optionalStr(v[6]),
      driveLink: this.optionalStr(v[7]) || this.optionalStr(v[1]), // prefer app col, fallback to teacher
      downloadUrl: this.optionalStr(v[8]),
      fileName: this.optionalStr(v[9]),
      mimeType: this.optionalStr(v[10]),
      errorMessage: this.optionalStr(v[11]),
      requestedBy: this.str(v[12]),
      createdAt: this.str(v[13]),
      completedAt: this.optionalStr(v[14]),
    };
  }

  protected toRow(entity: ExportRecord): (string | number | boolean | null)[] {
    return [
      '',                                        // A: Email (ref, kept blank)
      this.str(entity.driveLink ?? ''),          // B: Bienban (teacher field, synced)
      entity.id,                                 // C: id
      this.str(entity.topicId),                  // D: topicId
      this.str(entity.exportType),               // E: exportType
      this.str(entity.status),                   // F: status
      this.str(entity.driveFileId ?? ''),        // G: driveFileId
      this.str(entity.driveLink ?? ''),          // H: driveLink
      this.str(entity.downloadUrl ?? ''),        // I: downloadUrl
      this.str(entity.fileName ?? ''),           // J: fileName
      this.str(entity.mimeType ?? ''),           // K: mimeType
      this.str(entity.errorMessage ?? ''),       // L: errorMessage
      this.str(entity.requestedBy),              // M: requestedBy
      this.str(entity.createdAt),                // N: createdAt
      this.str(entity.completedAt ?? ''),        // O: completedAt
    ];
  }

  private parseExportStatus(value: string): ExportStatus {
    const valid: ExportStatus[] = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];
    return valid.includes(value as ExportStatus) ? (value as ExportStatus) : 'PENDING';
  }

  private parseExportType(value: string): ExportType {
    const valid: ExportType[] = ['RUBRIC_BCTT', 'RUBRIC_KLTN', 'SCORE_SHEET', 'TOPIC_LIST', 'MINUTES'];
    return valid.includes(value as ExportType) ? (value as ExportType) : 'MINUTES';
  }
}
