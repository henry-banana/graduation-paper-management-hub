import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  SubmissionResponseDto,
  CreateSubmissionResponseDto,
  DownloadResponseDto,
} from './dto';
import { AuthUser } from '../../common/types';
import {
  buildVersionLabel,
  FileType,
  SubmissionStatus,
  SUBMISSION_POLICY_ERROR_CODES,
  VersionLabel,
} from './submission.constants';
import {
  SubmissionFileInfo,
  SubmissionFileValidatorService,
} from './submission-file-validator.service';
import {
  RevisionRoundRecord,
  RevisionRoundsRepository,
  SubmissionsRepository,
  TopicsRepository,
  AssignmentsRepository,
} from '../../infrastructure/google-sheets';
import { GoogleDriveClient } from '../../infrastructure/google-drive';
import type { TopicRecord } from '../topics/topics.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface SubmissionRecord {
  id: string;
  topicId: string;
  uploaderUserId: string;
  fileType: FileType;
  revisionRoundId?: string;
  revisionRoundNumber?: number;
  versionNumber: number;
  versionLabel: VersionLabel;
  status: SubmissionStatus;
  deadlineAt?: string;
  confirmedAt?: string;
  isLocked: boolean;
  canReplace: boolean;
  driveFileId?: string;
  driveLink?: string;
  uploadedAt: string;
  originalFileName?: string;
  fileSize?: number;
  // Teacher-readable reference columns (written to TenDetai sheet cols A-D)
  _emailSV?: string;
  _tendetai?: string;
  _dotHK?: string;
  _loaidetai?: string;
}

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    private readonly fileValidator: SubmissionFileValidatorService,
    private readonly submissionsRepository: SubmissionsRepository,
    private readonly topicsRepository: TopicsRepository,
    private readonly revisionRoundsRepository: RevisionRoundsRepository,
    private readonly assignmentsRepository: AssignmentsRepository,
    private readonly googleDriveClient: GoogleDriveClient,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
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
    await this.ensureCanReadTopic(topic, user);

    const submissions = await this.submissionsRepository.findAll();
    const topicSubmissions = submissions
      .filter((s) => s.topicId === topicId)
      .map((s) => this.syncSubmissionPolicyFlags(s));

    return topicSubmissions
      .sort((a, b) => {
        const aRound = a.revisionRoundNumber ?? 0;
        const bRound = b.revisionRoundNumber ?? 0;
        if (aRound !== bRound) {
          return bRound - aRound;
        }
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      })
      .map((s) => this.mapToDto(s));
  }

  /**
   * Get submission by ID
   */
  async findById(
    submissionId: string,
    user: AuthUser,
  ): Promise<SubmissionRecord | null> {
    const submission = await this.submissionsRepository.findById(submissionId);
    if (!submission) {
      return null;
    }

    const topic = await this.topicsRepository.findById(submission.topicId);
    if (!topic) {
      return null;
    }

    await this.ensureCanReadTopic(topic, user);

    return this.syncSubmissionPolicyFlags(submission);
  }

  /**
   * Create a new submission (upload file)
   */
  async create(
    topicId: string,
    fileType: FileType,
    user: AuthUser,
    fileInfo: SubmissionFileInfo | undefined,
    fileBuffer: Buffer,
  ): Promise<CreateSubmissionResponseDto> {
    const topic = await this.getTopicOrThrow(topicId);
    await this.assertUploadPermission(topic, fileType, user);
    this.assertUploadState(topic, fileType);
    const validatedFile = this.fileValidator.validate(fileInfo);

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('Uploaded file content is empty');
    }

    const revisionRound = await this.resolveSubmissionRound(topic, fileType);

    const submissions = await this.submissionsRepository.findAll();
    const sameRoundSubmission = submissions
      .filter(
        (s) =>
          s.topicId === topicId &&
          s.fileType === fileType &&
          s.revisionRoundNumber === revisionRound.roundNumber,
      )
      .sort(
        (a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
      )[0];

    if (sameRoundSubmission) {
      const policyState = this.syncSubmissionPolicyFlags(sameRoundSubmission);
      if (!policyState.canReplace || policyState.isLocked) {
        throw this.createPolicyConflict(
          SUBMISSION_POLICY_ERROR_CODES.OVERDUE_SUBMISSION_LOCKED,
          'Submission is locked and cannot be replaced after deadline',
        );
      }

      return this.replaceSubmission(
        topic,
        policyState,
        fileType,
        user,
        validatedFile,
        fileBuffer,
        undefined,
      );
    }

    return this.createSubmissionInRound(
      topic,
      revisionRound,
      fileType,
      user,
      validatedFile,
      fileBuffer,
    );
  }

  async confirm(
    submissionId: string,
    user: AuthUser,
    note?: string,
  ): Promise<SubmissionResponseDto> {
    const submission = await this.submissionsRepository.findById(submissionId);
    if (!submission) {
      throw new NotFoundException(`Submission with ID ${submissionId} not found`);
    }

    const topic = await this.getTopicOrThrow(submission.topicId);
    await this.assertSubmitterOwnership(submission, topic, user);

    const policyState = this.syncSubmissionPolicyFlags(submission);

    if (policyState.isLocked) {
      throw this.createPolicyConflict(
        SUBMISSION_POLICY_ERROR_CODES.OVERDUE_SUBMISSION_LOCKED,
        'Submission is locked and cannot be confirmed',
      );
    }

    policyState.status = 'CONFIRMED';
    policyState.confirmedAt = new Date().toISOString();
    policyState.canReplace = !policyState.isLocked;

    await this.submissionsRepository.update(policyState.id, policyState);

    await this.auditService.log({
      action: 'SUBMISSION_CONFIRMED',
      actorId: user.userId,
      actorRole: user.role,
      topicId: topic.id,
      detail: {
        submissionId: policyState.id,
        revisionRoundNumber: policyState.revisionRoundNumber,
        versionNumber: policyState.versionNumber,
        note: note?.trim() || undefined,
      },
    });

    await this.notificationsService.create({
      receiverUserId: topic.supervisorUserId,
      type: 'SUBMISSION_CONFIRMED',
      topicId: topic.id,
      context: {
        topicTitle: topic.title,
        version: policyState.versionLabel,
      },
    });

    return this.mapToDto(policyState);
  }

  async replace(
    submissionId: string,
    user: AuthUser,
    fileInfo: SubmissionFileInfo | undefined,
    fileBuffer: Buffer,
    reason?: string,
  ): Promise<CreateSubmissionResponseDto> {
    const submission = await this.submissionsRepository.findById(submissionId);
    if (!submission) {
      throw new NotFoundException(`Submission with ID ${submissionId} not found`);
    }

    const topic = await this.getTopicOrThrow(submission.topicId);
    await this.assertSubmitterOwnership(submission, topic, user);
    await this.assertUploadPermission(topic, submission.fileType, user);

    const validatedFile = this.fileValidator.validate(fileInfo);
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('Uploaded file content is empty');
    }

    const policyState = this.syncSubmissionPolicyFlags(submission);
    if (!policyState.canReplace || policyState.isLocked) {
      throw this.createPolicyConflict(
        SUBMISSION_POLICY_ERROR_CODES.VERSION_IMMUTABLE_OUTSIDE_DEADLINE,
        'Submission version is immutable outside allowed deadline',
      );
    }

    return this.replaceSubmission(
      topic,
      policyState,
      submission.fileType,
      user,
      validatedFile,
      fileBuffer,
      reason,
    );
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

    const downloadUrl = `https://drive.google.com/uc?id=${submission.driveFileId}&export=download`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

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
    await this.ensureCanReadTopic(topic, user);

    const submissions = await this.submissionsRepository.findAll();
    const matching = submissions
      .filter((s) => s.topicId === topicId && s.fileType === fileType)
      .map((s) => this.syncSubmissionPolicyFlags(s))
      .sort((a, b) => {
        const roundDiff = (b.revisionRoundNumber ?? 0) - (a.revisionRoundNumber ?? 0);
        if (roundDiff !== 0) {
          return roundDiff;
        }
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      });

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
      revisionRoundId: record.revisionRoundId,
      revisionRoundNumber: record.revisionRoundNumber,
      version: record.versionNumber,
      versionLabel: record.versionLabel,
      status: record.status,
      deadlineAt: record.deadlineAt,
      confirmedAt: record.confirmedAt,
      isLocked: record.isLocked,
      canReplace: record.canReplace,
      driveFileId: record.driveFileId,
      driveLink: record.driveLink,
      uploadedAt: record.uploadedAt,
      originalFileName: record.originalFileName,
      fileSize: record.fileSize,
    };
  }

  private async createSubmissionInRound(
    topic: TopicRecord,
    revisionRound: RevisionRoundRecord,
    fileType: FileType,
    user: AuthUser,
    validatedFile: SubmissionFileInfo,
    fileBuffer: Buffer,
  ): Promise<CreateSubmissionResponseDto> {
    const uploadResult = await this.uploadFileToDrive(
      validatedFile,
      fileBuffer,
      user.userId,
      topic.id,
      fileType,
    );

    const newSubmission: SubmissionRecord = {
      id: this.generateId(),
      topicId: topic.id,
      uploaderUserId: user.userId,
      fileType,
      revisionRoundId: revisionRound.id,
      revisionRoundNumber: revisionRound.roundNumber,
      versionNumber: revisionRound.roundNumber,
      versionLabel: buildVersionLabel(revisionRound.roundNumber),
      status: 'DRAFT',
      deadlineAt: revisionRound.endAt,
      confirmedAt: undefined,
      isLocked: false,
      canReplace: true,
      driveFileId: uploadResult.fileId,
      driveLink: uploadResult.webViewLink,
      uploadedAt: new Date().toISOString(),
      originalFileName: validatedFile.originalFileName,
      fileSize: validatedFile.fileSize,
      // Populate teacher-visible columns so sheets stay readable
      _emailSV: user.email,
      _tendetai: topic.title,
      _dotHK: topic.periodId, // periodId maps to Dot code (e.g. HK1-2025-2026)
      _loaidetai: topic.type, // BCTT | KLTN
    };

    await this.submissionsRepository.create(newSubmission);

    await this.auditService.log({
      action: 'SUBMISSION_UPLOADED',
      actorId: user.userId,
      actorRole: user.role,
      topicId: topic.id,
      detail: {
        submissionId: newSubmission.id,
        revisionRoundNumber: newSubmission.revisionRoundNumber,
        versionNumber: newSubmission.versionNumber,
        fileType,
      },
    });

    await this.notificationsService.create({
      receiverUserId: topic.supervisorUserId,
      type: 'SUBMISSION_UPLOADED',
      topicId: topic.id,
      context: {
        topicTitle: topic.title,
        fileType,
        version: newSubmission.versionLabel,
      },
    });

    return {
      id: newSubmission.id,
      revisionRoundNumber: newSubmission.revisionRoundNumber,
      version: newSubmission.versionNumber,
      versionLabel: newSubmission.versionLabel,
      driveFileId: newSubmission.driveFileId,
      deadlineAt: newSubmission.deadlineAt,
      canReplace: true,
    };
  }

  private async replaceSubmission(
    topic: TopicRecord,
    submission: SubmissionRecord,
    fileType: FileType,
    user: AuthUser,
    validatedFile: SubmissionFileInfo,
    fileBuffer: Buffer,
    replacementReason?: string,
  ): Promise<CreateSubmissionResponseDto> {
    const uploadResult = await this.uploadFileToDrive(
      validatedFile,
      fileBuffer,
      user.userId,
      topic.id,
      fileType,
    );

    submission.driveFileId = uploadResult.fileId;
    submission.driveLink = uploadResult.webViewLink;
    submission.uploadedAt = new Date().toISOString();
    submission.originalFileName = validatedFile.originalFileName;
    submission.fileSize = validatedFile.fileSize;
    submission.canReplace = !submission.isLocked;

    await this.submissionsRepository.update(submission.id, submission);

    await this.auditService.log({
      action: 'SUBMISSION_REPLACED_IN_DEADLINE',
      actorId: user.userId,
      actorRole: user.role,
      topicId: topic.id,
      detail: {
        submissionId: submission.id,
        revisionRoundNumber: submission.revisionRoundNumber,
        versionNumber: submission.versionNumber,
        reason: replacementReason?.trim() || undefined,
      },
    });

    await this.notificationsService.create({
      receiverUserId: topic.supervisorUserId,
      type: 'SUBMISSION_UPLOADED',
      topicId: topic.id,
      context: {
        topicTitle: topic.title,
        fileType,
        version: submission.versionLabel,
      },
    });

    return {
      id: submission.id,
      revisionRoundNumber: submission.revisionRoundNumber,
      version: submission.versionNumber,
      versionLabel: submission.versionLabel,
      driveFileId: submission.driveFileId,
      deadlineAt: submission.deadlineAt,
      canReplace: submission.canReplace,
    };
  }

  private async resolveSubmissionRound(
    topic: TopicRecord,
    fileType: FileType,
  ): Promise<RevisionRoundRecord> {
    if (fileType !== 'REVISION') {
      return this.createPseudoRound(topic.submitStartAt, topic.submitEndAt, 1, topic.id, 'SYSTEM');
    }

    const rounds = await this.revisionRoundsRepository.findWhere(
      (round) => round.topicId === topic.id && round.status === 'OPEN',
    );

    if (!rounds.length) {
      if (topic.submitStartAt && topic.submitEndAt) {
        return this.createPseudoRound(topic.submitStartAt, topic.submitEndAt, 1, topic.id, 'SYSTEM');
      }

      throw this.createPolicyConflict(
        SUBMISSION_POLICY_ERROR_CODES.REVISION_ROUND_NOT_OPEN,
        'Revision round is not open for this topic',
      );
    }

    return rounds.sort((a, b) => b.roundNumber - a.roundNumber)[0];
  }

  private createPseudoRound(
    startAt: string | undefined,
    endAt: string | undefined,
    roundNumber: number,
    topicId: string,
    requestedBy: string,
  ): RevisionRoundRecord {
    if (!startAt || !endAt) {
      throw new ConflictException('Submission window is not configured');
    }

    return {
      id: `round_${topicId}_${roundNumber}`,
      topicId,
      roundNumber,
      status: 'OPEN',
      startAt,
      endAt,
      requestedBy,
      reason: undefined,
      createdAt: startAt,
      updatedAt: startAt,
    };
  }

  private syncSubmissionPolicyFlags(submission: SubmissionRecord): SubmissionRecord {
    const deadline = submission.deadlineAt ? new Date(submission.deadlineAt).getTime() : NaN;
    const hasDeadline = !Number.isNaN(deadline);
    const overdue = hasDeadline ? Date.now() > deadline : false;

    const wasLocked = submission.isLocked;
    submission.isLocked = overdue;
    submission.canReplace = !overdue;

    if (overdue && submission.status !== 'LOCKED') {
      submission.status = 'LOCKED';
    }

    if (!overdue && submission.status === 'LOCKED') {
      submission.status = submission.confirmedAt ? 'CONFIRMED' : 'DRAFT';
    }

    if (overdue && !wasLocked) {
      void this.auditService.log({
        action: 'SUBMISSION_LOCKED_OVERDUE',
        actorId: 'SYSTEM',
        actorRole: 'SYSTEM',
        topicId: submission.topicId,
        detail: {
          submissionId: submission.id,
          revisionRoundNumber: submission.revisionRoundNumber,
          deadlineAt: submission.deadlineAt,
        },
      });

      void this.submissionsRepository.update(submission.id, submission);
    }

    return submission;
  }

  private async uploadFileToDrive(
    validatedFile: SubmissionFileInfo,
    fileBuffer: Buffer,
    userId: string,
    topicId: string,
    fileType: FileType,
  ): Promise<{ fileId: string; webViewLink: string; webContentLink?: string }> {
    this.logger.log(
      `Submission upload requested topicId=${topicId} userId=${userId} fileType=${fileType}`,
    );

    const uploadFolderId = await this.resolveUploadFolderForUser(userId);
    const fallbackDriveId = `drv_${crypto.randomBytes(6).toString('hex')}`;

    if (this.googleDriveClient.isReady()) {
      try {
        const uploadResult = await this.googleDriveClient.uploadFile(
          validatedFile.originalFileName,
          validatedFile.mimeType,
          fileBuffer,
          uploadFolderId,
        );

        this.logger.log(
          `Submission upload succeeded topicId=${topicId} userId=${userId} fileId=${uploadResult.fileId} folderId=${uploadFolderId ?? 'root'}`,
        );

        return uploadResult;
      } catch (error) {
        const stack = error instanceof Error ? error.stack : String(error);
        this.logger.error(
          `Submission upload failed topicId=${topicId} userId=${userId} fileType=${fileType}`,
          stack,
        );
        throw error;
      }
    }

    this.logger.warn(
      `Google Drive client is not ready, using fallback upload metadata topicId=${topicId} userId=${userId}`,
    );

    return {
      fileId: fallbackDriveId,
      webViewLink: `https://drive.google.com/file/d/${fallbackDriveId}`,
    };
  }

  private async getTopicOrThrow(topicId: string): Promise<TopicRecord> {
    const topic = await this.topicsRepository.findById(topicId);
    if (!topic) {
      throw new NotFoundException(`Topic with ID ${topicId} not found`);
    }

    return topic;
  }

  private async ensureCanReadTopic(topic: TopicRecord, user: AuthUser): Promise<void> {
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
      // GVHD (supervisor) always has access
      if (topic.supervisorUserId === user.userId) {
        await this.assertActiveAssignmentIfPresent(topic.id, user.userId, [
          'GVHD',
        ]);
        return;
      }
      // GVPB / Council: check if assigned to this topic via Assignments sheet
      const assignments = await this.assignmentsRepository.findAll();
      const isAssigned = assignments.some(
        (a) =>
          a.topicId === topic.id &&
          a.userId === user.userId &&
          a.status === 'ACTIVE',
      );
      if (isAssigned) {
        return;
      }
      throw new ForbiddenException('Cannot access this topic');
    }

    throw new ForbiddenException('Cannot access this topic');
  }

  private assertSubmitterOwnership(
    submission: SubmissionRecord,
    topic: TopicRecord,
    user: AuthUser,
  ): Promise<void> {
    if (user.role === 'TBM') {
      return Promise.resolve();
    }

    if (user.role === 'STUDENT' && topic.studentUserId === user.userId) {
      return Promise.resolve();
    }

    if (user.role === 'LECTURER' && topic.supervisorUserId === user.userId) {
      return this.assertActiveAssignmentIfPresent(topic.id, user.userId, [
        'GVHD',
      ]);
    }

    return Promise.reject(
      new ForbiddenException('Cannot modify this submission'),
    );
  }

  private async assertUploadPermission(
    topic: TopicRecord,
    fileType: FileType,
    user: AuthUser,
  ): Promise<void> {
    if (fileType === 'REPORT') {
      if (user.role !== 'STUDENT' || topic.studentUserId !== user.userId) {
        throw new ForbiddenException(
          'Only the topic owner student can upload REPORT files',
        );
      }

      return;
    }

    if (fileType === 'INTERNSHIP_CONFIRMATION') {
      if (topic.type !== 'BCTT') {
        throw new ConflictException(
          'INTERNSHIP_CONFIRMATION submissions are only supported for BCTT topics',
        );
      }

      if (user.role !== 'STUDENT' || topic.studentUserId !== user.userId) {
        throw new ForbiddenException(
          'Only the topic owner student can upload INTERNSHIP_CONFIRMATION files',
        );
      }

      return;
    }

    if (fileType === 'REVISION') {
      if (topic.type !== 'KLTN') {
        throw new ConflictException(
          'REVISION submissions are only supported for KLTN topics',
        );
      }

      if (user.role !== 'STUDENT' || topic.studentUserId !== user.userId) {
        throw new ForbiddenException(
          'Only the topic owner student can upload REVISION files',
        );
      }

      return;
    }

    if (fileType !== 'TURNITIN') {
      throw new ConflictException(`Unsupported submission file type: ${fileType}`);
    }

    if (topic.type !== 'KLTN') {
      throw new ConflictException(
        'TURNITIN submissions are only supported for KLTN topics',
      );
    }

    if (user.role !== 'LECTURER' || topic.supervisorUserId !== user.userId) {
      throw new ForbiddenException(
        'Only topic supervisor can upload TURNITIN files',
      );
    }

    await this.assertActiveAssignmentIfPresent(topic.id, user.userId, ['GVHD']);
  }

  private async assertActiveAssignmentIfPresent(
    topicId: string,
    userId: string,
    acceptedRoles: Array<'GVHD' | 'GVPB' | 'TV_HD' | 'CT_HD' | 'TK_HD'>,
  ): Promise<void> {
    const assignments = await this.assignmentsRepository.findAll();
    const scopedAssignments = assignments.filter(
      (assignment) => assignment.topicId === topicId && assignment.userId === userId,
    );

    // Legacy-safe fallback: if no assignment row exists, keep existing owner-based behavior.
    if (scopedAssignments.length === 0) {
      return;
    }

    const hasActiveAssignment = scopedAssignments.some(
      (assignment) =>
        assignment.status === 'ACTIVE' && acceptedRoles.includes(assignment.topicRole),
    );

    if (!hasActiveAssignment) {
      throw new ForbiddenException('Cannot access this topic');
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

    if (fileType === 'INTERNSHIP_CONFIRMATION') {
      if (topic.type !== 'BCTT') {
        throw new ConflictException(
          `Cannot upload INTERNSHIP_CONFIRMATION for topic type: ${topic.type}`,
        );
      }

      if (topic.state !== 'IN_PROGRESS') {
        throw new ConflictException(
          `Cannot upload INTERNSHIP_CONFIRMATION in topic state: ${topic.state}`,
        );
      }

      return;
    }

    if (fileType === 'TURNITIN') {
      // KLTN: allow upload when IN_PROGRESS or PENDING_CONFIRM (GV uploads after SV submits)
      const allowedTurnitinStates = ['IN_PROGRESS', 'PENDING_CONFIRM', 'GRADING'];
      if (!allowedTurnitinStates.includes(topic.state)) {
        throw new ConflictException(
          `Cannot upload TURNITIN in topic state: ${topic.state}`,
        );
      }

      return;
    }

    const allowedRevisionStates = ['SCORING', 'COMPLETED'];
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

  private createPolicyConflict(code: string, message: string): ConflictException {
    return new ConflictException({
      error: code,
      message,
      code,
    });
  }
}
