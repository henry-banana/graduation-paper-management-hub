import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TopicsService } from './topics.service';
import { AuthUser } from '../../common/types';

describe('TopicsService', () => {
  let service: TopicsService;

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

  const tbmUser: AuthUser = {
    userId: 'USR003',
    email: 'tbm@hcmute.edu.vn',
    role: 'TBM',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TopicsService],
    }).compile();

    service = module.get<TopicsService>(TopicsService);
  });

  describe('findAll', () => {
    it('should return all topics for TBM', async () => {
      const result = await service.findAll({}, tbmUser);

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should filter topics by type', async () => {
      const result = await service.findAll({ type: 'BCTT' }, tbmUser);

      expect(result.data.every((t) => t.type === 'BCTT')).toBe(true);
    });

    it('should filter topics by state', async () => {
      const result = await service.findAll({ state: 'PENDING_GV' }, tbmUser);

      expect(result.data.every((t) => t.state === 'PENDING_GV')).toBe(true);
    });

    it('should only return student own topics when role is STUDENT', async () => {
      const result = await service.findAll({}, studentUser);

      expect(result.data.every((t) => t.studentUserId === studentUser.userId)).toBe(true);
    });
  });

  describe('findById', () => {
    it('should return topic by ID', async () => {
      const result = await service.findById('tp_001');

      expect(result).toBeDefined();
      expect(result?.title).toBe('Xây dựng hệ thống quản lý thực tập');
    });

    it('should return null for non-existent ID', async () => {
      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should throw ForbiddenException if non-student creates topic', async () => {
      await expect(
        service.create(
          {
            type: 'BCTT',
            title: 'Test topic',
            domain: 'Test',
            periodId: 'prd_123',
            supervisorUserId: 'USR002',
          },
          lecturerUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException for duplicate active topic', async () => {
      await expect(
        service.create(
          {
            type: 'BCTT',
            title: 'Another BCTT',
            domain: 'Test',
            periodId: 'prd_2026_hk1_bctt',
            supervisorUserId: 'USR002',
          },
          studentUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when period does not exist', async () => {
      const newStudent: AuthUser = {
        userId: 'USR_PERIOD_MISSING',
        email: 'new@hcmute.edu.vn',
        role: 'STUDENT',
      };

      await expect(
        service.create(
          {
            type: 'BCTT',
            title: 'BCTT Topic',
            domain: 'Test',
            periodId: 'prd_not_found',
            supervisorUserId: 'USR002',
          },
          newStudent,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when period type mismatches topic type', async () => {
      const newStudent: AuthUser = {
        userId: 'USR_PERIOD_MISMATCH',
        email: 'new@hcmute.edu.vn',
        role: 'STUDENT',
      };

      await expect(
        service.create(
          {
            type: 'KLTN',
            title: 'KLTN Topic',
            domain: 'Test',
            periodId: 'prd_2026_hk1_bctt',
            supervisorUserId: 'USR002',
          },
          newStudent,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when registration period is not open', async () => {
      const newStudent: AuthUser = {
        userId: 'USR_PERIOD_CLOSED',
        email: 'new@hcmute.edu.vn',
        role: 'STUDENT',
      };

      await expect(
        service.create(
          {
            type: 'BCTT',
            title: 'BCTT Topic',
            domain: 'Test',
            periodId: 'prd_2026_hk2_bctt',
            supervisorUserId: 'USR002',
          },
          newStudent,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for KLTN without completed BCTT', async () => {
      const newStudent: AuthUser = {
        userId: 'USR_NEW',
        email: 'new@hcmute.edu.vn',
        role: 'STUDENT',
      };

      await expect(
        service.create(
          {
            type: 'KLTN',
            title: 'KLTN Topic',
            domain: 'Test',
            periodId: 'prd_2026_hk1_kltn',
            supervisorUserId: 'USR002',
          },
          newStudent,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should enforce single active workflow across topic types', async () => {
      await expect(
        service.create(
          {
            type: 'KLTN',
            title: 'KLTN while BCTT active',
            domain: 'Test',
            periodId: 'prd_2026_hk1_kltn',
            supervisorUserId: 'USR002',
          },
          studentUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when KLTN score eligibility is not met', async () => {
      const lowEligibilityStudent: AuthUser = {
        userId: 'USR004',
        email: 'low-eligibility@hcmute.edu.vn',
        role: 'STUDENT',
      };

      const topics = (service as any).mockTopics as Array<{
        id: string;
        studentUserId: string;
        type: string;
        state: string;
      }>;
      const activeTopic = topics.find(
        (topic) =>
          topic.studentUserId === lowEligibilityStudent.userId &&
          topic.state !== 'COMPLETED' &&
          topic.state !== 'CANCELLED',
      );
      if (activeTopic) {
        activeTopic.state = 'COMPLETED';
      }

      topics.push({
        id: 'tp_low_eligibility_bctt',
        studentUserId: lowEligibilityStudent.userId,
        type: 'BCTT',
        state: 'COMPLETED',
      } as any);

      await expect(
        service.create(
          {
            type: 'KLTN',
            title: 'KLTN Topic',
            domain: 'Test',
            periodId: 'prd_2026_hk1_kltn',
            supervisorUserId: 'USR002',
          },
          lowEligibilityStudent,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(
        service.update('nonexistent', { title: 'New title' }, tbmUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when editing non-editable state', async () => {
      // tp_001 is IN_PROGRESS which is not editable
      await expect(
        service.update('tp_001', { title: 'New title' }, tbmUser),
      ).rejects.toThrow(ConflictException);
    });

    it('should update topic in PENDING_GV state', async () => {
      const result = await service.update(
        'tp_002',
        { title: 'Updated title' },
        tbmUser,
      );

      expect(result.updated).toBe(true);
    });

    it('should throw ForbiddenException when student edits other topic', async () => {
      const otherStudent: AuthUser = {
        userId: 'USR_OTHER',
        email: 'other@hcmute.edu.vn',
        role: 'STUDENT',
      };

      await expect(
        service.update('tp_002', { title: 'New title' }, otherStudent),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('approve', () => {
    it('should approve topic in PENDING_GV state', async () => {
      const result = await service.approve('tp_002', undefined, lecturerUser);

      expect(result.state).toBe('CONFIRMED');
    });

    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(
        service.approve('nonexistent', undefined, lecturerUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if non-supervisor approves', async () => {
      const otherLecturer: AuthUser = {
        userId: 'USR_OTHER',
        email: 'other@hcmute.edu.vn',
        role: 'LECTURER',
      };

      // First reset the topic state
      const topic = await service.findById('tp_002');
      if (topic) {
        (topic as any).state = 'PENDING_GV';
      }

      await expect(
        service.approve('tp_002', undefined, otherLecturer),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('reject', () => {
    it('should reject topic in PENDING_GV state', async () => {
      // Reset state for test
      const topic = await service.findById('tp_002');
      if (topic) {
        (topic as any).state = 'PENDING_GV';
      }

      const result = await service.reject(
        'tp_002',
        'Scope too broad',
        lecturerUser,
      );

      expect(result.state).toBe('CANCELLED');
    });

    it('should throw ConflictException when rejecting non-PENDING_GV topic', async () => {
      await expect(
        service.reject('tp_001', 'Reason', lecturerUser),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('setDeadline', () => {
    it('should set deadline for topic in allowed state', async () => {
      const result = await service.setDeadline(
        'tp_001',
        {
          submitStartAt: '2026-06-01T00:00:00Z',
          submitEndAt: '2026-06-30T23:59:59Z',
        },
        lecturerUser,
      );

      expect(result.deadlineUpdated).toBe(true);
    });

    it('should throw BadRequestException for invalid date range', async () => {
      await expect(
        service.setDeadline(
          'tp_001',
          {
            submitStartAt: '2026-06-30T00:00:00Z',
            submitEndAt: '2026-06-01T00:00:00Z',
          },
          lecturerUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when non-supervisor sets deadline', async () => {
      await expect(
        service.setDeadline(
          'tp_001',
          {
            submitStartAt: '2026-06-01T00:00:00Z',
            submitEndAt: '2026-06-30T23:59:59Z',
          },
          studentUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException when reopening before current deadline ends', async () => {
      const topic = await service.findById('tp_001');
      if (topic) {
        topic.submitEndAt = '2099-01-01T00:00:00Z';
      }

      await expect(
        service.setDeadline(
          'tp_001',
          {
            submitStartAt: '2099-01-02T00:00:00Z',
            submitEndAt: '2099-01-20T23:59:59Z',
            action: 'REOPEN',
          },
          lecturerUser,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('transition', () => {
    it('should transition topic state', async () => {
      const result = await service.transition(
        'tp_001',
        'MOVE_TO_GRADING',
        lecturerUser,
      );

      expect(result.fromState).toBe('IN_PROGRESS');
      expect(result.toState).toBe('GRADING');
    });

    it('should throw ConflictException for invalid transition', async () => {
      await expect(
        service.transition('tp_001', 'APPROVE', lecturerUser),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(
        service.transition('nonexistent', 'APPROVE', lecturerUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('mapToDto', () => {
    it('should map TopicRecord to TopicResponseDto correctly', () => {
      const topic = {
        id: 'tp_test',
        type: 'BCTT' as const,
        title: 'Test Topic',
        domain: 'Test Domain',
        companyName: 'Test Co',
        state: 'DRAFT' as const,
        studentUserId: 'USR001',
        supervisorUserId: 'USR002',
        periodId: 'prd_123',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const dto = service.mapToDto(topic);

      expect(dto.id).toBe(topic.id);
      expect(dto.type).toBe(topic.type);
      expect(dto.title).toBe(topic.title);
      expect(dto.domain).toBe(topic.domain);
      expect(dto.state).toBe(topic.state);
    });
  });
});
