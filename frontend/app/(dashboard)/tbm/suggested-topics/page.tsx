"use client";

import { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff, Lightbulb, AlertCircle, Loader2, Search, Users, RefreshCw } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

interface SuggestedTopic {
  id: string;
  title: string;
  dot: string;
  supervisorEmail: string;
  lecturerUserId?: string;
  isVisible: boolean;
  createdAt?: string;
}

function getBearerToken() {
  return typeof window !== "undefined" ? localStorage.getItem("kltn_access_token") : null;
}

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getBearerToken()}` };
}

export default function TbmSuggestedTopicsPage() {
  const [topics, setTopics] = useState<SuggestedTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/topics/suggested-topics`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setTopics((json.data ?? []) as SuggestedTopic[]);
    } catch {
      setError("Không thể tải danh sách đề xuất.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const handleToggleVisibility = async (topic: SuggestedTopic) => {
    setTogglingId(topic.id);
    const newVisible = topic.isVisible === false ? true : false;
    try {
      const res = await fetch(`${API}/topics/suggested-topics/${topic.id}/visibility`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ isVisible: newVisible }),
      });
      if (!res.ok) throw new Error("Toggle failed");
      setTopics((prev) =>
        prev.map((t) => (t.id === topic.id ? { ...t, isVisible: newVisible } : t))
      );
    } catch {
      alert("Cập nhật thất bại. Vui lòng thử lại.");
    } finally {
      setTogglingId(null);
    }
  };

  const filtered = topics.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.supervisorEmail.toLowerCase().includes(search.toLowerCase()) ||
      (t.dot ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const visible = topics.filter((t) => t.isVisible !== false).length;
  const hidden = topics.length - visible;

  // Group by supervisor email
  const grouped = filtered.reduce<Record<string, SuggestedTopic[]>>((acc, t) => {
    const key = t.supervisorEmail || "Không rõ";
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/20 to-amber-50/10 p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20 flex-shrink-0">
              <Lightbulb className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 font-headline">Quản lý đề xuất đề tài</h1>
              <p className="text-slate-500 text-sm mt-0.5">Xem và kiểm soát hiển thị đề xuất của các giảng viên</p>
            </div>
          </div>
          <button
            onClick={() => fetchAll()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Tổng đề xuất", value: topics.length, color: "text-slate-700", bg: "bg-white" },
            { label: "Đang hiển thị", value: visible, color: "text-emerald-700", bg: "bg-emerald-50" },
            { label: "Đang ẩn", value: hidden, color: "text-amber-700", bg: "bg-amber-50" },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.bg} rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4 text-center`}>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tiêu đề, giảng viên, lĩnh vực..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 shadow-sm transition-all"
          />
        </div>

        {/* List */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Đang tải...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20 gap-2 text-red-500">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Lightbulb className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm font-medium">
                {search ? "Không tìm thấy đề xuất phù hợp" : "Chưa có đề xuất nào trong hệ thống"}
              </p>
            </div>
          ) : (
            <div>
              {Object.entries(grouped).map(([email, items], gi) => (
                <div key={email}>
                  {/* Group header */}
                  <div className={`flex items-center gap-2 px-6 py-3 bg-slate-50 border-b border-slate-100 ${gi > 0 ? "border-t" : ""}`}>
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-500">{email}</span>
                    <span className="text-xs text-slate-400 ml-auto">{items.length} đề xuất</span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {items.map((t) => (
                      <li key={t.id} className="flex items-start justify-between gap-4 px-6 py-4 hover:bg-slate-50/70 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium leading-snug ${t.isVisible === false ? "text-slate-400 line-through" : "text-slate-800"}`}>
                            {t.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {t.dot && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                                {t.dot}
                              </span>
                            )}
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${t.isVisible !== false ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                              {t.isVisible !== false ? (
                                <><Eye className="w-3 h-3" /> Hiện với SV</>
                              ) : (
                                <><EyeOff className="w-3 h-3" /> Đang ẩn</>
                              )}
                            </span>
                            {t.createdAt && (
                              <span className="text-[11px] text-slate-400">
                                {new Date(t.createdAt).toLocaleDateString("vi-VN")}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Toggle visibility button */}
                        <button
                          onClick={() => handleToggleVisibility(t)}
                          disabled={togglingId === t.id}
                          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-50 ${
                            t.isVisible !== false
                              ? "border border-amber-200 text-amber-700 hover:bg-amber-50"
                              : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          {togglingId === t.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : t.isVisible !== false ? (
                            <><EyeOff className="w-3.5 h-3.5" /> Ẩn</>
                          ) : (
                            <><Eye className="w-3.5 h-3.5" /> Hiện</>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
