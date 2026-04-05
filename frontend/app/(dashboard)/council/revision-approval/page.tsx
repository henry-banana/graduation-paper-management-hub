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
  XCircle,
} from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";

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
  student?: {
    fullName: string;
    studentId?: string;
  };
  supervisor?: {
    fullName: string;
  };
  councilRole?: string;
}

interface SubmissionDto {
  id: string;
  fileType: string;
  versionLabel: string;
  driveLink: string;
  createdAt: string;
}

export default function CouncilRevisionApprovalPage() {
  const [topics, setTopics] = useState<TopicDto[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [revisionRounds, setRevisionRounds] = useState<RevisionRound[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRounds, setIsLoadingRounds] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveComments, setApproveComments] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

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

  // Check if current user is CT_HD for selected topic
  const isCtHd = selectedTopic?.councilRole === "CT_HD";

  // Load CT_HD's topics
  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        // Query topics where user is council member
        const res = await api.get<ApiListResponse<TopicDto>>("/topics?role=tv_hd&page=1&size=100");
        // Filter to show only topics where user is CT_HD
        const ctHdTopics = (res.data ?? []).filter(
          (t) => t.type === "KLTN" && t.councilRole === "CT_HD"
        );
        setTopics(ctHdTopics);
        if (ctHdTopics.length > 0) {
          setSelectedTopicId(ctHdTopics[0].id);
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

  const handleApprove = async () => {
    if (!activeRound) return;
    setIsApproving(true);
    setError(null);
    try {
      await api.post(`/topics/${selectedTopicId}/revisions/rounds/${activeRound.id}/approve-cthd`, {
        comments: approveComments.trim() || undefined,
      });
      setSuccess("Đã duyệt bài chỉnh sửa thành công! Vòng chỉnh sửa đã hoàn tất.");
      setApproveComments("");
      // Reload rounds
      const roundsRes = await api.get<ApiListResponse<RevisionRound>>(
        `/topics/${selectedTopicId}/revisions/rounds`
      );
      setRevisionRounds(roundsRes.data ?? []);
      setTimeout(() => setSuccess(null), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Duyệt thất bại");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!activeRound || !rejectReason.trim()) return;
    setIsRejecting(true);
    setError(null);
    try {
      await api.post(`/topics/${selectedTopicId}/revisions/rounds/${activeRound.id}/reject-cthd`, {
        reason: rejectReason.trim(),
      });
      setSuccess("Đã yêu cầu SV chỉnh sửa lại.");
      setRejectReason("");
      setShowRejectModal(false);
      // Reload rounds
      const roundsRes = await api.get<ApiListResponse<RevisionRound>>(
        `/topics/${selectedTopicId}/revisions/rounds`
      );
      setRevisionRounds(roundsRes.data ?? []);
      setTimeout(() => setSuccess(null), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại");
    } finally {
      setIsRejecting(false);
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
            href="/council/summary"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-outline-variant/20 text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Tổng hợp điểm
          </Link>
        </div>
        <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">
          Duyệt bài chỉnh sửa (Chủ tịch HĐ)
        </h1>
        <p className="text-sm text-outline mt-1">
          Duyệt cuối cùng sau khi GVHD đã đồng ý với bài chỉnh sửa.
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
            Không có đề tài KLTN nào mà bạn là Chủ tịch Hội đồng.
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
                  {t.student?.fullName ?? "SV"} - {t.title.slice(0, 50)}
                  {t.title.length > 50 ? "…" : ""}
                </option>
              ))}
            </select>
          </div>

          {selectedTopic && (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4">
              <p className="text-sm text-on-surface">
                <strong>Sinh viên:</strong> {selectedTopic.student?.fullName ?? "—"}{" "}
                {selectedTopic.student?.studentId && `(${selectedTopic.student.studentId})`}
              </p>
              <p className="text-sm text-on-surface mt-1">
                <strong>GVHD:</strong> {selectedTopic.supervisor?.fullName ?? "—"}
              </p>
              <p className="text-sm text-on-surface mt-1">
                <strong>Đề tài:</strong> {selectedTopic.title}
              </p>
            </div>
          )}

          {isLoadingRounds ? (
            <div className="flex items-center gap-2 py-8 justify-center text-outline">
              <RefreshCw className="w-4 h-4 animate-spin" /> Đang tải...
            </div>
          ) : !activeRound ? (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-8 text-center">
              <Clock className="w-12 h-12 mx-auto mb-4 text-outline/50" />
              <p className="text-on-surface-variant">
                Chưa có vòng chỉnh sửa đang mở cho đề tài này.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Approval status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4">
                  <p className="text-xs text-outline mb-2">Trạng thái GVHD:</p>
                  {activeRound.gvhdApprovalStatus === "APPROVED" ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
                      <CheckCircle2 className="w-4 h-4" /> Đã duyệt
                    </span>
                  ) : activeRound.gvhdApprovalStatus === "REJECTED" ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-sm font-semibold">
                      <XCircle className="w-4 h-4" /> Yêu cầu sửa
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-sm font-semibold">
                      <Clock className="w-4 h-4" /> Chờ duyệt
                    </span>
                  )}
                  {activeRound.gvhdComments && (
                    <p className="text-xs text-outline mt-2">&ldquo;{activeRound.gvhdComments}&rdquo;</p>
                  )}
                </div>

                <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4">
                  <p className="text-xs text-outline mb-2">Trạng thái Chủ tịch HĐ:</p>
                  {activeRound.ctHdApprovalStatus === "APPROVED" ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
                      <CheckCircle2 className="w-4 h-4" /> Đã duyệt
                    </span>
                  ) : activeRound.ctHdApprovalStatus === "REJECTED" ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-sm font-semibold">
                      <XCircle className="w-4 h-4" /> Yêu cầu sửa
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-sm font-semibold">
                      <Clock className="w-4 h-4" /> Chờ duyệt
                    </span>
                  )}
                </div>
              </div>

              {/* Warning if GVHD hasn't approved */}
              {activeRound.gvhdApprovalStatus !== "APPROVED" && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                  <p className="text-sm text-amber-700">
                    <strong>Lưu ý:</strong> GVHD phải duyệt trước khi Chủ tịch Hội đồng có thể duyệt.
                  </p>
                </div>
              )}

              {/* Submissions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5">
                  <h4 className="font-semibold text-on-surface mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Bài KLTN đã chỉnh sửa
                  </h4>
                  {revisionSubmission ? (
                    <a
                      href={revisionSubmission.driveLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Xem bài ({revisionSubmission.versionLabel})
                    </a>
                  ) : (
                    <p className="text-sm text-outline">SV chưa upload bài chỉnh sửa.</p>
                  )}
                </div>

                <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5">
                  <h4 className="font-semibold text-on-surface mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-secondary" />
                    Biên bản giải trình
                  </h4>
                  {explanationSubmission ? (
                    <a
                      href={explanationSubmission.driveLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 px-4 py-3 rounded-xl bg-secondary/10 text-secondary text-sm font-semibold hover:bg-secondary/20 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Xem biên bản ({explanationSubmission.versionLabel})
                    </a>
                  ) : (
                    <p className="text-sm text-outline">SV chưa upload biên bản giải trình.</p>
                  )}
                </div>
              </div>

              {/* Approval actions - only show if GVHD approved and CT_HD hasn't */}
              {activeRound.gvhdApprovalStatus === "APPROVED" &&
                activeRound.ctHdApprovalStatus !== "APPROVED" && (
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-200/50 p-5">
                    <h4 className="font-bold text-purple-900 mb-4">Duyệt cuối cùng (Chủ tịch HĐ)</h4>

                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-purple-700 mb-2">
                        Nhận xét (tùy chọn)
                      </label>
                      <textarea
                        rows={3}
                        value={approveComments}
                        onChange={(e) => setApproveComments(e.target.value)}
                        placeholder="Nhận xét khi duyệt..."
                        className="w-full px-4 py-3 bg-white rounded-xl border border-purple-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                      />
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleApprove}
                        disabled={isApproving || !revisionSubmission}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {isApproving ? "Đang duyệt..." : "Duyệt & Hoàn tất"}
                      </button>
                      <button
                        onClick={() => setShowRejectModal(true)}
                        disabled={isRejecting}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-red-300 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Yêu cầu sửa lại
                      </button>
                    </div>
                  </div>
                )}
            </div>
          )}
        </>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-on-surface mb-4">Yêu cầu chỉnh sửa lại</h3>
            <p className="text-sm text-outline mb-4">
              Vui lòng nhập lý do để SV biết cần sửa những gì.
            </p>
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="VD: Chưa chỉnh sửa đúng góp ý tại mục 3.2..."
              className="w-full px-4 py-3 bg-surface-container rounded-xl border border-outline-variant/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-xl border border-outline-variant/20 text-sm font-semibold"
              >
                Hủy
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || isRejecting}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-60"
              >
                {isRejecting ? "Đang gửi..." : "Gửi yêu cầu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
