import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
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
  ApiBody,
} from '@nestjs/swagger';
import * as crypto from 'crypto';
import { ExportsService } from './exports.service';
import {
  ExportResponseDto,
  CreateExportDto,
  CreateRubricExportDto,
  ExportMinutesDto,
  CreateRubricExportResponseDto,
  ExportDownloadResponseDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types';
import { KLTN_RUBRIC_EXPORT_ROLES, KltnRubricExportRole } from './exports.constants';

@ApiTags('Exports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post('rubric/bctt/:topicId')
  @Roles('LECTURER', 'TBM')
  @ApiOperation({ summary: 'Export BCTT rubric for topic' })
  @ApiParam({ name: 'topicId', example: 'tp_001' })
  @ApiBody({ type: CreateRubricExportDto })
  @ApiResponse({
    status: 201,
    description: 'Export created',
    type: CreateRubricExportResponseDto,
  })
  async exportRubricBctt(
    @Param('topicId') topicId: string,
    @Body() dto: CreateRubricExportDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: CreateRubricExportResponseDto; meta: { requestId: string } }> {
    const result = await this.exportsService.exportRubricBctt(
      topicId,
      dto.scoreId,
      user,
    );
    return {
      data: {
        exportId: result.id,
        driveFileId: result.driveFileId || '',
      },
      meta: { requestId: `req_${crypto.randomBytes(8).toString('hex')}` },
    };
  }

  @Post('rubric/kltn/:topicId/:role')
  @Roles('LECTURER', 'TBM')
  @ApiOperation({ summary: 'Export KLTN rubric by role for topic' })
  @ApiParam({ name: 'topicId', example: 'tp_001' })
  @ApiParam({
    name: 'role',
    enum: [...KLTN_RUBRIC_EXPORT_ROLES],
    example: 'GVHD',
  })
  @ApiBody({ type: CreateRubricExportDto })
  @ApiResponse({
    status: 201,
    description: 'Export created',
    type: CreateRubricExportResponseDto,
  })
  async exportRubricKltn(
    @Param('topicId') topicId: string,
    @Param('role') role: KltnRubricExportRole,
    @Body() dto: CreateRubricExportDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: CreateRubricExportResponseDto; meta: { requestId: string } }> {
    const result = await this.exportsService.exportRubricKltn(
      topicId,
      role,
      dto.scoreId,
      user,
    );
    return {
      data: {
        exportId: result.id,
        driveFileId: result.driveFileId || '',
      },
      meta: { requestId: `req_${crypto.randomBytes(8).toString('hex')}` },
    };
  }

  @Post('scores/:topicId')
  @Roles('LECTURER', 'TBM')
  @ApiOperation({ summary: 'Export score sheet for topic' })
  @ApiParam({ name: 'topicId', example: 'tp_001' })
  @ApiResponse({ status: 201, description: 'Export created', type: ExportResponseDto })
  async exportScoreSheet(
    @Param('topicId') topicId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: ExportResponseDto; meta: { requestId: string } }> {
    const result = await this.exportsService.exportScoreSheet(topicId, user);
    return {
      data: result,
      meta: { requestId: `req_${crypto.randomBytes(8).toString('hex')}` },
    };
  }

  @Post('minutes/:topicId')
  @Roles('LECTURER', 'TBM')
  @ApiOperation({ summary: 'Generate biên bản họp hội đồng bảo vệ (PDF)' })
  @ApiParam({ name: 'topicId', example: 'tp_001' })
  @ApiBody({ type: ExportMinutesDto, required: false })
  @ApiResponse({ status: 201, description: 'Biên bản PDF created', type: ExportResponseDto })
  async exportMinutes(
    @Param('topicId') topicId: string,
    @Body() dto: ExportMinutesDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: ExportResponseDto; meta: { requestId: string } }> {
    const result = await this.exportsService.exportMinutes(topicId, dto, user);
    return {
      data: result,
      meta: { requestId: `req_${crypto.randomBytes(8).toString('hex')}` },
    };
  }

  @Post('topics')
  @Roles('TBM')
  @ApiOperation({ summary: 'Export topic list' })
  @ApiResponse({ status: 201, description: 'Export created', type: ExportResponseDto })
  async exportTopicList(
    @Body() body: CreateExportDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: ExportResponseDto; meta: { requestId: string } }> {
    const result = await this.exportsService.exportTopicList(body.periodId, user);
    return {
      data: result,
      meta: { requestId: `req_${crypto.randomBytes(8).toString('hex')}` },
    };
  }

  @Get()
  @Roles('STUDENT', 'LECTURER', 'TBM')
  @ApiOperation({ summary: 'List exports for current user' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'size', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Export list', type: [ExportResponseDto] })
  async listExports(
    @Query('page') page: string = '1',
    @Query('size') size: string = '20',
    @CurrentUser() user: AuthUser,
  ): Promise<{
    data: ExportResponseDto[];
    pagination: { page: number; size: number; total: number };
    meta: { requestId: string };
  }> {
    const result = await this.exportsService.findAll(user, {
      page: parseInt(page, 10) || 1,
      size: parseInt(size, 10) || 20,
    });
    return {
      ...result,
      meta: { requestId: `req_${crypto.randomBytes(8).toString('hex')}` },
    };
  }

  @Get(':exportId')
  @Roles('STUDENT', 'LECTURER', 'TBM')
  @ApiOperation({ summary: 'Get export by ID' })
  @ApiParam({ name: 'exportId', example: 'exp_001' })
  @ApiResponse({ status: 200, description: 'Export details', type: ExportResponseDto })
  async getExport(
    @Param('exportId') exportId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: ExportResponseDto; meta: { requestId: string } }> {
    const record = await this.exportsService.getExportById(exportId, user);
    if (!record) {
      throw new NotFoundException(`Export ${exportId} không tồn tại`);
    }
    return {
      data: this.exportsService.mapToDto(record),
      meta: { requestId: `req_${crypto.randomBytes(8).toString('hex')}` },
    };
  }

  @Get(':exportId/download')
  @Roles('STUDENT', 'LECTURER', 'TBM')
  @ApiOperation({ summary: 'Get Drive download link for export' })
  @ApiParam({ name: 'exportId', example: 'exp_001' })
  @ApiResponse({ status: 200, description: 'Drive link', type: ExportDownloadResponseDto })
  async getDownloadUrl(
    @Param('exportId') exportId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{
    data: ExportDownloadResponseDto;
    meta: { requestId: string };
  }> {
    const result = await this.exportsService.getDownloadUrl(exportId, user);
    return {
      data: result,
      meta: { requestId: `req_${crypto.randomBytes(8).toString('hex')}` },
    };
  }
}
