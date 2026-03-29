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

type SubmissionFileType = "REPORT" | "TURNITIN" | "REVISION";

interface TopicDto {
  id: string;
  type: "BCTT" | "KLTN";
  title: string;
  domain: string;
  companyName?: string;
  state: string;
  supervisorUserId: string;
  periodId: string;
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

interface ScoreSummaryDto {
  gvhdScore?: number;
  gvpbScore?: number;
  councilAvgScore?: number;
  finalScore: number;
  result: "PASS" | "FAIL";
  published: boolean;
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
  fileType,
  onFileTypeChange,
  onUpload,
  isUploading,
}: {
  topic: TopicDto;
  submissions: SubmissionDto[];
  fileType: SubmissionFileType;
  onFileTypeChange: (value: SubmissionFileType) => void;
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const isLocked = topic.state !== "IN_PROGRESS";

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
          <span className="text-xs text-outline">{isLocked ? "Tính năng đang bị khóa" : "Mở nộp bài"}</span>
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
              <p className="text-sm">Tính năng nộp bài sẽ mở khi hệ thống chuyển sang trạng thái <strong>THỰC HIỆN ĐỀ TÀI</strong>.</p>
            </div>
          ) : (
            <div className="px-6 py-5 bg-surface-container-lowest flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
                  <span className="font-semibold">Loại file</span>
                  <select
                    value={fileType}
                    onChange={(event) => onFileTypeChange(event.target.value as SubmissionFileType)}
                    className="px-3 py-2 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface"
                    disabled={isUploading}
                  >
                    <option value="REPORT">REPORT</option>
                    <option value="TURNITIN">TURNITIN</option>
                    <option value="REVISION">REVISION</option>
                  </select>
                </label>
                <div className="flex items-end text-xs text-outline">
                  Nộp file PDF, dung lượng tối đa 50MB.
                </div>
              </div>

              <FileUpload onUpload={onUpload} accept=".pdf" maxSize={50} />

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
  const [summary, setSummary] = useState<ScoreSummaryDto | null>(null);
  const [schedule, setSchedule] = useState<ScheduleDto | null>(null);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [fileType, setFileType] = useState<SubmissionFileType>("REPORT");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);

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

        const [submissionsRes, notificationsRes] = await Promise.all([
          api.get<ApiResponse<SubmissionDto[]>>(`/topics/${topicId}/submissions`),
          api.get<ApiListResponse<NotificationDto>>("/notifications?page=1&size=100"),
        ]);

        setSubmissions(submissionsRes.data);
        setNotifications(
          notificationsRes.data.filter((notification) => notification.topicId === topicId),
        );

        try {
          const summaryRes = await api.get<ApiResponse<ScoreSummaryDto>>(
            `/topics/${topicId}/scores/summary`,
          );
          setSummary(summaryRes.data);
        } catch (summaryLoadError) {
          setSummary(null);
          if (summaryLoadError instanceof Error) {
            setScoreError(summaryLoadError.message);
          }
        }

        try {
          const scheduleRes = await api.get<ScheduleDto>(`/topics/${topicId}/schedule`);
          setSchedule(scheduleRes);
        } catch {
          setSchedule(null);
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

  const handleUpload = async (file: File) => {
    if (!topic) {
      throw new Error("Không tìm thấy đề tài.");
    }

    if (topic.state !== "IN_PROGRESS") {
      throw new Error("Chỉ nộp file khi đề tài đang ở trạng thái IN_PROGRESS.");
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

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header & Stepper */}
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
            <div className="p-6 bg-gradient-to-br from-primary/5 to-transparent">
              <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase rounded-full mb-3">
                {topic.type}
              </span>
              <h1 className="text-xl md:text-2xl font-bold font-headline text-on-surface leading-snug">{topic.title}</h1>
              
              <div className="mt-8 bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4 shadow-sm overflow-hidden relative">
                <span className="absolute top-0 right-0 px-3 py-1 bg-primary rounded-bl-xl text-[10px] font-bold text-white uppercase shadow-sm">
                  Tiến độ
                </span>
                <ProgressStepper steps={steps} activeIdx={activeStepIndex} />
              </div>
            </div>

            {/* Status Alert from slides */}
            <div className="px-6 py-4 bg-amber-50/50 border-t border-b border-amber-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-sm font-semibold text-amber-800">Trạng thái hiện tại: {topic.state}</p>
            </div>

            <div className="px-6 py-5">
              <h4 className="text-xs font-bold uppercase tracking-widest text-outline mb-4">Thông tin đề tài</h4>
              <div className="grid sm:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                <div><span className="block text-xs text-outline mb-1">GV Hướng dẫn</span><span className="font-semibold text-on-surface">{topic.supervisorUserId}</span></div>
                <div><span className="block text-xs text-outline mb-1">Mảng đề tài</span><span className="font-semibold text-on-surface">{topic.domain}</span></div>
                <div><span className="block text-xs text-outline mb-1">Đợt</span><span className="font-semibold text-on-surface">{topic.periodId}</span></div>
                <div><span className="block text-xs text-outline mb-1">Hạn nộp</span><span className="font-semibold text-on-surface">{formatDateTime(topic.submitEndAt)}</span></div>
                {topic.companyName && (
                  <div className="sm:col-span-2"><span className="block text-xs text-outline mb-1">Công ty</span><span className="font-semibold text-on-surface">{topic.companyName}</span></div>
                )}
              </div>
            </div>
          </div>

          <SubmissionPanel
            topic={topic}
            submissions={submissions}
            fileType={fileType}
            onFileTypeChange={setFileType}
            onUpload={handleUpload}
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
