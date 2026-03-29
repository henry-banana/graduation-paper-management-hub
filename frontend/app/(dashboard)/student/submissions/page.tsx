"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";

type SubmissionFileType = "REPORT" | "TURNITIN" | "REVISION";

interface TopicDto {
  id: string;
  title: string;
  type: "BCTT" | "KLTN";
  state: string;
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

export default function StudentSubmissionsPage() {
  const [topics, setTopics] = useState<TopicDto[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [submissions, setSubmissions] = useState<SubmissionDto[]>([]);
  const [fileType, setFileType] = useState<SubmissionFileType>("REPORT");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? null,
    [topics, selectedTopicId],
  );

  const canUpload = selectedTopic?.state === "IN_PROGRESS";

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
          setSelectedTopicId(response.data[0].id);
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Không thể tải danh sách đề tài.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadInitialData();
  }, []);

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
      throw new Error("Đề tài chưa ở trạng thái IN_PROGRESS nên chưa thể nộp file.");
    }

    setError(null);
    setSuccessMessage(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileType", fileType);

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
            Hạn nộp cuối: <span className="text-error">{selectedTopic?.submitEndAt ? formatDateTime(selectedTopic.submitEndAt) : "Chưa thiết lập"}</span>
          </p>
          <p className="text-xs text-outline mt-0.5">
            Trạng thái đề tài hiện tại: {selectedTopic?.state ?? "-"}
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
                      {topic.title} ({topic.type})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
                <span className="font-semibold">Loại file</span>
                <select
                  value={fileType}
                  onChange={(event) => setFileType(event.target.value as SubmissionFileType)}
                  className="px-3 py-2 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface"
                  disabled={isLoading || isUploading}
                >
                  <option value="REPORT">REPORT</option>
                  <option value="TURNITIN">TURNITIN</option>
                  <option value="REVISION">REVISION</option>
                </select>
              </label>
            </div>

            <FileUpload 
              onUpload={handleUpload}
              accept=".pdf"
              maxSize={50} 
            />

            {!canUpload && selectedTopic && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                Chỉ được nộp file khi đề tài ở trạng thái IN_PROGRESS.
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
                "Loại file hợp lệ: REPORT, TURNITIN, REVISION.",
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
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-green-100 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-on-surface truncate">{item.originalFileName ?? `${item.fileType}_v${item.version}.pdf`}</p>
                    <p className="text-[10px] text-outline mt-1">{formatDateTime(item.uploadedAt)} · {formatFileSize(item.fileSize)}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                        v{item.version}
                      </span>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
                        {item.fileType}
                      </span>
                    </div>
                    {item.driveLink && (
                      <a
                        href={item.driveLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-primary font-semibold mt-1 inline-flex"
                      >
                        Mở file trên Drive
                      </a>
                    )}
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
