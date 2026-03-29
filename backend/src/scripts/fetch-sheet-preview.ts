import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { promises as fs } from 'fs';
import { join } from 'path';
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
import type { AssignmentRecord } from '../modules/assignments/assignments.service';
import type { AuditLogRecord } from '../modules/audit/audit.service';
import type { ExportRecord } from '../modules/exports/exports.service';
import type { NotificationRecord } from '../modules/notifications/notifications.service';
import type { PeriodRecord } from '../modules/periods/periods.service';
import type { ScheduleRecord } from '../modules/schedules/schedules.service';
import type {
  ScoreRecord,
  ScoreSummaryRecord,
} from '../modules/scores/scores.service';
import type { SubmissionRecord } from '../modules/submissions/submissions.service';
import type { TopicRecord } from '../modules/topics/topics.service';
import type { UserRecord } from '../modules/users/users.service';

type ImpactSeverity = 'INFO' | 'WARN' | 'ERROR';

type ImpactIssue = {
  severity: ImpactSeverity;
  code: string;
  message: string;
  entityId?: string;
};

type TopicExportReadiness = {
  topicId: string;
  type: TopicRecord['type'];
  state: TopicRecord['state'];
  bcttReady: boolean;
  bcttScoreIds: string[];
  kltnReady: boolean;
  kltnScoreIds: {
    GVHD: string[];
    GVPB: string[];
    TV_HD: string[];
  };
};

const logger = new Logger('FetchSheetPreview');
const KLTN_READY_STATES = new Set(['DEFENSE', 'COMPLETED']);

function createCountSummary<T extends { id: string }>(rows: T[]): {
  count: number;
  sampleIds: string[];
} {
  return {
    count: rows.length,
    sampleIds: rows.slice(0, 5).map((row) => row.id),
  };
}

function buildIdSet<T extends { id: string }>(rows: T[]): Set<string> {
  return new Set(rows.map((row) => row.id));
}

function pushIssue(
  target: ImpactIssue[],
  severity: ImpactSeverity,
  code: string,
  message: string,
  entityId?: string,
): void {
  target.push({ severity, code, message, entityId });
}

function computeTopicReadiness(
  topics: TopicRecord[],
  scores: ScoreRecord[],
): TopicExportReadiness[] {
  return topics.map((topic) => {
    const topicScores = scores.filter((score) => score.topicId === topic.id);
    const bcttSubmitted = topicScores.filter(
      (score) => score.scorerRole === 'GVHD' && score.status === 'SUBMITTED',
    );

    const gvhdSubmitted = topicScores.filter(
      (score) => score.scorerRole === 'GVHD' && score.status === 'SUBMITTED',
    );
    const gvpbSubmitted = topicScores.filter(
      (score) => score.scorerRole === 'GVPB' && score.status === 'SUBMITTED',
    );
    const councilSubmitted = topicScores.filter(
      (score) => score.scorerRole === 'TV_HD' && score.status === 'SUBMITTED',
    );

    const bcttReady = topic.type === 'BCTT' && bcttSubmitted.length > 0;
    const kltnReady =
      topic.type === 'KLTN' &&
      KLTN_READY_STATES.has(topic.state) &&
      gvhdSubmitted.length > 0 &&
      gvpbSubmitted.length > 0 &&
      councilSubmitted.length > 0;

    return {
      topicId: topic.id,
      type: topic.type,
      state: topic.state,
      bcttReady,
      bcttScoreIds: bcttSubmitted.map((score) => score.id),
      kltnReady,
      kltnScoreIds: {
        GVHD: gvhdSubmitted.map((score) => score.id),
        GVPB: gvpbSubmitted.map((score) => score.id),
        TV_HD: councilSubmitted.map((score) => score.id),
      },
    };
  });
}

