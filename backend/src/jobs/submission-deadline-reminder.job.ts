import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  NotificationsRepository,
  TopicsRepository,
} from '../infrastructure/google-sheets';
import { NotificationsService } from '../modules/notifications/notifications.service';

@Injectable()
export class SubmissionDeadlineReminderJob {
  private static readonly REMINDER_DAYS = new Set([3, 1]);
  private static readonly DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  private readonly logger = new Logger(SubmissionDeadlineReminderJob.name);

  constructor(
    private readonly topicsRepository: TopicsRepository,
    private readonly notificationsRepository: NotificationsRepository,
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleSubmissionDeadlines(): Promise<void> {
    if (!this.notificationsService) {
      return;
    }

    const now = new Date();
    const nowDateKey = this.toDateKey(now);
    const dayMs = 24 * 60 * 60 * 1000;

    const [topics, notifications] = await Promise.all([
      this.topicsRepository.findAll(),
      this.notificationsRepository.findAll(),
    ]);

    let reminderCount = 0;
    let overdueCount = 0;

    for (const topic of topics) {
      if (topic.state !== 'IN_PROGRESS' || !topic.submitEndAt) {
        continue;
      }

      const deadline = new Date(topic.submitEndAt);
      if (Number.isNaN(deadline.getTime())) {
        continue;
      }

      const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / dayMs);

      if (SubmissionDeadlineReminderJob.REMINDER_DAYS.has(daysLeft)) {
        const reminderSentToday = notifications.some(
          (notification) =>
            notification.type === 'DEADLINE_REMINDER' &&
            notification.topicId === topic.id &&
            notification.receiverUserId === topic.studentUserId &&
            this.toDateKey(notification.createdAt) === nowDateKey,
        );

        if (!reminderSentToday) {
          await this.notificationsService.create({
            receiverUserId: topic.studentUserId,
            type: 'DEADLINE_REMINDER',
            topicId: topic.id,
            context: {
              topicTitle: topic.title,
              daysLeft: String(daysLeft),
            },
          });

          reminderCount++;
        }

        continue;
      }

      if (daysLeft < 0) {
        const alreadyNotifiedOverdue = notifications.some(
          (notification) =>
            notification.type === 'DEADLINE_OVERDUE' &&
            notification.topicId === topic.id &&
            notification.receiverUserId === topic.studentUserId,
        );

        if (alreadyNotifiedOverdue) {
          continue;
        }

        await this.notificationsService.create({
          receiverUserId: topic.studentUserId,
          type: 'DEADLINE_OVERDUE',
          topicId: topic.id,
          context: {
            topicTitle: topic.title,
            deadline: deadline.toLocaleDateString('vi-VN'),
          },
        });

        overdueCount++;
      }
    }

    if (reminderCount > 0 || overdueCount > 0) {
      this.logger.log(
        `Created ${reminderCount} reminder(s) and ${overdueCount} overdue alert(s) for submission deadlines`,
      );
    }
  }

  private toDateKey(value: string | Date): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return SubmissionDeadlineReminderJob.DATE_FORMATTER.format(date);
  }
}
