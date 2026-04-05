import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  ScheduleResponseDto,
} from './dto';
import { AuthUser } from '../../common/types';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { SchedulesRepository, TopicsRepository, AssignmentsRepository } from '../../infrastructure/google-sheets';

export interface ScheduleRecord {
  id: string;
  topicId: string;
  defenseAt: string;
  locationType: 'ONLINE' | 'OFFLINE';
  locationDetail?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly schedulesRepository: SchedulesRepository,
    private readonly topicsRepository: TopicsRepository,
    private readonly assignmentsRepository: AssignmentsRepository,
  ) {}

  async findByTopicId(topicId: string): Promise<ScheduleResponseDto | null> {
    this.logger.log(`[findByTopicId:start] topicId=${topicId}`);
    const schedule = await this.schedulesRepository.findFirst(
      (s) => s.topicId === topicId,
    );
    if (!schedule) {
      this.logger.warn(`[findByTopicId:notFound] topicId=${topicId}`);
      return null;
    }

    this.logger.log(`[findByTopicId:success] topicId=${topicId} scheduleId=${schedule.id}`);
    return this.mapToDto(schedule);
  }

  async create(
    topicId: string,
    dto: CreateScheduleDto,
    user: AuthUser,
  ): Promise<ScheduleResponseDto> {
    this.logger.log(
      `[create:start] topicId=${topicId} defenseAt=${dto.defenseAt} locationType=${dto.locationType} actorUserId=${user.userId} actorRole=${user.role}`,
    );
    if (user.role !== 'TBM') {
      this.logger.warn(
        `[create:forbidden] topicId=${topicId} actorUserId=${user.userId} actorRole=${user.role}`,
      );
      throw new ForbiddenException('Only TBM can create defense schedules');
    }

    const topic = await this.topicsRepository.findById(topicId);
    if (!topic) {
      this.logger.warn(`[create:notFound] topicId=${topicId}`);
      throw new NotFoundException(`Topic ${topicId} not found`);
    }

    if (!['DEFENSE', 'SCORING', 'PENDING_CONFIRM'].includes(topic.state)) {
      this.logger.warn(
        `[create:conflict] topicId=${topicId} state=${topic.state} reason=INVALID_TOPIC_STATE`,
      );
      throw new ConflictException(
        `Cannot schedule defense for topic in state: ${topic.state}`,
      );
    }

    const existing = await this.schedulesRepository.findFirst(
      (s) => s.topicId === topicId,
    );
    if (existing) {
      this.logger.warn(
        `[create:conflict] topicId=${topicId} reason=SCHEDULE_ALREADY_EXISTS scheduleId=${existing.id}`,
      );
      throw new ConflictException(
        'Defense schedule already exists. Use PATCH to update.',
      );
    }

    // DEMO MODE: Skip future-time validation for easy demo
    // TODO(DEMO): Restore this validation before production deployment
    // if (new Date(dto.defenseAt) <= new Date()) {
    //   this.logger.warn(
    //     `[create:conflict] topicId=${topicId} reason=PAST_DEFENSE_DATE defenseAt=${dto.defenseAt}`,
    //   );
    //   throw new ConflictException('Defense date must be in the future');
    // }

    const now = new Date().toISOString();
    const schedule: ScheduleRecord = {
      id: `sch_${crypto.randomBytes(6).toString('hex')}`,
      topicId,
      defenseAt: dto.defenseAt,
      locationType: dto.locationType,
      locationDetail: dto.locationDetail,
      notes: dto.notes,
      createdBy: user.userId,
      createdAt: now,
      updatedAt: now,
    };

    await this.schedulesRepository.create(schedule);

    await this.auditService.log({
      action: 'SCHEDULE_CREATED',
      actorId: user.userId,
      actorRole: user.role,
      topicId,
      detail: {
        scheduleId: schedule.id,
        defenseAt: schedule.defenseAt,
        locationType: schedule.locationType,
        locationDetail: schedule.locationDetail ?? '',
      },
    });

    // Notify student about defense schedule
    await this.notificationsService.create({
      receiverUserId: topic.studentUserId,
      type: 'GENERAL',
      topicId,
      context: {
        message: `Lịch bảo vệ đề tài đã được xếp vào ${new Date(dto.defenseAt).toLocaleString('vi-VN')}. Địa điểm: ${dto.locationDetail || dto.locationType}`,
      },
    });

    // Notify supervisor (GVHD)
    await this.notificationsService.create({
      receiverUserId: topic.supervisorUserId,
      type: 'GENERAL',
      topicId,
      context: {
        message: `Lịch bảo vệ đề tài đã được xếp vào ${new Date(dto.defenseAt).toLocaleString('vi-VN')}`,
      },
    });

    // Notify tất cả thành viên hội đồng được phân công (GVPB, CT_HD, TK_HD, TV_HD)
    const assignments = await this.assignmentsRepository.findAll();
    const notifiedUsers = new Set([topic.studentUserId, topic.supervisorUserId]);
    const councilAssignments = assignments.filter(
      (a) => a.topicId === topicId && a.status === 'ACTIVE' && !notifiedUsers.has(a.userId),
    );
    for (const a of councilAssignments) {
      await this.notificationsService.create({
        receiverUserId: a.userId,
        type: 'GENERAL',
        topicId,
        context: {
          message: `Lịch bảo vệ đề tài đã được xếp vào ${new Date(dto.defenseAt).toLocaleString('vi-VN')}. Địa điểm: ${dto.locationDetail || dto.locationType}`,
        },
      });
      notifiedUsers.add(a.userId);
    }

    this.logger.log(
      `[create:success] topicId=${topicId} scheduleId=${schedule.id} notifiedCount=${notifiedUsers.size}`,
    );

    return this.mapToDto(schedule);
  }

  async update(
    topicId: string,
    dto: UpdateScheduleDto,
    user: AuthUser,
  ): Promise<ScheduleResponseDto> {
    this.logger.log(
      `[update:start] topicId=${topicId} actorUserId=${user.userId} actorRole=${user.role} hasDefenseAt=${Boolean(dto.defenseAt)} hasLocationType=${Boolean(dto.locationType)} hasLocationDetail=${dto.locationDetail !== undefined} hasNotes=${dto.notes !== undefined}`,
    );
    if (user.role !== 'TBM') {
      this.logger.warn(
        `[update:forbidden] topicId=${topicId} actorUserId=${user.userId} actorRole=${user.role}`,
      );
      throw new ForbiddenException('Only TBM can update defense schedules');
    }

    const schedule = await this.schedulesRepository.findFirst(
      (s) => s.topicId === topicId,
    );
    if (!schedule) {
      this.logger.warn(`[update:notFound] topicId=${topicId} reason=SCHEDULE_NOT_FOUND`);
      throw new NotFoundException(
        `No schedule found for topic ${topicId}. Create one first.`,
      );
    }
    const topic = await this.topicsRepository.findById(topicId);

    if (dto.defenseAt) {
      // DEMO MODE: Skip future-time validation for easy demo
      // TODO(DEMO): Restore this validation before production deployment
      // if (new Date(dto.defenseAt) <= new Date()) {
      //   this.logger.warn(
      //     `[update:conflict] topicId=${topicId} scheduleId=${schedule.id} reason=PAST_DEFENSE_DATE defenseAt=${dto.defenseAt}`,
      //   );
      //   throw new ConflictException('Defense date must be in the future');
      // }
      schedule.defenseAt = dto.defenseAt;
    }
    if (dto.locationType) schedule.locationType = dto.locationType;
    if (dto.locationDetail !== undefined)
      schedule.locationDetail = dto.locationDetail;
    if (dto.notes !== undefined) schedule.notes = dto.notes;
    schedule.updatedAt = new Date().toISOString();
    await this.schedulesRepository.update(schedule.id, schedule);

    await this.auditService.log({
      action: 'SCHEDULE_UPDATED',
      actorId: user.userId,
      actorRole: user.role,
      topicId,
      detail: {
        scheduleId: schedule.id,
        changes: dto as Record<string, unknown>,
      },
    });

    // Notify về schedule change — gửi cho tất cả người liên quan
    if (topic) {
      const changeMsg = `Lịch bảo vệ đề tài đã được cập nhật. Ngày mới: ${new Date(schedule.defenseAt).toLocaleString('vi-VN')}`;
      await this.notificationsService.create({
        receiverUserId: topic.studentUserId,
        type: 'GENERAL',
        topicId,
        context: { message: changeMsg },
      });

      // Notify GVHD
      await this.notificationsService.create({
        receiverUserId: topic.supervisorUserId,
        type: 'GENERAL',
        topicId,
        context: { message: changeMsg },
      });

      // Notify các thành viên hội đồng
      const updateAssignments = await this.assignmentsRepository.findAll();
      const notifiedOnUpdate = new Set([topic.studentUserId, topic.supervisorUserId]);
      const councilOnUpdate = updateAssignments.filter(
        (a) => a.topicId === topicId && a.status === 'ACTIVE' && !notifiedOnUpdate.has(a.userId),
      );
      for (const a of councilOnUpdate) {
        await this.notificationsService.create({
          receiverUserId: a.userId,
          type: 'GENERAL',
          topicId,
          context: { message: changeMsg },
        });
        notifiedOnUpdate.add(a.userId);
      }

      this.logger.log(
        `[update:success] topicId=${topicId} scheduleId=${schedule.id} notifiedCount=${notifiedOnUpdate.size}`,
      );
    }

    return this.mapToDto(schedule);
  }

  private mapToDto(record: ScheduleRecord): ScheduleResponseDto {
    return {
      id: record.id,
      topicId: record.topicId,
      defenseAt: record.defenseAt,
      locationType: record.locationType,
      locationDetail: record.locationDetail,
      notes: record.notes,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
