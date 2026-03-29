import { Module } from '@nestjs/common';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { TopicTimeoutJob } from './topic-timeout.job';

@Module({
  imports: [NotificationsModule],
  providers: [TopicTimeoutJob],
})
export class JobsModule {}
