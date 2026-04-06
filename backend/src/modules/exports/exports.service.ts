import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  ExportResponseDto,
  ExportType,
  ExportStatus,
} from './dto/export-response.dto';
import { AuthUser, TopicRole } from '../../common/types';
import {
  EXPORT_DOCX_MIME_TYPE,
  EXPORT_JSON_MIME_TYPE,
  EXPORT_PDF_MIME_TYPE,
  KltnRubricExportRole,
  KLTN_RUBRIC_EXPORT_ROLES,
} from './exports.constants';
import {
  ExportFilesRepository,
  PeriodsRepository,
  ScoresRepository,
  TopicsRepository,
  UsersRepository,
  AssignmentsRepository,
  ScoreSummariesRepository,
  SchedulesRepository,
} from '../../infrastructure/google-sheets';
import { GoogleDriveClient } from '../../infrastructure/google-drive';
import {
  GeneratedDocument,
  RubricGeneratorService,
} from './rubric-generator/rubric-generator.service';
import { MinutesGeneratorService } from './minutes-generator/minutes-generator.service';
import { PdfConverterService } from './pdf-converter/pdf-converter.service';
import type { MinutesTemplateData } from './minutes-generator/minutes.template';
import type { TopicRecord } from '../topics/topics.service';
import type { ScoreRecord } from '../scores/scores.service';
import type { UserRecord } from '../users/users.service';
import type { PeriodRecord } from '../periods/periods.service';
import type { RubricItem } from '../scores/dto';
import type { AssignmentRecord } from '../assignments/assignments.service';
import type { ScoreSummaryRecord } from '../scores/scores.service';
import { ExportMinutesDto } from './dto';


export interface ExportRecord {
  id: string;
  topicId: string;
  exportType: ExportType;
  status: ExportStatus;
  driveFileId?: string;
  driveLink?: string;
  downloadUrl?: string;
  fileName?: string;
  mimeType?: string;
  errorMessage?: string;
  requestedBy: string;
  dedupKey?: string;
  createdAt: string;
  completedAt?: string;
  expiresAt?: string;
}

interface ExportMetadata {
  role?: KltnRubricExportRole;
  scoreId?: string;
}

interface TopicContext {
  student: UserRecord;
  supervisor: UserRecord;
  period: PeriodRecord;
}

