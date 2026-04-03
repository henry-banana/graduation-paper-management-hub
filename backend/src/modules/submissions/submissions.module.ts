import { Module } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { SubmissionFileValidatorService } from './submission-file-validator.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, SubmissionFileValidatorService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
