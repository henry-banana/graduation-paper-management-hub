import {
  Injectable,
  Logger,
  Optional,
  Inject,
  forwardRef,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  SchedulesRepository,
  TopicsRepository,
  UsersRepository,
} from '../../infrastructure/google-sheets';
import { NotificationsService } from '../notifications/notifications.service';
import { TopicsService } from '../topics/topics.service';

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
  private readonly logger = new Logger(AssignmentsService.name);
  private readonly quotaTrackedRoles: TopicRole[] = ['GVHD', 'GVPB'];

  constructor(
    private readonly assignmentsRepository: AssignmentsRepository,
    private readonly schedulesRepository: SchedulesRepository,
    private readonly topicsRepository: TopicsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly configService: ConfigService,
    @Optional()
    private readonly notificationsService?: NotificationsService,
    @Optional()
    @Inject(forwardRef(() => TopicsService))
    private readonly topicsService?: TopicsService,
  ) {}

  private generateId(): string {
    return `as_${crypto.randomBytes(6).toString('hex')}`;
  }

  private generateScheduleId(): string {
    return `sch_${crypto.randomBytes(6).toString('hex')}`;
  }

  private inferLocationType(location: string): 'ONLINE' | 'OFFLINE' {
    const normalized = location.toLowerCase();
    if (
      normalized.includes('online') ||
      normalized.includes('zoom') ||
      normalized.includes('meet') ||
      normalized.includes('teams') ||
      normalized.includes('truc tuyen') ||
      normalized.includes('trực tuyến')
    ) {
      return 'ONLINE';
    }
    return 'OFFLINE';
  }

  private formatDateTimeVi(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString('vi-VN', { hour12: false });
  }


  private async getLecturerQuota(userId: string): Promise<{
    userId: string;
    totalQuota: number;
    usedQuota: number;
  }> {
    this.logger.log(`[getLecturerQuota:start] userId=${userId}`);
    const lecturer = await this.usersRepository.findById(userId);
    if (!lecturer || lecturer.role === 'STUDENT') {
      this.logger.warn(`[getLecturerQuota:invalidLecturer] userId=${userId}`);
      throw new BadRequestException(`User ${userId} is not a valid lecturer`);
    }

    this.logger.log(
      `[getLecturerQuota:success] userId=${userId} totalQuota=${lecturer.totalQuota ?? 10} usedQuota=${lecturer.quotaUsed ?? 0}`,
    );
    return {
      userId,
      totalQuota: lecturer.totalQuota ?? 10,
      usedQuota: lecturer.quotaUsed ?? 0,
    };
  }

  private async ensureQuotaAvailable(userId: string, role: TopicRole): Promise<void> {
    if (!this.quotaTrackedRoles.includes(role)) {
      this.logger.log(
        `[ensureQuotaAvailable:skip] userId=${userId} role=${role} reason=ROLE_NOT_TRACKED`,
      );
      return;
    }

    const quota = await this.getLecturerQuota(userId);
    if (quota.usedQuota >= quota.totalQuota) {
      this.logger.warn(
        `[ensureQuotaAvailable:conflict] userId=${userId} role=${role} usedQuota=${quota.usedQuota} totalQuota=${quota.totalQuota}`,
      );
      throw new ConflictException(
        `Lecturer ${userId} has reached quota limit for role ${role}`,
      );
    }

    this.logger.log(
      `[ensureQuotaAvailable:success] userId=${userId} role=${role} usedQuota=${quota.usedQuota} totalQuota=${quota.totalQuota}`,
    );
  }

  private async applyQuotaDelta(
    userId: string,
    role: TopicRole,
    delta: 1 | -1,
  ): Promise<void> {
    if (!this.quotaTrackedRoles.includes(role)) {
      this.logger.log(
        `[applyQuotaDelta:skip] userId=${userId} role=${role} delta=${delta} reason=ROLE_NOT_TRACKED`,
      );
      return;
    }

    this.logger.log(`[applyQuotaDelta:start] userId=${userId} role=${role} delta=${delta}`);
    const lecturer = await this.usersRepository.findById(userId);
    if (!lecturer || lecturer.role === 'STUDENT') {
      this.logger.warn(
        `[applyQuotaDelta:skip] userId=${userId} role=${role} delta=${delta} reason=INVALID_LECTURER`,
      );
      return;
    }

    const current = lecturer.quotaUsed ?? 0;
    lecturer.quotaUsed = Math.max(0, current + delta);
    await this.usersRepository.update(lecturer.id, lecturer);
    this.logger.log(
      `[applyQuotaDelta:success] userId=${userId} role=${role} delta=${delta} quotaBefore=${current} quotaAfter=${lecturer.quotaUsed}`,
    );
  }

  /**
   * Get all assignments for a topic
   */
  async findByTopicId(
    topicId: string,
    user: AuthUser,
  ): Promise<AssignmentResponseDto[]> {
    this.logger.log(
      `[findByTopicId:start] topicId=${topicId} requesterUserId=${user.userId} requesterRole=${user.role}`,
    );
    const topic = await this.topicsRepository.findById(topicId);
    if (!topic) {
      this.logger.warn(`[findByTopicId:notFound] topicId=${topicId}`);
      throw new NotFoundException(`Topic with ID ${topicId} not found`);
    }

    // Authorization: Students can only view their own topic assignments
    if (user.role === 'STUDENT' && topic.studentUserId !== user.userId) {
      this.logger.warn(
        `[findByTopicId:forbidden] topicId=${topicId} requesterUserId=${user.userId} ownerUserId=${topic.studentUserId}`,
      );
      throw new ForbiddenException('Cannot view assignments for this topic');
    }

    const assignments = await this.assignmentsRepository.findAll();
    const topicAssignments = assignments.filter(
      (a) => a.topicId === topicId,
    );
    this.logger.log(
      `[findByTopicId:success] topicId=${topicId} totalAssignments=${topicAssignments.length}`,
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
    this.logger.log(
      `[findById:start] assignmentId=${assignmentId} requesterUserId=${user.userId} requesterRole=${user.role}`,
    );
    const assignment = await this.assignmentsRepository.findById(assignmentId);
    if (!assignment) {
      this.logger.warn(`[findById:notFound] assignmentId=${assignmentId}`);
      return null;
    }

    const topic = await this.topicsRepository.findById(assignment.topicId);
    if (!topic) {
      this.logger.warn(
        `[findById:topicMissing] assignmentId=${assignmentId} topicId=${assignment.topicId}`,
      );
      return null;
    }

    // Authorization check
    if (user.role === 'STUDENT' && topic.studentUserId !== user.userId) {
      this.logger.warn(
        `[findById:forbidden] assignmentId=${assignmentId} requesterUserId=${user.userId} topicOwnerUserId=${topic.studentUserId}`,
      );
      throw new ForbiddenException('Cannot view this assignment');
    }

    this.logger.log(
      `[findById:success] assignmentId=${assignmentId} topicId=${assignment.topicId} topicRole=${assignment.topicRole}`,
    );
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
    this.logger.log(
      `[assignGvpb:start] topicId=${topicId} gvpbUserId=${dto.userId} actorUserId=${user.userId} actorRole=${user.role}`,
    );
    // Only TBM can assign GVPB
    if (user.role !== 'TBM') {
      this.logger.warn(
        `[assignGvpb:forbidden] topicId=${topicId} actorUserId=${user.userId} actorRole=${user.role}`,
      );
      throw new ForbiddenException('Only TBM can assign GVPB');
    }

    const topic = await this.topicsRepository.findById(topicId);
    if (!topic) {
      this.logger.warn(`[assignGvpb:notFound] topicId=${topicId}`);
      throw new NotFoundException(`Topic with ID ${topicId} not found`);
    }

    const assignments = await this.assignmentsRepository.findAll();

    // GVPB can only be assigned to KLTN topics
    if (topic.type !== 'KLTN') {
      this.logger.warn(
        `[assignGvpb:badRequest] topicId=${topicId} type=${topic.type} reason=NON_KLTN`,
      );
      throw new BadRequestException('GVPB can only be assigned to KLTN topics');
    }

    // Topic must be in a valid state (e.g., CONFIRMED or later)
    const validStates = ['CONFIRMED', 'IN_PROGRESS', 'PENDING_CONFIRM', 'DEFENSE'];
    if (!validStates.includes(topic.state)) {
      this.logger.warn(
        `[assignGvpb:conflict] topicId=${topicId} state=${topic.state} reason=INVALID_STATE`,
      );
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
      this.logger.warn(
        `[assignGvpb:conflict] topicId=${topicId} reason=GVPB_ALREADY_EXISTS assignmentId=${existingGvpb.id}`,
      );
      throw new ConflictException('Topic already has an active GVPB assigned');
    }

    // Validate user is a lecturer
    await this.getLecturerQuota(dto.userId);

    // Cannot assign GVHD as GVPB (conflict)
    if (dto.userId === topic.supervisorUserId) {
      this.logger.warn(
        `[assignGvpb:conflict] topicId=${topicId} gvpbUserId=${dto.userId} reason=SUPERVISOR_CONFLICT`,
      );
      throw new ConflictException('GVHD cannot be assigned as GVPB for the same topic');
    }

    const alreadyAssignedOnTopic = assignments.find(
      (a) =>
        a.topicId === topicId &&
        a.userId === dto.userId &&
        a.status === 'ACTIVE',
    );
    if (alreadyAssignedOnTopic) {
      this.logger.warn(
        `[assignGvpb:conflict] topicId=${topicId} gvpbUserId=${dto.userId} reason=ALREADY_ASSIGNED topicRole=${alreadyAssignedOnTopic.topicRole}`,
      );
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

    // DB-13 fix: Populate teacher-visible reference columns
    try {
      const [student, lecturer] = await Promise.all([
        this.usersRepository.findById(topic.studentUserId),
        this.usersRepository.findById(dto.userId),
      ]);
      if (student) {
        (newAssignment as any)._emailSV = student.email;
      }
      if (lecturer) {
        (newAssignment as any)._emailGV = lecturer.email;
      }
    } catch { /* non-blocking: teacher columns optional */ }

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
    this.logger.log(
      `[assignGvpb:success] topicId=${topicId} assignmentId=${newAssignment.id} gvpbUserId=${dto.userId}`,
    );

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
    this.logger.log(
      `[assignCouncil:start] topicId=${topicId} chair=${dto.chairUserId} secretary=${dto.secretaryUserId} members=${dto.memberUserIds.join(',')} actorUserId=${user.userId} actorRole=${user.role}`,
    );
    // Only TBM can assign council
    if (user.role !== 'TBM') {
      this.logger.warn(
        `[assignCouncil:forbidden] topicId=${topicId} actorUserId=${user.userId} actorRole=${user.role}`,
      );
      throw new ForbiddenException('Only TBM can assign council');
    }

    const topic = await this.topicsRepository.findById(topicId);
    if (!topic) {
      this.logger.warn(`[assignCouncil:notFound] topicId=${topicId}`);
      throw new NotFoundException(`Topic with ID ${topicId} not found`);
    }

    const assignments = await this.assignmentsRepository.findAll();

    // Council only for KLTN topics
    if (topic.type !== 'KLTN') {
      this.logger.warn(
        `[assignCouncil:badRequest] topicId=${topicId} type=${topic.type} reason=NON_KLTN`,
      );
      throw new BadRequestException('Council can only be assigned to KLTN topics');
    }

    // Topic must be in a valid state for council assignment
    const validStates = ['DEFENSE', 'PENDING_CONFIRM'];
    if (!validStates.includes(topic.state)) {
      this.logger.warn(
        `[assignCouncil:conflict] topicId=${topicId} state=${topic.state} reason=INVALID_STATE`,
      );
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
      this.logger.warn(
        `[assignCouncil:conflict] topicId=${topicId} reason=COUNCIL_ALREADY_EXISTS existingCount=${existingCouncil.length}`,
      );
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
      this.logger.warn(
        `[assignCouncil:conflict] topicId=${topicId} reason=DUPLICATE_MEMBERS rawCount=${allUserIds.length} uniqueCount=${uniqueUserIds.size}`,
      );
      throw new ConflictException('Council members must be unique');
    }

    // Validate no conflict with GVHD
    if (allUserIds.includes(topic.supervisorUserId)) {
      this.logger.warn(
        `[assignCouncil:conflict] topicId=${topicId} reason=SUPERVISOR_IN_COUNCIL supervisorUserId=${topic.supervisorUserId}`,
      );
      throw new ConflictException('GVHD cannot be a council member');
    }

    const activeGvpb = assignments.find(
      (a) =>
        a.topicId === topicId &&
        a.topicRole === 'GVPB' &&
        a.status === 'ACTIVE',
    );
    if (activeGvpb && allUserIds.includes(activeGvpb.userId)) {
      this.logger.warn(
        `[assignCouncil:conflict] topicId=${topicId} reason=GVPB_IN_COUNCIL gvpbUserId=${activeGvpb.userId}`,
      );
      throw new ConflictException(
        'GVPB cannot be a council member for the same topic',
      );
    }

    const defenseAtDate = new Date(dto.defenseAt);
    if (Number.isNaN(defenseAtDate.getTime())) {
      this.logger.warn(
        `[assignCouncil:badRequest] topicId=${topicId} reason=INVALID_DEFENSE_AT rawValue=${dto.defenseAt}`,
      );
      throw new BadRequestException('defenseAt must be a valid datetime');
    }

    const locationDetail = dto.location.trim();
    if (!locationDetail) {
      this.logger.warn(
        `[assignCouncil:badRequest] topicId=${topicId} reason=EMPTY_LOCATION`,
      );
      throw new BadRequestException('location must not be empty');
    }

    const now = new Date().toISOString();
    const defenseAtIso = defenseAtDate.toISOString();
    const locationType = this.inferLocationType(locationDetail);
    const formattedDefenseAt = this.formatDateTimeVi(defenseAtIso);

    const existingSchedule = await this.schedulesRepository.findFirst(
      (schedule) => schedule.topicId === topicId,
    );

    if (existingSchedule) {
      await this.schedulesRepository.update(existingSchedule.id, {
        ...existingSchedule,
        defenseAt: defenseAtIso,
        locationType,
        locationDetail,
        notes: existingSchedule.notes ?? 'Lich bao ve duoc cap nhat tu phan cong hoi dong',
        updatedAt: now,
      });
      this.logger.log(
        `[assignCouncil:scheduleUpdated] topicId=${topicId} scheduleId=${existingSchedule.id} defenseAt=${defenseAtIso} locationType=${locationType}`,
      );
    } else {
      const scheduleId = this.generateScheduleId();
      await this.schedulesRepository.create({
        id: scheduleId,
        topicId,
        defenseAt: defenseAtIso,
        locationType,
        locationDetail,
        notes: 'Lich bao ve duoc tao tu phan cong hoi dong',
        createdBy: user.userId,
        createdAt: now,
        updatedAt: now,
      });
      this.logger.log(
        `[assignCouncil:scheduleCreated] topicId=${topicId} scheduleId=${scheduleId} defenseAt=${defenseAtIso} locationType=${locationType}`,
      );
    }

    const scheduleDetails = `Lich bao ve: ${formattedDefenseAt} tai ${locationDetail}.`;

    // Create assignments
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

    // DB-13 fix: Populate teacher-visible reference columns for all assignments
    try {
      const student = await this.usersRepository.findById(topic.studentUserId);
      for (const item of newAssignments) {
        const lecturer = await this.usersRepository.findById(item.userId);
        if (student) {
          (item as any)._emailSV = student.email;
        }
        if (lecturer) {
          (item as any)._emailGV = lecturer.email;
        }
      }
    } catch { /* non-blocking: teacher columns optional */ }

    for (const item of newAssignments) {
      await this.assignmentsRepository.create(item);
    }

    // Auto state transition PENDING_CONFIRM -> DEFENSE after council assignment
    // Bug fix: Restore auto transition removed during DEMO_MODE cleanup
    // This ensures student can see council info and defense schedule
    if (topic.type === 'KLTN' && topic.state === 'PENDING_CONFIRM') {
      try {
        if (this.topicsService) {
          await this.topicsService.transition(topicId, 'CONFIRM_DEFENSE', user);
          this.logger.log(
            `[assignCouncil:autoTransition] topicId=${topicId} PENDING_CONFIRM -> DEFENSE`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `[assignCouncil:autoTransition] Failed to transition state for topicId=${topicId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        // Don't fail the whole operation if state transition fails
      }
    }

    // Notify all council members about their assignment
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
    for (const item of newAssignments) {
      receivers.add(item.userId);
    }

    // Enhanced notification with council member names
    const chairUser = await this.usersRepository.findById(dto.chairUserId);
    const secretaryUser = await this.usersRepository.findById(dto.secretaryUserId);
    const memberUsers = await Promise.all(
      dto.memberUserIds.map(id => this.usersRepository.findById(id))
    );

    const chairName = chairUser?.name || chairUser?.email || 'Chưa xác định';
    const secretaryName = secretaryUser?.name || secretaryUser?.email || 'Chưa xác định';
    const memberNames = memberUsers
      .filter(u => u)
      .map(u => u?.name || u?.email || 'Chưa xác định')
      .join(', ');

    const detailedMessage = `Hội đồng bảo vệ đã được phân công cho đề tài "${topic.title}".

Thành phần hội đồng:
- Chủ tịch: ${chairName}
- Thư ký: ${secretaryName}
- Thành viên: ${memberNames}

${scheduleDetails}`;

    for (const receiverUserId of receivers) {
      await this.notifyIfAvailable({
        receiverUserId,
        type: 'GENERAL',
        topicId,
        context: {
          message: detailedMessage,
        },
      });
    }
    this.logger.log(
      `[assignCouncil:success] topicId=${topicId} createdAssignments=${newAssignments.length} notifiedReceivers=${receivers.size}`,
    );

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
    this.logger.log(
      `[replaceAssignment:start] assignmentId=${assignmentId} newUserId=${dto.newUserId} actorUserId=${user.userId} actorRole=${user.role}`,
    );
    // Only TBM can replace assignments
    if (user.role !== 'TBM') {
      this.logger.warn(
        `[replaceAssignment:forbidden] assignmentId=${assignmentId} actorUserId=${user.userId} actorRole=${user.role}`,
      );
      throw new ForbiddenException('Only TBM can replace assignments');
    }

    const assignment = await this.assignmentsRepository.findById(assignmentId);
    if (!assignment) {
      this.logger.warn(`[replaceAssignment:notFound] assignmentId=${assignmentId}`);
      throw new NotFoundException(`Assignment with ID ${assignmentId} not found`);
    }

    if (assignment.status !== 'ACTIVE') {
      this.logger.warn(
        `[replaceAssignment:conflict] assignmentId=${assignmentId} reason=ASSIGNMENT_REVOKED`,
      );
      throw new ConflictException('Cannot replace a revoked assignment');
    }

    const topic = await this.topicsRepository.findById(assignment.topicId);
    if (!topic) {
      this.logger.warn(
        `[replaceAssignment:notFound] assignmentId=${assignmentId} topicId=${assignment.topicId}`,
      );
      throw new NotFoundException('Topic not found');
    }

    const assignments = await this.assignmentsRepository.findAll();

    // Validate new user is a lecturer
    await this.getLecturerQuota(dto.newUserId);

    // Cannot replace with same user
    if (assignment.userId === dto.newUserId) {
      this.logger.warn(
        `[replaceAssignment:conflict] assignmentId=${assignmentId} reason=SAME_ASSIGNEE userId=${dto.newUserId}`,
      );
      throw new ConflictException('New user must be different from current assignee');
    }

    // Cannot assign GVHD to other roles on same topic (conflict check)
    if (dto.newUserId === topic.supervisorUserId && assignment.topicRole !== 'GVHD') {
      this.logger.warn(
        `[replaceAssignment:conflict] assignmentId=${assignmentId} reason=SUPERVISOR_CONFLICT supervisorUserId=${topic.supervisorUserId}`,
      );
      throw new ConflictException('GVHD cannot hold another role on the same topic');
    }

    const hasExistingRole = assignments.find(
      (a) =>
        a.topicId === assignment.topicId &&
        a.userId === dto.newUserId &&
        a.status === 'ACTIVE',
    );
    if (hasExistingRole) {
      this.logger.warn(
        `[replaceAssignment:conflict] assignmentId=${assignmentId} reason=NEW_USER_HAS_ACTIVE_ROLE newUserId=${dto.newUserId}`,
      );
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

    // DB-13 fix: Populate teacher-visible reference columns
    try {
      const topic = await this.topicsRepository.findById(assignment.topicId);
      if (topic) {
        const [student, lecturer] = await Promise.all([
          this.usersRepository.findById(topic.studentUserId),
          this.usersRepository.findById(dto.newUserId),
        ]);
        if (student) {
          (newAssignment as any)._emailSV = student.email;
        }
        if (lecturer) {
          (newAssignment as any)._emailGV = lecturer.email;
        }
      }
    } catch { /* non-blocking: teacher columns optional */ }

    await this.assignmentsRepository.create(newAssignment);
    await this.applyQuotaDelta(assignment.userId, assignment.topicRole, -1);
    await this.applyQuotaDelta(dto.newUserId, assignment.topicRole, 1);
    this.logger.log(
      `[replaceAssignment:success] assignmentId=${assignmentId} oldUserId=${assignment.userId} newUserId=${dto.newUserId} topicId=${assignment.topicId} topicRole=${assignment.topicRole}`,
    );

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
    this.logger.log(
      `[hasRoleOnTopic:start] topicId=${topicId} userId=${userId} roles=${roles.join(',')}`,
    );
    const assignments = await this.assignmentsRepository.findAll();
    const hasRole = assignments.some(
      (a) =>
        a.topicId === topicId &&
        a.userId === userId &&
        roles.includes(a.topicRole) &&
        a.status === 'ACTIVE',
    );
    this.logger.log(
      `[hasRoleOnTopic:success] topicId=${topicId} userId=${userId} hasRole=${hasRole}`,
    );
    return hasRole;
  }

  /**
   * Get user's role on a topic
   */
  async getUserRoleOnTopic(
    topicId: string,
    userId: string,
  ): Promise<TopicRole | null> {
    this.logger.log(`[getUserRoleOnTopic:start] topicId=${topicId} userId=${userId}`);
    const assignments = await this.assignmentsRepository.findAll();
    const assignment = assignments.find(
      (a) =>
        a.topicId === topicId && a.userId === userId && a.status === 'ACTIVE',
    );
    const role = assignment?.topicRole || null;
    this.logger.log(
      `[getUserRoleOnTopic:success] topicId=${topicId} userId=${userId} role=${role ?? '-'}`,
    );
    return role;
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

  /**
   * Get all active topic roles for a user (Bug #8 fix)
   * Returns unique TopicRoles where user has active assignments
   */
  async getActiveTopicRolesForUser(userId: string): Promise<TopicRole[]> {
    this.logger.log(`[getActiveTopicRolesForUser:start] userId=${userId}`);
    const assignments = await this.assignmentsRepository.findAll();
    const roles = new Set<TopicRole>();
    
    for (const a of assignments) {
      if (a.userId === userId && a.status === 'ACTIVE') {
        roles.add(a.topicRole);
      }
    }
    
    const result = Array.from(roles);
    this.logger.log(
      `[getActiveTopicRolesForUser:success] userId=${userId} roles=${result.join(',') || '-'}`,
    );
    return result;
  }

  private async notifyIfAvailable(params: {
    receiverUserId: string;
    type: 'ASSIGNMENT_ADDED' | 'GENERAL';
    context: Record<string, string>;
    topicId?: string;
  }): Promise<void> {
    if (!this.notificationsService) {
      this.logger.log(
        `[notifyIfAvailable:skip] receiverUserId=${params.receiverUserId} type=${params.type} reason=NOTIFICATIONS_SERVICE_UNAVAILABLE`,
      );
      return;
    }

    this.logger.log(
      `[notifyIfAvailable:start] receiverUserId=${params.receiverUserId} type=${params.type} topicId=${params.topicId ?? '-'}`,
    );
    await this.notificationsService.create(params);
    this.logger.log(
      `[notifyIfAvailable:success] receiverUserId=${params.receiverUserId} type=${params.type} topicId=${params.topicId ?? '-'}`,
    );
  }
}
