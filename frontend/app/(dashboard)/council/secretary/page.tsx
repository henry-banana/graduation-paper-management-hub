"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  FileCheck,
  RefreshCw,
  User,
  AlertCircle,
  FileText,
  Download,
} from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";

/* ---------- Types ---------- */
interface TopicDto {
  id: string;
  title: string;
  type: "BCTT" | "KLTN";
  state: string;
  studentUserId: string;
  councilRole?: string;
}

interface StudentDto {
  id: string;
  email: string;
  name?: string;
  studentId?: string;
}

interface ScoreSummaryDto {
  gvhdScore?: number;
  gvpbScore?: number;
  councilAvgScore?: number;
  finalScore: number;
  result: string;
  published: boolean;
  councilComments?: string;
}

function SecretaryContent() {
  const [topics, setTopics] = useState<TopicDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Load topics assigned to TK_HD
        const res = await api.get<ApiListResponse<TopicDto>>(
          "/topics?role=tk_hd&page=1&size=100&states=DEFENSE,SCORING"
        );
        setTopics(res.data ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không thể tải danh sách đề tài.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-20 justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-outline" />
        <span className="text-outline text-sm">Đang tải...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-error mt-0.5" />
        <p className="text-sm text-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface font-headline mb-1">
            Thư ký Hội đồng
          </h1>
          <p className="text-sm text-outline">
            Quản lý điểm số và biên bản hội đồng
          </p>
        </div>
        <span className="px-4 py-2 rounded-full bg-purple-100 text-purple-700 text-xs font-bold uppercase tracking-wider">
          TK_HD
        </span>
      </div>

      {topics.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-12 text-center">
          <BookOpen className="w-12 h-12 text-outline mx-auto mb-3 opacity-50" />
          <p className="text-outline text-sm">Chưa có đề tài nào được phân công.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {topics.map((topic) => (
            <Link
              key={topic.id}
              href={`/council/secretary/${topic.id}`}
              className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5 hover:shadow-md hover:border-primary/20 transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase">
                      {topic.type}
                    </span>
                    <span className="text-xs text-outline">ID: {topic.id}</span>
                  </div>
                  <h3 className="text-base font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-2">
                    {topic.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs font-semibold">Xem chi tiết</span>
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SecretaryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center gap-3 py-20 justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-outline" />
      </div>
    }>
      <SecretaryContent />
    </Suspense>
  );
}
