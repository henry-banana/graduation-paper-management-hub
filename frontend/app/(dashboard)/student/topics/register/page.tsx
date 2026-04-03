"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, AlertCircle, ChevronDown, Send, Calendar, Info, Lock, Sparkles } from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";
import {
  KLTN_ELIGIBILITY_REASONS,
  PERIOD_STATUS_LABELS,
  TOPIC_DOMAIN_OPTIONS,
  TOPIC_TYPE_LABELS,
} from "@/lib/constants/vi-labels";

interface PeriodDto {
  id: string;
  code: string;
  type: "BCTT" | "KLTN";
  openDate: string;
  closeDate: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
}

interface TopicDto {
  id: string;
  type: "BCTT" | "KLTN";
  state: string;
}

interface UserProfileDto {
  id: string;
  fullName: string;
  studentId?: string;
  earnedCredits?: number;
  requiredCredits?: number;
  completedBcttScore?: number;
  canRegisterKltn?: boolean;
  kltnEligibilityReason?: string;
}

interface SupervisorOptionDto {
  id: string;
  fullName: string;
  email: string;
  lecturerId?: string;
  department?: string;
  totalQuota?: number;
  quotaUsed?: number;
}

interface TopicSuggestionDto {
  title: string;
  supervisorEmail?: string;
  supervisorName?: string;
  domain?: string;
}

const TERMINAL_STATES = new Set(["COMPLETED", "CANCELLED", "REJECTED"]);

function getCurrentLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateOnly(value?: string): string | null {
  if (!value) {
    return null;
  }

  const dateOnly = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return null;
  }

  return dateOnly;
}

function isPeriodCurrentlyOpen(period: Pick<PeriodDto, "status" | "openDate" | "closeDate">): boolean {
  if (period.status !== "OPEN") {
    return false;
  }

  const openDate = normalizeDateOnly(period.openDate);
  const closeDate = normalizeDateOnly(period.closeDate);

  if (!openDate || !closeDate) {
    return false;
  }

  const today = getCurrentLocalDate();
  return today >= openDate && today <= closeDate;
}

