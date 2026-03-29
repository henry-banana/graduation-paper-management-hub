import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TopicsModule } from './modules/topics/topics.module';
import { PeriodsModule } from './modules/periods/periods.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { ScoresModule } from './modules/scores/scores.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ExportsModule } from './modules/exports/exports.module';
import { AuditModule } from './modules/audit/audit.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { HealthModule } from './modules/health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { GoogleSheetsModule } from './infrastructure/google-sheets/google-sheets.module';
import { GoogleDriveModule } from './infrastructure/google-drive/google-drive.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 300000, // 5 minutes in ms
      max: 1000,
    }),
    ScheduleModule.forRoot(),
    // Infrastructure
    GoogleSheetsModule,
    GoogleDriveModule,
    // Domain modules
    AuthModule,
    UsersModule,
    TopicsModule,
    PeriodsModule,
    AssignmentsModule,
    SubmissionsModule,
    ScoresModule,
    NotificationsModule,
    ExportsModule,
    AuditModule,
    SchedulesModule,
    HealthModule,
    JobsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: ProblemDetailsFilter,
    },
  ],
})
export class AppModule {}
