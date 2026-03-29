import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import {
  AssignmentsRepository,
  AuditLogsRepository,
  ExportFilesRepository,
  GoogleSheetsClient,
  NotificationsRepository,
  PeriodsRepository,
  SchedulesRepository,
  ScoreSummariesRepository,
  ScoresRepository,
  SubmissionsRepository,
  TopicsRepository,
  UsersRepository,
} from '../infrastructure/google-sheets';
import { SHEET_NAMES } from '../infrastructure/google-sheets/sheets.constants';
import type { UserRecord } from '../modules/users/users.service';
import type { PeriodRecord } from '../modules/periods/periods.service';
import type { TopicRecord } from '../modules/topics/topics.service';
import type { AssignmentRecord } from '../modules/assignments/assignments.service';
import type { SubmissionRecord } from '../modules/submissions/submissions.service';
import type {
  ScoreRecord,
  ScoreSummaryRecord,
} from '../modules/scores/scores.service';
import type { NotificationRecord } from '../modules/notifications/notifications.service';
import type { ExportRecord } from '../modules/exports/exports.service';
import type { ScheduleRecord } from '../modules/schedules/schedules.service';
import type { AuditLogRecord } from '../modules/audit/audit.service';

type Repo<T extends { id: string }> = {
  findById(id: string): Promise<T | null>;
  create(entity: T): Promise<T>;
  update(id: string, entity: T): Promise<T>;
};

const logger = new Logger('SeedSheets');

function isoHoursFromNow(offset: number): string {
  return new Date(Date.now() + offset * 60 * 60 * 1000).toISOString();
}

