import { Injectable } from '@nestjs/common';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { SHEET_NAMES, SheetName } from '../sheets.constants';

export type ScorerRole = 'GVHD' | 'GVPB' | 'TV_HD' | 'CT_HD';
export type TopicType = 'BCTT' | 'KLTN';
export type RubricApplicableTo = TopicType | 'ALL';

export interface RubricCriterionRecord {
  id: string;
  code: string;        // TC1, TC2, ...
  name: string;        // Tên tiêu chí
  description: string; // Mô tả chi tiết (from HĐồng tab's Mô tả col)
  maxScore: number;    // Điểm tối đa
  order: number;       // Thứ tự hiển thị
  applicableTo: RubricApplicableTo;
  scorerRole: ScorerRole; // Which role uses this criterion
}

/**
 * BB/HĐồng tab column layout (v3.2):
 * Teacher cols: [0]=Tên TC  [1]=Điểm tối đa  (or Mô tả for HĐồng tab)
 * App cols:     [2]=id  [3]=code  [4]=order  [5]=scorerRole
 *
 * There are 5 BB tabs in the teacher sheet:
 *   - BB GVHD - Ứng dụng  → scorerRole=GVHD, applicableTo=ALL (Ứng dụng)
 *   - BB GVHD - NC         → scorerRole=GVHD, applicableTo=ALL (Nghiên cứu)
 *   - BB GVPB - Ứng dụng  → scorerRole=GVPB, applicableTo=ALL
 *   - BB GVPB - NC         → scorerRole=GVPB, applicableTo=ALL
 *   - Chấm điểm của HĐồng → scorerRole=TV_HD, applicableTo=ALL
 *
 * We expose a single RubricCriteriaRepository that aggregates all 5 tabs.
 */

class SingleBBRepository extends SheetsBaseRepository<RubricCriterionRecord> {
  constructor(
    sheetsClient: GoogleSheetsClient,
    sheetName: SheetName,
    private readonly defaultScorerRole: ScorerRole,
    private readonly defaultApplicableTo: RubricApplicableTo,
    private readonly isHDong: boolean, // HĐồng tab uses Mô tả instead of Điểm tối đa
  ) {
    super(sheetsClient, sheetName);
  }

  protected fromRow(row: SheetRow): RubricCriterionRecord {
    const v = row.values;
    const name = this.str(v[0]);
    const secondCol = this.str(v[1]); // Điểm tối đa OR Mô tả
    const maxScore = this.isHDong ? 10 : this.num(v[1], 10);
    const description = this.isHDong ? secondCol : '';

    return {
      id: this.str(v[2]),
      code: this.str(v[3]) || `TC_${name.replace(/\s+/g, '_')}`,
      name,
      description,
      maxScore,
      order: this.num(v[4], 0),
      applicableTo: this.defaultApplicableTo,
      scorerRole: (this.str(v[5]) as ScorerRole) || this.defaultScorerRole,
    };
  }

  protected toRow(entity: RubricCriterionRecord): (string | number | boolean | null)[] {
    return [
      entity.name,                          // A: Tên TC
      this.isHDong ? entity.description : entity.maxScore, // B: Mô tả or Điểm tối đa
      entity.id,                            // C: id
      entity.code,                          // D: code
      entity.order,                         // E: order
      entity.scorerRole,                    // F: scorerRole
    ];
  }
}

/**
 * Aggregated repository that reads from all 5 BB/HĐồng tabs
 */
@Injectable()
export class RubricCriteriaRepository {
  private readonly repos: SingleBBRepository[];

  constructor(sheetsClient: GoogleSheetsClient) {
    this.repos = [
      new SingleBBRepository(sheetsClient, SHEET_NAMES.BB_GVHD_UNG_DUNG, 'GVHD', 'ALL', false),
      new SingleBBRepository(sheetsClient, SHEET_NAMES.BB_GVHD_NC, 'GVHD', 'ALL', false),
      new SingleBBRepository(sheetsClient, SHEET_NAMES.BB_GVPB_UNG_DUNG, 'GVPB', 'ALL', false),
      new SingleBBRepository(sheetsClient, SHEET_NAMES.BB_GVPB_NC, 'GVPB', 'ALL', false),
      new SingleBBRepository(sheetsClient, SHEET_NAMES.CHAM_DIEM_HDONG, 'TV_HD', 'ALL', true),
    ];
  }

  async findAll(): Promise<RubricCriterionRecord[]> {
    const results = await Promise.all(this.repos.map((r) => r.findAll()));
    return results.flat();
  }

  async findByScorerRole(role: ScorerRole): Promise<RubricCriterionRecord[]> {
    const all = await this.findAll();
    return all
      .filter((c) => c.scorerRole === role)
      .sort((a, b) => a.order - b.order);
  }

  async findByApplicableTo(target: TopicType): Promise<RubricCriterionRecord[]> {
    const all = await this.findAll();
    return all
      .filter((c) => c.applicableTo === target || c.applicableTo === 'ALL')
      .sort((a, b) => a.order - b.order);
  }

  async findById(id: string): Promise<RubricCriterionRecord | null> {
    const all = await this.findAll();
    return all.find((c) => c.id === id) ?? null;
  }
}
