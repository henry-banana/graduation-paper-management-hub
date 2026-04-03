import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService, SubmissionRecord } from './submissions.service';
import { AuthUser } from '../../common/types';

describe('SubmissionsController', () => {
  let controller: SubmissionsController;
  let submissionsService: jest.Mocked<SubmissionsService>;

  const mockSubmission: SubmissionRecord = {
    id: 'sub_001',
    topicId: 'tp_001',
    uploaderUserId: 'USR001',
    fileType: 'REPORT',
    versionNumber: 1,
    versionLabel: 'V1',
    status: 'DRAFT',
    isLocked: false,
    canReplace: true,
    driveFileId: 'drv_abc123',
    driveLink: 'https://drive.google.com/file/d/drv_abc123',
    uploadedAt: '2026-05-10T10:00:00Z',
    originalFileName: 'report_v1.pdf',
    fileSize: 1024000,
  };

  const studentUser: AuthUser = {
    userId: 'USR001',
    email: 'student@hcmute.edu.vn',
    role: 'STUDENT',
  };

  const tbmUser: AuthUser = {
    userId: 'USR_TBM',
    email: 'tbm@hcmute.edu.vn',
    role: 'TBM',
  };

  const mockPdfFile = {
    fieldname: 'file',
    originalname: 'report.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 102400,
    buffer: Buffer.from('mock-pdf-content'),
  };

  beforeEach(async () => {
    const mockSubmissionsService = {
      findByTopicId: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      getDownloadUrl: jest.fn(),
      getLatestByFileType: jest.fn(),
      mapToDto: jest.fn((record: SubmissionRecord) => ({
        id: record.id,
        topicId: record.topicId,
        uploaderUserId: record.uploaderUserId,
        fileType: record.fileType,
        version: record.versionNumber,
        versionLabel: record.versionLabel,
        status: record.status,
        isLocked: record.isLocked,
        canReplace: record.canReplace,
        driveFileId: record.driveFileId,
        driveLink: record.driveLink,
        uploadedAt: record.uploadedAt,
        originalFileName: record.originalFileName,
        fileSize: record.fileSize,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubmissionsController],
      providers: [
        { provide: SubmissionsService, useValue: mockSubmissionsService },
      ],
    }).compile();

    controller = module.get<SubmissionsController>(SubmissionsController);
    submissionsService = module.get(SubmissionsService);
  });

  describe('getSubmissions', () => {
    it('should return submissions for a topic', async () => {
      submissionsService.findByTopicId.mockResolvedValue([
        submissionsService.mapToDto(mockSubmission),
      ]);

      const result = await controller.getSubmissions('tp_001', studentUser);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].fileType).toBe('REPORT');
      expect(result.meta.requestId).toBeDefined();
    });
  });

  describe('getSubmission', () => {
    it('should return submission by ID', async () => {
      submissionsService.findById.mockResolvedValue(mockSubmission);

      const result = await controller.getSubmission('sub_001', tbmUser);

      expect(result.data.id).toBe('sub_001');
      expect(result.meta.requestId).toBeDefined();
    });

    it('should throw NotFoundException when submission not found', async () => {
      submissionsService.findById.mockResolvedValue(null);

      await expect(
        controller.getSubmission('nonexistent', tbmUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('uploadSubmission', () => {
    it('should upload submission successfully', async () => {
      submissionsService.create.mockResolvedValue({
        id: 'sub_new',
        version: 3,
        versionLabel: 'V3',
        driveFileId: 'drv_new',
        canReplace: true,
      });

      const result = await controller.uploadSubmission(
        'tp_001',
        { fileType: 'REPORT' },
        mockPdfFile,
        studentUser,
      );

      expect(result.data.id).toBe('sub_new');
      expect(result.data.version).toBe(3);
      expect(result.data.versionLabel).toBe('V3');
      expect(result.meta.requestId).toBeDefined();
    });

    it('should throw BadRequestException when file is missing', async () => {
      await expect(
        controller.uploadSubmission(
          'tp_001',
          { fileType: 'REPORT' },
          undefined,
          studentUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDownloadUrl', () => {
    it('should return download URL', async () => {
      submissionsService.getDownloadUrl.mockResolvedValue({
        downloadUrl: 'https://drive.google.com/uc?id=drv_123',
        expiresAt: '2026-05-15T15:30:00Z',
      });

      const result = await controller.getDownloadUrl('sub_001', studentUser);

      expect(result.data.downloadUrl).toContain('drive.google.com');
      expect(result.data.expiresAt).toBeDefined();
      expect(result.meta.requestId).toBeDefined();
    });
  });

  describe('getLatestSubmission', () => {
    it('should return latest submission', async () => {
      submissionsService.getLatestByFileType.mockResolvedValue(mockSubmission);

      const result = await controller.getLatestSubmission(
        'tp_001',
        'REPORT',
        studentUser,
      );

      expect(result.data.id).toBe('sub_001');
      expect(result.meta.requestId).toBeDefined();
    });

    it('should throw NotFoundException when no submission found', async () => {
      submissionsService.getLatestByFileType.mockResolvedValue(null);

      await expect(
        controller.getLatestSubmission('tp_001', 'TURNITIN', studentUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid file type', async () => {
      await expect(
        controller.getLatestSubmission(
          'tp_001',
          'INVALID' as any,
          studentUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
