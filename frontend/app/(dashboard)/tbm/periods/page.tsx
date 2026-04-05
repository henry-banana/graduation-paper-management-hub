"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, BookOpen, Calendar, Check, CheckCircle2,
  Clock, Edit, Plus, RefreshCw, Trash2, X,
} from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";

interface PeriodApiDto {
  id: string;
  code: string;
  type: "BCTT" | "KLTN";
  openDate?: string;
  closeDate?: string;
  status?: "DRAFT" | "OPEN" | "CLOSED";
  name?: string;
  registrationStartAt?: string;
  registrationEndAt?: string;
  submitStartAt?: string;
  submitEndAt?: string;
  isOpen?: boolean;
  supervisorQuota?: number;
  topicsCount?: number;
}

interface PeriodDto {
  id: string;
  code: string;
  name: string;
  type: "BCTT" | "KLTN";
  registrationStartAt: string;
  registrationEndAt: string;
  submitStartAt: string;
  submitEndAt: string;
  isOpen: boolean;
  status: "DRAFT" | "OPEN" | "CLOSED";
  supervisorQuota?: number;
  topicsCount?: number;
}

type ModalMode = "create" | "edit" | null;

interface FormState {
  code: string;
  name: string;
  type: "BCTT" | "KLTN";
  registrationStartAt: string;
  registrationEndAt: string;
  submitStartAt: string;
  submitEndAt: string;
  supervisorQuota: number;
}

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  type: "BCTT",
  registrationStartAt: "",
  registrationEndAt: "",
  submitStartAt: "",
  submitEndAt: "",
  supervisorQuota: 5,
};

function normalizePeriod(period: PeriodApiDto): PeriodDto {
  const registrationStartAt = period.registrationStartAt ?? period.openDate ?? "";
  const registrationEndAt = period.registrationEndAt ?? period.closeDate ?? "";
  const status = period.status ?? (period.isOpen ? "OPEN" : "CLOSED");
  const isOpen =
    typeof period.isOpen === "boolean" ? period.isOpen : status === "OPEN";

  return {
    id: period.id,
    code: period.code,
    name: period.name ?? `${period.type} ${period.code}`,
    type: period.type,
    registrationStartAt,
    registrationEndAt,
    submitStartAt: period.submitStartAt ?? "",
    submitEndAt: period.submitEndAt ?? "",
    isOpen,
    status,
    supervisorQuota: period.supervisorQuota,
    topicsCount: period.topicsCount,
  };
}

function statusOf(p: PeriodDto): { label: string; color: string } {
  if (p.status === "DRAFT") {
    return { label: "Nháp", color: "bg-surface-container text-outline" };
  }

  const now = Date.now();
  const regStart = new Date(p.registrationStartAt).getTime();
  const regEnd = new Date(p.registrationEndAt).getTime();
  if (!p.isOpen) return { label: "Đã đóng", color: "bg-gray-100 text-gray-600" };
  if (now < regStart) return { label: "Sắp mở ĐK", color: "bg-amber-100 text-amber-700" };
  if (now <= regEnd) return { label: "Đang đăng ký", color: "bg-green-100 text-green-700" };
  return { label: "Đang thực hiện", color: "bg-blue-100 text-blue-700" };
}

function fmtDate(v: string) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("vi-VN");
}

function toInputDate(v: string) {
  if (!v) return "";
  return new Date(v).toISOString().slice(0, 16);
}

function toDateOnly(v: string) {
  return v ? v.slice(0, 10) : "";
}

