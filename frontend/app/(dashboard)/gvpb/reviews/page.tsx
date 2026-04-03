"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, FileCheck, MessageSquare, RefreshCw, Save, Search, Sliders, User, AlertCircle, ChevronRight } from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

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
  const [showConfirm, setShowConfirm] = useState(false);

  const totalScore = useMemo(() => RUBRIC_GVPB.reduce((s, c) => s + (scores[c.id] ?? 0), 0), [scores]);
  const maxScore = RUBRIC_GVPB.reduce((s, c) => s + c.max, 0);
  const isPassed = totalScore >= 5.0;

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<TopicDto>>("/topics?role=gvpb&page=1&size=100");
      const assignable = res.data.filter(t => ["SUBMITTED", "GRADING", "COMPLETED"].includes(t.state));
      setTopics(assignable);
      if (assignable[0] && !selectedId) setSelectedId(assignable[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải danh sách đề tài.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

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
    setShowConfirm(false);
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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">Phản biện & Chấm điểm (GVPB)</h1>
        <p className="text-sm text-outline mt-1">Nhập phiếu phản biện và câu hỏi cho sinh viên bảo vệ.</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-error mt-0.5 flex-shrink-0" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />{success}
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left: Topic list */}
        <div className="lg:col-span-2">
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden">
            <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-on-surface">Đề tài được phân công</h2>
              <button onClick={() => void load()} aria-label="Làm mới" className="p-1.5 rounded-lg hover:bg-surface-container text-outline transition-colors">
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
            <div className="p-3 border-b border-outline-variant/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  type="text"
                  placeholder="Tìm đề tài..."
                  className="w-full pl-10 pr-4 py-2 bg-surface-container rounded-xl border border-outline-variant/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <div className="divide-y divide-outline-variant/10 overflow-y-auto max-h-[60vh]">
              {isLoading ? (
                <div className="p-6 text-center text-sm text-outline">Đang tải...</div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-outline">Không có đề tài nào.</div>
              ) : filtered.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left px-4 py-3.5 hover:bg-surface-container-low transition-colors group ${
                    selectedId === t.id ? "bg-primary/5 border-l-2 border-primary" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.type === "KLTN" ? "bg-purple-100 text-purple-700" : "bg-primary/10 text-primary"}`}>
                      {t.type}
                    </span>
                    <span className="text-xs text-outline">{t.student?.fullName}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-outline ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs font-medium text-on-surface line-clamp-2">{t.title}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Scoring form */}
        <div className="lg:col-span-3">
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
                  onClick={() => setShowConfirm(true)} disabled={isSubmitting || existingScore?.isSubmitted}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-60"
                >
                  <FileCheck className="w-4 h-4" />{isSubmitting ? "Đang nộp..." : existingScore?.isSubmitted ? "Đã nộp" : "Nộp phiếu phản biện"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        title="Nộp phiếu phản biện chính thức?"
        message="Sau khi nộp chính thức, điểm phản biện sẽ bị khóa và không thể chỉnh sửa. Bạn chắc chắn muốn tiếp tục?"
        confirmLabel="Xác nhận nộp"
        variant="warning"
        isLoading={isSubmitting}
        onConfirm={() => void handleSubmit()}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
