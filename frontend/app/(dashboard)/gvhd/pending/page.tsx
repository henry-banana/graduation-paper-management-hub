"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X, Search, Eye, Clock, BookOpen, GraduationCap, Filter } from "lucide-react";
import { ApiListResponse, api } from "@/lib/api";

interface TopicDto {
  id: string;
  title: string;
  type: "BCTT" | "KLTN";
  state: string;
  domain?: string;
  companyName?: string;
  submittedAt?: string;
  student?: { id: string; fullName: string; studentId?: string };
}

export default function GVHDPendingPage() {
  const [topics, setTopics] = useState<TopicDto[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ topicId: string; title: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<TopicDto>>("/topics?role=gvhd&page=1&size=100&state=PENDING_APPROVAL");
      setTopics(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải danh sách đề tài.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleApprove = async (id: string) => {
    setIsActing(id);
    try {
      await api.post(`/topics/${id}/approve`, {});
      setTopics(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Duyệt thất bại.");
    } finally {
      setIsActing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setIsActing(rejectModal.topicId);
    try {
      await api.post(`/topics/${rejectModal.topicId}/reject`, { reason: rejectReason });
      setTopics(prev => prev.filter(t => t.id !== rejectModal.topicId));
      setRejectModal(null);
      setRejectReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Từ chối thất bại.");
    } finally {
      setIsActing(null);
    }
  };

  const filtered = topics.filter(t =>
    t.student?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    t.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">
            Duyệt đề tài
          </h1>
          <p className="text-sm text-outline font-body mt-1">
            Phê duyệt các đề tài BCTT / KLTN từ sinh viên hướng dẫn.
          </p>
        </div>
        {/* Stats */}
        <div className="flex gap-4">
          {[
            { label: "Chờ duyệt", value: topics.length, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
            { label: "Hạn duyệt", value: "3 ngày", color: "text-error", bg: "bg-error-container/20 border-error/20" },
          ].map((stat, i) => (
            <div key={i} className={`px-5 py-3 rounded-2xl border text-center min-w-[100px] ${stat.bg}`}>
              <p className={`text-2xl font-black font-headline ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-outline mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4 flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            type="text"
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container rounded-xl border border-outline-variant/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-on-surface placeholder:text-outline/60"
            placeholder="Tìm sinh viên hoặc tên đề tài..."
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant/20 text-sm text-on-surface-variant hover:bg-surface-container transition-colors">
          <Filter className="w-4 h-4" />
          Bộ lọc
        </button>
      </div>

      {/* Topics list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-sm text-outline">
          <Clock className="w-5 h-5 animate-spin mr-2" />Đang tải...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 p-16 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-outline/50" />
          </div>
          <p className="text-on-surface-variant font-medium">Không có đề tài nào đang chờ duyệt.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((topic) => (
            <div
              key={topic.id}
              className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 p-6 hover:shadow-md hover:border-outline-variant/20 transition-all duration-200"
            >
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                {/* Student info */}
                <div className="flex items-center gap-4 md:w-52 flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                    {topic.student?.fullName?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-on-surface truncate">{topic.student?.fullName}</p>
                    <p className="text-xs text-outline mt-0.5">{topic.student?.studentId}</p>
                    <p className="text-xs text-outline/70">{topic.submittedAt ? new Date(topic.submittedAt).toLocaleDateString("vi-VN") : "—"}</p>
                  </div>
                </div>

                {/* Topic name + category */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 mb-2">
                    <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${topic.type === "KLTN" ? "bg-purple-100 text-purple-700" : "bg-primary/10 text-primary"}`}>
                      {topic.type}
                    </span>
                    <p className="text-sm font-semibold text-on-surface leading-snug">{topic.title}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-outline">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{topic.domain ?? "—"}</span>
                    {topic.companyName && (
                      <>
                        <span>·</span>
                        <span>{topic.companyName}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 md:pt-0">
                  <button
                    onClick={() => void handleApprove(topic.id)}
                    disabled={isActing === topic.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-xl hover:bg-green-700 hover:shadow-lg hover:shadow-green-200 transition-all active:scale-95 disabled:opacity-60"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {isActing === topic.id ? "Đang xử lý..." : "Duyệt"}
                  </button>
                  <button
                    onClick={() => { setRejectModal({ topicId: topic.id, title: topic.title }); setRejectReason(""); }}
                    disabled={isActing === topic.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-surface-container-low border border-outline-variant/30 text-on-surface-variant text-xs font-semibold rounded-xl hover:bg-error-container/20 hover:text-error hover:border-error/30 transition-all active:scale-95 disabled:opacity-60"
                  >
                    <X className="w-3.5 h-3.5" />
                    Từ chối
                  </button>
                  <button
                    className="p-2 bg-surface-container-low border border-outline-variant/30 text-on-surface-variant rounded-xl hover:bg-surface-container transition-colors"
                    title="Xem chi tiết"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
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
