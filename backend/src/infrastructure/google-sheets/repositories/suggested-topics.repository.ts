import { Injectable } from '@nestjs/common';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SHEET_NAMES } from '../sheets.constants';

/**
 * Detaigoiy tab column layout:
 * [0]=SupervisorEmail  [1]=TopicTitle  [2]=Dot (period code)
 * [3]=id  [4]=lecturerUserId  [5]=createdAt
 */
export interface SuggestedTopicRecord {
  id: string;
  supervisorEmail: string;
  title: string;
  dot: string;
  lecturerUserId?: string;
  createdAt?: string;
  isVisible?: boolean;  // TBM can hide suggestions from search results
}

@Injectable()
export class SuggestedTopicsRepository extends SheetsBaseRepository<SuggestedTopicRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    // Detaigoiy tab: id at col D = index 3 (after 3 teacher cols: SupervisorEmail,TopicTitle,Dot)
    super(sheetsClient, SHEET_NAMES.DETAIGOIY, 3);
  }

  /**
   * Search suggestions by title substring (case-insensitive).
   * Optionally filter by supervisorEmail.
   */
  async search(query: string, supervisorEmail?: string): Promise<SuggestedTopicRecord[]> {
    const rows = await this.sheetsClient.getRows(this.sheetName);
    const queryLower = query.toLowerCase().trim();

    return rows
      .filter((r) => r.values[0] !== '__DELETED__')
      .map((r) => this.fromRow(r))
      .filter((rec) => {
        if (!rec.title) return false;
        // Only return visible suggestions to students
        if (rec.isVisible === false) return false;
        const matchTitle = rec.title.toLowerCase().includes(queryLower);
        if (!matchTitle) return false;
        if (supervisorEmail) {
          return rec.supervisorEmail.toLowerCase() === supervisorEmail.toLowerCase();
        }
        return true;
      })
      .slice(0, 15);
  }

  /**
   * Get all suggestions (for listing / admin).
   */
  async findAll(): Promise<SuggestedTopicRecord[]> {
    const rows = await this.sheetsClient.getRows(this.sheetName);
    return rows
      .filter((r) => r.values[0] !== '__DELETED__')
      .map((r) => this.fromRow(r))
      .filter((r) => !!r.title);
  }

  protected fromRow(row: SheetRow): SuggestedTopicRecord {
    const v = row.values;
    return {
      id: this.str(v[3]) || `det-${row.sheetRowNumber}`,
      supervisorEmail: this.str(v[0]),
      title: this.str(v[1]),
      dot: this.str(v[2]),
      lecturerUserId: this.optionalStr(v[4]),
      createdAt: this.optionalStr(v[5]),
      isVisible: v[6] !== undefined ? this.bool(v[6]) : true, // default visible
    };
  }

  protected toRow(entity: SuggestedTopicRecord): (string | number | boolean | null)[] {
    return [
      entity.supervisorEmail,
      entity.title,
      entity.dot,
      entity.id,
      entity.lecturerUserId ?? '',
      entity.createdAt ?? '',
      entity.isVisible !== false ? 'TRUE' : 'FALSE', // [6]: isVisible
    ];
  }

  /**
   * Find all suggestions created by a specific lecturer.
   */
  async findByLecturerId(lecturerUserId: string): Promise<SuggestedTopicRecord[]> {
    return this.findWhere((r) => r.lecturerUserId === lecturerUserId);
  }
}
