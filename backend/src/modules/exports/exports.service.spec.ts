import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ExportsService, ExportRecord } from './exports.service';
import { AuthUser } from '../../common/types';
import type { TopicRecord } from '../topics/topics.service';
import type { ScoreRecord } from '../scores/scores.service';
import type { UserRecord } from '../users/users.service';
import type { PeriodRecord } from '../periods/periods.service';
import type {
  DocxPdfUploadResult,
  UploadResult,
} from '../../infrastructure/google-drive/google-drive.client';
import type { GeneratedDocument } from './rubric-generator/rubric-generator.service';

describe('ExportsService', () => {
  let service: ExportsService;

  const exportFilesRepository = {
    create: jest.fn<(record: ExportRecord) => Promise<ExportRecord>>(),
    findById: jest.fn<(id: string) => Promise<ExportRecord | null>>(),
    findAll: jest.fn<() => Promise<ExportRecord[]>>(),
  };

  const topicsRepository = {
    findById: jest.fn<(id: string) => Promise<TopicRecord | null>>(),
  };

  const scoresRepository = {
    findById: jest.fn<(id: string) => Promise<ScoreRecord | null>>(),
  };

  const usersRepository = {
    findById: jest.fn<(id: string) => Promise<UserRecord | null>>(),
  };

  const periodsRepository = {
    findById: jest.fn<(id: string) => Promise<PeriodRecord | null>>(),
  };

  const googleDriveClient = {
    isReady: jest.fn<() => boolean>(),
    uploadDocxAndExportPdf: jest.fn<
      (
        fileName: string,
        content: Buffer,
        folderId?: string,
      ) => Promise<DocxPdfUploadResult>
    >(),
    uploadFile: jest.fn<
      (
        fileName: string,
        mimeType: string,
        content: Buffer,
        folderId?: string,
      ) => Promise<UploadResult>
    >(),
  };

  const rubricGeneratorService = {
    generateBctt: jest.fn<(...args: unknown[]) => Promise<GeneratedDocument>>(),
    generateKltnGvhd: jest.fn<
      (...args: unknown[]) => Promise<GeneratedDocument>
    >(),
    generateKltnGvpb: jest.fn<
      (...args: unknown[]) => Promise<GeneratedDocument>
    >(),
    generateKltnCouncil: jest.fn<
      (...args: unknown[]) => Promise<GeneratedDocument>
    >(),
  };

  const lecturerUser: AuthUser = {
    userId: 'USR002',
    email: 'gvhd1@hcmute.edu.vn',
    role: 'LECTURER',
  };

  const tbmUser: AuthUser = {
    userId: 'USR003',
    email: 'tbm@hcmute.edu.vn',
    role: 'TBM',
  };

  const bcttTopic: TopicRecord = {
    id: 'tp_bctt',
    type: 'BCTT',
    title: 'BCTT Topic',
    domain: 'Software Engineering',
    companyName: 'UTE LAB',
    state: 'IN_PROGRESS',
    studentUserId: 'USR001',
    supervisorUserId: 'USR002',
    periodId: 'prd_bctt',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const kltnTopic: TopicRecord = {
    id: 'tp_kltn',
    type: 'KLTN',
    title: 'KLTN Topic',
    domain: 'Artificial Intelligence',
    companyName: 'UTE LAB',
    state: 'DEFENSE',
    studentUserId: 'USR001',
    supervisorUserId: 'USR002',
    periodId: 'prd_kltn',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const submittedGvhdScore: ScoreRecord = {
    id: 'sc_001',
    topicId: 'tp_bctt',
    scorerUserId: 'USR002',
    scorerRole: 'GVHD',
    status: 'SUBMITTED',
    totalScore: 8,
    rubricData: [{ criterion: 'Nội dung', score: 4, max: 5 }],
    submittedAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  };

  const users: Record<string, UserRecord> = {
    USR001: {
      id: 'USR001',
      email: 'student1@hcmute.edu.vn',
      name: 'Student One',
      role: 'STUDENT',
      studentId: '20110001',
      department: 'CNTT',
    },
    USR002: {
      id: 'USR002',
      email: 'gvhd1@hcmute.edu.vn',
      name: 'Lecturer One',
      role: 'LECTURER',
      lecturerId: 'GV001',
      department: 'CNTT',
    },
    USR006: {
      id: 'USR006',
      email: 'gvpb@hcmute.edu.vn',
      name: 'Reviewer One',
      role: 'LECTURER',
      lecturerId: 'GV003',
      department: 'CNTT',
    },
  };

  const periods: Record<string, PeriodRecord> = {
    prd_bctt: {
      id: 'prd_bctt',
      code: 'HK1-2026-BCTT',
      type: 'BCTT',
      openDate: '2026-01-01',
      closeDate: '2026-12-31',
      status: 'OPEN',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    prd_kltn: {
      id: 'prd_kltn',
      code: 'HK1-2026-KLTN',
      type: 'KLTN',
      openDate: '2026-01-01',
      closeDate: '2026-12-31',
      status: 'OPEN',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new ExportsService(
      exportFilesRepository as never,
      topicsRepository as never,
      scoresRepository as never,
      usersRepository as never,
      periodsRepository as never,
      googleDriveClient as never,
      rubricGeneratorService as never,
    );

    exportFilesRepository.create.mockImplementation(
      async (record: ExportRecord) => record,
    );
    exportFilesRepository.findAll.mockResolvedValue([]);
    exportFilesRepository.findById.mockResolvedValue(null);

    topicsRepository.findById.mockImplementation(async (topicId: string) => {
      if (topicId === 'tp_bctt') {
        return bcttTopic;
      }
      if (topicId === 'tp_kltn') {
        return kltnTopic;
      }
      return null;
    });

    usersRepository.findById.mockImplementation(
      async (userId: string) => users[userId] ?? null,
    );
    periodsRepository.findById.mockImplementation(
      async (periodId: string) => periods[periodId] ?? null,
    );

    googleDriveClient.isReady.mockReturnValue(true);

    rubricGeneratorService.generateBctt.mockResolvedValue({
      buffer: Buffer.from('docx-content'),
      filename: 'rubric_bctt_001.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    rubricGeneratorService.generateKltnGvhd.mockResolvedValue({
      buffer: Buffer.from('docx-content'),
      filename: 'rubric_kltn_gvhd_001.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    rubricGeneratorService.generateKltnGvpb.mockResolvedValue({
      buffer: Buffer.from('docx-content'),
      filename: 'rubric_kltn_gvpb_001.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    rubricGeneratorService.generateKltnCouncil.mockResolvedValue({
      buffer: Buffer.from('docx-content'),
      filename: 'rubric_kltn_hd_001.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    googleDriveClient.uploadDocxAndExportPdf.mockResolvedValue({
      editableDocFileId: 'gdoc_001',
      editableDocLink: 'https://drive.google.com/file/d/gdoc_001/view',
      pdfFileId: 'pdf_001',
      pdfLink: 'https://drive.google.com/file/d/pdf_001/view',
    });

    googleDriveClient.uploadFile.mockResolvedValue({
      fileId: 'drv_001',
      webViewLink: 'https://drive.google.com/file/d/drv_001/view',
      webContentLink: 'https://drive.google.com/uc?id=drv_001',
    });
  });

  it('exports BCTT rubric with DOCX->PDF conversion when Drive is ready', async () => {
    scoresRepository.findById.mockResolvedValue(submittedGvhdScore);

    const result = await service.exportRubricBctt('tp_bctt', 'sc_001', lecturerUser);

    expect(result.exportType).toBe('RUBRIC_BCTT');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.driveFileId).toBe('pdf_001');
    expect(result.fileName).toBe('rubric_bctt_001.pdf');
    expect(rubricGeneratorService.generateBctt).toHaveBeenCalledTimes(1);
    expect(googleDriveClient.uploadDocxAndExportPdf).toHaveBeenCalledTimes(1);
  });

  it('falls back to DOCX upload when PDF conversion fails', async () => {
    scoresRepository.findById.mockResolvedValue(submittedGvhdScore);
    googleDriveClient.uploadDocxAndExportPdf.mockRejectedValueOnce(
      new Error('Drive export failed'),
    );

    const result = await service.exportRubricBctt('tp_bctt', 'sc_001', lecturerUser);

    expect(result.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(result.driveFileId).toBe('drv_001');
    expect(result.errorMessage).toContain('DOCX->PDF conversion failed');
    expect(googleDriveClient.uploadFile).toHaveBeenCalledTimes(1);
  });

  it('rejects KLTN rubric export when topic type is not KLTN', async () => {
    scoresRepository.findById.mockResolvedValue({
      ...submittedGvhdScore,
      topicId: 'tp_bctt',
      scorerRole: 'GVHD',
    });

    await expect(
      service.exportRubricKltn('tp_bctt', 'GVHD', 'sc_001', lecturerUser),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects topic list export for non-TBM users', async () => {
    await expect(service.exportTopicList(undefined, lecturerUser)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns drive link for a completed export', async () => {
    exportFilesRepository.findById.mockResolvedValue({
      id: 'exp_001',
      topicId: 'tp_bctt',
      exportType: 'RUBRIC_BCTT',
      status: 'COMPLETED',
      driveFileId: 'pdf_001',
      driveLink: 'https://drive.google.com/file/d/pdf_001/view',
      downloadUrl: 'https://drive.google.com/file/d/pdf_001/view',
      fileName: 'rubric_bctt_001.pdf',
      mimeType: 'application/pdf',
      requestedBy: lecturerUser.userId,
      createdAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T00:00:10Z',
      expiresAt: '2099-01-01T00:00:00Z',
    });

    const result = await service.getDownloadUrl('exp_001', lecturerUser);

    expect(result.driveLink).toBe('https://drive.google.com/file/d/pdf_001/view');
  });

  it('allows TBM to export topic list', async () => {
    const result = await service.exportTopicList('prd_kltn', tbmUser);

    expect(result.exportType).toBe('TOPIC_LIST');
    expect(result.requestedBy).toBe(tbmUser.userId);
    expect(result.mimeType).toBe('application/json');
  });
});
