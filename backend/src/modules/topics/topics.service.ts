import {
  Injectable,
  Logger,
  Optional,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  TopicResponseDto,
  CreateTopicDto,
  UpdateTopicDto,
  GetTopicsQueryDto,
  SetDeadlineDto,
  CreateRevisionRoundDto,
  RevisionRoundResponseDto,
  CloseRevisionRoundDto,
  BulkApproveResultDto,
} from './dto';
import {
  TopicType,
  TopicState,
  TopicAction,
  isValidTransition,
  canEditTopic,
  canEditDeadline,
  ACTION_TO_STATE,
} from './topic-state.enum';
import { AuthUser, TopicRole } from '../../common/types';
import {
  PeriodsRepository,
  RevisionRoundRecord,
  RevisionRoundsRepository,
  ScoreSummariesRepository,
  ScoresRepository,
  SubmissionsRepository,
  TopicsRepository,
  UsersRepository,
  AssignmentsRepository,
} from '../../infrastructure/google-sheets';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

export interface TopicRecord {
  id: string;
  type: TopicType;
  title: string;
  domain: string;
  companyName?: string;
  state: TopicState;
  studentUserId: string;
  supervisorUserId: string;
  periodId: string;
  approvalDeadlineAt?: string;
  submitStartAt?: string;
  submitEndAt?: string;
  reasonRejected?: string;
  /**
   * DB-06 fix: was `string?` — changed to `boolean?` to match semantic intent.
   * Stored in sheet as 'TRUE'/'FALSE'; repository serialises via boolStr().
   */
  revisionsAllowed?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    size: number;
    total: number;
  };
}

interface TransitionOptions {
  expectedState?: TopicState;
}

interface TransitionAuthorizationContext {
  isStudentOwner: boolean;
  isSupervisor: boolean;
  isTbm: boolean;
  assignmentRoles: Set<TopicRole>;
}

@Injectable()
export class TopicsService {
  private readonly logger = new Logger(TopicsService.name);
  private readonly terminalStates: TopicState[] = ['COMPLETED', 'CANCELLED'];
  private readonly topicTransitionQueue = new Map<string, Promise<void>>();

  constructor(
    private readonly topicsRepository: TopicsRepository,
    private readonly revisionRoundsRepository: RevisionRoundsRepository,
    private readonly periodsRepository: PeriodsRepository,
    private readonly usersRepository: UsersRepository,
    @Optional()
    private readonly assignmentsRepository?: AssignmentsRepository,
    @Optional()
    private readonly submissionsRepository?: SubmissionsRepository,
    @Optional()
    private readonly scoresRepository?: ScoresRepository,
    @Optional()
    private readonly scoreSummariesRepository?: ScoreSummariesRepository,
    @Optional()
    private readonly notificationsService?: NotificationsService,
    @Optional()
    private readonly auditService?: AuditService,
  ) { }

  async findAll(
    query: GetTopicsQueryDto,
    currentUser: AuthUser,
  ): Promise<PaginatedResult<TopicResponseDto>> {
    let topics = await this.topicsRepository.findAll();

    // Filter by type
    if (query.type) {
      topics = topics.filter((t) => t.type === query.type);
    }

    // Filter by state
    if (query.state) {
      topics = topics.filter((t) => t.state === query.state);
    }

    // Filter by period
    if (query.periodId) {
      topics = topics.filter((t) => t.periodId === query.periodId);
    }

    // Filter by supervisor
    if (query.supervisorUserId) {
      topics = topics.filter((t) => t.supervisorUserId === query.supervisorUserId);
    }

    // Filter by role context
    if (query.role === 'student') {
      topics = topics.filter((t) => t.studentUserId === currentUser.userId);
    } else if (query.role === 'supervisor' || query.role === 'gvhd') {
      // GVHD: xem đề tài mình đang hướng dẫn
      topics = topics.filter((t) => t.supervisorUserId === currentUser.userId);
    } else if (query.role === 'reviewer' || query.role === 'gvpb' || query.role === 'tv_hd' || query.role === 'ct_hd' || query.role === 'tk_hd') {
      // GVPB/TV_HD/CT_HD/TK_HD: xem đề tài qua assignments
      if (this.assignmentsRepository) {
        const assignments = await this.assignmentsRepository.findAll();
        const roleToTopicRole: Record<string, TopicRole> = {
          gvpb: 'GVPB',
          tv_hd: 'TV_HD',
          ct_hd: 'CT_HD',
          tk_hd: 'TK_HD',
        };

        let myAssignments = assignments.filter(
          (a) => a.userId === currentUser.userId && a.status === 'ACTIVE',
        );

        if (query.role !== 'reviewer') {
          const mappedRole = roleToTopicRole[query.role];
          myAssignments = myAssignments.filter(
            (a) => a.topicRole === mappedRole,
          );
        }

        const myTopicIds = new Set(
          myAssignments.map((a) => a.topicId),
        );
        topics = topics.filter((t) => myTopicIds.has(t.id));
      }
    }

    // Students can only see their own topics
    if (currentUser.role === 'STUDENT') {
      topics = topics.filter((t) => t.studentUserId === currentUser.userId);
    }

    // Sort by createdAt descending
    topics.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const total = topics.length;
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const start = (page - 1) * size;
    const paginatedTopics = topics.slice(start, start + size);
    const shouldEnrich = this.shouldEnrichTopicList(query.role);
    const data = shouldEnrich
      ? await this.enrichTopicListDtos(paginatedTopics, query.role, currentUser)
      : paginatedTopics.map((t) => this.mapToDto(t));

    return {
      data,
      pagination: { page, size, total },
    };
  }

  async findById(id: string): Promise<TopicRecord | null> {
    return this.topicsRepository.findById(id);
  }

  async findByIdForUser(id: string, user: AuthUser): Promise<TopicRecord> {
    const topic = await this.topicsRepository.findById(id);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    await this.ensureCanReadTopic(topic, user);
    return topic;
  }

  async listRevisionRounds(
    topicId: string,
    currentUser: AuthUser,
  ): Promise<RevisionRoundResponseDto[]> {
    const topic = await this.topicsRepository.findById(topicId);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    await this.ensureCanReadTopic(topic, currentUser);

    const rounds = await this.revisionRoundsRepository.findWhere(
      (round) => round.topicId === topicId,
    );

    return rounds
      .sort((a, b) => a.roundNumber - b.roundNumber)
      .map((round) => this.mapRevisionRoundToDto(round));
  }

  async openRevisionRound(
    topicId: string,
    dto: CreateRevisionRoundDto,
    currentUser: AuthUser,
  ): Promise<RevisionRoundResponseDto> {
    if (currentUser.role !== 'TBM') {
      throw new ForbiddenException('Only TBM can open revision rounds');
    }

    const topic = await this.topicsRepository.findById(topicId);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('Invalid revision round time window');
    }
    if (startAt.getTime() >= endAt.getTime()) {
      throw new BadRequestException('Revision round endAt must be after startAt');
    }

    const rounds = await this.revisionRoundsRepository.findWhere(
      (round) => round.topicId === topicId,
    );
    const activeRound = rounds.find((round) => round.status === 'OPEN');
    if (activeRound) {
      throw new ConflictException('Another revision round is already open');
    }

