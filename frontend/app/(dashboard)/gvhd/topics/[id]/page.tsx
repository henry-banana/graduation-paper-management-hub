"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  FileText,
  ExternalLink,
  Upload,
  CheckCircle2,
  BookOpen,
  User,
  AlertCircle,
  Loader2,
  Edit2,
  X,
  Save,
} from "lucide-react";
import Link from "next/link";
import { ApiListResponse, ApiRequestError, ApiResponse, api } from "@/lib/api";
import { TOPIC_STATE_LABELS } from "@/lib/constants/vi-labels";
import { TopicStateGuide } from "@/components/shared/topic-state-guide";

interface TopicDetailDto {
  id: string;
  type: "BCTT" | "KLTN";
  title: string;
  domain: string;
  companyName?: string;
  state: string;
  studentUserId: string;
  supervisorUserId: string;
  periodId: string;
  submitStartAt?: string;
  submitEndAt?: string;
}

interface UserDto {
  id: string;
  email: string;
  name?: string;
  fullName?: string;
  studentId?: string;
  lecturerId?: string;
  department?: string;
}

interface SubmissionDto {
  id: string;
  fileType: string;
  version: number;
  uploadedAt: string;
  originalFileName?: string;
  fileSize?: number;
  driveLink?: string;
  status?: string;
}

interface ScoreDto {
  id: string;
  status: "DRAFT" | "SUBMITTED";
  totalScore?: number;
  isSubmitted?: boolean;
  criteria?: Record<string, number>;
}

interface PeriodOptionDto {
  id: string;
  code: string;
}

const EMPTY_PERIODS_RESPONSE: ApiListResponse<PeriodOptionDto> = {
  data: [],
  pagination: { page: 1, size: 0, total: 0 },
};

function formatDateTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("vi-VN", { hour12: false });
}

