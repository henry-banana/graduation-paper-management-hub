import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types';
import * as crypto from 'crypto';

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
  @ApiQuery({
    name: 'isRead',
    required: false,
    type: Boolean,
    description: 'Filter by read status',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'size',
    required: false,
    type: Number,
    description: 'Page size',
  })
  @ApiResponse({
    status: 200,
    description: 'List of notifications',
    type: [NotificationResponseDto],
  })
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
  @ApiResponse({
    status: 200,
    description: 'Unread count',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadCount(@CurrentUser() user: AuthUser) {
    const count = await this.notificationsService.getUnreadCount(user);
    return {
      data: { unreadCount: count },
      meta: { requestId: generateRequestId() },
    };
  }

  @Get(':notificationId')
  @ApiOperation({ summary: 'Get notification by ID' })
  @ApiParam({ name: 'notificationId', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification details',
    type: NotificationResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async getNotification(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const notification = await this.notificationsService.findById(
      notificationId,
      user,
    );
    if (!notification) {
      throw new NotFoundException(
        `Notification with ID ${notificationId} not found`,
      );
    }
    return {
      data: this.notificationsService.mapToDto(notification),
      meta: { requestId: generateRequestId() },
    };
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: 'Mark notification as read/unread' })
  @ApiParam({ name: 'notificationId', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification updated' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markRead(
    @Param('notificationId') notificationId: string,
    @Body() dto: MarkReadDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.notificationsService.markRead(
      notificationId,
      dto.isRead,
      user,
    );
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  @Post('read-bulk')
  @ApiOperation({ summary: 'Mark multiple notifications as read' })
  @ApiResponse({ status: 200, description: 'Notifications updated' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
}
