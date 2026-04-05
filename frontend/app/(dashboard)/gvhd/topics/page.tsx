"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, Clock, RefreshCw, Search, AlertCircle, FileText, Upload } from "lucide-react";
import { ApiListResponse, api } from "@/lib/api";

interface TopicDto {
  id: string;
  title: string;
  type: "BCTT" | "KLTN";
  state: string;
  domain?: string;
  submitEndAt?: string;
  student?: { id: string; fullName: string; studentId?: string };
  period?: { id: string; code: string };
  latestSubmission?: { id: string; uploadedAt: string; version: number; driveLink?: string };
}

const STATE_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_GV: { label: "Chờ duyệt", color: "bg-amber-100 text-amber-700" },
  CONFIRMED: { label: "Đã duyệt", color: "bg-primary/10 text-primary" },
  IN_PROGRESS: { label: "Đang thực hiện", color: "bg-blue-100 text-blue-700" },
  PENDING_CONFIRM: { label: "Chờ bảo vệ", color: "bg-cyan-100 text-cyan-700" },
  DEFENSE: { label: "Bảo vệ", color: "bg-indigo-100 text-indigo-700" },
  GRADING: { label: "Đang chấm điểm", color: "bg-purple-100 text-purple-700" },
  SCORING: { label: "Đang chấm điểm", color: "bg-purple-100 text-purple-700" },
  COMPLETED: { label: "Hoàn thành", color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Từ chối", color: "bg-red-100 text-red-700" },
};

