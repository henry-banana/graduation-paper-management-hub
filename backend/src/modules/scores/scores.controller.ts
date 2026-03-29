import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  BadRequestException,
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
} from './dto';
import { CreateDraftScoreDto } from './dto/create-score.dto';
import { SubmitScoreDto, ConfirmScoreDto, RequestSummaryDto } from './dto/submit-score.dto';
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
}
