"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, AlertTriangle, CheckCircle2, ClipboardList,
  RefreshCw, Search, Users,
} from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";
import type { CouncilTopicListItem, TopicListScores } from "@/types";

interface ScoreSource {
  role: string;
  rawScore: number;
  weight: number;
  weightedScore?: number;
}

type TopicSummaryDto = Omit<CouncilTopicListItem, "scores"> & {
  scores?: TopicListScores & {
    sources?: ScoreSource[];
  };
};

export default function CouncilSummaryPage() {
  const [topics, setTopics] = useState<TopicSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isSummarizing, setIsSummarizing] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<TopicSummaryDto>>(
        "/topics?role=tk_hd&page=1&size=100&states=DEFENSE,SCORING",
      );
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

  const handleSummarize = async (topicId: string) => {
    if (
      !window.confirm(
        "Xác nhận tổng hợp điểm? Hệ thống sẽ khóa chỉnh sửa điểm sau thao tác này.",
      )
    ) {
      return;
    }
    setIsSummarizing(topicId);
    setError(null);
    try {
      await api.post<ApiResponse<unknown>>(`/topics/${topicId}/scores/aggregate`, {});
      await load();
      setSuccess("Đã tổng hợp và khóa chỉnh sửa điểm thành công.");
      setTimeout(() => setSuccess(null), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tổng hợp điểm thất bại.");
    } finally {
      setIsSummarizing(null);
    }
  };

  const scoreColor = (score: number | undefined) => {
    if (score == null) return "text-outline";
    if (score >= 8) return "text-green-700 bg-green-50";
    if (score >= 5) return "text-amber-700 bg-amber-50";
    return "text-error bg-error-container/20";
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">Tổng hợp điểm (Thư ký HĐ)</h1>
          <p className="text-sm text-outline mt-1">Ghi biên bản tổng hợp khi đã đủ phiếu điểm từ GVHD, GVPB và Hội đồng.</p>
        </div>
        <button onClick={() => void load()} className="p-2.5 rounded-xl border border-outline-variant/20 hover:bg-surface-container transition-colors self-start">
          <RefreshCw className={`w-4 h-4 text-outline ${isLoading ? "animate-spin" : ""}`} />
        </button>
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

      {isLoading && (
        <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 animate-spin text-outline" /><span className="ml-3 text-sm text-outline">Đang tải...</span></div>
      )}

      {!isLoading && (
        <div className="space-y-5">
          {filtered.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 p-16 flex flex-col items-center gap-4">
              <Users className="w-10 h-10 text-outline/40" />
              <p className="text-on-surface-variant font-medium">Không có đề tài nào cần tổng hợp điểm.</p>
            </div>
          ) : (
            filtered.map(t => {
              const sc = t.scores;
              const isReady = Boolean(sc?.isReady);
              const isPublished = Boolean(sc?.published);
              const isAggregatedByTkHd = Boolean(sc?.aggregatedByTkHd);
              const summarizing = isSummarizing === t.id;
              const aggregatedAt = sc?.aggregatedByTkHdAt
                ? new Date(sc.aggregatedByTkHdAt).toLocaleString("vi-VN")
                : null;

              return (
                <div key={t.id} className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden shadow-sm">
                  {/* Header */}
                  <div className="px-6 py-5 flex flex-col md:flex-row justify-between md:items-start gap-4 border-b border-outline-variant/10 bg-surface-container/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${t.type === "KLTN" ? "bg-purple-100 text-purple-700" : "bg-primary/10 text-primary"}`}>{t.type}</span>
                        {t.period && <span className="text-xs bg-surface-container px-2 py-0.5 rounded-full text-outline">{t.period.code}</span>}
                      </div>
                      <h3 className="text-base font-bold text-on-surface line-clamp-2">{t.title}</h3>
                      <p className="text-sm text-outline mt-1">{t.student?.fullName} · <span className="font-mono">{t.student?.studentId}</span></p>
                    </div>
                    {/* Final score badge */}
                    {sc?.final != null && (
                      <div className={`flex-shrink-0 text-center px-6 py-3 rounded-2xl font-headline ${scoreColor(sc.final)}`}>
                        <p className="text-3xl font-black">{sc.final.toFixed(2)}</p>
                        <p className="text-xs font-semibold mt-0.5">Điểm cuối</p>
                      </div>
                    )}
                  </div>

                  {/* Score table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-outline-variant/10">
                      <thead>
                        <tr className="bg-surface-container/30">
                          <th className="px-5 py-3 text-left text-xs font-semibold text-outline uppercase tracking-wider">Nguồn chấm</th>
                          <th className="px-5 py-3 text-center text-xs font-semibold text-outline uppercase tracking-wider">Điểm thô</th>
                          <th className="px-5 py-3 text-center text-xs font-semibold text-outline uppercase tracking-wider">Trọng số</th>
                          <th className="px-5 py-3 text-center text-xs font-semibold text-outline uppercase tracking-wider">Điểm có trọng số</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-outline uppercase tracking-wider">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/10">
                        {[
                          { label: "GVHD", value: sc?.gvhd, weight: 30 },
                          { label: "GVPB", value: sc?.gvpb, weight: 30 },
                          { label: "Hội đồng (TB)", value: sc?.councilAvg, weight: 40 },
                        ].map(row => (
                          <tr key={row.label} className="hover:bg-surface-container-low/20 transition-colors">
                            <td className="px-5 py-4 text-sm font-semibold text-on-surface">{row.label}</td>
                            <td className="px-5 py-4 text-center">
                              {row.value != null
                                ? <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${scoreColor(row.value)}`}>{row.value.toFixed(2)}</span>
                                : <span className="text-xs italic text-outline">Chưa có</span>}
                            </td>
                            <td className="px-5 py-4 text-center text-sm text-outline">{row.weight}%</td>
                            <td className="px-5 py-4 text-center text-sm font-semibold text-on-surface">
                              {row.value != null ? ((row.value * row.weight) / 100).toFixed(2) : "—"}
                            </td>
                            <td className="px-5 py-4">
                              {row.value != null
                                ? <span className="flex items-center gap-1 text-xs text-green-600 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" />Đã nộp</span>
                                : <span className="flex items-center gap-1 text-xs text-amber-600 font-semibold"><AlertTriangle className="w-3.5 h-3.5" />Chưa có phiếu</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Action footer */}
                  <div className="px-6 py-4 flex items-center justify-end gap-3 border-t border-outline-variant/10">
                    {isPublished ? (
                      <span className="flex items-center gap-2 text-sm font-semibold text-green-700 bg-green-50 px-4 py-2 rounded-xl border border-green-200">
                        <CheckCircle2 className="w-4 h-4" />Đã công bố điểm cho sinh viên
                      </span>
                    ) : isAggregatedByTkHd ? (
                      <span className="flex items-center gap-2 text-sm font-semibold text-green-600 bg-green-50 px-4 py-2 rounded-xl border border-green-200">
                        <CheckCircle2 className="w-4 h-4" />
                        {aggregatedAt
                          ? `Đã tổng hợp lúc ${aggregatedAt} — Chờ GVHD & CT_HĐ xác nhận`
                          : "Đã tổng hợp — Chờ GVHD & CT_HĐ xác nhận"}
                      </span>
                    ) : !isReady ? (
                      <span className="flex items-center gap-2 text-sm font-semibold text-amber-600 bg-amber-50 px-4 py-2 rounded-xl border border-amber-200">
                        <AlertTriangle className="w-4 h-4" />Thiếu phiếu điểm — Chưa thể tổng hợp
                      </span>
                    ) : (
                      <button
                        onClick={() => void handleSummarize(t.id)}
                        disabled={summarizing}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-60"
                      >
                        <ClipboardList className="w-4 h-4" />
                        {summarizing ? "Đang tổng hợp..." : "Ghi biên bản tổng hợp"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