    const highestRoundNumber = rounds.reduce(
      (max, round) => Math.max(max, round.roundNumber),
      1,
    );

    const now = new Date().toISOString();
    const newRound: RevisionRoundRecord = {
      id: `rr_${crypto.randomBytes(6).toString('hex')}`,
      topicId,
      roundNumber: Math.max(2, highestRoundNumber + 1),
      status: 'OPEN',
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      requestedBy: currentUser.userId,
      reason: dto.reason?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await this.revisionRoundsRepository.create(newRound);

    await this.notifyIfAvailable({
      receiverUserId: topic.studentUserId,
      type: 'REVISION_ROUND_OPENED',
      topicId,
      context: {
        topicTitle: topic.title,
        roundNumber: String(newRound.roundNumber),
        deadline: endAt.toLocaleDateString('vi-VN'),
      },
    });

    await this.auditIfAvailable({
      action: 'REVISION_ROUND_OPENED',
      actorId: currentUser.userId,
      actorRole: currentUser.role,
      topicId,
      detail: {
        revisionRoundId: newRound.id,
        roundNumber: newRound.roundNumber,
        startAt: newRound.startAt,
        endAt: newRound.endAt,
        reason: newRound.reason,
      },
    });

    return this.mapRevisionRoundToDto(newRound);
  }

  async closeRevisionRound(
    topicId: string,
    roundId: string,
    dto: CloseRevisionRoundDto,
    currentUser: AuthUser,
  ): Promise<RevisionRoundResponseDto> {
    if (currentUser.role !== 'TBM') {
      throw new ForbiddenException('Only TBM can close revision rounds');
    }

    const topic = await this.topicsRepository.findById(topicId);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    const round = await this.revisionRoundsRepository.findById(roundId);
    if (!round || round.topicId !== topicId) {
      throw new NotFoundException('Revision round not found');
    }

    if (round.status === 'CLOSED') {
      throw new ConflictException({
        error: 'REVISION_ROUND_ALREADY_CLOSED',
        message: 'Revision round is already closed',
        code: 'REVISION_ROUND_ALREADY_CLOSED',
      });
    }

    round.status = 'CLOSED';
    round.updatedAt = new Date().toISOString();
    if (dto.reason?.trim()) {
      round.reason = dto.reason.trim();
    }

    await this.revisionRoundsRepository.update(round.id, round);

    await this.notifyIfAvailable({
      receiverUserId: topic.studentUserId,
      type: 'REVISION_ROUND_CLOSED',
      topicId,
      context: {
        topicTitle: topic.title,
        roundNumber: String(round.roundNumber),
      },
    });

    await this.auditIfAvailable({
      action: 'REVISION_ROUND_CLOSED',
      actorId: currentUser.userId,
      actorRole: currentUser.role,
      topicId,
      detail: {
        revisionRoundId: round.id,
        roundNumber: round.roundNumber,
        reason: round.reason,
      },
    });

    return this.mapRevisionRoundToDto(round);
  }

  async create(
    dto: CreateTopicDto,
    currentUser: AuthUser,
  ): Promise<{ id: string; state: TopicState }> {
    // Only students can create topics
    if (currentUser.role !== 'STUDENT') {
      throw new ForbiddenException('Only students can create topics');
    }

    const period = await this.periodsRepository.findById(dto.periodId);
    if (!period) {
      this.logger.error(
        `[create] Period NOT FOUND: id='${dto.periodId}'. Student=${currentUser.userId}, type=${dto.type}`,
      );
      throw new BadRequestException(`Period not found: ${dto.periodId}`);
    }
    this.logger.log(
      `[create] Period found: id='${period.id}' code='${period.code}' type=${period.type} status=${period.status} open=${period.openDate} close=${period.closeDate}`,
    );

    if (period.type !== dto.type) {
      this.logger.warn(
        `[create] Type mismatch: period.type=${period.type} but dto.type=${dto.type}`,
      );
      throw new BadRequestException(
        `Period ${dto.periodId} does not accept topic type ${dto.type}`,
      );
    }

    if (period.status !== 'OPEN') {
      this.logger.warn(`[create] Period status=${period.status} (not OPEN)`);
      throw new ConflictException('Registration period is not open');
    }

    if (!this.isCurrentDateWithinPeriod(period.openDate, period.closeDate)) {
      this.logger.warn(
        `[create] Date window check failed: today=${this.getCurrentLocalDate()} not in [${period.openDate}, ${period.closeDate}]`,
      );
      throw new ConflictException(
        'Registration period is outside the configured date window',
      );
    }

    await this.validateSupervisor(dto.supervisorUserId, true);

    // A student cannot run any active workflow concurrently.
    const existingActive = await this.topicsRepository.findFirst(
      (t) =>
        t.studentUserId === currentUser.userId &&
        !this.terminalStates.includes(t.state),
    );
    if (existingActive) {
      throw new ConflictException(
        `You already have an active ${existingActive.type} workflow`,
      );
    }

    // KLTN eligibility: check completedBcttScore from user profile (consistent with /users/me)
    if (dto.type === 'KLTN') {
      const studentProgress = await this.usersRepository.findById(
        currentUser.userId,
      );
      if (!studentProgress) {
        throw new BadRequestException(
          'Student progress record not found for KLTN eligibility check',
        );
      }

      if ((studentProgress.completedBcttScore ?? 0) <= 5) {
        throw new BadRequestException(
          'KLTN eligibility requires completed BCTT score greater than 5',
        );
      }
      
      // Note: earnedCredits/requiredCredits check đã bỏ theo yêu cầu mới
    }

    const now = new Date().toISOString();
    const approvalDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

    const newTopic: TopicRecord = {
      id: `tp_${crypto.randomBytes(4).toString('hex')}`,
      type: dto.type,
      title: dto.title,
      domain: dto.domain,
      companyName: dto.companyName,
      state: 'DRAFT',
      studentUserId: currentUser.userId,
      supervisorUserId: dto.supervisorUserId,
      periodId: dto.periodId,
      approvalDeadlineAt: approvalDeadline.toISOString(),
      createdAt: now,
      updatedAt: now,
    };

    await this.topicsRepository.create(newTopic);

    // Tự động tạo assignment GVHD cho supervisor
    if (this.assignmentsRepository) {
      const gvhdAssignment = {
        id: `as_${crypto.randomBytes(6).toString('hex')}`,
        topicId: newTopic.id,
        userId: newTopic.supervisorUserId,
        topicRole: 'GVHD' as TopicRole,
        status: 'ACTIVE' as const,
        assignedAt: now,
      };
      await this.assignmentsRepository.create(gvhdAssignment);
    }

    await this.notifyIfAvailable({
      receiverUserId: newTopic.supervisorUserId,
      type: 'TOPIC_PENDING',
      topicId: newTopic.id,
      context: {
        topicTitle: newTopic.title,
        studentName: currentUser.email,
      },
    });

    await this.auditIfAvailable({
      action: 'TOPIC_CREATED',
      actorId: currentUser.userId,
      actorRole: currentUser.role,
      topicId: newTopic.id,
      detail: {
        type: newTopic.type,
        periodId: newTopic.periodId,
        supervisorUserId: newTopic.supervisorUserId,
      },
    });

    return { id: newTopic.id, state: newTopic.state };
  }

