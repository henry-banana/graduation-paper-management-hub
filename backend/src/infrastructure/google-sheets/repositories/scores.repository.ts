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
  ScoreResult,
  ScorerRole,
  ScoreStatus,
} from '../../../modules/scores/dto';

@Injectable()
export class ScoresRepository extends SheetsBaseRepository<ScoreRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    super(sheetsClient, SHEET_NAMES.SCORES);
  }

  protected fromRow(row: SheetRow): ScoreRecord {
    const v = row.values;

    return {
      id: this.str(v[0]),
      topicId: this.str(v[1]),
      scorerUserId: this.str(v[2]),
      scorerRole: this.parseScorerRole(this.str(v[3])),
      status: this.parseScoreStatus(this.str(v[4])),
      totalScore: this.num(v[5], 0),
      rubricData: this.parseRubricData(v[6]),
      allowDefense: this.bool(v[7]),
      questions: this.parseQuestions(v[8]),
      submittedAt: this.optionalStr(v[9]),
      updatedAt: this.str(v[10]),
    };
  }

  protected toRow(entity: ScoreRecord): (string | number | boolean | null)[] {
    return [
      entity.id,
      this.str(entity.topicId),
      this.str(entity.scorerUserId),
      this.str(entity.scorerRole),
      this.str(entity.status),
      Number.isFinite(entity.totalScore) ? entity.totalScore : 0,
      JSON.stringify(entity.rubricData ?? []),
      entity.allowDefense ?? '',
      JSON.stringify(entity.questions ?? []),
      this.str(entity.submittedAt ?? ''),
      this.str(entity.updatedAt),
    ];
  }

  private parseScorerRole(value: string): ScorerRole {
    const valid: ScorerRole[] = ['GVHD', 'GVPB', 'TV_HD'];
    return valid.includes(value as ScorerRole)
      ? (value as ScorerRole)
      : 'GVHD';
  }

  private parseScoreStatus(value: string): ScoreStatus {
    const valid: ScoreStatus[] = ['DRAFT', 'SUBMITTED'];
    return valid.includes(value as ScoreStatus)
      ? (value as ScoreStatus)
      : 'DRAFT';
  }

  private parseRubricData(value: unknown): RubricItem[] {
    if (typeof value !== 'string' || value.trim() === '') {
      return [];
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((item) => {
          if (typeof item !== 'object' || item === null) {
            return null;
          }
          const obj = item as Record<string, unknown>;
          const criterion = typeof obj.criterion === 'string' ? obj.criterion : '';
          const score = typeof obj.score === 'number' ? obj.score : Number(obj.score ?? 0);
          const max = typeof obj.max === 'number' ? obj.max : Number(obj.max ?? 0);
          const note = typeof obj.note === 'string' ? obj.note : undefined;

          if (!criterion || !Number.isFinite(score) || !Number.isFinite(max)) {
            return null;
          }

          const rubric: RubricItem = { criterion, score, max };
          if (note !== undefined) {
            rubric.note = note;
          }
          return rubric;
        })
        .filter((item): item is RubricItem => item !== null);
    } catch {
      return [];
    }
  }

  private parseQuestions(value: unknown): string[] {
    if (typeof value !== 'string' || value.trim() === '') {
      return [];
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0);
    } catch {
      return [];
    }
  }
}

@Injectable()
export class ScoreSummariesRepository extends SheetsBaseRepository<ScoreSummaryRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    super(sheetsClient, SHEET_NAMES.SCORE_SUMMARIES);
  }

  protected fromRow(row: SheetRow): ScoreSummaryRecord {
    const v = row.values;

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
      '',
    ];
  }

  private parseScoreResult(value: string): ScoreResult {
    const valid: ScoreResult[] = ['PASS', 'FAIL', 'PENDING'];
    return valid.includes(value as ScoreResult)
      ? (value as ScoreResult)
      : 'PENDING';
  }
}
