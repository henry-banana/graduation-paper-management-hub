import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ScoresController } from './scores.controller';
import { ScoresService, ScoreRecord } from './scores.service';
import { AuthUser } from '../../common/types';

describe('ScoresController', () => {
  let controller: ScoresController;
  let scoresService: jest.Mocked<ScoresService>;

  const mockScore: ScoreRecord = {
    id: 'sc_001',
    topicId: 'tp_001',
    scorerUserId: 'USR002',
    scorerRole: 'GVHD',
    status: 'DRAFT',
    totalScore: 8.5,
    rubricData: [{ criterion: 'quality', score: 2.0, max: 2.5, note: 'good' }],
    updatedAt: '2026-06-10T10:00:00Z',
  };

  const lecturerUser: AuthUser = {
    userId: 'USR002',
    email: 'lecturer@hcmute.edu.vn',
    role: 'LECTURER',
  };

  const tbmUser: AuthUser = {
    userId: 'USR_TBM',
    email: 'tbm@hcmute.edu.vn',
    role: 'TBM',
  };

  beforeEach(async () => {
    const mockScoresService = {
      findByTopicId: jest.fn(),
      findById: jest.fn(),
      createOrUpdateDraft: jest.fn(),
      submit: jest.fn(),
      getSummary: jest.fn(),
      confirm: jest.fn(),
      mapToDto: jest.fn((record: ScoreRecord) => ({
        id: record.id,
        topicId: record.topicId,
        scorerUserId: record.scorerUserId,
        scorerRole: record.scorerRole,
        status: record.status,
        totalScore: record.totalScore,
        rubricData: record.rubricData,
        updatedAt: record.updatedAt,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScoresController],
      providers: [{ provide: ScoresService, useValue: mockScoresService }],
    }).compile();

    controller = module.get<ScoresController>(ScoresController);
    scoresService = module.get(ScoresService);
  });

  describe('getScores', () => {
    it('should return scores for a topic', async () => {
      scoresService.findByTopicId.mockResolvedValue([
        scoresService.mapToDto(mockScore),
      ]);

      const result = await controller.getScores('tp_001', lecturerUser);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].scorerRole).toBe('GVHD');
      expect(result.meta.requestId).toBeDefined();
    });
  });

  describe('getScore', () => {
    it('should return score by ID', async () => {
      scoresService.findById.mockResolvedValue(mockScore);

      const result = await controller.getScore('sc_001', tbmUser);

      expect(result.data.id).toBe('sc_001');
      expect(result.meta.requestId).toBeDefined();
    });

    it('should throw NotFoundException when score not found', async () => {
      scoresService.findById.mockResolvedValue(null);

      await expect(
        controller.getScore('nonexistent', tbmUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createDraft', () => {
    it('should create draft score', async () => {
      scoresService.createOrUpdateDraft.mockResolvedValue({
        scoreId: 'sc_new',
        status: 'DRAFT',
        totalScore: 5.5,
      });

      const result = await controller.createDraft(
        'tp_001',
        {
          scorerRole: 'GVHD',
          rubricData: [{ criterion: 'quality', score: 2.0, max: 2.5 }],
        },
        lecturerUser,
      );

      expect(result.data.scoreId).toBe('sc_new');
      expect(result.data.status).toBe('DRAFT');
      expect(result.meta.requestId).toBeDefined();
    });
  });

  describe('submitScore', () => {
    it('should submit score', async () => {
      scoresService.submit.mockResolvedValue({
        scoreId: 'sc_001',
        status: 'SUBMITTED',
      });

      const result = await controller.submitScore(
        'sc_001',
        { confirm: true },
        lecturerUser,
      );

      expect(result.data.status).toBe('SUBMITTED');
      expect(result.meta.requestId).toBeDefined();
    });

    it('should throw BadRequestException if confirm is false', async () => {
      await expect(
        controller.submitScore('sc_001', { confirm: false }, lecturerUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSummary', () => {
    it('should return score summary', async () => {
      scoresService.getSummary.mockResolvedValue({
        gvhdScore: 8.2,
        gvpbScore: 8.4,
        councilAvgScore: 8.6,
        finalScore: 8.4,
        result: 'PASS',
        confirmedByGvhd: true,
        confirmedByCtHd: false,
        published: false,
      });

      const result = await controller.getSummary(
        'tp_001',
        { requestedByRole: 'TK_HD' },
        lecturerUser,
      );

      expect(scoresService.getSummary).toHaveBeenCalledWith(
        'tp_001',
        lecturerUser,
        'TK_HD',
      );
      expect(result.data.finalScore).toBe(8.4);
      expect(result.data.result).toBe('PASS');
      expect(result.meta.requestId).toBeDefined();
    });
  });

  describe('confirmScore', () => {
    it('should confirm score', async () => {
      scoresService.confirm.mockResolvedValue({
        confirmed: true,
        published: false,
      });

      const result = await controller.confirmScore(
        'tp_001',
        { role: 'GVHD' },
        lecturerUser,
      );

      expect(result.data.confirmed).toBe(true);
      expect(result.data.published).toBe(false);
      expect(result.meta.requestId).toBeDefined();
    });
  });

  describe('confirmPublish', () => {
    it('should delegate to CT_HD confirmation flow', async () => {
      scoresService.confirm.mockResolvedValue({
        confirmed: true,
        published: true,
      });

      const result = await controller.confirmPublish('tp_001', tbmUser);

      expect(scoresService.confirm).toHaveBeenCalledWith(
        'tp_001',
        'CT_HD',
        tbmUser,
      );
      expect(result.data.confirmed).toBe(true);
      expect(result.data.published).toBe(true);
      expect(result.meta.requestId).toBeDefined();
    });
  });
});
