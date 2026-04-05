"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2, Users, AlertCircle } from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";
import { Topic } from "@/lib/domain/repositories/topic.repository";

export default function GvhdBulkApprovePage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const pendingTopics = useMemo(
    () => topics.filter((t) => t.state === "PENDING_GV"),
    [topics]
  );

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        // role=supervisor returns topics where current user is GVHD
        const res = await api.get<ApiListResponse<Topic>>("/topics?role=supervisor&page=1&size=100");
        setTopics(res.data ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không tải được danh sách đề tài");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const approveSelected = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const body = { topicIds: Array.from(selected), note: "GVHD bulk approve" };
      const res = await api.post<ApiResponse<{ succeeded: string[]; failed: Record<string, string> }>>("/topics/bulk-approve", body);
      setSuccess(`Duyệt thành công ${res.data?.succeeded?.length ?? 0} đề tài`);
      // Remove succeeded from list
      setTopics((prev) => prev.filter((t) => !res.data?.succeeded?.includes(t.id)));
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Duyệt thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-outline">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Đang tải danh sách...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Duyệt đề tài hàng loạt</h1>
          <p className="text-sm text-outline">Chỉ hiển thị đề tài chờ GVHD duyệt (PENDING_GV).</p>
        </div>
        <Link href="/dashboard/gvhd" className="text-sm text-primary hover:underline">Quay lại</Link>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-xl bg-green-50 text-green-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl divide-y divide-outline-variant/10">
        {pendingTopics.length === 0 ? (
          <div className="p-6 text-center text-outline">Không có đề tài cần duyệt.</div>
        ) : (
          pendingTopics.map((topic) => (
            <label
              key={topic.id}
              className="flex items-start gap-3 p-4 hover:bg-surface-container-low transition rounded-xl cursor-pointer"
            >
              <input
                type="checkbox"
                className="mt-1 accent-primary"
                checked={selected.has(topic.id)}
                onChange={() => toggle(topic.id)}
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-on-surface font-semibold">{topic.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">PENDING_GV</span>
                </div>
                <p className="text-sm text-outline">{topic.company}</p>
                <div className="text-xs text-outline flex items-center gap-2">
                  <Users className="w-3 h-3" />
                  {topic.studentName ?? topic.studentEmail}
                </div>
              </div>
            </label>
          ))
        )}
      </div>

      <div className="flex justify-end">
        <button
          disabled={selected.size === 0 || submitting}
          onClick={approveSelected}
          className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold disabled:bg-outline disabled:text-surface"
        >
          {submitting ? "Đang duyệt..." : `Duyệt ${selected.size || ""} đề tài`}
        </button>
      </div>
    </div>
  );
}