async function upsertMany<T extends { id: string }>(
  repo: Repo<T>,
  items: T[],
): Promise<void> {
  for (const item of items) {
    const existing = await repo.findById(item.id);
    if (existing) {
      await repo.update(item.id, item);
    } else {
      await repo.create(item);
    }
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const usersRepository = app.get(UsersRepository);
    const sheetsClient = app.get(GoogleSheetsClient);
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

    const now = new Date().toISOString();

    await sheetsClient.ensureSheets([
      {
        sheetName: SHEET_NAMES.USERS,
        headers: [
          'id',
          'email',
          'name',
          'role',
          'studentId',
          'lecturerId',
          'department',
          'earnedCredits',
          'requiredCredits',
          'completedBcttScore',
          'totalQuota',
          'quotaUsed',
          'phone',
          'isActive',
          'createdAt',
        ],
      },
      {
        sheetName: SHEET_NAMES.PERIODS,
        headers: [
          'id',
          'code',
          'type',
          'openDate',
          'closeDate',
          'status',
          'createdAt',
          'updatedAt',
        ],
      },
      {
        sheetName: SHEET_NAMES.TOPICS,
        headers: [
          'id',
          'periodId',
          'type',
          'title',
          'domain',
          'companyName',
          'studentUserId',
          'supervisorUserId',
          'state',
          'approvalDeadlineAt',
          'submitStartAt',
          'submitEndAt',
          'reasonRejected',
          'revisionsAllowed',
          'createdAt',
          'updatedAt',
        ],
      },
      {
        sheetName: SHEET_NAMES.ASSIGNMENTS,
        headers: [
          'id',
          'topicId',
          'userId',
          'topicRole',
          'status',
          'assignedAt',
          'revokedAt',
        ],
      },
      {
        sheetName: SHEET_NAMES.SUBMISSIONS,
        headers: [
          'id',
          'topicId',
          'uploaderUserId',
          'fileType',
          'version',
          'driveFileId',
          'driveLink',
          'uploadedAt',
          'originalFileName',
          'fileSize',
        ],
      },
      {
        sheetName: SHEET_NAMES.SCORES,
        headers: [
          'id',
          'topicId',
          'scorerUserId',
          'scorerRole',
          'status',
          'totalScore',
          'rubricData',
          'allowDefense',
          'questions',
          'submittedAt',
          'updatedAt',
        ],
      },
      {
        sheetName: SHEET_NAMES.SCORE_SUMMARIES,
        headers: [
          'id',
          'topicId',
          'gvhdScore',
          'gvpbScore',
          'councilAvgScore',
          'finalScore',
          'result',
          'confirmedByGvhd',
          'confirmedByCtHd',
          'published',
          'updatedAt',
        ],
      },
      {
        sheetName: SHEET_NAMES.NOTIFICATIONS,
        headers: [
          'id',
          'receiverUserId',
          'topicId',
          'type',
          'title',
          'body',
          'deepLink',
          'isRead',
          'createdAt',
          'readAt',
        ],
      },
      {
        sheetName: SHEET_NAMES.EXPORT_FILES,
        headers: [
          'id',
          'topicId',
          'exportType',
          'status',
          'driveFileId',
          'driveLink',
          'downloadUrl',
          'fileName',
          'mimeType',
          'errorMessage',
          'requestedBy',
          'createdAt',
          'completedAt',
          'expiresAt',
        ],
      },
      {
        sheetName: SHEET_NAMES.SCHEDULES,
        headers: [
          'id',
          'topicId',
          'defenseAt',
          'locationType',
          'locationDetail',
          'notes',
          'createdBy',
          'createdAt',
          'updatedAt',
        ],
      },
      {
        sheetName: SHEET_NAMES.AUDIT_LOGS,
        headers: [
          'id',
          'action',
          'actorId',
          'actorRole',
          'topicId',
          'detail',
          'createdAt',
        ],
      },
    ]);

    const users: UserRecord[] = [
      {
        id: 'USR001',
        email: 'student1@hcmute.edu.vn',
        name: 'Nguyen Van A',
        role: 'STUDENT',
        studentId: '20110001',
        earnedCredits: 125,
        requiredCredits: 110,
        completedBcttScore: 7.8,
        phone: '0901000001',
        isActive: true,
        createdAt: now,
      },
      {
        id: 'USR004',
        email: 'student2@hcmute.edu.vn',
        name: 'Pham Thi D',
        role: 'STUDENT',
        studentId: '20110002',
        earnedCredits: 108,
        requiredCredits: 110,
        completedBcttScore: 0,
        phone: '0901000002',
        isActive: true,
        createdAt: now,
      },
      {
        id: 'USR002',
        email: 'gvhd1@hcmute.edu.vn',
        name: 'Tran Van B',
        role: 'LECTURER',
        lecturerId: 'GV001',
        department: 'CNTT',
        totalQuota: 10,
        quotaUsed: 2,
        phone: '0902000001',
        isActive: true,
        createdAt: now,
      },
      {
        id: 'USR005',
        email: 'gvhd2@hcmute.edu.vn',
        name: 'Hoang Van E',
        role: 'LECTURER',
        lecturerId: 'GV002',
        department: 'CNTT',
        totalQuota: 10,
        quotaUsed: 1,
        phone: '0902000002',
        isActive: true,
        createdAt: now,
      },
      {
        id: 'USR006',
        email: 'gvpb@hcmute.edu.vn',
        name: 'Le Thi GVPB',
        role: 'LECTURER',
        lecturerId: 'GV003',
        department: 'CNTT',
        totalQuota: 8,
        quotaUsed: 1,
        isActive: true,
        createdAt: now,
      },
      {
        id: 'USR007',
        email: 'cthd@hcmute.edu.vn',
        name: 'Chu tich Hoi dong',
        role: 'LECTURER',
        lecturerId: 'GV004',
        department: 'CNTT',
        totalQuota: 8,
        quotaUsed: 1,
        isActive: true,
        createdAt: now,
      },
      {
        id: 'USR008',
        email: 'tkhd@hcmute.edu.vn',
        name: 'Thu ky Hoi dong',
        role: 'LECTURER',
        lecturerId: 'GV005',
        department: 'CNTT',
        totalQuota: 8,
        quotaUsed: 1,
        isActive: true,
        createdAt: now,
      },
      {
        id: 'USR009',
        email: 'tvhd1@hcmute.edu.vn',
        name: 'Uy vien 1',
        role: 'LECTURER',
        lecturerId: 'GV006',
        department: 'CNTT',
        totalQuota: 8,
        quotaUsed: 1,
        isActive: true,
        createdAt: now,
      },
      {
        id: 'USR010',
        email: 'tvhd2@hcmute.edu.vn',
        name: 'Uy vien 2',
        role: 'LECTURER',
        lecturerId: 'GV007',
        department: 'CNTT',
        totalQuota: 8,
        quotaUsed: 1,
        isActive: true,
        createdAt: now,
      },
      {
        id: 'USR011',
        email: 'tvhd3@hcmute.edu.vn',
        name: 'Uy vien 3',
        role: 'LECTURER',
        lecturerId: 'GV008',
        department: 'CNTT',
        totalQuota: 8,
        quotaUsed: 1,
        isActive: true,
        createdAt: now,
      },
      {
        id: 'USR003',
        email: 'tbm@hcmute.edu.vn',
        name: 'Truong Bo Mon',
        role: 'TBM',
        lecturerId: 'GV009',
        department: 'CNTT',
        isActive: true,
        createdAt: now,
      },
    ];

    const periods: PeriodRecord[] = [
      {
        id: 'prd_2026_hk1_bctt',
        code: 'HK1-2026-BCTT',
        type: 'BCTT',
        openDate: '2026-02-01',
        closeDate: '2026-12-31',
        status: 'OPEN',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prd_2026_hk1_kltn',
        code: 'HK1-2026-KLTN',
        type: 'KLTN',
        openDate: '2026-02-01',
        closeDate: '2026-12-31',
        status: 'OPEN',
        createdAt: now,
        updatedAt: now,
      },
    ];

    const topics: TopicRecord[] = [
      {
        id: 'tp_001',
        periodId: 'prd_2026_hk1_kltn',
        type: 'KLTN',
        title: 'Ung dung AI trong quan ly hoc tap',
        domain: 'Artificial Intelligence',
        companyName: 'UTE LAB',
        studentUserId: 'USR001',
        supervisorUserId: 'USR002',
        state: 'DEFENSE',
        approvalDeadlineAt: isoHoursFromNow(24 * 3),
        submitStartAt: isoHoursFromNow(-72),
        submitEndAt: isoHoursFromNow(72),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'tp_002',
        periodId: 'prd_2026_hk1_bctt',
        type: 'BCTT',
        title: 'He thong quan ly thuc tap doanh nghiep',
        domain: 'Software Engineering',
        companyName: 'ABC Tech',
        studentUserId: 'USR004',
        supervisorUserId: 'USR005',
        state: 'IN_PROGRESS',
        approvalDeadlineAt: isoHoursFromNow(24 * 2),
        submitStartAt: isoHoursFromNow(-48),
        submitEndAt: isoHoursFromNow(96),
        createdAt: now,
        updatedAt: now,
      },
    ];

    const assignments: AssignmentRecord[] = [
      {
        id: 'as_001',
        topicId: 'tp_001',
        userId: 'USR002',
        topicRole: 'GVHD',
        status: 'ACTIVE',
        assignedAt: now,
      },
      {
        id: 'as_002',
        topicId: 'tp_001',
        userId: 'USR006',
        topicRole: 'GVPB',
        status: 'ACTIVE',
        assignedAt: now,
      },
      {
        id: 'as_003',
        topicId: 'tp_001',
        userId: 'USR007',
        topicRole: 'CT_HD',
        status: 'ACTIVE',
        assignedAt: now,
      },
      {
        id: 'as_004',
        topicId: 'tp_001',
        userId: 'USR008',
        topicRole: 'TK_HD',
        status: 'ACTIVE',
        assignedAt: now,
      },
      {
        id: 'as_005',
        topicId: 'tp_001',
        userId: 'USR009',
        topicRole: 'TV_HD',
        status: 'ACTIVE',
        assignedAt: now,
      },
      {
        id: 'as_006',
        topicId: 'tp_001',
        userId: 'USR010',
        topicRole: 'TV_HD',
        status: 'ACTIVE',
        assignedAt: now,
      },
      {
        id: 'as_007',
        topicId: 'tp_001',
        userId: 'USR011',
        topicRole: 'TV_HD',
        status: 'ACTIVE',
        assignedAt: now,
      },
      {
        id: 'as_008',
        topicId: 'tp_002',
        userId: 'USR005',
        topicRole: 'GVHD',
        status: 'ACTIVE',
        assignedAt: now,
      },
    ];

    const submissions: SubmissionRecord[] = [
      {
        id: 'sub_001',
        topicId: 'tp_002',
        uploaderUserId: 'USR004',
        fileType: 'REPORT',
        version: 1,
        driveFileId: 'drv_seed_sub_001',
        driveLink: 'https://drive.google.com/file/d/drv_seed_sub_001',
        uploadedAt: now,
        originalFileName: 'bctt-report-v1.pdf',
        fileSize: 1024000,
      },
    ];

    const scores: ScoreRecord[] = [
      {
        id: 'sc_001',
        topicId: 'tp_001',
        scorerUserId: 'USR002',
        scorerRole: 'GVHD',
        status: 'SUBMITTED',
        totalScore: 8.2,
        rubricData: [
          { criterion: 'quality', score: 2.1, max: 2.5 },
          { criterion: 'implementation', score: 3.2, max: 4.0 },
          { criterion: 'presentation', score: 2.9, max: 3.5 },
        ],
        submittedAt: now,
        updatedAt: now,
      },
      {
        id: 'sc_002',
        topicId: 'tp_001',
        scorerUserId: 'USR006',
        scorerRole: 'GVPB',
        status: 'SUBMITTED',
        totalScore: 8.0,
        rubricData: [
          { criterion: 'quality', score: 2.0, max: 2.5 },
          { criterion: 'implementation', score: 3.1, max: 4.0 },
          { criterion: 'presentation', score: 2.9, max: 3.5 },
        ],
        allowDefense: true,
        questions: [
          'Dong gop chinh cua de tai voi bai toan thuc te la gi?',
          'Neu mo rong he thong trong 6 thang toi thi uu tien hang muc nao?',
        ],
        submittedAt: now,
        updatedAt: now,
      },
      {
        id: 'sc_003',
        topicId: 'tp_001',
        scorerUserId: 'USR009',
        scorerRole: 'TV_HD',
        status: 'SUBMITTED',
        totalScore: 7.9,
        rubricData: [
          { criterion: 'quality', score: 2.0, max: 2.5 },
          { criterion: 'implementation', score: 3.0, max: 4.0 },
          { criterion: 'presentation', score: 2.9, max: 3.5 },
        ],
        submittedAt: now,
        updatedAt: now,
      },
      {
        id: 'sc_004',
        topicId: 'tp_001',
        scorerUserId: 'USR010',
        scorerRole: 'TV_HD',
        status: 'SUBMITTED',
        totalScore: 8.1,
        rubricData: [
          { criterion: 'quality', score: 2.1, max: 2.5 },
          { criterion: 'implementation', score: 3.1, max: 4.0 },
          { criterion: 'presentation', score: 2.9, max: 3.5 },
        ],
        submittedAt: now,
        updatedAt: now,
      },
      {
        id: 'sc_005',
        topicId: 'tp_001',
        scorerUserId: 'USR011',
        scorerRole: 'TV_HD',
        status: 'SUBMITTED',
        totalScore: 8.3,
        rubricData: [
          { criterion: 'quality', score: 2.2, max: 2.5 },
          { criterion: 'implementation', score: 3.2, max: 4.0 },
          { criterion: 'presentation', score: 2.9, max: 3.5 },
        ],
        submittedAt: now,
        updatedAt: now,
      },
      {
        id: 'sc_006',
        topicId: 'tp_002',
        scorerUserId: 'USR005',
        scorerRole: 'GVHD',
        status: 'SUBMITTED',
        totalScore: 7.6,
        rubricData: [
          { criterion: 'thai do', score: 1.5, max: 2 },
          { criterion: 'hinh thuc', score: 0.8, max: 1 },
          { criterion: 'mo dau', score: 0.7, max: 1 },
          { criterion: 'noi dung', score: 3.8, max: 5 },
          { criterion: 'ket luan', score: 0.8, max: 1 },
        ],
        submittedAt: now,
        updatedAt: now,
      },
    ];

    const scoreSummaries: ScoreSummaryRecord[] = [
      {
        id: 'sum_001',
        topicId: 'tp_001',
        gvhdScore: 8.2,
        gvpbScore: 8.0,
        councilAvgScore: 8.1,
        finalScore: 8.1,
        result: 'PASS',
        confirmedByGvhd: true,
        confirmedByCtHd: true,
        published: true,
      },
    ];

    const notifications: NotificationRecord[] = [
      {
        id: 'nt_001',
        receiverUserId: 'USR001',
        topicId: 'tp_001',
        type: 'SCORE_PUBLISHED',
        title: 'Diem da duoc cong bo',
        body: 'Diem tong ket de tai tp_001 da duoc cong bo.',
        deepLink: '/topics/tp_001/scores',
        isRead: false,
        createdAt: now,
      },
      {
        id: 'nt_002',
        receiverUserId: 'USR004',
        topicId: 'tp_002',
        type: 'DEADLINE_REMINDER',
        title: 'Nhac nho deadline',
        body: 'Con 3 ngay den han nop bao cao.',
        deepLink: '/topics/tp_002/submissions',
        isRead: false,
        createdAt: now,
      },
    ];

    const exportsData: ExportRecord[] = [
      {
        id: 'exp_001',
        topicId: 'tp_001',
        exportType: 'RUBRIC_KLTN',
        status: 'COMPLETED',
        driveFileId: 'drv_seed_exp_001',
        driveLink: 'https://drive.google.com/file/d/drv_seed_exp_001/view',
        downloadUrl: 'https://drive.google.com/file/d/drv_seed_exp_001/view',
        fileName: 'rubric_kltn_tp_001.pdf',
        mimeType: 'application/pdf',
        requestedBy: 'USR003',
        createdAt: now,
        completedAt: now,
        expiresAt: isoHoursFromNow(24),
      },
    ];

    const schedules: ScheduleRecord[] = [
      {
        id: 'sch_001',
        topicId: 'tp_001',
        defenseAt: isoHoursFromNow(48),
        locationType: 'OFFLINE',
        locationDetail: 'Phong A3-201',
        notes: 'Mang theo ban in khoa luan',
        createdBy: 'USR003',
        createdAt: now,
        updatedAt: now,
      },
    ];

    const auditLogs: AuditLogRecord[] = [
      {
        id: 'audit_001',
        action: 'SCHEDULE_CREATED',
        actorId: 'USR003',
        actorRole: 'TBM',
        topicId: 'tp_001',
        detail: {
          scheduleId: 'sch_001',
          defenseAt: isoHoursFromNow(48),
        },
        createdAt: now,
      },
    ];

    await upsertMany(usersRepository, users);
    await upsertMany(periodsRepository, periods);
    await upsertMany(topicsRepository, topics);
    await upsertMany(assignmentsRepository, assignments);
    await upsertMany(submissionsRepository, submissions);
    await upsertMany(scoresRepository, scores);
    await upsertMany(scoreSummariesRepository, scoreSummaries);
    await upsertMany(notificationsRepository, notifications);
    await upsertMany(exportFilesRepository, exportsData);
    await upsertMany(schedulesRepository, schedules);
    await upsertMany(auditLogsRepository, auditLogs);

    logger.log('Seed data upserted successfully to Google Sheets tabs.');
  } finally {
    await app.close();
  }
}

void bootstrap();
