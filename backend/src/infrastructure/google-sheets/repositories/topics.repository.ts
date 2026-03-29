import { Injectable } from '@nestjs/common';
import { SheetsBaseRepository } from '../sheets-base.repository';
import { GoogleSheetsClient, SheetRow } from '../google-sheets.client';
import { SHEET_NAMES } from '../sheets.constants';
import type { TopicRecord } from '../../../modules/topics/topics.service';
import type { TopicState, TopicType } from '../../../modules/topics/topic-state.enum';

@Injectable()
export class TopicsRepository extends SheetsBaseRepository<TopicRecord> {
  constructor(sheetsClient: GoogleSheetsClient) {
    super(sheetsClient, SHEET_NAMES.TOPICS);
  }

  protected fromRow(row: SheetRow): TopicRecord {
    const v = row.values;
    const typeValue = this.str(v[2]);
    const stateValue = this.str(v[8]);

    const type: TopicType = typeValue === 'KLTN' ? 'KLTN' : 'BCTT';
    const state: TopicState = this.parseState(stateValue);

    return {
      id: this.str(v[0]),
      periodId: this.str(v[1]),
      type,
      title: this.str(v[3]),
      domain: this.str(v[4]),
      companyName: this.optionalStr(v[5]),
      studentUserId: this.str(v[6]),
      supervisorUserId: this.str(v[7]),
      state,
      approvalDeadlineAt: this.optionalStr(v[9]),
      submitStartAt: this.optionalStr(v[10]),
      submitEndAt: this.optionalStr(v[11]),
      createdAt: this.str(v[14]),
      updatedAt: this.str(v[15]),
    };
  }

  protected toRow(entity: TopicRecord): (string | number | boolean | null)[] {
    return [
      entity.id,
      this.str(entity.periodId),
      this.str(entity.type),
      this.str(entity.title),
      this.str(entity.domain),
      this.str(entity.companyName ?? ''),
      this.str(entity.studentUserId),
      this.str(entity.supervisorUserId),
      this.str(entity.state),
      this.str(entity.approvalDeadlineAt ?? ''),
      this.str(entity.submitStartAt ?? ''),
      this.str(entity.submitEndAt ?? ''),
      '',
      '',
      this.str(entity.createdAt),
      this.str(entity.updatedAt),
    ];
  }

  private parseState(value: string): TopicState {
    const validStates: TopicState[] = [
      'DRAFT',
      'PENDING_GV',
      'CONFIRMED',
      'IN_PROGRESS',
      'GRADING',
      'PENDING_CONFIRM',
      'DEFENSE',
      'SCORING',
      'COMPLETED',
      'CANCELLED',
    ];

    return validStates.includes(value as TopicState)
      ? (value as TopicState)
      : 'DRAFT';
  }
}
