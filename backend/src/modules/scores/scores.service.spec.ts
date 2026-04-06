import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ScoresService } from './scores.service';
import { AuthUser } from '../../common/types';
import {
  AssignmentsRepository,
  SystemConfigRepository,
  ScoreSummariesRepository,
  ScoresRepository,
  TopicsRepository,
  UsersRepository,
} from '../../infrastructure/google-sheets';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

describe('ScoresService', () => {
  let service: ScoresService;

  type MockTopic = {
    id: string;
    type: 'KLTN' | 'BCTT';
    title: string;
    domain: string;
    state: 'GRADING' | 'SCORING' | 'DEFENSE' | 'COMPLETED';
    studentUserId: string;
    supervisorUserId: string;
    periodId: string;
    submitEndAt?: string;
    createdAt: string;
    updatedAt: string;
  };

  type MockAssignment = {
    id: string;
    topicId: string;
    userId: string;
    topicRole: 'GVHD' | 'GVPB' | 'TV_HD' | 'TK_HD' | 'CT_HD';
    status: 'ACTIVE' | 'REVOKED';
    assignedAt: string;
    revokedAt?: string;
  };

  type MockScore = {
    id: string;
    topicId: string;
    scorerUserId: string;
    scorerRole: 'GVHD' | 'GVPB' | 'TV_HD';
    status: 'DRAFT' | 'SUBMITTED';
    totalScore: number;
    rubricData: Array<{ criterion: string; score: number; max: number; note?: string }>;
    submittedAt?: string;
    updatedAt: string;
  };

  type MockSummary = {
    id: string;
    topicId: string;
    gvhdScore?: number;
    gvpbScore?: number;
    councilAvgScore?: number;
    finalScore: number;
    result: 'PASS' | 'FAIL' | 'PENDING';
    confirmedByGvhd: boolean;
    confirmedByCtHd: boolean;
    published: boolean;
    aggregatedByTkHd?: boolean;
    aggregatedByTkHdAt?: string;
    aggregatedByTkHdUserId?: string;
  };

  let topics: MockTopic[];
  let assignments: MockAssignment[];
  let scores: MockScore[];
  let summaries: MockSummary[];
  let users: Array<{
    id: string;
    email: string;
    role: 'STUDENT' | 'LECTURER' | 'TBM';
    name: string;
    studentId?: string;
    lecturerId?: string;
  }>;

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

    const ctDraft = await service.createOrUpdateDraft(
      'tp_001',
      {
        scorerRole: 'TV_HD',
        rubricData: [{ criterion: 'quality', score: 8.0, max: 10 }],
      },
      ctUser,
    );
    await service.submit(ctDraft.scoreId, ctUser);

    const tkDraft = await service.createOrUpdateDraft(
      'tp_001',
      {
        scorerRole: 'TV_HD',
        rubricData: [{ criterion: 'quality', score: 8.0, max: 10 }],
      },
      tkUser,
    );
    await service.submit(tkDraft.scoreId, tkUser);
  };

  beforeEach(async () => {
    const now = new Date().toISOString();

    topics = [
      {
        id: 'tp_001',
        type: 'KLTN',
        title: 'AI-assisted grading optimization',
        domain: 'AI',
        state: 'GRADING',
        studentUserId: 'USR001',
        supervisorUserId: 'USR002',
        periodId: 'prd_001',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'tp_002',
        type: 'KLTN',
        title: 'Realtime classroom analytics',
        domain: 'IoT',
        state: 'GRADING',
        studentUserId: 'USR003',
        supervisorUserId: 'USR004',
        periodId: 'prd_001',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'tp_bctt',
        type: 'BCTT',
        title: 'BCTT - Practical report',
        domain: 'SE',
        state: 'GRADING',
        studentUserId: 'USR001',
        supervisorUserId: 'USR002',
        periodId: 'prd_001',
        createdAt: now,
        updatedAt: now,
      },
    ];

    assignments = [
      { id: 'as_001', topicId: 'tp_001', userId: 'USR002', topicRole: 'GVHD', status: 'ACTIVE', assignedAt: now },
      { id: 'as_002', topicId: 'tp_001', userId: 'USR_GVPB', topicRole: 'GVPB', status: 'ACTIVE', assignedAt: now },
      { id: 'as_003', topicId: 'tp_001', userId: 'USR_TV1', topicRole: 'TV_HD', status: 'ACTIVE', assignedAt: now },
      { id: 'as_004', topicId: 'tp_001', userId: 'USR_TV2', topicRole: 'TV_HD', status: 'ACTIVE', assignedAt: now },
      { id: 'as_005', topicId: 'tp_001', userId: 'USR_TV3', topicRole: 'TV_HD', status: 'ACTIVE', assignedAt: now },
      { id: 'as_006', topicId: 'tp_001', userId: 'USR_CT', topicRole: 'CT_HD', status: 'ACTIVE', assignedAt: now },
      { id: 'as_007', topicId: 'tp_001', userId: 'USR_TK', topicRole: 'TK_HD', status: 'ACTIVE', assignedAt: now },
      { id: 'as_008', topicId: 'tp_002', userId: 'USR004', topicRole: 'GVHD', status: 'ACTIVE', assignedAt: now },
      { id: 'as_009', topicId: 'tp_bctt', userId: 'USR002', topicRole: 'GVHD', status: 'ACTIVE', assignedAt: now },
    ];

    scores = [
      {
        id: 'sc_001',
        topicId: 'tp_001',
        scorerUserId: 'USR002',
        scorerRole: 'GVHD',
        status: 'DRAFT',
        totalScore: 1.5,
        rubricData: [{ criterion: 'quality', score: 1.5, max: 2.5 }],
        updatedAt: now,
      },
    ];

    summaries = [];

    users = [
      {
        id: 'USR001',
        email: 'student@hcmute.edu.vn',
        role: 'STUDENT',
        name: 'Student One',
        studentId: 'SE160001',
      },
      {
        id: 'USR002',
        email: 'lecturer@hcmute.edu.vn',
        role: 'LECTURER',
        name: 'Lecturer Main',
        lecturerId: 'GV002',
      },
      {
        id: 'USR004',
        email: 'gvhd2@hcmute.edu.vn',
        role: 'LECTURER',
        name: 'Lecturer Two',
        lecturerId: 'GV004',
      },
      {
        id: 'USR_GVPB',
        email: 'gvpb@hcmute.edu.vn',
        role: 'LECTURER',
        name: 'Reviewer One',
        lecturerId: 'GV005',
      },
      {
        id: 'USR_TV1',
        email: 'tv1@hcmute.edu.vn',
        role: 'LECTURER',
        name: 'Council Member 1',
        lecturerId: 'GV101',
      },
      {
        id: 'USR_TV2',
        email: 'tv2@hcmute.edu.vn',
        role: 'LECTURER',
        name: 'Council Member 2',
        lecturerId: 'GV102',
      },
      {
        id: 'USR_TV3',
        email: 'tv3@hcmute.edu.vn',
        role: 'LECTURER',
        name: 'Council Member 3',
        lecturerId: 'GV103',
      },
      {
        id: 'USR_CT',
        email: 'ct@hcmute.edu.vn',
        role: 'LECTURER',
        name: 'Council Chair',
        lecturerId: 'GV201',
      },
      {
        id: 'USR_TK',
        email: 'tk@hcmute.edu.vn',
        role: 'LECTURER',
        name: 'Council Secretary',
        lecturerId: 'GV202',
      },
      {
        id: 'USR_TBM',
        email: 'tbm@hcmute.edu.vn',
        role: 'TBM',
        name: 'Department Head',
        lecturerId: 'GV999',
      },
    ];

    const scoresRepositoryMock = {
      findAll: jest.fn(async () => scores),
      findById: jest.fn(async (id: string) => scores.find((score) => score.id === id) ?? null),
      create: jest.fn(async (entity: MockScore) => {
        scores.push(entity);
      }),
      update: jest.fn(async (id: string, entity: MockScore) => {
        const index = scores.findIndex((score) => score.id === id);
        if (index >= 0) {
          scores[index] = entity;
        }
      }),
    };

    const scoreSummariesRepositoryMock = {
      findFirst: jest.fn(async (predicate: (summary: MockSummary) => boolean) =>
        summaries.find((summary) => predicate(summary)) ?? null,
      ),
      findById: jest.fn(async (id: string) => summaries.find((summary) => summary.id === id) ?? null),
      create: jest.fn(async (entity: MockSummary) => {
        summaries.push(entity);
      }),
      update: jest.fn(async (id: string, entity: MockSummary) => {
        const index = summaries.findIndex((summary) => summary.id === id);
        if (index >= 0) {
          summaries[index] = entity;
        }
      }),
    };

    const topicsRepositoryMock = {
      findById: jest.fn(async (id: string) => topics.find((topic) => topic.id === id) ?? null),
      update: jest.fn(async (id: string, entity: MockTopic) => {
        const index = topics.findIndex((topic) => topic.id === id);
        if (index >= 0) {
          topics[index] = entity;
        }
      }),
    };

    const assignmentsRepositoryMock = {
      findAll: jest.fn(async () => assignments),
    };

    const usersRepositoryMock = {
      findById: jest.fn(async (id: string) => users.find((u) => u.id === id) ?? null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoresService,
        { provide: ScoresRepository, useValue: scoresRepositoryMock },
        { provide: ScoreSummariesRepository, useValue: scoreSummariesRepositoryMock },
        { provide: TopicsRepository, useValue: topicsRepositoryMock },
        { provide: AssignmentsRepository, useValue: assignmentsRepositoryMock },
        { provide: UsersRepository, useValue: usersRepositoryMock },
        {
          provide: SystemConfigRepository,
          useValue: {
            getNumber: jest.fn(async (_key: string, fallback: number) => fallback),
          },
        },
        { provide: NotificationsService, useValue: { create: jest.fn() } },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
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

    it('should auto transition KLTN topic from DEFENSE to SCORING on first submit', async () => {
      const now = new Date().toISOString();
      topics = topics.map((topic) =>
        topic.id === 'tp_001' ? { ...topic, state: 'DEFENSE', updatedAt: now } : topic,
      );

      scores.push({
        id: 'sc_defense_submit',
        topicId: 'tp_001',
        scorerUserId: 'USR_GVPB',
        scorerRole: 'GVPB',
        status: 'DRAFT',
        totalScore: 7.5,
        rubricData: [{ criterion: 'quality', score: 7.5, max: 10 }],
        updatedAt: now,
      });

      const result = await service.submit('sc_defense_submit', gvpbUser);
      expect(result.status).toBe('SUBMITTED');

      const topicAfterSubmit = topics.find((topic) => topic.id === 'tp_001');
      expect(topicAfterSubmit?.state).toBe('SCORING');
    });
  });

  describe('createAndSubmitDirect', () => {
    it('should auto transition KLTN topic from DEFENSE to SCORING on submit-direct', async () => {
      const now = new Date().toISOString();
      topics = topics.map((topic) =>
        topic.id === 'tp_001' ? { ...topic, state: 'DEFENSE', updatedAt: now } : topic,
      );

      const result = await service.createAndSubmitDirect(
        'tp_001',
        { content: 4.5, presentation: 1.5, defense: 2.0 },
        'GVPB',
        [
          { id: 'content', max: 5 },
          { id: 'presentation', max: 2 },
          { id: 'defense', max: 3 },
        ],
        gvpbUser,
        { isDraftOnly: false },
      );

      expect(result.status).toBe('SUBMITTED');
      const topicAfterSubmit = topics.find((topic) => topic.id === 'tp_001');
      expect(topicAfterSubmit?.state).toBe('SCORING');
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
      expect(result.finalScore).toBe(7.1);
      expect(result.result).toBe('PASS');
    });

    it('should ignore revoked TV_HD submission in council average', async () => {
      await prepareSubmittedKltnScores();

      assignments = assignments.map((assignment) =>
        assignment.id === 'as_005'
          ? {
              ...assignment,
              status: 'REVOKED',
              revokedAt: new Date().toISOString(),
            }
          : assignment,
      );

      const result = await service.getSummary('tp_001', tkUser, 'TK_HD');

      expect(result.councilAvgScore).toBe(7.5);
      expect(result.finalScore).toBe(6.9);
    });

    it('should block summary when active TV_HD is missing even if revoked TV_HD submitted', async () => {
      await prepareSubmittedKltnScores();

      assignments = assignments.map((assignment) =>
        assignment.id === 'as_004'
          ? {
              ...assignment,
              status: 'REVOKED',
              revokedAt: new Date().toISOString(),
            }
          : assignment,
      );

      scores = scores.filter(
        (score) =>
          !(score.topicId === 'tp_001' && score.scorerUserId === 'USR_TV3' && score.scorerRole === 'TV_HD'),
      );

      await expect(service.getSummary('tp_001', tkUser, 'TK_HD')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.getSummary('tp_001', tkUser, 'TK_HD')).rejects.toThrow(
        'Cannot summarize before all council member scores are submitted',
      );
    });

    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(
        service.getSummary('nonexistent', lecturerUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return pending summary for student on unpublished KLTN', async () => {
      const result = await service.getSummary('tp_001', studentUser);
      expect(result.published).toBe(false);
      expect(result.result).toBe('PENDING');
      expect(result.finalScore).toBe(0);
    });

    it('should return pending summary for lecturer on unpublished BCTT', async () => {
      const result = await service.getSummary('tp_bctt', lecturerUser);
      expect(result.published).toBe(false);
      expect(result.result).toBe('PENDING');
      expect(result.finalScore).toBe(0);
    });

    it('should return pending summary for TBM on unpublished BCTT', async () => {
      const result = await service.getSummary('tp_bctt', tbmUser);
      expect(result.published).toBe(false);
      expect(result.result).toBe('PENDING');
      expect(result.finalScore).toBe(0);
    });

    it('should auto-publish BCTT summary after GVHD submits', async () => {
      const draft = await service.createOrUpdateDraft(
        'tp_bctt',
        {
          scorerRole: 'GVHD',
          rubricData: [{ criterion: 'quality', score: 8.0, max: 10 }],
        },
        lecturerUser,
      );
      await service.submit(draft.scoreId, lecturerUser);

      const result = await service.getSummary('tp_bctt', studentUser);
      expect(result.published).toBe(true);
      expect(result.result).toBe('PASS');
      expect(result.finalScore).toBe(8);
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

    it('should throw ForbiddenException when TBM confirms without ACTIVE CT_HD assignment', async () => {
      await prepareSubmittedKltnScores();

      await expect(
        service.confirm('tp_001', 'CT_HD', tbmUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('submitted score immutability (KLTN GVHD)', () => {
    const gvhdRubric = [{ id: 'quality', max: 10 }];

    it('should block GVHD from updating submitted score immediately after submit', async () => {
      await service.createAndSubmitDirect(
        'tp_001',
        { quality: 6.0 },
        'GVHD',
        gvhdRubric,
        lecturerUser,
        { isDraftOnly: false },
      );

      await expect(
        service.createAndSubmitDirect(
          'tp_001',
          { quality: 8.0 },
          'GVHD',
          gvhdRubric,
          lecturerUser,
          { isDraftOnly: false },
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should block submitted update after final confirmation starts', async () => {
      await service.createAndSubmitDirect(
        'tp_001',
        { quality: 6.5 },
        'GVHD',
        gvhdRubric,
        lecturerUser,
        { isDraftOnly: false },
      );

      summaries.push({
        id: 'sum_lock_001',
        topicId: 'tp_001',
        gvhdScore: 6.5,
        gvpbScore: 7.0,
        councilAvgScore: 7.5,
        finalScore: 7.0,
        result: 'PASS',
        confirmedByGvhd: true,
        confirmedByCtHd: false,
        published: false,
      });

      await expect(
        service.createAndSubmitDirect(
          'tp_001',
          { quality: 9.0 },
          'GVHD',
          gvhdRubric,
          lecturerUser,
          { isDraftOnly: false },
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should report lock metadata in my-draft response when published', async () => {
      await service.createAndSubmitDirect(
        'tp_001',
        { quality: 7.0 },
        'GVHD',
        gvhdRubric,
        lecturerUser,
        { isDraftOnly: false },
      );

      summaries.push({
        id: 'sum_lock_002',
        topicId: 'tp_001',
        gvhdScore: 7.0,
        gvpbScore: 7.0,
        councilAvgScore: 7.0,
        finalScore: 7.0,
        result: 'PASS',
        confirmedByGvhd: true,
        confirmedByCtHd: true,
        published: true,
      });

      const myDraft = await service.findMyDraft('tp_001', lecturerUser);

      expect(myDraft).not.toBeNull();
      expect(myDraft?.isSubmitted).toBe(true);
      expect(myDraft?.isLocked).toBe(true);
      expect(myDraft?.lockReason).toContain('published');
    });

    it('should block score submission when TK_HD aggregation lock is active', async () => {
      await prepareSubmittedKltnScores();

      const staleDraftId = 'sc_stale_draft';
      scores.push({
        id: staleDraftId,
        topicId: 'tp_001',
        scorerUserId: tv2User.userId,
        scorerRole: 'TV_HD',
        status: 'DRAFT',
        totalScore: 6.5,
        rubricData: [{ criterion: 'quality', score: 6.5, max: 10 }],
        updatedAt: new Date().toISOString(),
      });

      await service.aggregateByTkHd('tp_001', tkUser);

      const summary = summaries.find((item) => item.topicId === 'tp_001');
      expect(summary?.aggregatedByTkHd).toBe(true);
      expect(summary?.aggregatedByTkHdAt).toBeDefined();
      expect(summary?.aggregatedByTkHdUserId).toBe(tkUser.userId);

      await expect(service.submit(staleDraftId, tv2User)).rejects.toThrow(
        ConflictException,
      );
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
