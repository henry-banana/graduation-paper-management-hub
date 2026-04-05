import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import {
  AssignmentsRepository,
  AuditLogsRepository,
  ExportFilesRepository,
  NotificationsRepository,
  PeriodsRepository,
  SchedulesRepository,
  ScoreSummariesRepository,
  ScoresRepository,
  SubmissionsRepository,
  TopicsRepository,
  UsersRepository,
} from '../infrastructure/google-sheets';

const logger = new Logger('InspectSheets');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const usersRepository = app.get(UsersRepository);
    const periodsRepository = app.get(PeriodsRepository);
    const topicsRepository = app.get(TopicsRepository);
    const assignmentsRepository = app.get(AssignmentsRepository);
    const submissionsRepository = app.get(SubmissionsRepository);
    const scoresRepository = app.get(ScoresRepository);
    const scoreSummariesRepository = app.get(ScoreSummariesRepository);
    const notificationsRepository = app.get(NotificationsRepository);
    const exportFilesRepository = app.get(ExportFilesRepository);
    const schedulesRepository = app.get(SchedulesRepository);
    const auditLogsRepository = app.get(AuditLogsRepository);

    const [
      users,
      periods,
      topics,
      assignments,
      submissions,
      scores,
      scoreSummaries,
      notifications,
      exportsData,
      schedules,
      auditLogs,
    ] = await Promise.all([
      usersRepository.findAll(),
      periodsRepository.findAll(),
      topicsRepository.findAll(),
      assignmentsRepository.findAll(),
      submissionsRepository.findAll(),
      scoresRepository.findAll(),
      scoreSummariesRepository.findAll(),
      notificationsRepository.findAll(),
      exportFilesRepository.findAll(),
      schedulesRepository.findAll(),
      auditLogsRepository.findAll(),
    ]);

    const rows = [
      { tab: 'Users', count: users.length, sampleIds: users.slice(0, 3).map((r) => r.id) },
      { tab: 'Periods', count: periods.length, sampleIds: periods.slice(0, 3).map((r) => r.id) },
      { tab: 'Topics', count: topics.length, sampleIds: topics.slice(0, 3).map((r) => r.id) },
      {
        tab: 'Assignments',
        count: assignments.length,
        sampleIds: assignments.slice(0, 3).map((r) => r.id),
      },
      {
        tab: 'Submissions',
        count: submissions.length,
        sampleIds: submissions.slice(0, 3).map((r) => r.id),
      },
      { tab: 'Scores', count: scores.length, sampleIds: scores.slice(0, 3).map((r) => r.id) },
      {
        tab: 'ScoreSummaries',
        count: scoreSummaries.length,
        sampleIds: scoreSummaries.slice(0, 3).map((r) => r.id),
      },
      {
        tab: 'Notifications',
        count: notifications.length,
        sampleIds: notifications.slice(0, 3).map((r) => r.id),
      },
      {
        tab: 'ExportFiles',
        count: exportsData.length,
        sampleIds: exportsData.slice(0, 3).map((r) => r.id),
      },
      { tab: 'Schedules', count: schedules.length, sampleIds: schedules.slice(0, 3).map((r) => r.id) },
      { tab: 'AuditLogs', count: auditLogs.length, sampleIds: auditLogs.slice(0, 3).map((r) => r.id) },
    ];

    logger.log('Google Sheets row counts:');
    for (const row of rows) {
      logger.log(`${row.tab}: ${row.count} rows | sample IDs: ${row.sampleIds.join(', ')}`);
    }

    const bcttScore = scores.find((score) => score.id === 'score-bctt-done-gvhd');
    const kltnReviewer = scores.find((score) => score.id === 'score-kltn-gvpb');

    logger.log(
      `Seed check: BCTT score score-bctt-done-gvhd ${bcttScore ? 'FOUND' : 'MISSING'}, KLTN reviewer score score-kltn-gvpb ${kltnReviewer ? 'FOUND' : 'MISSING'}`,
    );
  } finally {
    await app.close();
  }
}

void bootstrap();
