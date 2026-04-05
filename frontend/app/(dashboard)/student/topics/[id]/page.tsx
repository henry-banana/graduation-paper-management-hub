"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  FileText,
  Award,
  ChevronDown,
  ChevronUp,
  UploadCloud,
  AlertCircle,
  ArrowLeft,
  Lock,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { FileUpload } from "@/components/ui/file-upload";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";
import {
  TOPIC_DOMAIN_OPTIONS,
  TOPIC_STATE_LABELS,
  TOPIC_TYPE_LABELS,
  formatDeadlineStatus,
} from "@/lib/constants/vi-labels";

type SubmissionFileType = "REPORT" | "TURNITIN" | "REVISION" | "INTERNSHIP_CONFIRMATION" | "REVISION_EXPLANATION";

interface TopicDto {
  id: string;
  type: "BCTT" | "KLTN";
  title: string;
  domain: string;
  companyName?: string;
  state: string;
  supervisorUserId: string;
  periodId: string;
  submitStartAt?: string;
  submitEndAt?: string;
}

interface SubmissionDto {
  id: string;
  fileType: SubmissionFileType;
  version: number;
  uploadedAt: string;
  originalFileName?: string;
  fileSize?: number;
  driveLink?: string;
}

interface RevisionRoundDto {
  id: string;
  roundNumber: number;
  status: "OPEN" | "CLOSED";
  startAt: string;
  endAt: string;
}

interface ScoreSummaryDto {
  gvhdScore?: number;
  gvpbScore?: number;
  councilAvgScore?: number;
  finalScore: number;
  result: "PASS" | "FAIL";
  published: boolean;
  rubricDocxLink?: string;
  appealChoice?: "NO_APPEAL" | "ACCEPT";
  appealChoiceAt?: string;
  appeal?: {
    requestedAt?: string;
    requestedBy?: string;
    reason?: string;
    status?: "PENDING" | "RESOLVED";
    resolvedAt?: string;
    resolvedBy?: string;
    resolutionNote?: string;
    scoreAdjusted?: boolean;
  };
}

interface ScheduleDto {
  id: string;
  defenseAt: string;
  locationType: "ONLINE" | "OFFLINE";
  locationDetail?: string;
  notes?: string;
}

interface NotificationDto {
  id: string;
  topicId?: string;
  title: string;
  body?: string;
  createdAt: string;
}

interface SupervisorOptionDto {
  id: string;
  fullName: string;
  lecturerId?: string;
  email?: string;
  department?: string;
  totalQuota?: number;
  quotaUsed?: number;
}

interface PeriodOptionDto {
  id: string;
  code: string;
}

const EMPTY_PERIODS_RESPONSE: ApiListResponse<PeriodOptionDto> = {
  data: [],
  pagination: { page: 1, size: 0, total: 0 },
};

const SCORE_READY_STATES = new Set([
  "GRADING",
  "SCORING",
  "DEFENSE",
  "COMPLETED",
]);

const SCHEDULE_READY_STATES = new Set(["DEFENSE", "SCORING", "COMPLETED"]);

const BCTT_STEPS = [
  { key: "DRAFT", label: "ĐĂNG KÝ" },
  { key: "PENDING_GV", label: "CHỜ DUYỆT" },
  { key: "CONFIRMED", label: "XÁC NHẬN" },
  { key: "IN_PROGRESS", label: "THỰC HIỆN" },
  { key: "GRADING", label: "CHẤM ĐIỂM" },
  { key: "COMPLETED", label: "HOÀN TẤT" },
];

const KLTN_STEPS = [
  { key: "DRAFT", label: "ĐĂNG KÝ" },
  { key: "PENDING_GV", label: "CHỜ DUYỆT" },
  { key: "CONFIRMED", label: "XÁC NHẬN" },
  { key: "IN_PROGRESS", label: "THỰC HIỆN" },
  { key: "PENDING_CONFIRM", label: "CHỜ PHẢN BIỆN" },
  { key: "DEFENSE", label: "BẢO VỆ" },
  { key: "SCORING", label: "CHẤM ĐIỂM" },
  { key: "COMPLETED", label: "HOÀN TẤT" },
];

function formatDateTime(value?: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("vi-VN", { hour12: false });
}

