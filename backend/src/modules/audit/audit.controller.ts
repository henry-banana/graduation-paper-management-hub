import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types';

@ApiTags('audit')
@ApiBearerAuth('JWT')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('TBM')
  @ApiOperation({ summary: 'Get recent audit logs (TBM only)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(@Query('limit') limit?: number) {
    return { data: await this.auditService.findAll(limit ?? 100) };
  }

  @Get('topics/:topicId')
  @ApiOperation({ summary: 'Get audit logs for a specific topic' })
  async findByTopic(
    @Param('topicId') topicId: string,
    @CurrentUser() user: AuthUser,
  ) {
    void user; // authorization check can be added if needed
    return { data: await this.auditService.findByTopic(topicId) };
  }
}
