import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService, AssignmentRecord } from './assignments.service';
import { AuthUser } from '../../common/types';

describe('AssignmentsController', () => {
  let controller: AssignmentsController;
  let assignmentsService: jest.Mocked<AssignmentsService>;

  const mockAssignment: AssignmentRecord = {
    id: 'as_001',
    topicId: 'tp_001',
    userId: 'USR002',
    topicRole: 'GVHD',
    status: 'ACTIVE',
    assignedAt: '2026-01-15T10:00:00Z',
  };

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

  beforeEach(async () => {
    const mockAssignmentsService = {
      findByTopicId: jest.fn(),
      findById: jest.fn(),
      assignGvpb: jest.fn(),
      assignCouncil: jest.fn(),
      replaceAssignment: jest.fn(),
      mapToDto: jest.fn((record: AssignmentRecord) => ({
        id: record.id,
        topicId: record.topicId,
        userId: record.userId,
        topicRole: record.topicRole,
        status: record.status,
        assignedAt: record.assignedAt,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssignmentsController],
      providers: [
        { provide: AssignmentsService, useValue: mockAssignmentsService },
      ],
    }).compile();

    controller = module.get<AssignmentsController>(AssignmentsController);
    assignmentsService = module.get(AssignmentsService);
  });

  describe('getAssignments', () => {
    it('should return assignments for a topic', async () => {
      assignmentsService.findByTopicId.mockResolvedValue([
        assignmentsService.mapToDto(mockAssignment),
      ]);

      const result = await controller.getAssignments('tp_001', studentUser);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].topicRole).toBe('GVHD');
      expect(result.meta.requestId).toBeDefined();
    });
  });

  describe('getAssignment', () => {
    it('should return assignment by ID', async () => {
      assignmentsService.findById.mockResolvedValue(mockAssignment);

      const result = await controller.getAssignment('as_001', tbmUser);

      expect(result.data.id).toBe('as_001');
      expect(result.meta.requestId).toBeDefined();
    });

    it('should throw NotFoundException when assignment not found', async () => {
      assignmentsService.findById.mockResolvedValue(null);

      await expect(
        controller.getAssignment('nonexistent', tbmUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignGvpb', () => {
    it('should assign GVPB successfully', async () => {
      assignmentsService.assignGvpb.mockResolvedValue({
        assignmentId: 'as_new',
        topicRole: 'GVPB',
      });

      const result = await controller.assignGvpb(
        'tp_001',
        { userId: 'USR_GVPB_1' },
        tbmUser,
      );

      expect(result.data.assignmentId).toBe('as_new');
      expect(result.data.topicRole).toBe('GVPB');
      expect(result.meta.requestId).toBeDefined();
    });
  });

  describe('assignCouncil', () => {
    it('should assign council successfully', async () => {
      assignmentsService.assignCouncil.mockResolvedValue({
        created: true,
        count: 5,
      });

      const result = await controller.assignCouncil(
        'tp_001',
        {
          chairUserId: 'USR_CT_1',
          secretaryUserId: 'USR_TK_1',
          memberUserIds: ['USR_TV_1', 'USR_TV_2', 'USR_TV_3'],
          defenseAt: '2026-07-15T08:30:00.000Z',
          location: 'Phong B2-01',
        },
        tbmUser,
      );

      expect(result.data.created).toBe(true);
      expect(result.data.count).toBe(5);
      expect(result.meta.requestId).toBeDefined();
    });
  });

  describe('replaceAssignment', () => {
    it('should replace assignment successfully', async () => {
      assignmentsService.replaceAssignment.mockResolvedValue({
        replaced: true,
      });

      const result = await controller.replaceAssignment(
        'as_001',
        { newUserId: 'USR_NEW_1', reason: 'Test replacement' },
        tbmUser,
      );

      expect(result.data.replaced).toBe(true);
      expect(result.meta.requestId).toBeDefined();
    });
  });
});
