import { Module } from '@nestjs/common';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { SubmissionDeadlineReminderJob } from './submission-deadline-reminder.job';
import { TopicTimeoutJob } from './topic-timeout.job';

@Module({
  imports: [NotificationsModule],
  providers: [TopicTimeoutJob, SubmissionDeadlineReminderJob],
})
export class JobsModule {}
