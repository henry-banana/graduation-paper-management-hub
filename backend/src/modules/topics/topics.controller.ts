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
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiUnprocessableEntityResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TopicsService } from './topics.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/types';
import { SuggestedTopicsRepository } from '../../infrastructure/google-sheets/repositories';
import {
  TopicResponseDto,
  TopicListResponseDto,
  TopicDetailResponseDto,
  TopicCreateResponseDto,
  TopicTransitionResponseDto,
  CreateTopicDto,
  UpdateTopicDto,
  GetTopicsQueryDto,
  ApproveTopicDto,
  RejectTopicDto,
  SetDeadlineDto,
  TransitionTopicDto,
  CreateRevisionRoundDto,
  RevisionRoundResponseDto,
  CloseRevisionRoundDto,
} from './dto';

@ApiTags('Topics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('topics')
export class TopicsController {
  constructor(
    private readonly topicsService: TopicsService,
    private readonly suggestedTopicsRepository: SuggestedTopicsRepository,
  ) {}

  @Get()
  @Roles('STUDENT', 'LECTURER', 'TBM')
  @ApiOperation({ summary: 'List topics' })
  @ApiOkResponse({
    description: 'List of topics with pagination',
    type: TopicListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async findAll(
    @Query() query: GetTopicsQueryDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const result = await this.topicsService.findAll(query, currentUser);
    return {
      ...result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  /**
   * GET /topics/suggestions?q=<query>[&supervisorEmail=<email>]
   * Returns up to 15 topic title suggestions from Detaigoiy sheet.
   * Must be BEFORE /:topicId to avoid route conflict.
   */
  @Get('suggestions')
  @Roles('STUDENT', 'LECTURER', 'TBM')
  @ApiOperation({ summary: 'Get topic title suggestions from Detaigoiy sheet' })
  @ApiOkResponse({ description: 'Array of suggestion strings' })
  async getSuggestions(
    @Query('q') q: string,
    @Query('supervisorEmail') supervisorEmail?: string,
  ) {
    if (!q || q.trim().length < 2) {
      return { data: [] };
    }
    const suggestions = await this.suggestedTopicsRepository.search(q.trim(), supervisorEmail);
    return {
      data: suggestions.map((s) => ({
        title: s.title,
        supervisorEmail: s.supervisorEmail,
        dot: s.dot,
      })),
    };
  }

  @Get(':topicId')
  @Roles('STUDENT', 'LECTURER', 'TBM')
  @ApiOperation({ summary: 'Get topic by ID' })
  @ApiOkResponse({ type: TopicDetailResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Topic not found' })
  async findOne(
    @Param('topicId') topicId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const topic = await this.topicsService.findById(topicId);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    // Students can only view their own topics
    if (
      currentUser.role === 'STUDENT' &&
      topic.studentUserId !== currentUser.userId
    ) {
      throw new NotFoundException('Topic not found');
    }

    return {
      data: this.topicsService.mapToDto(topic),
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Post()
  @Roles('STUDENT')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new topic (Student only)' })
  @ApiCreatedResponse({ description: 'Topic created', type: TopicCreateResponseDto })
  @ApiBadRequestResponse({ description: 'Bad request' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiConflictResponse({ description: 'Conflict - duplicate active topic' })
  @ApiUnprocessableEntityResponse({ description: 'Validation error' })
  async create(
    @Body() dto: CreateTopicDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const result = await this.topicsService.create(dto, currentUser);
    return {
      data: result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Patch(':topicId')
  @Roles('STUDENT', 'TBM')
  @ApiOperation({ summary: 'Update topic' })
  @ApiOkResponse({ description: 'Topic updated' })
  @ApiBadRequestResponse({ description: 'Bad request' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Topic not found' })
  @ApiConflictResponse({
    description: 'Conflict - cannot edit in current state',
  })
  @ApiUnprocessableEntityResponse({ description: 'Validation error' })
  async update(
    @Param('topicId') topicId: string,
    @Body() dto: UpdateTopicDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const result = await this.topicsService.update(topicId, dto, currentUser);
    return {
      data: result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Post(':topicId/approve')
  @Roles('LECTURER', 'TBM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve topic (GVHD only)' })
  @ApiOkResponse({ description: 'Topic approved' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Topic not found' })
  @ApiConflictResponse({ description: 'Conflict - invalid state' })
  async approve(
    @Param('topicId') topicId: string,
    @Body() dto: ApproveTopicDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const result = await this.topicsService.approve(
      topicId,
      dto.note,
      currentUser,
    );
    return {
      data: result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Post(':topicId/reject')
  @Roles('LECTURER', 'TBM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject topic (GVHD only)' })
  @ApiOkResponse({ description: 'Topic rejected' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Topic not found' })
  @ApiConflictResponse({ description: 'Conflict - invalid state' })
  async reject(
    @Param('topicId') topicId: string,
    @Body() dto: RejectTopicDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const result = await this.topicsService.reject(
      topicId,
      dto.reason,
      currentUser,
    );
    return {
      data: result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Post(':topicId/deadline')
  @Roles('LECTURER', 'TBM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set or extend deadline' })
  @ApiOkResponse({ description: 'Deadline updated' })
  @ApiBadRequestResponse({ description: 'Bad request' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Topic not found' })
  @ApiConflictResponse({
    description: 'Conflict - cannot change deadline in current state',
  })
  async setDeadline(
    @Param('topicId') topicId: string,
    @Body() dto: SetDeadlineDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const result = await this.topicsService.setDeadline(
      topicId,
      dto,
      currentUser,
    );
    return {
      data: result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Post(':topicId/transition')
  @Roles('STUDENT', 'LECTURER', 'TBM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transition topic state' })
  @ApiOkResponse({
    description: 'Topic transitioned',
    type: TopicTransitionResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Bad request' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Topic not found' })
  @ApiConflictResponse({ description: 'Conflict - invalid transition' })
  async transition(
    @Param('topicId') topicId: string,
    @Body() dto: TransitionTopicDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const result = await this.topicsService.transition(
      topicId,
      dto.action,
      currentUser,
    );
    return {
      data: result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Get(':topicId/revisions/rounds')
  @Roles('STUDENT', 'LECTURER', 'TBM')
  @ApiOperation({ summary: 'List revision rounds for a topic' })
  @ApiOkResponse({ type: [RevisionRoundResponseDto] })
  @ApiNotFoundResponse({ description: 'Topic not found' })
  async listRevisionRounds(
    @Param('topicId') topicId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const result = await this.topicsService.listRevisionRounds(topicId, currentUser);
    return {
      data: result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Post(':topicId/revisions/rounds')
  @Roles('TBM')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Open a new revision round for a topic (TBM only)' })
  @ApiCreatedResponse({ type: RevisionRoundResponseDto })
  @ApiNotFoundResponse({ description: 'Topic not found' })
  @ApiConflictResponse({ description: 'Another revision round is already open' })
  async openRevisionRound(
    @Param('topicId') topicId: string,
    @Body() dto: CreateRevisionRoundDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const result = await this.topicsService.openRevisionRound(
      topicId,
      dto,
      currentUser,
    );
    return {
      data: result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Post(':topicId/revisions/rounds/:roundId/close')
  @Roles('TBM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a revision round (TBM only)' })
  @ApiOkResponse({ type: RevisionRoundResponseDto })
  @ApiNotFoundResponse({ description: 'Topic or revision round not found' })
  @ApiConflictResponse({ description: 'Revision round already closed' })
  async closeRevisionRound(
    @Param('topicId') topicId: string,
    @Param('roundId') roundId: string,
    @Body() dto: CloseRevisionRoundDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const result = await this.topicsService.closeRevisionRound(
      topicId,
      roundId,
      dto,
      currentUser,
    );
    return {
      data: result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }
}
