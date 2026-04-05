import { Module } from '@nestjs/common';
import { ScoresService } from './scores.service';
import { ScoresController } from './scores.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { ExportsModule } from '../exports/exports.module';

@Module({
  imports: [NotificationsModule, ExportsModule],
  controllers: [ScoresController],
  providers: [ScoresService],
  exports: [ScoresService],
})
export class ScoresModule {}