export default function TBMPeriodsPage() {
  const [periods, setPeriods] = useState<PeriodDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingPeriod, setEditingPeriod] = useState<PeriodDto | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"" | "BCTT" | "KLTN">("");

  const filtered = useMemo(() =>
    periods.filter(p => !filterType || p.type === filterType),
    [periods, filterType],
  );

  const stats = useMemo(() => ({
    total: periods.length,
    open: periods.filter(p => p.isOpen).length,
    bctt: periods.filter(p => p.type === "BCTT").length,
    kltn: periods.filter(p => p.type === "KLTN").length,
  }), [periods]);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<PeriodApiDto>>("/periods?page=1&size=50");
      setPeriods((res.data ?? []).map(normalizePeriod));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải danh sách đợt.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingPeriod(null);
    setModalMode("create");
  };

  const openEdit = (p: PeriodDto) => {
    setForm({
      code: p.code,
      name: p.name,
      type: p.type,
      registrationStartAt: toInputDate(p.registrationStartAt),
      registrationEndAt: toInputDate(p.registrationEndAt),
      submitStartAt: toInputDate(p.submitStartAt),
      submitEndAt: toInputDate(p.submitEndAt),
      supervisorQuota: p.supervisorQuota ?? 5,
    });
    setEditingPeriod(p);
    setModalMode("edit");
  };

  const handleSave = async () => {
    if (!form.registrationStartAt || !form.registrationEndAt) {
      setError("Vui lòng nhập đầy đủ thời gian bắt đầu/kết thúc đăng ký.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (modalMode === "create") {
        await api.post<ApiResponse<{ id: string }>>("/periods", {
          code: form.code,
          name: form.name || undefined,
          type: form.type,
          openDate: toDateOnly(form.registrationStartAt),
          closeDate: toDateOnly(form.registrationEndAt),
          submitStartAt: form.submitStartAt ? toDateOnly(form.submitStartAt) : undefined,
          submitEndAt: form.submitEndAt ? toDateOnly(form.submitEndAt) : undefined,
          supervisorQuota: form.supervisorQuota || undefined,
        });
      } else if (editingPeriod) {
        await api.patch<ApiResponse<{ updated: boolean }>>(
          `/periods/${editingPeriod.id}`,
          {
            code: form.code,
            name: form.name || undefined,
            openDate: toDateOnly(form.registrationStartAt),
            closeDate: toDateOnly(form.registrationEndAt),
            submitStartAt: form.submitStartAt ? toDateOnly(form.submitStartAt) : undefined,
            submitEndAt: form.submitEndAt ? toDateOnly(form.submitEndAt) : undefined,
            supervisorQuota: form.supervisorQuota || undefined,
          },
        );
      }

      await load();
      setModalMode(null);
      setSuccess(modalMode === "create" ? "Tạo đợt thành công." : "Cập nhật đợt thành công.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lưu thất bại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleOpen = async (p: PeriodDto) => {
    setIsToggling(p.id);
    setError(null);
    try {
      const endpoint = p.isOpen
        ? `/periods/${p.id}/close`
        : `/periods/${p.id}/open`;

      await api.post<ApiResponse<{ status: "OPEN" | "CLOSED" }>>(endpoint, {});
      setPeriods(prev => prev.map(x =>
        x.id === p.id
          ? {
              ...x,
              isOpen: !p.isOpen,
              status: p.isOpen ? "CLOSED" : "OPEN",
            }
          : x,
      ));
      setSuccess(p.isOpen ? "Đã đóng đợt." : "Đã mở đợt.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cập nhật trạng thái thất bại.");
    } finally {
      setIsToggling(null);
    }
  };

  const setField = (k: keyof FormState, v: string | number) =>
    setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">Quản lý đợt BCTT / KLTN</h1>
          <p className="text-sm text-outline mt-1">Thiết lập thời gian đăng ký, nộp bài và quota GVHD cho mỗi đợt.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => void load()} className="p-2.5 rounded-xl border border-outline-variant/20 hover:bg-surface-container transition-colors">
            <RefreshCw className={`w-4 h-4 text-outline ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95">
            <Plus className="w-4 h-4" />Tạo đợt mới
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Tổng đợt", value: stats.total, color: "text-on-surface" },
          { label: "Đang mở", value: stats.open, color: "text-green-600" },
          { label: "BCTT", value: stats.bctt, color: "text-primary" },
          { label: "KLTN", value: stats.kltn, color: "text-purple-600" },
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
          <AlertCircle className="w-4 h-4 text-error flex-shrink-0" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        {(["", "BCTT", "KLTN"] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filterType === t
                ? "bg-primary text-white shadow-sm"
                : "bg-surface-container-lowest border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {t === "" ? "Tất cả" : t}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-outline animate-spin" />
          <span className="ml-3 text-sm text-outline">Đang tải...</span>
        </div>
      )}

      {/* Table */}
      {!isLoading && (
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden shadow-sm">
          {filtered.length === 0 ? (
            <div className="p-16 flex flex-col items-center gap-4">
              <Calendar className="w-10 h-10 text-outline/40" />
              <p className="text-on-surface-variant font-medium">Chưa có đợt nào.</p>
              <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-all">
                <Plus className="w-4 h-4" />Tạo đợt đầu tiên
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-outline-variant/10">
                <thead>
                  <tr className="bg-surface-container/50">
                    {["Đợt", "Loại", "Đăng ký", "Nộp bài", "Quota GVHD", "SV ĐK", "Trạng thái", ""].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-outline uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {filtered.map(p => {
                    const st = statusOf(p);
                    const toggling = isToggling === p.id;
                    return (
                      <tr key={p.id} className="hover:bg-surface-container-low/30 transition-colors">
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-on-surface">{p.name}</p>
                          <p className="text-xs text-outline mt-0.5 font-mono">{p.code}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${p.type === "KLTN" ? "bg-purple-100 text-purple-700" : "bg-primary/10 text-primary"}`}>
                            {p.type}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-xs text-outline">
                          {fmtDate(p.registrationStartAt)} → {fmtDate(p.registrationEndAt)}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-xs text-outline">
                          {fmtDate(p.submitStartAt)} → {fmtDate(p.submitEndAt)}
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-on-surface text-center">
                          {p.supervisorQuota ?? "—"}
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-center text-on-surface">
                          {p.topicsCount ?? "—"}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${st.color}`}>{st.label}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => void handleToggleOpen(p)}
                              disabled={toggling}
                              title={p.isOpen ? "Đóng đợt" : "Mở đợt"}
                              className={`p-2 rounded-xl border transition-colors disabled:opacity-60 ${
                                p.isOpen
                                  ? "border-error/20 text-error bg-error-container/10 hover:bg-error-container/20"
                                  : "border-green-200 text-green-600 bg-green-50 hover:bg-green-100"
                              }`}
                            >
                              {p.isOpen ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => openEdit(p)}
                              className="p-2 rounded-xl border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container transition-colors"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-outline-variant/10">
              <h3 className="font-bold text-on-surface text-lg">
                {modalMode === "create" ? "Tạo đợt mới" : "Chỉnh sửa đợt"}
              </h3>
              <button onClick={() => setModalMode(null)} className="p-1.5 rounded-xl hover:bg-surface-container transition-colors">
                <X className="w-5 h-5 text-outline" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Row: code + name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5 uppercase">Mã đợt *</label>
                  <input value={form.code} onChange={e => setField("code", e.target.value)} placeholder="VD: HK1-2025-2026"
                    className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5 uppercase">Loại *</label>
                  <select value={form.type} onChange={e => setField("type", e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="BCTT">BCTT</option>
                    <option value="KLTN">KLTN</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-outline mb-1.5 uppercase">Tên đợt *</label>
                <input value={form.name} onChange={e => setField("name", e.target.value)} placeholder="VD: Báo cáo thực tập HK1 2025-2026"
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              {/* Dates */}
              <div>
                <p className="text-xs font-semibold text-outline mb-2 uppercase flex items-center gap-2"><Clock className="w-3.5 h-3.5" />Thời gian đăng ký</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-outline mb-1">Bắt đầu</label>
                    <input type="datetime-local" value={form.registrationStartAt} onChange={e => setField("registrationStartAt", e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="block text-xs text-outline mb-1">Kết thúc</label>
                    <input type="datetime-local" value={form.registrationEndAt} onChange={e => setField("registrationEndAt", e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-outline mb-2 uppercase flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" />Thời gian nộp bài</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-outline mb-1">Bắt đầu</label>
                    <input type="datetime-local" value={form.submitStartAt} onChange={e => setField("submitStartAt", e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="block text-xs text-outline mb-1">Kết thúc</label>
                    <input type="datetime-local" value={form.submitEndAt} onChange={e => setField("submitEndAt", e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-outline mb-1.5 uppercase">Quota GVHD (số SV tối đa/GV)</label>
                <input type="number" min={1} max={20} value={form.supervisorQuota} onChange={e => setField("supervisorQuota", parseInt(e.target.value) || 5)}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            {error && (
              <div className="mx-6 mb-4 flex items-center gap-3 bg-error-container/20 border border-error/20 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-error flex-shrink-0" />
                <p className="text-sm text-error">{error}</p>
              </div>
            )}
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setModalMode(null)} className="flex-1 px-4 py-2.5 border border-outline-variant/20 rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors">
                Hủy
              </button>
              <button onClick={() => void handleSave()} disabled={isSaving} className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
                {isSaving ? "Đang lưu..." : modalMode === "create" ? "Tạo đợt" : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
