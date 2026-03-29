import {
  Injectable,
  Optional,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  AssignmentResponseDto,
  AssignmentStatus,
  AssignGvpbDto,
  AssignCouncilDto,
  ReplaceAssignmentDto,
} from './dto';
import { AuthUser, TopicRole } from '../../common/types';
import {
  AssignmentsRepository,
  TopicsRepository,
  UsersRepository,
} from '../../infrastructure/google-sheets';
import { NotificationsService } from '../notifications/notifications.service';

export interface AssignmentRecord {
  id: string;
  topicId: string;
  userId: string;
  topicRole: TopicRole;
  status: AssignmentStatus;
  assignedAt: string;
  revokedAt?: string;
}

@Injectable()
export class AssignmentsService {
  private readonly quotaTrackedRoles: TopicRole[] = ['GVHD', 'GVPB'];

  constructor(
    private readonly assignmentsRepository: AssignmentsRepository,
    private readonly topicsRepository: TopicsRepository,
    private readonly usersRepository: UsersRepository,
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  private generateId(): string {
    return `as_${crypto.randomBytes(6).toString('hex')}`;
  }

  private async getLecturerQuota(userId: string): Promise<{
    userId: string;
    totalQuota: number;
    usedQuota: number;
  }> {
    const lecturer = await this.usersRepository.findById(userId);
    if (!lecturer || lecturer.role === 'STUDENT') {
      throw new BadRequestException(`User ${userId} is not a valid lecturer`);
    }

    return {
      userId,
      totalQuota: lecturer.totalQuota ?? 10,
      usedQuota: lecturer.quotaUsed ?? 0,
    };
  }

  private async ensureQuotaAvailable(userId: string, role: TopicRole): Promise<void> {
    if (!this.quotaTrackedRoles.includes(role)) {
      return;
    }

    const quota = await this.getLecturerQuota(userId);
    if (quota.usedQuota >= quota.totalQuota) {
      throw new ConflictException(
        `Lecturer ${userId} has reached quota limit for role ${role}`,
      );
    }
  }

  private async applyQuotaDelta(
    userId: string,
    role: TopicRole,
    delta: 1 | -1,
  ): Promise<void> {
    if (!this.quotaTrackedRoles.includes(role)) {
      return;
    }

    const lecturer = await this.usersRepository.findById(userId);
    if (!lecturer || lecturer.role === 'STUDENT') {
      return;
    }

    const current = lecturer.quotaUsed ?? 0;
    lecturer.quotaUsed = Math.max(0, current + delta);
    await this.usersRepository.update(lecturer.id, lecturer);
  }

  /**
   * Get all assignments for a topic
   */
  async findByTopicId(
    topicId: string,
    user: AuthUser,
  ): Promise<AssignmentResponseDto[]> {
    const topic = await this.topicsRepository.findById(topicId);
    if (!topic) {
      throw new NotFoundException(`Topic with ID ${topicId} not found`);
    }

    // Authorization: Students can only view their own topic assignments
    if (user.role === 'STUDENT' && topic.studentUserId !== user.userId) {
      throw new ForbiddenException('Cannot view assignments for this topic');
    }

    const assignments = await this.assignmentsRepository.findAll();
    const topicAssignments = assignments.filter(
      (a) => a.topicId === topicId,
    );

    return topicAssignments.map((a) => this.mapToDto(a));
  }

  /**
   * Get assignment by ID
   */
  async findById(
    assignmentId: string,
    user: AuthUser,
  ): Promise<AssignmentRecord | null> {
    const assignment = await this.assignmentsRepository.findById(assignmentId);
    if (!assignment) return null;

    const topic = await this.topicsRepository.findById(assignment.topicId);
    if (!topic) return null;

    // Authorization check
    if (user.role === 'STUDENT' && topic.studentUserId !== user.userId) {
      throw new ForbiddenException('Cannot view this assignment');
    }

    return assignment;
  }

  /**
   * Assign GVPB (phản biện) to a topic - Only TBM can do this
   */
  async assignGvpb(
    topicId: string,
    dto: AssignGvpbDto,
    user: AuthUser,
  ): Promise<{ assignmentId: string; topicRole: TopicRole }> {
    // Only TBM can assign GVPB
    if (user.role !== 'TBM') {
      throw new ForbiddenException('Only TBM can assign GVPB');
    }

    const topic = await this.topicsRepository.findById(topicId);
    if (!topic) {
      throw new NotFoundException(`Topic with ID ${topicId} not found`);
    }

    const assignments = await this.assignmentsRepository.findAll();

    // GVPB can only be assigned to KLTN topics
    if (topic.type !== 'KLTN') {
      throw new BadRequestException('GVPB can only be assigned to KLTN topics');
    }

    // Topic must be in a valid state (e.g., CONFIRMED or later)
    const validStates = ['CONFIRMED', 'IN_PROGRESS', 'PENDING_CONFIRM', 'DEFENSE'];
    if (!validStates.includes(topic.state)) {
      throw new ConflictException(
        `Cannot assign GVPB in topic state: ${topic.state}`,
      );
    }

    // Check if GVPB already assigned
    const existingGvpb = assignments.find(
      (a) =>
        a.topicId === topicId &&
        a.topicRole === 'GVPB' &&
        a.status === 'ACTIVE',
    );
    if (existingGvpb) {
      throw new ConflictException('Topic already has an active GVPB assigned');
    }

    // Validate user is a lecturer
    await this.getLecturerQuota(dto.userId);

    // Cannot assign GVHD as GVPB (conflict)
    if (dto.userId === topic.supervisorUserId) {
      throw new ConflictException('GVHD cannot be assigned as GVPB for the same topic');
    }

    const alreadyAssignedOnTopic = assignments.find(
      (a) =>
        a.topicId === topicId &&
        a.userId === dto.userId &&
        a.status === 'ACTIVE',
    );
    if (alreadyAssignedOnTopic) {
      throw new ConflictException(
        'Lecturer already has an active role on this topic',
      );
    }

    await this.ensureQuotaAvailable(dto.userId, 'GVPB');

    const newAssignment: AssignmentRecord = {
      id: this.generateId(),
      topicId,
      userId: dto.userId,
      topicRole: 'GVPB',
      status: 'ACTIVE',
      assignedAt: new Date().toISOString(),
    };

    await this.assignmentsRepository.create(newAssignment);
    await this.applyQuotaDelta(dto.userId, 'GVPB', 1);

    await this.notifyIfAvailable({
      receiverUserId: dto.userId,
      type: 'ASSIGNMENT_ADDED',
      topicId,
      context: {
        role: 'GVPB',
        topicTitle: topic.title,
      },
    });

    return {
      assignmentId: newAssignment.id,
      topicRole: 'GVPB',
    };
  }

  /**
   * Assign defense council to a topic - Only TBM can do this
   */
  async assignCouncil(
    topicId: string,
    dto: AssignCouncilDto,
    user: AuthUser,
  ): Promise<{ created: boolean; count: number }> {
    // Only TBM can assign council
    if (user.role !== 'TBM') {
      throw new ForbiddenException('Only TBM can assign council');
    }

    const topic = await this.topicsRepository.findById(topicId);
    if (!topic) {
      throw new NotFoundException(`Topic with ID ${topicId} not found`);
    }

    const assignments = await this.assignmentsRepository.findAll();

    // Council only for KLTN topics
    if (topic.type !== 'KLTN') {
      throw new BadRequestException('Council can only be assigned to KLTN topics');
    }

    // Topic must be in a valid state for council assignment
    const validStates = ['DEFENSE', 'PENDING_CONFIRM'];
    if (!validStates.includes(topic.state)) {
      throw new ConflictException(
        `Cannot assign council in topic state: ${topic.state}`,
      );
    }

    // Check for existing active council
    const existingCouncil = assignments.filter(
      (a) =>
        a.topicId === topicId &&
        ['CT_HD', 'TK_HD', 'TV_HD'].includes(a.topicRole) &&
        a.status === 'ACTIVE',
    );
    if (existingCouncil.length > 0) {
      throw new ConflictException('Topic already has an active council');
    }

    // Validate all users are lecturers
    const allUserIds = [
      dto.chairUserId,
      dto.secretaryUserId,
      ...dto.memberUserIds,
    ];
    for (const userId of allUserIds) {
      await this.getLecturerQuota(userId);
    }

    // Validate no duplicate members
    const uniqueUserIds = new Set(allUserIds);
    if (uniqueUserIds.size !== allUserIds.length) {
      throw new ConflictException('Council members must be unique');
    }

    // Validate no conflict with GVHD
    if (allUserIds.includes(topic.supervisorUserId)) {
      throw new ConflictException('GVHD cannot be a council member');
    }

    const activeGvpb = assignments.find(
      (a) =>
        a.topicId === topicId &&
        a.topicRole === 'GVPB' &&
        a.status === 'ACTIVE',
    );
    if (activeGvpb && allUserIds.includes(activeGvpb.userId)) {
      throw new ConflictException(
        'GVPB cannot be a council member for the same topic',
      );
    }

    // Create assignments
    const now = new Date().toISOString();
    const newAssignments: AssignmentRecord[] = [];

    // Chair (CT_HD)
    newAssignments.push({
      id: this.generateId(),
      topicId,
      userId: dto.chairUserId,
      topicRole: 'CT_HD',
      status: 'ACTIVE',
      assignedAt: now,
    });

    // Secretary (TK_HD)
    newAssignments.push({
      id: this.generateId(),
      topicId,
      userId: dto.secretaryUserId,
      topicRole: 'TK_HD',
      status: 'ACTIVE',
      assignedAt: now,
    });

    // Members (TV_HD)
    for (const memberId of dto.memberUserIds) {
      newAssignments.push({
        id: this.generateId(),
        topicId,
        userId: memberId,
        topicRole: 'TV_HD',
        status: 'ACTIVE',
        assignedAt: now,
      });
    }

    for (const item of newAssignments) {
      await this.assignmentsRepository.create(item);
    }

    for (const item of newAssignments) {
      await this.notifyIfAvailable({
        receiverUserId: item.userId,
        type: 'ASSIGNMENT_ADDED',
        topicId,
        context: {
          role: item.topicRole,
          topicTitle: topic.title,
        },
      });
    }

    const receivers = new Set<string>([topic.studentUserId, topic.supervisorUserId]);
    const activeGvpbForNotify = assignments.find(
      (a) =>
        a.topicId === topicId &&
        a.topicRole === 'GVPB' &&
        a.status === 'ACTIVE',
    );
    if (activeGvpbForNotify) {
      receivers.add(activeGvpbForNotify.userId);
    }

    for (const receiverUserId of receivers) {
      await this.notifyIfAvailable({
        receiverUserId,
        type: 'GENERAL',
        topicId,
        context: {
          message: `Hoi dong cham bao ve da duoc phan cong cho de tai \"${topic.title}\".`,
        },
      });
    }

    return {
      created: true,
      count: newAssignments.length,
    };
  }

  /**
   * Replace an assignment - Only TBM can do this
   */
  async replaceAssignment(
    assignmentId: string,
    dto: ReplaceAssignmentDto,
    user: AuthUser,
  ): Promise<{ replaced: boolean }> {
    // Only TBM can replace assignments
    if (user.role !== 'TBM') {
      throw new ForbiddenException('Only TBM can replace assignments');
    }

    const assignment = await this.assignmentsRepository.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundException(`Assignment with ID ${assignmentId} not found`);
    }

    if (assignment.status !== 'ACTIVE') {
      throw new ConflictException('Cannot replace a revoked assignment');
    }

    const topic = await this.topicsRepository.findById(assignment.topicId);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    const assignments = await this.assignmentsRepository.findAll();

    // Validate new user is a lecturer
    await this.getLecturerQuota(dto.newUserId);

    // Cannot replace with same user
    if (assignment.userId === dto.newUserId) {
      throw new ConflictException('New user must be different from current assignee');
    }

    // Cannot assign GVHD to other roles on same topic (conflict check)
    if (dto.newUserId === topic.supervisorUserId && assignment.topicRole !== 'GVHD') {
      throw new ConflictException('GVHD cannot hold another role on the same topic');
    }

    const hasExistingRole = assignments.find(
      (a) =>
        a.topicId === assignment.topicId &&
        a.userId === dto.newUserId &&
        a.status === 'ACTIVE',
    );
    if (hasExistingRole) {
      throw new ConflictException('New user already has an active role on this topic');
    }

    await this.ensureQuotaAvailable(dto.newUserId, assignment.topicRole);

    // Revoke old assignment
    assignment.status = 'REVOKED';
    assignment.revokedAt = new Date().toISOString();
    await this.assignmentsRepository.update(assignment.id, assignment);

    // Create new assignment
    const newAssignment: AssignmentRecord = {
      id: this.generateId(),
      topicId: assignment.topicId,
      userId: dto.newUserId,
      topicRole: assignment.topicRole,
      status: 'ACTIVE',
      assignedAt: new Date().toISOString(),
    };

    await this.assignmentsRepository.create(newAssignment);
    await this.applyQuotaDelta(assignment.userId, assignment.topicRole, -1);
    await this.applyQuotaDelta(dto.newUserId, assignment.topicRole, 1);

    return { replaced: true };
  }