  async update(
    id: string,
    dto: UpdateTopicDto,
    currentUser: AuthUser,
  ): Promise<{ updated: boolean }> {
    const topic = await this.topicsRepository.findById(id);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    // Check edit permissions
    if (!canEditTopic(topic.state)) {
      throw new ConflictException(
        `Cannot edit topic in state: ${topic.state}`,
      );
    }

    // Only student owner or TBM can edit
    if (
      currentUser.role !== 'TBM' &&
      topic.studentUserId !== currentUser.userId
    ) {
      throw new ForbiddenException('You can only edit your own topics');
    }

    // Update fields
    if (dto.title) topic.title = dto.title;
    if (dto.domain) topic.domain = dto.domain;
    if (dto.companyName !== undefined) topic.companyName = dto.companyName;

    const now = new Date();
    let supervisorChanged = false;
    const oldSupervisorId = topic.supervisorUserId;
    if (dto.supervisorUserId !== undefined) {
      const nextSupervisorId = dto.supervisorUserId.trim();
      if (!nextSupervisorId) {
        throw new BadRequestException('Supervisor is required');
      }

      await this.validateSupervisor(nextSupervisorId, true);
      supervisorChanged = nextSupervisorId !== topic.supervisorUserId;
      topic.supervisorUserId = nextSupervisorId;
    }

    if (supervisorChanged && topic.state === 'PENDING_GV') {
      topic.approvalDeadlineAt = new Date(
        now.getTime() + 3 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const student = await this.usersRepository.findById(topic.studentUserId);
      await this.notifyIfAvailable({
        receiverUserId: topic.supervisorUserId,
        type: 'TOPIC_PENDING',
        topicId: topic.id,
        context: {
          topicTitle: topic.title,
          studentName:
            student?.name ?? student?.email ?? topic.studentUserId,
        },
      });

      // Cập nhật assignment khi đổi supervisor
      if (this.assignmentsRepository) {
        const assignments = await this.assignmentsRepository.findAll();
        
        // Revoke assignment cũ của supervisor cũ
        const oldGvhdAssignment = assignments.find(
          (a) =>
            a.topicId === topic.id &&
            a.userId === oldSupervisorId &&
            a.topicRole === 'GVHD' &&
            a.status === 'ACTIVE',
        );
        if (oldGvhdAssignment) {
          oldGvhdAssignment.status = 'REVOKED';
          oldGvhdAssignment.revokedAt = now.toISOString();
          await this.assignmentsRepository.update(
            oldGvhdAssignment.id,
            oldGvhdAssignment,
          );
        }

        // Tạo assignment mới cho supervisor mới
        const newGvhdAssignment = {
          id: `as_${crypto.randomBytes(6).toString('hex')}`,
          topicId: topic.id,
          userId: topic.supervisorUserId,
          topicRole: 'GVHD' as TopicRole,
          status: 'ACTIVE' as const,
          assignedAt: now.toISOString(),
        };
        await this.assignmentsRepository.create(newGvhdAssignment);
      }
    }

    topic.updatedAt = now.toISOString();

    await this.topicsRepository.update(topic.id, topic);

    return { updated: true };
  }

  async approve(
    id: string,
    note: string | undefined,
    currentUser: AuthUser,
  ): Promise<{ state: TopicState }> {
    const topicSnapshot = await this.topicsRepository.findById(id);
    if (!topicSnapshot) {
      throw new NotFoundException('Topic not found');
    }

    return this.runInTopicTransitionQueue(id, async () => {
      const topic = await this.topicsRepository.findById(id);
      if (!topic) {
        throw new NotFoundException('Topic not found');
      }

      if (topic.state !== topicSnapshot.state) {
        throw this.buildStaleWriteConflict(
          id,
          topicSnapshot.state,
          topic.state,
        );
      }

      const authContext = await this.getTransitionAuthorizationContext(
        topic,
        currentUser,
      );

      // Check if user is the assigned supervisor OR TBM (admin override)
      const isAssignedSupervisor = topic.supervisorUserId === currentUser.userId;
      if (!isAssignedSupervisor && !authContext.isTbm) {
        throw new ForbiddenException(
          'Only the assigned supervisor or TBM can approve this topic',
        );
      }

      if (topic.state !== 'PENDING_GV') {
        throw new ConflictException(`Cannot approve topic in state: ${topic.state}`);
      }

      await this.consumeSupervisorQuota(topic.supervisorUserId);

      topic.state = 'CONFIRMED';
      topic.updatedAt = new Date().toISOString();
      try {
        await this.topicsRepository.update(topic.id, topic);
      } catch (error) {
        await this.releaseSupervisorQuota(topic.supervisorUserId);
        throw error;
      }

      await this.notifyIfAvailable({
        receiverUserId: topic.studentUserId,
        type: 'TOPIC_APPROVED',
        topicId: topic.id,
        context: {
          topicTitle: topic.title,
        },
      });

      await this.auditIfAvailable({
        action: 'TOPIC_APPROVED',
        actorId: currentUser.userId,
        actorRole: currentUser.role,
        topicId: topic.id,
        detail: {
          note,
        },
      });

      return { state: topic.state };
    });
  }

  /**
   * Bulk approve multiple topics
   * Each topic is approved independently with error handling
   */
  async bulkApprove(
    topicIds: string[],
    note: string | undefined,
    currentUser: AuthUser,
  ): Promise<BulkApproveResultDto> {
    const succeeded: string[] = [];
    const failed: Record<string, string> = {};

    // Process each topic independently
    for (const topicId of topicIds) {
      try {
        await this.approve(topicId, note, currentUser);
        succeeded.push(topicId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        failed[topicId] = message;
        this.logger.warn(`Bulk approve failed for topic ${topicId}: ${message}`);
      }
    }

    return {
      succeeded,
      failed,
      total: topicIds.length,
      successCount: succeeded.length,
      failureCount: Object.keys(failed).length,
    };
  }

  async reject(
    id: string,
    reason: string | undefined,
    currentUser: AuthUser,
  ): Promise<{ state: TopicState }> {
    const topicSnapshot = await this.topicsRepository.findById(id);
    if (!topicSnapshot) {
      throw new NotFoundException('Topic not found');
    }

    return this.runInTopicTransitionQueue(id, async () => {
      const topic = await this.topicsRepository.findById(id);
      if (!topic) {
        throw new NotFoundException('Topic not found');
      }

      if (topic.state !== topicSnapshot.state) {
        throw this.buildStaleWriteConflict(
          id,
          topicSnapshot.state,
          topic.state,
        );
      }

      const authContext = await this.getTransitionAuthorizationContext(
        topic,
        currentUser,
      );

      // Check if user is the assigned supervisor for early-phase rejection
      const isAssignedSupervisor = topic.supervisorUserId === currentUser.userId;

      if (topic.state === 'PENDING_GV') {
        if (authContext.isTbm) {
          throw new ForbiddenException(
            'TBM cannot force reject/approve/cancel in early phase',
          );
        }
        if (!isAssignedSupervisor) {
          throw new ForbiddenException('Only the assigned supervisor can reject this topic');
        }
        topic.state = 'DRAFT';
      } else if (topic.state === 'IN_PROGRESS' && topic.type === 'KLTN') {
        if (authContext.isTbm) {
          throw new ForbiddenException(
            'TBM cannot force reject/approve/cancel in early phase',
          );
        }
        if (!isAssignedSupervisor) {
          throw new ForbiddenException('Only the assigned supervisor can reject this topic');
        }
        // Canonical early-phase reject branch: remain IN_PROGRESS and require revisions.
        topic.state = 'IN_PROGRESS';
      } else if (topic.state === 'PENDING_CONFIRM' && topic.type === 'KLTN') {
        if (!this.canRejectPendingConfirm(authContext)) {
          throw new ForbiddenException(
            'Only assigned reviewer/council roles or TBM can reject in pending-confirm',
          );
        }
        topic.state = 'IN_PROGRESS';
      } else {
        throw new ConflictException(`Cannot reject topic in state: ${topic.state}`);
      }

      topic.reasonRejected = reason?.trim() || undefined;
      topic.updatedAt = new Date().toISOString();
      await this.topicsRepository.update(topic.id, topic);

      await this.notifyIfAvailable({
        receiverUserId: topic.studentUserId,
        type: 'TOPIC_REJECTED',
        topicId: topic.id,
        context: {
          topicTitle: topic.title,
          reason: reason || 'Khong ro',
        },
      });

      await this.auditIfAvailable({
        action: 'TOPIC_REJECTED',
        actorId: currentUser.userId,
        actorRole: currentUser.role,
        topicId: topic.id,
        detail: {
          reason,
          nextState: topic.state,
        },
      });

      return { state: topic.state };
    });
  }

  async setDeadline(
    id: string,
    dto: SetDeadlineDto,
    currentUser: AuthUser,
  ): Promise<{ deadlineUpdated: boolean }> {
    const topic = await this.topicsRepository.findById(id);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    // Only supervisor or TBM can set deadline
    if (
      currentUser.role !== 'TBM' &&
      topic.supervisorUserId !== currentUser.userId
    ) {
      throw new ForbiddenException('Only supervisor or TBM can set deadline');
    }

    // Check if deadline can be edited
    if (!canEditDeadline(topic.state)) {
      throw new ConflictException(
        `Cannot change deadline in state: ${topic.state}`,
      );
    }

    if (
      dto.action === 'REOPEN' &&
      (!topic.submitEndAt || new Date(topic.submitEndAt) > new Date())
    ) {
      throw new ConflictException(
        'Deadline can only be reopened after the current window has ended',
      );
    }

    // Validate date range
    if (new Date(dto.submitEndAt) <= new Date(dto.submitStartAt)) {
      throw new BadRequestException('End date must be after start date');
    }

    topic.submitStartAt = dto.submitStartAt;
    topic.submitEndAt = dto.submitEndAt;
    topic.updatedAt = new Date().toISOString();
    await this.topicsRepository.update(topic.id, topic);

    await this.notifyIfAvailable({
      receiverUserId: topic.studentUserId,
      type: 'DEADLINE_SET',
      topicId: topic.id,
      context: {
        topicTitle: topic.title,
        deadline: topic.submitEndAt,
      },
    });

    await this.auditIfAvailable({
      action: dto.action === 'REOPEN' ? 'DEADLINE_EXTENDED' : 'DEADLINE_SET',
      actorId: currentUser.userId,
      actorRole: currentUser.role,
      topicId: topic.id,
      detail: {
        submitStartAt: topic.submitStartAt,
        submitEndAt: topic.submitEndAt,
        action: dto.action ?? 'SET_OR_EXTEND',
      },
    });

    return { deadlineUpdated: true };
  }

  async transition(
    id: string,
    action: TopicAction,
    currentUser: AuthUser,
    options?: TransitionOptions,
  ): Promise<{ fromState: TopicState; toState: TopicState }> {
    if (action === 'REJECT') {
      throw new ConflictException({
        error: 'POLICY_CONFLICT',
        canonicalEndpoint: '/topics/:id/reject',
        message:
          'Reject action on transition endpoint is disabled. Use POST /topics/:id/reject.',
      });
    }

    const topicSnapshot = await this.topicsRepository.findById(id);
    if (!topicSnapshot) {
      throw new NotFoundException('Topic not found');
    }

    const expectedState = options?.expectedState ?? topicSnapshot.state;

    return this.runInTopicTransitionQueue(id, async () => {
      const topic = await this.topicsRepository.findById(id);
      if (!topic) {
        throw new NotFoundException('Topic not found');
      }

      if (topic.state !== expectedState) {
        throw this.buildStaleWriteConflict(id, expectedState, topic.state);
      }

      const fromState = topic.state;
      const toState = ACTION_TO_STATE[action];

      if (!isValidTransition(topic.type, fromState, toState)) {
        throw new ConflictException(
          `Invalid transition from ${fromState} to ${toState} for ${topic.type}`,
        );
      }

      const canTransition = await this.canUserTransition(topic, action, currentUser);
      if (!canTransition) {
        throw new ForbiddenException(
          `You are not authorized to perform action: ${action}`,
        );
      }

      topic.state = toState;
      topic.updatedAt = new Date().toISOString();
      await this.topicsRepository.update(topic.id, topic);

      if (
        (toState === 'COMPLETED' && fromState !== 'COMPLETED') ||
        (toState === 'CANCELLED' && this.shouldReleaseQuotaOnCancel(fromState))
      ) {
        await this.releaseSupervisorQuota(topic.supervisorUserId);
      }

      await this.auditIfAvailable({
        action: 'TOPIC_TRANSITION',
        actorId: currentUser.userId,
        actorRole: currentUser.role,
        topicId: topic.id,
        detail: {
          action,
          fromState,
          toState,
        },
      });

      return { fromState, toState };
    });
  }

  private shouldEnrichTopicList(role?: GetTopicsQueryDto['role']): boolean {
    return (
      role === 'reviewer' ||
      role === 'gvhd' ||
      role === 'gvpb' ||
      role === 'tv_hd' ||
      role === 'tk_hd' ||
      role === 'ct_hd'
    );
  }

  private async enrichTopicListDtos(
    topics: TopicRecord[],
    requestedRole: GetTopicsQueryDto['role'] | undefined,
    currentUser: AuthUser,
  ): Promise<TopicResponseDto[]> {
    if (topics.length === 0) {
      return [];
    }

    const topicIds = new Set(topics.map((topic) => topic.id));
    const topicIdList = Array.from(topicIds);

    const [allAssignments, allSubmissions, allScores, allSummaries] =
      await Promise.all([
        this.assignmentsRepository?.findAll() ?? Promise.resolve([]),
        this.submissionsRepository?.findAll() ?? Promise.resolve([]),
        this.scoresRepository?.findAll() ?? Promise.resolve([]),
        this.scoreSummariesRepository?.findAll() ?? Promise.resolve([]),
      ]);

    const activeAssignments = allAssignments.filter(
      (assignment) =>
        topicIds.has(assignment.topicId) && assignment.status === 'ACTIVE',
    );

    const assignmentsByTopic = new Map<string, typeof activeAssignments>();
    for (const topicId of topicIdList) {
      assignmentsByTopic.set(
        topicId,
        activeAssignments.filter((assignment) => assignment.topicId === topicId),
      );
    }

    const userIds = new Set<string>();
    for (const topic of topics) {
      userIds.add(topic.studentUserId);
      userIds.add(topic.supervisorUserId);
    }
    for (const assignment of activeAssignments) {
      userIds.add(assignment.userId);
    }

    const usersById = new Map<string, Awaited<ReturnType<UsersRepository['findById']>>>();
    await Promise.all(
      Array.from(userIds).map(async (userId) => {
        usersById.set(userId, await this.usersRepository.findById(userId));
      }),
    );

    const periodsById = new Map<string, Awaited<ReturnType<PeriodsRepository['findById']>>>();
    await Promise.all(
      Array.from(new Set(topics.map((topic) => topic.periodId))).map(
        async (periodId) => {
          periodsById.set(periodId, await this.periodsRepository.findById(periodId));
        },
      ),
    );

    const latestSubmissionByTopic = new Map<
      string,
      {
        id: string;
        driveLink?: string;
        versionNumber: number;
        uploadedAt: string;
      }
    >();
    for (const submission of allSubmissions) {
      if (!topicIds.has(submission.topicId)) {
        continue;
      }

      const candidate = {
        id: submission.id,
        driveLink: submission.driveLink,
        versionNumber: submission.versionNumber,
        uploadedAt: submission.uploadedAt,
      };
      const current = latestSubmissionByTopic.get(submission.topicId);
      if (!current) {
        latestSubmissionByTopic.set(submission.topicId, candidate);
        continue;
      }

      const candidateTime = new Date(candidate.uploadedAt).getTime();
      const currentTime = new Date(current.uploadedAt).getTime();
      if (
        candidate.versionNumber > current.versionNumber ||
        (candidate.versionNumber === current.versionNumber && candidateTime > currentTime)
      ) {
        latestSubmissionByTopic.set(submission.topicId, candidate);
      }
    }

    const submittedScores = allScores.filter(
      (score) => topicIds.has(score.topicId) && score.status === 'SUBMITTED',
    );
    const submittedScoresByTopic = new Map<string, typeof submittedScores>();
    for (const topicId of topicIdList) {
      submittedScoresByTopic.set(
        topicId,
        submittedScores.filter((score) => score.topicId === topicId),
      );
    }

    const summaryByTopic = new Map(
      allSummaries
        .filter((summary) => topicIds.has(summary.topicId))
        .map((summary) => [summary.topicId, summary] as const),
    );

    const pickLatestScore = (
      scores: typeof submittedScores,
      scorerRole: 'GVHD' | 'GVPB',
    ): number | undefined => {
      const candidates = scores.filter((score) => score.scorerRole === scorerRole);
      if (candidates.length === 0) {
        return undefined;
      }
      candidates.sort((left, right) => {
        const leftTime = new Date(left.submittedAt ?? left.updatedAt).getTime();
        const rightTime = new Date(right.submittedAt ?? right.updatedAt).getTime();
        return rightTime - leftTime;
      });
      return candidates[0].totalScore;
    };

    const roundTo2 = (value: number): number => Math.round(value * 100) / 100;

    return topics.map((topic) => {
      const dto: TopicResponseDto = this.mapToDto(topic);

      const student = usersById.get(topic.studentUserId);
      const supervisor = usersById.get(topic.supervisorUserId);
      const topicAssignments = assignmentsByTopic.get(topic.id) ?? [];

      const reviewerAssignment = topicAssignments.find(
        (assignment) => assignment.topicRole === 'GVPB',
      );
      const reviewer = reviewerAssignment
        ? usersById.get(reviewerAssignment.userId)
        : null;

      const period = periodsById.get(topic.periodId);
      const latestSubmission = latestSubmissionByTopic.get(topic.id);
      const topicScores = submittedScoresByTopic.get(topic.id) ?? [];
      const summary = summaryByTopic.get(topic.id);

      const gvhdScore = pickLatestScore(topicScores, 'GVHD');
      const gvpbScore = pickLatestScore(topicScores, 'GVPB');

      const activeCouncilAssignments = topicAssignments.filter(
        (assignment) => assignment.topicRole === 'TV_HD',
      );
      const activeCouncilUserIds = new Set(
        activeCouncilAssignments.map((assignment) => assignment.userId),
      );
      const councilScores = topicScores.filter(
        (score) =>
          score.scorerRole === 'TV_HD' && activeCouncilUserIds.has(score.scorerUserId),
      );
      const submittedCouncilUserIds = new Set(
        councilScores.map((score) => score.scorerUserId),
      );

      const councilAvgFromScores =
        councilScores.length > 0
          ? roundTo2(
            councilScores.reduce((sum, score) => sum + score.totalScore, 0) /
            councilScores.length,
          )
          : undefined;
      const hasAllCouncilScores =
        activeCouncilAssignments.length > 0 &&
        activeCouncilAssignments.every((assignment) =>
          submittedCouncilUserIds.has(assignment.userId),
        );

      const isReady =
        gvhdScore !== undefined &&
        gvpbScore !== undefined &&
        hasAllCouncilScores;
      const isSummarized = summary !== undefined;

      dto.student = {
        id: topic.studentUserId,
        fullName: student?.name ?? topic.studentUserId,
        studentId: student?.studentId,
      };

      dto.supervisor = {
        id: topic.supervisorUserId,
        fullName: supervisor?.name ?? topic.supervisorUserId,
        studentId: supervisor?.lecturerId,
      };

      if (reviewerAssignment) {
        dto.reviewer = {
          id: reviewerAssignment.userId,
          fullName: reviewer?.name ?? reviewerAssignment.userId,
          studentId: reviewer?.lecturerId,
        };
      }

      dto.period = {
        code: period?.code ?? topic.periodId,
      };

      dto.latestSubmission = {
        id: latestSubmission?.id ?? '',
        driveLink: latestSubmission?.driveLink ?? '',
        version: latestSubmission?.versionNumber ?? 0,
      };

      dto.scores = {
        gvhd: summary?.gvhdScore ?? gvhdScore ?? null,
        gvpb: summary?.gvpbScore ?? gvpbScore ?? null,
        councilAvg: summary?.councilAvgScore ?? councilAvgFromScores ?? null,
        council: summary?.councilAvgScore ?? councilAvgFromScores ?? null,
        final: summary?.finalScore ?? null,
        isReady,
        isSummarized,
        gvhdConfirmed: summary?.confirmedByGvhd ?? false,
        ctHdConfirmed: summary?.confirmedByCtHd ?? false,
        published: summary?.published ?? false,
      };

      dto.isPublished = summary?.published ?? false;

      if (currentUser.role === 'LECTURER') {
        const myCouncilAssignment = topicAssignments.find(
          (assignment) =>
            assignment.userId === currentUser.userId &&
            (assignment.topicRole === 'TV_HD' ||
              assignment.topicRole === 'TK_HD' ||
              assignment.topicRole === 'CT_HD'),
        );

        if (myCouncilAssignment) {
          const councilRole = myCouncilAssignment.topicRole;
          if (
            councilRole === 'TV_HD' ||
            councilRole === 'TK_HD' ||
            councilRole === 'CT_HD'
          ) {
            dto.councilRole = councilRole;
          }
        }
      }

      if (requestedRole === 'tv_hd') {
        dto.councilRole = 'TV_HD';
      }
      if (requestedRole === 'tk_hd') {
        dto.councilRole = 'TK_HD';
      }
      if (requestedRole === 'ct_hd') {
        dto.councilRole = 'CT_HD';
      }

      return dto;
    });
  }

  mapToDto(topic: TopicRecord): TopicResponseDto {
    return {
      id: topic.id,
      type: topic.type,
      title: topic.title,
      domain: topic.domain,
      companyName: topic.companyName,
      state: topic.state,
      studentUserId: topic.studentUserId,
      supervisorUserId: topic.supervisorUserId,
      periodId: topic.periodId,
      approvalDeadlineAt: topic.approvalDeadlineAt,
      submitStartAt: topic.submitStartAt,
      submitEndAt: topic.submitEndAt,
      reasonRejected: topic.reasonRejected,
      revisionsAllowed: topic.revisionsAllowed,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
      student: {
        id: topic.studentUserId,
        fullName: topic.studentUserId,
      },
      period: {
        code: topic.periodId,
      },
      latestSubmission: {
        id: '',
        driveLink: '',
        version: 0,
      },
      scores: {
        gvhd: null,
        gvpb: null,
        councilAvg: null,
        council: null,
        final: null,
        isReady: false,
        isSummarized: false,
        gvhdConfirmed: false,
        ctHdConfirmed: false,
        published: false,
      },
    };
  }

  private mapRevisionRoundToDto(
    round: RevisionRoundRecord,
  ): RevisionRoundResponseDto {
    return {
      id: round.id,
      topicId: round.topicId,
      roundNumber: round.roundNumber,
      status: round.status,
      startAt: round.startAt,
      endAt: round.endAt,
      requestedBy: round.requestedBy,
      reason: round.reason,
      createdAt: round.createdAt,
      updatedAt: round.updatedAt,
      // Approval fields
      gvhdApprovalStatus: round.gvhdApprovalStatus,
      gvhdApprovedAt: round.gvhdApprovedAt,
      gvhdComments: round.gvhdComments,
      ctHdApprovalStatus: round.ctHdApprovalStatus,
      ctHdApprovedAt: round.ctHdApprovedAt,
      ctHdComments: round.ctHdComments,
    };
  }

  private async ensureCanReadTopic(topic: TopicRecord, user: AuthUser): Promise<void> {
    if (user.role === 'TBM') {
      return;
    }

    if (user.role === 'STUDENT' && topic.studentUserId === user.userId) {
      return;
    }

    if (user.role === 'LECTURER') {
      const assignmentRoles = await this.getActiveAssignmentRoles(
        topic.id,
        user.userId,
      );

      if (
        assignmentRoles.has('GVHD') ||
        assignmentRoles.has('GVPB') ||
        assignmentRoles.has('CT_HD') ||
        assignmentRoles.has('TK_HD') ||
        assignmentRoles.has('TV_HD')
      ) {
        return;
      }
    }

    throw new ForbiddenException('Cannot access this topic');
  }

  private async canUserTransition(
    topic: TopicRecord,
    action: TopicAction,
    user: AuthUser,
  ): Promise<boolean> {
    const authContext = await this.getTransitionAuthorizationContext(topic, user);

    switch (action) {
      case 'SUBMIT_TO_GV':
        return authContext.isStudentOwner;

      case 'APPROVE':
      case 'START_PROGRESS':
      case 'MOVE_TO_GRADING':
        return authContext.isSupervisor;

      case 'REJECT':
        if (topic.state === 'PENDING_CONFIRM') {
          return this.canRejectPendingConfirm(authContext);
        }
        return authContext.isSupervisor;

      case 'REQUEST_CONFIRM':
        // Pre-defense request must be confirmed by assigned supervisor.
        return authContext.isSupervisor;

      case 'CONFIRM_DEFENSE':
        // Assigned reviewer can confirm defense readiness; TBM can override.
        return authContext.assignmentRoles.has('GVPB') || authContext.isTbm;

      case 'START_SCORING':
        return (
          authContext.assignmentRoles.has('GVHD') ||
          authContext.assignmentRoles.has('GVPB') ||
          authContext.assignmentRoles.has('CT_HD') ||
          authContext.assignmentRoles.has('TK_HD') ||
          authContext.assignmentRoles.has('TV_HD')
        );

      case 'COMPLETE':
        // BCTT completes by assigned supervisor; KLTN completes by assigned CT_HD.
        if (topic.type === 'BCTT') {
          return authContext.isSupervisor;
        }
        return authContext.assignmentRoles.has('CT_HD');

      case 'CANCEL':
        if (authContext.isStudentOwner || authContext.isSupervisor) {
          return true;
        }

        if (!authContext.isTbm) {
          return false;
        }

        if (topic.state === 'PENDING_GV') {
          return false;
        }

        if (topic.type === 'KLTN' && topic.state === 'IN_PROGRESS') {
          return false;
        }

        return true;

      default:
        return false;
    }
  }

  private async getTransitionAuthorizationContext(
    topic: TopicRecord,
    user: AuthUser,
  ): Promise<TransitionAuthorizationContext> {
    const assignmentRoles = await this.getActiveAssignmentRoles(
      topic.id,
      user.userId,
    );

    return {
      isStudentOwner: user.role === 'STUDENT' && topic.studentUserId === user.userId,
      isSupervisor: assignmentRoles.has('GVHD'),
      isTbm: user.role === 'TBM',
      assignmentRoles,
    };
  }

  private async getActiveAssignmentRoles(
    topicId: string,
    userId: string,
  ): Promise<Set<TopicRole>> {
    const roles = new Set<TopicRole>();
    if (!this.assignmentsRepository) {
      return roles;
    }

    const assignments = await this.assignmentsRepository.findAll();
    for (const assignment of assignments) {
      if (
        assignment.topicId === topicId &&
        assignment.userId === userId &&
        assignment.status === 'ACTIVE'
      ) {
        roles.add(assignment.topicRole);
      }
    }

    return roles;
  }

  private canRejectPendingConfirm(
    context: TransitionAuthorizationContext,
  ): boolean {
    if (context.isTbm) {
      return true;
    }

    return (
      context.assignmentRoles.has('GVPB') ||
      context.assignmentRoles.has('CT_HD') ||
      context.assignmentRoles.has('TK_HD') ||
      context.assignmentRoles.has('TV_HD')
    );
  }

  private async runInTopicTransitionQueue<T>(
    topicId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.topicTransitionQueue.get(topicId) ?? Promise.resolve();
    let releaseCurrent: () => void = () => undefined;
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });

    const queueTail = previous
      .catch(() => undefined)
      .then(() => current);

    this.topicTransitionQueue.set(topicId, queueTail);

    await previous.catch(() => undefined);

    try {
      return await operation();
    } finally {
      releaseCurrent();
      if (this.topicTransitionQueue.get(topicId) === queueTail) {
        this.topicTransitionQueue.delete(topicId);
      }
    }
  }

