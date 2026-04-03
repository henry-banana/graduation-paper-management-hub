"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BookOpen, RefreshCw, Search, Users, MapPin, Clock } from "lucide-react";
import { ApiListResponse, api } from "@/lib/api";

interface ScheduleDto {
  id: string;
  topicId: string;
  topicTitle: string;
  type: "BCTT" | "KLTN";
  defenseAt?: string;
  location?: string;
  student?: { fullName: string; studentId?: string };
  supervisor?: { fullName: string };
  reviewer?: { fullName: string };
  council?: {
    chair?: { fullName: string };
    secretary?: { fullName: string };
    members?: { fullName: string }[];
  };
  period?: { code: string };
  state: string;
}

function fmtDateTime(v: string | undefined) {
  if (!v) return "Chưa xếp lịch";
  const d = new Date(v);
  return d.toLocaleDateString("vi-VN") + " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export default function TBMSchedulesPage() {
  const [schedules, setSchedules] = useState<ScheduleDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"" | "BCTT" | "KLTN">("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<ScheduleDto>>("/topics?role=tbm&page=1&size=200&state=GRADING");
      setSchedules(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải lịch bảo vệ.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() =>
    schedules
      .filter(s => !filterType || s.type === filterType)
      .filter(s =>
        (s.student?.fullName ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (s.topicTitle ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (s.location ?? "").toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) => {
        if (!a.defenseAt && !b.defenseAt) return 0;
        if (!a.defenseAt) return 1;
        if (!b.defenseAt) return -1;
        return new Date(a.defenseAt).getTime() - new Date(b.defenseAt).getTime();
      }),
    [schedules, search, filterType],
  );

  const unscheduled = filtered.filter(s => !s.defenseAt);
  const scheduled = filtered.filter(s => !!s.defenseAt);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">Lịch bảo vệ</h1>
          <p className="text-sm text-outline mt-1">Danh sách lịch bảo vệ BCTT / KLTN. Phân công Hội đồng tại mục Phân công.</p>
        </div>
        <button onClick={() => void load()} className="p-2.5 rounded-xl border border-outline-variant/20 hover:bg-surface-container transition-colors self-start">
          <RefreshCw className={`w-4 h-4 text-outline ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Tổng đề tài chấm", value: schedules.length, color: "text-on-surface" },
          { label: "Đã có lịch", value: schedules.filter(s => s.defenseAt).length, color: "text-green-600" },
          { label: "Chưa có lịch", value: schedules.filter(s => !s.defenseAt).length, color: "text-amber-600" },
        ].map((s, i) => (
          <div key={i} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4 text-center">
            <p className={`text-3xl font-black font-headline ${s.color}`}>{s.value}</p>
            <p className="text-xs text-outline mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-error" /><p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm sinh viên, đề tài, địa điểm..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface placeholder:text-outline/60" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value as "" | "BCTT" | "KLTN")}
          className="px-3 py-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/20 text-sm text-on-surface focus:outline-none">
          <option value="">Tất cả loại</option><option value="BCTT">BCTT</option><option value="KLTN">KLTN</option>
        </select>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 animate-spin text-outline" /><span className="ml-3 text-sm text-outline">Đang tải...</span></div>
      )}

      {!isLoading && (
        <div className="space-y-6">
          {/* Scheduled */}
          {scheduled.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-outline uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />Đã có lịch ({scheduled.length})
              </h2>
              <div className="space-y-3">
                {scheduled.map(s => (
                  <div key={s.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden hover:shadow-sm transition-all">
                    <div
                      className="p-5 flex items-start gap-4 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    >
                      {/* Date block */}
                      <div className="flex-shrink-0 w-16 text-center">
                        {s.defenseAt ? (
                          <>
                            <p className="text-2xl font-black text-primary">{new Date(s.defenseAt).getDate()}</p>
                            <p className="text-xs text-outline">{new Date(s.defenseAt).toLocaleDateString("vi-VN", { month: "short", year: "numeric" })}</p>
                          </>
                        ) : (
                          <p className="text-xs text-outline italic">Chưa có</p>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${s.type === "KLTN" ? "bg-purple-100 text-purple-700" : "bg-primary/10 text-primary"}`}>{s.type}</span>
                          <span className="text-sm font-semibold text-on-surface">{s.student?.fullName}</span>
                          <span className="text-xs text-outline">{s.student?.studentId}</span>
                        </div>
                        <p className="text-xs text-on-surface-variant line-clamp-1 mb-2">{s.topicTitle}</p>
                        <div className="flex items-center flex-wrap gap-3 text-xs text-outline">
                          {s.defenseAt && (
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(s.defenseAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                          )}
                          {s.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}</span>}
                          {s.council?.chair && <span className="flex items-center gap-1"><Users className="w-3 h-3" />CT: {s.council.chair.fullName}</span>}
                        </div>
                      </div>
                    </div>
                    {/* Expanded details */}
                    {expandedId === s.id && (
                      <div className="px-5 pb-5 border-t border-outline-variant/10 pt-4">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-outline uppercase tracking-wider mb-1">GVHD</p>
                            <p className="text-on-surface font-medium">{s.supervisor?.fullName ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-outline uppercase tracking-wider mb-1">GVPB</p>
                            <p className="text-on-surface font-medium">{s.reviewer?.fullName ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-outline uppercase tracking-wider mb-1">Chủ tịch</p>
                            <p className="text-on-surface font-medium">{s.council?.chair?.fullName ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-outline uppercase tracking-wider mb-1">Thư ký</p>
                            <p className="text-on-surface font-medium">{s.council?.secretary?.fullName ?? "—"}</p>
                          </div>
                          {s.council?.members && s.council.members.length > 0 && (
                            <div className="col-span-2">
                              <p className="text-outline uppercase tracking-wider mb-1">Thành viên HĐ</p>
                              <p className="text-on-surface font-medium">{s.council.members.map(m => m.fullName).join(", ")}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unscheduled */}
          {unscheduled.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-outline uppercase tracking-wider mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />Chưa có lịch ({unscheduled.length})
              </h2>
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
                <div className="divide-y divide-outline-variant/10">
                  {unscheduled.map(s => (
                    <div key={s.id} className="px-5 py-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.type === "KLTN" ? "bg-purple-100 text-purple-700" : "bg-primary/10 text-primary"}`}>{s.type}</span>
                          <span className="text-sm font-semibold text-on-surface">{s.student?.fullName}</span>
                          <span className="text-xs text-outline">{s.student?.studentId}</span>
                        </div>
                        <p className="text-xs text-on-surface-variant line-clamp-1">{s.topicTitle}</p>
                      </div>
                      <span className="text-xs italic text-amber-600 flex-shrink-0">Chưa xếp lịch</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {filtered.length === 0 && !isLoading && (
            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 p-16 flex flex-col items-center gap-4">
              <Users className="w-10 h-10 text-outline/40" />
              <p className="text-on-surface-variant font-medium">Không có lịch bảo vệ nào.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
