"use client";

<<<<<<< HEAD
import { useEffect, useMemo, useRef, useState } from "react";
=======
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
>>>>>>> 804651cf5f35edc134525edcc188c1ba1812cf7c
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, BookOpen, CheckCircle2, FileCheck, RefreshCw,
  Save, Sliders, Upload, User, AlertCircle,
} from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";
<<<<<<< HEAD
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

=======

/* ---------- Types ---------- */
>>>>>>> 804651cf5f35edc134525edcc188c1ba1812cf7c
interface TopicDto {
  id: string;
  title: string;
  type: "BCTT" | "KLTN";
  state: string;
  student?: { id: string; fullName: string; studentId?: string };
<<<<<<< HEAD
  latestSubmission?: { driveLink?: string; version: number };
}

interface ScoreDto {
  criteria: Record<string, number>;
  turnitinLink?: string;
  comments?: string;
  isSubmitted?: boolean;
}

const RUBRIC_BCTT = [
  { id: "c1", label: "1. Thái độ và kỷ luật", max: 2.0, description: "Đánh giá tính chủ động, tuân thủ lịch làm việc và nội quy." },
  { id: "c2", label: "2. Hình thức trình bày báo cáo", max: 2.0, description: "Đánh giá cấu trúc, lỗi chính tả, văn phong học thuật." },
  { id: "c3", label: "3. Nội dung chuyên môn", max: 6.0, description: "Đánh giá hàm lượng chuyên môn, khả năng giải quyết vấn đề, tính ứng dụng." },
];

const RUBRIC_KLTN = [
  { id: "k1", label: "1. Thái độ và kỷ luật", max: 1.0, description: "Tính chủ động, nghiêm túc trong quá trình thực hiện KLTN." },
  { id: "k2", label: "2. Hình thức quyển báo cáo", max: 1.5, description: "Cấu trúc, định dạng, trình bày và quy chuẩn học thuật." },
  { id: "k3", label: "3. Nội dung chuyên môn", max: 5.5, description: "Độ sâu kiến thức, tính khoa học, kết quả đạt được." },
  { id: "k4", label: "4. Chạy thử và trình bày", max: 2.0, description: "Khả năng demo hệ thống và trình bày trước Hội đồng." },
=======
  period?: { id: string; code: string };
  latestSubmission?: { id: string; driveLink?: string; version: number };
}

interface ScoreDraft {
  criteria: Record<string, number>;
  turnitinLink?: string;
  comments?: string;
}

interface ScoreDto {
  id?: string;
  criteria: Record<string, number>;
  turnitinLink?: string;
  comments?: string;
  submittedAt?: string;
  isSubmitted?: boolean;
}

/* ---------- Rubric definitions ---------- */
const RUBRIC_BCTT = [
  { id: "attitude", label: "1. Thái độ & kỷ luật", max: 2.0, desc: "Chủ động, tuân thủ lịch, nội quy." },
  { id: "presentation", label: "2. Hình thức trình bày", max: 2.0, desc: "Cấu trúc, lỗi chính tả, văn phong học thuật." },
  { id: "content", label: "3. Nội dung chuyên môn", max: 6.0, desc: "Hàm lượng chuyên môn, giải quyết vấn đề, tính ứng dụng." },
];
const RUBRIC_KLTN = [
  { id: "attitude", label: "1. Thái độ & kỷ luật", max: 1.0, desc: "Chủ động, tuân thủ lịch, nội quy." },
  { id: "presentation", label: "2. Hình thức trình bày", max: 1.0, desc: "Cấu trúc, lỗi chính tả." },
  { id: "content", label: "3. Nội dung chuyên môn", max: 5.0, desc: "Hàm lượng chuyên môn." },
  { id: "innovation", label: "4. Tính sáng tạo & ứng dụng", max: 2.0, desc: "Tính mới, tiềm năng ứng dụng." },
  { id: "defense", label: "5. Trả lời vấn đáp", max: 1.0, desc: "Khả năng bảo vệ đề tài." },
>>>>>>> 804651cf5f35edc134525edcc188c1ba1812cf7c
];