  private buildStaleWriteConflict(
    topicId: string,
    expectedState: TopicState,
    actualState: TopicState,
  ): ConflictException {
    return new ConflictException({
      error: 'STALE_WRITE',
      message: 'Topic state changed. Refresh topic state and retry.',
      topicId,
      expectedState,
      actualState,
      retryable: true,
    });
  }

  private async notifyIfAvailable(params: {
    receiverUserId: string;
    type:
    | 'TOPIC_PENDING'
    | 'TOPIC_APPROVED'
    | 'TOPIC_REJECTED'
    | 'DEADLINE_SET'
    | 'REVISION_ROUND_OPENED'
    | 'REVISION_ROUND_CLOSED';
    context: Record<string, string>;
    topicId?: string;
  }): Promise<void> {
    if (!this.notificationsService) {
      return;
    }

    await this.notificationsService.create(params);
  }

  private async auditIfAvailable(params: {
    action:
    | 'TOPIC_CREATED'
    | 'TOPIC_APPROVED'
    | 'TOPIC_REJECTED'
    | 'TOPIC_TRANSITION'
    | 'DEADLINE_SET'
    | 'DEADLINE_EXTENDED'
    | 'REVISION_ROUND_OPENED'
    | 'REVISION_ROUND_CLOSED';
    actorId: string;
    actorRole: string;
    topicId?: string;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.auditService) {
      return;
    }

    await this.auditService.log(params);
  }

