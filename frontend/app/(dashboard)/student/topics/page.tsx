"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  PlusCircle,
  Filter,
  LucideIcon,
} from "lucide-react";
import { ErrorState } from "@/components/shared/error-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { Topic } from "@/lib/domain/repositories/topic.repository";
import { RepositoryFactory } from "@/lib/factory";

const STATE_CONFIG: Record<string, { label: string; color: string; icon: LucideIcon; bg: string }> = {
  PENDING_GV: { label: "Chờ duyệt", color: "text-amber-700", bg: "bg-amber-100", icon: Clock },
  CONFIRMED: { label: "Đã xác nhận", color: "text-blue-700", bg: "bg-blue-100", icon: CheckCircle2 },
  IN_PROGRESS: { label: "Đang thực hiện", color: "text-primary", bg: "bg-primary/10", icon: BookOpen },
  GRADING: { label: "Đang chấm điểm", color: "text-purple-700", bg: "bg-purple-100", icon: Clock },
  SCORING: { label: "Đang chấm điểm", color: "text-purple-700", bg: "bg-purple-100", icon: Clock },
  DEFENSE: { label: "Đang bảo vệ", color: "text-indigo-700", bg: "bg-indigo-100", icon: Clock },
  PENDING_CONFIRM: { label: "Chờ xác nhận", color: "text-cyan-700", bg: "bg-cyan-100", icon: Clock },
  COMPLETED: { label: "Hoàn thành", color: "text-green-700", bg: "bg-green-100", icon: CheckCircle2 },
  CANCELLED: { label: "Đã hủy", color: "text-red-700", bg: "bg-red-100", icon: XCircle },
};

const UNKNOWN_STATE = {
  label: "Không xác định",
  color: "text-outline",
  bg: "bg-surface-container",
  icon: Clock,
};

export default function StudentTopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTopics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const topicRepository = RepositoryFactory.getTopicRepository();
      const data = await topicRepository.getMyTopics();
      setTopics(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Không thể tải danh sách đề tài.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  const stats = useMemo(() => {
    const total = topics.length;
    const pending = topics.filter((topic) => topic.state === "PENDING_GV").length;
    const completed = topics.filter((topic) => topic.state === "COMPLETED").length;
    return { total, pending, completed };
  }, [topics]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">Đề tài của tôi</h1>
          <p className="text-sm text-outline mt-1">Danh sách tất cả đề tài bạn đã đăng ký.</p>
        </div>
        <Link
          href="/student/topics/register"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          Đăng ký mới
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Đề tài của tôi", value: stats.total, color: "text-primary", bg: "bg-primary/8" },
          { label: "Đang chờ duyệt", value: stats.pending, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Đã hoàn thành", value: stats.completed, color: "text-green-600", bg: "bg-green-50" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-outline-variant/10 px-6 py-5 flex flex-col gap-1.5`}>
            <span className="text-xs font-medium text-outline uppercase tracking-wide">{s.label}</span>
            <span className={`text-4xl font-black ${s.color} font-headline`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10">
          <h3 className="font-semibold text-on-surface text-sm">Danh sách đề tài</h3>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-outline hover:text-on-surface transition-colors"
            aria-label="Lọc đề tài"
          >
            <Filter className="w-3.5 h-3.5" />
            Lọc
          </button>
        </div>

        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={4} />
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorState
              title="Không tải được danh sách đề tài"
              message={error}
              onRetry={() => void loadTopics()}
            />
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container/40 border-b border-outline-variant/10">
                  {["Tên đề tài", "Loại", "GVHD", "Đợt", "Trạng thái", "Cập nhật", ""].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-widest text-outline whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topics.map((topic) => {
                  const cfg = STATE_CONFIG[topic.state] ?? UNKNOWN_STATE;
                  const Icon = cfg.icon;
                  return (
                    <tr key={topic.id} className="border-b border-outline-variant/10 last:border-0 hover:bg-surface-container/40 transition-colors group">
                      <td className="px-5 py-4 max-w-xs">
                        <p className="font-semibold text-on-surface leading-snug line-clamp-2">{topic.name}</p>
                        {topic.company && <p className="text-xs text-outline mt-1">{topic.company}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${topic.type === "KLTN" ? "bg-primary/10 text-primary" : "bg-purple-100 text-purple-700"}`}>
                          {topic.type}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-on-surface-variant text-xs">{topic.gvhdEmail}</p>
                      </td>
                      <td className="px-5 py-4 text-on-surface-variant text-xs whitespace-nowrap">{topic.periodCode}</td>
                      <td className="px-5 py-4">
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold w-fit ${cfg.bg} ${cfg.color}`}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-outline whitespace-nowrap">{topic.updatedAt}</td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/student/topics/${topic.id}`}
                          className="flex items-center gap-1 text-xs text-primary font-semibold opacity-0 group-hover:opacity-100 hover:underline transition-opacity"
                        >
                          Chi tiết
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {topics.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-outline">
                <BookOpen className="w-10 h-10 text-outline/30" />
                <p className="text-sm">Bạn chưa có đề tài nào. Hãy đăng ký ngay!</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
