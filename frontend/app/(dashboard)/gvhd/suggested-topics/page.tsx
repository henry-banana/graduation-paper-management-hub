"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Eye, EyeOff, Lightbulb, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

interface SuggestedTopic {
  id: string;
  title: string;
  dot: string;
  isVisible: boolean;
  createdAt?: string;
}

function getBearerToken() {
  return typeof window !== "undefined" ? localStorage.getItem("kltn_access_token") : null;
}

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getBearerToken()}` };
}

export default function GvhdSuggestedTopicsPage() {
  const [topics, setTopics] = useState<SuggestedTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [title, setTitle] = useState("");
  const [dot, setDot] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/topics/suggested-topics`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setTopics((json.data ?? []) as SuggestedTopic[]);
    } catch (e) {
      setError("Không thể tải danh sách đề xuất. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchSuggestions(); }, [fetchSuggestions]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setCreateError("Vui lòng nhập tiêu đề đề xuất."); return; }
    setCreating(true);
    setCreateError(null);
    setCreateSuccess(false);
    try {
      const res = await fetch(`${API}/topics/suggested-topics`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ title: title.trim(), dot: dot.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Lỗi tạo đề xuất");
      }
      setTitle("");
      setDot("");
      setCreateSuccess(true);
      setTimeout(() => setCreateSuccess(false), 3000);
      await fetchSuggestions();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Không thể tạo đề xuất.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xác nhận xóa đề xuất này?")) return;
    setDeletingId(id);
    try {
      await fetch(`${API}/topics/suggested-topics/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      setTopics((prev) => prev.filter((t) => t.id !== id));
    } catch {
      alert("Xóa thất bại. Vui lòng thử lại.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
            <Lightbulb className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-headline">Đề xuất đề tài</h1>
            <p className="text-slate-500 text-sm mt-0.5">Quản lý danh sách đề tài gợi ý hiển thị với sinh viên khi đăng ký</p>
          </div>
        </div>

        {/* Create Form */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm shadow-slate-200/50 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-5 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-600" />
            Thêm đề xuất mới
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Tiêu đề đề tài <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Xây dựng hệ thống quản lý KLTN bằng Next.js..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Lĩnh vực / Chuyên ngành
              </label>
              <input
                type="text"
                value={dot}
                onChange={(e) => setDot(e.target.value)}
                placeholder="Ví dụ: Công nghệ phần mềm, AI, IoT..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
              />
            </div>

            {createError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {createError}
              </div>
            )}
            {createSuccess && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Thêm đề xuất thành công!
              </div>
            )}

            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-100 transition-all disabled:opacity-60 disabled:scale-100"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creating ? "Đang lưu..." : "Thêm đề xuất"}
            </button>
          </form>
        </div>

        {/* List */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm shadow-slate-200/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-700">
              Danh sách đề xuất của tôi
              <span className="ml-2 text-xs font-normal text-slate-400">({topics.length} đề xuất)</span>
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Đang tải...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16 gap-2 text-red-500">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          ) : topics.length === 0 ? (
            <div className="text-center py-16">
              <Lightbulb className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm font-medium">Chưa có đề xuất nào</p>
              <p className="text-slate-400 text-xs mt-1">Thêm đề xuất để sinh viên tìm kiếm khi đăng ký đề tài</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {topics.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-4 px-6 py-4 hover:bg-slate-50/70 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 leading-snug">{t.title}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {t.dot && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                          {t.dot}
                        </span>
                      )}
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${t.isVisible !== false ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
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
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={deletingId === t.id}
                    className="flex-shrink-0 p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                    title="Xóa đề xuất"
                  >
                    {deletingId === t.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
