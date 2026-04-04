import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SubmissionFileValidatorService } from './submission-file-validator.service';
import { AuthUser } from '../../common/types';
import {
  AssignmentsRepository,
  RevisionRoundsRepository,
  SubmissionsRepository,
  TopicsRepository,
} from '../../infrastructure/google-sheets';
import { GoogleDriveClient } from '../../infrastructure/google-drive';
import { TopicRecord } from '../topics/topics.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('SubmissionsService', () => {
  let service: SubmissionsService;
  let submissionsRepository: {
    findAll: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let revisionRoundsRepository: {
    findWhere: jest.Mock;
    findById: jest.Mock;
  };
  let assignmentsRepository: {
    findAll: jest.Mock;
  };
  let topicsRepository: {
    findById: jest.Mock;
  };
  let notificationsService: {
    create: jest.Mock;
  };
  let auditService: {
    log: jest.Mock;
  };
  let submissionsStore: any[];
  let assignmentsStore: any[];
  let topicsStore: TopicRecord[];

  const studentUser: AuthUser = {
    userId: 'USR001',
    email: 'student@hcmute.edu.vn',
    role: 'STUDENT',
  };

  const otherStudent: AuthUser = {
    userId: 'USR_OTHER',
    email: 'other@hcmute.edu.vn',
    role: 'STUDENT',
  };

  const lecturerUser: AuthUser = {
    userId: 'USR002',
    email: 'lecturer@hcmute.edu.vn',
    role: 'LECTURER',
  };

  const otherLecturer: AuthUser = {
    userId: 'USR_LECTURER_X',
    email: 'other.lecturer@hcmute.edu.vn',
    role: 'LECTURER',
  };

  const student3: AuthUser = {
    userId: 'USR003',
    email: 'student3@hcmute.edu.vn',
    role: 'STUDENT',
  };

  const tbmUser: AuthUser = {
    userId: 'USR_TBM',
    email: 'tbm@hcmute.edu.vn',
    role: 'TBM',
  };

  const buildPdfFile = (overrides?: Partial<{
    originalFileName: string;
    fileSize: number;
    mimeType: string;
  }>) => ({
    originalFileName: 'report.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
    ...overrides,
  });

  const buildPdfBuffer = (): Buffer =>
    Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n', 'utf-8');

  beforeEach(async () => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    topicsStore = [
      {
        id: 'tp_001',
        type: 'KLTN',
        title: 'KLTN Main Topic',
        domain: 'AI',
        state: 'IN_PROGRESS',
        studentUserId: studentUser.userId,
        supervisorUserId: lecturerUser.userId,
        periodId: 'period_1',
        submitStartAt: new Date(now - dayMs).toISOString(),
        submitEndAt: new Date(now + dayMs).toISOString(),
        createdAt: new Date(now - 10 * dayMs).toISOString(),
        updatedAt: new Date(now - 2 * dayMs).toISOString(),
      },
      {
        id: 'tp_002',
        type: 'BCTT',
        title: 'BCTT Invalid State Topic',
        domain: 'Web',
        state: 'PENDING_GV',
        studentUserId: student3.userId,
        supervisorUserId: lecturerUser.userId,
        periodId: 'period_2',
        submitStartAt: new Date(now - dayMs).toISOString(),
        submitEndAt: new Date(now + dayMs).toISOString(),
        createdAt: new Date(now - 8 * dayMs).toISOString(),
        updatedAt: new Date(now - 3 * dayMs).toISOString(),
      },
      {
        id: 'tp_003',
        type: 'KLTN',
        title: 'KLTN Closed Window Topic',
        domain: 'IoT',
        state: 'IN_PROGRESS',
        studentUserId: student3.userId,
        supervisorUserId: lecturerUser.userId,
        periodId: 'period_3',
        submitStartAt: new Date(now - 3 * dayMs).toISOString(),
        submitEndAt: new Date(now - 2 * dayMs).toISOString(),
        createdAt: new Date(now - 12 * dayMs).toISOString(),
        updatedAt: new Date(now - dayMs).toISOString(),
      },
    ];

    submissionsStore = [
      {
        id: 'sub_001',
        topicId: 'tp_001',
        uploaderUserId: studentUser.userId,
        fileType: 'REPORT',
        revisionRoundId: 'rr_001',
        revisionRoundNumber: 1,
        versionNumber: 1,
        versionLabel: 'V1',
        status: 'DRAFT',
        deadlineAt: new Date(now + dayMs).toISOString(),
        confirmedAt: '',
        isLocked: false,
        canReplace: true,
        driveFileId: 'drv_001',
        driveLink: 'https://drive.google.com/file/d/drv_001',
        uploadedAt: new Date(now - 4 * dayMs).toISOString(),
        originalFileName: 'report_v1.pdf',
        fileSize: 1024,
      },
      {
        id: 'sub_002',
        topicId: 'tp_001',
        uploaderUserId: studentUser.userId,
        fileType: 'REPORT',
        revisionRoundId: 'rr_002',
        revisionRoundNumber: 2,
        versionNumber: 2,
        versionLabel: 'V2',
        status: 'CONFIRMED',
        deadlineAt: new Date(now + 2 * dayMs).toISOString(),
        confirmedAt: new Date(now - dayMs).toISOString(),
        isLocked: false,
        canReplace: true,
        driveFileId: 'drv_002',
        driveLink: 'https://drive.google.com/file/d/drv_002',
        uploadedAt: new Date(now - 2 * dayMs).toISOString(),
        originalFileName: 'report_v2.pdf',
        fileSize: 2048,
      },
    ];

    assignmentsStore = [
      {
        id: 'asg_001',
        topicId: 'tp_001',
        userId: lecturerUser.userId,
        topicRole: 'GVHD',
        status: 'ACTIVE',
      },
      {
        id: 'asg_002',
        topicId: 'tp_001',
        userId: otherLecturer.userId,
        topicRole: 'GVHD',
        status: 'REVOKED',
      },
    ];

    submissionsRepository = {
      findAll: jest.fn(async () => submissionsStore),
      findById: jest.fn(async (id: string) => submissionsStore.find((s) => s.id === id) ?? null),
      create: jest.fn(async (submission: any) => {
        submissionsStore.push(submission);
      }),
      update: jest.fn(async (id: string, payload: any) => {
        const index = submissionsStore.findIndex((s) => s.id === id);
        if (index >= 0) {
          submissionsStore[index] = { ...submissionsStore[index], ...payload };
        }
      }),
    };

    revisionRoundsRepository = {
      findWhere: jest.fn(async () => []),
      findById: jest.fn(async () => null),
    };

    assignmentsRepository = {
      findAll: jest.fn(async () => assignmentsStore),
    };

    topicsRepository = {
      findById: jest.fn(async (id: string) => topicsStore.find((t) => t.id === id) ?? null),
    };

    const googleDriveClientMock: Partial<GoogleDriveClient> = {
      isReady: jest.fn(() => false),
      getOrCreateUserUploadFolderId: jest.fn(),
      uploadFile: jest.fn(),
    };

    notificationsService = {
      create: jest.fn(async () => undefined),
    };

    auditService = {
      log: jest.fn(async () => undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmissionsService,
        SubmissionFileValidatorService,
        {
          provide: SubmissionsRepository,
          useValue: submissionsRepository,
        },
        {
          provide: TopicsRepository,
          useValue: topicsRepository,
        },
        {
          provide: RevisionRoundsRepository,
          useValue: revisionRoundsRepository,
        },
        {
          provide: AssignmentsRepository,
          useValue: assignmentsRepository,
        },
        {
          provide: GoogleDriveClient,
          useValue: googleDriveClientMock,
        },
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
        {
          provide: AuditService,
          useValue: auditService,
        },
      ],
    }).compile();

    service = module.get<SubmissionsService>(SubmissionsService);
  });

  describe('findByTopicId', () => {
    it('should return submissions for TBM', async () => {
      const result = await service.findByTopicId('tp_001', tbmUser);
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should return submissions for student who owns the topic', async () => {
      const result = await service.findByTopicId('tp_001', studentUser);
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should return submissions for lecturer', async () => {
      const result = await service.findByTopicId('tp_001', lecturerUser);
      expect(result).toBeInstanceOf(Array);
    });

    it('should throw ForbiddenException for unassigned lecturer', async () => {
      await expect(
        service.findByTopicId('tp_001', otherLecturer),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for student viewing other topic', async () => {
      await expect(
        service.findByTopicId('tp_001', otherStudent),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(
        service.findByTopicId('nonexistent', tbmUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('should return submission by ID', async () => {
      const result = await service.findById('sub_001', studentUser);
      expect(result).not.toBeNull();
      expect(result?.id).toBe('sub_001');
    });

    it('should return null for non-existent submission', async () => {
      const result = await service.findById('nonexistent', tbmUser);
      expect(result).toBeNull();
    });

    it('should throw ForbiddenException for student viewing other topic submission', async () => {
      await expect(
        service.findById('sub_001', otherStudent),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for unassigned lecturer', async () => {
      await expect(
        service.findById('sub_001', otherLecturer),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should block supervisor read when assignment is REVOKED', async () => {
      const topic = topicsStore.find((record) => record.id === 'tp_001');
      if (!topic) {
        throw new Error('Expected topic tp_001 fixture to exist');
      }

      topic.supervisorUserId = otherLecturer.userId;

      await expect(service.findById('sub_001', otherLecturer)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('create', () => {
    it('should create REPORT submission successfully for topic owner student', async () => {
      const result = await service.create(
        'tp_001',
        'REPORT',
        studentUser,
        buildPdfFile(),
        buildPdfBuffer(),
      );
      expect(result.id).toBeDefined();
      expect(result.version).toBeGreaterThan(0);
      expect(result.versionLabel).toMatch(/^V\d+$/);
      expect(result.driveFileId).toBeDefined();
    });

    it('should keep same version when replacing in the same round', async () => {
      const first = await service.create(
        'tp_001',
        'REPORT',
        studentUser,
        buildPdfFile({ originalFileName: 'report_v3.pdf' }),
        buildPdfBuffer(),
      );
      const second = await service.create(
        'tp_001',
        'REPORT',
        studentUser,
        buildPdfFile({ originalFileName: 'report_v4.pdf' }),
        buildPdfBuffer(),
      );
      expect(second.version).toBe(first.version);
    });

    it('should create TURNITIN submission by supervisor lecturer for KLTN topic', async () => {
      const result = await service.create(
        'tp_001',
        'TURNITIN',
        lecturerUser,
        buildPdfFile({ originalFileName: 'turnitin.pdf' }),
        buildPdfBuffer(),
      );

      expect(result.id).toBeDefined();
      expect(result.version).toBe(1);
      expect(result.versionLabel).toBe('V1');
    });

    it('should block TURNITIN upload when supervisor assignment is REVOKED', async () => {
      const topic = topicsStore.find((record) => record.id === 'tp_001');
      if (!topic) {
        throw new Error('Expected topic tp_001 fixture to exist');
      }

      topic.supervisorUserId = otherLecturer.userId;

      await expect(
        service.create(
          'tp_001',
          'TURNITIN',
          otherLecturer,
          buildPdfFile({ originalFileName: 'turnitin_revoked.pdf' }),
          buildPdfBuffer(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when lecturer uploads REPORT', async () => {
      await expect(
        service.create(
          'tp_001',
          'REPORT',
          lecturerUser,
          buildPdfFile(),
          buildPdfBuffer(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when student uploads TURNITIN', async () => {
      await expect(
        service.create(
          'tp_001',
          'TURNITIN',
          studentUser,
          buildPdfFile(),
          buildPdfBuffer(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(
        service.create(
          'nonexistent',
          'REPORT',
          studentUser,
          buildPdfFile(),
          buildPdfBuffer(),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for REPORT upload in invalid state', async () => {
      await expect(
        service.create(
          'tp_002',
          'REPORT',
          student3,
          buildPdfFile(),
          buildPdfBuffer(),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when REPORT upload window is closed', async () => {
      await expect(
        service.create(
          'tp_003',
          'REPORT',
          student3,
          buildPdfFile(),
          buildPdfBuffer(),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when TURNITIN is uploaded for non-KLTN topic', async () => {
      await expect(
        service.create(
          'tp_002',
          'TURNITIN',
          lecturerUser,
          buildPdfFile(),
          buildPdfBuffer(),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw PayloadTooLargeException for file too large', async () => {
      await expect(
        service.create('tp_001', 'REPORT', studentUser, {
          fileSize: 100 * 1024 * 1024, // 100MB
          mimeType: 'application/pdf',
          originalFileName: 'too_large.pdf',
        }, buildPdfBuffer()),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('should throw BadRequestException for non-PDF file', async () => {
      await expect(
        service.create('tp_001', 'REPORT', studentUser, {
          mimeType: 'application/msword',
          fileSize: 1024,
          originalFileName: 'wrong_type.doc',
        }, buildPdfBuffer()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when file is missing', async () => {
      await expect(
        service.create(
          'tp_001',
          'REPORT',
          studentUser,
          undefined,
          buildPdfBuffer(),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDownloadUrl', () => {
    it('should return download URL', async () => {
      const result = await service.getDownloadUrl('sub_001', studentUser);
      expect(result.downloadUrl).toBeDefined();
      expect(result.downloadUrl).toContain('drive.google.com');
      expect(result.expiresAt).toBeDefined();
    });

    it('should throw NotFoundException for non-existent submission', async () => {
      await expect(
        service.getDownloadUrl('nonexistent', tbmUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for unassigned lecturer', async () => {
      await expect(
        service.getDownloadUrl('sub_001', otherLecturer),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getLatestByFileType', () => {
    it('should return latest submission for fileType', async () => {
      const result = await service.getLatestByFileType(
        'tp_001',
        'REPORT',
        studentUser,
      );
      expect(result).not.toBeNull();
      expect(result?.versionNumber).toBe(2); // v2 is latest
    });

    it('should return null if no submission exists', async () => {
      const result = await service.getLatestByFileType(
        'tp_001',
        'REVISION',
        studentUser,
      );
      expect(result).toBeNull();
    });

    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(
        service.getLatestByFileType('nonexistent', 'REPORT', tbmUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for unassigned lecturer', async () => {
      await expect(
        service.getLatestByFileType('tp_001', 'REPORT', otherLecturer),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('mapToDto', () => {
    it('should map SubmissionRecord to SubmissionResponseDto', () => {
      const record = {
        id: 'sub_test',
        topicId: 'tp_test',
        uploaderUserId: 'usr_test',
        fileType: 'REPORT' as const,
        versionNumber: 1,
        versionLabel: 'V1' as const,
        status: 'DRAFT' as const,
        isLocked: false,
        canReplace: true,
        driveFileId: 'drv_test',
        driveLink: 'https://drive.google.com/file/d/drv_test',
        uploadedAt: '2026-01-01T00:00:00Z',
        originalFileName: 'test.pdf',
        fileSize: 1024,
      };

      const dto = service.mapToDto(record);

      expect(dto.id).toBe('sub_test');
      expect(dto.topicId).toBe('tp_test');
      expect(dto.fileType).toBe('REPORT');
      expect(dto.version).toBe(1);
      expect(dto.versionLabel).toBe('V1');
      expect(dto.driveFileId).toBe('drv_test');
    });
  });
});
