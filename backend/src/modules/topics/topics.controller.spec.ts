import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TopicsController } from './topics.controller';
import { TopicsService, TopicRecord } from './topics.service';
import { AuthUser } from '../../common/types';

describe('TopicsController', () => {
  let controller: TopicsController;
  let topicsService: jest.Mocked<TopicsService>;

  const mockTopic: TopicRecord = {
    id: 'tp_001',
    type: 'BCTT',
    title: 'Test Topic',
    domain: 'Software Engineering',
    state: 'PENDING_GV',
    studentUserId: 'USR001',
    supervisorUserId: 'USR002',
    periodId: 'prd_123',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const studentUser: AuthUser = {
    userId: 'USR001',
    email: 'student@hcmute.edu.vn',
    role: 'STUDENT',
  };

  const lecturerUser: AuthUser = {
    userId: 'USR002',
    email: 'lecturer@hcmute.edu.vn',
    role: 'LECTURER',
  };

  beforeEach(async () => {
    const mockTopicsService = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
      setDeadline: jest.fn(),
      transition: jest.fn(),
      mapToDto: jest.fn((topic: TopicRecord) => ({
        id: topic.id,
        type: topic.type,
        title: topic.title,
        domain: topic.domain,
        companyName: topic.companyName,
        state: topic.state,
        studentUserId: topic.studentUserId,
        supervisorUserId: topic.supervisorUserId,
        periodId: topic.periodId,
        createdAt: topic.createdAt,
        updatedAt: topic.updatedAt,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TopicsController],
      providers: [{ provide: TopicsService, useValue: mockTopicsService }],
    }).compile();

    controller = module.get<TopicsController>(TopicsController);
    topicsService = module.get(TopicsService);
  });

  describe('findAll', () => {
    it('should return list of topics with pagination', async () => {
      topicsService.findAll.mockResolvedValue({
        data: [topicsService.mapToDto(mockTopic)],
        pagination: { page: 1, size: 20, total: 1 },
      });

      const result = await controller.findAll({ page: 1, size: 20 }, studentUser);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.meta.requestId).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('should return topic by ID', async () => {
      topicsService.findById.mockResolvedValue(mockTopic);

      const result = await controller.findOne('tp_001', studentUser);

      expect(result.data.id).toBe('tp_001');
      expect(result.meta.requestId).toBeDefined();
    });

    it('should throw NotFoundException when topic not found', async () => {
      topicsService.findById.mockResolvedValue(null);

      await expect(
        controller.findOne('nonexistent', studentUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when student views other topic', async () => {
      const otherTopic = { ...mockTopic, studentUserId: 'USR_OTHER' };
      topicsService.findById.mockResolvedValue(otherTopic);

      await expect(
        controller.findOne('tp_001', studentUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new topic', async () => {
      topicsService.create.mockResolvedValue({
        id: 'tp_new',
        state: 'PENDING_GV',
      });

      const result = await controller.create(
        {
          type: 'BCTT',
          title: 'New Topic',
          domain: 'Test',
          periodId: 'prd_123',
          supervisorUserId: 'USR002',
        },
        studentUser,
      );

      expect(result.data.id).toBe('tp_new');
      expect(result.data.state).toBe('PENDING_GV');
    });
  });

  describe('update', () => {
    it('should update topic', async () => {
      topicsService.update.mockResolvedValue({ updated: true });

      const result = await controller.update(
        'tp_001',
        { title: 'Updated Title' },
        studentUser,
      );

      expect(result.data.updated).toBe(true);
    });
  });

  describe('approve', () => {
    it('should approve topic', async () => {
      topicsService.approve.mockResolvedValue({ state: 'CONFIRMED' });

      const result = await controller.approve(
        'tp_001',
        { note: 'Approved' },
        lecturerUser,
      );

      expect(result.data.state).toBe('CONFIRMED');
    });
  });

  describe('reject', () => {
    it('should reject topic', async () => {
      topicsService.reject.mockResolvedValue({ state: 'CANCELLED' });

      const result = await controller.reject(
        'tp_001',
        { reason: 'Scope too broad' },
        lecturerUser,
      );

      expect(result.data.state).toBe('CANCELLED');
    });
  });

  describe('setDeadline', () => {
    it('should set deadline', async () => {
      topicsService.setDeadline.mockResolvedValue({ deadlineUpdated: true });

      const result = await controller.setDeadline(
        'tp_001',
        {
          submitStartAt: '2026-06-01T00:00:00Z',
          submitEndAt: '2026-06-30T23:59:59Z',
        },
        lecturerUser,
      );

      expect(result.data.deadlineUpdated).toBe(true);
    });
  });

  describe('transition', () => {
    it('should transition topic state', async () => {
      topicsService.transition.mockResolvedValue({
        fromState: 'IN_PROGRESS',
        toState: 'GRADING',
      });

      const result = await controller.transition(
        'tp_001',
        { action: 'MOVE_TO_GRADING' },
        lecturerUser,
      );

      expect(result.data.fromState).toBe('IN_PROGRESS');
      expect(result.data.toState).toBe('GRADING');
    });
  });
});
