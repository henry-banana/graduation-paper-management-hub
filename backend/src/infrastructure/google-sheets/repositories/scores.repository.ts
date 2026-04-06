import { Injectable } from '@nestjs/common';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SHEET_NAMES } from '../sheets.constants';
import type {
  ScoreRecord,
  ScoreSummaryRecord,
} from '../../../modules/scores/scores.service';
import type {
  RubricItem,
  ScoreAppealStatus,
  ScoreResult,
  ScorerRole,
  ScoreStatus,
} from '../../../modules/scores/dto';

/**
 * Điểm tab column layout (v3.2):
 * Teacher cols: [0]=Email [1]=Tên SV [2]=MSSV [3]=Tên Đề tài [4]=GV [5]=Role
 *               [6]=TC1 [7]=TC2 [8]=TC3 [9]=TC4 [10]=TC5
 *               [11]=TC6 [12]=TC7 [13]=TC8 [14]=TC9 [15]=TC10
 * App cols:     [16]=id [17]=topicId [18]=scorerUserId [19]=scorerRole [20]=status
 *               [21]=totalScore [22]=rubricData [23]=allowDefense [24]=questions
 *               [25]=submittedAt [26]=updatedAt
 */
@Injectable()
export class ScoresRepository extends SheetsBaseRepository<ScoreRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    // Score 'id' lives at col Q = index 16 (not col A = index 0 like most sheets)
    super(sheetsClient, SHEET_NAMES.DIEM, 16);
  }

  protected fromRow(row: SheetRow): ScoreRecord {
    const v = row.values;

    // Read TC1-TC10 scores from teacher columns
    const tcScores: number[] = [];
    for (let i = 6; i <= 15; i++) {
      const n = this.num(v[i], 0);
      tcScores.push(n);
    }

    // Try to read rubricData from app col [22]; fall back to building from TC scores
    let rubricData = this.parseRubricData(v[22]);
    if (rubricData.length === 0 && tcScores.some((s) => s > 0)) {
      // Build minimal rubric from TC values (criteria names filled later by import script)
      rubricData = tcScores
        .map((score, idx) => ({ criterion: `TC${idx + 1}`, score, max: 10 }))
        .filter((item) => item.score > 0);
    }

    return {
      id: this.str(v[16]),
      topicId: this.str(v[17]),
      scorerUserId: this.str(v[18]),
      scorerRole: this.parseScorerRole(this.str(v[19]) || this.str(v[5])), // [19] or fallback to teacher Role col
      status: this.parseScoreStatus(this.str(v[20])),
      totalScore: this.num(v[21], tcScores.reduce((a, b) => a + b, 0)),
      rubricData,
      allowDefense: this.str(v[23]) ? this.bool(v[23]) : false,
      questions: this.parseQuestions(v[24]),
      submittedAt: this.optionalStr(v[25]),
      updatedAt: this.str(v[26]),
      // Preserve teacher reference columns for round-trips
      _email: this.optionalStr(v[0]),
      _tenSV: this.optionalStr(v[1]),
      _mssv: this.optionalStr(v[2]),
      _tenDetai: this.optionalStr(v[3]),
      _gvName: this.optionalStr(v[4]),
    };
  }

  protected toRow(entity: ScoreRecord): (string | number | boolean | null)[] {
    // Extract TC scores from rubricData for teacher columns
    const tcScores = Array(10).fill('');
    entity.rubricData?.forEach((item, idx) => {
      if (idx < 10) tcScores[idx] = item.score;
    });

    return [
      this.str((entity as ScoreRecord & { _email?: string })._email ?? ''),    // A: Email
      this.str((entity as ScoreRecord & { _tenSV?: string })._tenSV ?? ''),    // B: Tên SV
      this.str((entity as ScoreRecord & { _mssv?: string })._mssv ?? ''),      // C: MSSV
      this.str((entity as ScoreRecord & { _tenDetai?: string })._tenDetai ?? ''), // D: Tên Đề tài
      this.str((entity as ScoreRecord & { _gvName?: string })._gvName ?? ''), // E: GV
      this.str(entity.scorerRole),   // F: Role
      tcScores[0],                   // G: TC1
      tcScores[1],                   // H: TC2
      tcScores[2],                   // I: TC3
      tcScores[3],                   // J: TC4
      tcScores[4],                   // K: TC5
      tcScores[5],                   // L: TC6
      tcScores[6],                   // M: TC7
      tcScores[7],                   // N: TC8
      tcScores[8],                   // O: TC9
      tcScores[9],                   // P: TC10
      entity.id,                     // Q: id
      this.str(entity.topicId),      // R: topicId
      this.str(entity.scorerUserId), // S: scorerUserId
      this.str(entity.scorerRole),   // T: scorerRole
      this.str(entity.status),       // U: status
      Number.isFinite(entity.totalScore) ? entity.totalScore : 0, // V: totalScore
      JSON.stringify(entity.rubricData ?? []),  // W: rubricData
      entity.allowDefense ?? '',                // X: allowDefense
      JSON.stringify(entity.questions ?? []),   // Y: questions
      this.str(entity.submittedAt ?? ''),       // Z: submittedAt
      this.str(entity.updatedAt),               // AA: updatedAt
    ];
  }

  private parseScorerRole(value: string): ScorerRole {
    const normalized = value.trim().toUpperCase();
    const mapping: Record<string, ScorerRole> = {
      'GVHD': 'GVHD',
      'GVPB': 'GVPB',
      'TV_HD': 'TV_HD',
      'TVHD': 'TV_HD',
      // Council roles that score under TV_HD identity
      'CT_HD': 'TV_HD',
      'CTHD': 'TV_HD',
      'TK_HD': 'TV_HD',
      'THUKYHD': 'TV_HD',
    };
    const resolved = mapping[normalized];
    if (!resolved) {
      // DB-02 fix: fail fast to avoid mis-assigning council scores.
      throw new Error(
        `[ScoresRepository] Unknown scorerRole value: "${value}". Expected one of GVHD|GVPB|TV_HD|CT_HD|TK_HD.`,
      );
    }
    return resolved;
  }

  private parseScoreStatus(value: string): ScoreStatus {
    const valid: ScoreStatus[] = ['DRAFT', 'SUBMITTED'];
    return valid.includes(value as ScoreStatus) ? (value as ScoreStatus) : 'DRAFT';
  }

  private parseRubricData(value: unknown): RubricItem[] {
    if (typeof value !== 'string' || value.trim() === '') return [];
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => {
          if (typeof item !== 'object' || item === null) return null;
          const obj = item as Record<string, unknown>;
          const criterion = typeof obj.criterion === 'string' ? obj.criterion : '';
          const score = typeof obj.score === 'number' ? obj.score : Number(obj.score ?? 0);
          const max = typeof obj.max === 'number' ? obj.max : Number(obj.max ?? 0);
          const note = typeof obj.note === 'string' ? obj.note : undefined;
          if (!criterion || !Number.isFinite(score) || !Number.isFinite(max)) return null;
          const rubric: RubricItem = { criterion, score, max };
          if (note !== undefined) rubric.note = note;
          return rubric;
        })
        .filter((item): item is RubricItem => item !== null);
    } catch {
      return [];
    }
  }

  private parseQuestions(value: unknown): string[] {
    if (typeof value !== 'string' || value.trim() === '') return [];
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0);
    } catch {
      return [];
    }
  }
}

