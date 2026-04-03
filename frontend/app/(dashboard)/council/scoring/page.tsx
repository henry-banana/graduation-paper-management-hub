"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Calculator, CheckCircle2, FileCheck, Save, Search, Sliders, User, AlertCircle } from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface TopicDto {
  id: string;
  title: string;
  type: "BCTT" | "KLTN";
  state: string;
  student?: { id: string; fullName: string; studentId?: string };
  period?: { id: string; code: string };
}

interface ScoreDto {
  criteria: Record<string, number>;
  comments?: string;
  isSubmitted?: boolean;
  role?: string;
}

/* ---------- Rubrics by role ---------- */
const RUBRIC_COUNCIL = [
  { id: "presentation", label: "1. Hình thức & trình bày", max: 2.0, desc: "Chất lượng báo cáo thành văn." },
  { id: "content", label: "2. Nội dung chuyên môn", max: 5.0, desc: "Độ sâu kỹ thuật, tính đúng đắn, khả năng tổng hợp." },
  { id: "defense", label: "3. Khả năng bảo vệ", max: 3.0, desc: "Trả lời câu hỏi Hội đồng và GVPB." },
];

function CouncilScoringContent() {
  const params = useSearchParams();
  const topicIdParam = params.get("topicId");

  const [topics, setTopics] = useState<TopicDto[]>([]);
  const [selectedId, setSelectedId] = useState(topicIdParam ?? "");
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [isLoadingScore, setIsLoadingScore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [existingScore, setExistingScore] = useState<ScoreDto | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const totalScore = useMemo(() => RUBRIC_COUNCIL.reduce((s, c) => s + (scores[c.id] ?? 0), 0), [scores]);
  const maxScore = RUBRIC_COUNCIL.reduce((s, c) => s + c.max, 0);
  const isPassed = totalScore >= 5.0;

  const selectedTopic = useMemo(() => topics.find(t => t.id === selectedId) ?? null, [topics, selectedId]);

  const filtered = useMemo(() =>
    topics.filter(t =>
      t.student?.fullName.toLowerCase().includes(search.toLowerCase()) ||
      t.title.toLowerCase().includes(search.toLowerCase()),
    ), [topics, search]);

  // Load topics assigned to council role
  useEffect(() => {
    void (async () => {
      setIsLoadingTopics(true);
      try {
        const res = await api.get<ApiListResponse<TopicDto>>("/topics?role=council&page=1&size=100&state=GRADING");
        setTopics(res.data ?? []);
        if (!selectedId && res.data[0]) setSelectedId(res.data[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không thể tải danh sách đề tài.");
      } finally {
        setIsLoadingTopics(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only run once on mount, selectedId used only for default selection
  }, []);

  // Load score draft when topic changes
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
      } catch {
        const defaults: Record<string, number> = {};
        RUBRIC_COUNCIL.forEach(c => { defaults[c.id] = 0; });
        setScores(defaults);
        setComments("");
      } finally {
        setIsLoadingScore(false);
      }
    })();
  }, [selectedId]);

  const handleSaveDraft = async () => {
    if (!selectedId) return;
    setIsSaving(true);
    setError(null);
    try {
      await api.post<ApiResponse<unknown>>(`/topics/${selectedId}/scores/draft-direct`, {
        criteria: scores, comments, role: "TV_HD",
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
        criteria: scores, comments, role: "TV_HD",
      });
      setSuccess("Đã nộp điểm Hội đồng thành công!");
      setExistingScore(prev => ({ criteria: (prev?.criteria ?? {}), ...(prev ?? {}), isSubmitted: true } as ScoreDto));
      setTimeout(() => setSuccess(null), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nộp điểm thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">Đánh giá Hội đồng (TV_HĐ / CT_HĐ)</h1>
        <p className="text-sm text-outline mt-1">Chọn đề tài và nhập phiếu điểm thành viên hội đồng.</p>
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

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Topic list */}
        <div className="lg:col-span-1">
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden">
            <div className="p-4 border-b border-outline-variant/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  type="text"
                  placeholder="Tìm đề tài..."
                  className="w-full pl-10 pr-4 py-2 bg-surface-container rounded-xl border border-outline-variant/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </div>
            <div className="divide-y divide-outline-variant/10 overflow-y-auto max-h-[60vh]">
              {isLoadingTopics ? (
                <div className="p-6 text-center text-sm text-outline">Đang tải...</div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-outline">Không có đề tài nào.</div>
              ) : filtered.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors ${
                    selectedId === t.id ? "bg-primary/5 border-l-2 border-primary" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.type === "KLTN" ? "bg-purple-100 text-purple-700" : "bg-primary/10 text-primary"}`}>
                      {t.type}
                    </span>
                    {t.student && <span className="text-xs text-outline">{t.student.fullName}</span>}
                  </div>
                  <p className="text-xs font-medium text-on-surface line-clamp-2">{t.title}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Scoring form */}
        <div className="lg:col-span-2">
          {!selectedId ? (
            <div className="flex items-center justify-center h-64 text-outline text-sm">Chọn đề tài để nhập điểm</div>
          ) : isLoadingScore ? (
            <div className="flex items-center justify-center h-64 text-outline text-sm">Đang tải phiếu điểm...</div>
          ) : (
            <div className="space-y-5">
              {selectedTopic && (
                <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4 flex items-center gap-3">
                  <User className="w-5 h-5 text-outline" />
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{selectedTopic.student?.fullName} <span className="text-outline font-normal">({selectedTopic.student?.studentId})</span></p>
                    <p className="text-xs text-outline line-clamp-1">{selectedTopic.title}</p>
                  </div>
                </div>
              )}

              {existingScore?.isSubmitted && (
                <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3">
                  <FileCheck className="w-4 h-4 text-primary" />
                  <p className="text-sm text-primary font-medium">Đã nộp phiếu điểm Hội đồng chính thức.</p>
                </div>
              )}

              {/* Rubric */}
              <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container/50 flex items-center gap-3">
                  <Sliders className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-on-surface font-headline">Tiêu chí chấm điểm</h3>
                  <div className="ml-auto flex items-center gap-2">
                    <span className={`text-lg font-black font-headline ${isPassed ? "text-primary" : "text-error"}`}>{totalScore.toFixed(2)}</span>
                    <span className="text-xs text-outline">/ {maxScore}</span>
                  </div>
                </div>
                <div className="divide-y divide-outline-variant/10">
                  {RUBRIC_COUNCIL.map(c => {
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

              {/* Comments */}
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5">
                <label className="block text-xs font-semibold uppercase text-outline mb-2">Nhận xét</label>
                <textarea
                  rows={3} value={comments} disabled={existingScore?.isSubmitted}
                  onChange={e => setComments(e.target.value)}
                  placeholder="Nhận xét tổng quan..."
                  className="w-full px-4 py-3 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none disabled:opacity-60"
                />
              </div>

              {/* Actions */}
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
                  <Calculator className="w-4 h-4" />{isSubmitting ? "Đang nộp..." : existingScore?.isSubmitted ? "Đã nộp" : "Nộp phiếu Hội đồng"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        title="Nộp phiếu điểm Hội đồng?"
        message="Sau khi nộp chính thức, điểm sẽ bị khóa và không thể chỉnh sửa. Bạn chắc chắn muốn tiếp tục?"
        confirmLabel="Xác nhận nộp"
        variant="warning"
        isLoading={isSubmitting}
        onConfirm={() => void handleSubmit()}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}

export default function CouncilScoringPage() {
  return (
    <CouncilScoringContent />
  );
}
