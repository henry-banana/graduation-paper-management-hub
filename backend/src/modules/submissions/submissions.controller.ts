import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { SubmissionsService } from './submissions.service';
import {
  SubmissionResponseDto,
  CreateSubmissionDto,
  CreateSubmissionResponseDto,
  DownloadResponseDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types';
import * as crypto from 'crypto';
import {
  FileType,
  MAX_SUBMISSION_FILE_SIZE,
  PDF_MIME_TYPE,
  SUBMISSION_FILE_TYPES,
} from './submission.constants';
import { SubmissionFileInfo } from './submission-file-validator.service';

function generateRequestId(): string {
  return `req_${crypto.randomBytes(8).toString('hex')}`;
}

// Express.Multer.File type for uploaded files
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('submissions')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get('topics/:topicId/submissions')
  @Roles('STUDENT', 'LECTURER', 'TBM')
  @ApiOperation({ summary: 'Get all submissions for a topic' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiResponse({
    status: 200,
    description: 'List of submissions',
    type: [SubmissionResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async getSubmissions(
    @Param('topicId') topicId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const submissions = await this.submissionsService.findByTopicId(
      topicId,
      user,
    );
    return {
      data: submissions,
      meta: { requestId: generateRequestId() },
    };
  }

  @Post('topics/:topicId/submissions')
  @Roles('STUDENT', 'LECTURER')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_SUBMISSION_FILE_SIZE,
      },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== PDF_MIME_TYPE) {
          cb(new BadRequestException('Only PDF files are allowed'), false);
          return;
        }

        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a submission file (Student only)' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiBody({
    description: 'File upload with fileType',
    schema: {
      type: 'object',
      required: ['file', 'fileType'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF file to upload',
        },
        fileType: {
          type: 'string',
          enum: [...SUBMISSION_FILE_TYPES],
          description: 'Type of submission',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    type: CreateSubmissionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid file or request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  @ApiResponse({ status: 409, description: 'Conflict - invalid topic state' })
  @ApiResponse({ status: 413, description: 'File too large' })
  async uploadSubmission(
    @Param('topicId') topicId: string,
    @Body() dto: CreateSubmissionDto,
    @UploadedFile() file: MulterFile | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const fileInfo: SubmissionFileInfo = {
      originalFileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    };

    const result = await this.submissionsService.create(
      topicId,
      dto.fileType,
      user,
      fileInfo,
    );

    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  @Get('submissions/:submissionId')
  @Roles('STUDENT', 'LECTURER', 'TBM')
  @ApiOperation({ summary: 'Get submission by ID' })
  @ApiParam({ name: 'submissionId', description: 'Submission ID' })
  @ApiResponse({
    status: 200,
    description: 'Submission details',
    type: SubmissionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  async getSubmission(
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const submission = await this.submissionsService.findById(
      submissionId,
      user,
    );
    if (!submission) {
      throw new NotFoundException(
        `Submission with ID ${submissionId} not found`,
      );
    }
    return {
      data: this.submissionsService.mapToDto(submission),
      meta: { requestId: generateRequestId() },
    };
  }

  @Get('submissions/:submissionId/download')
  @Roles('STUDENT', 'LECTURER', 'TBM')
  @ApiOperation({ summary: 'Get download URL for a submission' })
  @ApiParam({ name: 'submissionId', description: 'Submission ID' })
  @ApiResponse({
    status: 200,
    description: 'Download URL',
    type: DownloadResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  async getDownloadUrl(
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.submissionsService.getDownloadUrl(
      submissionId,
      user,
    );
    return {
      data: result,
      meta: { requestId: generateRequestId() },
    };
  }

  @Get('topics/:topicId/submissions/latest/:fileType')
  @Roles('STUDENT', 'LECTURER', 'TBM')
  @ApiOperation({ summary: 'Get latest submission for a file type' })
  @ApiParam({ name: 'topicId', description: 'Topic ID' })
  @ApiParam({
    name: 'fileType',
    description: 'File type',
    enum: [...SUBMISSION_FILE_TYPES],
  })
  @ApiResponse({
    status: 200,
    description: 'Latest submission',
    type: SubmissionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'No submission found' })
  async getLatestSubmission(
    @Param('topicId') topicId: string,
    @Param('fileType') fileType: FileType,
    @CurrentUser() user: AuthUser,
  ) {
    // Validate fileType
    if (!SUBMISSION_FILE_TYPES.includes(fileType)) {
      throw new BadRequestException('Invalid file type');
    }

    const submission = await this.submissionsService.getLatestByFileType(
      topicId,
      fileType,
      user,
    );

    if (!submission) {
      throw new NotFoundException(
        `No ${fileType} submission found for this topic`,
      );
    }

    return {
      data: this.submissionsService.mapToDto(submission),
      meta: { requestId: generateRequestId() },
    };
  }
}