  /**
   * Check if user has a specific role on a topic
   */
  async hasRoleOnTopic(
    topicId: string,
    userId: string,
    roles: TopicRole[],
  ): Promise<boolean> {
    const assignments = await this.assignmentsRepository.findAll();
    return assignments.some(
      (a) =>
        a.topicId === topicId &&
        a.userId === userId &&
        roles.includes(a.topicRole) &&
        a.status === 'ACTIVE',
    );
  }

  /**
   * Get user's role on a topic
   */
  async getUserRoleOnTopic(
    topicId: string,
    userId: string,
  ): Promise<TopicRole | null> {
    const assignments = await this.assignmentsRepository.findAll();
    const assignment = assignments.find(
      (a) =>
        a.topicId === topicId && a.userId === userId && a.status === 'ACTIVE',
    );
    return assignment?.topicRole || null;
  }

  /**
   * Map record to DTO
   */
  mapToDto(record: AssignmentRecord): AssignmentResponseDto {
    return {
      id: record.id,
      topicId: record.topicId,
      userId: record.userId,
      topicRole: record.topicRole,
      status: record.status,
      assignedAt: record.assignedAt,
      revokedAt: record.revokedAt,
    };
  }

  private async notifyIfAvailable(params: {
    receiverUserId: string;
    type: 'ASSIGNMENT_ADDED' | 'GENERAL';
    context: Record<string, string>;
    topicId?: string;
  }): Promise<void> {
    if (!this.notificationsService) {
      return;
    }

    await this.notificationsService.create(params);
  }
}
