"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, BookOpen, Check, CheckCircle2, RefreshCw,
  Search, Shield, ShieldAlert, User,
} from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";

interface TopicDto {
  id: string;
  title: string;
  type: "BCTT" | "KLTN";
  state: string;
  student?: { fullName: string; studentId?: string };
  period?: { code: string };
  scores?: {
    gvhd?: number;
    gvpb?: number;
    councilAvg?: number;
    final?: number;
    isSummarized?: boolean;
    gvhdConfirmed?: boolean; // GVHD has confirmed
  };
  isPublished?: boolean;
}

export default function GVHDFinalConfirmPage() {
  const [topics, setTopics] = useState<TopicDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isConfirming, setIsConfirming] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // GVHD sees their supervised topics that have summarized scores
      const res = await api.get<ApiListResponse<TopicDto>>("/topics?role=gvhd&page=1&size=100&state=GRADING");
      setTopics((res.data ?? []).filter(t => t.scores?.isSummarized));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải danh sách xác nhận điểm.");
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
    confirmed: topics.filter(t => t.scores?.gvhdConfirmed).length,
  }), [topics]);

  const handleConfirm = async (topicId: string) => {
    if (!window.confirm("Bạn xác nhận điểm tổng hợp đã chính xác và đồng ý để Hội đồng công bố? Thao tác này không thể hoàn tác.")) return;
    setIsConfirming(topicId);
    setError(null);
    try {
      await api.post<ApiResponse<unknown>>(`/topics/${topicId}/scores/confirm`, { role: "GVHD" });
      setTopics(prev => prev.map(t =>
        t.id === topicId
          ? { ...t, scores: { ...(t.scores ?? {}), gvhdConfirmed: true } }
          : t,
      ));
      setSuccess("Đã xác nhận điểm thành công. Cảm ơn giảng viên!");
      setTimeout(() => setSuccess(null), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xác nhận thất bại.");
    } finally {
      setIsConfirming(null);
    }
  };

  const scoreColor = (s: number | undefined) => {
    if (s == null) return "text-outline";
    if (s >= 8) return "text-green-700";
    if (s >= 5) return "text-amber-600";
    return "text-error";
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">Xác nhận điểm cuối (GVHD)</h1>
          <p className="text-sm text-outline mt-1">Rà soát và xác nhận điểm tổng hợp trước khi công bố chính thức cho sinh viên.</p>
        </div>
        <button onClick={() => void load()} className="p-2.5 rounded-xl border border-outline-variant/20 hover:bg-surface-container transition-colors self-start">
          <RefreshCw className={`w-4 h-4 text-outline ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4 text-center">
          <p className="text-3xl font-black font-headline text-on-surface">{stats.total}</p>
          <p className="text-xs text-outline mt-1">Đề tài cần xác nhận</p>
        </div>
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4 text-center">
          <p className="text-3xl font-black font-headline text-green-600">{stats.confirmed}</p>
          <p className="text-xs text-outline mt-1">Đã xác nhận</p>
        </div>
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
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm sinh viên..."
          className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface placeholder:text-outline/60" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 animate-spin text-outline" /><span className="ml-3 text-sm text-outline">Đang tải...</span></div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 p-16 flex flex-col items-center gap-4">
          <BookOpen className="w-10 h-10 text-outline/40" />
          <p className="text-on-surface-variant font-medium">
            {topics.length === 0
              ? "Chưa có đề tài nào ở giai đoạn xác nhận điểm."
              : "Không tìm thấy kết quả phù hợp."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(t => {
            const sc = t.scores;
            const confirming = isConfirming === t.id;
            return (
              <div key={t.id} className={`bg-surface-container-lowest rounded-3xl border overflow-hidden shadow-sm transition-all ${sc?.gvhdConfirmed ? "border-green-200" : "border-outline-variant/10 hover:border-primary/20"}`}>
                {/* Card header */}
                <div className="px-6 py-5 flex items-start gap-5">
                  {/* Status icon */}
                  <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${sc?.gvhdConfirmed ? "bg-green-100" : "bg-primary/10"}`}>
                    {sc?.gvhdConfirmed
                      ? <Check className="w-6 h-6 text-green-600" />
                      : <ShieldAlert className="w-6 h-6 text-primary" />}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${t.type === "KLTN" ? "bg-purple-100 text-purple-700" : "bg-primary/10 text-primary"}`}>{t.type}</span>
                      {t.period && <span className="text-xs bg-surface-container px-2 py-0.5 rounded-full text-outline">{t.period.code}</span>}
                    </div>
                    <h3 className="text-sm font-bold text-on-surface line-clamp-2 mb-0.5">{t.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-outline">
                      <User className="w-3 h-3" />
                      <span>{t.student?.fullName}</span>
                      <span>·</span>
                      <span className="font-mono">{t.student?.studentId}</span>
                    </div>
                  </div>
                  {/* Final score */}
                  {sc?.final != null && (
                    <div className="flex-shrink-0 text-center">
                      <Shield className={`w-5 h-5 mx-auto mb-1 ${scoreColor(sc.final)}`} />
                      <p className={`text-2xl font-black font-headline ${scoreColor(sc.final)}`}>{sc.final.toFixed(2)}</p>
                      <p className="text-xs text-outline">Điểm cuối</p>
                    </div>
                  )}
                </div>

                {/* Score breakdown */}
                <div className="grid grid-cols-3 border-t border-outline-variant/10 divide-x divide-outline-variant/10">
                  {[
                    { label: "GVHD (30%)", value: sc?.gvhd },
                    { label: "GVPB (30%)", value: sc?.gvpb },
                    { label: "Hội đồng (40%)", value: sc?.councilAvg },
                  ].map(col => (
                    <div key={col.label} className="py-4 text-center">
                      <p className={`text-xl font-black font-headline ${scoreColor(col.value)}`}>
                        {col.value != null ? col.value.toFixed(2) : "—"}
                      </p>
                      <p className="text-xs text-outline mt-0.5">{col.label}</p>
                    </div>
                  ))}
                </div>

                {/* Action */}
                <div className="px-6 py-4 flex justify-end border-t border-outline-variant/10">
                  {sc?.gvhdConfirmed ? (
                    <span className="flex items-center gap-2 text-sm font-semibold text-green-600">
                      <CheckCircle2 className="w-4 h-4" />Đã xác nhận — Chờ CT_HD công bố điểm
                    </span>
                  ) : (
                    <button
                      onClick={() => void handleConfirm(t.id)}
                      disabled={confirming}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-60"
                    >
                      <Shield className="w-4 h-4" />
                      {confirming ? "Đang xác nhận..." : "Tôi xác nhận điểm đã chính xác"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
