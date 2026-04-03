"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, FileCheck, MessageSquare, RefreshCw, Save, Search, Sliders, User, AlertCircle, ChevronRight } from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";

interface TopicDto {
  id: string;
  title: string;
  type: "BCTT" | "KLTN";
  state: string;
  domain?: string;
  student?: { id: string; fullName: string; studentId?: string };
  period?: { id: string; code: string };
  supervisor?: { fullName: string };
  latestSubmission?: { id: string; driveLink?: string; version: number };
}

interface ScoreDto {
  criteria: Record<string, number>;
  comments?: string;
  questions?: string;
  isSubmitted?: boolean;
}

const RUBRIC_GVPB = [
  { id: "content", label: "1. Nội dung & Kỹ thuật", max: 5.0, desc: "Đánh giá chất lượng chuyên môn, tính đúng đắn của kết quả." },
  { id: "presentation", label: "2. Hình thức trình bày", max: 2.0, desc: "Cấu trúc báo cáo, hình thức, văn phong." },
  { id: "defense", label: "3. Trả lời phản biện", max: 3.0, desc: "Khả năng trả lời câu hỏi của GV phản biện." },
];

export default function GVPBReviewsPage() {
  const [topics, setTopics] = useState<TopicDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingScore, setIsLoadingScore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingScore, setExistingScore] = useState<ScoreDto | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState("");
  const [questions, setQuestions] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const totalScore = useMemo(() => RUBRIC_GVPB.reduce((s, c) => s + (scores[c.id] ?? 0), 0), [scores]);
  const maxScore = RUBRIC_GVPB.reduce((s, c) => s + c.max, 0);
  const isPassed = totalScore >= 5.0;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<TopicDto>>("/topics?role=gvpb&page=1&size=100");
      setTopics(res.data);
      setSelectedId((current) => current || res.data[0]?.id || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải danh sách phản biện.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedId) return;
    setExistingScore(null);
    setIsLoadingScore(true);
    void (async () => {
      try {
        const res = await api.get<ApiResponse<ScoreDto>>(`/topics/${selectedId}/scores/my-draft`);
        const s = res.data;
        setExistingScore(s);
        setScores(s.criteria ?? {});
        setComments(s.comments ?? "");
        setQuestions(s.questions ?? "");
      } catch {
        const defaults: Record<string, number> = {};
        RUBRIC_GVPB.forEach(c => { defaults[c.id] = 0; });
        setScores(defaults);
        setComments("");
        setQuestions("");
      } finally {
        setIsLoadingScore(false);
      }
    })();
  }, [selectedId]);

  const selectedTopic = useMemo(() => topics.find(t => t.id === selectedId) ?? null, [topics, selectedId]);

  const filtered = useMemo(() =>
    topics.filter(t =>
      t.student?.fullName.toLowerCase().includes(search.toLowerCase()) ||
      t.title.toLowerCase().includes(search.toLowerCase()),
    ), [topics, search]);

  const handleSaveDraft = async () => {
    if (!selectedId) return;
    setIsSaving(true);
    setError(null);
    try {
      await api.post<ApiResponse<unknown>>(`/topics/${selectedId}/scores/draft-direct`, {
        criteria: scores, comments, questions, role: "GVPB",
      });
      setSuccess("Đã lưu nháp.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lưu nháp thất bại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedId) return;
    if (!window.confirm("Sau khi nộp chính thức, điểm sẽ không thể chỉnh sửa. Xác nhận?")) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post<ApiResponse<unknown>>(`/topics/${selectedId}/scores/submit-direct`, {
        criteria: scores, comments, questions, role: "GVPB",
      });
      setSuccess("Đã nộp phiếu phản biện chính thức!");
      setExistingScore(prev => ({ criteria: (prev?.criteria ?? {}), ...(prev ?? {}), isSubmitted: true } as ScoreDto));
      setTimeout(() => setSuccess(null), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nộp điểm thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">Phản biện đề tài</h1>
          <p className="text-sm text-outline mt-1">Chấm điểm phản biện và nhập câu hỏi cho sinh viên.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-5 py-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest text-center min-w-[100px]">
            <p className="text-2xl font-black font-headline text-primary">{topics.length}</p>
            <p className="text-xs text-outline mt-0.5">Đề tài phản biện</p>
          </div>
          <button onClick={() => void load()} className="p-2.5 rounded-xl border border-outline-variant/20 hover:bg-surface-container transition-colors">
            <RefreshCw className={`w-4 h-4 text-outline ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-error" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 text-outline animate-spin" /><span className="ml-3 text-sm text-outline">Đang tải...</span></div>
      ) : topics.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 p-16 flex flex-col items-center gap-4">
          <BookOpen className="w-10 h-10 text-outline/40" />
          <p className="text-on-surface-variant font-medium">Bạn chưa được phân công phản biện đề tài nào.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Topic list */}
          <div className="lg:col-span-1 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface placeholder:text-outline/60"
                placeholder="Tìm sinh viên..."
              />
            </div>
            <div className="space-y-2">
              {filtered.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    t.id === selectedId
                      ? "border-primary/40 bg-primary/5"
                      : "border-outline-variant/10 bg-surface-container-lowest hover:border-outline-variant/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-on-surface truncate">{t.student?.fullName ?? "—"}</p>
                      <p className="text-xs text-outline mt-0.5 truncate">{t.title}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-outline flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Scoring form */}
          <div className="lg:col-span-2">
            {!selectedId ? (
              <div className="flex items-center justify-center h-64 text-outline text-sm">Chọn đề tài để chấm điểm</div>
            ) : isLoadingScore ? (
              <div className="flex items-center justify-center h-64"><RefreshCw className="w-5 h-5 animate-spin text-outline" /></div>
            ) : (
              <div className="space-y-5">
                {/* Topic header */}
                {selectedTopic && (
                  <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {selectedTopic.student?.fullName?.charAt(0) ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${selectedTopic.type === "KLTN" ? "bg-purple-100 text-purple-700" : "bg-primary/10 text-primary"}`}>
                            {selectedTopic.type}
                          </span>
                          <p className="text-sm font-semibold text-on-surface">{selectedTopic.student?.fullName}</p>
                          <span className="text-xs text-outline">{selectedTopic.student?.studentId}</span>
                        </div>
                        <p className="text-xs text-outline line-clamp-2">{selectedTopic.title}</p>
                        {selectedTopic.supervisor && (
                          <p className="text-xs text-outline mt-1"><User className="w-3 h-3 inline mr-1" />GVHD: {selectedTopic.supervisor.fullName}</p>
                        )}
                        {selectedTopic.latestSubmission?.driveLink && (
                          <a href={selectedTopic.latestSubmission.driveLink} target="_blank" rel="noreferrer" className="text-xs text-primary font-semibold mt-2 inline-flex items-center gap-1 hover:underline">
                            <BookOpen className="w-3 h-3" />Xem bài SV (v{selectedTopic.latestSubmission.version})
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {existingScore?.isSubmitted && (
                  <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3">
                    <FileCheck className="w-4 h-4 text-primary" />
                    <p className="text-sm text-primary font-medium">Đã nộp phiếu phản biện chính thức.</p>
                  </div>
                )}

                {/* Rubric */}
                <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden">
                  <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container/50 flex items-center gap-3">
                    <Sliders className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-on-surface font-headline">Tiêu chí phản biện</h3>
                    <div className="ml-auto flex items-center gap-2">
                      <span className={`text-lg font-black font-headline ${isPassed ? "text-primary" : "text-error"}`}>{totalScore.toFixed(2)}</span>
                      <span className="text-xs text-outline">/ {maxScore}</span>
                    </div>
                  </div>
                  <div className="divide-y divide-outline-variant/10">
                    {RUBRIC_GVPB.map(c => {
                      const current = scores[c.id] ?? 0;
                      return (
                        <div key={c.id} className="p-5 hover:bg-surface-container-low/50 transition-colors">
                          <div className="flex items-center justify-between gap-4 mb-1">
                            <label className="text-sm font-semibold text-on-surface">{c.label}<span className="ml-2 text-xs text-outline font-normal">(Tối đa {c.max})</span></label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number" max={c.max} min={0} step={0.25} value={current}
                                disabled={existingScore?.isSubmitted}
                                onChange={e => setScores(prev => ({ ...prev, [c.id]: Math.min(c.max, Math.max(0, parseFloat(e.target.value) || 0)) }))}
                                className="w-20 text-right rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm font-bold px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                              />
                              <span className="text-sm text-outline">/ {c.max}</span>
                            </div>
                          </div>
                          <p className="text-xs text-outline">{c.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Questions + Comments */}
                <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5 space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase text-outline mb-2">
                      <MessageSquare className="w-3.5 h-3.5" />Câu hỏi phản biện
                    </label>
                    <textarea
                      rows={4} value={questions} disabled={existingScore?.isSubmitted}
                      onChange={e => setQuestions(e.target.value)}
                      placeholder="Nhập các câu hỏi sẽ đặt cho sinh viên trong buổi bảo vệ..."
                      className="w-full px-4 py-3 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-outline mb-2">Nhận xét chung</label>
                    <textarea
                      rows={3} value={comments} disabled={existingScore?.isSubmitted}
                      onChange={e => setComments(e.target.value)}
                      placeholder="Nhận xét tổng quan về bài làm..."
                      className="w-full px-4 py-3 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => void handleSaveDraft()} disabled={isSaving || existingScore?.isSubmitted}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-outline-variant/20 text-sm font-semibold text-on-surface hover:bg-surface-container transition-all disabled:opacity-60"
                  >
                    <Save className="w-4 h-4" />{isSaving ? "Đang lưu..." : "Lưu nháp"}
                  </button>
                  <button
                    onClick={() => void handleSubmit()} disabled={isSubmitting || existingScore?.isSubmitted}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-60"
                  >
                    <FileCheck className="w-4 h-4" />{isSubmitting ? "Đang nộp..." : existingScore?.isSubmitted ? "Đã nộp" : "Nộp phiếu phản biện"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
