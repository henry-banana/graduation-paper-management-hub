"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, X, Search, Eye, Clock, BookOpen, GraduationCap, RefreshCw, AlertCircle, CheckCheck } from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";

interface TopicDto {
  id: string;
  title: string;
  type: "BCTT" | "KLTN";
  state: string;
  domain?: string;
  companyName?: string;
  createdAt: string;
  student?: { id: string; fullName: string; studentId?: string };
  period?: { id: string; code: string };
}

function deadlineBadge(createdAt: string): { label: string; urgent: boolean } {
  const created = new Date(createdAt).getTime();
  const deadline = created + 3 * 24 * 60 * 60 * 1000; // 3 days
  const remaining = deadline - Date.now();
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (remaining <= 0) return { label: "Quá hạn", urgent: true };
  if (days === 0) return { label: `Còn ${hours}h`, urgent: true };
  return { label: `Còn ${days} ngày`, urgent: days <= 1 };
}

export default function GVHDPendingPage() {
  const [topics, setTopics] = useState<TopicDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ topicId: string; title: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<TopicDto>>(
        "/topics?role=gvhd&page=1&size=100&state=PENDING_GV",
      );
      setTopics(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải danh sách đề tài.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() =>
    topics.filter(t =>
      t.student?.fullName.toLowerCase().includes(search.toLowerCase()) ||
      t.title.toLowerCase().includes(search.toLowerCase()),
    ), [topics, search]);

  const handleApprove = async (topicId: string) => {
    setIsActing(topicId);
    setError(null);
    try {
      await api.post<ApiResponse<unknown>>(`/topics/${topicId}/transition`, { action: "APPROVE" });
      setTopics(prev => prev.filter(t => t.id !== topicId));
      setSelectedIds(prev => { const s = new Set(prev); s.delete(topicId); return s; });
      setSuccessMsg("Đã duyệt đề tài thành công.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Duyệt thất bại.");
    } finally {
      setIsActing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setIsActing(rejectModal.topicId);
    setError(null);
    try {
      await api.post<ApiResponse<unknown>>(`/topics/${rejectModal.topicId}/transition`, {
        action: "REJECT",
        reason: rejectReason || "Không đáp ứng yêu cầu.",
      });
      setTopics(prev => prev.filter(t => t.id !== rejectModal.topicId));
      setSelectedIds(prev => { const s = new Set(prev); s.delete(rejectModal.topicId); return s; });
      setRejectModal(null);
      setRejectReason("");
      setSuccessMsg("Đã từ chối đề tài.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Từ chối thất bại.");
    } finally {
      setIsActing(null);
    }
  };

  const handleBulkApprove = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await handleApprove(id);
    }
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const allSelected = filtered.length > 0 && filtered.every(t => selectedIds.has(t.id));

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">Duyệt đề tài</h1>
          <p className="text-sm text-outline mt-1">Phê duyệt các đề tài BCTT / KLTN từ sinh viên hướng dẫn. Hạn phản hồi: <strong>3 ngày</strong>.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-5 py-3 rounded-2xl border border-amber-200 bg-amber-50 text-center min-w-[100px]">
            <p className="text-2xl font-black font-headline text-amber-600">{topics.length}</p>
            <p className="text-xs text-outline mt-0.5">Chờ duyệt</p>
          </div>
          <button onClick={() => void load()} className="p-2.5 rounded-xl border border-outline-variant/20 text-outline hover:bg-surface-container transition-colors" title="Làm mới">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-error flex-shrink-0" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">{successMsg}</p>
        </div>
      )}

      {/* Filter + Bulk */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4 flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            type="text"
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container rounded-xl border border-outline-variant/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-on-surface placeholder:text-outline/60"
            placeholder="Tìm sinh viên hoặc tên đề tài..."
          />
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={() => void handleBulkApprove()}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-all"
          >
            <CheckCheck className="w-4 h-4" />
            Duyệt {selectedIds.size} đề tài
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-outline animate-spin" />
          <span className="ml-3 text-sm text-outline">Đang tải...</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 p-16 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-green-500" />
          </div>
          <p className="font-semibold text-on-surface">Không có đề tài nào chờ duyệt 🎉</p>
          <p className="text-sm text-outline">Tất cả đề tài đã được xử lý.</p>
        </div>
      )}

      {/* Select all bar */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex items-center gap-3 px-1">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => {
              if (allSelected) setSelectedIds(new Set());
              else setSelectedIds(new Set(filtered.map(t => t.id)));
            }}
            className="w-4 h-4 rounded accent-primary cursor-pointer"
          />
          <span className="text-xs text-outline">Chọn tất cả ({filtered.length})</span>
        </div>
      )}

      {/* Topics list */}
      {!isLoading && (
        <div className="space-y-4">
          {filtered.map(topic => {
            const badge = deadlineBadge(topic.createdAt);
            const acting = isActing === topic.id;
            return (
              <div
                key={topic.id}
                className={`bg-surface-container-lowest rounded-3xl border p-6 hover:shadow-md transition-all duration-200 ${
                  selectedIds.has(topic.id) ? "border-primary/40 bg-primary/5" : "border-outline-variant/10"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start gap-6">
                  {/* Checkbox */}
                  <div className="flex-shrink-0 pt-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(topic.id)}
                      onChange={() => toggleSelect(topic.id)}
                      className="w-4 h-4 rounded accent-primary cursor-pointer"
                    />
                  </div>

                  {/* Student info */}
                  <div className="flex items-center gap-4 md:w-48 flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                      {topic.student?.fullName?.charAt(0) ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-on-surface truncate">{topic.student?.fullName ?? "—"}</p>
                      <p className="text-xs text-outline mt-0.5">{topic.student?.studentId ?? ""}</p>
                      <p className="text-xs text-outline/70 mt-0.5">{new Date(topic.createdAt).toLocaleDateString("vi-VN")}</p>
                    </div>
                  </div>

                  {/* Topic info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-2">
                      <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${topic.type === "KLTN" ? "bg-purple-100 text-purple-700" : "bg-primary/10 text-primary"}`}>
                        {topic.type}
                      </span>
                      <p className="text-sm font-semibold text-on-surface leading-snug">{topic.title}</p>
                    </div>
                    <div className="flex items-center flex-wrap gap-3 text-xs text-outline">
                      {topic.domain && (
                        <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{topic.domain}</span>
                      )}
                      {topic.period?.code && (
                        <span className="bg-surface-container px-2 py-0.5 rounded-full">{topic.period.code}</span>
                      )}
                      {topic.companyName && <span>🏢 {topic.companyName}</span>}
                      <span className={`flex items-center gap-1 font-semibold ${badge.urgent ? "text-error" : "text-outline"}`}>
                        <Clock className="w-3 h-3" />{badge.label}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => void handleApprove(topic.id)}
                      disabled={acting}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-xl hover:bg-green-700 hover:shadow-lg hover:shadow-green-200 transition-all active:scale-95 disabled:opacity-60"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {acting ? "..." : "Duyệt"}
                    </button>
                    <button
                      onClick={() => { setRejectModal({ topicId: topic.id, title: topic.title }); setRejectReason(""); }}
                      disabled={acting}
                      className="flex items-center gap-1.5 px-4 py-2 bg-surface-container-low border border-outline-variant/30 text-on-surface-variant text-xs font-semibold rounded-xl hover:bg-error-container/20 hover:text-error hover:border-error/30 transition-all active:scale-95 disabled:opacity-60"
                    >
                      <X className="w-3.5 h-3.5" />
                      Từ chối
                    </button>
                    <a
                      href={`/student/topics/${topic.id}`}
                      className="p-2 bg-surface-container-low border border-outline-variant/30 text-on-surface-variant rounded-xl hover:bg-surface-container transition-colors"
                      title="Xem chi tiết"
                    >
                      <Eye className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-on-surface text-lg mb-1">Từ chối đề tài</h3>
            <p className="text-sm text-outline mb-4 truncate">&quot;{rejectModal.title}&quot;</p>
            <label className="block text-sm font-semibold text-on-surface mb-2">Lý do từ chối</label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Ví dụ: Tên đề tài chưa rõ ràng, cần điều chỉnh..."
              className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 px-4 py-2.5 border border-outline-variant/20 rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={() => void handleReject()}
                disabled={isActing === rejectModal.topicId}
                className="flex-1 px-4 py-2.5 bg-error text-white rounded-xl text-sm font-semibold hover:bg-error/90 transition-colors disabled:opacity-60"
              >
                {isActing === rejectModal.topicId ? "Đang xử lý..." : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