  private async validateSupervisor(
    supervisorUserId: string,
    ensureHasAvailableQuota = false,
  ): Promise<void> {
    const supervisor = await this.usersRepository.findById(supervisorUserId);

    if (!supervisor) {
      throw new BadRequestException('Supervisor not found');
    }

    if (supervisor.role !== 'LECTURER') {
      throw new BadRequestException('Supervisor must be a lecturer account');
    }

    if (supervisor.isActive === false) {
      throw new BadRequestException('Supervisor account is inactive');
    }

    if (ensureHasAvailableQuota) {
      const totalQuota = supervisor.totalQuota ?? 0;
      const quotaUsed = supervisor.quotaUsed ?? 0;
      if (totalQuota - quotaUsed <= 0) {
        throw new BadRequestException('Selected supervisor has no available quota');
      }
    }
  }

  private async consumeSupervisorQuota(supervisorUserId: string): Promise<void> {
    const supervisor = await this.usersRepository.findById(supervisorUserId);
    if (!supervisor) {
      throw new BadRequestException('Supervisor not found');
    }

    const totalQuota = supervisor.totalQuota ?? 0;
    const quotaUsed = supervisor.quotaUsed ?? 0;
    if (totalQuota - quotaUsed <= 0) {
      throw new BadRequestException('Selected supervisor has no available quota');
    }

    supervisor.quotaUsed = quotaUsed + 1;
    await this.usersRepository.update(supervisor.id, supervisor);
  }