export default function GVHDTopicsPage() {
  const [topics, setTopics] = useState<TopicDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"" | "BCTT" | "KLTN">("");
  const [filterState, setFilterState] = useState("");

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<TopicDto>>("/topics?role=gvhd&page=1&size=100");
      setTopics(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải danh sách đề tài.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() =>
    topics
      .filter(t => !filterType || t.type === filterType)
      .filter(t => !filterState || t.state === filterState)
      .filter(t =>
        t.student?.fullName.toLowerCase().includes(search.toLowerCase()) ||
        t.title.toLowerCase().includes(search.toLowerCase()),
      ),
    [topics, filterType, filterState, search]);

  const stats = useMemo(() => ({
    total: topics.length,
    bctt: topics.filter(t => t.type === "BCTT").length,
    kltn: topics.filter(t => t.type === "KLTN").length,
    grading: topics.filter(t => t.state === "GRADING").length,
    needsAction: topics.filter(t => t.state === "PENDING_GV").length,
  }), [topics]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">Danh sách đề tài hướng dẫn</h1>
          <p className="text-sm text-outline mt-1">Theo dõi tiến độ và chấm điểm cho sinh viên hướng dẫn.</p>
        </div>
        <button onClick={() => void load()} className="p-2.5 rounded-xl border border-outline-variant/20 text-outline hover:bg-surface-container transition-colors self-start" title="Làm mới">
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Tổng đề tài", value: stats.total, color: "text-on-surface" },
          { label: "BCTT", value: stats.bctt, color: "text-primary" },
          { label: "KLTN", value: stats.kltn, color: "text-purple-600" },
          { label: "Cần xử lý", value: stats.needsAction, color: "text-amber-600" },
        ].map((s, i) => (
          <div key={i} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4 text-center">
            <p className={`text-3xl font-black font-headline ${s.color}`}>{s.value}</p>
            <p className="text-xs text-outline mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-error flex-shrink-0" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4 flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container rounded-xl border border-outline-variant/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface placeholder:text-outline/60"
            placeholder="Tìm sinh viên hoặc tên đề tài..."
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as "" | "BCTT" | "KLTN")}
          className="px-3 py-2.5 bg-surface-container rounded-xl border border-outline-variant/20 text-sm text-on-surface focus:outline-none"
        >
          <option value="">Tất cả loại</option>
          <option value="BCTT">BCTT</option>
          <option value="KLTN">KLTN</option>
        </select>
        <select
          value={filterState}
          onChange={e => setFilterState(e.target.value)}
          className="px-3 py-2.5 bg-surface-container rounded-xl border border-outline-variant/20 text-sm text-on-surface focus:outline-none"
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-outline animate-spin" />
          <span className="ml-3 text-sm text-outline">Đang tải...</span>
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtered.length === 0 && (
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 p-16 flex flex-col items-center gap-4">
          <BookOpen className="w-10 h-10 text-outline/40" />
          <p className="text-on-surface-variant font-medium">Không tìm thấy đề tài phù hợp.</p>
        </div>
      )}

      {/* List */}
      {!isLoading && (
        <div className="space-y-4">
          {filtered.map(topic => {
            const stateInfo = STATE_LABELS[topic.state] ?? { label: topic.state, color: "bg-gray-100 text-gray-700" };
            const deadlinePassed = topic.submitEndAt && new Date(topic.submitEndAt) < new Date();
            return (
              <div key={topic.id} className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 p-6 hover:shadow-md transition-all">
                <div className="flex flex-col md:flex-row md:items-start gap-5">
                  {/* Avatar */}
                  <div className="flex items-center gap-4 md:w-52 flex-shrink-0">
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                      {topic.student?.fullName?.charAt(0) ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-on-surface truncate">{topic.student?.fullName ?? "—"}</p>
                      <p className="text-xs text-outline">{topic.student?.studentId ?? ""}</p>
                    </div>
                  </div>

                  {/* Topic details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-2">
                      <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${topic.type === "KLTN" ? "bg-purple-100 text-purple-700" : "bg-primary/10 text-primary"}`}>
                        {topic.type}
                      </span>
                      <p className="text-sm font-semibold text-on-surface leading-snug">{topic.title}</p>
                    </div>
                    <div className="flex items-center flex-wrap gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${stateInfo.color}`}>{stateInfo.label}</span>
                      {topic.period?.code && <span className="text-xs bg-surface-container px-2 py-0.5 rounded-full text-outline">{topic.period.code}</span>}
                      {topic.domain && <span className="text-xs text-outline flex items-center gap-1"><BookOpen className="w-3 h-3" />{topic.domain}</span>}
                      {topic.submitEndAt && (
                        <span className={`text-xs flex items-center gap-1 ${deadlinePassed ? "text-error" : "text-outline"}`}>
                          <Clock className="w-3 h-3" />
                          Hạn: {new Date(topic.submitEndAt).toLocaleDateString("vi-VN")}
                          {deadlinePassed && " (Quá hạn)"}
                        </span>
                      )}
                    </div>
                    {/* Latest submission */}
                    {topic.latestSubmission && (
                      <div className="mt-2 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-outline" />
                        <span className="text-xs text-outline">
                          Đã nộp v{topic.latestSubmission.version} · {new Date(topic.latestSubmission.uploadedAt).toLocaleDateString("vi-VN")}
                        </span>
                        {topic.latestSubmission.driveLink && (
                          <a href={topic.latestSubmission.driveLink} target="_blank" rel="noreferrer" className="text-xs text-primary font-semibold hover:underline">
                            Xem bài
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(topic.state === "DEFENSE" || topic.state === "SCORING" || topic.state === "GRADING") && (
                      <Link
                        href={`/gvhd/scoring?topicId=${topic.id}`}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-all"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Chấm điểm
                      </Link>
                    )}
                    {topic.state === "PENDING_GV" && (
                      <Link
                        href="/gvhd/pending"
                        className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white text-xs font-semibold rounded-xl hover:bg-amber-600 transition-all"
                      >
                        Duyệt
                      </Link>
                    )}
                    <Link
                      href={`/gvhd/topics/${topic.id}`}
                      className="p-2 bg-surface-container-low border border-outline-variant/30 text-on-surface-variant rounded-xl hover:bg-surface-container transition-colors"
                      title="Xem chi tiết đề tài"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
