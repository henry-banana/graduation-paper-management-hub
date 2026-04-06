"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, BookOpen, CheckCircle2,
  FileCheck, RefreshCw, Save, Sliders, User,
} from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";
import { TopicStateGuide } from "@/components/shared/topic-state-guide";
import type { CouncilTopicListItem } from "@/types";

/* ---------- Types ---------- */
type TopicDto = CouncilTopicListItem;

interface ScoreDto {
  criteria: Record<string, number>;
  comments?: string;
  isSubmitted?: boolean;
  role?: string;
  isLocked?: boolean;
  lockReason?: string;
}

interface SubmissionDto {
  id: string;
  fileType: "REPORT" | "TURNITIN" | "REVISION" | "REVISION_EXPLANATION" | "INTERNSHIP_CONFIRMATION" | string;
  version: number;
  uploadedAt?: string;
  originalFileName?: string;
  driveLink?: string;
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
  const [existingScore, setExistingScore] = useState<ScoreDto | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionDto[]>([]);
  
  // TK_HD council comments
  const [councilComments, setCouncilComments] = useState("");
  const [isSavingCouncilComments, setIsSavingCouncilComments] = useState(false);

  const totalScore = useMemo(() => RUBRIC_COUNCIL.reduce((s, c) => s + (scores[c.id] ?? 0), 0), [scores]);
  const maxScore = RUBRIC_COUNCIL.reduce((s, c) => s + c.max, 0);
  const isPassed = totalScore >= 5.0;
  
  // Lock mechanism consistent with GVHD page
  const isSubmitted = existingScore?.isSubmitted ?? false;
  const isScoreLocked = isSubmitted && (existingScore?.isLocked ?? true);

  const submittedLockMessage = useMemo(() => {
    if (!isSubmitted) return "";
    if (!isScoreLocked) {
      return "Phiếu điểm đã được nộp chính thức nhưng vẫn có thể chỉnh sửa trước xác nhận cuối. Hãy dùng nút 'Cập nhật điểm đã nộp' để lưu thay đổi.";
    }
    if (existingScore?.lockReason?.includes("published")) {
      return "Phiếu điểm đã bị khóa vì điểm đã được công bố.";
    }
    if (existingScore?.lockReason?.includes("confirmed")) {
      return "Phiếu điểm đã bị khóa vì đã có xác nhận cuối.";
    }
    return "Phiếu điểm đã được nộp chính thức và hiện không thể chỉnh sửa.";
  }, [existingScore?.lockReason, isScoreLocked, isSubmitted]);

  const selectedTopic = useMemo(() => topics.find(t => t.id === selectedId) ?? null, [topics, selectedId]);
  const canSubmitScores = selectedTopic?.state === "SCORING" || selectedTopic?.state === "DEFENSE";
  const canSaveDraft = selectedTopic?.state === "SCORING";
  const isDefensePhase = selectedTopic?.state === "DEFENSE";
  const latestReportSubmission = useMemo(
    () =>
      submissions
        .filter((s) => s.fileType === "REPORT")
        .sort((a, b) => b.version - a.version)[0],
    [submissions],
  );
  const latestTurnitinSubmission = useMemo(
    () =>
      submissions
        .filter((s) => s.fileType === "TURNITIN")
        .sort((a, b) => b.version - a.version)[0],
    [submissions],
  );

  // Load topics assigned to council role
  useEffect(() => {
    void (async () => {
      setIsLoadingTopics(true);
      try {
        const [tvRes, ctRes, tkRes] = await Promise.all([
          api
            .get<ApiListResponse<TopicDto>>(
              "/topics?role=tv_hd&page=1&size=100&states=DEFENSE,SCORING",
            )
            .catch(() => ({ data: [], pagination: { page: 1, size: 0, total: 0 } })),
          api
            .get<ApiListResponse<TopicDto>>(
              "/topics?role=ct_hd&page=1&size=100&states=DEFENSE,SCORING",
            )
            .catch(() => ({ data: [], pagination: { page: 1, size: 0, total: 0 } })),
          api
            .get<ApiListResponse<TopicDto>>(
              "/topics?role=tk_hd&page=1&size=100&states=DEFENSE,SCORING",
            )
            .catch(() => ({ data: [], pagination: { page: 1, size: 0, total: 0 } })),
        ]);

        const mergedById = new Map<string, TopicDto>();
        [...(ctRes.data ?? []), ...(tkRes.data ?? []), ...(tvRes.data ?? [])].forEach((topic) => {
          if (!mergedById.has(topic.id)) {
            mergedById.set(topic.id, topic);
          }
        });

        const mergedTopics = Array.from(mergedById.values());
        setTopics(mergedTopics);
        setSelectedId((current) => current || mergedTopics[0]?.id || "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không thể tải danh sách đề tài.");
      } finally {
        setIsLoadingTopics(false);
      }
    })();
  }, []);