function formatFileSize(size?: number): string {
  if (!size) {
    return "-";
  }
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function getSubmissionWindowStatus(
  topic: Pick<TopicDto, "state" | "submitStartAt" | "submitEndAt">,
  selectedFileType: SubmissionFileType,
  activeRevisionRound: RevisionRoundDto | null,
): {
  canUpload: boolean;
  reason: string;
} {
  if (selectedFileType === "REVISION") {
    if (!["SCORING", "COMPLETED"].includes(topic.state)) {
      return {
        canUpload: false,
        reason: "Chỉ được nộp bản chỉnh sửa khi đề tài ở trạng thái SCORING hoặc COMPLETED.",
      };
    }

    if (!activeRevisionRound) {
      return {
        canUpload: false,
        reason: "Chưa có vòng chỉnh sửa mở cho đề tài này.",
      };
    }

    const startAt = new Date(activeRevisionRound.startAt).getTime();
    const endAt = new Date(activeRevisionRound.endAt).getTime();
    if (Number.isNaN(startAt) || Number.isNaN(endAt)) {
      return {
        canUpload: false,
        reason: "Cửa sổ vòng chỉnh sửa không hợp lệ. Vui lòng liên hệ TBM.",
      };
    }

    const now = Date.now();
    if (now < startAt) {
      return {
        canUpload: false,
        reason: "Chưa đến thời gian mở vòng chỉnh sửa.",
      };
    }

    if (now > endAt) {
      return {
        canUpload: false,
        reason: "Đã quá hạn vòng chỉnh sửa.",
      };
    }

    return {
      canUpload: true,
      reason: "",
    };
  }

  if (topic.state !== "IN_PROGRESS") {
    return {
      canUpload: false,
      reason: "Tính năng nộp bài sẽ mở khi đề tài ở trạng thái THỰC HIỆN ĐỀ TÀI.",
    };
  }

  if (!topic.submitStartAt || !topic.submitEndAt) {
    return {
      canUpload: false,
      reason: "Hệ thống chưa thiết lập cửa sổ nộp bài cho đề tài này.",
    };
  }

  const startAt = new Date(topic.submitStartAt).getTime();
  const endAt = new Date(topic.submitEndAt).getTime();
  if (Number.isNaN(startAt) || Number.isNaN(endAt)) {
    return {
      canUpload: false,
      reason: "Cửa sổ nộp bài không hợp lệ. Vui lòng liên hệ TBM.",
    };
  }

  const now = Date.now();
  if (now < startAt) {
    return {
      canUpload: false,
      reason: "Chưa đến thời gian cho phép nộp bài.",
    };
  }

  if (now > endAt) {
    return {
      canUpload: false,
      reason: "Đã quá hạn nộp bài.",
    };
  }

  return {
    canUpload: true,
    reason: "",
  };
}

function ProgressStepper({
  steps,
  activeIdx,
}: {
  steps: Array<{ key: string; label: string }>;
  activeIdx: number;
}) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1 scrollbar-hide py-4 px-2">
      {steps.map((step, i) => {
        const isDone = i < activeIdx;
        const isActive = i === activeIdx;
        return (
          <div key={step.key} className="flex items-center flex-shrink-0">
            <div
              className={`relative flex flex-col items-center justify-center px-4 py-3 rounded-xl text-center transition-all duration-300 min-w-[100px] h-14 ${
                isActive
                  ? "bg-primary text-white shadow-lg shadow-primary/30 ring-2 ring-primary ring-offset-2 scale-105 z-10"
                  : isDone
                  ? "bg-primary/80 text-white"
                  : "bg-surface-container text-outline border border-outline-variant/20"
              }`}
            >
              {isDone && <CheckCircle2 className="w-3.5 h-3.5 absolute top-1.5 right-1.5 text-white/70" />}
              <span className="text-[10px] font-bold leading-tight tracking-wide text-center">{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 h-0.5 flex-shrink-0 mx-1 rounded-full ${i < activeIdx ? "bg-primary/70" : "bg-outline-variant/30"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SubmissionPanel({
  topic,
  submissions,
  onUpload,
  activeRevisionRound,
  isUploading,
}: {
  topic: TopicDto;
  submissions: SubmissionDto[];
  onUpload: (file: File, fileType: SubmissionFileType) => Promise<void>;
  activeRevisionRound: RevisionRoundDto | null;
  isUploading: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [selectedFileType, setSelectedFileType] = useState<SubmissionFileType>("REPORT");

  const availableFileTypes = useMemo((): SubmissionFileType[] => {
    const types: SubmissionFileType[] = ["REPORT"];
    if (topic.type === "BCTT" && topic.state === "IN_PROGRESS") {
      types.push("INTERNSHIP_CONFIRMATION");
    }
    if (topic.type === "KLTN" && ["SCORING", "COMPLETED"].includes(topic.state)) {
      types.push("REVISION");
      types.push("REVISION_EXPLANATION");
    }
    return types;
  }, [topic.type, topic.state]);

  useEffect(() => {
    if (!availableFileTypes.includes(selectedFileType)) {
      setSelectedFileType(availableFileTypes[0] ?? "REPORT");
    }
  }, [availableFileTypes, selectedFileType]);

  const submissionWindow = getSubmissionWindowStatus(topic, selectedFileType, activeRevisionRound);
  const isLocked = !submissionWindow.canUpload;

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${isLocked ? "border-outline-variant/15 bg-surface-container/30" : "border-primary/20 bg-primary/5 shadow-sm"}`}>
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-surface-container/60 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {isLocked ? <Lock className="w-4 h-4 text-outline" /> : <UploadCloud className="w-4 h-4 text-primary" />}
            <span className="text-sm font-semibold text-on-surface">Nộp báo cáo cuối kỳ</span>
            {submissions.length > 0 && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase">Đã có bài nộp</span>}
          </div>
          <span className="text-xs text-outline">{isLocked ? submissionWindow.reason : "Mở nộp bài"}</span>
        </div>
        <div className="flex items-center gap-4">
          {!isLocked && topic.submitEndAt && (
            <span className="text-xs font-semibold px-2 py-1 rounded bg-surface-container-high text-error">
              Hạn: {formatDateTime(topic.submitEndAt)}
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-outline" /> : <ChevronDown className="w-4 h-4 text-outline" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-outline-variant/10">
          {isLocked ? (
            <div className="px-5 py-10 flex flex-col items-center gap-3 text-outline bg-surface-container-lowest">
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center">
                <Lock className="w-5 h-5 text-outline/40" />
              </div>
              <p className="text-sm text-center">{submissionWindow.reason}</p>
            </div>
          ) : (
            <div className="px-6 py-5 bg-surface-container-lowest flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 text-sm text-on-surface-variant">
                  <span className="font-semibold">Loại file</span>
                  <select
                    value={selectedFileType}
                    onChange={(event) => setSelectedFileType(event.target.value as SubmissionFileType)}
                    className="px-3 py-2 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface"
                    disabled={isUploading || availableFileTypes.length === 1}
                  >
                    {availableFileTypes.map((fileType) => (
                      <option key={fileType} value={fileType}>
                        {fileType}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end text-xs text-outline">
                  {selectedFileType === "INTERNSHIP_CONFIRMATION"
                    ? "Phiếu xác nhận thực tập chỉ áp dụng cho đề tài BCTT, định dạng PDF tối đa 50MB."
                    : selectedFileType === "REVISION"
                    ? activeRevisionRound
                      ? `Vòng chỉnh sửa V${activeRevisionRound.roundNumber}: ${formatDateTime(activeRevisionRound.startAt)} - ${formatDateTime(activeRevisionRound.endAt)}`
                      : "Bản chỉnh sửa yêu cầu một vòng chỉnh sửa đang mở do TBM cấu hình."
                    : selectedFileType === "REVISION_EXPLANATION"
                    ? "File giải trình chỉnh sửa (PDF), đính kèm cùng với bản REVISION."
                    : "Báo cáo PDF, dung lượng tối đa 50MB."}
                </div>
              </div>

              <FileUpload
                onUpload={(file) => onUpload(file, selectedFileType)}
                accept=".pdf"
                maxSize={50}
                requireConfirmation
                confirmButtonText={
                  selectedFileType === "INTERNSHIP_CONFIRMATION"
                    ? "Xác nhận nộp phiếu xác nhận thực tập"
                    : selectedFileType === "REVISION"
                    ? "Xác nhận nộp bản chỉnh sửa"
                    : "Xác nhận nộp báo cáo"
                }
              />

              <div className="w-full border border-outline-variant/15 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-surface-container/40 text-xs font-bold uppercase tracking-wide text-outline">
                  Lịch sử nộp
                </div>
                {submissions.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-outline">Chưa có bài nộp nào.</p>
                ) : (
                  <div className="divide-y divide-outline-variant/10">
                    {submissions.map((submission) => (
                      <div key={submission.id} className="px-4 py-3 text-sm">
                        <p className="font-semibold text-on-surface">
                          {submission.originalFileName ?? `${submission.fileType}_v${submission.version}.pdf`}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-outline">
                          <span>{submission.fileType}</span>
                          <span>v{submission.version}</span>
                          <span>{formatDateTime(submission.uploadedAt)}</span>
                          <span>{formatFileSize(submission.fileSize)}</span>
                        </div>
                        {submission.driveLink && (
                          <a
                            href={submission.driveLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary font-semibold mt-1 inline-flex"
                          >
                            Mở file trên Drive
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col items-center gap-1.5 bg-surface-container-lowest rounded-2xl px-3 py-4 border border-outline-variant/15 shadow-sm">
      <span className="text-[10px] uppercase font-bold text-outline text-center leading-tight h-6 flex items-end">{label}</span>
      <div className="h-px w-full bg-outline-variant/10 my-1" />
      {value != null ? (
        <span className="text-2xl font-black text-primary font-headline">{value}</span>
      ) : (
        <span className="text-xs text-outline/50 font-bold mt-1 uppercase tracking-wider">Chưa có</span>
      )}
    </div>
  );
}

export default function StudentTopicDetailPage() {
  const params = useParams();
  const topicId = typeof params?.id === "string" ? params.id : "";

  const [topic, setTopic] = useState<TopicDto | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionDto[]>([]);
  const [activeRevisionRound, setActiveRevisionRound] = useState<RevisionRoundDto | null>(null);
  const [summary, setSummary] = useState<ScoreSummaryDto | null>(null);
  const [appealReason, setAppealReason] = useState("");
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);
  const [isSubmittingNoAppeal, setIsSubmittingNoAppeal] = useState(false);
  const [appealFeedback, setAppealFeedback] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleDto | null>(null);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorOptionDto[]>([]);
  const [periodCode, setPeriodCode] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);
  
  // Topic Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    domain: "",
    companyName: "",
    supervisorUserId: "",
  });

  useEffect(() => {
    if (!topicId) {
      return;
    }

    const loadData = async () => {
      setError(null);
      setScoreError(null);

      try {
        const topicRes = await api.get<ApiResponse<TopicDto>>(`/topics/${topicId}`);
        setTopic(topicRes.data);
        setEditForm({
          title: topicRes.data.title || "",
          domain: topicRes.data.domain || "",
          companyName: topicRes.data.companyName || "",
          supervisorUserId: topicRes.data.supervisorUserId || "",
        });

        // Bug #6 fix: Include current supervisor ID to show their name even if at full quota
        const currentSupervisorId = topicRes.data.supervisorUserId;
        const [submissionsRes, notificationsRes, supervisorsRes, roundsRes, periodsRes] = await Promise.all([
          api.get<ApiResponse<SubmissionDto[]>>(`/topics/${topicId}/submissions`),
          api.get<ApiListResponse<NotificationDto>>("/notifications?page=1&size=100"),
          api.get<ApiResponse<SupervisorOptionDto[]>>(
            `/users/supervisors/options${currentSupervisorId ? `?includeId=${currentSupervisorId}` : ''}`
          ),
          api
            .get<ApiResponse<RevisionRoundDto[]>>(`/topics/${topicId}/revisions/rounds`)
            .catch(() => null),
          api
            .get<ApiListResponse<PeriodOptionDto>>("/periods?page=1&size=100")
            .catch(() => EMPTY_PERIODS_RESPONSE),
        ]);

        setSubmissions(submissionsRes.data);
        const openRound = roundsRes?.data
          ?.filter((round) => round.status === "OPEN")
          .sort((a, b) => b.roundNumber - a.roundNumber)[0] ?? null;
        setActiveRevisionRound(openRound);
        setNotifications(
          notificationsRes.data.filter((notification) => notification.topicId === topicId),
        );
        setSupervisors(supervisorsRes.data);
        const matchedPeriod = (periodsRes.data ?? []).find(
          (period) => period.id === topicRes.data.periodId,
        );
        setPeriodCode(matchedPeriod?.code ?? topicRes.data.periodId);

        const scoreReady = SCORE_READY_STATES.has(topicRes.data.state);
        if (scoreReady) {
          try {
            const summaryRes = await api.get<ApiResponse<ScoreSummaryDto>>(
              `/topics/${topicId}/scores/summary`,
            );
            setSummary(summaryRes.data);
          } catch (summaryLoadError) {
            setSummary(null);
            if (summaryLoadError instanceof Error) {
              const normalized = summaryLoadError.message.toLowerCase();
              if (
                normalized.includes("not yet published") ||
                normalized.includes("chưa có điểm") ||
                normalized.includes("chưa được công bố")
              ) {
                setScoreError(null);
              } else {
                setScoreError(summaryLoadError.message);
              }
            }
          }
        } else {
          setSummary(null);
          setScoreError(null);
        }

        const scheduleReady = SCHEDULE_READY_STATES.has(topicRes.data.state);
        if (!scheduleReady) {
          setSchedule(null);
        } else {
          try {
            const scheduleRes = await api.get<ScheduleDto>(`/topics/${topicId}/schedule`);
            setSchedule(scheduleRes);
          } catch {
            setSchedule(null);
          }
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Không thể tải chi tiết đề tài.";
        setError(message);
      }
    };

    void loadData();
  }, [topicId]);

  const steps = topic?.type === "KLTN" ? KLTN_STEPS : BCTT_STEPS;
  const activeStepIndex = useMemo(() => {
    if (!topic) {
      return 0;
    }
    const index = steps.findIndex((step) => step.key === topic.state);
    return index >= 0 ? index : 0;
  }, [steps, topic]);

  const selectedSupervisor = useMemo(() => {
    if (!topic) {
      return null;
    }

    return supervisors.find((supervisor) => supervisor.id === topic.supervisorUserId) ?? null;
  }, [supervisors, topic]);

  const handleUpload = async (file: File, fileType: SubmissionFileType) => {
    if (!topic) {
      throw new Error("Không tìm thấy đề tài.");
    }

    const submissionWindow = getSubmissionWindowStatus(topic, fileType, activeRevisionRound);
    if (!submissionWindow.canUpload) {
      throw new Error(submissionWindow.reason);
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileType", fileType);

      await api.postForm<ApiResponse<{ id: string; version: number }>>(
        `/topics/${topic.id}/submissions`,
        formData,
      );

      const updated = await api.get<ApiResponse<SubmissionDto[]>>(
        `/topics/${topic.id}/submissions`,
      );
      setSubmissions(updated.data);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Nộp file thất bại.";
      setError(message);
      throw uploadError;
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditTopic = async () => {
    if (!topic) return;
    setIsSubmittingEdit(true);
    setError(null);
    try {
      await api.patch(`/topics/${topic.id}`, {
        title: editForm.title,
        domain: editForm.domain,
        companyName: editForm.companyName,
        supervisorUserId: editForm.supervisorUserId,
      });

      setTopic({
        ...topic,
        title: editForm.title,
        domain: editForm.domain,
        companyName: editForm.companyName,
        supervisorUserId: editForm.supervisorUserId,
      });
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || "Lưu thông tin thất bại");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleCancelTopic = async () => {
    if (!topic || !confirm("Bạn có chắc chắn muốn hủy đăng ký đề tài này không? Hành động này không thể hoàn tác.")) return;
    setIsCanceling(true);
    setError(null);
    try {
      await api.post(`/topics/${topic.id}/transition`, { action: "CANCEL" });
      setTopic({ ...topic, state: "CANCELLED" });
    } catch (err: any) {
      setError(err.message || "Hủy đề tài thất bại");
    } finally {
      setIsCanceling(false);
    }
  };

  const [isSubmittingToGv, setIsSubmittingToGv] = useState(false);

  const canRequestAppeal =
    topic?.type === "BCTT" &&
    Boolean(summary?.published) &&
    !summary?.appealChoice &&
    !summary?.appeal?.requestedAt;

  const handleSubmitAppeal = async () => {
    if (!topic || !canRequestAppeal) {
      return;
    }

    const reason = appealReason.trim();
    if (reason.length < 10) {
      setAppealFeedback("Vui lòng nhập lý do phúc khảo tối thiểu 10 ký tự.");
      return;
    }

    setAppealFeedback(null);
    setIsSubmittingAppeal(true);

    try {
      await api.post<ApiResponse<{ status: "PENDING"; requestedAt: string }>>(
        `/topics/${topic.id}/scores/appeal`,
        { reason },
      );

      const refreshed = await api.get<ApiResponse<ScoreSummaryDto>>(
        `/topics/${topic.id}/scores/summary`,
      );
      setSummary(refreshed.data);
      setAppealReason("");
      setAppealFeedback("Đã gửi yêu cầu phúc khảo. GVHD sẽ xử lý sớm.");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Không thể gửi phúc khảo.";
      setAppealFeedback(message);
    } finally {
      setIsSubmittingAppeal(false);
    }
  };

  const handleSubmitNoAppeal = async () => {
    if (!topic || topic.type !== "BCTT" || !summary?.published) {
      return;
    }

    if (
      !window.confirm(
        "Bạn xác nhận KHÔNG phúc khảo? Sau khi xác nhận, hệ thống sẽ hoàn tất đề tài BCTT.",
      )
    ) {
      return;
    }

    setAppealFeedback(null);
    setIsSubmittingNoAppeal(true);

    try {
      const response = await api.post<
        ApiResponse<{
          choice: "NO_APPEAL" | "ACCEPT";
          message: string;
          topicState?: string;
          rubricLink?: string;
        }>
      >(`/topics/${topic.id}/scores/appeal-choice`, {
        choice: "NO_APPEAL",
      });

      const refreshed = await api.get<ApiResponse<ScoreSummaryDto>>(
        `/topics/${topic.id}/scores/summary`,
      );
      setSummary(refreshed.data);
      setAppealFeedback(response.data.message);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Không thể ghi nhận lựa chọn không phúc khảo.";
      setAppealFeedback(message);
    } finally {
      setIsSubmittingNoAppeal(false);
    }
  };

  const handleSubmitToGv = async () => {
    if (!topic || !confirm("Xác nhận gửi đề tài đến GVHD để chờ duyệt?")) return;
    setIsSubmittingToGv(true);
    setError(null);
    try {
      await api.post(`/topics/${topic.id}/transition`, { action: "SUBMIT_TO_GV" });
      setTopic({ ...topic, state: "PENDING_GV" });
    } catch (err: any) {
      setError(err.message || "Gửi đến GVHD thất bại. Vui lòng thử lại.");
    } finally {
      setIsSubmittingToGv(false);
    }
  };

  if (error && !topic) {
    return (
      <div className="flex items-start gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
        <AlertCircle className="w-4 h-4 text-error mt-0.5 flex-shrink-0" />
        <p className="text-sm text-error">{error}</p>
      </div>
    );
  }

  if (!topic) {
    return <div className="text-sm text-outline">Đang tải chi tiết đề tài...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      <Link href="/student/topics" className="inline-flex items-center gap-1.5 text-sm font-semibold text-outline hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" /> Quay lại Đề tài của tôi
      </Link>

      {error && (
        <div className="flex items-start gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-error mt-0.5 flex-shrink-0" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Stepper Section (Full Width Top) */}
      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm p-6 overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase rounded-full mb-2">
              {TOPIC_TYPE_LABELS[topic.type] || topic.type}
            </span>
            <h1 className="text-xl md:text-2xl font-bold font-headline text-on-surface leading-snug">{topic.title}</h1>
          </div>
          
          <div className="flex gap-2 shrink-0">
             {topic.state === "DRAFT" && (
               <button
                 onClick={handleSubmitToGv}
                 disabled={isSubmittingToGv}
                 className="px-4 py-2 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
               >
                 {isSubmittingToGv ? "Đang gửi..." : "Gửi đến GVHD"}
               </button>
             )}
             {["DRAFT", "PENDING_GV"].includes(topic.state) && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 border border-primary text-primary font-semibold text-sm rounded-xl hover:bg-primary/5 transition-colors"
                >
                  Sửa thông tin
                </button>
             )}
             {["DRAFT", "PENDING_GV"].includes(topic.state) && (
                <button
                  onClick={handleCancelTopic}
                  disabled={isCanceling}
                  className="px-4 py-2 bg-error text-white font-semibold text-sm rounded-xl hover:bg-error/90 transition-colors disabled:opacity-50"
                >
                  {isCanceling ? "Đang hủy..." : "Hủy đăng ký"}
                </button>
             )}
          </div>
        </div>
        
        <div className="bg-surface-container/30 rounded-2xl border border-outline-variant/10 p-2 relative">
          <ProgressStepper steps={steps} activeIdx={activeStepIndex} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Detail Info Card */}
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
            {/* Status Alert */}
            <div className={`px-6 py-4 flex items-center gap-3 border-b ${TOPIC_STATE_LABELS[topic.state]?.bg || 'bg-surface-container-low'} ${TOPIC_STATE_LABELS[topic.state]?.color?.replace('text-', 'border-') || 'border-outline-variant/20'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white/50`}>
                <Clock className={`w-4 h-4 ${TOPIC_STATE_LABELS[topic.state]?.color || 'text-outline'}`} />
              </div>
              <p className={`text-sm font-semibold ${TOPIC_STATE_LABELS[topic.state]?.color || 'text-on-surface'}`}>
                Trạng thái: {TOPIC_STATE_LABELS[topic.state]?.label || topic.state}
              </p>
            </div>

            <div className="px-6 py-5">
              <h4 className="text-xs font-bold uppercase tracking-widest text-outline mb-4">Thông tin đề tài</h4>
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1 font-semibold">Tên đề tài</label>
                    <input className="w-full px-3 py-2 border rounded-xl" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1 font-semibold">Ngành/Chuyên ngành</label>
                    <select
                      className="w-full px-3 py-2 border rounded-xl bg-surface-container"
                      value={editForm.domain}
                      onChange={e => setEditForm({ ...editForm, domain: e.target.value })}
                    >
                      <option value="">Chọn ngành/chuyên ngành</option>
                      {TOPIC_DOMAIN_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1 font-semibold">Công ty</label>
                    <input className="w-full px-3 py-2 border rounded-xl" value={editForm.companyName} onChange={e => setEditForm({...editForm, companyName: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1 font-semibold">GV hướng dẫn</label>
                    <select
                      className="w-full px-3 py-2 border rounded-xl bg-surface-container"
                      value={editForm.supervisorUserId}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          supervisorUserId: e.target.value,
                        })
                      }
                    >
                      {supervisors.map((supervisor) => {
                        const isFull =
                          (supervisor.quotaUsed ?? 0) >=
                            (supervisor.totalQuota ?? 0) &&
                          supervisor.id !== topic.supervisorUserId;
                        const remainingSlots =
                          typeof supervisor.totalQuota === "number" &&
                          typeof supervisor.quotaUsed === "number"
                            ? Math.max(supervisor.totalQuota - supervisor.quotaUsed, 0)
                            : null;

                        return (
                          <option
                            key={supervisor.id}
                            value={supervisor.id}
                            disabled={isFull}
                          >
                            {supervisor.fullName}
                            {supervisor.lecturerId ? ` (${supervisor.lecturerId})` : ""}
                            {supervisor.department
                              ? ` (${supervisor.department})`
                              : ""}
                            {remainingSlots != null
                              ? ` - Còn ${remainingSlots}/${supervisor.totalQuota}`
                              : ""}
                            {isFull ? " (Đã đầy)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm text-outline border rounded-xl">Hủy</button>
                    <button onClick={handleEditTopic} disabled={isSubmittingEdit} className="px-4 py-2 text-sm text-white bg-primary rounded-xl disabled:opacity-50">Lưu</button>
                  </div>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                  <div>
                    <span className="block text-xs text-on-surface-variant mb-1">GV Hướng dẫn</span>
                    <span className="font-semibold text-on-surface text-[15px]">
                      {selectedSupervisor?.fullName ?? "GVHD chưa cập nhật"}
                    </span>
                    {selectedSupervisor?.department && (
                      <p className="text-xs text-outline mt-1">{selectedSupervisor.department}</p>
                    )}
                    {(selectedSupervisor?.lecturerId || selectedSupervisor?.email) && (
                      <p className="text-xs text-outline mt-1">
                        {selectedSupervisor.lecturerId ?? selectedSupervisor.email}
                      </p>
                    )}
                  </div>
                  <div><span className="block text-xs text-on-surface-variant mb-1">Ngành/Chuyên ngành</span><span className="font-semibold text-on-surface text-[15px]">{topic.domain}</span></div>
                  <div><span className="block text-xs text-on-surface-variant mb-1">Đợt</span><span className="font-semibold text-on-surface text-[15px]">{periodCode || topic.periodId}</span></div>
                  <div>
                     <span className="block text-xs text-on-surface-variant mb-1">Hạn nộp báo cáo</span>
                     <span className={`font-semibold ${formatDeadlineStatus(topic.submitEndAt).urgency === 'urgent' ? 'text-amber-600' : 'text-on-surface'}`}>
                       {formatDeadlineStatus(topic.submitEndAt).display} 
                       <span className="font-normal text-xs ml-2">({formatDeadlineStatus(topic.submitEndAt).label})</span>
                     </span>
                  </div>
                  {topic.companyName && (
                    <div className="sm:col-span-2"><span className="block text-xs text-on-surface-variant mb-1">Công ty</span><span className="font-semibold text-on-surface text-[15px]">{topic.companyName}</span></div>
                  )}
                </div>
              )}
            </div>
          </div>

          <SubmissionPanel
            topic={topic}
            submissions={submissions}
            onUpload={handleUpload}
            activeRevisionRound={activeRevisionRound}
            isUploading={isUploading}
          />
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {schedule && (
            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
              <div className="px-5 py-4 bg-surface-container/30 border-b border-outline-variant/10 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm text-on-surface">Lịch bảo vệ</h3>
              </div>
              <div className="p-4 text-sm text-on-surface-variant space-y-1.5">
                <p><strong>Thời gian:</strong> {formatDateTime(schedule.defenseAt)}</p>
                <p><strong>Hình thức:</strong> {schedule.locationType}</p>
                <p><strong>Địa điểm:</strong> {schedule.locationDetail ?? "-"}</p>
                {schedule.notes && <p><strong>Ghi chú:</strong> {schedule.notes}</p>}
              </div>
            </div>
          )}

          {/* Score Box */}
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-surface-container/30 border-b border-outline-variant/10 flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm text-on-surface">Kết quả điểm</h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3 relative">
              <ScoreCard label="Hướng dẫn" value={summary?.gvhdScore ?? null} />
              <ScoreCard label="Phản biện" value={summary?.gvpbScore ?? null} />
              <div className="col-span-2">
                <ScoreCard label="Hội đồng" value={summary?.councilAvgScore ?? null} />
              </div>
              {!summary?.published && (
                 <div className="absolute inset-x-2 top-2 bottom-3 bg-surface-container-lowest/80 backdrop-blur-sm border border-outline-variant/10 rounded-2xl flex flex-col items-center justify-center text-center p-4">
                   <Lock className="w-6 h-6 text-outline mb-2" />
                   <p className="text-xs font-semibold text-outline">Điểm được công bố sau khi hoàn tất xác nhận cuối cùng.</p>
                 </div>
              )}
            </div>
            {summary && (
              <div className="px-4 pb-4 text-sm text-on-surface-variant">
                Tổng điểm: <strong>{summary.finalScore.toFixed(2)}</strong> ({summary.result === "PASS" ? "Đạt" : "Không đạt"})
              </div>
            )}
            {scoreError && (
              <div className="px-4 pb-4 text-xs text-outline">{scoreError}</div>
            )}
            {topic.type === "BCTT" && summary && (
              <div className="px-4 pb-4 pt-1 border-t border-outline-variant/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-outline uppercase tracking-wider">
                    Phiếu chấm
                  </span>
                  {summary.rubricDocxLink ? (
                    <a
                      href={summary.rubricDocxLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Mở DOCX
                    </a>
                  ) : (
                    <span className="text-[11px] text-outline">Chưa có file</span>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-outline uppercase tracking-wider">
                    Phúc khảo điểm (1 lần)
                  </p>

                  {summary.appeal?.requestedAt ? (
                    <div className="text-xs text-on-surface-variant space-y-1">
                      <p>
                        Trạng thái:{" "}
                        <strong>
                          {summary.appeal.status === "RESOLVED"
                            ? "Đã xử lý"
                            : "Đang chờ xử lý"}
                        </strong>
                      </p>
                      {summary.appeal.reason && <p>Lý do: {summary.appeal.reason}</p>}
                      {summary.appeal.resolutionNote && (
                        <p>Phản hồi: {summary.appeal.resolutionNote}</p>
                      )}
                    </div>
                  ) : summary.appealChoice ? (
                    <div className="text-xs text-on-surface-variant space-y-1">
                      <p>
                        Đã ghi nhận lựa chọn:{" "}
                        <strong>
                          {summary.appealChoice === "NO_APPEAL"
                            ? "Không phúc khảo"
                            : "Chấp nhận điểm"}
                        </strong>
                      </p>
                      {summary.appealChoiceAt && (
                        <p>
                          Thời điểm:{" "}
                          {new Date(summary.appealChoiceAt).toLocaleString("vi-VN", {
                            hour12: false,
                          })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={appealReason}
                        onChange={(event) => setAppealReason(event.target.value)}
                        placeholder="Nêu lý do phúc khảo..."
                        className="w-full px-2.5 py-2 rounded-xl border border-outline-variant/20 bg-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSubmitAppeal()}
                        disabled={isSubmittingAppeal || isSubmittingNoAppeal}
                        className="w-full px-3 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                      >
                        {isSubmittingAppeal ? "Đang gửi..." : "Gửi phúc khảo"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSubmitNoAppeal()}
                        disabled={isSubmittingAppeal || isSubmittingNoAppeal}
                        className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 text-xs font-semibold text-on-surface hover:bg-surface-container-lowest transition-colors disabled:opacity-60"
                      >
                        {isSubmittingNoAppeal ? "Đang xử lý..." : "Không phúc khảo"}
                      </button>
                    </div>
                  )}

                  {appealFeedback && (
                    <p className="text-[11px] text-outline">{appealFeedback}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Announcements */}
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-surface-container/30 border-b border-outline-variant/10">
              <h3 className="font-bold text-sm text-on-surface flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-primary" /> Bảng thông báo
              </h3>
            </div>
            <div className="divide-y divide-outline-variant/10">
              {notifications.length === 0 && (
                <div className="p-4 text-sm text-outline">Chưa có thông báo nào cho đề tài này.</div>
              )}
              {notifications.map((a) => (
                <div key={a.id} className="p-4 hover:bg-surface-container/30 transition-colors">
                  <p className="text-sm font-medium text-on-surface-variant leading-snug">{a.title}</p>
                  {a.body && <p className="text-xs text-outline mt-1">{a.body}</p>}
                  <div className="flex justify-between items-center mt-2 text-[10px] text-outline font-medium tracking-wide">
                    <span>Hệ thống</span>
                    <span>{formatDateTime(a.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
