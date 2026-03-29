import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PeriodsService } from './periods.service';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  PeriodResponseDto,
  CreatePeriodDto,
  UpdatePeriodDto,
  GetPeriodsQueryDto,
} from './dto';

@ApiTags('Periods')
@ApiBearerAuth()
@Controller('periods')
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) {}

  @Get()
  @ApiOperation({ summary: 'List registration periods' })
  @ApiResponse({ status: 200, description: 'List of periods with pagination' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Query() query: GetPeriodsQueryDto) {
    const result = await this.periodsService.findAll(query);
    return {
      ...result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Get(':periodId')
  @ApiOperation({ summary: 'Get period by ID' })
  @ApiResponse({ status: 200, type: PeriodResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Period not found' })
  async findOne(@Param('periodId') periodId: string) {
    const period = await this.periodsService.findById(periodId);
    if (!period) {
      throw new NotFoundException('Period not found');
    }
    return {
      data: this.periodsService.mapToDto(period),
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Post()
  @Roles('TBM')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new registration period (TBM only)' })
  @ApiResponse({ status: 201, description: 'Period created' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - TBM only' })
  @ApiResponse({ status: 409, description: 'Conflict - duplicate code or overlapping period' })
  async create(@Body() dto: CreatePeriodDto) {
    const result = await this.periodsService.create(dto);
    return {
      data: result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Patch(':periodId')
  @Roles('TBM')
  @ApiOperation({ summary: 'Update registration period (TBM only)' })
  @ApiResponse({ status: 200, description: 'Period updated' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - TBM only' })
  @ApiResponse({ status: 404, description: 'Period not found' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async update(
    @Param('periodId') periodId: string,
    @Body() dto: UpdatePeriodDto,
  ) {
    const result = await this.periodsService.update(periodId, dto);
    return {
      data: result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Post(':periodId/open')
  @Roles('TBM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Open registration period (TBM only)' })
  @ApiResponse({ status: 200, description: 'Period opened' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - TBM only' })
  @ApiResponse({ status: 404, description: 'Period not found' })
  @ApiResponse({ status: 409, description: 'Conflict - period already open or another open period exists' })
  async open(@Param('periodId') periodId: string) {
    const result = await this.periodsService.open(periodId);
    return {
      data: result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Post(':periodId/close')
  @Roles('TBM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close registration period (TBM only)' })
  @ApiResponse({ status: 200, description: 'Period closed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - TBM only' })
  @ApiResponse({ status: 404, description: 'Period not found' })
  @ApiResponse({ status: 409, description: 'Conflict - period already closed or is draft' })
  async close(@Param('periodId') periodId: string) {
    const result = await this.periodsService.close(periodId);
    return {
      data: result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }
}
