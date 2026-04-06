import {
  Injectable,
  Optional,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  ScoreResponseDto,
  ScoreSummaryDto,
  DraftScoreResponseDto,
  SubmitScoreResponseDto,
  ConfirmScoreResponseDto,
  RequestScoreAppealResponseDto,
  ResolveScoreAppealResponseDto,
  ScoreAppealInfoDto,
  ScoreAppealStatus,
  ScorerRole,
  ScoreStatus,
  ScoreResult,
  RubricItem,
  SubmitAppealChoiceDto,
  AppealChoiceResponseDto,
  AppealChoice,
} from './dto';
import { CreateDraftScoreDto } from './dto/create-score.dto';
import { AuthUser, TopicRole } from '../../common/types';
import {
  SCORE_ALLOWED_TOPIC_STATES,
  SCORE_PASS_THRESHOLD,
} from './scores.constants';
import { ConfirmScoreRole, SummaryRequestRole } from './dto/submit-score.dto';
import {
  AssignmentsRepository,
  ExportFilesRepository,
  ScoreSummariesRepository,
  ScoresRepository,
  TopicsRepository,
  UsersRepository,
} from '../../infrastructure/google-sheets';
import type { TopicRecord } from '../topics/topics.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { ExportsService } from '../exports/exports.service';

export interface ScoreRecord {
  id: string;
  topicId: string;
  scorerUserId: string;
  scorerRole: ScorerRole;
  status: ScoreStatus;
  totalScore: number;
  rubricData: RubricItem[];
  allowDefense?: boolean;
  questions?: string[];
  submittedAt?: string;
  updatedAt: string;
  // Teacher-readable reference columns (written to Diểm sheet cols A-F)
  _email?: string;    // A: Email (student email)
  _tenSV?: string;    // B: Tên SV (student name)
  _mssv?: string;     // C: MSSV (student ID)
  _tenDetai?: string; // D: Tên Đề tài
  _gvName?: string;   // E: GV (scorer display name)
}

export interface ScoreSummaryRecord {
  id: string;
  topicId: string;
  gvhdScore?: number;
  gvpbScore?: number;
  councilAvgScore?: number;
  finalScore: number;
  result: ScoreResult;
  confirmedByGvhd: boolean;
  confirmedByCtHd: boolean;
  published: boolean;
  updatedAt?: string;           // DB-03: col K in ScoreSummaries sheet
  councilComments?: string;    // Góp ý bổ sung của hội đồng (do Thư ký nhập)
  appealRequestedAt?: string;
  appealRequestedBy?: string;
  appealReason?: string;
  appealStatus?: ScoreAppealStatus;
  appealResolvedAt?: string;
  appealResolvedBy?: string;
  appealResolutionNote?: string;
  appealScoreAdjusted?: boolean;
  // DB-14: Appeal choice workflow (NO_APPEAL auto-completes topic)
  appealChoice?: 'NO_APPEAL' | 'ACCEPT';  // Student choice after seeing published score
  appealChoiceAt?: string;                // Timestamp when choice made
  rubricDriveLink?: string;               // Auto-uploaded rubric link (populated when NO_APPEAL)
  // TK_HD aggregation lock (Bug #3)
  aggregatedByTkHd?: boolean;             // True when TK_HD completes aggregation
  aggregatedByTkHdAt?: string;            // Timestamp when TK_HD aggregated
  aggregatedByTkHdUserId?: string;        // TK_HD user ID who performed aggregation
}


const KLTN_SCORER_ROLES: ScorerRole[] = ['GVHD', 'GVPB', 'TV_HD'];

@Injectable()
export class ScoresService {
  private readonly logger = new Logger(ScoresService.name);
  constructor(
    private readonly scoresRepository: ScoresRepository,
    private readonly scoreSummariesRepository: ScoreSummariesRepository,
    private readonly topicsRepository: TopicsRepository,
    private readonly assignmentsRepository: AssignmentsRepository,
    private readonly usersRepository: UsersRepository,
    @Optional()
    private readonly exportsService?: ExportsService,
    @Optional()
    private readonly exportFilesRepository?: ExportFilesRepository,
    @Optional()
    private readonly notificationsService?: NotificationsService,
    @Optional()
    private readonly auditService?: AuditService,
  ) {}

  private generateId(): string {
    return `sc_${crypto.randomBytes(6).toString('hex')}`;
  }

  private roundTo2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private async getTopicOrThrow(topicId: string): Promise<TopicRecord> {
    const topic = await this.topicsRepository.findById(topicId);
    if (!topic) {
      throw new NotFoundException(`Topic with ID ${topicId} not found`);
    }

    return topic;
  }

  private async assertNotAggregatedLock(topicId: string): Promise<void> {
    const summary = await this.scoreSummariesRepository.findFirst(
      (record) => record.topicId === topicId,
    );

    if (summary?.aggregatedByTkHd) {
      throw new ConflictException(
        `Scores are locked by TK_HD aggregation at ${summary.aggregatedByTkHdAt}. This action is irreversible.`,
      );
    }
  }

  private toAppealInfo(summary?: ScoreSummaryRecord): ScoreAppealInfoDto | undefined {
    if (!summary?.appealRequestedAt) {
      return undefined;
    }

    return {
      requestedAt: summary.appealRequestedAt,
      requestedBy: summary.appealRequestedBy,
      reason: summary.appealReason,
      status: summary.appealStatus ?? 'PENDING',
      resolvedAt: summary.appealResolvedAt,
      resolvedBy: summary.appealResolvedBy,
      resolutionNote: summary.appealResolutionNote,
      scoreAdjusted: summary.appealScoreAdjusted,
    };
  }

  private isPendingAppeal(summary?: ScoreSummaryRecord): boolean {
    return summary?.appealStatus === 'PENDING';
  }

  private async getRubricDocxLink(topicId: string): Promise<string | undefined> {
    if (!this.exportFilesRepository) {
      return undefined;
    }

    const exports = await this.exportFilesRepository.findWhere(
      (record) =>
        record.topicId === topicId &&
        record.exportType === 'RUBRIC_BCTT' &&
        record.status === 'COMPLETED',
    );

    if (exports.length === 0) {
      return undefined;
    }

    const latest = exports.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];