  private async releaseSupervisorQuota(supervisorUserId: string): Promise<void> {
    const supervisor = await this.usersRepository.findById(supervisorUserId);
    if (!supervisor) {
      return;
    }

    const quotaUsed = supervisor.quotaUsed ?? 0;
    if (quotaUsed <= 0) {
      return;
    }

    supervisor.quotaUsed = quotaUsed - 1;
    await this.usersRepository.update(supervisor.id, supervisor);
  }

  private shouldReleaseQuotaOnCancel(fromState: TopicState): boolean {
    return fromState !== 'PENDING_GV' && fromState !== 'CANCELLED';
  }

  private isCurrentDateWithinPeriod(openDate: string, closeDate: string): boolean {
    const today = this.getCurrentLocalDate();
    const normalizedOpenDate = this.normalizeDateOnly(openDate);
    const normalizedCloseDate = this.normalizeDateOnly(closeDate);

    if (!normalizedOpenDate || !normalizedCloseDate) {
      this.logger.warn(
        `[isCurrentDateWithinPeriod] Could not normalize dates: openDate='${openDate}' closeDate='${closeDate}'`,
      );
      return false;
    }

    const inWindow = today >= normalizedOpenDate && today <= normalizedCloseDate;
    this.logger.debug(
      `[isCurrentDateWithinPeriod] today=${today} in [${normalizedOpenDate}, ${normalizedCloseDate}] => ${inWindow}`,
    );
    return inWindow;
  }

