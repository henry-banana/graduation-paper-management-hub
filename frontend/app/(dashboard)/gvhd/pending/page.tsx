"use client";

import { useState } from "react";
import { Check, X, Search, Eye, Clock, BookOpen, GraduationCap, Filter } from "lucide-react";
import { MOCK_PENDING_TOPICS } from "../mock-data";

export default function GVHDPendingPage() {
  const [topics, setTopics] = useState(MOCK_PENDING_TOPICS);
  const [search, setSearch] = useState("");

  const handleApprove = (id: string) => {
    alert(`Đã duyệt đề tài ${id}`);
    setTopics(topics.filter(t => t.id !== id));
  };

  const handleReject = (id: string) => {
    const reason = prompt("Lý do từ chối (Optional):");
    alert(`Đã từ chối đề tài ${id}. Lý do: ${reason || "Không có"}`);
    setTopics(topics.filter(t => t.id !== id));
  };

  const filtered = topics.filter(t =>
    t.studentName?.toLowerCase().includes(search.toLowerCase()) ||
    t.topicName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">
            Duyệt đề tài
          </h1>
          <p className="text-sm text-outline font-body mt-1">
            Phê duyệt các đề tài BCTT / KLTN từ sinh viên hướng dẫn.
          </p>
        </div>
        {/* Stats */}
        <div className="flex gap-4">
          {[
            { label: "Chờ duyệt", value: topics.length, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
            { label: "Hạn duyệt", value: "3 ngày", color: "text-error", bg: "bg-error-container/20 border-error/20" },
          ].map((stat, i) => (
            <div key={i} className={`px-5 py-3 rounded-2xl border text-center min-w-[100px] ${stat.bg}`}>
              <p className={`text-2xl font-black font-headline ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-outline mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4 flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            type="text"
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container rounded-xl border border-outline-variant/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-on-surface placeholder:text-outline/60"
            placeholder="Tìm sinh viên hoặc tên đề tài..."
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant/20 text-sm text-on-surface-variant hover:bg-surface-container transition-colors">
          <Filter className="w-4 h-4" />
          Bộ lọc
        </button>
      </div>

      {/* Topics list */}
      {filtered.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 p-16 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-outline/50" />
          </div>
          <p className="text-on-surface-variant font-medium">Không có đề tài nào đang chờ duyệt.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((topic) => (
            <div
              key={topic.id}
              className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 p-6 hover:shadow-md hover:border-outline-variant/20 transition-all duration-200"
            >
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                {/* Student info */}
                <div className="flex items-center gap-4 md:w-52 flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                    {topic.studentName?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-on-surface truncate">{topic.studentName}</p>
                    <p className="text-xs text-outline mt-0.5">{topic.studentId}</p>
                    <p className="text-xs text-outline/70">{new Date(topic.submittedAt).toLocaleDateString("vi-VN")}</p>
                  </div>
                </div>

                {/* Topic name + category */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 mb-2">
                    <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${topic.type === "KLTN" ? "bg-purple-100 text-purple-700" : "bg-primary/10 text-primary"}`}>
                      {topic.type}
                    </span>
                    <p className="text-sm font-semibold text-on-surface leading-snug">{topic.topicName}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-outline">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{topic.category}</span>
                    {topic.companyName && (
                      <>
                        <span>·</span>
                        <span>{topic.companyName}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 md:pt-0">
                  <button
                    onClick={() => handleApprove(topic.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-xl hover:bg-green-700 hover:shadow-lg hover:shadow-green-200 transition-all active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Duyệt
                  </button>
                  <button
                    onClick={() => handleReject(topic.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-surface-container-low border border-outline-variant/30 text-on-surface-variant text-xs font-semibold rounded-xl hover:bg-error-container/20 hover:text-error hover:border-error/30 transition-all active:scale-95"
                  >
                    <X className="w-3.5 h-3.5" />
                    Từ chối
                  </button>
                  <button
                    className="p-2 bg-surface-container-low border border-outline-variant/30 text-on-surface-variant rounded-xl hover:bg-surface-container transition-colors"
                    title="Xem chi tiết"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
