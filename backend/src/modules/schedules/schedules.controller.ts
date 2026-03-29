import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto, UpdateScheduleDto } from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/types';

@ApiTags('schedules')
@ApiBearerAuth('JWT')
@Controller('topics/:topicId/schedule')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  @ApiOperation({ summary: 'Get defense schedule for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  async findOne(@Param('topicId') topicId: string) {
    const schedule = await this.schedulesService.findByTopicId(topicId);
    if (!schedule) {
      throw new NotFoundException(`No schedule found for topic ${topicId}`);
    }
    return schedule;
  }

  @Post()
  @Roles('TBM')
  @ApiOperation({ summary: 'Create defense schedule (TBM only)' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  async create(
    @Param('topicId') topicId: string,
    @Body() dto: CreateScheduleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.schedulesService.create(topicId, dto, user);
  }

  @Patch()
  @Roles('TBM')
  @ApiOperation({
    summary:
      'Update defense schedule (TBM only) — sends update notification automatically',
  })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  async update(
    @Param('topicId') topicId: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.schedulesService.update(topicId, dto, user);
  }
}