/**
 * ScoreSummaries tab column layout (v3.3 — app-specific tab):
 * [0]=id [1]=topicId [2]=gvhdScore [3]=gvpbScore [4]=councilAvgScore
 * [5]=finalScore [6]=result [7]=confirmedByGvhd [8]=confirmedByCtHd [9]=published [10]=updatedAt
 * [11]=councilComments (góp ý bổ sung của hội đồng - do Thư ký nhập)
 * [12]=appealRequestedAt [13]=appealRequestedBy [14]=appealReason [15]=appealStatus
 * [16]=appealResolvedAt [17]=appealResolvedBy [18]=appealResolutionNote [19]=appealScoreAdjusted
 * [20]=appealChoice [21]=appealChoiceAt [22]=rubricDriveLink
 * [23]=aggregatedByTkHd [24]=aggregatedByTkHdAt [25]=aggregatedByTkHdUserId
 */
@Injectable()
export class ScoreSummariesRepository extends SheetsBaseRepository<ScoreSummaryRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    super(sheetsClient, SHEET_NAMES.SCORE_SUMMARIES);
  }

  protected fromRow(row: SheetRow): ScoreSummaryRecord {
    const v = row.values;
    const appealChoiceRaw = this.optionalStr(v[20]);
    return {
      id: this.str(v[0]),
      topicId: this.str(v[1]),
      gvhdScore: this.optionalNum(v[2]),
      gvpbScore: this.optionalNum(v[3]),
      councilAvgScore: this.optionalNum(v[4]),
      finalScore: this.num(v[5], 0),
      result: this.parseScoreResult(this.str(v[6])),
      confirmedByGvhd: this.bool(v[7]),
      confirmedByCtHd: this.bool(v[8]),
      published: this.bool(v[9]),
      updatedAt: this.str(v[10]),     // DB-03: was missing
      councilComments: this.optionalStr(v[11]),
      appealRequestedAt: this.optionalStr(v[12]),
      appealRequestedBy: this.optionalStr(v[13]),
      appealReason: this.optionalStr(v[14]),
      appealStatus: this.parseAppealStatus(this.optionalStr(v[15])),
      appealResolvedAt: this.optionalStr(v[16]),
      appealResolvedBy: this.optionalStr(v[17]),
      appealResolutionNote: this.optionalStr(v[18]),
      appealScoreAdjusted:
        this.optionalStr(v[19]) === undefined ? undefined : this.bool(v[19]),
      appealChoice:
        appealChoiceRaw === 'NO_APPEAL' || appealChoiceRaw === 'ACCEPT'
          ? (appealChoiceRaw as 'NO_APPEAL' | 'ACCEPT')
          : undefined,
      appealChoiceAt: this.optionalStr(v[21]),
      rubricDriveLink: this.optionalStr(v[22]),
      aggregatedByTkHd:
        this.optionalStr(v[23]) === undefined ? undefined : this.bool(v[23]),
      aggregatedByTkHdAt: this.optionalStr(v[24]),
      aggregatedByTkHdUserId: this.optionalStr(v[25]),
    };
  }

  protected toRow(entity: ScoreSummaryRecord): (string | number | boolean | null)[] {
    return [
      entity.id,
      this.str(entity.topicId),
      entity.gvhdScore ?? '',
      entity.gvpbScore ?? '',
      entity.councilAvgScore ?? '',
      Number.isFinite(entity.finalScore) ? entity.finalScore : 0,
      this.str(entity.result),
      entity.confirmedByGvhd,
      entity.confirmedByCtHd,
      entity.published,
      new Date().toISOString(), // [10] updatedAt
      entity.councilComments ?? '', // [11] councilComments
      this.str(entity.appealRequestedAt ?? ''), // [12] appealRequestedAt
      this.str(entity.appealRequestedBy ?? ''), // [13] appealRequestedBy
      this.str(entity.appealReason ?? ''), // [14] appealReason
      this.str(entity.appealStatus ?? ''), // [15] appealStatus
      this.str(entity.appealResolvedAt ?? ''), // [16] appealResolvedAt
      this.str(entity.appealResolvedBy ?? ''), // [17] appealResolvedBy
      this.str(entity.appealResolutionNote ?? ''), // [18] appealResolutionNote
      entity.appealScoreAdjusted ?? '', // [19] appealScoreAdjusted
      this.str(entity.appealChoice ?? ''), // [20] appealChoice
      this.str(entity.appealChoiceAt ?? ''), // [21] appealChoiceAt
      this.str(entity.rubricDriveLink ?? ''), // [22] rubricDriveLink
      entity.aggregatedByTkHd ?? '', // [23] aggregatedByTkHd
      this.str(entity.aggregatedByTkHdAt ?? ''), // [24] aggregatedByTkHdAt
      this.str(entity.aggregatedByTkHdUserId ?? ''), // [25] aggregatedByTkHdUserId
    ];
  }

  private parseScoreResult(value: string): ScoreResult {
    const valid: ScoreResult[] = ['PASS', 'FAIL', 'PENDING'];
    return valid.includes(value as ScoreResult) ? (value as ScoreResult) : 'PENDING';
  }

  private parseAppealStatus(value: string | undefined): ScoreAppealStatus | undefined {
    if (!value) return undefined;
    return value === 'PENDING' || value === 'RESOLVED' ? value : undefined;
  }
}