function GVHDScoringContent() {
  const params = useSearchParams();
  const topicId = params.get("topicId");

  const [topics, setTopics] = useState<TopicDto[]>([]);
  const [selectedId, setSelectedId] = useState(topicId ?? "");
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [isLoadingScore, setIsLoadingScore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingScore, setExistingScore] = useState<ScoreDto | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [turnitinLink, setTurnitinLink] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
<<<<<<< HEAD
  const [showConfirm, setShowConfirm] = useState(false);
=======
>>>>>>> 804651cf5f35edc134525edcc188c1ba1812cf7c
  const turnitinRef = useRef<HTMLInputElement>(null);

  const selectedTopic = useMemo(() => topics.find(t => t.id === selectedId) ?? null, [topics, selectedId]);
  const rubric = selectedTopic?.type === "KLTN" ? RUBRIC_KLTN : RUBRIC_BCTT;
  const totalScore = useMemo(() => rubric.reduce((s, c) => s + (scores[c.id] ?? 0), 0), [scores, rubric]);
  const maxScore = useMemo(() => rubric.reduce((s, c) => s + c.max, 0), [rubric]);
  const isPassed = totalScore >= 5.0;

  // Load supervised topics
  useEffect(() => {
    void (async () => {
      setIsLoadingTopics(true);
      try {
        const res = await api.get<ApiListResponse<TopicDto>>("/topics?role=gvhd&page=1&size=100");
        const scoreable = res.data.filter(t => ["SUBMITTED", "GRADING", "COMPLETED"].includes(t.state));
        setTopics(scoreable);
        if (!selectedId && scoreable[0]) setSelectedId(scoreable[0].id);
      } catch {
        setError("Không thể tải danh sách đề tài.");
      } finally {
        setIsLoadingTopics(false);
      }
    })();
<<<<<<< HEAD
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only run once on mount
=======
>>>>>>> 804651cf5f35edc134525edcc188c1ba1812cf7c
  }, []);

  // Load draft/score when topic changes
  useEffect(() => {
    if (!selectedId) return;
    setExistingScore(null);
    setIsLoadingScore(true);
    setError(null);
    void (async () => {
      try {
        const res = await api.get<ApiResponse<ScoreDto>>(`/topics/${selectedId}/scores/my-draft`);
        const s = res.data;
        setExistingScore(s);
        setScores(s.criteria ?? {});
        setTurnitinLink(s.turnitinLink ?? "");
        setComments(s.comments ?? "");
      } catch {
        // No draft yet — init defaults
        const defaults: Record<string, number> = {};
        const r = topics.find(t => t.id === selectedId);
        const rb = r?.type === "KLTN" ? RUBRIC_KLTN : RUBRIC_BCTT;
        rb.forEach(c => { defaults[c.id] = 0; });
        setScores(defaults);
        setTurnitinLink("");
        setComments("");
      } finally {
        setIsLoadingScore(false);
      }
    })();
  }, [selectedId, topics]);

  const handleSaveDraft = async () => {
    if (!selectedId) return;
    setIsSaving(true);
    setError(null);
    try {
      const role = selectedTopic?.type === "KLTN" ? "GVHD" : "GVHD";
      await api.post<ApiResponse<unknown>>(`/topics/${selectedId}/scores/draft-direct`, {
        criteria: scores,
        turnitinLink,
        comments,
        role,
      });
      setSuccess("Đã lưu nháp thành công.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lưu nháp thất bại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedId) return;
<<<<<<< HEAD
    setShowConfirm(false);
=======
    if (!window.confirm("Sau khi nộp chính thức, điểm sẽ không thể chỉnh sửa. Xác nhận?")) return;
>>>>>>> 804651cf5f35edc134525edcc188c1ba1812cf7c
    setIsSubmitting(true);
    setError(null);
    try {
      const role = selectedTopic?.type === "KLTN" ? "GVHD" : "GVHD";
      await api.post<ApiResponse<unknown>>(`/topics/${selectedId}/scores/submit-direct`, {
        criteria: scores,
        turnitinLink,
        comments,
        role,
      });
      setSuccess("Đã nộp phiếu điểm chính thức thành công!");
      setExistingScore({ criteria: existingScore?.criteria ?? {}, ...existingScore, isSubmitted: true } as ScoreDto);
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
<<<<<<< HEAD
            <Link
              href="/gvhd/topics"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-outline-variant/20 text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Quay lại
            </Link>
            {selectedTopic && (
              <span className="text-xs text-outline px-3 py-1.5 bg-primary/10 rounded-full font-medium">{selectedTopic.type}-{selectedTopic.student?.studentId ?? "?"}</span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">
            Phiếu chấm điểm Rubric (GVHD)
=======
            <Link href="/gvhd/topics" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-outline-variant/20 text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Danh sách đề tài
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">
            Phiếu chấm điểm (GVHD)
>>>>>>> 804651cf5f35edc134525edcc188c1ba1812cf7c
          </h1>
          {selectedTopic && (
            <div className="flex items-center gap-3 mt-2 text-sm text-outline">
              <User className="w-4 h-4" />
<<<<<<< HEAD
              <span>{selectedTopic.student?.fullName}</span>
              <span>·</span>
              <span>MSSV: {selectedTopic.student?.studentId}</span>
            </div>
          )}
        </div>
        {selectedTopic && (
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-xl border border-outline-variant/10 text-sm text-on-surface-variant">
            <BookOpen className="w-4 h-4" />
            {selectedTopic.type}
          </div>
        )}
      </div>

      {/* Topic selector if no topicId in params */}
      {!topicId && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4">
          <label className="block text-xs font-semibold uppercase text-outline mb-2">Chọn đề tài</label>
          {isLoadingTopics ? (
            <div className="flex items-center gap-2 text-sm text-outline"><RefreshCw className="w-4 h-4 animate-spin" />Đang tải...</div>
          ) : (
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:border-primary"
            >
              <option value="">-- Chọn đề tài --</option>
              {topics.map(t => (
                <option key={t.id} value={t.id}>[{t.type}] {t.student?.fullName} — {t.title.slice(0, 60)}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Drive link + reports */}
      {selectedTopic?.latestSubmission?.driveLink && (
        <a href={selectedTopic.latestSubmission.driveLink} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 text-sm text-primary font-semibold hover:underline">
          <Upload className="w-4 h-4" />Xem bài nộp SV (v{selectedTopic.latestSubmission.version})
        </a>
      )}

      {error && (
        <div className="flex items-start gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-error mt-0.5 flex-shrink-0" />
=======
              <span>{selectedTopic.student?.fullName ?? "—"}</span>
              <span>·</span>
              <span>{selectedTopic.student?.studentId ?? ""}</span>
              {selectedTopic.period && (
                <>
                  <span>·</span>
                  <BookOpen className="w-4 h-4" />
                  <span>{selectedTopic.period.code}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Topic selector */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4">
        <label className="block text-xs font-semibold text-outline mb-2 uppercase tracking-wider">Chọn đề tài để chấm điểm</label>
        {isLoadingTopics ? (
          <div className="flex items-center gap-2 text-outline text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" />Đang tải...
          </div>
        ) : topics.length === 0 ? (
          <p className="text-sm text-outline">Không có đề tài nào đủ điều kiện chấm điểm.</p>
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
          <AlertCircle className="w-4 h-4 text-error" />
>>>>>>> 804651cf5f35edc134525edcc188c1ba1812cf7c
          <p className="text-sm text-error">{error}</p>
        </div>
      )}
      {success && (
<<<<<<< HEAD
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />{success}
        </div>
      )}

      {existingScore?.isSubmitted && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3">
          <FileCheck className="w-4 h-4 text-primary" />
          <p className="text-sm text-primary font-medium">Đã nộp phiếu điểm chính thức. Không thể chỉnh sửa.</p>
=======
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}
      {existingScore?.isSubmitted && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3">
          <FileCheck className="w-4 h-4 text-primary" />
          <p className="text-sm text-primary font-medium">Phiếu điểm đã được nộp chính thức. Không thể chỉnh sửa.</p>
>>>>>>> 804651cf5f35edc134525edcc188c1ba1812cf7c
        </div>
      )}

      {selectedId && !isLoadingScore && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
<<<<<<< HEAD
          {/* Rubric form */}
          <div className="lg:col-span-2 space-y-4">
=======
          {/* Rubric + Turnitin + Comments */}
          <div className="lg:col-span-2 space-y-5">
            {/* File view / Turnitin */}
            {selectedTopic?.latestSubmission?.driveLink && (
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5">
                <p className="text-xs font-semibold uppercase text-outline mb-3">Bài nộp của sinh viên</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <a
                    href={selectedTopic.latestSubmission.driveLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
                  >
                    <BookOpen className="w-4 h-4" />
                    Mở bài của SV (Drive)
                  </a>
                  <div className="flex-1 min-w-[200px]">
                    <input
                      ref={turnitinRef}
                      value={turnitinLink}
                      onChange={e => setTurnitinLink(e.target.value)}
                      disabled={existingScore?.isSubmitted}
                      placeholder="Link Turnitin (paste vào đây)..."
                      className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                    />
                    <p className="text-xs text-outline mt-1">Link Turnitin (tùy chọn)</p>
                  </div>
                </div>
              </div>
            )}

            {/* Rubric form */}
>>>>>>> 804651cf5f35edc134525edcc188c1ba1812cf7c
            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container/50 flex items-center gap-3">
                <Sliders className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-on-surface font-headline">Tiêu chí chấm điểm</h3>
<<<<<<< HEAD
              </div>
              <div className="divide-y divide-outline-variant/10">
                {rubric.map((criterion) => {
=======
                <span className="ml-auto text-xs text-outline">Tổng: {maxScore} điểm</span>
              </div>
              <div className="divide-y divide-outline-variant/10">
                {rubric.map(criterion => {
>>>>>>> 804651cf5f35edc134525edcc188c1ba1812cf7c
                  const current = scores[criterion.id] ?? 0;
                  const pct = (current / criterion.max) * 100;
                  return (
                    <div key={criterion.id} className="p-6 hover:bg-surface-container-low/50 transition-colors">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <label className="text-sm font-semibold text-on-surface flex-1">
                          {criterion.label}
<<<<<<< HEAD
                          <span className="ml-2 text-xs text-outline font-normal">(Tối đa {criterion.max}/10)</span>
=======
                          <span className="ml-2 text-xs text-outline font-normal">(Tối đa {criterion.max})</span>
>>>>>>> 804651cf5f35edc134525edcc188c1ba1812cf7c
                        </label>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <input
                            type="number"
                            max={criterion.max}
                            min={0}
                            step={0.25}
                            value={current}
                            disabled={existingScore?.isSubmitted}
<<<<<<< HEAD
                            onChange={(e) => setScores({ ...scores, [criterion.id]: Math.min(criterion.max, Math.max(0, parseFloat(e.target.value) || 0)) })}
                            className="w-20 text-right rounded-xl border-outline-variant/20 bg-surface-container text-on-surface text-sm font-bold px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary border disabled:opacity-60"
=======
                            onChange={e => setScores(prev => ({
                              ...prev,
                              [criterion.id]: Math.min(criterion.max, Math.max(0, parseFloat(e.target.value) || 0)),
                            }))}
                            className="w-20 text-right rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm font-bold px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
>>>>>>> 804651cf5f35edc134525edcc188c1ba1812cf7c
                          />
                          <span className="text-sm text-outline">/ {criterion.max}</span>
                        </div>
                      </div>
<<<<<<< HEAD
                      <p className="text-xs text-outline mb-3">{criterion.description}</p>
                      {/* Mini progress */}
=======
                      <p className="text-xs text-outline mb-3">{criterion.desc}</p>
>>>>>>> 804651cf5f35edc134525edcc188c1ba1812cf7c
                      <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-error"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

<<<<<<< HEAD
            {/* Turnitin */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5">
              <label className="block text-xs font-semibold uppercase text-outline mb-2">Link Turnitin (nếu có)</label>
              <input
                ref={turnitinRef}
                type="url"
                value={turnitinLink}
                disabled={existingScore?.isSubmitted}
                onChange={e => setTurnitinLink(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
            </div>

            {/* Comments */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5">
              <label className="block text-xs font-semibold uppercase text-outline mb-2">Nhận xét</label>
              <textarea
                rows={4} value={comments} disabled={existingScore?.isSubmitted}
                onChange={e => setComments(e.target.value)}
                placeholder="Nhận xét chung về đề tài và sinh viên..."
                className="w-full px-4 py-3 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none disabled:opacity-60"
              />
            </div>

            {/* Note */}
            <div className="flex items-start gap-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4">
              <AlertCircle className="w-4 h-4 text-outline mt-0.5 flex-shrink-0" />
              <p className="text-xs text-outline leading-relaxed">
                Sau khi nộp phiếu chính thức, điểm sẽ không thể chỉnh sửa nếu Thư ký Hội đồng đã tổng hợp. Vui lòng kiểm tra kỹ trước khi xác nhận.
              </p>
            </div>
          </div>

          {/* Score Summary panel */}
          <div className="lg:col-span-1">
            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden shadow-sm sticky top-24">
              {/* Score ring */}
=======
            {/* Comments */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5">
              <label className="block text-xs font-semibold uppercase text-outline mb-2">Nhận xét chung (tùy chọn)</label>
              <textarea
                rows={4}
                value={comments}
                disabled={existingScore?.isSubmitted}
                onChange={e => setComments(e.target.value)}
                placeholder="Nhận xét về bài làm, ưu điểm, hạn chế..."
                className="w-full px-4 py-3 bg-surface-container rounded-xl border border-outline-variant/20 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none disabled:opacity-60"
              />
            </div>
          </div>

          {/* Score Summary */}
          <div className="lg:col-span-1">
            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden shadow-sm sticky top-24">
              {/* Ring */}
>>>>>>> 804651cf5f35edc134525edcc188c1ba1812cf7c
              <div className="p-6 border-b border-outline-variant/10 flex flex-col items-center">
                <div className="relative w-28 h-28 mb-4">
                  <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-container" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke="currentColor" strokeWidth="2.5"
                      strokeDasharray={`${(totalScore / maxScore) * 100} ${100 - (totalScore / maxScore) * 100}`}
                      strokeLinecap="round"
                      className={`transition-all duration-500 ${isPassed ? "text-primary" : "text-error"}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-black font-headline ${isPassed ? "text-primary" : "text-error"}`}>
                      {totalScore.toFixed(2)}
                    </span>
                    <span className="text-xs text-outline">/ {maxScore}</span>
                  </div>
                </div>
                <div className={`flex items-center gap-2 text-sm font-semibold ${isPassed ? "text-green-600" : "text-error"}`}>
                  <CheckCircle2 className="w-4 h-4" />
                  {isPassed ? "Đạt yêu cầu (≥ 5.0)" : "Chưa đạt (< 5.0)"}
                </div>
              </div>

              {/* Breakdown */}
              <div className="p-5 space-y-3 border-b border-outline-variant/10">
                {rubric.map(c => (
                  <div key={c.id} className="flex justify-between items-center text-sm">
                    <span className="text-outline text-xs truncate max-w-[140px]">{c.label.replace(/^\d+\.\s/, "")}</span>
<<<<<<< HEAD
                    <span className="font-bold text-on-surface">{(scores[c.id] ?? 0).toFixed(2)}<span className="text-outline font-normal">/{c.max}</span></span>
=======
                    <span className="font-bold text-on-surface">
                      {(scores[c.id] ?? 0).toFixed(2)}
                      <span className="text-outline font-normal">/{c.max}</span>
                    </span>
>>>>>>> 804651cf5f35edc134525edcc188c1ba1812cf7c
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="p-5 flex flex-col gap-3">
                <button
                  onClick={() => void handleSaveDraft()}
                  disabled={isSaving || existingScore?.isSubmitted}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant/20 text-sm font-semibold text-on-surface hover:bg-surface-container transition-all active:scale-95 disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Đang lưu..." : "Lưu nháp"}
                </button>
                <button
<<<<<<< HEAD
                  onClick={() => setShowConfirm(true)}
=======
                  onClick={() => void handleSubmit()}
>>>>>>> 804651cf5f35edc134525edcc188c1ba1812cf7c
                  disabled={isSubmitting || existingScore?.isSubmitted}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95 disabled:opacity-60"
                >
                  <FileCheck className="w-4 h-4" />
                  {isSubmitting ? "Đang nộp..." : existingScore?.isSubmitted ? "Đã nộp chính thức" : "Nộp phiếu chính thức"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
<<<<<<< HEAD

      <ConfirmDialog
        isOpen={showConfirm}
        title="Nộp phiếu điểm chính thức?"
        message="Sau khi nộp chính thức, điểm sẽ bị khóa và không thể chỉnh sửa. Bạn chắc chắn muốn tiếp tục?"
        confirmLabel="Xác nhận nộp"
        variant="warning"
        isLoading={isSubmitting}
        onConfirm={() => void handleSubmit()}
        onCancel={() => setShowConfirm(false)}
      />
=======
>>>>>>> 804651cf5f35edc134525edcc188c1ba1812cf7c
    </div>
  );
}

export default function GVHDScoringPage() {
<<<<<<< HEAD
  return <GVHDScoringContent />;
=======
  return (
    <Suspense fallback={<div className="flex items-center gap-3 py-20 justify-center"><RefreshCw className="w-6 h-6 animate-spin text-outline" /><span className="text-outline text-sm">Đang tải...</span></div>}>
      <GVHDScoringContent />
    </Suspense>
  );
>>>>>>> 804651cf5f35edc134525edcc188c1ba1812cf7c
}
