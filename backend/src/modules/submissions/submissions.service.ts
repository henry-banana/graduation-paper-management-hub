import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  SubmissionResponseDto,
  CreateSubmissionResponseDto,
  DownloadResponseDto,
} from './dto';
import { AuthUser } from '../../common/types';
import { FileType } from './submission.constants';
import {
  SubmissionFileInfo,
  SubmissionFileValidatorService,
} from './submission-file-validator.service';
import {
  SubmissionsRepository,
  TopicsRepository,
} from '../../infrastructure/google-sheets';
import { GoogleDriveClient } from '../../infrastructure/google-drive';
import type { TopicRecord } from '../topics/topics.service';

export interface SubmissionRecord {
  id: string;
  topicId: string;
  uploaderUserId: string;
  fileType: FileType;
  version: number;
  driveFileId?: string;
  driveLink?: string;
  uploadedAt: string;
  originalFileName?: string;
  fileSize?: number;
}

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    private readonly fileValidator: SubmissionFileValidatorService,
    private readonly submissionsRepository: SubmissionsRepository,
    private readonly topicsRepository: TopicsRepository,
    private readonly googleDriveClient: GoogleDriveClient,
  ) {}

  private generateId(): string {
    return `sub_${crypto.randomBytes(6).toString('hex')}`;
  }

  /**
   * Get all submissions for a topic
   */
  async findByTopicId(
    topicId: string,
    user: AuthUser,
  ): Promise<SubmissionResponseDto[]> {
    const topic = await this.getTopicOrThrow(topicId);
    this.ensureCanReadTopic(topic, user);

    const submissions = await this.submissionsRepository.findAll();
    const topicSubmissions = submissions.filter(
      (s) => s.topicId === topicId,
    );

    return topicSubmissions.map((s) => this.mapToDto(s));
  }

  /**
   * Get submission by ID
   */
  async findById(
    submissionId: string,
    user: AuthUser,
  ): Promise<SubmissionRecord | null> {
    const submission = await this.submissionsRepository.findById(submissionId);
    if (!submission) return null;

    const topic = await this.topicsRepository.findById(submission.topicId);
    if (!topic) return null;

    this.ensureCanReadTopic(topic, user);

    return submission;
  }

  /**
   * Create a new submission (upload file)
   * Note: In production, file handling would be done via multipart/form-data
   */
  async create(
    topicId: string,
    fileType: FileType,
    user: AuthUser,
    fileInfo: SubmissionFileInfo | undefined,
  ): Promise<CreateSubmissionResponseDto> {
    const topic = await this.getTopicOrThrow(topicId);
    this.assertUploadPermission(topic, fileType, user);
    this.assertUploadState(topic, fileType);
    const validatedFile = this.fileValidator.validate(fileInfo);

    // Calculate next version for this fileType
    const submissions = await this.submissionsRepository.findAll();
    const existingVersions = submissions.filter(
      (s) => s.topicId === topicId && s.fileType === fileType,
    );
    const nextVersion = existingVersions.length > 0
      ? Math.max(...existingVersions.map((s) => s.version)) + 1
      : 1;

    this.logger.log(
      `Submission upload requested topicId=${topicId} userId=${user.userId} fileType=${fileType} version=${nextVersion}`,
    );

    const uploadFolderId = await this.resolveUploadFolderForUser(user.userId);

    const uploadPayload = Buffer.from(
      JSON.stringify(
        {
          topicId,
          fileType,
          originalFileName: validatedFile.originalFileName,
          mimeType: validatedFile.mimeType,
          fileSize: validatedFile.fileSize,
          version: nextVersion,
          uploaderUserId: user.userId,
          uploadedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      'utf-8',
    );

    const fallbackDriveId = `drv_${crypto.randomBytes(6).toString('hex')}`;
    let uploadResult: {
      fileId: string;
      webViewLink: string;
      webContentLink?: string;
    };

    if (this.googleDriveClient.isReady()) {
      try {
        uploadResult = await this.googleDriveClient.uploadFile(
          validatedFile.originalFileName,
          validatedFile.mimeType,
          uploadPayload,
          uploadFolderId,
        );

        this.logger.log(
          `Submission upload succeeded topicId=${topicId} userId=${user.userId} fileId=${uploadResult.fileId} folderId=${uploadFolderId ?? 'root'}`,
        );
      } catch (error) {
        const stack = error instanceof Error ? error.stack : String(error);
        this.logger.error(
          `Submission upload failed topicId=${topicId} userId=${user.userId} fileType=${fileType}`,
          stack,
        );
        throw error;
      }
    } else {
      uploadResult = {
        fileId: fallbackDriveId,
        webViewLink: `https://drive.google.com/file/d/${fallbackDriveId}`,
      };

      this.logger.warn(
        `Google Drive client is not ready, using fallback upload metadata topicId=${topicId} userId=${user.userId}`,
      );
    }

    const newSubmission: SubmissionRecord = {
      id: this.generateId(),
      topicId,
      uploaderUserId: user.userId,
      fileType,
      version: nextVersion,
      driveFileId: uploadResult.fileId,
      driveLink: uploadResult.webViewLink,
      uploadedAt: new Date().toISOString(),
      originalFileName: validatedFile.originalFileName,
      fileSize: validatedFile.fileSize,
    };

    await this.submissionsRepository.create(newSubmission);

    return {
      id: newSubmission.id,
      version: newSubmission.version,
      driveFileId: newSubmission.driveFileId,
    };
  }

  /**
   * Get download URL for a submission
   */
  async getDownloadUrl(
    submissionId: string,
    user: AuthUser,
  ): Promise<DownloadResponseDto> {
    const submission = await this.findById(submissionId, user);
    if (!submission) {
      throw new NotFoundException(`Submission with ID ${submissionId} not found`);
    }

    if (!submission.driveFileId) {
      throw new NotFoundException('No file associated with this submission');
    }

    // In production, this would generate a signed URL from Google Drive
    const downloadUrl = `https://drive.google.com/uc?id=${submission.driveFileId}&export=download`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    return {
      downloadUrl,
      expiresAt,
    };
  }

  /**
   * Get latest submission for a topic and fileType
   */
  async getLatestByFileType(
    topicId: string,
    fileType: FileType,
    user: AuthUser,
  ): Promise<SubmissionRecord | null> {
    const topic = await this.getTopicOrThrow(topicId);
    this.ensureCanReadTopic(topic, user);

    const submissions = await this.submissionsRepository.findAll();
    const matching = submissions
      .filter((s) => s.topicId === topicId && s.fileType === fileType)
      .sort((a, b) => b.version - a.version);

    return matching.length > 0 ? matching[0] : null;
  }

  /**
   * Map record to DTO
   */
  mapToDto(record: SubmissionRecord): SubmissionResponseDto {
    return {
      id: record.id,
      topicId: record.topicId,
      uploaderUserId: record.uploaderUserId,
      fileType: record.fileType,
      version: record.version,
      driveFileId: record.driveFileId,
      driveLink: record.driveLink,
      uploadedAt: record.uploadedAt,
      originalFileName: record.originalFileName,
      fileSize: record.fileSize,
    };
  }

  private async getTopicOrThrow(topicId: string): Promise<TopicRecord> {
    const topic = await this.topicsRepository.findById(topicId);
    if (!topic) {
      throw new NotFoundException(`Topic with ID ${topicId} not found`);
    }

    return topic;
  }

  private ensureCanReadTopic(topic: TopicRecord, user: AuthUser): void {
    if (user.role === 'TBM') {
      return;
    }

    if (user.role === 'STUDENT') {
      if (topic.studentUserId === user.userId) {
        return;
      }

      throw new ForbiddenException('Cannot view submissions for this topic');
    }

    if (user.role === 'LECTURER') {
      if (topic.supervisorUserId === user.userId) {
        return;
      }

      throw new ForbiddenException('Cannot access this topic');
    }

    throw new ForbiddenException('Cannot access this topic');
  }

  private assertUploadPermission(
    topic: TopicRecord,
    fileType: FileType,
    user: AuthUser,
  ): void {
    if (fileType === 'REPORT') {
      if (user.role !== 'STUDENT' || topic.studentUserId !== user.userId) {
        throw new ForbiddenException(
          'Only the topic owner student can upload REPORT files',
        );
      }

      return;
    }

    if (topic.type !== 'KLTN') {
      throw new ConflictException(
        `${fileType} submissions are only supported for KLTN topics`,
      );
    }

    if (user.role !== 'LECTURER' || topic.supervisorUserId !== user.userId) {
      throw new ForbiddenException(
        `Only topic supervisor can upload ${fileType} files`,
      );
    }
  }

  private assertUploadState(topic: TopicRecord, fileType: FileType): void {
    if (fileType === 'REPORT') {
      if (topic.state !== 'IN_PROGRESS') {
        throw new ConflictException(
          `Cannot upload REPORT in topic state: ${topic.state}`,
        );
      }

      this.ensureSubmissionWindowOpen(topic);
      return;
    }

    if (fileType === 'TURNITIN') {
      if (topic.state !== 'IN_PROGRESS') {
        throw new ConflictException(
          `Cannot upload TURNITIN in topic state: ${topic.state}`,
        );
      }

      return;
    }

    const allowedRevisionStates = ['IN_PROGRESS', 'PENDING_CONFIRM', 'DEFENSE'];
    if (!allowedRevisionStates.includes(topic.state)) {
      throw new ConflictException(
        `Cannot upload REVISION in topic state: ${topic.state}`,
      );
    }
  }

  private ensureSubmissionWindowOpen(topic: TopicRecord): void {
    if (!topic.submitStartAt || !topic.submitEndAt) {
      throw new ConflictException('Submission window is not configured');
    }

    const now = Date.now();
    const start = new Date(topic.submitStartAt).getTime();
    const end = new Date(topic.submitEndAt).getTime();

    if (now < start || now > end) {
      throw new ConflictException('Submission window is closed');
    }
  }

  private async resolveUploadFolderForUser(
    userId: string,
  ): Promise<string | undefined> {
    if (!this.googleDriveClient.isReady()) {
      return undefined;
    }

    try {
      return await this.googleDriveClient.getOrCreateUserUploadFolderId(userId);
    } catch (error) {
      const stack = error instanceof Error ? error.stack : String(error);
      this.logger.error(
        `Failed to resolve Google Drive upload folder for userId=${userId}`,
        stack,
      );
      throw error;
    }
  }
}
