import { Module, forwardRef } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { AssignmentsController } from './assignments.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { TopicsModule } from '../topics/topics.module';

@Module({
  imports: [
    NotificationsModule,
    forwardRef(() => TopicsModule),
  ],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
