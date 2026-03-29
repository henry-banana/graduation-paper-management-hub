import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ScoresService } from './scores.service';
import { AuthUser } from '../../common/types';

describe('ScoresService', () => {
  let service: ScoresService;

  const lecturerUser: AuthUser = {
    userId: 'USR002',
    email: 'lecturer@hcmute.edu.vn',
    role: 'LECTURER',
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

  const gvpbUser: AuthUser = {
    userId: 'USR_GVPB',
    email: 'gvpb@hcmute.edu.vn',
    role: 'LECTURER',
  };

  const tv1User: AuthUser = {
    userId: 'USR_TV1',
    email: 'tv1@hcmute.edu.vn',
    role: 'LECTURER',
  };

  const tv2User: AuthUser = {
    userId: 'USR_TV2',
    email: 'tv2@hcmute.edu.vn',
    role: 'LECTURER',
  };

  const tv3User: AuthUser = {
    userId: 'USR_TV3',
    email: 'tv3@hcmute.edu.vn',
    role: 'LECTURER',
  };

  const ctUser: AuthUser = {
    userId: 'USR_CT',
    email: 'ct@hcmute.edu.vn',
    role: 'LECTURER',
  };

  const tkUser: AuthUser = {
    userId: 'USR_TK',
    email: 'tk@hcmute.edu.vn',
    role: 'LECTURER',
  };

  const prepareSubmittedKltnScores = async () => {
    const gvhdDraft = await service.createOrUpdateDraft(
      'tp_001',
      {
        scorerRole: 'GVHD',
        rubricData: [{ criterion: 'quality', score: 6.0, max: 10 }],
      },
      lecturerUser,
    );
    await service.submit(gvhdDraft.scoreId, lecturerUser);

    const gvpbDraft = await service.createOrUpdateDraft(
      'tp_001',
      {
        scorerRole: 'GVPB',
        rubricData: [{ criterion: 'quality', score: 7.0, max: 10 }],
      },
      gvpbUser,
    );
    await service.submit(gvpbDraft.scoreId, gvpbUser);

    const tv1Draft = await service.createOrUpdateDraft(
      'tp_001',
      {
        scorerRole: 'TV_HD',
        rubricData: [{ criterion: 'quality', score: 8.0, max: 10 }],
      },
      tv1User,
    );
    await service.submit(tv1Draft.scoreId, tv1User);

    const tv2Draft = await service.createOrUpdateDraft(
      'tp_001',
      {
        scorerRole: 'TV_HD',
        rubricData: [{ criterion: 'quality', score: 7.0, max: 10 }],
      },
      tv2User,
    );
    await service.submit(tv2Draft.scoreId, tv2User);

    const tv3Draft = await service.createOrUpdateDraft(
      'tp_001',
      {
        scorerRole: 'TV_HD',
        rubricData: [{ criterion: 'quality', score: 9.0, max: 10 }],
      },
      tv3User,
    );
    await service.submit(tv3Draft.scoreId, tv3User);
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScoresService],
    }).compile();

    service = module.get<ScoresService>(ScoresService);
  });

  describe('findByTopicId', () => {
    it('should return scores for lecturer', async () => {
      const result = await service.findByTopicId('tp_001', lecturerUser);
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].rubricData).toBeDefined();
    });

    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(
        service.findByTopicId('nonexistent', lecturerUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for student on unpublished score', async () => {
      await expect(
        service.findByTopicId('tp_001', studentUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findById', () => {
    it('should return score by ID', async () => {
      const result = await service.findById('sc_001', lecturerUser);
      expect(result).not.toBeNull();
      expect(result?.id).toBe('sc_001');
    });

    it('should return null for non-existent score', async () => {
      const result = await service.findById('nonexistent', lecturerUser);
      expect(result).toBeNull();
    });

    it('should throw ForbiddenException for student', async () => {
      await expect(service.findById('sc_001', studentUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('createOrUpdateDraft', () => {
    it('should create draft score for valid lecturer', async () => {
      const result = await service.createOrUpdateDraft(
        'tp_001',
        {
          scorerRole: 'GVHD',
          rubricData: [
            { criterion: 'quality', score: 2.0, max: 2.5 },
            { criterion: 'implementation', score: 3.5, max: 4.0 },
          ],
        },
        lecturerUser,
      );
      expect(result.scoreId).toBeDefined();
      expect(result.status).toBe('DRAFT');
      expect(result.totalScore).toBe(5.5);
    });

    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(
        service.createOrUpdateDraft(
          'nonexistent',
          {
            scorerRole: 'GVHD',
            rubricData: [{ criterion: 'quality', score: 2.0, max: 2.5 }],
          },
          lecturerUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for user without role', async () => {
      const otherLecturer: AuthUser = {
        userId: 'USR_OTHER',
        email: 'other@hcmute.edu.vn',
        role: 'LECTURER',
      };
      await expect(
        service.createOrUpdateDraft(
          'tp_001',
          {
            scorerRole: 'GVHD',
            rubricData: [{ criterion: 'quality', score: 2.0, max: 2.5 }],
          },
          otherLecturer,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if score exceeds max', async () => {
      await expect(
        service.createOrUpdateDraft(
          'tp_001',
          {
            scorerRole: 'GVHD',
            rubricData: [{ criterion: 'quality', score: 3.0, max: 2.5 }],
          },
          lecturerUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for negative score', async () => {
      await expect(
        service.createOrUpdateDraft(
          'tp_001',
          {
            scorerRole: 'GVHD',
            rubricData: [{ criterion: 'quality', score: -1, max: 2.5 }],
          },
          lecturerUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update existing draft', async () => {
      // First create
      const first = await service.createOrUpdateDraft(
        'tp_001',
        {
          scorerRole: 'GVHD',
          rubricData: [{ criterion: 'quality', score: 2.0, max: 2.5 }],
        },
        lecturerUser,
      );

      // Then update
      const second = await service.createOrUpdateDraft(
        'tp_001',
        {
          scorerRole: 'GVHD',
          rubricData: [{ criterion: 'quality', score: 2.5, max: 2.5 }],
        },
        lecturerUser,
      );

      expect(second.scoreId).toBe(first.scoreId);
      expect(second.totalScore).toBe(2.5);
    });
  });

  describe('submit', () => {
    it('should submit score', async () => {
      // Create a draft first
      const draft = await service.createOrUpdateDraft(
        'tp_002',
        {
          scorerRole: 'GVHD',
          rubricData: [{ criterion: 'quality', score: 2.0, max: 2.5 }],
        },
        { userId: 'USR004', email: 'gvhd2@hcmute.edu.vn', role: 'LECTURER' },
      );

      const result = await service.submit(draft.scoreId, {
        userId: 'USR004',
        email: 'gvhd2@hcmute.edu.vn',
        role: 'LECTURER',
      });
      expect(result.status).toBe('SUBMITTED');
    });

    it('should throw NotFoundException for non-existent score', async () => {
      await expect(
        service.submit('nonexistent', lecturerUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if already submitted', async () => {
      // Submit first
      const draft = await service.createOrUpdateDraft(
        'tp_001',
        {
          scorerRole: 'GVPB',
          rubricData: [{ criterion: 'quality', score: 2.0, max: 2.5 }],
        },
        { userId: 'USR_GVPB', email: 'gvpb@hcmute.edu.vn', role: 'LECTURER' },
      );
      await service.submit(draft.scoreId, {
        userId: 'USR_GVPB',
        email: 'gvpb@hcmute.edu.vn',
        role: 'LECTURER',
      });

      // Try to submit again
      await expect(
        service.submit(draft.scoreId, {
          userId: 'USR_GVPB',
          email: 'gvpb@hcmute.edu.vn',
          role: 'LECTURER',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getSummary', () => {
    it('should throw ConflictException when required scores are missing', async () => {
      await expect(service.getSummary('tp_001', lecturerUser)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should return summary for KLTN when all required scores are submitted', async () => {
      await prepareSubmittedKltnScores();

      const result = await service.getSummary('tp_001', tkUser, 'TK_HD');

      expect(result).toBeDefined();
      expect(result.gvhdScore).toBe(6);
      expect(result.gvpbScore).toBe(7);
      expect(result.councilAvgScore).toBe(8);
      expect(result.finalScore).toBe(7);
      expect(result.result).toBe('PASS');
    });

    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(
        service.getSummary('nonexistent', lecturerUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for student on unpublished', async () => {
      await expect(
        service.getSummary('tp_001', studentUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('confirm', () => {
    it('should confirm score by GVHD', async () => {
      await prepareSubmittedKltnScores();
      const result = await service.confirm('tp_001', 'GVHD', lecturerUser);
      expect(result.confirmed).toBe(true);
      expect(result.published).toBe(false);
    });

    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(
        service.confirm('nonexistent', 'GVHD', lecturerUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for user without role', async () => {
      await prepareSubmittedKltnScores();
      const otherLecturer: AuthUser = {
        userId: 'USR_OTHER',
        email: 'other@hcmute.edu.vn',
        role: 'LECTURER',
      };
      await expect(
        service.confirm('tp_001', 'GVHD', otherLecturer),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should publish after both GVHD and CT_HD confirm', async () => {
      await prepareSubmittedKltnScores();
      await service.confirm('tp_001', 'GVHD', lecturerUser);
      const result = await service.confirm('tp_001', 'CT_HD', ctUser);
      expect(result.published).toBe(true);
    });
  });

  describe('mapToDto', () => {
    it('should map ScoreRecord to ScoreResponseDto', () => {
      const record = {
        id: 'sc_test',
        topicId: 'tp_test',
        scorerUserId: 'usr_test',
        scorerRole: 'GVHD' as const,
        status: 'DRAFT' as const,
        totalScore: 8.5,
        rubricData: [{ criterion: 'quality', score: 2.0, max: 2.5 }],
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const dto = service.mapToDto(record);

      expect(dto.id).toBe('sc_test');
      expect(dto.scorerRole).toBe('GVHD');
      expect(dto.totalScore).toBe(8.5);
      expect(dto.rubricData).toBeDefined();
    });

    it('should hide rubric when requested', () => {
      const record = {
        id: 'sc_test',
        topicId: 'tp_test',
        scorerUserId: 'usr_test',
        scorerRole: 'GVHD' as const,
        status: 'DRAFT' as const,
        totalScore: 8.5,
        rubricData: [{ criterion: 'quality', score: 2.0, max: 2.5 }],
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const dto = service.mapToDto(record, true);

      expect(dto.rubricData).toBeUndefined();
    });
  });
});
