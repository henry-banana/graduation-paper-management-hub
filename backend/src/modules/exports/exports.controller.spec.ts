import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { ExportsService, ExportRecord } from './exports.service';
import { AuthUser } from '../../common/types';

describe('ExportsController', () => {
  let controller: ExportsController;
  let exportsService: jest.Mocked<ExportsService>;

  const mockExport: ExportRecord = {
    id: 'exp_001',
    topicId: 'tp_001',
    exportType: 'RUBRIC_BCTT',
    status: 'COMPLETED',
    driveFileId: 'drv_001',
    driveLink: 'https://drive.google.com/file/d/drv_001/view',
    downloadUrl: 'https://storage.example.com/exports/rubric.xlsx',
    fileName: 'rubric_bctt_tp001.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    requestedBy: 'USR001',
    createdAt: '2026-06-15T10:00:00Z',
    completedAt: '2026-06-15T10:02:00Z',
  };

  const lecturerUser: AuthUser = {
    userId: 'USR001',
    email: 'lecturer@hcmute.edu.vn',
    role: 'LECTURER',
  };

  const tbmUser: AuthUser = {
    userId: 'TBM001',
    email: 'tbm@hcmute.edu.vn',
    role: 'TBM',
  };

  beforeEach(async () => {
    const mockExportsService = {
      exportRubricBctt: jest.fn(),
      exportRubricKltn: jest.fn(),
      exportScoreSheet: jest.fn(),
      exportTopicList: jest.fn(),
      getExportById: jest.fn(),
      getDownloadUrl: jest.fn(),
      findAll: jest.fn(),
      mapToDto: jest.fn((record: ExportRecord) => ({
        id: record.id,
        topicId: record.topicId,
        exportType: record.exportType,
        status: record.status,
        driveFileId: record.driveFileId,
        driveLink: record.driveLink,
        downloadUrl: record.downloadUrl,
        fileName: record.fileName,
        mimeType: record.mimeType,
        requestedBy: record.requestedBy,
        createdAt: record.createdAt,
        completedAt: record.completedAt,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExportsController],
      providers: [
        { provide: ExportsService, useValue: mockExportsService },
      ],
    }).compile();

    controller = module.get<ExportsController>(ExportsController);
    exportsService = module.get(ExportsService);
  });

  describe('exportRubricBctt', () => {
    it('should create BCTT rubric export', async () => {
      exportsService.exportRubricBctt.mockResolvedValue(
        exportsService.mapToDto(mockExport),
      );

      const result = await controller.exportRubricBctt(
        'tp_001',
        { scoreId: 'sc_001' },
        lecturerUser,
      );

      expect(result.data.exportId).toBe('exp_001');
      expect(result.data.driveFileId).toBe('drv_001');
      expect(result.meta.requestId).toBeDefined();
      expect(exportsService.exportRubricBctt).toHaveBeenCalledWith(
        'tp_001',
        'sc_001',
        lecturerUser,
      );
    });
  });

  describe('exportRubricKltn', () => {
    it('should create KLTN rubric export', async () => {
      const kltnExport = { ...mockExport, exportType: 'RUBRIC_KLTN' as const };
      exportsService.exportRubricKltn.mockResolvedValue(
        exportsService.mapToDto(kltnExport),
      );

      const result = await controller.exportRubricKltn(
        'tp_001',
        'GVHD',
        { scoreId: 'sc_002' },
        lecturerUser,
      );

      expect(result.data.exportId).toBe('exp_001');
      expect(result.data.driveFileId).toBe('drv_001');
      expect(result.meta.requestId).toBeDefined();
      expect(exportsService.exportRubricKltn).toHaveBeenCalledWith(
        'tp_001',
        'GVHD',
        'sc_002',
        lecturerUser,
      );
    });
  });

  describe('exportScoreSheet', () => {
    it('should create score sheet export', async () => {
      const scoreExport = { ...mockExport, exportType: 'SCORE_SHEET' as const };
      exportsService.exportScoreSheet.mockResolvedValue(
        exportsService.mapToDto(scoreExport),
      );

      const result = await controller.exportScoreSheet('tp_001', lecturerUser);

      expect(result.data.exportType).toBe('SCORE_SHEET');
      expect(result.meta.requestId).toBeDefined();
    });
  });

  describe('exportTopicList', () => {
    it('should create topic list export', async () => {
      const topicListExport = { ...mockExport, exportType: 'TOPIC_LIST' as const };
      exportsService.exportTopicList.mockResolvedValue(
        exportsService.mapToDto(topicListExport),
      );

      const result = await controller.exportTopicList({}, tbmUser);

      expect(result.data.exportType).toBe('TOPIC_LIST');
      expect(result.meta.requestId).toBeDefined();
    });
  });

  describe('listExports', () => {
    it('should return exports with pagination', async () => {
      exportsService.findAll.mockResolvedValue({
        data: [exportsService.mapToDto(mockExport)],
        pagination: { page: 1, size: 20, total: 1 },
      });

      const result = await controller.listExports('1', '20', lecturerUser);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.meta.requestId).toBeDefined();
    });
  });

  describe('getExport', () => {
    it('should return export by ID', async () => {
      exportsService.getExportById.mockResolvedValue(mockExport);

      const result = await controller.getExport('exp_001', lecturerUser);

      expect(result.data.id).toBe('exp_001');
      expect(result.meta.requestId).toBeDefined();
    });

    it('should throw NotFoundException when export not found', async () => {
      exportsService.getExportById.mockResolvedValue(null);

      await expect(
        controller.getExport('nonexistent', lecturerUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDownloadUrl', () => {
    it('should return drive link', async () => {
      exportsService.getDownloadUrl.mockResolvedValue({
        driveLink: 'https://drive.google.com/file/d/drv_001/view',
      });

      const result = await controller.getDownloadUrl('exp_001', lecturerUser);

      expect(result.data.driveLink).toBeDefined();
      expect(result.meta.requestId).toBeDefined();
    });
  });
});