function analyzeDataImpact(data: {
  users: UserRecord[];
  periods: PeriodRecord[];
  topics: TopicRecord[];
  assignments: AssignmentRecord[];
  submissions: SubmissionRecord[];
  scores: ScoreRecord[];
  scoreSummaries: ScoreSummaryRecord[];
  notifications: NotificationRecord[];
  exportsData: ExportRecord[];
  schedules: ScheduleRecord[];
  auditLogs: AuditLogRecord[];
}): {
  issues: ImpactIssue[];
  topicExportReadiness: TopicExportReadiness[];
} {
  const issues: ImpactIssue[] = [];

  const userIds = buildIdSet(data.users);
  const periodIds = buildIdSet(data.periods);
  const topicIds = buildIdSet(data.topics);

  for (const topic of data.topics) {
    if (!periodIds.has(topic.periodId)) {
      pushIssue(
        issues,
        'ERROR',
        'TOPIC_PERIOD_MISSING',
        `Topic ${topic.id} references missing period ${topic.periodId}`,
        topic.id,
      );
    }

    if (!userIds.has(topic.studentUserId)) {
      pushIssue(
        issues,
        'ERROR',
        'TOPIC_STUDENT_MISSING',
        `Topic ${topic.id} references missing student ${topic.studentUserId}`,
        topic.id,
      );
    }

    if (!userIds.has(topic.supervisorUserId)) {
      pushIssue(
        issues,
        'ERROR',
        'TOPIC_SUPERVISOR_MISSING',
        `Topic ${topic.id} references missing supervisor ${topic.supervisorUserId}`,
        topic.id,
      );
    }

    if (!['BCTT', 'KLTN'].includes(topic.type)) {
      pushIssue(
        issues,
        'WARN',
        'TOPIC_TYPE_UNKNOWN',
        `Topic ${topic.id} has unsupported type ${topic.type}`,
        topic.id,
      );
    }
  }

  for (const assignment of data.assignments) {
    if (!topicIds.has(assignment.topicId)) {
      pushIssue(
        issues,
        'ERROR',
        'ASSIGNMENT_TOPIC_MISSING',
        `Assignment ${assignment.id} references missing topic ${assignment.topicId}`,
        assignment.id,
      );
    }

    if (!userIds.has(assignment.userId)) {
      pushIssue(
        issues,
        'ERROR',
        'ASSIGNMENT_USER_MISSING',
        `Assignment ${assignment.id} references missing user ${assignment.userId}`,
        assignment.id,
      );
    }
  }

  for (const submission of data.submissions) {
    if (!topicIds.has(submission.topicId)) {
      pushIssue(
        issues,
        'ERROR',
        'SUBMISSION_TOPIC_MISSING',
        `Submission ${submission.id} references missing topic ${submission.topicId}`,
        submission.id,
      );
    }

    if (!userIds.has(submission.uploaderUserId)) {
      pushIssue(
        issues,
        'ERROR',
        'SUBMISSION_UPLOADER_MISSING',
        `Submission ${submission.id} references missing uploader ${submission.uploaderUserId}`,
        submission.id,
      );
    }
  }

  const topicById = new Map(data.topics.map((topic) => [topic.id, topic]));
  for (const score of data.scores) {
    const topic = topicById.get(score.topicId);
    if (!topic) {
      pushIssue(
        issues,
        'ERROR',
        'SCORE_TOPIC_MISSING',
        `Score ${score.id} references missing topic ${score.topicId}`,
        score.id,
      );
      continue;
    }

    if (topic.type === 'BCTT' && score.scorerRole !== 'GVHD') {
      pushIssue(
        issues,
        'WARN',
        'BCTT_ROLE_MISMATCH',
        `Score ${score.id} has scorerRole ${score.scorerRole} but topic ${topic.id} is BCTT`,
        score.id,
      );
    }

    if (
      topic.type === 'KLTN' &&
      !['GVHD', 'GVPB', 'TV_HD'].includes(score.scorerRole)
    ) {
      pushIssue(
        issues,
        'WARN',
        'KLTN_ROLE_MISMATCH',
        `Score ${score.id} has scorerRole ${score.scorerRole} but topic ${topic.id} is KLTN`,
        score.id,
      );
    }

    if (!['DRAFT', 'SUBMITTED'].includes(score.status)) {
      pushIssue(
        issues,
        'WARN',
        'SCORE_STATUS_UNEXPECTED',
        `Score ${score.id} has unexpected status ${score.status}`,
        score.id,
      );
    }
  }

  const topicExportReadiness = computeTopicReadiness(data.topics, data.scores);

  for (const status of topicExportReadiness) {
    if (status.type === 'BCTT' && !status.bcttReady) {
      pushIssue(
        issues,
        'WARN',
        'BCTT_EXPORT_NOT_READY',
        `Topic ${status.topicId} (BCTT) has no SUBMITTED GVHD score for rubric export`,
        status.topicId,
      );
    }

    if (status.type === 'KLTN' && !status.kltnReady) {
      const details: string[] = [];
      if (!KLTN_READY_STATES.has(status.state)) {
        details.push(`state=${status.state} (need DEFENSE/COMPLETED)`);
      }
      if (status.kltnScoreIds.GVHD.length === 0) {
        details.push('missing SUBMITTED GVHD score');
      }
      if (status.kltnScoreIds.GVPB.length === 0) {
        details.push('missing SUBMITTED GVPB score');
      }
      if (status.kltnScoreIds.TV_HD.length === 0) {
        details.push('missing SUBMITTED TV_HD score');
      }
      pushIssue(
        issues,
        'WARN',
        'KLTN_EXPORT_NOT_READY',
        `Topic ${status.topicId} (KLTN) not ready for full rubric export: ${details.join(', ')}`,
        status.topicId,
      );
    }
  }

  if (issues.length === 0) {
    pushIssue(
      issues,
      'INFO',
      'NO_IMPACT_ISSUE',
      'No immediate data integrity issue detected for backend logic checks',
    );
  }

  return { issues, topicExportReadiness };
}

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

    const analysis = analyzeDataImpact({
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
    });

    const output = {
      generatedAt: new Date().toISOString(),
      source: 'Google Sheets live data via backend repositories',
      summary: {
        users: createCountSummary(users),
        periods: createCountSummary(periods),
        topics: createCountSummary(topics),
        assignments: createCountSummary(assignments),
        submissions: createCountSummary(submissions),
        scores: createCountSummary(scores),
        scoreSummaries: createCountSummary(scoreSummaries),
        notifications: createCountSummary(notifications),
        exportsData: createCountSummary(exportsData),
        schedules: createCountSummary(schedules),
        auditLogs: createCountSummary(auditLogs),
      },
      exportReadiness: {
        bcttReadyTopics: analysis.topicExportReadiness
          .filter((item) => item.type === 'BCTT' && item.bcttReady)
          .map((item) => item.topicId),
        kltnReadyTopics: analysis.topicExportReadiness
          .filter((item) => item.type === 'KLTN' && item.kltnReady)
          .map((item) => item.topicId),
        topics: analysis.topicExportReadiness,
      },
      impactIssues: analysis.issues,
      tables: {
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
      },
    };

    const outDir = join(process.cwd(), '.tmp');
    await fs.mkdir(outDir, { recursive: true });
    const outPath = join(outDir, 'sheet-preview.json');
    await fs.writeFile(outPath, JSON.stringify(output, null, 2), 'utf-8');

    logger.log(`Sheet preview exported: ${outPath}`);
    logger.log(
      `Counts => users=${users.length}, topics=${topics.length}, submissions=${submissions.length}, scores=${scores.length}, exports=${exportsData.length}`,
    );
    logger.log(`Impact issues found: ${analysis.issues.length}`);
  } finally {
    await app.close();
  }
}

void bootstrap();
