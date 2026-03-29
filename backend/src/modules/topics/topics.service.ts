import {
  Injectable,
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
import { AuthUser } from '../../common/types';
import {
  PeriodsRepository,
  TopicsRepository,
  UsersRepository,
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

@Injectable()
export class TopicsService {
  private readonly terminalStates: TopicState[] = ['COMPLETED', 'CANCELLED'];

  constructor(
    private readonly topicsRepository: TopicsRepository,
    private readonly periodsRepository: PeriodsRepository,
    private readonly usersRepository: UsersRepository,
    @Optional()
    private readonly notificationsService?: NotificationsService,
    @Optional()
    private readonly auditService?: AuditService,
  ) {}

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

    // Filter by role context
    if (query.role === 'student') {
      topics = topics.filter((t) => t.studentUserId === currentUser.userId);
    } else if (query.role === 'supervisor') {
      topics = topics.filter((t) => t.supervisorUserId === currentUser.userId);
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

    return {
      data: paginatedTopics.map((t) => this.mapToDto(t)),
      pagination: { page, size, total },
    };
  }

  async findById(id: string): Promise<TopicRecord | null> {
    return this.topicsRepository.findById(id);
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
      throw new BadRequestException('Period not found');
    }

    if (period.type !== dto.type) {
      throw new BadRequestException(
        `Period ${dto.periodId} does not accept topic type ${dto.type}`,
      );
    }

    if (period.status !== 'OPEN') {
      throw new ConflictException('Registration period is not open');
    }

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

    // KLTN eligibility: BCTT must be completed, score > 5, and credits threshold reached.
    if (dto.type === 'KLTN') {
      const completedBctt = await this.topicsRepository.findFirst(
        (t) =>
          t.studentUserId === currentUser.userId &&
          t.type === 'BCTT' &&
          t.state === 'COMPLETED',
      );
      if (!completedBctt) {
        throw new BadRequestException(
          'You must complete BCTT before starting KLTN',
        );
      }

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

      const earnedCredits = studentProgress.earnedCredits ?? 0;
      const requiredCredits = studentProgress.requiredCredits ?? 0;
      if (earnedCredits < requiredCredits) {
        throw new BadRequestException(
          'KLTN eligibility requires minimum earned credits threshold',
        );
      }
    }

    const now = new Date().toISOString();
    const approvalDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

    const newTopic: TopicRecord = {
      id: `tp_${crypto.randomBytes(4).toString('hex')}`,
      type: dto.type,
      title: dto.title,
      domain: dto.domain,
      companyName: dto.companyName,
      state: 'PENDING_GV',
      studentUserId: currentUser.userId,
      supervisorUserId: dto.supervisorUserId,
      periodId: dto.periodId,
      approvalDeadlineAt: approvalDeadline.toISOString(),
      createdAt: now,
      updatedAt: now,
    };

    await this.topicsRepository.create(newTopic);

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
    if (dto.supervisorUserId) topic.supervisorUserId = dto.supervisorUserId;
    topic.updatedAt = new Date().toISOString();

    await this.topicsRepository.update(topic.id, topic);

    return { updated: true };
  }

  async approve(
    id: string,
    note: string | undefined,
    currentUser: AuthUser,
  ): Promise<{ state: TopicState }> {
    const topic = await this.topicsRepository.findById(id);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    // Only supervisor (GVHD) can approve
    if (
      currentUser.role !== 'TBM' &&
      topic.supervisorUserId !== currentUser.userId
    ) {
      throw new ForbiddenException('Only the supervisor can approve this topic');
    }

    // Check state
    if (topic.state !== 'PENDING_GV') {
      throw new ConflictException(
        `Cannot approve topic in state: ${topic.state}`,
      );
    }

    topic.state = 'CONFIRMED';
    topic.updatedAt = new Date().toISOString();
    await this.topicsRepository.update(topic.id, topic);

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
  }

  async reject(
    id: string,
    reason: string | undefined,
    currentUser: AuthUser,
  ): Promise<{ state: TopicState }> {
    const topic = await this.topicsRepository.findById(id);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    // Only supervisor (GVHD) can reject
    if (
      currentUser.role !== 'TBM' &&
      topic.supervisorUserId !== currentUser.userId
    ) {
      throw new ForbiddenException('Only the supervisor can reject this topic');
    }

    // Check state
    if (topic.state !== 'PENDING_GV') {
      throw new ConflictException(
        `Cannot reject topic in state: ${topic.state}`,
      );
    }

    topic.state = 'CANCELLED';
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
      },
    });

    return { state: topic.state };
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
  ): Promise<{ fromState: TopicState; toState: TopicState }> {
    const topic = await this.topicsRepository.findById(id);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }
    const fromState = topic.state;
    const toState = ACTION_TO_STATE[action];

    // Check if transition is valid
    if (!isValidTransition(topic.type, fromState, toState)) {
      throw new ConflictException(
        `Invalid transition from ${fromState} to ${toState} for ${topic.type}`,
      );
    }

    // Check authorization based on action
    const canTransition = this.canUserTransition(topic, action, currentUser);
    if (!canTransition) {
      throw new ForbiddenException(
        `You are not authorized to perform action: ${action}`,
      );
    }

    topic.state = toState;
    topic.updatedAt = new Date().toISOString();
    await this.topicsRepository.update(topic.id, topic);

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
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
    };
  }

  private canUserTransition(
    topic: TopicRecord,
    action: TopicAction,
    user: AuthUser,
  ): boolean {
    // TBM can do all transitions
    if (user.role === 'TBM') return true;

    switch (action) {
      case 'SUBMIT_TO_GV':
        // Only student owner
        return topic.studentUserId === user.userId;

      case 'APPROVE':
      case 'REJECT':
        // Only supervisor
        return topic.supervisorUserId === user.userId;

      case 'START_PROGRESS':
      case 'MOVE_TO_GRADING':
      case 'REQUEST_CONFIRM':
        // Supervisor or student
        return (
          topic.supervisorUserId === user.userId ||
          topic.studentUserId === user.userId
        );

      case 'CONFIRM_DEFENSE':
      case 'START_SCORING':
      case 'COMPLETE':
        // Only supervisor or TBM
        return topic.supervisorUserId === user.userId;

      case 'CANCEL':
        // Student owner, supervisor, or TBM
        return (
          topic.studentUserId === user.userId ||
          topic.supervisorUserId === user.userId
        );

      default:
        return false;
    }
  }

  private async notifyIfAvailable(params: {
    receiverUserId: string;
    type:
      | 'TOPIC_PENDING'
      | 'TOPIC_APPROVED'
      | 'TOPIC_REJECTED'
      | 'DEADLINE_SET';
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
      | 'DEADLINE_EXTENDED';
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
}
