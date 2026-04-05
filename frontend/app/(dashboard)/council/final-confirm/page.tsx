"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, BookOpen, CheckCircle2, ChevronDown, ChevronRight,
  ClipboardList, Download, MessageSquare, RefreshCw, Search,
  Shield, Users, X,
} from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";
import type { CouncilTopicListItem } from "@/types";

/* ---------- Types ---------- */
interface TopicSummaryDto extends CouncilTopicListItem {
  // Secretary: minutes data
  minutesContent?: string;
  gvpbComments?: string;
  councilComments?: string;
}

interface MinutesForm {
  councilComments: string;
  revisionNotes: string;
}

interface ExportResultDto {
  driveLink?: string;
  downloadUrl?: string;
}

export default function CouncilFinalConfirmPage() {
  const [topics, setTopics] = useState<TopicSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);
  const [minutesModal, setMinutesModal] = useState<TopicSummaryDto | null>(null);
  const [minutesForm, setMinutesForm] = useState<MinutesForm>({ councilComments: "", revisionNotes: "" });
  const [isSavingMinutes, setIsSavingMinutes] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<TopicSummaryDto>>("/topics?role=ct_hd&page=1&size=100&state=SCORING");
      setTopics(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải tổng hợp điểm.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() =>
    topics.filter(t =>
      (t.student?.fullName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      t.title.toLowerCase().includes(search.toLowerCase()),
    ), [topics, search]);

  const stats = useMemo(() => ({
    total: topics.length,
    published: topics.filter(t => t.isPublished).length,
    avgFinal: topics.length > 0
      ? (topics.reduce((s, t) => s + (t.scores?.final ?? 0), 0) / topics.length).toFixed(2)
      : "—",
  }), [topics]);

  const canPublishTopic = (topic: TopicSummaryDto): boolean => {
    const scores = topic.scores;
    if (!scores) return false;

    return (
      !topic.isPublished &&
      !scores.published &&
      scores.isReady &&
      scores.isSummarized &&
      scores.gvhdConfirmed &&
      !scores.ctHdConfirmed &&
      typeof scores.final === "number"
    );
  };

  const handlePublish = async (topicId: string) => {
    if (!window.confirm("Xác nhận công bố điểm chính thức cho sinh viên này?")) return;
    setIsPublishing(topicId);
    setError(null);
    try {
      await api.post<ApiResponse<unknown>>(`/topics/${topicId}/scores/confirm-publish`, {});
      setTopics(prev => prev.map(t => t.id === topicId ? { ...t, isPublished: true } : t));
      setSuccess("Đã công bố điểm thành công.");
      setTimeout(() => setSuccess(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Công bố điểm thất bại.");
    } finally {
      setIsPublishing(null);
    }
  };

  const handleSaveMinutes = async () => {
    if (!minutesModal) return;
    setIsSavingMinutes(true);
    setError(null);
    try {
      const exportRes = await api.post<ApiResponse<ExportResultDto>>(`/exports/minutes/${minutesModal.id}`, {});
      const minutesLink = exportRes.data?.driveLink ?? exportRes.data?.downloadUrl;
      setTopics(prev => prev.map(t =>
        t.id === minutesModal.id
          ? { ...t, councilMinutesLink: minutesLink ?? t.councilMinutesLink }
          : t,
      ));
      setMinutesModal(null);
      setSuccess("Đã tạo Biên bản Hội đồng thành công.");
      setTimeout(() => setSuccess(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo biên bản thất bại.");
    } finally {
      setIsSavingMinutes(false);
    }
  };

  const scoreColor = (score: number | null | undefined) => {
    if (score == null) return "text-outline";
    if (score >= 8) return "text-green-600";
    if (score >= 5) return "text-amber-600";
    return "text-error";
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">Tổng hợp & Công bố điểm</h1>
          <p className="text-sm text-outline mt-1">Xem điểm tổng hợp từ GVHD, GVPB, Hội đồng và công bố điểm chính thức.</p>
        </div>
        <button
          onClick={() => void load()}
          aria-label="Làm mới danh sách tổng hợp điểm"
          title="Làm mới"
          className="p-2.5 rounded-xl border border-outline-variant/20 hover:bg-surface-container transition-colors self-start"
        >
          <RefreshCw className={`w-4 h-4 text-outline ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Tổng đề tài", value: stats.total, color: "text-on-surface" },
          { label: "Đã công bố", value: stats.published, color: "text-green-600" },
          { label: "Điểm TB", value: stats.avgFinal, color: "text-primary" },
        ].map((s, i) => (
          <div key={i} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4 text-center">
            <p className={`text-3xl font-black font-headline ${s.color}`}>{s.value}</p>
            <p className="text-xs text-outline mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-error" /><p className="text-sm text-error">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-green-600" /><p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm sinh viên hoặc đề tài..."
          className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface placeholder:text-outline/60" />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 animate-spin text-outline" /><span className="ml-3 text-sm text-outline">Đang tải...</span></div>
      )}

      {/* Summary table */}
      {!isLoading && (
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden shadow-sm">
          {filtered.length === 0 ? (
            <div className="p-16 flex flex-col items-center gap-4">
              <Users className="w-10 h-10 text-outline/40" />
              <p className="text-on-surface-variant font-medium">Không có đề tài nào trong giai đoạn chấm điểm.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-outline-variant/10">
                <thead>
                  <tr className="bg-surface-container/50">
                    {["Sinh viên", "Đề tài", "Điểm GVHD", "Điểm GVPB", "Điểm HĐ", "Điểm cuối", "Trạng thái", ""].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-outline uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {filtered.map(t => {
                    const publishing = isPublishing === t.id;
                    const canPublish = canPublishTopic(t);
                    const isExpanded = expandedId === t.id;
                    const detailsId = `topic-details-${t.id}`;
                    return (
                      <>
                        <tr
                          key={t.id}
                          className="hover:bg-surface-container-low/30 transition-colors"
                        >
                          <td className="px-4 py-4">
                            <p className="text-sm font-semibold text-on-surface">{t.student?.fullName ?? "—"}</p>
                            <p className="text-xs text-outline">{t.student?.studentId ?? ""}</p>
                          </td>
                          <td className="px-4 py-4 max-w-[220px]">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${t.type === "KLTN" ? "bg-purple-100 text-purple-700" : "bg-primary/10 text-primary"}`}>{t.type}</span>
                            </div>
                            <p className="text-xs text-on-surface line-clamp-2">{t.title}</p>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`text-sm font-bold ${scoreColor(t.scores?.gvhd)}`}>{t.scores?.gvhd?.toFixed(1) ?? "—"}</span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`text-sm font-bold ${scoreColor(t.scores?.gvpb)}`}>{t.scores?.gvpb?.toFixed(1) ?? "—"}</span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`text-sm font-bold ${scoreColor(t.scores?.council)}`}>{t.scores?.council?.toFixed(1) ?? "—"}</span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`text-lg font-black font-headline ${scoreColor(t.scores?.final)}`}>{t.scores?.final?.toFixed(1) ?? "—"}</span>
                          </td>
                          <td className="px-4 py-4">
                            {t.isPublished
                              ? <span className="flex items-center gap-1 text-green-600 text-xs font-semibold"><CheckCircle2 className="w-3.5 h-3.5" />Đã công bố</span>
                              : <span className="text-xs text-amber-600 font-semibold">Chưa công bố</span>}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1.5 justify-end" onClick={e => e.stopPropagation()}>
                              {/* Secretary: minutes */}
                              <button
                                onClick={() => {
                                  setMinutesModal(t);
                                  setMinutesForm({ councilComments: t.councilComments ?? "", revisionNotes: "" });
                                }}
                                title="Biên bản Hội đồng"
                                className="p-2 rounded-xl border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container transition-colors"
                              >
                                <ClipboardList className="w-3.5 h-3.5" />
                              </button>
                              {/* Publish */}
                              {!t.isPublished && (
                                <button
                                  onClick={() => void handlePublish(t.id)}
                                  disabled={publishing || !canPublish}
                                  className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50"
                                >
                                  <Shield className="w-3.5 h-3.5" />
                                  {publishing ? "..." : "Công bố"}
                                </button>
                              )}
                              <button
                                type="button"
                                aria-expanded={isExpanded}
                                aria-controls={detailsId}
                                aria-label={isExpanded ? "Thu gọn chi tiết đề tài" : "Mở rộng chi tiết đề tài"}
                                title={isExpanded ? "Thu gọn chi tiết" : "Mở rộng chi tiết"}
                                onClick={() => setExpandedId(isExpanded ? null : t.id)}
                                className="p-2 rounded-xl border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container transition-colors"
                              >
                                {isExpanded ? <ChevronDown className="w-4 h-4 text-outline" /> : <ChevronRight className="w-4 h-4 text-outline" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {/* Expanded row */}
                        {isExpanded && (
                          <tr id={detailsId} className="bg-surface-container-low/20">
                            <td colSpan={8} className="px-6 py-5">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-5 text-xs">
                                <div>
                                  <p className="text-outline uppercase tracking-wider mb-1">GVHD</p>
                                  <p className="text-on-surface font-medium">{t.supervisor?.fullName ?? "—"}</p>
                                </div>
                                <div>
                                  <p className="text-outline uppercase tracking-wider mb-1">GVPB</p>
                                  <p className="text-on-surface font-medium">{t.reviewer?.fullName ?? "—"}</p>
                                </div>
                                {t.period && (
                                  <div>
                                    <p className="text-outline uppercase tracking-wider mb-1">Đợt</p>
                                    <p className="text-on-surface font-medium">{t.period.code}</p>
                                  </div>
                                )}
                                {t.gvpbComments && (
                                  <div className="col-span-2">
                                    <p className="text-outline uppercase tracking-wider mb-1 flex items-center gap-1"><MessageSquare className="w-3 h-3" />Nhận xét GVPB</p>
                                    <p className="text-on-surface leading-relaxed">{t.gvpbComments}</p>
                                  </div>
                                )}
                                {t.councilComments && (
                                  <div className="col-span-2">
                                    <p className="text-outline uppercase tracking-wider mb-1 flex items-center gap-1"><Users className="w-3 h-3" />Nhận xét Hội đồng</p>
                                    <p className="text-on-surface leading-relaxed">{t.councilComments}</p>
                                  </div>
                                )}
                                {t.councilMinutesLink && (
                                  <div className="col-span-2">
                                    <a href={t.councilMinutesLink} target="_blank" rel="noreferrer"
                                      className="flex items-center gap-2 text-primary font-semibold hover:underline">
                                      <Download className="w-3.5 h-3.5" />Tải Biên bản Hội đồng
                                    </a>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Minutes Modal (Thư ký) */}
      {minutesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-outline-variant/10">
              <div>
                <h3 className="font-bold text-on-surface text-lg flex items-center gap-2"><BookOpen className="w-5 h-5 text-primary" />Biên bản Hội đồng</h3>
                <p className="text-xs text-outline mt-0.5">{minutesModal.student?.fullName} — {minutesModal.title.slice(0, 60)}</p>
              </div>
              <button onClick={() => setMinutesModal(null)} className="p-1.5 rounded-xl hover:bg-surface-container transition-colors">
                <X className="w-5 h-5 text-outline" />
              </button>
            </div>
            {/* Pre-filled info */}
            <div className="px-6 py-4 bg-surface-container/30 text-xs space-y-2 border-b border-outline-variant/10">
              <div className="flex gap-4">
                <div><span className="text-outline">Họ tên: </span><span className="font-semibold text-on-surface">{minutesModal.student?.fullName}</span></div>
                <div><span className="text-outline">MSSV: </span><span className="font-semibold text-on-surface">{minutesModal.student?.studentId}</span></div>
              </div>
              <div><span className="text-outline">Tên đề tài: </span><span className="font-medium text-on-surface">{minutesModal.title}</span></div>
              {minutesModal.gvpbComments && (
                <div><span className="text-outline">Nhận xét GVPB: </span><span className="text-on-surface">{minutesModal.gvpbComments}</span></div>
              )}
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-outline mb-1.5 uppercase flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5" />Góp ý của Hội đồng</label>
                <textarea rows={5} value={minutesForm.councilComments}
                  onChange={e => setMinutesForm(p => ({ ...p, councilComments: e.target.value }))}
                  placeholder="Nhập các góp ý và yêu cầu chỉnh sửa của Hội đồng..."
                  className="w-full px-4 py-3 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-outline mb-1.5 uppercase">Yêu cầu chỉnh sửa sau bảo vệ</label>
                <textarea rows={3} value={minutesForm.revisionNotes}
                  onChange={e => setMinutesForm(p => ({ ...p, revisionNotes: e.target.value }))}
                  placeholder="Liệt kê cụ thể những mục sinh viên cần chỉnh sửa..."
                  className="w-full px-4 py-3 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setMinutesModal(null)} className="flex-1 px-4 py-2.5 border border-outline-variant/20 rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors">Hủy</button>
              <button onClick={() => void handleSaveMinutes()} disabled={isSavingMinutes}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
                {isSavingMinutes ? "Đang tạo..." : "Tạo Biên bản"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
