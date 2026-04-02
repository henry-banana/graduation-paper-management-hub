import { Injectable } from '@nestjs/common';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SHEET_NAMES } from '../sheets.constants';
import type { SubmissionRecord } from '../../../modules/submissions/submissions.service';
import type {
  FileType,
  SubmissionStatus,
  VersionLabel,
} from '../../../modules/submissions/submission.constants';
import {
  SUBMISSION_VERSION_LABEL_PATTERN,
  buildVersionLabel,
} from '../../../modules/submissions/submission.constants';

/**
 * TenDetai tab column layout (v3.2):
 * [0]=EmailSV [1]=Tendetai [2]=DotHK [3]=Loaidetai [4]=Version [5]=Linkbai
 * [6]=id [7]=topicId [8]=uploaderUserId [9]=fileType
 * [10]=revisionRoundId [11]=revisionRoundNumber [12]=versionNumber [13]=versionLabel [14]=status
 * [15]=deadlineAt [16]=confirmedAt [17]=isLocked [18]=canReplace
 * [19]=driveFileId [20]=uploadedAt [21]=originalFileName [22]=fileSize
 *
 * Note: teacher's Version (1/2) maps to app versionNumber.
 *       teacher's Linkbai maps to driveLink (stored separately for readability).
 */
@Injectable()
export class SubmissionsRepository extends SheetsBaseRepository<SubmissionRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    // TenDetai tab: id at col G = index 6 (after 6 teacher cols: EmailSV,Tendetai,DotHK,Loaidetai,Version,Linkbai)
    super(sheetsClient, SHEET_NAMES.TENDETAI, 6);
  }

  protected fromRow(row: SheetRow): SubmissionRecord {
    const v = row.values;

    // Detect legacy teacher-only rows (no app cols yet, v.length <= 6)
    if (v.length <= 6 || !this.str(v[6])) {
      // Minimal record from teacher data only — needs import script to populate app cols
      return {
        id: `tmp_${this.str(v[0])}_${this.str(v[4])}`,
        topicId: '',
        uploaderUserId: '',
        fileType: 'REPORT',
        versionNumber: this.num(v[4], 1),
        versionLabel: buildVersionLabel(this.num(v[4], 1)),
        status: 'DRAFT',
        isLocked: false,
        canReplace: true,
        driveLink: this.optionalStr(v[5]),
        uploadedAt: new Date().toISOString(),
      };
    }

    return {
      id: this.str(v[6]),
      topicId: this.str(v[7]),
      uploaderUserId: this.str(v[8]),
      fileType: this.parseFileType(this.str(v[9])),
      revisionRoundId: this.optionalStr(v[10]),
      revisionRoundNumber: this.optionalNum(v[11]),
      versionNumber: this.num(v[12], this.num(v[4], 1)), // fallback to teacher Version
      versionLabel: this.parseVersionLabel(this.str(v[13])),
      status: this.parseStatus(this.str(v[14])),
      deadlineAt: this.optionalStr(v[15]),
      confirmedAt: this.optionalStr(v[16]),
      isLocked: this.bool(v[17]),
      canReplace: this.bool(v[18]),
      driveFileId: this.optionalStr(v[19]),
      driveLink: this.optionalStr(v[5]),   // teacher's Linkbai at col F
      uploadedAt: this.str(v[20]),
      originalFileName: this.optionalStr(v[21]),
      fileSize: this.optionalNum(v[22]),
    };
  }

  protected toRow(entity: SubmissionRecord): (string | number | boolean | null)[] {
    return [
      '',                                 // A: EmailSV (kept blank — ref only)
      '',                                 // B: Tendetai (kept blank — ref only)
      '',                                 // C: DotHK (kept blank — ref only)
      '',                                 // D: Loaidetai (kept blank — ref only)
      Number.isFinite(entity.versionNumber) ? entity.versionNumber : 1, // E: Version
      this.str(entity.driveLink ?? ''),  // F: Linkbai (teacher field, kept in sync)
      entity.id,                          // G: id
      this.str(entity.topicId),           // H: topicId
      this.str(entity.uploaderUserId),    // I: uploaderUserId
      this.str(entity.fileType),          // J: fileType
      this.str(entity.revisionRoundId ?? ''),       // K
      entity.revisionRoundNumber ?? '',              // L
      Number.isFinite(entity.versionNumber) ? entity.versionNumber : 1, // M: versionNumber
      this.str(entity.versionLabel ?? buildVersionLabel(1)), // N: versionLabel
      this.str(entity.status ?? 'DRAFT'),            // O: status
      this.str(entity.deadlineAt ?? ''),             // P: deadlineAt
      this.str(entity.confirmedAt ?? ''),            // Q: confirmedAt
      this.boolStr(entity.isLocked ?? false),        // R: isLocked
      this.boolStr(entity.canReplace ?? true),       // S: canReplace
      this.str(entity.driveFileId ?? ''),            // T: driveFileId
      this.str(entity.uploadedAt),                   // U: uploadedAt
      this.str(entity.originalFileName ?? ''),       // V: originalFileName
      entity.fileSize ?? '',                         // W: fileSize
    ];
  }

  private parseFileType(value: string): FileType {
    const valid: FileType[] = ['REPORT', 'TURNITIN', 'REVISION', 'INTERNSHIP_CONFIRMATION'];
    return valid.includes(value as FileType) ? (value as FileType) : 'REPORT';
  }

  private parseVersionLabel(value: string): VersionLabel {
    const normalized = value.trim().toUpperCase();
    if (SUBMISSION_VERSION_LABEL_PATTERN.test(normalized)) {
      return normalized as VersionLabel;
    }
    return buildVersionLabel(1);
  }

  private parseStatus(value: string): SubmissionStatus {
    const valid: SubmissionStatus[] = ['DRAFT', 'CONFIRMED', 'LOCKED'];
    return valid.includes(value as SubmissionStatus)
      ? (value as SubmissionStatus)
      : 'DRAFT';
  }
}