  // Load score draft when topic changes
  useEffect(() => {
    if (!selectedId) return;
    setExistingScore(null);
    setSubmissions([]);
    setIsLoadingScore(true);
    void (async () => {
      try {
        const [scoreRes, submissionsRes] = await Promise.all([
          api
            .get<ApiResponse<ScoreDto>>(`/topics/${selectedId}/scores/my-draft`)
            .catch(() => null),
          api
            .get<ApiListResponse<SubmissionDto>>(`/topics/${selectedId}/submissions`)
            .catch(() => ({ data: [], pagination: { page: 1, size: 0, total: 0 } })),
        ]);

        if (scoreRes?.data) {
          const s = scoreRes.data;
          setExistingScore(s);
          setScores(s.criteria ?? {});
          setComments(s.comments ?? "");
        } else {
          const defaults: Record<string, number> = {};
          RUBRIC_COUNCIL.forEach(c => { defaults[c.id] = 0; });
          setScores(defaults);
          setComments("");
        }

        setSubmissions(submissionsRes.data ?? []);
      } catch {
        const defaults: Record<string, number> = {};
        RUBRIC_COUNCIL.forEach(c => { defaults[c.id] = 0; });
        setScores(defaults);
        setComments("");
        setSubmissions([]);
      } finally {
        setIsLoadingScore(false);
      }
    })();
  }, [selectedId]);

  // Load council comments for TK_HD
  useEffect(() => {
    if (!selectedId || !selectedTopic || selectedTopic.councilRole !== "TK_HD") {
      setCouncilComments("");
      return;
    }
    void (async () => {
      try {
        const res = await api.get<ApiResponse<{ councilComments: string | null }>>(`/topics/${selectedId}/scores/council-comments`);
        setCouncilComments(res.data?.councilComments ?? "");
      } catch {
        setCouncilComments("");
      }
    })();
  }, [selectedId, selectedTopic]);