  private getCurrentLocalDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private normalizeDateOnly(value?: string): string | null {
    if (!value) {
      return null;
    }

    const datePart = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return null;
    }

    return datePart;
  }

  /**
   * GVHD approves revision submission
   */
  async approveRevisionByGvhd(
    topicId: string,
    roundId: string,
    comments: string | undefined,
    currentUser: AuthUser,
  ): Promise<{ roundId: string; role: 'GVHD'; decision: 'APPROVED'; approvedAt: string; comments?: string }> {
    if (currentUser.role !== 'LECTURER') {
      throw new ForbiddenException('Only lecturers can approve revisions');
    }

    const topic = await this.topicsRepository.findById(topicId);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    // Check if user is GVHD for this topic
    const assignmentRoles = await this.getActiveAssignmentRoles(topicId, currentUser.userId);
    if (!assignmentRoles.has('GVHD')) {
      throw new ForbiddenException('Only the assigned supervisor (GVHD) can approve revisions');
    }

    const round = await this.revisionRoundsRepository.findById(roundId);
    if (!round || round.topicId !== topicId) {
      throw new NotFoundException('Revision round not found');
    }

    if (round.gvhdApprovalStatus === 'APPROVED') {
      throw new ConflictException('GVHD already approved this revision');
    }

    const now = new Date().toISOString();
    round.gvhdApprovalStatus = 'APPROVED';
    round.gvhdApprovedAt = now;
    round.gvhdApprovedBy = currentUser.userId;
    round.gvhdComments = comments?.trim() || undefined;
    round.updatedAt = now;

    await this.revisionRoundsRepository.update(round.id, round);

    await this.auditIfAvailable({
      action: 'REVISION_ROUND_CLOSED', // Reuse for audit
      actorId: currentUser.userId,
      actorRole: currentUser.role,
      topicId,
      detail: {
        revisionRoundId: round.id,
        approvalRole: 'GVHD',
        decision: 'APPROVED',
      },
    });

    return {
      roundId: round.id,
      role: 'GVHD',
      decision: 'APPROVED',
      approvedAt: now,
      comments: round.gvhdComments,
    };
  }

  /**
   * CT_HD approves revision submission (after GVHD approved)
   */
  async approveRevisionByCtHd(
    topicId: string,
    roundId: string,
    comments: string | undefined,
    currentUser: AuthUser,
  ): Promise<{ roundId: string; role: 'CT_HD'; decision: 'APPROVED'; approvedAt: string; comments?: string }> {
    if (currentUser.role !== 'LECTURER') {
      throw new ForbiddenException('Only lecturers can approve revisions');
    }

    const topic = await this.topicsRepository.findById(topicId);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    // Check if user is CT_HD for this topic
    const assignmentRoles = await this.getActiveAssignmentRoles(topicId, currentUser.userId);
    if (!assignmentRoles.has('CT_HD')) {
      throw new ForbiddenException('Only the council chairman (CT_HD) can approve revisions');
    }

    const round = await this.revisionRoundsRepository.findById(roundId);
    if (!round || round.topicId !== topicId) {
      throw new NotFoundException('Revision round not found');
    }

    // CT_HD can only approve AFTER GVHD approved
    if (round.gvhdApprovalStatus !== 'APPROVED') {
      throw new BadRequestException('GVHD must approve first before CT_HD can approve');
    }

    if (round.ctHdApprovalStatus === 'APPROVED') {
      throw new ConflictException('CT_HD already approved this revision');
    }

    const now = new Date().toISOString();
    round.ctHdApprovalStatus = 'APPROVED';
    round.ctHdApprovedAt = now;
    round.ctHdApprovedBy = currentUser.userId;
    round.ctHdComments = comments?.trim() || undefined;
    round.updatedAt = now;
    round.status = 'CLOSED'; // Close round when fully approved

    await this.revisionRoundsRepository.update(round.id, round);

    // Notify student
    await this.notifyIfAvailable({
      receiverUserId: topic.studentUserId,
      type: 'REVISION_ROUND_CLOSED',
      topicId,
      context: {
        topicTitle: topic.title,
        roundNumber: String(round.roundNumber),
      },
    });

    await this.auditIfAvailable({
      action: 'REVISION_ROUND_CLOSED',
      actorId: currentUser.userId,
      actorRole: currentUser.role,
      topicId,
      detail: {
        revisionRoundId: round.id,
        approvalRole: 'CT_HD',
        decision: 'APPROVED',
        fullyApproved: true,
      },
    });

    return {
      roundId: round.id,
      role: 'CT_HD',
      decision: 'APPROVED',
      approvedAt: now,
      comments: round.ctHdComments,
    };
  }

  /**
   * GVHD or CT_HD requests changes (rejection)
   */
  async rejectRevision(
    topicId: string,
    roundId: string,
    reason: string,
    approverRole: 'GVHD' | 'CT_HD',
    currentUser: AuthUser,
  ): Promise<{ roundId: string; role: 'GVHD' | 'CT_HD'; decision: 'REJECTED'; rejectedAt: string; reason: string }> {
    if (currentUser.role !== 'LECTURER') {
      throw new ForbiddenException('Only lecturers can reject revisions');
    }

    const topic = await this.topicsRepository.findById(topicId);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    // Check if user has the appropriate role
    const assignmentRoles = await this.getActiveAssignmentRoles(topicId, currentUser.userId);
    if (approverRole === 'GVHD' && !assignmentRoles.has('GVHD')) {
      throw new ForbiddenException('Only the assigned supervisor (GVHD) can reject as GVHD');
    }
    if (approverRole === 'CT_HD' && !assignmentRoles.has('CT_HD')) {
      throw new ForbiddenException('Only the council chairman (CT_HD) can reject as CT_HD');
    }

    const round = await this.revisionRoundsRepository.findById(roundId);
    if (!round || round.topicId !== topicId) {
      throw new NotFoundException('Revision round not found');
    }

    const now = new Date().toISOString();

    if (approverRole === 'GVHD') {
      round.gvhdApprovalStatus = 'REJECTED';
      round.gvhdApprovedAt = now;
      round.gvhdApprovedBy = currentUser.userId;
      round.gvhdComments = reason.trim();
    } else {
      round.ctHdApprovalStatus = 'REJECTED';
      round.ctHdApprovedAt = now;
      round.ctHdApprovedBy = currentUser.userId;
      round.ctHdComments = reason.trim();
    }
    round.updatedAt = now;

    await this.revisionRoundsRepository.update(round.id, round);

    // Notify student about rejection
    await this.notifyIfAvailable({
      receiverUserId: topic.studentUserId,
      type: 'REVISION_ROUND_CLOSED',
      topicId,
      context: {
        topicTitle: topic.title,
        roundNumber: String(round.roundNumber),
      },
    });

    await this.auditIfAvailable({
      action: 'REVISION_ROUND_CLOSED',
      actorId: currentUser.userId,
      actorRole: currentUser.role,
      topicId,
      detail: {
        revisionRoundId: round.id,
        approvalRole: approverRole,
        decision: 'REJECTED',
        reason: reason.trim(),
      },
    });

    return {
      roundId: round.id,
      role: approverRole,
      decision: 'REJECTED',
      rejectedAt: now,
      reason: reason.trim(),
    };
  }

  /**
   * Get revision status for TBM dashboard
   */
  async getRevisionStatus(
    periodId?: string,
    currentUser?: AuthUser,
  ): Promise<Array<{
    topicId: string;
    topicTitle: string;
    studentName: string;
    supervisorName: string;
    roundNumber: number;
    roundStatus: string;
    gvhdApprovalStatus?: string;
    gvhdApprovedAt?: string;
    ctHdApprovalStatus?: string;
    ctHdApprovedAt?: string;
  }>> {
    if (currentUser?.role !== 'TBM') {
      throw new ForbiddenException('Only TBM can view revision status');
    }

    const allRounds = await this.revisionRoundsRepository.findAll();
    const topics = await this.topicsRepository.findAll();
    const users = await this.usersRepository.findAll();

    // Filter by period if specified
    let filteredTopics = topics;
    if (periodId) {
      filteredTopics = topics.filter(t => t.periodId === periodId);
    }

    const topicMap = new Map(filteredTopics.map(t => [t.id, t]));
    const userMap = new Map(users.map(u => [u.id, u]));

    // Get latest round for each topic
    const topicRounds = new Map<string, typeof allRounds[0]>();
    for (const round of allRounds) {
      const existing = topicRounds.get(round.topicId);
      if (!existing || round.roundNumber > existing.roundNumber) {
        topicRounds.set(round.topicId, round);
      }
    }

    const result: Array<{
      topicId: string;
      topicTitle: string;
      studentName: string;
      supervisorName: string;
      roundNumber: number;
      roundStatus: string;
      gvhdApprovalStatus?: string;
      gvhdApprovedAt?: string;
      ctHdApprovalStatus?: string;
      ctHdApprovedAt?: string;
    }> = [];

    for (const [topicId, round] of topicRounds) {
      const topic = topicMap.get(topicId);
      if (!topic) continue;

      const student = userMap.get(topic.studentUserId);
      const supervisor = userMap.get(topic.supervisorUserId);

      result.push({
        topicId,
        topicTitle: topic.title,
        studentName: student?.name ?? topic.studentUserId,
        supervisorName: supervisor?.name ?? topic.supervisorUserId,
        roundNumber: round.roundNumber,
        roundStatus: round.status,
        gvhdApprovalStatus: round.gvhdApprovalStatus,
        gvhdApprovedAt: round.gvhdApprovedAt,
        ctHdApprovalStatus: round.ctHdApprovalStatus,
        ctHdApprovedAt: round.ctHdApprovedAt,
      });
    }

    return result;
  }
}
