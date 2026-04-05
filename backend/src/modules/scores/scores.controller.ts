import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ScoresService } from './scores.service';
import {
  ScoreResponseDto,
  ScoreSummaryDto,
  DraftScoreResponseDto,
  SubmitScoreResponseDto,
  ConfirmScoreResponseDto,
  UpdateCouncilCommentsDto,
  CouncilCommentsResponseDto,
  RequestScoreAppealDto,
  RequestScoreAppealResponseDto,
  ResolveScoreAppealDto,
  ResolveScoreAppealResponseDto,
} from './dto';
import { CreateDraftScoreDto } from './dto/create-score.dto';
import { SubmitScoreDto, ConfirmScoreDto, RequestSummaryDto, ConfirmScoreRole } from './dto/submit-score.dto';

import { DirectScoreDto } from './dto/direct-score.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types';
import * as crypto from 'crypto';

function generateRequestId(): string {
  return `req_${crypto.randomBytes(8).toString('hex')}`;
}

@ApiTags('scores')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScoresController {
  constructor(private readonly scoresService: ScoresService) {}

  @Get('topics/:topicId/scores')
  @Roles('STUDENT', 'LECTURER', 'TBM')
  @ApiOperation({ summary: 'Get all scores for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiResponse({
    status: 200,
    description: 'List of scores',
    type: [ScoreResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async getScores(
    @Param('topicId') topicId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const scores = await this.scoresService.findByTopicId(topicId, user);
    return {
      data: scores,
      meta: { requestId: generateRequestId() },
    };
  }

  @Get('scores/:scoreId')
  @Roles('LECTURER', 'TBM')
  @ApiOperation({ summary: 'Get score by ID (Lecturers and TBM only)' })
  @ApiParam({ name: 'scoreId', description: 'Score ID' })
  @ApiResponse({
    status: 200,
    description: 'Score details',
    type: ScoreResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Score not found' })
  async getScore(
    @Param('scoreId') scoreId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const score = await this.scoresService.findById(scoreId, user);
    if (!score) {
      throw new NotFoundException(`Score with ID ${scoreId} not found`);
    }
    return {
      data: this.scoresService.mapToDto(score),
      meta: { requestId: generateRequestId() },
    };
  }

  @Post('topics/:topicId/scores/draft')
  @Roles('LECTURER')
  @ApiOperation({ summary: 'Create or update a draft score' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiResponse({
    status: 200,
    description: 'Draft score created/updated',
    type: DraftScoreResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  @ApiResponse({ status: 409, description: 'Conflict - already submitted' })
  async createDraft(
    @Param('topicId') topicId: string,
    @Body() dto: CreateDraftScoreDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.scoresService.createOrUpdateDraft(
      topicId,
      dto,
      user,
    );
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  @Post('scores/:scoreId/submit')
  @Roles('LECTURER')
  @ApiOperation({ summary: 'Submit a score (make it immutable)' })
  @ApiParam({ name: 'scoreId', description: 'Score ID' })
  @ApiResponse({
    status: 200,
    description: 'Score submitted',
    type: SubmitScoreResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Score not found' })
  @ApiResponse({ status: 409, description: 'Conflict - already submitted' })
  async submitScore(
    @Param('scoreId') scoreId: string,
    @Body() dto: SubmitScoreDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!dto.confirm) {
      throw new BadRequestException('confirm must be true to submit score');
    }
    const result = await this.scoresService.submit(scoreId, user);
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  @Post('topics/:topicId/scores/summary')
  @Roles('LECTURER', 'TBM')
  @ApiOperation({ summary: 'Get score summary for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiResponse({
    status: 200,
    description: 'Score summary',
    type: ScoreSummaryDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async getSummary(
    @Param('topicId') topicId: string,
    @Body() dto: RequestSummaryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.scoresService.getSummary(
      topicId,
      user,
      dto.requestedByRole,
    );
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  @Get('topics/:topicId/scores/summary')
  @Roles('STUDENT', 'LECTURER', 'TBM')
  @ApiOperation({ summary: 'Get score summary (read-only)' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiResponse({
    status: 200,
    description: 'Score summary',
    type: ScoreSummaryDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async getSummaryGet(
    @Param('topicId') topicId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.scoresService.getSummary(topicId, user);
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  @Post('topics/:topicId/scores/appeal')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Student requests one-time score appeal for BCTT' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiResponse({
    status: 200,
    description: 'Appeal requested',
    type: RequestScoreAppealResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Appeal already requested or score not published' })
  async requestAppeal(
    @Param('topicId') topicId: string,
    @Body() dto: RequestScoreAppealDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.scoresService.requestAppeal(topicId, dto.reason, user);
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  @Post('topics/:topicId/scores/appeal/resolve')
  @Roles('LECTURER')
  @ApiOperation({ summary: 'GVHD resolves pending score appeal for BCTT' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiResponse({
    status: 200,
    description: 'Appeal resolved',
    type: ResolveScoreAppealResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'No pending appeal' })
  async resolveAppeal(
    @Param('topicId') topicId: string,
    @Body() dto: ResolveScoreAppealDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.scoresService.resolveAppeal(
      topicId,
      user,
      dto.resolutionNote,
    );
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  @Post('topics/:topicId/scores/confirm')
  @Roles('LECTURER')
  @ApiOperation({ summary: 'Confirm score by GVHD or CT_HD' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiResponse({
    status: 200,
    description: 'Score confirmed',
    type: ConfirmScoreResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async confirmScore(
    @Param('topicId') topicId: string,
    @Body() dto: ConfirmScoreDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.scoresService.confirm(topicId, dto.role, user);
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  /**
   * Shorthand for CT_HD to confirm-publish scores.
   * Called by CouncilFinalConfirmPage: POST /topics/:topicId/scores/confirm-publish
   */
  @Post('topics/:topicId/scores/confirm-publish')
  @Roles('LECTURER', 'TBM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'CT_HĐ xác nhận và công bố điểm (shorthand confirm as CT_HD)' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiResponse({ status: 200, description: 'Score published' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async confirmPublish(
    @Param('topicId') topicId: string,
    @CurrentUser() user: AuthUser,
  ) {
    // CT_HD confirms and publishes. Service layer enforces ACTIVE CT_HD assignment.
    const role: ConfirmScoreRole = 'CT_HD';
    const result = await this.scoresService.confirm(topicId, role, user);
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  @Get('topics/:topicId/scores/my-draft')
  @Roles('LECTURER')
  @ApiOperation({ summary: 'Get current user\'s draft or submitted score for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiResponse({ status: 200, description: 'My draft/submitted score (flat criteria map)' })
  @ApiResponse({ status: 404, description: 'No score found' })
  async getMyDraft(
    @Param('topicId') topicId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.scoresService.findMyDraft(topicId, user);
    if (!result) {
      throw new NotFoundException(`No score draft found for topic ${topicId}`);
    }
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  @Post('topics/:topicId/scores/draft-direct')
  @Roles('LECTURER')
  @ApiOperation({ summary: 'Save draft score using flat criteria map (frontend-friendly)' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiResponse({ status: 200, description: 'Draft saved' })
  async saveDraftDirect(
    @Param('topicId') topicId: string,
    @Body() dto: DirectScoreDto,
    @CurrentUser() user: AuthUser,
  ) {
    const rubricDefinition = RUBRIC_DEFINITIONS[dto.role];
    if (!rubricDefinition) {
      throw new BadRequestException(`No rubric definition for role ${dto.role}`);
    }
    const result = await this.scoresService.createAndSubmitDirect(
      topicId,
      dto.criteria,
      dto.role,
      rubricDefinition,
      user,
      { isDraftOnly: true, turnitinLink: dto.turnitinLink, comments: dto.comments, questions: dto.questions },
    );
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  @Post('topics/:topicId/scores/submit-direct')
  @Roles('LECTURER')
  @ApiOperation({ summary: 'Create and submit score using flat criteria map (frontend-friendly)' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiResponse({ status: 200, description: 'Score submitted' })
  async submitDirect(
    @Param('topicId') topicId: string,
    @Body() dto: DirectScoreDto,
    @CurrentUser() user: AuthUser,
  ) {
    const rubricDefinition = RUBRIC_DEFINITIONS[dto.role];
    if (!rubricDefinition) {
      throw new BadRequestException(`No rubric definition for role ${dto.role}`);
    }
    const result = await this.scoresService.createAndSubmitDirect(
      topicId,
      dto.criteria,
      dto.role,
      rubricDefinition,
      user,
      { isDraftOnly: false, turnitinLink: dto.turnitinLink, comments: dto.comments, questions: dto.questions },
    );
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  /**
   * Cập nhật góp ý bổ sung của hội đồng (do Thư ký nhập)
   */
  @Patch('topics/:topicId/scores/council-comments')
  @Roles('LECTURER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cập nhật góp ý bổ sung của hội đồng (chỉ Thư ký HĐ)' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiResponse({
    status: 200,
    description: 'Góp ý đã được lưu',
    type: CouncilCommentsResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Không phải Thư ký HĐ của topic này' })
  @ApiResponse({ status: 404, description: 'Topic không tồn tại' })
  async updateCouncilComments(
    @Param('topicId') topicId: string,
    @Body() dto: UpdateCouncilCommentsDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.scoresService.updateCouncilComments(
      topicId,
      dto.councilComments,
      user,
    );
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  /**
   * Lấy góp ý hội đồng của topic
   */
  @Get('topics/:topicId/scores/council-comments')
  @Roles('LECTURER', 'TBM')
  @ApiOperation({ summary: 'Lấy góp ý bổ sung của hội đồng' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiResponse({ status: 200, description: 'Góp ý hội đồng (có thể null)' })
  async getCouncilComments(
    @Param('topicId') topicId: string,
  ) {
    const comments = await this.scoresService.getCouncilComments(topicId);
    return {
      data: { councilComments: comments },
      meta: { requestId: generateRequestId() },
    };
  }
}

/** Server-side rubric definitions (mirrors frontend RUBRIC_* constants) */
const RUBRIC_DEFINITIONS: Record<string, Array<{ id: string; max: number }>> = {
  GVHD_BCTT: [
    { id: 'attitude', max: 2.0 },
    { id: 'presentation', max: 2.0 },
    { id: 'content', max: 6.0 },
  ],
  GVHD_KLTN: [
    { id: 'attitude', max: 1.0 },
    { id: 'presentation', max: 1.0 },
    { id: 'content', max: 5.0 },
    { id: 'innovation', max: 2.0 },
    { id: 'defense', max: 1.0 },
  ],
  GVHD: [
    { id: 'attitude', max: 2.0 },
    { id: 'presentation', max: 2.0 },
    { id: 'content', max: 6.0 },
  ],
  GVPB: [
    { id: 'content', max: 5.0 },
    { id: 'presentation', max: 2.0 },
    { id: 'defense', max: 3.0 },
  ],
  TV_HD: [
    { id: 'presentation', max: 2.0 },
    { id: 'content', max: 5.0 },
    { id: 'defense', max: 3.0 },
  ],
  COUNCIL: [
    { id: 'presentation', max: 2.0 },
    { id: 'content', max: 5.0 },
    { id: 'defense', max: 3.0 },
  ],
};
