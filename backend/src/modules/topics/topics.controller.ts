import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  NotFoundException,
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
  BulkApproveTopicsDto,
  BulkApproveResultDto,
  ApproveRevisionDto,
  RejectRevisionDto,
  RevisionApprovalResponseDto,
} from './dto';

@ApiTags('Topics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('topics')
export class TopicsController {
  constructor(
    private readonly topicsService: TopicsService,
    private readonly suggestedTopicsRepository: SuggestedTopicsRepository,
  ) { }

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

  /**
   * POST /topics/suggested-topics
   * GV tạo đề xuất đề tài mới.
   */
  @Post('suggested-topics')
  @Roles('LECTURER', 'TBM')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'GV: Create a new suggested topic' })
  @ApiCreatedResponse({ description: 'Suggested topic created' })
  async createSuggestedTopic(
    @Body() body: { title: string; dot?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const crypto = await import('crypto');
    const record = {
      id: `det_${crypto.randomBytes(6).toString('hex')}`,
      supervisorEmail: user.email,
      title: body.title?.trim() ?? '',
      dot: body.dot?.trim() ?? '',
      lecturerUserId: user.userId,
      createdAt: new Date().toISOString(),
      isVisible: true,
    };
    if (!record.title) {
      throw new ForbiddenException('title is required');
    }
    await this.suggestedTopicsRepository.create(record);
    return { data: record };
  }

  /**
   * GET /topics/suggested-topics
   * GV: xem danh sách của mình. TBM: xem tất cả.
   */
  @Get('suggested-topics')
  @Roles('LECTURER', 'TBM')
  @ApiOperation({ summary: 'List suggested topics (GV: own | TBM: all)' })
  @ApiOkResponse({ description: 'List of suggested topics' })
  async listSuggestedTopics(@CurrentUser() user: AuthUser) {
    if (user.role === 'TBM') {
      const all = await this.suggestedTopicsRepository.findAll();
      return { data: all };
    }
    // LECTURER: only their own
    const own = await this.suggestedTopicsRepository.findByLecturerId(user.userId);
    return { data: own };
  }

  /**
   * PATCH /topics/suggested-topics/:id/visibility
   * TBM toggle isVisible (ẩn/hiện đề xuất với sinh viên).
   */
  @Patch('suggested-topics/:id/visibility')
  @Roles('TBM')
  @ApiOperation({ summary: 'TBM: Toggle suggested topic visibility' })
  async toggleSuggestedTopicVisibility(
    @Param('id') id: string,
    @Body() body: { isVisible: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    if (user.role !== 'TBM') throw new ForbiddenException('Only TBM can toggle visibility');
    const record = await this.suggestedTopicsRepository.findById(id);
    if (!record) throw new NotFoundException(`Suggested topic ${id} not found`);
    record.isVisible = body.isVisible;
    await this.suggestedTopicsRepository.update(id, record);
    return { data: { id, isVisible: record.isVisible } };
  }

  /**
   * DELETE /topics/suggested-topics/:id
   * GV xóa của mình. TBM xóa bất kỳ.
   */
  @Delete('suggested-topics/:id')
  @Roles('LECTURER', 'TBM')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a suggested topic (GV: own | TBM: any)' })
  async deleteSuggestedTopic(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const record = await this.suggestedTopicsRepository.findById(id);
    if (!record) throw new NotFoundException(`Suggested topic ${id} not found`);
    if (user.role !== 'TBM' && record.lecturerUserId !== user.userId) {
      throw new ForbiddenException('You can only delete your own suggested topics');
    }
    await this.suggestedTopicsRepository.softDelete(id);
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
    const topic = await this.topicsService.findByIdForUser(topicId, currentUser);

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

  @Post('bulk-approve')
  @Roles('LECTURER', 'TBM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Bulk approve topics (GVHD or TBM)', 
    description: 'Approve multiple topics at once. Returns success/failure status for each topic.' 
  })
  @ApiOkResponse({ 
    description: 'Bulk approval results',
    type: BulkApproveResultDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async bulkApprove(
    @Body() dto: BulkApproveTopicsDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const result = await this.topicsService.bulkApprove(
      dto.topicIds,
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
    const expectedState = dto.expectedState ?? dto.expected_state;
    const result = await this.topicsService.transition(
      topicId,
      dto.action,
      currentUser,
      { expectedState },
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

  @Post(':topicId/revisions/rounds/:roundId/approve-gvhd')
  @Roles('LECTURER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'GVHD approves revision submission' })
  @ApiOkResponse({ type: RevisionApprovalResponseDto })
  @ApiNotFoundResponse({ description: 'Topic or revision round not found' })
  @ApiForbiddenResponse({ description: 'Only assigned GVHD can approve' })
  @ApiConflictResponse({ description: 'Already approved' })
  async approveRevisionByGvhd(
    @Param('topicId') topicId: string,
    @Param('roundId') roundId: string,
    @Body() dto: ApproveRevisionDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const result = await this.topicsService.approveRevisionByGvhd(
      topicId,
      roundId,
      dto.comments,
      currentUser,
    );
    return {
      data: result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Post(':topicId/revisions/rounds/:roundId/approve-cthd')
  @Roles('LECTURER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'CT_HD approves revision submission (after GVHD approved)' })
  @ApiOkResponse({ type: RevisionApprovalResponseDto })
  @ApiNotFoundResponse({ description: 'Topic or revision round not found' })
  @ApiForbiddenResponse({ description: 'Only assigned CT_HD can approve' })
  @ApiBadRequestResponse({ description: 'GVHD must approve first' })
  @ApiConflictResponse({ description: 'Already approved' })
  async approveRevisionByCtHd(
    @Param('topicId') topicId: string,
    @Param('roundId') roundId: string,
    @Body() dto: ApproveRevisionDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const result = await this.topicsService.approveRevisionByCtHd(
      topicId,
      roundId,
      dto.comments,
      currentUser,
    );
    return {
      data: result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Post(':topicId/revisions/rounds/:roundId/reject-gvhd')
  @Roles('LECTURER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'GVHD requests changes (rejects revision)' })
  @ApiOkResponse({ description: 'Revision rejected by GVHD' })
  @ApiNotFoundResponse({ description: 'Topic or revision round not found' })
  @ApiForbiddenResponse({ description: 'Only assigned GVHD can reject' })
  async rejectRevisionByGvhd(
    @Param('topicId') topicId: string,
    @Param('roundId') roundId: string,
    @Body() dto: RejectRevisionDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const result = await this.topicsService.rejectRevision(
      topicId,
      roundId,
      dto.reason,
      'GVHD',
      currentUser,
    );
    return {
      data: result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Post(':topicId/revisions/rounds/:roundId/reject-cthd')
  @Roles('LECTURER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'CT_HD requests changes (rejects revision)' })
  @ApiOkResponse({ description: 'Revision rejected by CT_HD' })
  @ApiNotFoundResponse({ description: 'Topic or revision round not found' })
  @ApiForbiddenResponse({ description: 'Only assigned CT_HD can reject' })
  async rejectRevisionByCtHd(
    @Param('topicId') topicId: string,
    @Param('roundId') roundId: string,
    @Body() dto: RejectRevisionDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const result = await this.topicsService.rejectRevision(
      topicId,
      roundId,
      dto.reason,
      'CT_HD',
      currentUser,
    );
    return {
      data: result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Get('revision-status')
  @Roles('TBM')
  @ApiOperation({ summary: 'Get revision approval status for all topics (TBM dashboard)' })
  @ApiOkResponse({ description: 'Revision status list' })
  async getRevisionStatus(
    @Query('periodId') periodId: string | undefined,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const result = await this.topicsService.getRevisionStatus(periodId, currentUser);
    return {
      data: result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }
}
