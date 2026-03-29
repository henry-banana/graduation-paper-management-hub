import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { AuthUser } from '../../common/types';

describe('AssignmentsService', () => {
  let service: AssignmentsService;

  const tbmUser: AuthUser = {
    userId: 'USR_TBM',
    email: 'tbm@hcmute.edu.vn',
    role: 'TBM',
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
    const module: TestingModule = await Test.createTestingModule({
      providers: [AssignmentsService],
    }).compile();

    service = module.get<AssignmentsService>(AssignmentsService);
  });

  describe('findByTopicId', () => {
    it('should return assignments for TBM', async () => {
      const result = await service.findByTopicId('tp_001', tbmUser);
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should return assignments for student who owns the topic', async () => {
      const result = await service.findByTopicId('tp_001', studentUser);
      expect(result).toBeInstanceOf(Array);
    });

    it('should throw ForbiddenException for student viewing other topic', async () => {
      const otherStudent: AuthUser = {
        userId: 'USR_OTHER',
        email: 'other@hcmute.edu.vn',
        role: 'STUDENT',
      };
      await expect(
        service.findByTopicId('tp_001', otherStudent),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(service.findByTopicId('nonexistent', tbmUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assignGvpb', () => {
    it('should assign GVPB successfully for TBM', async () => {
      const result = await service.assignGvpb(
        'tp_001',
        { userId: 'USR_GVPB_1' },
        tbmUser,
      );
      expect(result.assignmentId).toBeDefined();
      expect(result.topicRole).toBe('GVPB');
    });

    it('should throw ForbiddenException for non-TBM', async () => {
      await expect(
        service.assignGvpb('tp_001', { userId: 'USR_GVPB_1' }, lecturerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(
        service.assignGvpb('nonexistent', { userId: 'USR_GVPB_1' }, tbmUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for BCTT topic', async () => {
      await expect(
        service.assignGvpb('tp_002', { userId: 'USR_GVPB_1' }, tbmUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if GVHD is assigned as GVPB', async () => {
      await expect(
        service.assignGvpb('tp_001', { userId: 'USR002' }, tbmUser),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if GVPB already exists', async () => {
      // Assign first GVPB
      await service.assignGvpb('tp_001', { userId: 'USR_GVPB_1' }, tbmUser);

      // Try to assign second GVPB
      await expect(
        service.assignGvpb('tp_001', { userId: 'USR_CT_1' }, tbmUser),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when lecturer quota is full', async () => {
      await expect(
        service.assignGvpb('tp_001', { userId: 'USR_QUOTA_FULL' }, tbmUser),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('assignCouncil', () => {
    it('should throw ForbiddenException for non-TBM', async () => {
      await expect(
        service.assignCouncil(
          'tp_001',
          {
            chairUserId: 'USR_CT_1',
            secretaryUserId: 'USR_TK_1',
            memberUserIds: ['USR_TV_1', 'USR_TV_2', 'USR_TV_3'],
          },
          lecturerUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent topic', async () => {
      await expect(
        service.assignCouncil(
          'nonexistent',
          {
            chairUserId: 'USR_CT_1',
            secretaryUserId: 'USR_TK_1',
            memberUserIds: ['USR_TV_1', 'USR_TV_2', 'USR_TV_3'],
          },
          tbmUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for BCTT topic', async () => {
      await expect(
        service.assignCouncil(
          'tp_002',
          {
            chairUserId: 'USR_CT_1',
            secretaryUserId: 'USR_TK_1',
            memberUserIds: ['USR_TV_1', 'USR_TV_2', 'USR_TV_3'],
          },
          tbmUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException for duplicate members', async () => {
      const topic = (service as any).mockTopics.find((t: any) => t.id === 'tp_001');
      topic.state = 'DEFENSE';

      await expect(
        service.assignCouncil(
          'tp_001',
          {
            chairUserId: 'USR_CT_1',
            secretaryUserId: 'USR_CT_1', // Duplicate
            memberUserIds: ['USR_TV_1', 'USR_TV_2', 'USR_TV_3'],
          },
          tbmUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if GVHD is in council', async () => {
      const topic = (service as any).mockTopics.find((t: any) => t.id === 'tp_001');
      topic.state = 'DEFENSE';

      await expect(
        service.assignCouncil(
          'tp_001',
          {
            chairUserId: 'USR002', // GVHD of tp_001
            secretaryUserId: 'USR_TK_1',
            memberUserIds: ['USR_TV_1', 'USR_TV_2', 'USR_TV_3'],
          },
          tbmUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if GVPB is in council', async () => {
      const topic = (service as any).mockTopics.find((t: any) => t.id === 'tp_001');
      topic.state = 'DEFENSE';

      await service.assignGvpb('tp_001', { userId: 'USR_GVPB_1' }, tbmUser);

      await expect(
        service.assignCouncil(
          'tp_001',
          {
            chairUserId: 'USR_GVPB_1',
            secretaryUserId: 'USR_TK_1',
            memberUserIds: ['USR_TV_1', 'USR_TV_2', 'USR_TV_3'],
          },
          tbmUser,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('replaceAssignment', () => {
    it('should throw ForbiddenException for non-TBM', async () => {
      await expect(
        service.replaceAssignment(
          'as_001',
          { newUserId: 'USR_NEW_1', reason: 'Test' },
          lecturerUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent assignment', async () => {
      await expect(
        service.replaceAssignment(
          'nonexistent',
          { newUserId: 'USR_NEW_1', reason: 'Test' },
          tbmUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when replacing with same user', async () => {
      await expect(
        service.replaceAssignment(
          'as_001',
          { newUserId: 'USR002', reason: 'Test' }, // USR002 is current assignee
          tbmUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when new user already has active role on topic', async () => {
      await service.assignGvpb('tp_001', { userId: 'USR_GVPB_1' }, tbmUser);

      await expect(
        service.replaceAssignment(
          'as_001',
          { newUserId: 'USR_GVPB_1', reason: 'Test' },
          tbmUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when replacing with quota-full lecturer', async () => {
      const created = await service.assignGvpb(
        'tp_001',
        { userId: 'USR_GVPB_1' },
        tbmUser,
      );

      await expect(
        service.replaceAssignment(
          created.assignmentId,
          { newUserId: 'USR_QUOTA_FULL', reason: 'Test' },
          tbmUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should successfully replace assignment', async () => {
      const result = await service.replaceAssignment(
        'as_001',
        { newUserId: 'USR_NEW_1', reason: 'Supervisor unavailable' },
        tbmUser,
      );
      expect(result.replaced).toBe(true);

      const quotas = (service as any).mockLecturerQuotas as Array<{
        userId: string;
        usedQuota: number;
      }>;
      const oldQuota = quotas.find((q) => q.userId === 'USR002');
      const newQuota = quotas.find((q) => q.userId === 'USR_NEW_1');

      expect(oldQuota?.usedQuota).toBe(0);
      expect(newQuota?.usedQuota).toBe(1);
    });
  });

  describe('hasRoleOnTopic', () => {
    it('should return true if user has role on topic', async () => {
      const result = await service.hasRoleOnTopic('tp_001', 'USR002', ['GVHD']);
      expect(result).toBe(true);
    });

    it('should return false if user does not have role on topic', async () => {
      const result = await service.hasRoleOnTopic('tp_001', 'USR003', ['GVHD']);
      expect(result).toBe(false);
    });
  });

  describe('getUserRoleOnTopic', () => {
    it('should return role if user has assignment', async () => {
      const result = await service.getUserRoleOnTopic('tp_001', 'USR002');
      expect(result).toBe('GVHD');
    });

    it('should return null if user has no assignment', async () => {
      const result = await service.getUserRoleOnTopic('tp_001', 'USR999');
      expect(result).toBeNull();
    });
  });

  describe('mapToDto', () => {
    it('should map AssignmentRecord to AssignmentResponseDto', () => {
      const record = {
        id: 'as_test',
        topicId: 'tp_test',
        userId: 'usr_test',
        topicRole: 'GVHD' as const,
        status: 'ACTIVE' as const,
        assignedAt: '2026-01-01T00:00:00Z',
      };

      const dto = service.mapToDto(record);

      expect(dto.id).toBe('as_test');
      expect(dto.topicId).toBe('tp_test');
      expect(dto.userId).toBe('usr_test');
      expect(dto.topicRole).toBe('GVHD');
      expect(dto.status).toBe('ACTIVE');
    });
  });
});
