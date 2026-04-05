import {
  Injectable,
  Optional,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  ScoreResponseDto,
  ScoreSummaryDto,
  DraftScoreResponseDto,
  SubmitScoreResponseDto,
  ConfirmScoreResponseDto,
  ScorerRole,
  ScoreStatus,
  ScoreResult,
  RubricItem,
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
  ScoreSummariesRepository,
  ScoresRepository,
  TopicsRepository,
  UsersRepository,
} from '../../infrastructure/google-sheets';
import type { TopicRecord } from '../topics/topics.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

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
}

const KLTN_SCORER_ROLES: ScorerRole[] = ['GVHD', 'GVPB', 'TV_HD'];

@Injectable()
export class ScoresService {
  constructor(
    private readonly scoresRepository: ScoresRepository,
    private readonly scoreSummariesRepository: ScoreSummariesRepository,
    private readonly topicsRepository: TopicsRepository,
    private readonly assignmentsRepository: AssignmentsRepository,
    private readonly usersRepository: UsersRepository,
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
      throw new ConflictException(
        'Cannot score BCTT before submission deadline is configured',
      );
    }

    const submitEnd = new Date(topic.submitEndAt).getTime();
    if (Number.isNaN(submitEnd)) {
      throw new ConflictException('BCTT submission deadline is invalid');
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

    const topic = await this.getTopicOrThrow(score.topicId);
    this.assertScoringAllowed(topic);

    if (user.role !== 'LECTURER' || score.scorerUserId !== user.userId) {
      throw new ForbiddenException('Only the scorer can submit this score');
    }

    score.status = 'SUBMITTED';
    score.submittedAt = new Date().toISOString();
    score.updatedAt = new Date().toISOString();
    await this.scoresRepository.update(score.id, score);

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

      const existing = await this.scoreSummariesRepository.findFirst(
        (s) => s.topicId === topicId,
      );
      if (!existing?.published) {
        throw new ForbiddenException('Score summary not yet published');
      }

      return {
        finalScore: existing.finalScore,
        result: existing.result,
        confirmedByGvhd: existing.confirmedByGvhd,
        confirmedByCtHd: existing.confirmedByCtHd,
        published: existing.published,
      };
    }

    if (user.role === 'TBM') {
      if (requestedByRole && requestedByRole !== 'TBM') {
        throw new ForbiddenException('requestedByRole does not match current user');
      }

      return await this.calculateSummary(topicId, topic);
    }

    if (user.role !== 'LECTURER') {
      throw new ForbiddenException('Cannot view score summary for this topic');
    }

    if (requestedByRole) {
      if (requestedByRole === 'TBM') {
        throw new ForbiddenException('requestedByRole TBM is only valid for TBM users');
      }

      if (!(await this.hasAssignment(topicId, user.userId, requestedByRole))) {
        throw new ForbiddenException(
          `You do not have ${requestedByRole} role on this topic`,
        );
      }
    } else if (!(await this.hasAssignment(topicId, user.userId))) {
      throw new ForbiddenException('Cannot view score summary for this topic');
    }

    return await this.calculateSummary(topicId, topic);
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
    totalScore: number;
  } | null> {
    if (user.role !== 'LECTURER') {
      throw new ForbiddenException('Only lecturers can access score drafts');
    }

    await this.getTopicOrThrow(topicId);

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

    return {
      scoreId: score.id,
      criteria,
      turnitinLink: undefined, // stored in notes if needed
      comments: score.rubricData.find((r) => r.note)?.note,
      isSubmitted: score.status === 'SUBMITTED',
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

    const topic = await this.getTopicOrThrow(topicId);
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
        ? (options.comments ?? options.questions)
        : undefined,
    }));

    this.validateRubricData(rubricData);

    const totalScore = this.calculateTotalScore(rubricData);

    const scores = await this.scoresRepository.findAll();

    // Check if already submitted — cannot overwrite
    const submittedScore = scores.find(
      (s) =>
        s.topicId === topicId &&
        s.scorerRole === scorerRole &&
        s.scorerUserId === user.userId &&
        s.status === 'SUBMITTED',
    );
    if (submittedScore && !options.isDraftOnly) {
      throw new ConflictException(
        `Score for ${scorerRole} has already been submitted`,
      );
    }
    if (submittedScore) {
      return {
        scoreId: submittedScore.id,
        status: 'SUBMITTED',
        totalScore: submittedScore.totalScore,
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
        updatedAt: new Date().toISOString(),
      };
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
          assignment.topicRole === 'TV_HD' &&
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

    const result: ScoreResult = finalScore > SCORE_PASS_THRESHOLD ? 'PASS' : 'FAIL';

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
    type: 'SCORE_PUBLISHED';
    context: Record<string, string>;
    topicId?: string;
  }): Promise<void> {
    if (!this.notificationsService) {
      return;
    }

    await this.notificationsService.create(params);
  }

  private async auditIfAvailable(params: {
    action: 'SCORE_SUBMITTED' | 'SCORE_CONFIRMED' | 'SCORE_PUBLISHED';
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
}