    return latest.driveLink ?? latest.downloadUrl ?? undefined;
  }

  /**
   * Get KLTN rubric export link by role (GVHD, GVPB, TV_HD)
   */
  private async getKltnRubricLink(
    topicId: string,
    role: 'GVHD' | 'GVPB' | 'TV_HD',
  ): Promise<string | undefined> {
    if (!this.exportFilesRepository) {
      return undefined;
    }

    const exports = await this.exportFilesRepository.findWhere(
      (record) =>
        record.topicId === topicId &&
        record.exportType === 'RUBRIC_KLTN' &&
        record.status === 'COMPLETED',
    );

    if (exports.length === 0) {
      return undefined;
    }

    // Filter by role via fileName pattern (role is embedded in filename)
    // Example: rubric_kltn_GVHD_tp001.docx OR rubric_kltn_gvhd_tp001.docx
    // Use case-insensitive search to handle both uppercase and lowercase role names
    const roleExports = exports.filter((exp) =>
      exp.fileName?.toLowerCase().includes(`_${role.toLowerCase()}_`),
    );

    if (roleExports.length === 0) {
      return undefined;
    }

    const latest = roleExports.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];

    return latest.driveLink ?? latest.downloadUrl ?? undefined;
  }

  /**
   * Get defense minutes link (PDF)
   */
  private async getMinutesLink(topicId: string): Promise<string | undefined> {
    if (!this.exportFilesRepository) {
      return undefined;
    }

    const exports = await this.exportFilesRepository.findWhere(
      (record) =>
        record.topicId === topicId &&
        record.exportType === 'MINUTES' &&
        record.status === 'COMPLETED',
    );

    if (exports.length === 0) {
      return undefined;
    }

    const latest = exports.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];

    return latest.driveLink ?? latest.downloadUrl ?? undefined;
  }

  private async attachStudentFacingFields(
    base: ScoreSummaryDto,
    topic: TopicRecord,
    summaryRecord?: ScoreSummaryRecord,
  ): Promise<ScoreSummaryDto> {
    if (topic.type === 'BCTT') {
      // BCTT: rubric link + appeal info
      const rubricDocxLink =
        summaryRecord?.rubricDriveLink ?? (await this.getRubricDocxLink(topic.id));

      return {
        ...base,
        rubricDocxLink,
        appeal: this.toAppealInfo(summaryRecord),
        appealChoice: summaryRecord?.appealChoice,
        appealChoiceAt: summaryRecord?.appealChoiceAt,
      };
    }

    if (topic.type === 'KLTN') {
      // KLTN: multiple rubric links + minutes link
      const [gvhdRubricLink, gvpbRubricLink, councilRubricLink, minutesLink] =
        await Promise.all([
          this.getKltnRubricLink(topic.id, 'GVHD'),
          this.getKltnRubricLink(topic.id, 'GVPB'),
          this.getKltnRubricLink(topic.id, 'TV_HD'),
          this.getMinutesLink(topic.id),
        ]);

      return {
        ...base,
        gvhdRubricLink,
        gvpbRubricLink,
        councilRubricLink,
        minutesLink,
      };
    }

    // Default: no extra fields
    return base;
  }

  /**
   * Check if user has a formal assignment for this topic (Trangthaidetai tab),
   * OR if the user is the topic supervisor (supervisorUserId) which is equivalent to GVHD.
   */
  private async hasAssignment(
    topicId: string,
    userId: string,
    topicRole?: TopicRole,
  ): Promise<boolean> {
    // Check supervisor relationship first (fast path — avoids sheet read for GVHD)
    const topic = await this.topicsRepository.findById(topicId);
    if (topic && topic.supervisorUserId === userId) {
      // Supervisor is implicitly GVHD — allow if no specific role filter, or role is GVHD
      if (!topicRole || topicRole === 'GVHD') return true;
    }

    // Check formal Assignments sheet (for GVPB, TV_HD, CT_HD, TK_HD)
    const assignments = await this.assignmentsRepository.findAll();

    // Business rule: CT_HD and TK_HD are council members who also grade (like TV_HD).
    // When checking for TV_HD scoring permission, also accept CT_HD and TK_HD assignments.
    const effectiveRoles: TopicRole[] | undefined = topicRole === 'TV_HD'
      ? ['TV_HD', 'CT_HD', 'TK_HD']
      : topicRole ? [topicRole] : undefined;

    return assignments.some(
      (assignment) =>
        assignment.topicId === topicId &&
        assignment.userId === userId &&
        assignment.status === 'ACTIVE' &&
        (effectiveRoles === undefined || effectiveRoles.includes(assignment.topicRole)),
    );
  }

  private async assertScoreReadable(topic: TopicRecord, user: AuthUser): Promise<void> {
    if (user.role === 'TBM') {
      return;
    }

    if (user.role === 'STUDENT') {
      if (topic.studentUserId !== user.userId) {
        throw new ForbiddenException('Cannot view scores for this topic');
      }

      return;
    }

    if (user.role === 'LECTURER') {
      // Supervisor is always allowed to view their own topic's scores
      if (topic.supervisorUserId === user.userId) return;
      // Other lecturers must have a formal assignment
      if (await this.hasAssignment(topic.id, user.userId)) return;
      throw new ForbiddenException('Cannot view scores for this topic');
    }

    throw new ForbiddenException('Cannot view scores for this topic');
  }

  private assertScoringAllowed(topic: TopicRecord): void {
    const currentState =
      topic.state as (typeof SCORE_ALLOWED_TOPIC_STATES)[number];
    if (!SCORE_ALLOWED_TOPIC_STATES.includes(currentState)) {
      throw new ConflictException(`Cannot score topic in state: ${topic.state}`);
    }

    this.assertBcttDeadlineElapsed(topic);
  }

  private async ensureScoringStateAfterDefenseSubmit(
    topic: TopicRecord,
  ): Promise<TopicRecord> {
    if (topic.type !== 'KLTN' || topic.state !== 'DEFENSE') {
      return topic;
    }

    const latestTopic = await this.getTopicOrThrow(topic.id);
    if (latestTopic.type !== 'KLTN' || latestTopic.state !== 'DEFENSE') {
      return latestTopic;
    }

    latestTopic.state = 'SCORING';
    latestTopic.updatedAt = new Date().toISOString();
    await this.topicsRepository.update(latestTopic.id, latestTopic);

    this.logger.log(
      `[autoTransitionToScoring] topicId=${latestTopic.id} DEFENSE -> SCORING triggered by first submit`,
    );

    return latestTopic;
  }

  private assertBcttDeadlineElapsed(topic: TopicRecord): void {
    if (topic.type !== 'BCTT') {
      return;
    }

    // When topic is in GRADING state, TBM has explicitly moved it to grading phase —
    // deadline enforcement is no longer required (TBM assumes responsibility).
    if (topic.state === 'GRADING') {
      return;
    }

    if (!topic.submitEndAt) {
      this.logger.warn(
        `[assertBcttDeadlineElapsed] submitEndAt missing for topic=${topic.id}, allowing scoring (TBM override)`,
      );
      return;
    }

    const submitEnd = new Date(topic.submitEndAt).getTime();
    if (Number.isNaN(submitEnd)) {
      this.logger.warn(
        `[assertBcttDeadlineElapsed] submitEndAt invalid (${topic.submitEndAt}) for topic=${topic.id}, allowing scoring`,
      );
      return;
    }

    if (Date.now() <= submitEnd) {
      throw new ConflictException('Cannot score BCTT before submission deadline ends');
    }
  }

  private assertScorerRoleAllowed(topic: TopicRecord, scorerRole: ScorerRole): void {
    if (topic.type === 'BCTT' && scorerRole !== 'GVHD') {
      throw new ConflictException('BCTT topics only allow GVHD scoring');
    }

    if (topic.type === 'KLTN' && !KLTN_SCORER_ROLES.includes(scorerRole)) {
      throw new ConflictException(`KLTN topics do not support scorerRole ${scorerRole}`);
    }
  }

  private validateRubricData(rubricData: RubricItem[]): void {
    if (rubricData.length === 0) {
      throw new BadRequestException('rubricData must contain at least one item');
    }

    for (const item of rubricData) {
      if (item.score > item.max) {
        throw new BadRequestException(
          `Score for ${item.criterion} exceeds maximum (${item.score} > ${item.max})`,
        );
      }

      if (item.score < 0) {
        throw new BadRequestException(
          `Score for ${item.criterion} cannot be negative`,
        );
      }
    }
  }

  private async getSubmittedScoreEditability(
    topic: TopicRecord,
    score: ScoreRecord,
  ): Promise<{ editable: boolean; reason?: string }> {
    const summary = await this.scoreSummariesRepository.findFirst(
      (s) => s.topicId === topic.id,
    );

    // Bug #3: If TK_HD has aggregated, all scores are immutably locked
    if (summary?.aggregatedByTkHd) {
      return {
        editable: false,
        reason: `Scores locked by TK_HD aggregation at ${summary.aggregatedByTkHdAt}. This is irreversible.`,
      };
    }

    if (summary?.published) {
      return {
        editable: false,
        reason: 'Score summary has been published',
      };
    }

    if (summary?.confirmedByGvhd || summary?.confirmedByCtHd) {
      return {
        editable: false,
        reason: 'Score summary has been confirmed',
      };
    }

    if (topic.type === 'BCTT' && this.isPendingAppeal(summary ?? undefined)) {
      return {
        editable: false,
        reason:
          'Submitted score is immutable. Resolve appeal without editing score.',
      };
    }

    if (score.scorerRole !== 'GVHD') {
      return {
        editable: false,
        reason: 'Submitted score is immutable for this role/topic',
      };
    }

    return {
      editable: false,
      reason: 'Submitted score is immutable after submit',
    };
  }

  private async refreshSummaryAfterSubmittedScoreChange(
    topicId: string,
    topic: TopicRecord,
  ): Promise<void> {
    const existingSummary = await this.scoreSummariesRepository.findFirst(
      (s) => s.topicId === topicId,
    );

    if (!existingSummary) {
      return;
    }

    // Safety guard: immutable once any final confirmation/publish happened.
    if (
      existingSummary.published ||
      existingSummary.confirmedByGvhd ||
      existingSummary.confirmedByCtHd
    ) {
      return;
    }

    let recalculated: ScoreSummaryDto | null = null;
    try {
      recalculated = await this.calculateSummary(topicId, topic);
    } catch {
      recalculated = null;
    }

    const nextSummary: ScoreSummaryRecord = {
      ...existingSummary,
      confirmedByGvhd: false,
      confirmedByCtHd: false,
      published: false,
    };

    if (recalculated) {
      nextSummary.gvhdScore = recalculated.gvhdScore;
      nextSummary.gvpbScore = recalculated.gvpbScore;
      nextSummary.councilAvgScore = recalculated.councilAvgScore;
      nextSummary.finalScore = recalculated.finalScore;
      nextSummary.result = recalculated.result;
    }

    await this.scoreSummariesRepository.update(existingSummary.id, nextSummary);
  }

  private async completeTopicIfNeeded(topic: TopicRecord): Promise<void> {
    if (topic.state === 'COMPLETED') {
      return;
    }

    // Appeal flow is currently scoped to BCTT and completes from scoring states.
    if (topic.type !== 'BCTT') {
      return;
    }

    const completableStates = new Set(['GRADING', 'SCORING']);
    if (!completableStates.has(topic.state)) {
      return;
    }

    const nextTopic: TopicRecord = {
      ...topic,
      state: 'COMPLETED',
      updatedAt: new Date().toISOString(),
    };

    await this.topicsRepository.update(topic.id, nextTopic);

    // Keep user profile in sync so KLTN eligibility checks can read the completed BCTT score.
    const summary = await this.scoreSummariesRepository.findFirst(
      (s) => s.topicId === topic.id,
    );
    if (!summary?.published) {
      return;
    }

    try {
      const student = await this.usersRepository.findById(topic.studentUserId);
      if (!student) {
        return;
      }
      student.completedBcttScore = summary.finalScore;
      await this.usersRepository.update(student.id, student);
    } catch (error) {
      this.logger.warn(
        `[completeTopicIfNeeded] Failed to sync completedBcttScore for topic=${topic.id}`,
        error,
      );
    }
  }

  private buildStudentPendingSummary(): ScoreSummaryDto {
    return {
      gvhdScore: undefined,
      gvpbScore: undefined,
      councilAvgScore: undefined,
      finalScore: 0,
      result: 'PENDING',
      confirmedByGvhd: false,
      confirmedByCtHd: false,
      published: false,
    };
  }

  /**
   * Ensure BCTT summary is persisted and visible to student immediately
   * once GVHD submits a score.
   */
  private async ensureBcttPublishedSummary(
    topic: TopicRecord,
  ): Promise<ScoreSummaryRecord | null> {
    if (topic.type !== 'BCTT') {
      return null;
    }

    const existing = await this.scoreSummariesRepository.findFirst(
      (s) => s.topicId === topic.id,
    );

    let calculated: ScoreSummaryDto;
    try {
      calculated = await this.calculateSummary(topic.id, topic);
    } catch (error) {
      if (error instanceof ConflictException) {
        return existing ?? null;
      }
      throw error;
    }

    // Auto-export BCTT rubric when GVHD submits score
    let rubricDriveLink = existing?.rubricDriveLink;
    if (!rubricDriveLink) {
      try {
        rubricDriveLink = await this.getRubricDocxLink(topic.id);
      } catch (error) {
        this.logger.warn(
          `[ensureBcttPublishedSummary] Failed to export BCTT rubric for topic ${topic.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    const nextSummary: ScoreSummaryRecord = {
      ...(existing ?? {
        id: `sum_${crypto.randomBytes(6).toString('hex')}`,
        topicId: topic.id,
      }),
      topicId: topic.id,
      gvhdScore: calculated.gvhdScore,
      gvpbScore: undefined,
      councilAvgScore: undefined,
      finalScore: calculated.finalScore,
      result: calculated.result,
      confirmedByGvhd: true,
      confirmedByCtHd: true,
      published: true,
      rubricDriveLink,
    };

    if (existing) {
      await this.scoreSummariesRepository.update(existing.id, nextSummary);
    } else {
      await this.scoreSummariesRepository.create(nextSummary);
    }

    return nextSummary;
  }

  async requestAppeal(
    topicId: string,
    reason: string,
    user: AuthUser,
  ): Promise<RequestScoreAppealResponseDto> {
    const topic = await this.getTopicOrThrow(topicId);

    if (topic.type !== 'BCTT') {
      throw new ConflictException('Appeal is only available for BCTT topics');
    }

    if (user.role !== 'STUDENT' || topic.studentUserId !== user.userId) {
      throw new ForbiddenException('Only the owning student can request appeal');
    }

    const summary =
      (await this.ensureBcttPublishedSummary(topic)) ??
      (await this.scoreSummariesRepository.findFirst(
        (s) => s.topicId === topic.id,
      ));

    if (!summary?.published) {
      throw new ConflictException('Score must be published before requesting appeal');
    }

    if (summary.appealChoice === 'NO_APPEAL') {
      throw new ConflictException(
        'Bạn đã xác nhận không phúc khảo, không thể gửi yêu cầu phúc khảo nữa',
      );
    }

    if (summary.appealRequestedAt) {
      throw new ConflictException('Appeal can only be requested once');
    }

    const normalizedReason = reason.trim();
    if (normalizedReason.length < 10) {
      throw new BadRequestException('Appeal reason must be at least 10 characters');
    }

    const requestedAt = new Date().toISOString();
    const nextSummary: ScoreSummaryRecord = {
      ...summary,
      appealRequestedAt: requestedAt,
      appealRequestedBy: user.userId,
      appealReason: normalizedReason,
      appealStatus: 'PENDING',
      appealResolvedAt: undefined,
      appealResolvedBy: undefined,
      appealResolutionNote: undefined,
      appealScoreAdjusted: undefined,
      appealChoice: undefined,
      appealChoiceAt: undefined,
    };

    await this.scoreSummariesRepository.update(summary.id, nextSummary);

    await this.notifyIfAvailable({
      receiverUserId: topic.supervisorUserId,
      type: 'SCORE_APPEAL_REQUESTED',
      topicId: topic.id,
      context: {
        topicTitle: topic.title,
      },
    });

    return {
      status: 'PENDING',
      requestedAt,
    };
  }

  async resolveAppeal(
    topicId: string,
    user: AuthUser,
    resolutionNote?: string,
  ): Promise<ResolveScoreAppealResponseDto> {
    const topic = await this.getTopicOrThrow(topicId);

    if (topic.type !== 'BCTT') {
      throw new ConflictException('Appeal is only available for BCTT topics');
    }

    if (user.role !== 'LECTURER') {
      throw new ForbiddenException('Only GVHD can resolve appeals');
    }

    if (!(await this.hasAssignment(topic.id, user.userId, 'GVHD'))) {
      throw new ForbiddenException('Only assigned GVHD can resolve appeals');
    }

    const summary = await this.scoreSummariesRepository.findFirst(
      (s) => s.topicId === topic.id,
    );

    if (!summary || !this.isPendingAppeal(summary)) {
      throw new ConflictException('No pending appeal to resolve');
    }

    const resolvedAt = new Date().toISOString();
    const nextSummary: ScoreSummaryRecord = {
      ...summary,
      appealStatus: 'RESOLVED',
      appealResolvedAt: resolvedAt,
      appealResolvedBy: user.userId,
      appealResolutionNote:
        resolutionNote?.trim() || 'Đã rà soát lại và giữ nguyên điểm.',
      appealScoreAdjusted: false,
    };

    await this.scoreSummariesRepository.update(summary.id, nextSummary);
    await this.completeTopicIfNeeded(topic);

    await this.notifyIfAvailable({
      receiverUserId: topic.studentUserId,
      type: 'SCORE_APPEAL_RESOLVED',
      topicId: topic.id,
      context: {
        topicTitle: topic.title,
      },
    });

    return {
      status: 'RESOLVED',
      resolvedAt,
      scoreAdjusted: false,
    };
  }

  private async autoExportBcttRubricForStudent(
    topic: TopicRecord,
    studentUser: AuthUser,
  ): Promise<string | undefined> {
    if (!this.exportsService) {
      return undefined;
    }

    const gvhdScores = await this.scoresRepository.findWhere(
      (score) =>
        score.topicId === topic.id &&
        score.scorerRole === 'GVHD' &&
        score.status === 'SUBMITTED',
    );
    if (gvhdScores.length === 0) {
      return undefined;
    }

    const latestScore = gvhdScores.sort((left, right) => {
      const leftTime = new Date(left.submittedAt ?? left.updatedAt).getTime();
      const rightTime = new Date(right.submittedAt ?? right.updatedAt).getTime();
      return rightTime - leftTime;
    })[0];

    const exported = await this.exportsService.exportRubricBctt(
      topic.id,
      latestScore.id,
      studentUser,
    );

    return exported.driveLink ?? undefined;
  }

  async submitAppealChoice(
    topicId: string,
    dto: SubmitAppealChoiceDto,
    user: AuthUser,
  ): Promise<AppealChoiceResponseDto> {
    const topic = await this.getTopicOrThrow(topicId);

    if (topic.type !== 'BCTT') {
      throw new ConflictException('Appeal choice is only available for BCTT topics');
    }

    if (user.role !== 'STUDENT' || topic.studentUserId !== user.userId) {
      throw new ForbiddenException('Only the owning student can submit appeal choice');
    }

    const summary =
      (await this.ensureBcttPublishedSummary(topic)) ??
      (await this.scoreSummariesRepository.findFirst(
        (record) => record.topicId === topic.id,
      ));
    if (!summary?.published) {
      throw new ConflictException('Score must be published before selecting appeal choice');
    }

    if (summary.appealRequestedAt) {
      throw new ConflictException(
        'Bạn đã gửi yêu cầu phúc khảo, không thể chọn "Không phúc khảo"',
      );
    }

    if (summary.appealChoice) {
      if (summary.appealChoice === dto.choice) {
        return {
          choice: summary.appealChoice,
          message: 'Lựa chọn của bạn đã được ghi nhận trước đó.',
          topicState: summary.appealChoice === 'NO_APPEAL' ? 'COMPLETED' : undefined,
          rubricLink: summary.rubricDriveLink,
        };
      }
      throw new ConflictException('Lựa chọn phúc khảo đã được chốt và không thể thay đổi');
    }

    const choiceAt = new Date().toISOString();
    const nextSummary: ScoreSummaryRecord = {
      ...summary,
      appealChoice: dto.choice,
      appealChoiceAt: choiceAt,
    };

    let message = 'Đã ghi nhận lựa chọn của bạn.';
    let rubricLink = nextSummary.rubricDriveLink;
    let topicState: string | undefined;

    if (dto.choice === 'NO_APPEAL') {
      try {
        const exportedRubricLink = await this.autoExportBcttRubricForStudent(
          topic,
          user,
        );
        if (exportedRubricLink) {
          nextSummary.rubricDriveLink = exportedRubricLink;
          rubricLink = exportedRubricLink;
        }
      } catch (error) {
        this.logger.warn(
          `[submitAppealChoice] Auto-export rubric failed for topic=${topic.id}`,
          error,
        );
      }

      await this.scoreSummariesRepository.update(summary.id, nextSummary);
      await this.completeTopicIfNeeded(topic);
      topicState = 'COMPLETED';

      message = rubricLink
        ? 'Bạn đã xác nhận không phúc khảo. Đề tài đã được hoàn tất và phiếu chấm đã được lưu trên Drive.'
        : 'Bạn đã xác nhận không phúc khảo. Đề tài đã được hoàn tất.';
    } else {
      await this.scoreSummariesRepository.update(summary.id, nextSummary);
      message = 'Bạn đã xác nhận kết quả điểm.';
    }

    return {
      choice: dto.choice,
      message,
      topicState,
      rubricLink,
    };
  }

  /**
   * Get all scores for a topic
   */
  async findByTopicId(
    topicId: string,
    user: AuthUser,
  ): Promise<ScoreResponseDto[]> {
    const topic = await this.getTopicOrThrow(topicId);
    await this.assertScoreReadable(topic, user);

    const scores = await this.scoresRepository.findAll();
    const topicScores = scores.filter((s) => s.topicId === topicId);

    if (user.role === 'STUDENT') {
      const summary = await this.scoreSummariesRepository.findFirst(
        (s) => s.topicId === topicId,
      );
      if (!summary?.published) {
        throw new ForbiddenException('Score has not been published yet');
      }
      return topicScores
        .filter((s) => s.status === 'SUBMITTED')
        .map((s) => this.mapToDto(s, true));
    }

    return topicScores.map((s) => this.mapToDto(s, false));
  }

  /**
   * Get score by ID
   */
  async findById(scoreId: string, user: AuthUser): Promise<ScoreRecord | null> {
    const score = await this.scoresRepository.findById(scoreId);
    if (!score) {
      return null;
    }

    const topic = await this.topicsRepository.findById(score.topicId);
    if (!topic) {
      return null;
    }

    await this.assertScoreReadable(topic, user);

    if (user.role === 'STUDENT') {
      throw new ForbiddenException('Students cannot view individual scores');
    }

    return score;
  }

  /**
   * Create or update a draft score
   */
  async createOrUpdateDraft(
    topicId: string,
    dto: CreateDraftScoreDto,
    user: AuthUser,
  ): Promise<DraftScoreResponseDto> {
    await this.assertNotAggregatedLock(topicId);
    const topic = await this.getTopicOrThrow(topicId);
    this.assertScoringAllowed(topic);
    this.assertScorerRoleAllowed(topic, dto.scorerRole);

    const scores = await this.scoresRepository.findAll();

    if (user.role !== 'LECTURER') {
      throw new ForbiddenException('Only lecturers can draft scores');
    }

    if (!(await this.hasAssignment(topicId, user.userId, dto.scorerRole))) {
      throw new ForbiddenException(
        `You do not have ${dto.scorerRole} role on this topic`,
      );
    }

    this.validateRubricData(dto.rubricData);

    const totalScore = this.calculateTotalScore(dto.rubricData);

    const existingScore = scores.find(
      (s) =>
        s.topicId === topicId &&
        s.scorerRole === dto.scorerRole &&
        s.scorerUserId === user.userId &&
        s.status === 'DRAFT',
    );

    if (existingScore) {
      existingScore.rubricData = dto.rubricData;
      existingScore.totalScore = totalScore;
      existingScore.updatedAt = new Date().toISOString();
      await this.scoresRepository.update(existingScore.id, existingScore);

      return {
        scoreId: existingScore.id,
        status: 'DRAFT',
        totalScore,
      };
    }

    const submittedScore = scores.find(
      (s) =>
        s.topicId === topicId &&
        s.scorerRole === dto.scorerRole &&
        s.scorerUserId === user.userId &&
        s.status === 'SUBMITTED',
    );
    if (submittedScore) {
      throw new ConflictException(
        `Score for ${dto.scorerRole} has already been submitted`,
      );
    }

    const newScore: ScoreRecord = {
      id: this.generateId(),
      topicId,
      scorerUserId: user.userId,
      scorerRole: dto.scorerRole,
      status: 'DRAFT',
      totalScore,
      rubricData: dto.rubricData,
      updatedAt: new Date().toISOString(),
      // Populate teacher-visible reference columns
      _tenDetai: topic.title,
      _gvName: user.email, // fallback; overwritten below after DB lookup
    };

    // Lookup scorer's display name for rubric exports (DB-10 fix)
    // and student reference columns simultaneously to avoid sequential sheet reads.
    try {
      const [student, scorer] = await Promise.all([
        this.usersRepository.findById(topic.studentUserId),
        this.usersRepository.findById(user.userId),
      ]);
      if (student) {
        newScore._email = student.email;
        newScore._tenSV = student.name;
        newScore._mssv = student.studentId ?? student.lecturerId ?? '';
      }
      if (scorer?.name) {
        // DB-10 fix: use real display name instead of JWT email
        newScore._gvName = scorer.name;
      }
    } catch { /* non-blocking: sheet columns optional */ }

    await this.scoresRepository.create(newScore);


    return {
      scoreId: newScore.id,
      status: 'DRAFT',
      totalScore,
    };
  }

  /**
   * Submit a score (make it immutable)
   */
  async submit(
    scoreId: string,
    user: AuthUser,
  ): Promise<SubmitScoreResponseDto> {
    const score = await this.scoresRepository.findById(scoreId);
    if (!score) {
      throw new NotFoundException(`Score with ID ${scoreId} not found`);
    }

    if (score.status === 'SUBMITTED') {
      throw new ConflictException('Score has already been submitted');
    }

    let topic = await this.getTopicOrThrow(score.topicId);
    await this.assertNotAggregatedLock(score.topicId);

    if (user.role !== 'LECTURER' || score.scorerUserId !== user.userId) {
      throw new ForbiddenException('Only the scorer can submit this score');
    }

    topic = await this.ensureScoringStateAfterDefenseSubmit(topic);
    this.assertScoringAllowed(topic);

    score.status = 'SUBMITTED';
    score.submittedAt = new Date().toISOString();
    score.updatedAt = new Date().toISOString();
    await this.scoresRepository.update(score.id, score);

    // BCTT policy: score is visible to student right after GVHD submits.
    await this.ensureBcttPublishedSummary(topic);

    await this.auditIfAvailable({
      action: 'SCORE_SUBMITTED',
      actorId: user.userId,
      actorRole: user.role,
      topicId: score.topicId,
      detail: {
        scoreId: score.id,
        scorerRole: score.scorerRole,
        totalScore: score.totalScore,
      },
    });

    return {
      scoreId: score.id,
      status: 'SUBMITTED',
    };
  }

  /**
   * Calculate and return the score summary for a topic
   */
  async getSummary(
    topicId: string,
    user: AuthUser,
    requestedByRole?: SummaryRequestRole,
  ): Promise<ScoreSummaryDto> {
    const topic = await this.getTopicOrThrow(topicId);

    if (user.role === 'STUDENT') {
      if (topic.studentUserId !== user.userId) {
        throw new ForbiddenException('Cannot view score summary for this topic');
      }

      // Legacy-safe behavior: BCTT should be visible immediately after GVHD submit.
      if (topic.type === 'BCTT') {
        await this.ensureBcttPublishedSummary(topic);
      }

      const existing = await this.scoreSummariesRepository.findFirst(
        (s) => s.topicId === topicId,
      );
      if (!existing?.published) {
        const pending = this.buildStudentPendingSummary();
        return this.attachStudentFacingFields(pending, topic, existing ?? undefined);
      }

      const baseSummary: ScoreSummaryDto = {
        gvhdScore: existing.gvhdScore,
        gvpbScore: existing.gvpbScore,
        councilAvgScore: existing.councilAvgScore,
        finalScore: existing.finalScore,
        result: existing.result,
        confirmedByGvhd: existing.confirmedByGvhd,
        confirmedByCtHd: existing.confirmedByCtHd,
        published: existing.published,
      };

      return this.attachStudentFacingFields(baseSummary, topic, existing);
    }

    // TBM can view existing summaries for statistics, but cannot trigger calculation
    if (user.role === 'TBM') {
      // requestedByRole check is removed - TBM is not in SCORE_SUMMARY_REQUEST_ROLES anymore
      const existing = await this.scoreSummariesRepository.findFirst(
        (s) => s.topicId === topicId,
      );
      if (!existing) {
        throw new ConflictException(
          'Score summary not yet available. TK_HD must aggregate scores first.',
        );
      }
      // Return existing summary without calculation
      const baseSummary: ScoreSummaryDto = {
        gvhdScore: existing.gvhdScore,
        gvpbScore: existing.gvpbScore,
        councilAvgScore: existing.councilAvgScore,
        finalScore: existing.finalScore,
        result: existing.result,
        confirmedByGvhd: existing.confirmedByGvhd,
        confirmedByCtHd: existing.confirmedByCtHd,
        published: existing.published,
      };
      return this.attachStudentFacingFields(baseSummary, topic, existing);
    }

    if (user.role !== 'LECTURER') {
      throw new ForbiddenException('Cannot view score summary for this topic');
    }

    if (requestedByRole) {
      // requestedByRole must be TK_HD only (removed TBM from valid roles)
      if (requestedByRole !== 'TK_HD') {
        throw new ForbiddenException('requestedByRole must be TK_HD for summary aggregation');
      }

      if (!(await this.hasAssignment(topicId, user.userId, requestedByRole))) {
        throw new ForbiddenException(
          `You do not have ${requestedByRole} role on this topic`,
        );
      }
    } else if (!(await this.hasAssignment(topicId, user.userId))) {
      throw new ForbiddenException('Cannot view score summary for this topic');
    }

    const calculated = await this.calculateSummary(topicId, topic);
    const existing = await this.scoreSummariesRepository.findFirst(
      (s) => s.topicId === topicId,
    );
    return this.attachStudentFacingFields(calculated, topic, existing ?? undefined);
  }

  /**
   * Confirm score by GVHD or CT_HD
   */
  async confirm(
    topicId: string,
    role: ConfirmScoreRole,
    user: AuthUser,
  ): Promise<ConfirmScoreResponseDto> {
    const topic = await this.getTopicOrThrow(topicId);

    if (topic.type !== 'KLTN') {
      throw new ConflictException('Dual confirmation is only available for KLTN topics');
    }

    if (user.role !== 'LECTURER' && user.role !== 'TBM') {
      throw new ForbiddenException('Only lecturers or TBM can confirm scores');
    }

    if (user.role === 'TBM' && role !== 'CT_HD') {
      throw new ForbiddenException('TBM can only confirm-publish using CT_HD role');
    }

    // Least-privilege policy: confirmation requires an ACTIVE assignment for the requested role.
    if (!(await this.hasAssignment(topicId, user.userId, role))) {
      throw new ForbiddenException(
        `Only users with ACTIVE ${role} assignment can confirm scores`,
      );
    }

    const calculatedSummary = await this.calculateSummary(topicId, topic);
    let summary = await this.scoreSummariesRepository.findFirst(
      (s) => s.topicId === topicId,
    );
    if (!summary) {
      summary = {
        id: `sum_${crypto.randomBytes(6).toString('hex')}`,
        topicId,
        gvhdScore: calculatedSummary.gvhdScore,
        gvpbScore: calculatedSummary.gvpbScore,
        councilAvgScore: calculatedSummary.councilAvgScore,
        finalScore: calculatedSummary.finalScore,
        result: calculatedSummary.result,
        confirmedByGvhd: false,
        confirmedByCtHd: false,
        published: false,
      };
    } else {
      summary.gvhdScore = calculatedSummary.gvhdScore;
      summary.gvpbScore = calculatedSummary.gvpbScore;
      summary.councilAvgScore = calculatedSummary.councilAvgScore;
      summary.finalScore = calculatedSummary.finalScore;
      summary.result = calculatedSummary.result;
    }

    if (role === 'GVHD') {
      summary.confirmedByGvhd = true;
    } else {
      summary.confirmedByCtHd = true;
    }

    const published = summary.confirmedByGvhd && summary.confirmedByCtHd;
    summary.published = published;

    if (await this.scoreSummariesRepository.findById(summary.id)) {
      await this.scoreSummariesRepository.update(summary.id, summary);
    } else {
      await this.scoreSummariesRepository.create(summary);
    }

    await this.auditIfAvailable({
      action: 'SCORE_CONFIRMED',
      actorId: user.userId,
      actorRole: user.role,
      topicId,
      detail: {
        role,
        published,
      },
    });

    if (published) {
      // Bug fix: Auto-transition topic to COMPLETED when score is published
      // Previously topic state remained at SCORING even after all confirmations
      if (topic.state === 'SCORING') {
        topic.state = 'COMPLETED';
        topic.updatedAt = new Date().toISOString();
        await this.topicsRepository.update(topicId, topic);
      }

      // Auto-generate KLTN documents (rubrics + minutes) when score is published
      if (this.exportsService && topic.type === 'KLTN') {
        try {
          this.logger.log(
            `[confirm:autoExport] Triggering auto-export for topicId=${topicId}`,
          );

          // Get all submitted scores to export rubrics
          const allScores = await this.scoresRepository.findWhere(
            (s) => s.topicId === topicId && s.status === 'SUBMITTED',
          );

          // Export rubrics for GVHD, GVPB, and council members
          const gvhdScore = allScores.find((s) => s.scorerRole === 'GVHD');
          const gvpbScore = allScores.find((s) => s.scorerRole === 'GVPB');
          const councilScores = allScores.filter((s) =>
            ['CT_HD', 'TK_HD', 'TV_HD'].includes(s.scorerRole),
          );

          const exportPromises: Promise<any>[] = [];

          if (gvhdScore) {
            exportPromises.push(
              this.exportsService.exportRubricKltn(
                topicId,
                'GVHD',
                gvhdScore.id,
                { userId: gvhdScore.scorerUserId, role: 'LECTURER' } as AuthUser,
              ).catch((err) => {
                this.logger.warn(
                  `[confirm:autoExport] Failed to export GVHD rubric: ${err.message}`,
                );
              }),
            );
          }

          if (gvpbScore) {
            exportPromises.push(
              this.exportsService.exportRubricKltn(
                topicId,
                'GVPB',
                gvpbScore.id,
                { userId: gvpbScore.scorerUserId, role: 'LECTURER' } as AuthUser,
              ).catch((err) => {
                this.logger.warn(
                  `[confirm:autoExport] Failed to export GVPB rubric: ${err.message}`,
                );
              }),
            );
          }

          // Export council rubrics (CT_HD, TK_HD, TV_HD)
          for (const councilScore of councilScores) {
            exportPromises.push(
              this.exportsService.exportRubricKltn(
                topicId,
                councilScore.scorerRole as 'CT_HD' | 'TK_HD' | 'TV_HD',
                councilScore.id,
                { userId: councilScore.scorerUserId, role: 'LECTURER' } as AuthUser,
              ).catch((err) => {
                this.logger.warn(
                  `[confirm:autoExport] Failed to export ${councilScore.scorerRole} rubric: ${err.message}`,
                );
              }),
            );
          }

          // Export minutes (biên bản hội đồng)
          // Note: Minutes require dto with council comments, revision requirements, etc.
          // For now, we generate with minimal data. TK_HD can regenerate later with full details.
          exportPromises.push(
            this.exportsService.exportMinutes(
              topicId,
              {
                councilComments: summary.councilComments || '',
                revisionRequirements: 'Xem biên bản chi tiết',
                revisionDeadline: new Date(
                  Date.now() + 30 * 24 * 60 * 60 * 1000,
                ).toISOString(), // 30 days from now
              },
              { userId: user.userId, role: user.role } as AuthUser,
            ).catch((err) => {
              this.logger.warn(
                `[confirm:autoExport] Failed to export minutes: ${err.message}`,
              );
            }),
          );

          // Execute all exports in parallel (non-blocking)
          await Promise.all(exportPromises);

          this.logger.log(
            `[confirm:autoExport:success] Completed auto-export for topicId=${topicId}`,
          );
        } catch (error) {
          this.logger.error(
            `[confirm:autoExport:error] topicId=${topicId} error=${error}`,
          );
          // Non-blocking: Score confirmation succeeded, export failed
          // Documents can be manually exported later
        }
      }

      await this.notifyIfAvailable({
        receiverUserId: topic.studentUserId,
        type: 'SCORE_PUBLISHED',
        topicId,
        context: {
          topicTitle: topic.title,
        },
      });

      await this.auditIfAvailable({
        action: 'SCORE_PUBLISHED',
        actorId: user.userId,
        actorRole: user.role,
        topicId,
        detail: {
          finalScore: summary.finalScore,
          result: summary.result,
        },
      });
    }

    return {
      confirmed: true,
      published,
    };
  }

  /**
   * TK_HD completes aggregation and locks all score editing.
   * After this, nobody can unlock or edit scores.
   * This creates an irreversible audit trail.
   */
  async aggregateByTkHd(topicId: string, user: AuthUser): Promise<ScoreSummaryDto> {
    if (user.role !== 'LECTURER') {
      throw new ForbiddenException('Only lecturers can aggregate scores');
    }

    const topic = await this.getTopicOrThrow(topicId);

    // Check if user is TK_HD for this topic
    const hasTkHdRole = await this.hasAssignment(topicId, user.userId, 'TK_HD');
    if (!hasTkHdRole) {
      throw new ForbiddenException('Only TK_HD can aggregate scores for this topic');
    }

    // Check if already aggregated
    const existing = await this.scoreSummariesRepository.findFirst(
      (s) => s.topicId === topicId,
    );

    if (existing?.aggregatedByTkHd) {
      throw new ConflictException(
        `Scores already aggregated by TK_HD at ${existing.aggregatedByTkHdAt}. This action is irreversible.`,
      );
    }

    // Calculate summary
    const calculated = await this.calculateSummary(topicId, topic);

    // Persist or update with aggregation lock
    const now = new Date().toISOString();
    const summaryRecord: ScoreSummaryRecord = {
      id: existing?.id ?? `summary_${topicId}`,
      topicId,
      gvhdScore: calculated.gvhdScore,
      gvpbScore: calculated.gvpbScore,
      councilAvgScore: calculated.councilAvgScore,
      finalScore: calculated.finalScore,
      result: calculated.result,
      confirmedByGvhd: existing?.confirmedByGvhd ?? false,
      confirmedByCtHd: existing?.confirmedByCtHd ?? false,
      published: existing?.published ?? false,
      updatedAt: now,
      councilComments: existing?.councilComments,
      aggregatedByTkHd: true,
      aggregatedByTkHdAt: now,
      aggregatedByTkHdUserId: user.userId,
    };

    if (existing) {
      await this.scoreSummariesRepository.update(existing.id, summaryRecord);
    } else {
      await this.scoreSummariesRepository.create(summaryRecord);
    }

    // Audit trail
    await this.auditIfAvailable({
      action: 'SCORE_AGGREGATED_BY_TK_HD',
      actorId: user.userId,
      actorRole: user.role,
      topicId,
      detail: {
        finalScore: calculated.finalScore,
        result: calculated.result,
        aggregatedAt: now,
      },
    });

    return this.attachStudentFacingFields(calculated, topic, summaryRecord);
  }

  /**
   * Find current user's draft or submitted score for a topic
   */
  async findMyDraft(
    topicId: string,
    user: AuthUser,
  ): Promise<{
    scoreId?: string;
    criteria: Record<string, number>;
    turnitinLink?: string;
    comments?: string;
    questions?: string;
    isSubmitted: boolean;
    isLocked: boolean;
    lockReason?: string;
    totalScore: number;
  } | null> {
    if (user.role !== 'LECTURER') {
      throw new ForbiddenException('Only lecturers can access score drafts');
    }

    const topic = await this.getTopicOrThrow(topicId);

    const scores = await this.scoresRepository.findAll();
    const myScores = scores.filter(
      (s) => s.topicId === topicId && s.scorerUserId === user.userId,
    );

    // Priority: SUBMITTED > DRAFT
    const submitted = myScores.find((s) => s.status === 'SUBMITTED');
    const draft = myScores.find((s) => s.status === 'DRAFT');
    const score = submitted ?? draft;

    if (!score) {
      return null;
    }

    // Convert rubricData array back to flat criteria map
    const criteria: Record<string, number> = {};
    for (const item of score.rubricData) {
      criteria[item.criterion] = item.score;
    }

    let isLocked = false;
    let lockReason: string | undefined;
    if (score.status === 'SUBMITTED') {
      const editability = await this.getSubmittedScoreEditability(topic, score);
      isLocked = !editability.editable;
      lockReason = editability.reason;
    }

    return {
      scoreId: score.id,
      criteria,
      turnitinLink: undefined, // stored in notes if needed
      comments: score.rubricData.find((r) => r.note)?.note,
      isSubmitted: score.status === 'SUBMITTED',
      isLocked,
      lockReason,
      totalScore: score.totalScore,
    };
  }

  /**
   * Create draft + submit directly, accepting flat criteria map from frontend
   * @param isDraftOnly if true, only saves as draft (not submitted)
   */
  async createAndSubmitDirect(
    topicId: string,
    criteriaMap: Record<string, number>,
    scorerRole: ScorerRole,
    rubricDefinition: Array<{ id: string; max: number }>,
    user: AuthUser,
    options: { isDraftOnly?: boolean; turnitinLink?: string; comments?: string; questions?: string } = {},
  ): Promise<{ scoreId: string; status: 'DRAFT' | 'SUBMITTED'; totalScore: number }> {
    if (user.role !== 'LECTURER') {
      throw new ForbiddenException('Only lecturers can score topics');
    }

    await this.assertNotAggregatedLock(topicId);
    let topic = await this.getTopicOrThrow(topicId);
    topic = await this.ensureScoringStateAfterDefenseSubmit(topic);
    this.assertScoringAllowed(topic);
    this.assertScorerRoleAllowed(topic, scorerRole);

    if (!(await this.hasAssignment(topicId, user.userId, scorerRole))) {
      throw new ForbiddenException(
        `You do not have ${scorerRole} role on this topic`,
      );
    }

    // Convert flat criteria map → rubricData array
    const rubricData: RubricItem[] = rubricDefinition.map((def) => ({
      criterion: def.id,
      score: Math.min(def.max, Math.max(0, criteriaMap[def.id] ?? 0)),
      max: def.max,
      note: def.id === rubricDefinition[rubricDefinition.length - 1].id
        ? options.comments
        : undefined,
    }));

    this.validateRubricData(rubricData);

    const totalScore = this.calculateTotalScore(rubricData);

    // Parse questions string to array
    const questions = options.questions 
      ? options.questions.split('\n').map(q => q.trim()).filter(q => q.length > 0)
      : undefined;

    const scores = await this.scoresRepository.findAll();

    // Check if already submitted.
    const submittedScore = scores.find(
      (s) =>
        s.topicId === topicId &&
        s.scorerRole === scorerRole &&
        s.scorerUserId === user.userId &&
        s.status === 'SUBMITTED',
    );
    if (submittedScore) {
      const editability = await this.getSubmittedScoreEditability(
        topic,
        submittedScore,
      );
      if (!editability.editable) {
        throw new ConflictException(
          editability.reason ?? `Score for ${scorerRole} has already been submitted`,
        );
      }

      const summaryBeforeUpdate = await this.scoreSummariesRepository.findFirst(
        (s) => s.topicId === topicId,
      );
      const hadPendingAppeal = this.isPendingAppeal(summaryBeforeUpdate ?? undefined);
      const previousFinalScore = summaryBeforeUpdate?.finalScore;

      submittedScore.rubricData = rubricData;
      submittedScore.totalScore = totalScore;
      submittedScore.questions = questions;
      submittedScore.updatedAt = new Date().toISOString();
      await this.scoresRepository.update(submittedScore.id, submittedScore);

      if (topic.type === 'BCTT' && hadPendingAppeal && summaryBeforeUpdate) {
        const recalculated = await this.calculateSummary(topicId, topic);
        const resolvedAt = new Date().toISOString();
        const scoreAdjusted =
          previousFinalScore === undefined
            ? true
            : Math.abs(recalculated.finalScore - previousFinalScore) > 0.0001;

        const nextSummary: ScoreSummaryRecord = {
          ...summaryBeforeUpdate,
          gvhdScore: recalculated.gvhdScore,
          gvpbScore: recalculated.gvpbScore,
          councilAvgScore: recalculated.councilAvgScore,
          finalScore: recalculated.finalScore,
          result: recalculated.result,
          // Keep published state so student can see updated final score immediately.
          appealStatus: 'RESOLVED',
          appealResolvedAt: resolvedAt,
          appealResolvedBy: user.userId,
          appealResolutionNote: scoreAdjusted
            ? 'GVHD đã điều chỉnh điểm sau khi phúc khảo.'
            : 'GVHD đã rà soát lại và giữ nguyên điểm.',
          appealScoreAdjusted: scoreAdjusted,
        };

        await this.scoreSummariesRepository.update(summaryBeforeUpdate.id, nextSummary);
        await this.completeTopicIfNeeded(topic);

        await this.notifyIfAvailable({
          receiverUserId: topic.studentUserId,
          type: 'SCORE_APPEAL_RESOLVED',
          topicId: topic.id,
          context: {
            topicTitle: topic.title,
          },
        });
      } else {
        await this.refreshSummaryAfterSubmittedScoreChange(topicId, topic);
      }

      await this.auditIfAvailable({
        action: 'SCORE_SUBMITTED',
        actorId: user.userId,
        actorRole: user.role,
        topicId,
        detail: {
          scoreId: submittedScore.id,
          scorerRole,
          totalScore,
          editedAfterSubmit: true,
        },
      });

      return {
        scoreId: submittedScore.id,
        status: 'SUBMITTED',
        totalScore,
      };
    }

    // Upsert draft
    const existingDraft = scores.find(
      (s) =>
        s.topicId === topicId &&
        s.scorerRole === scorerRole &&
        s.scorerUserId === user.userId &&
        s.status === 'DRAFT',
    );

    let scoreRecord: ScoreRecord;
    if (existingDraft) {
      existingDraft.rubricData = rubricData;
      existingDraft.totalScore = totalScore;
      existingDraft.questions = questions;
      existingDraft.updatedAt = new Date().toISOString();
      await this.scoresRepository.update(existingDraft.id, existingDraft);
      scoreRecord = existingDraft;
    } else {
      scoreRecord = {
        id: this.generateId(),
        topicId,
        scorerUserId: user.userId,
        scorerRole,
        status: 'DRAFT',
        totalScore,
        rubricData,
        questions,
        updatedAt: new Date().toISOString(),
        // Populate teacher-visible reference columns
        _tenDetai: topic.title,
        _gvName: user.email, // fallback; overwritten below after DB lookup
      };

      try {
        const [student, scorer] = await Promise.all([
          this.usersRepository.findById(topic.studentUserId),
          this.usersRepository.findById(user.userId),
        ]);
        if (student) {
          scoreRecord._email = student.email;
          scoreRecord._tenSV = student.name;
          scoreRecord._mssv = student.studentId ?? student.lecturerId ?? '';
        }
        if (scorer?.name) {
          scoreRecord._gvName = scorer.name;
        }
      } catch {
        // Non-blocking: teacher columns are optional references
      }

      await this.scoresRepository.create(scoreRecord);
    }

    if (options.isDraftOnly) {
      return { scoreId: scoreRecord.id, status: 'DRAFT', totalScore };
    }

    // Submit: make immutable
    scoreRecord.status = 'SUBMITTED';
    scoreRecord.submittedAt = new Date().toISOString();
    scoreRecord.updatedAt = new Date().toISOString();
    await this.scoresRepository.update(scoreRecord.id, scoreRecord);

    await this.ensureBcttPublishedSummary(topic);

    await this.auditIfAvailable({
      action: 'SCORE_SUBMITTED',
      actorId: user.userId,
      actorRole: user.role,
      topicId,
      detail: {
        scoreId: scoreRecord.id,
        scorerRole,
        totalScore,
      },
    });

    return { scoreId: scoreRecord.id, status: 'SUBMITTED', totalScore };
  }

  /**
   * Calculate total score from rubric
   */
  private calculateTotalScore(rubricData: RubricItem[]): number {
    const total = rubricData.reduce((sum, item) => sum + item.score, 0);
    return this.roundTo2(total);
  }

  /**
   * Calculate score summary for a topic
   */
  private async calculateSummary(
    topicId: string,
    topic: TopicRecord,
  ): Promise<ScoreSummaryDto> {
    const scores = await this.scoresRepository.findAll();
    const topicScores = scores.filter(
      (s) => s.topicId === topicId && s.status === 'SUBMITTED',
    );

    const gvhd = topicScores.find((score) => score.scorerRole === 'GVHD');
    if (!gvhd) {
      throw new ConflictException('Cannot summarize before GVHD score is submitted');
    }

    let gvpbScore: number | undefined;
    let councilAvgScore: number | undefined;
    let finalScore: number;

    if (topic.type === 'BCTT') {
      finalScore = this.roundTo2(gvhd.totalScore);
    } else {
      const gvpb = topicScores.find((score) => score.scorerRole === 'GVPB');
      if (!gvpb) {
        throw new ConflictException('Cannot summarize before GVPB score is submitted');
      }

      gvpbScore = gvpb.totalScore;

      const assignments = await this.assignmentsRepository.findAll();
      const assignedCouncilMembers = assignments.filter(
        (assignment) =>
          assignment.topicId === topicId &&
          ['TV_HD', 'CT_HD', 'TK_HD'].includes(assignment.topicRole) &&
          assignment.status === 'ACTIVE',
      );

      if (assignedCouncilMembers.length === 0) {
        throw new ConflictException('Cannot summarize before council assignments are ready');
      }

      const activeCouncilUserIds = new Set(
        assignedCouncilMembers.map((assignment) => assignment.userId),
      );
      const councilScores = topicScores.filter(
        (score) =>
          score.scorerRole === 'TV_HD' &&
          activeCouncilUserIds.has(score.scorerUserId),
      );
      const submittedCouncilUserIds = new Set(
        councilScores.map((score) => score.scorerUserId),
      );
      const hasMissingCouncilSubmission = assignedCouncilMembers.some(
        (assignment) => !submittedCouncilUserIds.has(assignment.userId),
      );

      if (hasMissingCouncilSubmission) {
        throw new ConflictException(
          'Cannot summarize before all council member scores are submitted',
        );
      }

      councilAvgScore = this.roundTo2(
        councilScores.reduce((sum, score) => sum + score.totalScore, 0) /
          councilScores.length,
      );

      finalScore = this.roundTo2(
        (gvhd.totalScore + gvpbScore + councilAvgScore) / 3,
      );
    }

    // Bug fix: Use >= instead of > to match requirement "đạt nếu từ 5 điểm trở lên"
    // A score of exactly 5.0 should PASS, not FAIL
    const result: ScoreResult = finalScore >= SCORE_PASS_THRESHOLD ? 'PASS' : 'FAIL';

    const existingSummary = await this.scoreSummariesRepository.findFirst(
      (s) => s.topicId === topicId,
    );

    return {
      gvhdScore: gvhd.totalScore,
      gvpbScore,
      councilAvgScore,
      finalScore,
      result,
      confirmedByGvhd: existingSummary?.confirmedByGvhd ?? false,
      confirmedByCtHd: existingSummary?.confirmedByCtHd ?? false,
      published: existingSummary?.published ?? false,
    };
  }

  /**
   * Map record to DTO
   */
  mapToDto(record: ScoreRecord, hideRubric: boolean = false): ScoreResponseDto {
    return {
      id: record.id,
      topicId: record.topicId,
      scorerUserId: record.scorerUserId,
      scorerRole: record.scorerRole,
      status: record.status,
      totalScore: record.totalScore,
      rubricData: hideRubric ? undefined : record.rubricData,
      submittedAt: record.submittedAt,
      updatedAt: record.updatedAt,
    };
  }

  private async notifyIfAvailable(params: {
    receiverUserId: string;
    type: 'SCORE_PUBLISHED' | 'SCORE_APPEAL_REQUESTED' | 'SCORE_APPEAL_RESOLVED';
    context: Record<string, string>;
    topicId?: string;
  }): Promise<void> {
    if (!this.notificationsService) {
      return;
    }

    await this.notificationsService.create(params);
  }

  private async auditIfAvailable(params: {
    action: 'SCORE_SUBMITTED' | 'SCORE_CONFIRMED' | 'SCORE_PUBLISHED' | 'COUNCIL_COMMENTS_UPDATED' | 'SCORE_AGGREGATED_BY_TK_HD';
    actorId: string;
    actorRole: string;
    topicId?: string;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.auditService) {
      return;
    }

    await this.auditService.log(params);
  }

  /**
   * Cập nhật góp ý bổ sung của hội đồng (do Thư ký nhập)
   * Chỉ TK_HD của topic này mới được phép
   */
  async updateCouncilComments(
    topicId: string,
    councilComments: string,
    user: AuthUser,
  ): Promise<{ topicId: string; councilComments: string; updatedAt: string }> {
    if (user.role !== 'LECTURER') {
      throw new ForbiddenException('Only lecturers can update council comments');
    }

    const topic = await this.getTopicOrThrow(topicId);

    // Check if user is TK_HD for this topic
    const assignments = await this.assignmentsRepository.findAll();
    const tkHdAssignment = assignments.find(
      (a) =>
        a.topicId === topicId &&
        a.userId === user.userId &&
        a.topicRole === 'TK_HD' &&
        a.status === 'ACTIVE',
    );

    if (!tkHdAssignment) {
      throw new ForbiddenException('Only the assigned Secretary (TK_HD) can update council comments');
    }

    // Find or create score summary
    let summary = await this.scoreSummariesRepository.findFirst(
      (s) => s.topicId === topicId,
    );

    const now = new Date().toISOString();

    if (summary) {
      // Update existing summary
      await this.scoreSummariesRepository.update(summary.id, {
        ...summary,
        councilComments,
      });
    } else {
      // Create minimal summary with just council comments
      summary = {
        id: crypto.randomUUID(),
        topicId,
        finalScore: 0,
        result: 'PENDING',
        confirmedByGvhd: false,
        confirmedByCtHd: false,
        published: false,
        councilComments,
      };
      await this.scoreSummariesRepository.create(summary);
    }

    await this.auditIfAvailable({
      action: 'COUNCIL_COMMENTS_UPDATED',
      actorId: user.userId,
      actorRole: user.role,
      topicId,
      detail: {
        councilCommentsLength: councilComments.length,
      },
    });

    return {
      topicId,
      councilComments,
      updatedAt: now,
    };
  }

  /**
   * Get council comments for a topic
   */
  async getCouncilComments(topicId: string): Promise<string | null> {
    const summary = await this.scoreSummariesRepository.findFirst(
      (s) => s.topicId === topicId,
    );
    return summary?.councilComments ?? null;
  }
}
