import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
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
} from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';
import {
  AssignmentResponseDto,
  AssignGvpbDto,
  AssignCouncilDto,
  ReplaceAssignmentDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types';
import * as crypto from 'crypto';

function generateRequestId(): string {
  return `req_${crypto.randomBytes(8).toString('hex')}`;
}

@ApiTags('assignments')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get('topics/:topicId/assignments')
  @Roles('STUDENT', 'LECTURER', 'TBM')
  @ApiOperation({ summary: 'Get all assignments for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiResponse({
    status: 200,
    description: 'List of assignments',
    type: [AssignmentResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async getAssignments(
    @Param('topicId') topicId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const assignments = await this.assignmentsService.findByTopicId(
      topicId,
      user,
    );
    return {
      data: assignments,
      meta: { requestId: generateRequestId() },
    };
  }

  @Post('topics/:topicId/assignments/gvpb')
  @Roles('TBM')
  @ApiOperation({ summary: 'Assign GVPB to a topic (TBM only)' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiResponse({ status: 201, description: 'GVPB assigned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  @ApiResponse({ status: 409, description: 'Conflict - GVPB already assigned' })
  async assignGvpb(
    @Param('topicId') topicId: string,
    @Body() dto: AssignGvpbDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.assignmentsService.assignGvpb(topicId, dto, user);
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  @Post('topics/:topicId/assignments/council')
  @Roles('TBM')
  @ApiOperation({ summary: 'Assign defense council to a topic (TBM only)' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiResponse({ status: 201, description: 'Council assigned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  @ApiResponse({ status: 409, description: 'Conflict - Council already assigned' })
  async assignCouncil(
    @Param('topicId') topicId: string,
    @Body() dto: AssignCouncilDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.assignmentsService.assignCouncil(
      topicId,
      dto,
      user,
    );
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  @Patch('assignments/:assignmentId/replace')
  @Roles('TBM')
  @ApiOperation({ summary: 'Replace an assignment (TBM only)' })
  @ApiParam({ name: 'assignmentId', description: 'Assignment ID' })
  @ApiResponse({ status: 200, description: 'Assignment replaced successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async replaceAssignment(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: ReplaceAssignmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.assignmentsService.replaceAssignment(
      assignmentId,
      dto,
      user,
    );
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  @Get('assignments/:assignmentId')
  @Roles('STUDENT', 'LECTURER', 'TBM')
  @ApiOperation({ summary: 'Get assignment by ID' })
  @ApiParam({ name: 'assignmentId', description: 'Assignment ID' })
  @ApiResponse({
    status: 200,
    description: 'Assignment details',
    type: AssignmentResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async getAssignment(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const assignment = await this.assignmentsService.findById(
      assignmentId,
      user,
    );
    if (!assignment) {
      throw new NotFoundException(
        `Assignment with ID ${assignmentId} not found`,
      );
    }
    return {
      data: this.assignmentsService.mapToDto(assignment),
      meta: { requestId: generateRequestId() },
    };
  }
}