export default function StudentTopicRegisterPage() {
  const [periods, setPeriods] = useState<PeriodDto[]>([]);
  const [topics, setTopics] = useState<TopicDto[]>([]);
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [supervisors, setSupervisors] = useState<SupervisorOptionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    topicName: "",
    domain: "",
    supervisorUserId: "",
    periodId: "",
    type: "BCTT", // start with BCTT
    company: "",
  });
  const [submittedTopicId, setSubmittedTopicId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // F4A: Autocomplete state
  const [suggestions, setSuggestions] = useState<TopicSuggestionDto[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeTopic = useMemo(
    () => topics.find((topic) => !TERMINAL_STATES.has(topic.state)) ?? null,
    [topics],
  );

  const canRegisterKLTN = profile?.canRegisterKltn ?? false;
  const kltnEligibilityReason = profile?.kltnEligibilityReason ?? "OK";

  const availablePeriods = useMemo(() => {
    return periods.filter(
      (period) => period.type === form.type && isPeriodCurrentlyOpen(period),
    );
  }, [periods, form.type]);

  const selectedPeriod = useMemo(() => {
    return availablePeriods.find((period) => period.id === form.periodId);
  }, [availablePeriods, form.periodId]);

  const availableSupervisors = useMemo(() => {
    return supervisors.filter((supervisor) => {
      const total = supervisor.totalQuota;
      const used = supervisor.quotaUsed;

      if (typeof total !== "number" || typeof used !== "number") {
        return false;
      }

      return total - used > 0;
    });
  }, [supervisors]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError("");

      try {
        const [periodsRes, topicsRes, profileRes, supervisorsRes] = await Promise.all([
          api.get<ApiListResponse<PeriodDto>>("/periods?page=1&size=100"),
          api.get<ApiListResponse<TopicDto>>("/topics?role=student&page=1&size=100"),
          api.get<ApiResponse<UserProfileDto>>("/users/me"),
          api.get<ApiResponse<SupervisorOptionDto[]>>("/users/supervisors/options"),
        ]);

        setPeriods(periodsRes.data);
        setTopics(topicsRes.data);
        setProfile(profileRes.data);
        const supervisorOptions = supervisorsRes.data;
        setSupervisors(supervisorOptions);

        const firstOpenBctt = periodsRes.data.find(
          (period) => period.type === "BCTT" && isPeriodCurrentlyOpen(period),
        );

        if (firstOpenBctt) {
          setForm((prev) => ({
            ...prev,
            periodId: firstOpenBctt.id,
            supervisorUserId:
              supervisorOptions.find((supervisor) => {
                const total = supervisor.totalQuota;
                const used = supervisor.quotaUsed;
                return (
                  typeof total === "number" &&
                  typeof used === "number" &&
                  total - used > 0
                );
              })?.id ?? "",
          }));
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu đăng ký.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, []);

  // F4A: Debounced fetch suggestions
  useEffect(() => {
    const q = form.topicName.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsFetchingSuggestions(true);
    const timer = setTimeout(async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("kltn_access_token") : "";
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"}/topics/suggestions?q=${encodeURIComponent(q)}`,
          { headers: { Authorization: `Bearer ${token ?? ""}` } },
        );
        if (res.ok) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const json = await res.json();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const items = (Array.isArray(json) ? json : (json?.data ?? [])) as TopicSuggestionDto[];
          setSuggestions(items.slice(0, 8));
          setShowSuggestions(items.length > 0);
        }
      } catch { /* silent */ } finally {
        setIsFetchingSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [form.topicName]);

  // F4A: Click-outside to close suggestions
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSuggestion = (s: TopicSuggestionDto) => {
    setForm(prev => ({
      ...prev,
      topicName: s.title,
      domain: s.domain ?? prev.domain,
      supervisorUserId: supervisors.find(sv => sv.email === s.supervisorEmail)?.id ?? prev.supervisorUserId,
    }));
    setShowSuggestions(false);
  };

  useEffect(() => {
    if (!availablePeriods.length) {
      setForm((prev) => ({ ...prev, periodId: "" }));
      return;
    }

    const hasCurrent = availablePeriods.some((period) => period.id === form.periodId);
    if (!hasCurrent) {
      const openPeriod = availablePeriods.find((period) => period.status === "OPEN");
      setForm((prev) => ({ ...prev, periodId: openPeriod?.id ?? availablePeriods[0].id }));
    }
  }, [availablePeriods, form.periodId]);

  useEffect(() => {
    if (!availableSupervisors.length) {
      return;
    }

    const supervisorExists = availableSupervisors.some(
      (supervisor) => supervisor.id === form.supervisorUserId,
    );

    if (!supervisorExists) {
      setForm((prev) => ({ ...prev, supervisorUserId: availableSupervisors[0].id }));
    }
  }, [availableSupervisors, form.supervisorUserId]);

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as "BCTT" | "KLTN";
    if (newType === "KLTN" && !canRegisterKLTN) {
      setError(`Bạn chưa đủ điều kiện đăng ký KLTN: ${KLTN_ELIGIBILITY_REASONS[kltnEligibilityReason] || "N/A"}`);
      return;
    }

    setError("");
    setForm({ ...form, type: newType });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (activeTopic) {
      setError("Bạn đang có đề tài hoạt động. Hoàn tất hoặc hủy đề tài hiện tại trước khi đăng ký mới.");
      return;
    }

    if (!form.topicName || !form.domain || !form.supervisorUserId || !form.periodId) {
      setError("Vui lòng điền đầy đủ các trường bắt buộc.");
      return;
    }

    if (!availableSupervisors.length) {
      setError("Hiện chưa có GVHD còn quota trống để phân công. Vui lòng thử lại sau.");
      return;
    }

    if (!selectedPeriod || !isPeriodCurrentlyOpen(selectedPeriod)) {
      setError("Đợt đăng ký này hiện không mở. Vui lòng chọn đợt khác hoặc chờ đến kỳ đăng ký tiếp theo.");
      return;
    }

    if (form.type === "KLTN" && !canRegisterKLTN) {
      setError(`Không thể đăng ký KLTN: ${KLTN_ELIGIBILITY_REASONS[kltnEligibilityReason] || "N/A"}`);
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await api.post<ApiResponse<{ id: string; state: string }>>("/topics", {
        type: form.type,
        title: form.topicName,
        domain: form.domain,
        periodId: form.periodId,
        supervisorUserId: form.supervisorUserId,
        companyName: form.company || undefined,
      });

      setSubmittedTopicId(response.data.id);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Đăng ký đề tài thất bại.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedTopicId) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm p-12 flex flex-col items-center text-center gap-6">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold font-headline text-on-surface">Đăng ký thành công!</h2>
            <p className="text-outline mt-2 max-w-sm">Đề tài đã được gửi đến GVHD. Hạn phản hồi duyệt là <strong>3 ngày</strong> kể từ lúc gửi.</p>
            <p className="text-xs text-outline mt-2">Mã đề tài: {submittedTopicId}</p>
          </div>
          <Link href="/student/topics" className="text-sm text-primary font-semibold hover:underline">
            Xem đề tài của tôi
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">Đăng ký đề tài</h1>
        <p className="text-sm text-outline mt-1">Đăng ký đề tài BCTT hoặc KLTN. Khóa luận chỉ dành cho SV đã hoàn thành BCTT.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-outline-variant/10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-bold text-on-surface font-headline">Đăng ký đề tài mới</h3>
            </div>

            <div className="p-6 space-y-5">
              {error && (
                <div className="flex items-start gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-error mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}

              {activeTopic && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-700">
                    <p className="font-semibold">Bạn đang có đề tài hoạt động.</p>
                    <p className="mt-1">Đề tài hiện tại ({TOPIC_TYPE_LABELS[activeTopic.type] || activeTopic.type}) chưa hoàn tất. Bạn không thể đăng ký mới cùng lúc.</p>
                  </div>
                </div>
              )}

              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-outline">
                  <Calendar className="w-4 h-4" />
                  Đang tải dữ liệu đăng ký...
                </div>
              )}

              {/* Tên đề tài — F4A: Autocomplete */}
              <div>
                <label htmlFor="topic-name" className="block text-sm font-semibold text-on-surface mb-2">
                  Tên đề tài <span className="text-error">*</span>
                  {isFetchingSuggestions && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-primary font-normal">
                      <Sparkles className="w-3 h-3 animate-pulse" /> Đang tìm gợi ý...
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    id="topic-name"
                    type="text"
                    value={form.topicName}
                    onChange={e => {
                      setForm({ ...form, topicName: e.target.value });
                      setShowSuggestions(true);
                    }}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="Nhập tên đề tài... (gợi ý tự động)"
                    disabled={isSubmitting || isLoading}
                    autoComplete="off"
                    className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="absolute z-50 left-0 right-0 mt-1 bg-white border border-outline-variant/20 rounded-2xl shadow-xl overflow-hidden"
                    >
                      <div className="px-3 py-1.5 border-b border-outline-variant/10 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-primary" />
                        <span className="text-[10px] text-outline font-semibold uppercase tracking-wider">Gợi ý từ danh mục</span>
                      </div>
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSelectSuggestion(s)}
                          className="w-full text-left px-4 py-2.5 hover:bg-primary/5 transition-colors border-b border-outline-variant/5 last:border-0"
                        >
                          <p className="text-sm font-medium text-on-surface truncate">{s.title}</p>
                          <p className="text-[10px] text-outline mt-0.5">
                            {s.supervisorName && <span className="font-semibold">{s.supervisorName}</span>}
                            {s.domain && <span className="ml-2 bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{s.domain}</span>}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Ngành & GVHD */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="topic-domain" className="block text-sm font-semibold text-on-surface mb-2">Ngành/Chuyên ngành <span className="text-error">*</span></label>
                  <div className="relative">
                    <select
                    id="topic-domain"
                    value={form.domain}
                    onChange={e => setForm({ ...form, domain: e.target.value })}
                    disabled={isSubmitting || isLoading}
                    className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none pr-9"
                  >
                    <option value="">Chọn ngành/chuyên ngành</option>
                    {TOPIC_DOMAIN_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label htmlFor="supervisor-user-id" className="block text-sm font-semibold text-on-surface mb-2">GVHD <span className="text-error">*</span></label>
                  <div className="relative">
                    <select
                      id="supervisor-user-id"
                      value={form.supervisorUserId}
                      onChange={e => setForm({ ...form, supervisorUserId: e.target.value })}
                      disabled={isSubmitting || isLoading || !availableSupervisors.length}
                      className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none pr-9"
                    >
                      {availableSupervisors.map((supervisor) => (
                        <option key={supervisor.id} value={supervisor.id}>
                          {supervisor.fullName} ({supervisor.department || 'Chưa rõ khoa'}) - Còn {(supervisor.totalQuota ?? 0) - (supervisor.quotaUsed ?? 0)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none" />
                  </div>
                  {!availableSupervisors.length && (
                    <p className="text-[11px] text-error mt-1">
                      Hiện chưa có GVHD còn quota trống để phân công.
                    </p>
                  )}
                </div>
              </div>

              {/* Đợt & Loại */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="period-id" className="block text-sm font-semibold text-on-surface mb-2">Đợt <span className="text-error">*</span></label>
                  <div className="relative">
                    <select
                      id="period-id"
                      value={form.periodId}
                      onChange={e => setForm({ ...form, periodId: e.target.value })}
                      disabled={isSubmitting || isLoading || !availablePeriods.length}
                      className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none pr-9"
                    >
                      {availablePeriods.map((period) => (
                        <option key={period.id} value={period.id}>
                          {period.code} ({PERIOD_STATUS_LABELS[period.status]?.label || period.status})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label htmlFor="topic-type" className="block text-sm font-semibold text-on-surface mb-2">Loại <span className="text-error">*</span></label>
                  <div className="relative">
                    <select
                      id="topic-type"
                      value={form.type}
                      onChange={handleTypeChange}
                      disabled={isSubmitting || isLoading}
                      className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none pr-9"
                    >
                      <option value="BCTT">Báo cáo thực tập</option>
                      <option value="KLTN" disabled={!canRegisterKLTN}>Khóa luận tốt nghiệp {!canRegisterKLTN && "(Bị khóa)"}</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none" />
                  </div>
                  {!canRegisterKLTN && (
                    <p className="text-[10px] text-error mt-1 flex items-center gap-1"><Lock className="w-3 h-3"/> Chưa hoàn thành BCTT</p>
                  )}
                </div>
              </div>

              {/* Công ty */}
              <div>
                <label htmlFor="company-name" className="block text-sm font-semibold text-on-surface mb-2">Công ty thực tập <span className="text-outline font-normal">(nếu có)</span></label>
                <input
                  id="company-name"
                  type="text"
                  value={form.company}
                  onChange={e => setForm({ ...form, company: e.target.value })}
                  placeholder="Tên công ty..."
                  disabled={isSubmitting || isLoading}
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isLoading || Boolean(activeTopic)}
                className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 hover:shadow-lg transition-all active:scale-95 text-sm mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? "Đang gửi..." : "Đăng ký"}
              </button>
            </div>
          </form>
        </div>

        {/* Right Info */}
        <div className="space-y-4">
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant/10">
              <h4 className="font-semibold text-on-surface text-sm flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Lịch đăng ký</h4>
            </div>
            <div className="p-4 space-y-3">
              {periods.map((p) => (
                <div key={p.id} className={`px-4 py-3 rounded-2xl border ${p.status === "OPEN" ? "border-green-200 bg-green-50" : "border-outline-variant/15 bg-surface-container"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-on-surface">{p.code} ({p.type})</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.status === "OPEN" ? "bg-green-500 text-white" : "bg-surface-container-high text-outline"}`}>{PERIOD_STATUS_LABELS[p.status]?.label || p.status}</span>
                  </div>
                  <p className="text-xs text-outline">{p.openDate} — {p.closeDate}</p>
                </div>
              ))}

              {!periods.length && !isLoading && (
                <p className="text-xs text-outline">Chưa có đợt đăng ký nào trong hệ thống.</p>
              )}
            </div>
          </div>
          
          {/* Rule Card */}
          <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-900 leading-relaxed space-y-1.5">
                <p className="font-bold">Quy định KLTN</p>
                <p>Sinh viên muốn đăng ký Khóa luận tốt nghiệp phải có <strong>BCTT COMPLETED</strong>, điểm BCTT <strong>&gt; 5.0</strong> và đủ tín chỉ theo hồ sơ học vụ.</p>
                {!canRegisterKLTN && (
                  <ul className="list-disc pl-4 space-y-1">
                    <li className="text-error font-medium">{KLTN_ELIGIBILITY_REASONS[kltnEligibilityReason] || "N/A"}</li>
                  </ul>
                )}
                {profile && (
                  <p>
                    Tín chỉ hiện tại: <strong>{profile.earnedCredits ?? 0}</strong> / yêu cầu <strong>{profile.requiredCredits ?? 0}</strong>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
