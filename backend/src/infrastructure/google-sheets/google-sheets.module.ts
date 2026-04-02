import { Module, Global } from '@nestjs/common';
import { GoogleSheetsClient } from './google-sheets.client';
import {
  AuditLogsRepository,
  AssignmentsRepository,
  ExportFilesRepository,
  NotificationsRepository,
  PeriodsRepository,
  RevisionRoundsRepository,
  RubricCriteriaRepository,
  SchedulesRepository,
  ScoreSummariesRepository,
  ScoresRepository,
  SubmissionsRepository,
  SystemConfigRepository,
  TopicsRepository,
  UsersRepository,
} from './repositories';

const repositories = [
  AuditLogsRepository,
  UsersRepository,
  PeriodsRepository,
  TopicsRepository,
  RevisionRoundsRepository,
  AssignmentsRepository,
  SubmissionsRepository,
  ScoresRepository,
  ScoreSummariesRepository,
  RubricCriteriaRepository,
  NotificationsRepository,
  ExportFilesRepository,
  SchedulesRepository,
  SystemConfigRepository,
] as const;

@Global()
@Module({
  providers: [GoogleSheetsClient, ...repositories],
  exports: [GoogleSheetsClient, ...repositories],
})
export class GoogleSheetsModule {}
