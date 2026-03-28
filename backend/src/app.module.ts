import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TopicsModule } from './modules/topics/topics.module';
import { PeriodsModule } from './modules/periods/periods.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HealthModule } from './modules/health/health.module';
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
    // Infrastructure
    GoogleSheetsModule,
    GoogleDriveModule,
    // Domain modules
    AuthModule,
    UsersModule,
    TopicsModule,
    PeriodsModule,
    NotificationsModule,
    HealthModule,
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
