"use client";

import { Award, TrendingUp, CheckCircle, Star, BarChart2, FileText } from "lucide-react";

const SCORE_DATA = {
  topicCode: "BCTT-2023-01",
  topicName: "Xây dựng hệ thống quản lý kho HKT",
  totalScore: 8.5,
  letterGrade: "A",
  status: "Đạt",
  gvhd: "TS. Nguyễn Văn B",
  message: "Xin chúc mừng! Báo cáo thực tập của bạn đã hoàn thành xuất sắc. Bạn đã đủ điều kiện để đăng ký Khóa luận tốt nghiệp trong đợt tiếp theo.",
};

const SCORE_MILESTONES = [
  { label: "Trình bày & thuyết trình", icon: "🎤", sub: "Hội đồng phản biện" },
  { label: "Chất lượng báo cáo", icon: "📄", sub: "GVHD đánh giá" },
  { label: "Kỹ thuật & code", icon: "💻", sub: "Rubric tiêu chí" },
];

export default function StudentScoresPage() {
  const progress = (SCORE_DATA.totalScore / 10) * 100;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">
          Kết quả & Điểm số
        </h1>
        <p className="text-sm text-outline font-body">
          Kết quả đánh giá tổng hợp từ Giảng viên hướng dẫn và Hội đồng bảo vệ.
        </p>
      </div>

      {/* Main Score Card */}
      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden shadow-sm">
        {/* Topic info */}
        <div className="px-8 py-6 border-b border-outline-variant/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <span className="inline-block text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full mb-2">
                  {SCORE_DATA.topicCode}
                </span>
                <h2 className="text-xl font-bold text-on-surface font-headline">{SCORE_DATA.topicName}</h2>
                <p className="text-sm text-outline mt-1">GVHD: {SCORE_DATA.gvhd}</p>
              </div>
            </div>

            {/* Big score badge */}
            <div className="flex-shrink-0">
              <div className="relative w-32 h-32">
                <svg className="w-32 h-32 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-container" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke="currentColor" strokeWidth="2.5"
                    strokeDasharray={`${progress} ${100 - progress}`}
                    strokeLinecap="round"
                    className="text-primary transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-primary font-headline">{SCORE_DATA.totalScore}</span>
                  <span className="text-xs text-outline font-medium">{SCORE_DATA.status}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Grade summary row */}
        <div className="grid grid-cols-3 divide-x divide-outline-variant/10 px-0">
          {[
            { label: "Xếp loại", value: SCORE_DATA.letterGrade, sub: "Giỏi", icon: <Award className="w-5 h-5 text-amber-500" /> },
            { label: "Điểm số", value: `${SCORE_DATA.totalScore}/10`, sub: "Tổng hợp", icon: <BarChart2 className="w-5 h-5 text-primary" /> },
            { label: "Trạng thái", value: "Đạt ✓", sub: "Hoàn thành", icon: <CheckCircle className="w-5 h-5 text-green-500" /> },
          ].map((item, i) => (
            <div key={i} className="px-8 py-6 flex flex-col items-center text-center">
              <div className="mb-2">{item.icon}</div>
              <span className="text-xl font-bold text-on-surface font-headline">{item.value}</span>
              <span className="text-xs text-outline mt-1">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Score breakdown (visual only - student view) */}
        <div className="px-8 py-6 border-t border-outline-variant/10 space-y-4">
          <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider font-label">
            Các tiêu chí đánh giá
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {SCORE_MILESTONES.map((m, i) => (
              <div key={i} className="bg-surface-container-low rounded-2xl p-4 flex flex-col gap-2">
                <span className="text-2xl">{m.icon}</span>
                <span className="text-sm font-semibold text-on-surface">{m.label}</span>
                <span className="text-xs text-outline">{m.sub}</span>
                <div className="w-full bg-surface-container h-1.5 rounded-full mt-2">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${75 + i * 5}%` }}></div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-outline/60 text-center pt-2">
            * Chi tiết rubric chấm điểm không được hiển thị với sinh viên theo quy định khoa.
          </p>
        </div>

        {/* Message from council */}
        <div className="mx-6 mb-6 p-5 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-2xl border border-primary/10 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Star className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-on-surface mb-1.5">Nhận xét từ Hội đồng / Khoa</h4>
            <p className="text-sm text-outline leading-relaxed">{SCORE_DATA.message}</p>
          </div>
        </div>
      </div>

      {/* Next steps */}
      <div className="bg-primary text-white rounded-3xl px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <TrendingUp className="w-8 h-8 text-white/70" />
          <div>
            <h4 className="font-bold font-headline">Bước tiếp theo: Đăng ký KLTN</h4>
            <p className="text-sm text-white/70 mt-0.5">Bạn đủ điều kiện. Đăng ký sớm để được ưu tiên chọn đề tài.</p>
          </div>
        </div>
        <button className="bg-white text-primary font-semibold px-6 py-3 rounded-xl hover:bg-primary-fixed transition-all active:scale-95 text-sm whitespace-nowrap">
          Đăng ký KLTN →
        </button>
      </div>
    </div>
  );
}
