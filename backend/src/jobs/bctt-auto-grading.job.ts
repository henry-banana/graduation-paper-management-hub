import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  TopicsRepository,
  AssignmentsRepository,
} from '../infrastructure/google-sheets';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { AuditService } from '../modules/audit/audit.service';

/**
 * Automatically moves BCTT topics from IN_PROGRESS to GRADING
 * when submission deadline has passed.
 *
 * Runs every hour.
 */
@Injectable()
export class BcttAutoGradingJob {
  private readonly logger = new Logger(BcttAutoGradingJob.name);

  constructor(
    private readonly topicsRepository: TopicsRepository,
    @Optional()
    private readonly assignmentsRepository?: AssignmentsRepository,
    @Optional()
    private readonly notificationsService?: NotificationsService,
    @Optional()
    private readonly auditService?: AuditService,
  ) {}

  @Cron('15 * * * *')
  async handle(): Promise<void> {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const topics = await this.topicsRepository.findAll();

    const candidates = topics.filter(
      (t) =>
        t.type === 'BCTT' &&
        t.state === 'IN_PROGRESS' &&
        t.submitEndAt &&
        !Number.isNaN(new Date(t.submitEndAt).getTime()) &&
        new Date(t.submitEndAt).getTime() < now,
    );

    if (candidates.length === 0) {
      return;
    }

    for (const topic of candidates) {
      topic.state = 'GRADING';
      topic.updatedAt = nowIso;
      await this.topicsRepository.update(topic.id, topic);

      await this.notifyIfAvailable({
        receiverUserId: topic.studentUserId,
        type: 'DEADLINE_OVERDUE',
        topicId: topic.id,
        context: {
          topicTitle: topic.title,
          deadline: topic.submitEndAt ?? '',
        },
      });

      // Notify supervisor if assigned
      if (topic.supervisorUserId) {
        await this.notifyIfAvailable({
          receiverUserId: topic.supervisorUserId,
          type: 'GENERAL',
          topicId: topic.id,
          context: {
            message: `Đề tài "${topic.title}" đã qua hạn nộp BCTT và được chuyển sang chấm điểm.`,
          },
        });
      }

      await this.auditIfAvailable({
        action: 'TOPIC_TRANSITION',
        actorId: 'SYSTEM',
        actorRole: 'SYSTEM',
        topicId: topic.id,
        detail: {
          fromState: 'IN_PROGRESS',
          submitEndAt: topic.submitEndAt,
          toState: 'GRADING',
          source: 'BCTT_AUTO_GRADING_CRON',
        },
      });
    }

    this.logger.log(
      `Auto-moved ${candidates.length} BCTT topic(s) to GRADING after deadline`,
    );
  }

  private async notifyIfAvailable(params: {
    receiverUserId: string;
    type: 'DEADLINE_OVERDUE' | 'GENERAL';
    topicId?: string;
    context: Record<string, string>;
  }): Promise<void> {
    if (!this.notificationsService) return;
    await this.notificationsService.create(params);
  }

  private async auditIfAvailable(params: {
    action: 'TOPIC_TRANSITION';
    actorId: string;
    actorRole: string;
    topicId?: string;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.auditService) return;
    await this.auditService.log(params);
  }
}