  const handleSaveDraft = async () => {
    if (!selectedId) return;
    if (!canSaveDraft) {
      setError("Đề tài đang ở DEFENSE. Hãy nộp điểm chính thức để hệ thống tự chuyển sang SCORING.");
      return;
    }
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

  const handleSaveCouncilComments = async () => {
    if (!selectedId) return;
    setIsSavingCouncilComments(true);
    setError(null);
    try {
      await api.patch<ApiResponse<unknown>>(`/topics/${selectedId}/scores/council-comments`, {
        councilComments,
      });
      setSuccess("Đã lưu góp ý hội đồng.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lưu góp ý thất bại.");
    } finally {
      setIsSavingCouncilComments(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedId) return;
    if (!canSubmitScores) {
      setError("Đề tài chưa ở giai đoạn chấm điểm.");
      return;
    }
    if (!window.confirm("Sau khi nộp chính thức, điểm sẽ không thể chỉnh sửa. Xác nhận?")) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post<ApiResponse<unknown>>(`/topics/${selectedId}/scores/submit-direct`, {
        criteria: scores, comments, role: "TV_HD",
      });
      setSuccess("Đã nộp điểm Hội đồng thành công!");
      setTopics((prev) =>
        prev.map((topic) =>
          topic.id === selectedId ? { ...topic, state: "SCORING" } : topic,
        ),
      );
      setExistingScore(prev => ({ criteria: (prev?.criteria ?? {}), ...(prev ?? {}), isSubmitted: true } as ScoreDto));
      setTimeout(() => setSuccess(null), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nộp điểm thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <Link href="/council/summary" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-outline-variant/20 text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />Tổng hợp điểm
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">Chấm điểm Hội đồng</h1>
          {selectedTopic && (
            <div className="flex items-center flex-wrap gap-3 mt-2 text-sm text-outline">
              <User className="w-4 h-4" />
              <span>{selectedTopic.student?.fullName ?? "—"}</span>
              <span>·</span>
              <span>{selectedTopic.student?.studentId ?? ""}</span>
              {selectedTopic.period && (
                <><span>·</span><BookOpen className="w-4 h-4" /><span>{selectedTopic.period.code}</span></>
              )}
              {selectedTopic.councilRole && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                  Vai trò: {selectedTopic.councilRole === "CT_HD" ? "Chủ tịch" : selectedTopic.councilRole === "TK_HD" ? "Thư ký" : "Thành viên"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Topic selector */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4">
        <label className="block text-xs font-semibold text-outline mb-2 uppercase tracking-wider">Chọn đề tài để chấm điểm</label>
        {isLoadingTopics ? (
          <div className="flex items-center gap-2 text-outline text-sm"><RefreshCw className="w-4 h-4 animate-spin" />Đang tải...</div>
        ) : topics.length === 0 ? (
          <p className="text-sm text-outline">Không có đề tài nào cần chấm.</p>
        ) : (
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="w-full px-4 py-3 bg-surface-container rounded-xl border border-outline-variant/20 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {topics.map(t => (
              <option key={t.id} value={t.id}>
                [{t.type}] {t.student?.fullName} — {t.title.slice(0, 60)}{t.title.length > 60 ? "…" : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-error" /><p className="text-sm text-error">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-green-600" /><p className="text-sm text-green-700">{success}</p>
        </div>
      )}
      {selectedTopic && (
        <TopicStateGuide role="COUNCIL" topicType={selectedTopic.type} topicState={selectedTopic.state} />
      )}
      {existingScore?.isSubmitted && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3">
          <FileCheck className="w-4 h-4 text-primary" />
          <p className="text-sm text-primary font-medium">Điểm Hội đồng đã nộp chính thức. Không thể chỉnh sửa.</p>
        </div>
      )}
      {isDefensePhase && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <p className="text-sm text-amber-700">
            Đề tài đang ở trạng thái DEFENSE. Khi thành viên hội đồng nộp điểm đầu tiên, hệ thống sẽ tự động chuyển sang SCORING.
          </p>
        </div>
      )}

      {/* View submissions */}
      {(latestReportSubmission || latestTurnitinSubmission) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {latestReportSubmission?.driveLink ? (
            <a
              href={latestReportSubmission.driveLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Báo cáo SV (v{latestReportSubmission.version})
            </a>
          ) : (
            <div className="px-4 py-2.5 rounded-xl border border-outline-variant/20 text-xs text-outline bg-surface-container-lowest">
              Chưa có file báo cáo SV.
            </div>
          )}

          {latestTurnitinSubmission?.driveLink ? (
            <a
              href={latestTurnitinSubmission.driveLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-100 text-amber-800 text-sm font-semibold hover:bg-amber-200 transition-colors"
            >
              <FileCheck className="w-4 h-4" />
              File Turnitin (v{latestTurnitinSubmission.version})
            </a>
          ) : (
            <div className="px-4 py-2.5 rounded-xl border border-amber-200 text-xs text-amber-700 bg-amber-50">
              Chưa có file Turnitin từ GVHD.
            </div>
          )}
        </div>
      )}

      {selectedId && !isLoadingScore && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Rubric */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container/50 flex items-center gap-3">
                <Sliders className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-on-surface font-headline">Tiêu chí chấm Hội đồng</h3>
                <span className="ml-auto text-xs text-outline">Tổng: {maxScore} điểm</span>
              </div>
              <div className="divide-y divide-outline-variant/10">
                {RUBRIC_COUNCIL.map(c => {
                  const current = scores[c.id] ?? 0;
                  const pct = (current / c.max) * 100;
                  return (
                    <div key={c.id} className="p-6 hover:bg-surface-container-low/50 transition-colors">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <label className="text-sm font-semibold text-on-surface flex-1">
                          {c.label}<span className="ml-2 text-xs text-outline font-normal">(Tối đa {c.max})</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input type="number" max={c.max} min={0} step={0.25} value={current}
                            disabled={isScoreLocked || !canSubmitScores}
                            onChange={e => setScores(prev => ({ ...prev, [c.id]: Math.min(c.max, Math.max(0, parseFloat(e.target.value) || 0)) }))}
                            className="w-20 text-right rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm font-bold px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                          />
                          <span className="text-sm text-outline">/ {c.max}</span>
                        </div>
                      </div>
                      <p className="text-xs text-outline mb-3">{c.desc}</p>
                      <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-300 ${pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-error"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Comments */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5">
              <label className="block text-xs font-semibold uppercase text-outline mb-2">Nhận xét của Hội đồng</label>
              <textarea rows={4} value={comments} disabled={existingScore?.isSubmitted || existingScore?.isLocked || !canSubmitScores}
                onChange={e => setComments(e.target.value)}
                placeholder="Nhận xét về chất lượng đề tài, ưu & hạn chế..."
                className="w-full px-4 py-3 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none disabled:opacity-60"
              />
            </div>

            {/* TK_HD Council Comments - Chỉ hiển thị cho Thư ký */}
            {selectedTopic?.councilRole === "TK_HD" && (
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-200/50 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">Thư ký HĐ</span>
                  <h4 className="text-sm font-semibold text-purple-900">Góp ý bổ sung của Hội đồng</h4>
                </div>
                <p className="text-xs text-purple-600 mb-3">
                  Nhập các góp ý tổng hợp từ phiên bảo vệ để đưa vào Biên bản hội đồng. 
                  Thông tin này sẽ hiển thị trong biên bản cùng với câu hỏi của GVPB.
                </p>
                <textarea 
                  rows={5} 
                  value={councilComments}
                  onChange={e => setCouncilComments(e.target.value)}
                  placeholder="VD: Hội đồng đề nghị SV bổ sung phần đánh giá hiệu năng, cập nhật tài liệu tham khảo mới hơn..."
                  className="w-full px-4 py-3 bg-white rounded-xl border border-purple-200 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                />
                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => void handleSaveCouncilComments()}
                    disabled={isSavingCouncilComments}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-60"
                  >
                    <Save className="w-4 h-4" />
                    {isSavingCouncilComments ? "Đang lưu..." : "Lưu góp ý HĐ"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Score panel */}
          <div className="lg:col-span-1">
            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden shadow-sm sticky top-24">
              <div className="p-6 border-b border-outline-variant/10 flex flex-col items-center">
                <div className="relative w-28 h-28 mb-4">
                  <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-container" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5"
                      strokeDasharray={`${(totalScore / maxScore) * 100} ${100 - (totalScore / maxScore) * 100}`}
                      strokeLinecap="round"
                      className={`transition-all duration-500 ${isPassed ? "text-primary" : "text-error"}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-black font-headline ${isPassed ? "text-primary" : "text-error"}`}>{totalScore.toFixed(2)}</span>
                    <span className="text-xs text-outline">/ {maxScore}</span>
                  </div>
                </div>
                <div className={`flex items-center gap-2 text-sm font-semibold ${isPassed ? "text-green-600" : "text-error"}`}>
                  <CheckCircle2 className="w-4 h-4" />
                  {isPassed ? "Đạt yêu cầu (≥ 5.0)" : "Chưa đạt (< 5.0)"}
                </div>
              </div>
              <div className="p-5 space-y-3 border-b border-outline-variant/10">
                {RUBRIC_COUNCIL.map(c => (
                  <div key={c.id} className="flex justify-between items-center text-sm">
                    <span className="text-outline text-xs truncate max-w-[140px]">{c.label.replace(/^\d+\.\s/, "")}</span>
                    <span className="font-bold text-on-surface">{(scores[c.id] ?? 0).toFixed(2)}<span className="text-outline font-normal">/{c.max}</span></span>
                  </div>
                ))}
              </div>
              <div className="p-5 flex flex-col gap-3">
                {submittedLockMessage && (
                  <div className={`text-xs ${isScoreLocked ? "text-error" : "text-amber-600"} bg-surface-container p-3 rounded-xl border ${isScoreLocked ? "border-error/20" : "border-amber-600/20"}`}>
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    {submittedLockMessage}
                  </div>
                )}
                <button onClick={() => void handleSaveDraft()} disabled={isSaving || isScoreLocked || !canSaveDraft}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant/20 text-sm font-semibold text-on-surface hover:bg-surface-container transition-all disabled:opacity-60">
                  <Save className="w-4 h-4" />{isSaving ? "Đang lưu..." : "Lưu nháp"}
                </button>
                <button onClick={() => void handleSubmit()} disabled={isSubmitting || isScoreLocked || !canSubmitScores}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-60">
                  <FileCheck className="w-4 h-4" />{isSubmitting ? "Đang nộp..." : existingScore?.isSubmitted ? "Đã nộp" : "Nộp điểm chính thức"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CouncilScoringPage() {
  return (
    <Suspense fallback={<div className="flex items-center gap-3 py-20 justify-center"><RefreshCw className="w-6 h-6 animate-spin text-outline" /></div>}>
      <CouncilScoringContent />
    </Suspense>
  );
}
