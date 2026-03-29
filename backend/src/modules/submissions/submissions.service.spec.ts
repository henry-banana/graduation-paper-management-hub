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

describe('SubmissionsService', () => {
  let service: SubmissionsService;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubmissionsService, SubmissionFileValidatorService],
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
  });

  describe('create', () => {
    it('should create REPORT submission successfully for topic owner student', async () => {
      const result = await service.create(
        'tp_001',
        'REPORT',
        studentUser,
        buildPdfFile(),
      );
      expect(result.id).toBeDefined();
      expect(result.version).toBeGreaterThan(0);
      expect(result.driveFileId).toBeDefined();
    });

    it('should auto-increment version for same fileType', async () => {
      const first = await service.create(
        'tp_001',
        'REPORT',
        studentUser,
        buildPdfFile({ originalFileName: 'report_v3.pdf' }),
      );
      const second = await service.create(
        'tp_001',
        'REPORT',
        studentUser,
        buildPdfFile({ originalFileName: 'report_v4.pdf' }),
      );
      expect(second.version).toBe(first.version + 1);
    });

    it('should create TURNITIN submission by supervisor lecturer for KLTN topic', async () => {
      const result = await service.create(
        'tp_001',
        'TURNITIN',
        lecturerUser,
        buildPdfFile({ originalFileName: 'turnitin.pdf' }),
      );

      expect(result.id).toBeDefined();
      expect(result.version).toBe(1);
    });

    it('should throw ForbiddenException when lecturer uploads REPORT', async () => {
      await expect(
        service.create('tp_001', 'REPORT', lecturerUser, buildPdfFile()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when student uploads TURNITIN', async () => {
      await expect(
        service.create('tp_001', 'TURNITIN', studentUser, buildPdfFile()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(
        service.create('nonexistent', 'REPORT', studentUser, buildPdfFile()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for REPORT upload in invalid state', async () => {
      await expect(
        service.create('tp_002', 'REPORT', student3, buildPdfFile()),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when REPORT upload window is closed', async () => {
      await expect(
        service.create('tp_003', 'REPORT', student3, buildPdfFile()),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when TURNITIN is uploaded for non-KLTN topic', async () => {
      await expect(
        service.create('tp_002', 'TURNITIN', lecturerUser, buildPdfFile()),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw PayloadTooLargeException for file too large', async () => {
      await expect(
        service.create('tp_001', 'REPORT', studentUser, {
          fileSize: 100 * 1024 * 1024, // 100MB
          mimeType: 'application/pdf',
          originalFileName: 'too_large.pdf',
        }),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('should throw BadRequestException for non-PDF file', async () => {
      await expect(
        service.create('tp_001', 'REPORT', studentUser, {
          mimeType: 'application/msword',
          fileSize: 1024,
          originalFileName: 'wrong_type.doc',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when file is missing', async () => {
      await expect(
        service.create('tp_001', 'REPORT', studentUser, undefined),
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
      expect(result?.version).toBe(2); // v2 is latest
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
        version: 1,
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
      expect(dto.driveFileId).toBe('drv_test');
    });
  });
});
