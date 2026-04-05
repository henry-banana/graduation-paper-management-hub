import {
  Controller,
  Get,
  Patch,
  Post,
  HttpCode,
  HttpStatus,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import {
  NotificationResponseDto,
  GetNotificationsQueryDto,
  MarkReadDto,
  MarkBulkReadDto,
} from './dto';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types';
import { NotificationType } from './dto';
import * as crypto from 'crypto';

class BroadcastNotificationDto {
  @ApiProperty({ description: 'Notification type', enum: ['SYSTEM', 'GENERAL'], example: 'SYSTEM' })
  @IsIn(['SYSTEM', 'GENERAL', 'TOPIC_APPROVED', 'TOPIC_REJECTED', 'TOPIC_PENDING',
    'DEADLINE_SET', 'DEADLINE_REMINDER', 'DEADLINE_OVERDUE', 'REVISION_ROUND_OPENED',
    'REVISION_ROUND_CLOSED', 'SUBMISSION_UPLOADED', 'SUBMISSION_CONFIRMED',
    'SCORE_SUBMITTED', 'SCORE_PUBLISHED', 'ASSIGNMENT_ADDED'])
  type!: NotificationType;

  @ApiPropertyOptional({ description: 'Custom title override' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Custom message body' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  body?: string;

  /** Ignored — broadcast is always GLOBAL scope. Field accepted to avoid unknown-field validation errors. */
  @IsOptional()
  @IsString()
  scope?: string;
}

function generateRequestId(): string {
  return `req_${crypto.randomBytes(8).toString('hex')}`;
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for current user' })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of notifications', type: [NotificationResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getNotifications(
    @Query() query: GetNotificationsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.notificationsService.findAll(user, query);
    return {
      data: result.data,
      pagination: result.pagination,
      meta: { requestId: generateRequestId() },
    };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread count' })
  async getUnreadCount(@CurrentUser() user: AuthUser) {
    const count = await this.notificationsService.getUnreadCount(user);
    return {
      data: { unreadCount: count },
      meta: { requestId: generateRequestId() },
    };
  }

  @Post('broadcast')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Broadcast a notification to all users (TBM only)' })
  @ApiResponse({ status: 201, description: 'Notification broadcast created' })
  @ApiResponse({ status: 403, description: 'Only TBM can broadcast' })
  async broadcast(
    @Body() dto: BroadcastNotificationDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (user.role !== 'TBM') {
      throw new ForbiddenException('Only TBM can broadcast notifications');
    }
    const notification = await this.notificationsService.broadcast({
      type: dto.type,
      title: dto.title,
      body: dto.body,
    });
    return {
      data: this.notificationsService.mapToDto(notification),
      meta: { requestId: generateRequestId() },
    };
  }

  @Post('read-bulk')
  @ApiOperation({ summary: 'Mark multiple notifications as read' })
  @ApiResponse({ status: 200, description: 'Notifications updated' })
  async markBulkRead(
    @Body() dto: MarkBulkReadDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.notificationsService.markBulkRead(
      dto.notificationIds,
      user,
    );
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  @Get(':notificationId')
  @ApiOperation({ summary: 'Get notification by ID' })
  @ApiParam({ name: 'notificationId', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification details', type: NotificationResponseDto })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async getNotification(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const notification = await this.notificationsService.findById(notificationId, user);
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${notificationId} not found`);
    }
    return {
      data: this.notificationsService.mapToDto(notification),
      meta: { requestId: generateRequestId() },
    };
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: 'Mark notification as read/unread (PATCH)' })
  @ApiParam({ name: 'notificationId', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification updated' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markRead(
    @Param('notificationId') notificationId: string,
    @Body() dto: MarkReadDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.notificationsService.markRead(notificationId, dto.isRead, user);
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  @Post(':notificationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notification as read (POST alias — sets isRead=true)' })
  @ApiParam({ name: 'notificationId', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markReadPost(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    // POST /:id/read always sets isRead = true (convenience alias)
    const result = await this.notificationsService.markRead(notificationId, true, user);
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }
}

