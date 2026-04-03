"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, CheckCircle, Clock, AlertCircle, Lock, RefreshCw } from "lucide-react";

import { FileUpload } from "@/components/ui/file-upload";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";
import { formatDeadlineStatus, TOPIC_STATE_LABELS, TOPIC_TYPE_LABELS, FILE_TYPE_LABELS } from "@/lib/constants/vi-labels";

type SubmissionFileType = "REPORT" | "TURNITIN" | "REVISION";

interface TopicDto {
  id: string;
  title: string;
  type: "BCTT" | "KLTN";
  state: string;
  submitStartAt?: string;
  submitEndAt?: string;
}

interface SubmissionDto {
  id: string;
  fileType: SubmissionFileType;
  version: number;
  originalFileName?: string;
  fileSize?: number;
  uploadedAt: string;
  driveLink?: string;
  // F4C: lock fields from backend
  isLocked?: boolean;
  canReplace?: boolean;
  versionLabel?: string;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("vi-VN", { hour12: false });
}

function formatFileSize(value?: number): string {
  if (!value) {
    return "-";
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

// F4C: upload guard — window time AND backend lock
function getSubmissionWindowStatus(
  topic: TopicDto | null,
  latestSubmission: SubmissionDto | null,
): { canUpload: boolean; reason: string; isLocked: boolean } {
  if (!topic) {
    return { canUpload: false, reason: "Vui lòng chọn đề tài trước khi nộp file.", isLocked: false };
  }

  // F4C: if latest submission is locked and cannot be replaced, block upload
  if (latestSubmission?.isLocked && !latestSubmission.canReplace) {
    return {
      canUpload: false,
      reason: "Bài nộp đã bị khóa. Chỉ có thể tải lại khi GVHD yêu cầu nộp lại.",
      isLocked: true,
    };
  }

  if (topic.state !== "IN_PROGRESS") {
    return {
      canUpload: false,
      reason: "Chỉ được nộp file khi đề tài ở trạng thái IN_PROGRESS.",
      isLocked: false,
    };
  }

  if (!topic.submitStartAt || !topic.submitEndAt) {
    return {
      canUpload: false,
      reason: "Hệ thống chưa thiết lập cửa sổ nộp bài cho đề tài này.",
      isLocked: false,
    };
  }

  const startAt = new Date(topic.submitStartAt).getTime();
  const endAt = new Date(topic.submitEndAt).getTime();

  if (Number.isNaN(startAt) || Number.isNaN(endAt)) {
    return { canUpload: false, reason: "Cửa sổ nộp bài không hợp lệ. Vui lòng liên hệ TBM.", isLocked: false };
  }

  const now = Date.now();
  if (now < startAt) {
    return { canUpload: false, reason: "Chưa đến thời gian cho phép nộp bài.", isLocked: false };
  }

  if (now > endAt) {
    return { canUpload: false, reason: "Đã quá hạn nộp bài.", isLocked: false };
  }

  return { canUpload: true, reason: "", isLocked: false };
}

function StudentSubmissionsContent() {
  const searchParams = useSearchParams();
  const requestedTopicId = searchParams.get("topicId")?.trim() ?? "";

  const [topics, setTopics] = useState<TopicDto[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [submissions, setSubmissions] = useState<SubmissionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isReplacing, setIsReplacing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);


  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? null,
    [topics, selectedTopicId],
  );

  const submissionWindow = useMemo(
    () => getSubmissionWindowStatus(selectedTopic, submissions[0] ?? null),
    [selectedTopic, submissions],
  );

  const canUpload = submissionWindow.canUpload;

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.get<ApiListResponse<TopicDto>>(
          "/topics?role=student&page=1&size=100",
        );
        setTopics(response.data);

        if (response.data.length > 0) {
          const requestedTopic = response.data.find(
            (topic) => topic.id === requestedTopicId,
          );
          setSelectedTopicId(requestedTopic?.id ?? response.data[0].id);
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Không thể tải danh sách đề tài.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadInitialData();
  }, [requestedTopicId]);

  useEffect(() => {
    if (!selectedTopicId) {
      setSubmissions([]);
      return;
    }

    const loadSubmissions = async () => {
      setError(null);

      try {
        const response = await api.get<ApiResponse<SubmissionDto[]>>(
          `/topics/${selectedTopicId}/submissions`,
        );
        setSubmissions(response.data);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Không thể tải lịch sử nộp bài.";
        setError(message);
      }
    };

    void loadSubmissions();
  }, [selectedTopicId]);

  const handleUpload = async (file: File) => {
    if (!selectedTopicId) {
      throw new Error("Vui lòng chọn đề tài trước khi nộp file.");
    }

    if (!canUpload) {
      throw new Error(submissionWindow.reason);
    }

    setError(null);
    setSuccessMessage(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileType", "REPORT");

      await api.postForm<ApiResponse<{ id: string; version: number }>>(
        `/topics/${selectedTopicId}/submissions`,
        formData,
      );

      const updated = await api.get<ApiResponse<SubmissionDto[]>>(
        `/topics/${selectedTopicId}/submissions`,
      );
      setSubmissions(updated.data);
      setSuccessMessage("Nộp file thành công.");
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Nộp file thất bại.";
      setError(message);
      throw uploadError;
    } finally {
      setIsUploading(false);
    }
  };

  const handleReplace = async (submissionId: string, file: File) => {
    setIsReplacing(submissionId);
    setError(null);
    setSuccessMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileType", "REPORT");
      formData.append("replacementReason", "Nộp lại theo yêu cầu");
      await api.postForm<ApiResponse<{ id: string; version: number }>>(
        `/submissions/${submissionId}/replace`,
        formData,
      );
      const updated = await api.get<ApiResponse<SubmissionDto[]>>(`/topics/${selectedTopicId}/submissions`);
      setSubmissions(updated.data);
      setSuccessMessage("Đã thay thế file thành công.");
    } catch (replaceError) {
      setError(replaceError instanceof Error ? replaceError.message : "Nộp lại thất bại.");
    } finally {
      setIsReplacing(null);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">
          Nộp báo cáo
        </h1>
        <p className="text-sm text-outline font-body">
          Đăng tải file báo cáo cuối kỳ, source code và tài liệu liên quan.
        </p>
      </div>

      {/* Deadline Alert */}
      <div className="flex items-center gap-4 bg-error-container/20 border border-error/20 rounded-2xl px-6 py-4">
        <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center flex-shrink-0">
          <Clock className="w-5 h-5 text-error" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-on-surface">
            Hạn nộp cuối: <span className={formatDeadlineStatus(selectedTopic?.submitEndAt).urgency === 'urgent' ? 'text-amber-600' : 'text-error'}>
              {formatDeadlineStatus(selectedTopic?.submitEndAt).display}
            </span>
            <span className="font-normal text-xs ml-2 text-outline">({formatDeadlineStatus(selectedTopic?.submitEndAt).label})</span>
          </p>
          <p className="text-xs text-outline mt-0.5">
            Trạng thái đề tài hiện tại: <span className="font-medium text-on-surface-variant">{selectedTopic?.state ? (TOPIC_STATE_LABELS[selectedTopic.state]?.label || selectedTopic.state) : "-"}</span>
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-error mt-0.5 flex-shrink-0" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Upload Area */}
          <div className="col-span-2 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
                <span className="font-semibold">Đề tài</span>
                <select
                  value={selectedTopicId}
                  onChange={(event) => setSelectedTopicId(event.target.value)}
                  className="px-3 py-2 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface"
                  disabled={isLoading || isUploading || !topics.length}
                >
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.title} ({TOPIC_TYPE_LABELS[topic.type] || topic.type})
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col gap-1 text-sm text-on-surface-variant">
                <span className="font-semibold">Loại file</span>
                <div className="px-3 py-2 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface font-semibold">
                  {FILE_TYPE_LABELS["REPORT"] || "REPORT"}
                </div>
              </div>
            </div>

            <FileUpload 
              onUpload={handleUpload}
              accept=".pdf"
              maxSize={50}
              requireConfirmation
              confirmButtonText="Xác nhận nộp báo cáo"
            />

            {!canUpload && selectedTopic && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                {submissionWindow.reason}
              </p>
            )}

          {/* Requirements */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10">
            <h4 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-primary" />
              Yêu cầu file nộp
            </h4>
            <ul className="space-y-2 text-sm text-outline">
              {[
                "Hệ thống hiện chỉ chấp nhận file PDF.",
                "Sinh viên chỉ được nộp loại file REPORT.",
                "Dung lượng tối đa mỗi file: 50MB.",
              ].map((req, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Submission History */}
        <div className="col-span-1 space-y-4">
          <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider font-label">
            Lịch sử nộp
          </h3>
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden divide-y divide-outline-variant/10">
            {submissions.map((item) => (
              <div key={item.id} className="p-4 hover:bg-surface-container-low transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    item.isLocked ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"
                  }`}>
                    {item.isLocked ? <Lock className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-on-surface truncate">
                      {item.originalFileName ?? `${item.fileType}_v${item.version}.pdf`}
                    </p>
                    <p className="text-[10px] text-outline mt-1">{formatDateTime(item.uploadedAt)} · {formatFileSize(item.fileSize)}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                        {item.versionLabel ?? `v${item.version}`}
                      </span>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
                        {FILE_TYPE_LABELS[item.fileType] || item.fileType}
                      </span>
                      {item.isLocked && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                          🔒 Đã khóa
                        </span>
                      )}
                      {item.canReplace && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                          Có thể thay file
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {item.driveLink && (
                        <a
                          href={item.driveLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-primary font-semibold inline-flex"
                        >
                          Mở file trên Drive
                        </a>
                      )}
                      {item.canReplace && (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            disabled={isReplacing === item.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void handleReplace(item.id, file);
                              e.target.value = "";
                            }}
                          />
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border transition-colors ${
                            isReplacing === item.id
                              ? "border-outline-variant/20 text-outline cursor-not-allowed"
                              : "border-primary/30 text-primary hover:bg-primary/5"
                          }`}>
                            {isReplacing === item.id
                              ? <><RefreshCw className="w-3 h-3 animate-spin" /> Đang nộp...</>
                              : <><RefreshCw className="w-3 h-3" /> Nộp lại</>
                            }
                          </span>
                        </label>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            ))}

            {!submissions.length && !isLoading && (
              <div className="p-4 text-xs text-outline">Chưa có bài nộp nào cho đề tài này.</div>
            )}
          </div>

          {/* Quick tips */}
          <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4">
            <p className="text-xs text-primary font-semibold mb-2">Lưu ý</p>
            <p className="text-xs text-outline leading-relaxed">
              Mỗi lần nộp mới sẽ tăng phiên bản theo loại file. Hệ thống sẽ tự động thông báo đến GVHD sau khi bạn nộp thành công.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentSubmissionsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-outline">Đang tải...</div>}>
      <StudentSubmissionsContent />
    </Suspense>
  );
}
