"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  Upload,
  XCircle,
} from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";
import { FileUpload } from "@/components/ui/file-upload";

interface RevisionRound {
  id: string;
  topicId: string;
  roundNumber: number;
  status: "OPEN" | "CLOSED";
  startAt: string;
  endAt: string;
  reason?: string;
  gvhdApprovalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  gvhdApprovedAt?: string;
  gvhdComments?: string;
  ctHdApprovalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  ctHdApprovedAt?: string;
  ctHdComments?: string;
}

interface TopicDto {
  id: string;
  title: string;
  type: "BCTT" | "KLTN";
  state: string;
  supervisor?: {
    fullName: string;
  };
}

interface SubmissionDto {
  id: string;
  fileType: string;
  versionLabel: string;
  driveLink: string;
  createdAt: string;
}

export default function StudentRevisionsPage() {
  const [topics, setTopics] = useState<TopicDto[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [revisionRounds, setRevisionRounds] = useState<RevisionRound[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRounds, setIsLoadingRounds] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<"REVISION" | "REVISION_EXPLANATION" | null>(null);

  const selectedTopic = useMemo(
    () => topics.find((t) => t.id === selectedTopicId) ?? null,
    [topics, selectedTopicId]
  );

  const activeRound = useMemo(
    () => revisionRounds.find((r) => r.status === "OPEN"),
    [revisionRounds]
  );

  const revisionSubmission = useMemo(
    () => submissions.find((s) => s.fileType === "REVISION"),
    [submissions]
  );

  const explanationSubmission = useMemo(
    () => submissions.find((s) => s.fileType === "REVISION_EXPLANATION"),
    [submissions]
  );

  // Load student's topics that can have revision rounds (KLTN after defense)
  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        const res = await api.get<ApiListResponse<TopicDto>>("/topics?page=1&size=50");
        // Filter to show only KLTN topics in post-defense states
        const kltnTopics = (res.data ?? []).filter(
          (t) => t.type === "KLTN" && ["SCORING", "PUBLISHED_READY", "COMPLETED"].includes(t.state)
        );
        setTopics(kltnTopics);
        if (kltnTopics.length > 0) {
          setSelectedTopicId(kltnTopics[0].id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không thể tải danh sách đề tài");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Load revision rounds when topic changes
  useEffect(() => {
    if (!selectedTopicId) return;
    setIsLoadingRounds(true);
    void (async () => {
      try {
        const [roundsRes, subsRes] = await Promise.all([
          api.get<ApiListResponse<RevisionRound>>(`/topics/${selectedTopicId}/revisions/rounds`),
          api.get<ApiListResponse<SubmissionDto>>(`/topics/${selectedTopicId}/submissions`),
        ]);
        setRevisionRounds(roundsRes.data ?? []);
        // Filter to only REVISION and REVISION_EXPLANATION submissions
        setSubmissions(
          (subsRes.data ?? []).filter((s) =>
            ["REVISION", "REVISION_EXPLANATION"].includes(s.fileType)
          )
        );
      } catch {
        setRevisionRounds([]);
        setSubmissions([]);
      } finally {
        setIsLoadingRounds(false);
      }
    })();
  }, [selectedTopicId]);

  const handleUploadSuccess = async () => {
    setSuccess("Upload thành công!");
    setUploadingType(null);
    // Reload submissions
    if (selectedTopicId) {
      const subsRes = await api.get<ApiListResponse<SubmissionDto>>(
        `/topics/${selectedTopicId}/submissions`
      );
      setSubmissions(
        (subsRes.data ?? []).filter((s) =>
          ["REVISION", "REVISION_EXPLANATION"].includes(s.fileType)
        )
      );
    }
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleUploadError = (msg: string) => {
    setError(msg);
    setUploadingType(null);
    setTimeout(() => setError(null), 5000);
  };

  const handleUpload = async (file: File) => {
    if (!selectedTopicId || !uploadingType) {
      throw new Error("Vui lòng chọn đề tài trước khi nộp file.");
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileType", uploadingType);

      await api.postForm(
        `/topics/${selectedTopicId}/submissions`,
        formData
      );
      await handleUploadSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Lỗi khi upload file";
      handleUploadError(msg);
      throw e;
    }
  };

  const getApprovalStatusBadge = (status?: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
            <CheckCircle2 className="w-3 h-3" /> Đã duyệt
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
            <XCircle className="w-3 h-3" /> Yêu cầu sửa lại
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
            <Clock className="w-3 h-3" /> Chờ duyệt
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">
            Chưa nộp
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-outline" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <Link
            href="/student/topics"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-outline-variant/20 text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Quản lý đề tài
          </Link>
        </div>
        <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">
          Chỉnh sửa sau bảo vệ
        </h1>
        <p className="text-sm text-outline mt-1">
          Upload bài đã chỉnh sửa theo góp ý của Hội đồng và theo dõi trạng thái duyệt.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-error" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {topics.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-8 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-outline/50" />
          <p className="text-on-surface-variant">
            Bạn chưa có đề tài KLTN nào đang trong giai đoạn chỉnh sửa sau bảo vệ.
          </p>
        </div>
      ) : (
        <>
          {/* Topic selector */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4">
            <label className="block text-xs font-semibold text-outline mb-2 uppercase tracking-wider">
              Chọn đề tài
            </label>
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="w-full px-4 py-3 bg-surface-container rounded-xl border border-outline-variant/20 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.type}] {t.title.slice(0, 60)}
                  {t.title.length > 60 ? "…" : ""}
                </option>
              ))}
            </select>
          </div>

          {isLoadingRounds ? (
            <div className="flex items-center gap-2 py-8 justify-center text-outline">
              <RefreshCw className="w-4 h-4 animate-spin" /> Đang tải...
            </div>
          ) : !activeRound ? (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-8 text-center">
              <Clock className="w-12 h-12 mx-auto mb-4 text-outline/50" />
              <p className="text-on-surface-variant">
                Chưa có vòng chỉnh sửa nào đang mở cho đề tài này.
              </p>
              <p className="text-xs text-outline mt-2">
                Liên hệ TBM hoặc Chủ tịch Hội đồng nếu bạn cần mở vòng chỉnh sửa.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Revision round info */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200/50 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-blue-900">
                    Vòng chỉnh sửa #{activeRound.roundNumber}
                  </h3>
                  <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                    Đang mở
                  </span>
                </div>

                {activeRound.reason && (
                  <div className="mb-4 p-3 bg-white/50 rounded-xl">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Góp ý từ Hội đồng:</p>
                    <p className="text-sm text-blue-900">{activeRound.reason}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-blue-600">Bắt đầu</p>
                    <p className="font-medium text-blue-900">
                      {new Date(activeRound.startAt).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600">Hạn nộp</p>
                    <p className="font-medium text-blue-900">
                      {new Date(activeRound.endAt).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                </div>

                {/* Approval status */}
                <div className="mt-4 pt-4 border-t border-blue-200/50">
                  <p className="text-xs font-semibold text-blue-700 mb-2">Trạng thái duyệt:</p>
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <span className="text-xs text-blue-600 mr-2">GVHD:</span>
                      {getApprovalStatusBadge(activeRound.gvhdApprovalStatus)}
                    </div>
                    <div>
                      <span className="text-xs text-blue-600 mr-2">Chủ tịch HĐ:</span>
                      {getApprovalStatusBadge(activeRound.ctHdApprovalStatus)}
                    </div>
                  </div>
                  {activeRound.gvhdApprovalStatus === "REJECTED" && activeRound.gvhdComments && (
                    <div className="mt-2 p-2 bg-red-50 rounded-lg text-xs text-red-700">
                      <strong>Góp ý từ GVHD:</strong> {activeRound.gvhdComments}
                    </div>
                  )}
                  {activeRound.ctHdApprovalStatus === "REJECTED" && activeRound.ctHdComments && (
                    <div className="mt-2 p-2 bg-red-50 rounded-lg text-xs text-red-700">
                      <strong>Góp ý từ CT_HĐ:</strong> {activeRound.ctHdComments}
                    </div>
                  )}
                </div>
              </div>

              {/* Upload sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Revised thesis */}
                <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5">
                  <h4 className="font-semibold text-on-surface mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Bài KLTN đã chỉnh sửa
                  </h4>
                  {revisionSubmission ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-green-700">
                          Đã upload ({revisionSubmission.versionLabel})
                        </p>
                        <a
                          href={revisionSubmission.driveLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary underline"
                        >
                          Xem file
                        </a>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                  ) : uploadingType === "REVISION" ? (
                    <div className="space-y-2">
                      <FileUpload
                        onUpload={handleUpload}
                        accept=".pdf"
                        maxSize={50}
                        requireConfirmation
                        confirmButtonText="Xác nhận nộp bản chỉnh sửa"
                      />
                      <button
                        onClick={() => setUploadingType(null)}
                        className="w-full text-xs text-outline hover:text-on-surface"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setUploadingType("REVISION")}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-primary/30 text-primary text-sm font-semibold hover:bg-primary/5 transition-colors"
                    >
                      <Upload className="w-4 h-4" /> Upload bài chỉnh sửa (PDF)
                    </button>
                  )}
                </div>

                {/* Explanation document */}
                <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5">
                  <h4 className="font-semibold text-on-surface mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-secondary" />
                    Biên bản giải trình chỉnh sửa
                  </h4>
                  <p className="text-xs text-outline mb-3">
                    Mô tả các chỗ đã chỉnh sửa theo góp ý của Hội đồng.
                  </p>
                  {explanationSubmission ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-green-700">
                          Đã upload ({explanationSubmission.versionLabel})
                        </p>
                        <a
                          href={explanationSubmission.driveLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary underline"
                        >
                          Xem file
                        </a>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                  ) : uploadingType === "REVISION_EXPLANATION" ? (
                    <div className="space-y-2">
                      <FileUpload
                        onUpload={handleUpload}
                        accept=".pdf"
                        maxSize={50}
                        requireConfirmation
                        confirmButtonText="Xác nhận nộp biên bản giải trình"
                      />
                      <button
                        onClick={() => setUploadingType(null)}
                        className="w-full text-xs text-outline hover:text-on-surface"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setUploadingType("REVISION_EXPLANATION")}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-secondary/30 text-secondary text-sm font-semibold hover:bg-secondary/5 transition-colors"
                    >
                      <Upload className="w-4 h-4" /> Upload biên bản giải trình (PDF)
                    </button>
                  )}
                </div>
              </div>

              {/* Previous rounds history */}
              {revisionRounds.filter((r) => r.status === "CLOSED").length > 0 && (
                <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5">
                  <h4 className="font-semibold text-on-surface mb-4">Lịch sử vòng chỉnh sửa</h4>
                  <div className="space-y-3">
                    {revisionRounds
                      .filter((r) => r.status === "CLOSED")
                      .sort((a, b) => b.roundNumber - a.roundNumber)
                      .map((round) => (
                        <div
                          key={round.id}
                          className="flex items-center justify-between p-3 bg-surface-container rounded-xl"
                        >
                          <div>
                            <p className="text-sm font-medium text-on-surface">
                              Vòng #{round.roundNumber}
                            </p>
                            <p className="text-xs text-outline">
                              {new Date(round.startAt).toLocaleDateString("vi-VN")} -{" "}
                              {new Date(round.endAt).toLocaleDateString("vi-VN")}
                            </p>
                          </div>
                          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs">
                            Đã đóng
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
