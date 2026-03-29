import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TopicsRepository } from '../infrastructure/google-sheets';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { AuditService } from '../modules/audit/audit.service';

@Injectable()
export class TopicTimeoutJob {
  private readonly logger = new Logger(TopicTimeoutJob.name);

  constructor(
    private readonly topicsRepository: TopicsRepository,
    @Optional()
    private readonly notificationsService?: NotificationsService,
    @Optional()
    private readonly auditService?: AuditService,
  ) {}

  @Cron('0 * * * *')
  async handleTimeoutPendingGvTopics(): Promise<void> {
    const now = new Date();
    const nowIso = now.toISOString();

    const topics = await this.topicsRepository.findAll();
    const overduePendingTopics = topics.filter((topic) => {
      if (topic.state !== 'PENDING_GV' || !topic.approvalDeadlineAt) {
        return false;
      }

      const deadline = new Date(topic.approvalDeadlineAt);
      return !Number.isNaN(deadline.getTime()) && deadline <= now;
    });

    if (overduePendingTopics.length === 0) {
      return;
    }

    for (const topic of overduePendingTopics) {
      const previousState = topic.state;
      topic.state = 'CANCELLED';
      topic.updatedAt = nowIso;
      await this.topicsRepository.update(topic.id, topic);

      await this.notifyIfAvailable({
        receiverUserId: topic.studentUserId,
        type: 'TOPIC_REJECTED',
        topicId: topic.id,
        context: {
          topicTitle: topic.title,
          reason: 'He thong tu dong huy vi qua han duyet GVHD',
        },
      });

      await this.notifyIfAvailable({
        receiverUserId: topic.supervisorUserId,
        type: 'GENERAL',
        topicId: topic.id,
        context: {
          message: `De tai \"${topic.title}\" da tu dong huy do qua han duyet.`,
        },
      });

      await this.auditIfAvailable({
        action: 'TOPIC_AUTO_CANCELLED',
        actorId: 'SYSTEM',
        actorRole: 'SYSTEM',
        topicId: topic.id,
        detail: {
          fromState: previousState,
          toState: topic.state,
          approvalDeadlineAt: topic.approvalDeadlineAt,
          reason: 'AUTO_TIMEOUT_PENDING_GV',
        },
      });
    }

    this.logger.log(
      `Auto-cancelled ${overduePendingTopics.length} topic(s) overdue in PENDING_GV`,
    );
  }

  private async notifyIfAvailable(params: {
    receiverUserId: string;
    type: 'TOPIC_REJECTED' | 'GENERAL';
    context: Record<string, string>;
    topicId?: string;
  }): Promise<void> {
    if (!this.notificationsService) {
      return;
    }

    await this.notificationsService.create(params);
  }

  private async auditIfAvailable(params: {
    action: 'TOPIC_AUTO_CANCELLED';
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