function formatFileSize(size?: number) {
  if (!size) return "";
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GVHDTopicDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const topicId = typeof id === "string" ? id : "";

  const [topic, setTopic] = useState<TopicDetailDto | null>(null);
  const [student, setStudent] = useState<UserDto | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionDto[]>([]);
  const [myScore, setMyScore] = useState<ScoreDto | null>(null);
  const [periodCode, setPeriodCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionSuccess, setTransitionSuccess] = useState<string | null>(null);

  // Edit title modal
  const [isEditTitleOpen, setIsEditTitleOpen] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!topicId) return;
    setIsLoading(true);
    setError(null);
    try {
      const topicRes = await api.get<ApiResponse<TopicDetailDto>>(`/topics/${topicId}`);
      const t = topicRes.data;
      setTopic(t);

      // Load student info, submissions, and my draft in parallel
      const [studentRes, submissionsRes, periodsRes] = await Promise.all([
        api.get<ApiResponse<UserDto>>(`/users/${t.studentUserId}`).catch(() => null),
        api.get<ApiResponse<SubmissionDto[]>>(`/topics/${topicId}/submissions`).catch(() => ({ data: [] })),
        api
          .get<ApiListResponse<PeriodOptionDto>>("/periods?page=1&size=100")
          .catch(() => EMPTY_PERIODS_RESPONSE),
      ]);

      setStudent(studentRes?.data ?? null);
      setSubmissions(submissionsRes?.data ?? []);
      const matchedPeriod = (periodsRes.data ?? []).find((period) => period.id === t.periodId);
      setPeriodCode(matchedPeriod?.code ?? t.periodId);

      // Try to load my scoring draft
      try {
        const draftRes = await api.get<ApiResponse<ScoreDto>>(`/topics/${topicId}/scores/my-draft`);
        setMyScore(draftRes.data);
      } catch (e) {
        if (e instanceof ApiRequestError && e.status === 404) {
          setMyScore(null);
        } else {
          throw e;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải thông tin đề tài.");
    } finally {
      setIsLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleTransition = async (action: string, label: string) => {
    if (!topic) return;
    if (!confirm(`Bạn có chắc muốn chuyển đề tài sang "${label}"?`)) return;
    setIsTransitioning(true);
    setError(null);
    setTransitionSuccess(null);
    try {
      await api.post(`/topics/${topic.id}/transition`, { action });
      setTransitionSuccess(`Đã chuyển sang "${label}" thành công.`);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể chuyển trạng thái.");
    } finally {
      setIsTransitioning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-outline gap-3">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Đang tải thông tin đề tài...</span>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="max-w-4xl mx-auto">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-outline hover:text-primary mb-6">
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </button>
        <div className="bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-error mt-0.5" />
          <p className="text-sm text-error">{error ?? "Không tìm thấy đề tài."}</p>
        </div>
      </div>
    );
  }

  const latestSubmission = submissions
    .filter((s) => s.fileType === "REPORT")
    .sort((a, b) => b.version - a.version)[0];

  const stateLabel = TOPIC_STATE_LABELS[topic.state] ?? { label: topic.state, color: "text-outline", bg: "bg-surface-container" };

  // Which transitions are available
  // BCTT: IN_PROGRESS -> GRADING (MOVE_TO_GRADING)
  // KLTN: IN_PROGRESS -> PENDING_CONFIRM (REQUEST_CONFIRM)
  const canTransitionToGrading = topic.state === "IN_PROGRESS" && topic.type === "BCTT";
  const canTransitionToPendingConfirm = topic.state === "IN_PROGRESS" && topic.type === "KLTN";
  const canTransitionToCompleted = topic.state === "GRADING" && topic.type === "BCTT";
  // Legacy support: handle topics stuck at CONFIRMED state
  const canStartProgress = topic.state === "CONFIRMED";

  const handleOpenEditTitle = () => {
    setEditedTitle(topic.title);
    setTitleError(null);
    setIsEditTitleOpen(true);
  };

  const handleSaveTitle = async () => {
    if (!editedTitle.trim()) {
      setTitleError("Tên đề tài không được để trống");
      return;
    }
    if (editedTitle.length > 255) {
      setTitleError("Tên đề tài không được vượt quá 255 ký tự");
      return;
    }

    setIsSavingTitle(true);
    setTitleError(null);
    try {
      await api.patch(`/topics/${topicId}/title`, { title: editedTitle });
      setTopic((prev) => (prev ? { ...prev, title: editedTitle } : prev));
      setIsEditTitleOpen(false);
      setTransitionSuccess("Đã cập nhật tên đề tài thành công!");
      setTimeout(() => setTransitionSuccess(null), 3000);
    } catch (e) {
      setTitleError(e instanceof Error ? e.message : "Không thể lưu tên đề tài");
    } finally {
      setIsSavingTitle(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-outline hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
      </button>

      {error && (
        <div className="bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-error mt-0.5 flex-shrink-0" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {transitionSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-green-700">{transitionSuccess}</p>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
        <div className="px-6 py-5 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase rounded-full mb-2">
              {topic.type}
            </span>
            <div className="flex items-start gap-3">
              <h1 className="text-xl font-bold font-headline text-on-surface leading-snug flex-1">{topic.title}</h1>
              <button
                onClick={handleOpenEditTitle}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant/20 text-xs font-semibold text-outline hover:text-primary hover:bg-primary/5 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Sửa tên
              </button>
            </div>
            {topic.domain && <p className="text-sm text-outline mt-1">{topic.domain}</p>}
          </div>
          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 ${stateLabel.bg ?? "bg-surface-container"} ${stateLabel.color ?? "text-outline"}`}>
            <Clock className="w-3.5 h-3.5" />
            {stateLabel.label ?? topic.state}
          </span>
        </div>
      </div>

      <TopicStateGuide role="GVHD" topicType={topic.type} topicState={topic.state} />

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* Left - Student Info + Submissions */}
        <div className="lg:col-span-2 space-y-5">
          {/* Student Info */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm text-on-surface">Thông tin sinh viên</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="block text-xs text-outline mb-0.5">Họ tên</span>
                <span className="font-semibold text-on-surface">
                  {student?.name ?? student?.fullName ?? "Chưa có thông tin"}
                </span>
              </div>
              {student?.studentId && (
                <div>
                  <span className="block text-xs text-outline mb-0.5">MSSV</span>
                  <span className="font-semibold text-on-surface">{student.studentId}</span>
                </div>
              )}
              {student?.email && (
                <div className="sm:col-span-2">
                  <span className="block text-xs text-outline mb-0.5">Email</span>
                  <span className="font-semibold text-on-surface">{student.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Submissions */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm text-on-surface">
                  Bài nộp của sinh viên
                  {submissions.length > 0 && (
                    <span className="ml-2 text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {submissions.length} file
                    </span>
                  )}
                </h3>
              </div>
              <button
                onClick={() => void loadData()}
                className="text-xs text-outline hover:text-primary transition-colors flex items-center gap-1"
              >
                Làm mới
              </button>
            </div>

            {submissions.length === 0 ? (
              <div className="px-5 py-10 flex flex-col items-center gap-3 text-outline">
                <BookOpen className="w-8 h-8 text-outline/30" />
                <p className="text-sm">Sinh viên chưa nộp bài.</p>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/10">
                {submissions.map((sub) => (
                  <div key={sub.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="font-semibold text-sm text-on-surface truncate">
                            {sub.originalFileName ?? `${sub.fileType}_v${sub.version}.pdf`}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-surface-container rounded uppercase text-outline">
                            {sub.fileType} v{sub.version}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-outline">
                          <span>{formatDateTime(sub.uploadedAt)}</span>
                          {sub.fileSize && <span>· {formatFileSize(sub.fileSize)}</span>}
                        </div>
                      </div>
                      {sub.driveLink && (
                        <a
                          href={sub.driveLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Xem PDF
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Score Status */}
          {myScore && (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className={`w-4 h-4 ${myScore.isSubmitted || myScore.status === "SUBMITTED" ? "text-green-600" : "text-amber-500"}`} />
                <h3 className="font-bold text-sm text-on-surface">Điểm của tôi</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${myScore.isSubmitted || myScore.status === "SUBMITTED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {myScore.isSubmitted || myScore.status === "SUBMITTED" ? "Đã nộp" : "Bản nháp"}
                </span>
              </div>
              {myScore.totalScore != null && (
                <div className="text-2xl font-black text-primary font-headline">
                  {myScore.totalScore.toFixed(1)} <span className="text-base font-normal text-outline">điểm</span>
                </div>
              )}
              <Link
                href={`/gvhd/scoring?topicId=${topicId}`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                Chỉnh sửa / Xem chi tiết điểm →
              </Link>
            </div>
          )}

          {!myScore && (
            <div className="bg-surface-container-lowest rounded-2xl border border-primary/20 shadow-sm p-5">
              <p className="text-sm text-outline mb-3">Bạn chưa chấm điểm cho đề tài này.</p>
              <Link
                href={`/gvhd/scoring?topicId=${topicId}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
              >
                Đi đến trang chấm điểm →
              </Link>
            </div>
          )}
        </div>

        {/* Right - Actions + Info */}
        <div className="space-y-5">
          {/* Topic Info */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm p-5">
            <h3 className="font-bold text-xs uppercase tracking-widest text-outline mb-4">Thông tin đề tài</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="block text-xs text-outline mb-0.5">Đợt</span>
                <span className="font-semibold text-on-surface">{periodCode || topic.periodId}</span>
              </div>
              {topic.companyName && (
                <div>
                  <span className="block text-xs text-outline mb-0.5">Công ty</span>
                  <span className="font-semibold text-on-surface">{topic.companyName}</span>
                </div>
              )}
              {topic.submitEndAt && (
                <div>
                  <span className="block text-xs text-outline mb-0.5">Hạn nộp bài</span>
                  <span className="font-semibold text-on-surface">{formatDateTime(topic.submitEndAt)}</span>
                </div>
              )}
              {latestSubmission && (
                <div>
                  <span className="block text-xs text-outline mb-0.5">File mới nhất</span>
                  <span className="text-xs font-semibold text-on-surface">
                    v{latestSubmission.version} · {formatDateTime(latestSubmission.uploadedAt)}
                  </span>
                  {latestSubmission.driveLink && (
                    <a
                      href={latestSubmission.driveLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-primary font-semibold mt-1 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> Mở trên Drive
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Transition Actions */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm p-5">
            <h3 className="font-bold text-xs uppercase tracking-widest text-outline mb-4">Thao tác</h3>
            <div className="space-y-3">
              {canStartProgress && (
                <button
                  onClick={() => void handleTransition("START_PROGRESS", "Bắt đầu thực hiện")}
                  disabled={isTransitioning}
                  className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isTransitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Bắt đầu thực hiện
                </button>
              )}
              {canTransitionToGrading && (
                <button
                  onClick={() => void handleTransition("MOVE_TO_GRADING", "Chấm điểm")}
                  disabled={isTransitioning}
                  className="w-full px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isTransitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Chuyển sang Chấm điểm
                </button>
              )}
              {canTransitionToPendingConfirm && (
                <button
                  onClick={() => void handleTransition("REQUEST_CONFIRM", "Chờ phản biện / chốt hội đồng (chưa chấm điểm)")}
                  disabled={isTransitioning}
                  className="w-full px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isTransitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Chuyển sang Chờ phản biện (chưa chấm)
                </button>
              )}
              {canTransitionToCompleted && (
                <button
                  onClick={() => void handleTransition("COMPLETE", "Hoàn thành")}
                  disabled={isTransitioning}
                  className="w-full px-4 py-2.5 bg-green-700 text-white text-sm font-semibold rounded-xl hover:bg-green-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isTransitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Hoàn tất BCTT
                </button>
              )}
              {!canStartProgress && !canTransitionToGrading && !canTransitionToPendingConfirm && !canTransitionToCompleted && (
                <p className="text-xs text-outline text-center py-2">
                  Không có thao tác chuyển trạng thái khả dụng.
                </p>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm p-5">
            <h3 className="font-bold text-xs uppercase tracking-widest text-outline mb-3">Liên kết nhanh</h3>
            <div className="flex flex-col gap-2">
              <Link
                href={`/gvhd/scoring?topicId=${topicId}`}
                className="text-sm text-primary font-semibold hover:underline flex items-center gap-1"
              >
                Trang chấm điểm →
              </Link>
              {latestSubmission?.driveLink && (
                <a
                  href={latestSubmission.driveLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary font-semibold hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> Xem bài nộp mới nhất
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Title Modal */}
      {isEditTitleOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setIsEditTitleOpen(false)}>
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-on-surface font-headline">Chỉnh sửa tên đề tài</h2>
              <button
                onClick={() => setIsEditTitleOpen(false)}
                className="text-outline hover:text-on-surface transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-outline mb-2">Tên đề tài</label>
                <textarea
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  placeholder="Nhập tên đề tài..."
                />
                <p className="text-xs text-outline mt-1">{editedTitle.length}/255 ký tự</p>
              </div>

              {titleError && (
                <div className="bg-error-container/20 border border-error/20 rounded-xl px-3 py-2 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-error mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-error">{titleError}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsEditTitleOpen(false)}
                disabled={isSavingTitle}
                className="flex-1 px-4 py-2.5 rounded-xl border border-outline-variant/20 text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={() => void handleSaveTitle()}
                disabled={isSavingTitle}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSavingTitle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSavingTitle ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