@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);

  constructor(
    private readonly exportFilesRepository: ExportFilesRepository,
    private readonly topicsRepository: TopicsRepository,
    private readonly scoresRepository: ScoresRepository,
    private readonly usersRepository: UsersRepository,
    private readonly periodsRepository: PeriodsRepository,
    private readonly assignmentsRepository: AssignmentsRepository,
    private readonly scoreSummariesRepository: ScoreSummariesRepository,
    private readonly schedulesRepository: SchedulesRepository,
    private readonly googleDriveClient: GoogleDriveClient,
    private readonly rubricGeneratorService: RubricGeneratorService,
    private readonly minutesGeneratorService: MinutesGeneratorService,
    private readonly pdfConverterService: PdfConverterService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Export biên bản họp hội đồng bảo vệ (MINUTES) as PDF.
   * dto chứa các dữ liệu do hội đồng nhập sau buổi bảo vệ (nhận xét, yêu cầu chỉnh sửa, địa điểm).
   */
  async exportMinutes(
    topicId: string,
    dto: ExportMinutesDto,
    user: AuthUser,
  ): Promise<ExportResponseDto> {
    const topic = await this.getTopicOrThrow(topicId);
    await this.assertTopicAccess(topic, user);

    // Gather topic context
    const [student, supervisor, period] = await Promise.all([
      this.usersRepository.findById(topic.studentUserId),
      this.usersRepository.findById(topic.supervisorUserId),
      this.periodsRepository.findById(topic.periodId),
    ]);

    if (!student || !supervisor || !period) {
      throw new NotFoundException('Không tìm thấy thông tin sinh viên hoặc GVHD');
    }

    // Get assignments to find council roles
    const assignments = await this.assignmentsRepository.findByTopicId(topicId);
    const supervisorAssignment = assignments.find(
      (a) =>
        a.topicRole === 'GVHD' &&
        a.status === 'ACTIVE' &&
        a.userId === topic.supervisorUserId,
    );
    const chairAssignment = assignments.find((a) => a.topicRole === 'CT_HD' && a.status === 'ACTIVE');
    const secretaryAssignment = assignments.find((a) => a.topicRole === 'TK_HD' && a.status === 'ACTIVE');
    const reviewerAssignment = assignments.find((a) => a.topicRole === 'GVPB' && a.status === 'ACTIVE');
    const tvhdAssignments = assignments.filter((a) => a.topicRole === 'TV_HD' && a.status === 'ACTIVE');

    // Validate required assignment chain before generating legally valid minutes.
    const missingRoles: string[] = [];
    if (!supervisorAssignment) missingRoles.push('GVHD');
    if (!reviewerAssignment) missingRoles.push('GVPB');
    if (!chairAssignment) missingRoles.push('CT_HD');
    if (!secretaryAssignment) missingRoles.push('TK_HD');
    if (tvhdAssignments.length === 0) missingRoles.push('TV_HD');
    if (missingRoles.length > 0) {
      throw new ConflictException(
        `Cần phân công đầy đủ trước khi xuất biên bản. Thiếu: ${missingRoles.join(', ')}`,
      );
    }

    // Resolve council names
    const chairUser = await this.usersRepository.findById(chairAssignment!.userId);
    const secretaryUser = await this.usersRepository.findById(secretaryAssignment!.userId);
    const reviewerUser = await this.usersRepository.findById(reviewerAssignment!.userId);
    const tvhdUsers = await Promise.all(
      tvhdAssignments.map((a) => this.usersRepository.findById(a.userId)),
    );
    if (!chairUser || !secretaryUser || !reviewerUser || tvhdUsers.some((u) => !u)) {
      throw new NotFoundException('Không tìm thấy đầy đủ thông tin giảng viên hội đồng');
    }
    const resolvedTvhdUsers = tvhdUsers.filter(
      (u): u is UserRecord => Boolean(u),
    );

    // Get score summary for final score
    const summaries = await this.scoreSummariesRepository.findWhere((s) => s.topicId === topicId);
    const summary = summaries[0];

    // Lấy lịch bảo vệ thật từ Schedules sheet để điền defenseDate chính xác vào biên bản
    const schedule = await this.schedulesRepository.findFirst((s) => s.topicId === topicId);
    if (!schedule?.defenseAt) {
      throw new ConflictException('Chưa có lịch bảo vệ (defenseAt). Vui lòng cập nhật lịch trước khi xuất biên bản.');
    }

    const defenseDateStr = new Date(schedule.defenseAt).toLocaleString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // defenseLocation: ưu tiên dto (do hội đồng ghi đè), sau đó lấy từ schedule
    const defenseLocation =
      dto.defenseLocation?.trim() ||
      schedule?.locationDetail ||
      (schedule?.locationType === 'ONLINE' ? 'Trực tuyến' : undefined);

    const templateData: MinutesTemplateData = {
      topicTitle: topic.title,
      topicType: topic.type as 'BCTT' | 'KLTN',
      period: period.code,
      studentName: student.name,
      studentId: student.studentId ?? '',
      chairName: chairUser.name,
      secretaryName: secretaryUser.name,
      supervisorName: supervisor.name,
      reviewerName: reviewerUser.name,
      councilMembers: resolvedTvhdUsers.map((u) => u.name),
      defenseDate: defenseDateStr,
      defenseLocation,
      // Nhận xét & yêu cầu chỉnh sửa từ body (do hội đồng nhập)
      supervisorComments: dto.supervisorComments?.trim(),
      chairComments: dto.chairComments?.trim(),
      revisionRequirements: dto.revisionRequirements?.trim(),
      revisionDeadline: dto.revisionDeadline?.trim(),
      finalScore: summary?.finalScore ?? undefined,
      result: (summary?.result as 'PASS' | 'FAIL' | 'PENDING') ?? 'PENDING',
    };

    // Generate PDF buffer
    let generated: Awaited<
      ReturnType<MinutesGeneratorService['generatePdf']>
    >;
    try {
      generated = await this.minutesGeneratorService.generatePdf(templateData);
    } catch (error) {
      const message = this.extractErrorMessage(error);
      this.logger.error(
        `Minutes export failed for topicId=${topicId}: ${message}`,
      );
      throw new ServiceUnavailableException(
        this.resolveMinutesExportFailureDetail(message),
      );
    }

    if (!generated.buffer?.length) {
      throw new ConflictException('Không thể tạo nội dung PDF biên bản');
    }
    if (generated.mimeType !== EXPORT_PDF_MIME_TYPE) {
      throw new ConflictException(
        `Định dạng biên bản không hợp lệ: ${generated.mimeType}`,
      );
    }

    const generatedDoc: GeneratedDocument = {
      filename: generated.filename,
      mimeType: generated.mimeType,
      buffer: generated.buffer,
    };

    const exportResult = await this.createExport(topicId, 'MINUTES', user, {}, generatedDoc);
    if (
      exportResult.status !== 'COMPLETED' ||
      !exportResult.driveFileId ||
      !exportResult.driveLink
    ) {
      throw new ConflictException(
        'Xuất biên bản thất bại. File PDF chưa được lưu hợp lệ lên Drive/DB.',
      );
    }
    return exportResult;
  }

  /**
   * Request rubric export for BCTT (Báo cáo tiến triển)
   */
  async exportRubricBctt(
    topicId: string,
    scoreId: string,
    user: AuthUser,
  ): Promise<ExportResponseDto> {
    if (!scoreId) {
      throw new BadRequestException('scoreId is required');
    }

    const topic = await this.getTopicOrThrow(topicId);
    if (topic.type !== 'BCTT') {
      throw new BadRequestException('Chỉ hỗ trợ xuất phiếu BCTT cho đề tài loại BCTT');
    }

    await this.assertTopicAccess(topic, user);
    const score = await this.getScoreOrThrow(
      scoreId,
      topic.id,
      'GVHD',
      user,
      topic,
    );
    const generatedDoc = await this.buildBcttRubricDocument(topic, score);

    return this.createExport(topicId, 'RUBRIC_BCTT', user, { scoreId }, generatedDoc);
  }

  /**
   * Request rubric export for KLTN (Khóa luận tốt nghiệp)
   */
  async exportRubricKltn(
    topicId: string,
    role: KltnRubricExportRole,
    scoreId: string,
    user: AuthUser,
  ): Promise<ExportResponseDto> {
    if (!KLTN_RUBRIC_EXPORT_ROLES.includes(role)) {
      throw new BadRequestException(`Unsupported role for KLTN rubric export: ${role}`);
    }

    if (!scoreId) {
      throw new BadRequestException('scoreId is required');
    }

    const topic = await this.getTopicOrThrow(topicId);
    if (topic.type !== 'KLTN') {
      throw new BadRequestException('Chỉ hỗ trợ xuất phiếu KLTN cho đề tài loại KLTN');
    }

    // KLTN rubric available from IN_PROGRESS onwards (GV/GVPB can export once score is submitted)
    const KLTN_EXPORT_ELIGIBLE_STATES = [
      'IN_PROGRESS', 'PENDING_CONFIRM', 'GRADING', 'SCORING', 'DEFENSE', 'COMPLETED',
    ];
    if (!KLTN_EXPORT_ELIGIBLE_STATES.includes(topic.state)) {
      throw new BadRequestException(
        `Phiếu chấm KLTN chỉ khả dụng khi đề tài đang thực hiện trở đi (hiện tại: ${topic.state})`,
      );
    }

    await this.assertTopicAccess(topic, user);
    const score = await this.getScoreOrThrow(scoreId, topic.id, role, user, topic);
    const generatedDoc = await this.buildKltnRubricDocument(topic, role, score);

    return this.createExport(
      topicId,
      'RUBRIC_KLTN',
      user,
      { role, scoreId },
      generatedDoc,
    );
  }

  /**
   * Export score sheet for a topic
   */
  async exportScoreSheet(
    topicId: string,
    user: AuthUser,
  ): Promise<ExportResponseDto> {
    const topic = await this.topicsRepository.findById(topicId);
    if (!topic) {
      throw new NotFoundException(`Đề tài ${topicId} không tồn tại`);
    }

    await this.assertTopicAccess(topic, user);

    return this.createExport(topicId, 'SCORE_SHEET', user);
  }

  /**
   * Export topic list (for period or all)
   */
  async exportTopicList(
    periodId: string | undefined,
    user: AuthUser,
  ): Promise<ExportResponseDto> {
    // Only TBM/admin can export topic lists
    if (user.role !== 'TBM') {
      throw new ForbiddenException('Chỉ TBM có thể xuất danh sách đề tài');
    }

    return this.createExport(periodId || 'all', 'TOPIC_LIST', user);
  }

  /**
   * Get export status by ID
   */
  async getExportById(
    exportId: string,
    user: AuthUser,
  ): Promise<ExportRecord | null> {
    const exportRecord = await this.exportFilesRepository.findById(exportId);
    if (!exportRecord) {
      return null;
    }

    // Only the requester or TBM can view export
    if (exportRecord.requestedBy !== user.userId && user.role !== 'TBM') {
      throw new ForbiddenException('Không có quyền xem export này');
    }

    return exportRecord;
  }

  /**
   * Get download URL for completed export
   */
  async getDownloadUrl(
    exportId: string,
    user: AuthUser,
  ): Promise<{ driveLink: string }> {
    const exportRecord = await this.getExportById(exportId, user);
    if (!exportRecord) {
      throw new NotFoundException(`Export ${exportId} không tồn tại`);
    }

    if (exportRecord.status !== 'COMPLETED') {
      throw new BadRequestException(
        `Export đang ở trạng thái ${exportRecord.status}, chưa sẵn sàng để tải`,
      );
    }

    if (!exportRecord.driveLink) {
      throw new BadRequestException('Drive link không khả dụng');
    }

    // Check expiration
    if (exportRecord.expiresAt && new Date(exportRecord.expiresAt) < new Date()) {
      throw new BadRequestException('Link tải đã hết hạn');
    }

    return {
      driveLink: exportRecord.driveLink,
    };
  }

  /**
   * List exports for current user
   */
  async findAll(
    user: AuthUser,
    options: { page: number; size: number },
  ): Promise<{
    data: ExportResponseDto[];
    pagination: { page: number; size: number; total: number };
  }> {
    const exports = await this.exportFilesRepository.findAll();
    let filtered: ExportRecord[];

    // TBM can see all exports, others only their own
    if (user.role === 'TBM') {
      filtered = [...exports];
    } else {
      filtered = exports.filter((e) => e.requestedBy === user.userId);
    }

    // Sort by createdAt desc
    filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const total = filtered.length;
    const start = (options.page - 1) * options.size;
    const paginated = filtered.slice(start, start + options.size);

    return {
      data: paginated.map((e) => this.mapToDto(e)),
      pagination: { page: options.page, size: options.size, total },
    };
  }

  /**
   * Create a new export request (internal).
   *
   * For RUBRIC exports: uploads the .docx file directly (preserving table layout)
   * into a per-student subfolder under GOOGLE_DRIVE_RUBRIC_FOLDER_ID.
   * For other exports: uploads to the default folder.
   */
  private async createExport(
    topicId: string,
    exportType: ExportType,
    user: AuthUser,
    metadata?: ExportMetadata,
    generatedDoc?: GeneratedDocument,
  ): Promise<ExportResponseDto> {
    const dedupKey = this.buildDedupKey(topicId, exportType, user.userId, metadata);
    const existingRecords = await this.exportFilesRepository.findWhere((record) => {
      if (record.topicId !== topicId || record.exportType !== exportType) return false;
      if (record.requestedBy !== user.userId) return false;
      if ((record.dedupKey ?? '') !== dedupKey) return false;
      if (record.status !== 'COMPLETED') return false;
      return !this.isExportRecordExpired(record);
    });
    if (existingRecords.length > 0) {
      const latest = [...existingRecords].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];
      this.logger.log(
        `[DB-07] Returning cached export record ${latest.id} (dedup key: ${dedupKey})`,
      );
      return this.mapToDto(latest);
    }

    const id = `exp_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();
    let fileToUpload =
      generatedDoc ?? this.buildMetadataDocument(id, topicId, exportType, user, metadata, now);

    // Determine whether this is a rubric export
    const isRubricExport = exportType.includes('RUBRIC');

    // Convert rubric DOCX to PDF (optional via env var ENABLE_RUBRIC_PDF_CONVERSION)
    // Bug fix: PDF conversion via HTML can lose table formatting
    // Default: disabled (export DOCX directly)
    const enablePdfConversion = this.configService.get('ENABLE_RUBRIC_PDF_CONVERSION', 'false') === 'true';
    
    if (isRubricExport && fileToUpload.mimeType === EXPORT_DOCX_MIME_TYPE && enablePdfConversion) {
      this.logger.log(`Converting rubric ${fileToUpload.filename} to PDF`);
      try {
        const converted = await this.pdfConverterService.convertDocxToPdf(
          fileToUpload.buffer,
          fileToUpload.filename,
        );
        fileToUpload = {
          filename: converted.pdfFilename,
          mimeType: EXPORT_PDF_MIME_TYPE,
          buffer: converted.pdfBuffer,
        };
        this.logger.log(`Successfully converted to ${converted.pdfFilename}`);
      } catch (conversionError) {
        const conversionMessage = this.extractErrorMessage(conversionError);
        this.logger.warn(
          `PDF conversion failed for ${fileToUpload.filename} (${conversionMessage}), uploading DOCX instead.`,
        );
        // Continue with DOCX if conversion fails
      }
    } else if (isRubricExport && fileToUpload.mimeType === EXPORT_DOCX_MIME_TYPE) {
      this.logger.log(`PDF conversion disabled (ENABLE_RUBRIC_PDF_CONVERSION=false), uploading DOCX: ${fileToUpload.filename}`);
    }

    let uploadedFileName = fileToUpload.filename;
    const uploadedMimeType = fileToUpload.mimeType;
    let driveFileId: string;
    let driveLink: string;
    const warnings: string[] = [];

    const rubricRootFolderId = isRubricExport
      ? (this.configService.get<string>('GOOGLE_DRIVE_RUBRIC_FOLDER_ID') ?? undefined)
      : undefined;

    if (this.googleDriveClient.isReady()) {
      try {
        // Resolve the target folder:
        // - Rubric exports → GOOGLE_DRIVE_RUBRIC_FOLDER_ID/[topicId]/
        //   (subfolder = ID của topic để group tất cả documents của 1 đề tài)
        // - Other exports  → GOOGLE_DRIVE_FOLDER_ID (default root)
        let targetFolderId: string | undefined;
        if (isRubricExport && rubricRootFolderId) {
          try {
            targetFolderId = await this.googleDriveClient.getOrCreateSubfolder(
              rubricRootFolderId,
              topicId,
            );
          } catch (folderErr) {
            const msg = `Could not create subfolder for topic ${topicId}: ${this.extractErrorMessage(folderErr)}. Falling back to rubric root.`;
            warnings.push(msg);
            this.logger.warn(msg);
            targetFolderId = rubricRootFolderId;
          }
        }

        // Upload file (DOCX or PDF depending on conversion result).
        // For rubrics: PDF preferred (better print quality)
        // For minutes: already PDF
        // This preserves table column widths and formatting perfectly.
        const upload = await this.googleDriveClient.uploadFile(
          fileToUpload.filename,
          fileToUpload.mimeType,
          fileToUpload.buffer,
          targetFolderId,
        );
        driveFileId = upload.fileId;
        driveLink = upload.webViewLink;
        uploadedFileName = fileToUpload.filename;
      } catch (error) {
        const uploadWarning = `Drive upload failed, use fallback link: ${this.extractErrorMessage(error)}`;
        warnings.push(uploadWarning);
        this.logger.warn(uploadWarning);

        const fallbackDriveId = `drv_${crypto.randomBytes(8).toString('hex')}`;
        driveFileId = fallbackDriveId;
        driveLink = `https://drive.google.com/file/d/${fallbackDriveId}/view`;
      }
    } else {
      const fallbackDriveId = `drv_${crypto.randomBytes(8).toString('hex')}`;
      driveFileId = fallbackDriveId;
      driveLink = `https://drive.google.com/file/d/${fallbackDriveId}/view`;
    }

    const uploadFailed = driveFileId?.startsWith('drv_') ?? false;

    const newExport: ExportRecord = {
      id,
      topicId,
      exportType,
      // FIX: nếu Drive upload thất bại (fallback id), đánh status FAILED thay vì COMPLETED.
      // Tránh trường hợp GV/SV tập h click link nhưng file không tồn tại trên Drive.
      status: uploadFailed ? 'FAILED' : 'COMPLETED',
      driveFileId,
      driveLink,
      downloadUrl: uploadFailed ? undefined : driveLink,
      fileName: uploadedFileName,
      mimeType: uploadedMimeType,
      errorMessage: warnings.length > 0 ? warnings.join(' | ') : undefined,
      requestedBy: user.userId,
      dedupKey,
      createdAt: now,
      completedAt: uploadFailed ? undefined : now,
      expiresAt: uploadFailed ? undefined : new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12 hours
    };

    await this.exportFilesRepository.create(newExport);

    return this.mapToDto(newExport);
  }


  /**
   * Map ExportRecord to DTO
   */
  mapToDto(record: ExportRecord): ExportResponseDto {
    return {
      id: record.id,
      topicId: record.topicId,
      exportType: record.exportType,
      status: record.status,
      driveFileId: record.driveFileId,
      driveLink: record.driveLink,
      downloadUrl: record.downloadUrl,
      fileName: record.fileName,
      mimeType: record.mimeType,
      errorMessage: record.errorMessage,
      requestedBy: record.requestedBy,
      createdAt: record.createdAt,
      completedAt: record.completedAt,
      expiresAt: record.expiresAt,
    };
  }

  private buildDedupKey(
    topicId: string,
    exportType: ExportType,
    requestedBy: string,
    metadata?: ExportMetadata,
  ): string {
    const rolePart = metadata?.role ?? '-';
    const scorePart = metadata?.scoreId ?? '-';
    return `${topicId}|${exportType}|${requestedBy}|${rolePart}|${scorePart}`;
  }

  private isExportRecordExpired(record: ExportRecord): boolean {
    const expirationIso = record.expiresAt ?? this.deriveLegacyExpiry(record);
    if (!expirationIso) return false;
    const expiration = new Date(expirationIso).getTime();
    if (Number.isNaN(expiration)) return false;
    return expiration <= Date.now();
  }

  private deriveLegacyExpiry(record: ExportRecord): string | undefined {
    const baseIso = record.completedAt ?? record.createdAt;
    if (!baseIso) return undefined;
    const base = new Date(baseIso).getTime();
    if (Number.isNaN(base)) return undefined;
    return new Date(base + 12 * 60 * 60 * 1000).toISOString();
  }

  private async getTopicOrThrow(topicId: string): Promise<TopicRecord> {
    const topic = await this.topicsRepository.findById(topicId);
    if (!topic) {
      throw new NotFoundException(`Đề tài ${topicId} không tồn tại`);
    }
    return topic;
  }

  /**
   * Authorization helper for exports: allow TBM, supervisor, or assigned council/reviewer lecturers.
   */
  private async assertTopicAccess(topic: TopicRecord, user: AuthUser): Promise<void> {
    if (user.role === 'TBM') return;

    if (user.role === 'STUDENT' && topic.studentUserId === user.userId) {
      return;
    }

    // Supervisor always allowed
    if (user.role === 'LECTURER' && topic.supervisorUserId === user.userId) {
      return;
    }

    // Check assignments for other lecturers
    const assignments = await this.assignmentsRepository.findByTopicId(topic.id);
    const allowedRoles: TopicRole[] = ['GVHD', 'GVPB', 'CT_HD', 'TK_HD', 'TV_HD'];
    const hasAssignment = assignments.some(
      (a) => a.userId === user.userId && allowedRoles.includes(a.topicRole) && a.status === 'ACTIVE',
    );

    if (!hasAssignment) {
      throw new ForbiddenException('Không có quyền xuất tài liệu cho đề tài này');
    }
  }

  private async getScoreOrThrow(
    scoreId: string,
    topicId: string,
    expectedRole: KltnRubricExportRole | 'GVHD',
    requester: AuthUser,
    topic?: TopicRecord,
  ): Promise<ScoreRecord> {
    const score = await this.scoresRepository.findById(scoreId);
    if (!score) {
      throw new NotFoundException(`Không tìm thấy bảng điểm ${scoreId}`);
    }

    if (score.topicId !== topicId) {
      throw new BadRequestException(`Bảng điểm ${scoreId} không thuộc đề tài ${topicId}`);
    }

    if (score.scorerRole !== expectedRole) {
      throw new BadRequestException(
        `Bảng điểm ${scoreId} không thuộc vai trò ${expectedRole}`,
      );
    }

    // Authorization: requester must be scorer, TBM, or owning student (for post-publish BCTT flow).
    const isStudentOwner =
      requester.role === 'STUDENT' &&
      topic?.studentUserId === requester.userId;
    if (
      requester.role !== 'TBM' &&
      score.scorerUserId !== requester.userId &&
      !isStudentOwner
    ) {
      throw new ForbiddenException('Bạn không có quyền xuất phiếu cho bảng điểm này');
    }

    if (score.status !== 'SUBMITTED') {
      throw new BadRequestException('Chỉ xuất phiếu từ bảng điểm đã submit');
    }

    return score;
  }

  private async resolveTopicContext(topic: TopicRecord): Promise<TopicContext> {
    const [student, supervisor, period] = await Promise.all([
      this.usersRepository.findById(topic.studentUserId),
      this.usersRepository.findById(topic.supervisorUserId),
      this.periodsRepository.findById(topic.periodId),
    ]);

    if (!student) {
      throw new NotFoundException(
        `Không tìm thấy sinh viên ${topic.studentUserId} cho đề tài ${topic.id}`,
      );
    }

    if (!supervisor) {
      throw new NotFoundException(
        `Không tìm thấy GVHD ${topic.supervisorUserId} cho đề tài ${topic.id}`,
      );
    }

    if (!period) {
      throw new NotFoundException(
        `Không tìm thấy đợt đăng ký ${topic.periodId} cho đề tài ${topic.id}`,
      );
    }

    return { student, supervisor, period };
  }

  private async buildBcttRubricDocument(
    topic: TopicRecord,
    score: ScoreRecord,
  ): Promise<GeneratedDocument> {
    const context = await this.resolveTopicContext(topic);
    const comments = this.collectScoreComments(score);

    return this.rubricGeneratorService.generateBctt({
      studentName: context.student.name,
      studentId: context.student.studentId ?? context.student.id,
      studentClass: this.deriveStudentClass(context.student),
      advisorName: context.supervisor.name,
      major:
        context.student.department ?? context.supervisor.department ?? 'Cong nghe thong tin',
      course: this.deriveCourse(context.student),
      company: topic.companyName ?? 'Chua cap nhat',
      topicTitle: topic.title,
      period: context.period.code,
      scores: {
        thaido: this.pickRubricScore(
          score.rubricData,
          ['thai do', 'tinh than', 'attitude'],
          2,
          score.totalScore,
        ),
        hinhthuc: this.pickRubricScore(
          score.rubricData,
          ['hinh thuc', 'presentation', 'format'],
          1,
          score.totalScore,
        ),
        modau: this.pickRubricScore(
          score.rubricData,
          ['mo dau', 'gioi thieu', 'introduction'],
          1,
          score.totalScore,
        ),
        noidung: this.pickRubricScore(
          score.rubricData,
          ['noi dung', 'implementation', 'content'],
          5,
          score.totalScore,
        ),
        ketluan: this.pickRubricScore(
          score.rubricData,
          ['ket luan', 'de nghi', 'conclusion'],
          1,
          score.totalScore,
        ),
      },
      totalScore: this.roundScore(score.totalScore),
      comments,
      evaluationDate: score.submittedAt ?? new Date().toISOString(),
    });
  }

  private async buildKltnRubricDocument(
    topic: TopicRecord,
    role: KltnRubricExportRole,
    score: ScoreRecord,
  ): Promise<GeneratedDocument> {
    const context = await this.resolveTopicContext(topic);
    const scorer = await this.usersRepository.findById(score.scorerUserId);

    if (!scorer) {
      throw new NotFoundException(`Không tìm thấy giảng viên chấm ${score.scorerUserId}`);
    }

    const comments = this.collectScoreComments(score);
    const allowDefense = score.allowDefense ?? score.totalScore >= 5;
    const questions =
      score.questions && score.questions.length > 0
        ? score.questions
        : ['Mo ta dong gop chinh cua de tai.', 'Huong phat trien tiep theo cua de tai la gi?'];

    if (role === 'GVHD') {
      return this.rubricGeneratorService.generateKltnGvhd({
        studentName: context.student.name,
        studentId: context.student.studentId ?? context.student.id,
        studentClass: this.deriveStudentClass(context.student),
        advisorName: context.supervisor.name,
        major:
          context.student.department ?? context.supervisor.department ?? 'Cong nghe thong tin',
        course: this.deriveCourse(context.student),
        topicTitle: topic.title,
        period: context.period.code,
        scores: {
          xacdinhvande: this.pickRubricScore(
            score.rubricData,
            ['xac dinh van de', 'problem'],
            1,
            score.totalScore,
          ),
          noidung: this.pickRubricScore(
            score.rubricData,
            ['noi dung', 'method', 'implementation'],
            3,
            score.totalScore,
          ),
          ketqua: this.pickRubricScore(
            score.rubricData,
            ['ket qua', 'result', 'ung dung'],
            3,
            score.totalScore,
          ),
          hinhthuc: this.pickRubricScore(
            score.rubricData,
            ['hinh thuc', 'format'],
            1,
            score.totalScore,
          ),
          tinhthan: this.pickRubricScore(
            score.rubricData,
            ['tinh than', 'thai do', 'attitude'],
            2,
            score.totalScore,
          ),
        },
        totalScore: this.roundScore(score.totalScore),
        allowDefense,
        conclusion: allowDefense
          ? 'Dong y cho sinh vien bao ve khoa luan.'
          : 'Yeu cau sinh vien chinh sua va danh gia lai.',
        comments,
        evaluationDate: score.submittedAt ?? new Date().toISOString(),
      });
    }

    if (role === 'GVPB') {
      return this.rubricGeneratorService.generateKltnGvpb({
        studentName: context.student.name,
        studentId: context.student.studentId ?? context.student.id,
        studentClass: this.deriveStudentClass(context.student),
        advisorName: context.supervisor.name,
        reviewerName: scorer.name,
        major:
          context.student.department ?? context.supervisor.department ?? 'Cong nghe thong tin',
        course: this.deriveCourse(context.student),
        topicTitle: topic.title,
        period: context.period.code,
        scores: {
          xacdinhvande: this.pickRubricScore(
            score.rubricData,
            ['xac dinh van de', 'problem'],
            1,
            score.totalScore,
          ),
          noidung: this.pickRubricScore(
            score.rubricData,
            ['noi dung', 'method', 'implementation'],
            3,
            score.totalScore,
          ),
          ketqua: this.pickRubricScore(
            score.rubricData,
            ['ket qua', 'result', 'ung dung'],
            3,
            score.totalScore,
          ),
          hinhthuc: this.pickRubricScore(
            score.rubricData,
            ['hinh thuc', 'format'],
            1,
            score.totalScore,
          ),
          traloi: this.pickRubricScore(
            score.rubricData,
            ['tra loi', 'question', 'qa'],
            2,
            score.totalScore,
          ),
        },
        totalScore: this.roundScore(score.totalScore),
        allowDefense,
        questions,
        conclusion: allowDefense
          ? 'Dong y cho sinh vien bao ve khoa luan.'
          : 'Can bo sung, chinh sua theo y kien phan bien.',
        comments,
        evaluationDate: score.submittedAt ?? new Date().toISOString(),
      });
    }

    return this.rubricGeneratorService.generateKltnCouncil({
      studentName: context.student.name,
      studentId: context.student.studentId ?? context.student.id,
      studentClass: this.deriveStudentClass(context.student),
      advisorName: context.supervisor.name,
      major:
        context.student.department ?? context.supervisor.department ?? 'Cong nghe thong tin',
      course: this.deriveCourse(context.student),
      topicTitle: topic.title,
      period: context.period.code,
      memberName: scorer.name,
      memberRole: 'TV_HD',
      scores: {
        noidung: this.pickRubricScore(
          score.rubricData,
          ['noi dung', 'implementation', 'chat luong'],
          4,
          score.totalScore,
        ),
        trinh_bay: this.pickRubricScore(
          score.rubricData,
          ['trinh bay', 'presentation'],
          2,
          score.totalScore,
        ),
        traloi: this.pickRubricScore(
          score.rubricData,
          ['tra loi', 'question', 'qa'],
          3,
          score.totalScore,
        ),
        hinhthuc: this.pickRubricScore(
          score.rubricData,
          ['hinh thuc', 'format'],
          1,
          score.totalScore,
        ),
      },
      totalScore: this.roundScore(score.totalScore),
      comments,
      evaluationDate: score.submittedAt ?? new Date().toISOString(),
    });
  }

  private buildMetadataDocument(
    exportId: string,
    topicId: string,
    exportType: ExportType,
    user: AuthUser,
    metadata: ExportMetadata | undefined,
    generatedAt: string,
  ): GeneratedDocument {
    const roleSuffix = metadata?.role ? `_${metadata.role.toLowerCase()}` : '';
    const fileBaseName = `${exportType.toLowerCase()}${roleSuffix}_${topicId}_${Date.now()}`;

    return {
      filename: `${fileBaseName}.json`,
      mimeType: EXPORT_JSON_MIME_TYPE,
      buffer: Buffer.from(
        JSON.stringify(
          {
            exportId,
            topicId,
            exportType,
            requestedBy: user.userId,
            generatedAt,
            metadata: metadata ?? null,
          },
          null,
          2,
        ),
        'utf-8',
      ),
    };
  }

  private pickRubricScore(
    rubricData: RubricItem[],
    aliases: string[],
    maxScore: number,
    totalScore: number,
  ): number {
    const normalizedAliases = aliases.map((alias) => this.normalizeText(alias));

    for (const item of rubricData) {
      const normalizedCriterion = this.normalizeText(item.criterion);
      if (
        normalizedAliases.some(
          (alias) =>
            normalizedCriterion.includes(alias) || alias.includes(normalizedCriterion),
        )
      ) {
        return this.roundScore(this.clampScore(item.score, maxScore));
      }
    }

    const weightedFallback = this.clampScore((totalScore / 10) * maxScore, maxScore);
    return this.roundScore(weightedFallback);
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private clampScore(score: number, maxScore: number): number {
    if (!Number.isFinite(score)) {
      return 0;
    }
    return Math.max(0, Math.min(score, maxScore));
  }

  private roundScore(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private deriveStudentClass(student: UserRecord): string {
    const cohort = this.deriveCohort(student);
    return cohort ? `K${cohort}-CNTT` : 'CNTT';
  }

  private deriveCourse(student: UserRecord): string {
    const cohort = this.deriveCohort(student);
    return cohort ? `K${cohort}` : 'Khong xac dinh';
  }

  private deriveCohort(student: UserRecord): string | null {
    if (!student.studentId || student.studentId.length < 2) {
      return null;
    }
    return student.studentId.slice(0, 2);
  }

  private collectScoreComments(score: ScoreRecord): string | undefined {
    const notes = score.rubricData
      .map((item) => item.note?.trim())
      .filter((note): note is string => Boolean(note));
    if (notes.length === 0) {
      return undefined;
    }
    return notes.join('; ');
  }

  private toPdfFilename(fileName: string): string {
    if (fileName.toLowerCase().endsWith('.docx')) {
      return `${fileName.slice(0, -5)}.pdf`;
    }
    return `${fileName}.pdf`;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown error';
  }

  private resolveMinutesExportFailureDetail(message: string): string {
    if (
      message.includes('No Chromium executable found') ||
      message.includes('Failed to launch the browser process')
    ) {
      return 'Không thể tạo PDF biên bản do dịch vụ PDF chưa sẵn sàng. Vui lòng liên hệ quản trị hệ thống để kiểm tra Chromium runtime.';
    }

    return 'Không thể tạo PDF biên bản lúc này. Vui lòng thử lại sau.';
  }
}
