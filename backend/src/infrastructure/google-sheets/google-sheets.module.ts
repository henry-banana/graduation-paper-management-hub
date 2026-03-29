import { Module, Global } from '@nestjs/common';
import { GoogleSheetsClient } from './google-sheets.client';
import {
  AuditLogsRepository,
  AssignmentsRepository,
  ExportFilesRepository,
  NotificationsRepository,
  PeriodsRepository,
  SchedulesRepository,
  ScoreSummariesRepository,
  ScoresRepository,
  SubmissionsRepository,
  TopicsRepository,
  UsersRepository,
} from './repositories';

const repositories = [
  AuditLogsRepository,
  UsersRepository,
  PeriodsRepository,
  TopicsRepository,
  AssignmentsRepository,
  SubmissionsRepository,
  ScoresRepository,
  ScoreSummariesRepository,
  NotificationsRepository,
  ExportFilesRepository,
  SchedulesRepository,
] as const;

@Global()
@Module({
  providers: [GoogleSheetsClient, ...repositories],
  exports: [GoogleSheetsClient, ...repositories],
})
export class GoogleSheetsModule {}
