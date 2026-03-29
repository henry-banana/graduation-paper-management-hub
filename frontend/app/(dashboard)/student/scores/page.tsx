"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Award, TrendingUp, CheckCircle, Star, BarChart2, FileText } from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";

interface TopicDto {
  id: string;
  title: string;
  type: "BCTT" | "KLTN";
  state: string;
  supervisorUserId: string;
}

interface ScoreSummaryDto {
  gvhdScore?: number;
  gvpbScore?: number;
  councilAvgScore?: number;
  finalScore: number;
  result: "PASS" | "FAIL";
  confirmedByGvhd: boolean;
  confirmedByCtHd: boolean;
  published: boolean;
}

function toLetterGrade(score: number): string {
  if (score >= 9) {
    return "A+";
  }
  if (score >= 8) {
    return "A";
  }
  if (score >= 7) {
    return "B";
  }
  if (score >= 6) {
    return "C";
  }
  if (score >= 5) {
    return "D";
  }
  return "F";
}

export default function StudentScoresPage() {
  const [topics, setTopics] = useState<TopicDto[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [summary, setSummary] = useState<ScoreSummaryDto | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? null,
    [topics, selectedTopicId],
  );

  useEffect(() => {
    const loadTopics = async () => {
      setIsLoading(true);
      setSummaryError(null);

      try {
        const response = await api.get<ApiListResponse<TopicDto>>(
          "/topics?role=student&page=1&size=100",
        );

        setTopics(response.data);
        if (response.data.length > 0) {
          setSelectedTopicId(response.data[0].id);
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Không thể tải danh sách đề tài.";
        setSummaryError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadTopics();
  }, []);

  useEffect(() => {
    if (!selectedTopicId) {
      setSummary(null);
      return;
    }

    const loadSummary = async () => {
      setSummaryError(null);

      try {
        const response = await api.get<ApiResponse<ScoreSummaryDto>>(
          `/topics/${selectedTopicId}/scores/summary`,
        );
        setSummary(response.data);
      } catch (loadError) {
        setSummary(null);
        const message = loadError instanceof Error ? loadError.message : "Chưa có điểm được công bố cho đề tài này.";
        setSummaryError(message);
      }
    };

    void loadSummary();
  }, [selectedTopicId]);

  const totalScore = summary?.finalScore ?? 0;
  const progress = (totalScore / 10) * 100;

  const scoreMilestones = [
    { label: "Điểm GVHD", icon: "GV", sub: "Giảng viên hướng dẫn", score: summary?.gvhdScore },
    { label: "Điểm GVPB", icon: "PB", sub: "Giảng viên phản biện", score: summary?.gvpbScore },
    { label: "Điểm Hội đồng", icon: "HD", sub: "Trung bình Hội đồng", score: summary?.councilAvgScore },
  ];

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

      {isLoading && (
        <p className="text-sm text-outline">Đang tải dữ liệu điểm số...</p>
      )}

      {topics.length > 0 && (
        <label className="flex flex-col gap-2 text-sm text-on-surface-variant">
          <span className="font-semibold">Chọn đề tài</span>
          <select
            value={selectedTopicId}
            onChange={(event) => setSelectedTopicId(event.target.value)}
            className="px-3 py-2 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface"
          >
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title} ({topic.type})
              </option>
            ))}
          </select>
        </label>
      )}

      {summaryError && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
          <TrendingUp className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-700">{summaryError}</p>
        </div>
      )}

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
                  {selectedTopic?.id ?? "-"}
                </span>
                <h2 className="text-xl font-bold text-on-surface font-headline">{selectedTopic?.title ?? "Chưa chọn đề tài"}</h2>
                <p className="text-sm text-outline mt-1">GVHD: {selectedTopic?.supervisorUserId ?? "-"}</p>
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
                  <span className="text-3xl font-black text-primary font-headline">{summary ? totalScore.toFixed(2) : "-"}</span>
                  <span className="text-xs text-outline font-medium">{summary ? (summary.result === "PASS" ? "Đạt" : "Không đạt") : "Chưa công bố"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Grade summary row */}
        <div className="grid grid-cols-3 divide-x divide-outline-variant/10 px-0">
          {[
            { label: "Xếp loại", value: summary ? toLetterGrade(totalScore) : "-", sub: "Theo điểm tổng", icon: <Award className="w-5 h-5 text-amber-500" /> },
            { label: "Điểm số", value: summary ? `${totalScore.toFixed(2)}/10` : "-", sub: "Tổng hợp", icon: <BarChart2 className="w-5 h-5 text-primary" /> },
            { label: "Trạng thái", value: summary ? (summary.result === "PASS" ? "Đạt" : "Không đạt") : "Chưa công bố", sub: "Xuất bản", icon: <CheckCircle className="w-5 h-5 text-green-500" /> },
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
            {scoreMilestones.map((m, i) => (
              <div key={i} className="bg-surface-container-low rounded-2xl p-4 flex flex-col gap-2">
                <span className="text-sm font-bold text-primary">{m.icon}</span>
                <span className="text-sm font-semibold text-on-surface">{m.label}</span>
                <span className="text-xs text-outline">{m.sub}</span>
                <div className="w-full bg-surface-container h-1.5 rounded-full mt-2">
                  <div
                    className="bg-primary h-full rounded-full"
                    style={{ width: `${Math.min(((m.score ?? 0) / 10) * 100, 100)}%` }}
                  ></div>
                </div>
                <span className="text-xs text-outline">{m.score != null ? `${m.score.toFixed(2)}/10` : "Chưa có"}</span>
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
            <p className="text-sm text-outline leading-relaxed">
              {summary
                ? "Điểm đã được công bố. Sinh viên chỉ được xem điểm tổng hợp theo quy định khoa."
                : "Điểm chưa được công bố hoặc đang chờ xác nhận cuối cùng của Hội đồng."}
            </p>
          </div>
        </div>
      </div>

      {/* Next steps */}
      <div className="bg-primary text-white rounded-3xl px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <TrendingUp className="w-8 h-8 text-white/70" />
          <div>
            <h4 className="font-bold font-headline">Bước tiếp theo</h4>
            <p className="text-sm text-white/70 mt-0.5">Theo dõi trạng thái đề tài và thông báo để không bỏ lỡ deadline.</p>
          </div>
        </div>
        <Link
          href={selectedTopic ? `/student/topics/${selectedTopic.id}` : "/student/topics"}
          className="bg-white text-primary font-semibold px-6 py-3 rounded-xl hover:bg-primary-fixed transition-all active:scale-95 text-sm whitespace-nowrap"
        >
          Xem chi tiết đề tài
        </Link>
      </div>
    </div>
  );
}
