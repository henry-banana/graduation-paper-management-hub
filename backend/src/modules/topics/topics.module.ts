import { Module } from '@nestjs/common';
import { TopicsService } from './topics.service';
import { TopicsController } from './topics.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  SuggestedTopicsRepository,
  AssignmentsRepository,
} from '../../infrastructure/google-sheets/repositories';

@Module({
  imports: [NotificationsModule],
  controllers: [TopicsController],
  providers: [TopicsService, SuggestedTopicsRepository, AssignmentsRepository],
  exports: [TopicsService],
})
export class TopicsModule {}
