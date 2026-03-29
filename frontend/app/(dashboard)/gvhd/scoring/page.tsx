"use client";

import { useState } from "react";
import { CheckCircle2, Save, FileCheck, ArrowLeft, Sliders, User, BookOpen, AlertCircle } from "lucide-react";
import Link from "next/link";

const RUBRIC_CRITERIA = [
  { id: "c1", label: "1. Thái độ và kỷ luật", max: 2.0, default: 1.5, description: "Đánh giá tính chủ động, tuân thủ lịch làm việc và nội quy." },
  { id: "c2", label: "2. Hình thức trình bày báo cáo", max: 2.0, default: 2.0, description: "Đánh giá cấu trúc, lỗi chính tả, văn phong học thuật." },
  { id: "c3", label: "3. Nội dung chuyên môn", max: 6.0, default: 5.0, description: "Đánh giá hàm lượng chuyên môn, khả năng giải quyết vấn đề, tính ứng dụng." },
];

export default function GVHDScoringPage() {
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(RUBRIC_CRITERIA.map(c => [c.id, c.default]))
  );

  const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0);
  const maxScore = RUBRIC_CRITERIA.reduce((sum, c) => sum + c.max, 0);
  const isPassed = totalScore >= 5.0;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <Link
              href="/gvhd/topics"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-outline-variant/20 text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Quay lại
            </Link>
            <span className="text-xs text-outline px-3 py-1.5 bg-primary/10 rounded-full font-medium">BCTT-2024-01</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">
            Phiếu chấm điểm Rubric (GVHD)
          </h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-outline">
            <User className="w-4 h-4" />
            <span>Nguyễn Văn A</span>
            <span>·</span>
            <span>MSSV: 20110xxx</span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-xl border border-outline-variant/10 text-sm text-on-surface-variant">
          <BookOpen className="w-4 h-4" />
          BCTT Học kỳ 2 · 2023-2024
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Rubric form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-outline-variant/10 bg-surface-container/50 flex items-center gap-3">
              <Sliders className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-on-surface font-headline">Tiêu chí chấm điểm</h3>
            </div>
            <div className="divide-y divide-outline-variant/10">
              {RUBRIC_CRITERIA.map((criterion, i) => {
                const current = scores[criterion.id];
                const pct = (current / criterion.max) * 100;
                return (
                  <div key={criterion.id} className="p-6 hover:bg-surface-container-low/50 transition-colors">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <label className="text-sm font-semibold text-on-surface flex-1">
                        {criterion.label}
                        <span className="ml-2 text-xs text-outline font-normal">(Tối đa {criterion.max}/10)</span>
                      </label>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <input
                          type="number"
                          max={criterion.max}
                          min={0}
                          step={0.25}
                          value={current}
                          onChange={(e) => setScores({ ...scores, [criterion.id]: Math.min(criterion.max, Math.max(0, parseFloat(e.target.value) || 0)) })}
                          className="w-20 text-right rounded-xl border-outline-variant/20 bg-surface-container text-on-surface text-sm font-bold px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary border"
                        />
                        <span className="text-sm text-outline">/ {criterion.max}</span>
                      </div>
                    </div>
                    <p className="text-xs text-outline mb-3">{criterion.description}</p>
                    {/* Mini progress */}
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
              {RUBRIC_CRITERIA.map(c => (
                <div key={c.id} className="flex justify-between items-center text-sm">
                  <span className="text-outline text-xs truncate max-w-[140px]">{c.label.replace(/^\d+\.\s/, "")}</span>
                  <span className="font-bold text-on-surface">{scores[c.id].toFixed(2)}<span className="text-outline font-normal">/{c.max}</span></span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="p-5 flex flex-col gap-3">
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant/20 text-sm font-semibold text-on-surface hover:bg-surface-container transition-all active:scale-95">
                <Save className="w-4 h-4" />
                Lưu nháp
              </button>
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95">
                <FileCheck className="w-4 h-4" />
                Nộp phiếu chính thức
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
