"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { ApiListResponse, api } from "@/lib/api";

interface TopicDto {
  id: string;
  title: string;
  type: "BCTT" | "KLTN";
  state: string;
}

interface RevisionRound {
  id: string;
  topicId: string;
  roundNumber: number;
  status: "OPEN" | "CLOSED";
  endAt: string;
  gvhdApprovalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  ctHdApprovalStatus?: "PENDING" | "APPROVED" | "REJECTED";
}

type Row = {
  topic: TopicDto;
  round?: RevisionRound;
};

export default function TbmRevisionDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const topicsRes = await api.get<ApiListResponse<TopicDto>>("/topics?role=tbm&page=1&size=50");
        const kltn = (topicsRes.data ?? []).filter((t) => t.type === "KLTN");
        // Fetch revision rounds in parallel (bounded)
        const rounds = await Promise.all(
          kltn.map(async (t) => {
            try {
              const res = await api.get<ApiListResponse<RevisionRound>>(`/topics/${t.id}/revisions/rounds`);
              const active = (res.data ?? []).find((r) => r.status === "OPEN");
              return { topic: t, round: active };
            } catch {
              return { topic: t, round: undefined };
            }
          })
        );
        setRows(rounds);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không tải được dữ liệu");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const summary = useMemo(() => {
    const open = rows.filter((r) => r.round?.status === "OPEN").length;
    const waitingGvhd = rows.filter((r) => r.round && r.round.gvhdApprovalStatus === "PENDING").length;
    const waitingCt = rows.filter((r) => r.round && r.round.gvhdApprovalStatus === "APPROVED" && r.round.ctHdApprovalStatus === "PENDING").length;
    return { open, waitingGvhd, waitingCt };
  }, [rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-outline">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Đang tải...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">TBM – Theo dõi chỉnh sửa sau bảo vệ</h1>
          <p className="text-sm text-outline">Thống kê các vòng revision KLTN đang mở.</p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Vòng đang mở" value={summary.open} icon={<Clock className="w-4 h-4" />} />
        <StatCard label="Chờ GVHD duyệt" value={summary.waitingGvhd} icon={<XCircle className="w-4 h-4" />} />
        <StatCard label="Chờ Chủ tịch duyệt" value={summary.waitingCt} icon={<CheckCircle2 className="w-4 h-4" />} />
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl divide-y divide-outline-variant/10">
        {rows.length === 0 ? (
          <div className="p-6 text-center text-outline">Không có đề tài nào.</div>
        ) : (
          rows.map(({ topic, round }) => (
            <div key={topic.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-on-surface">{topic.title}</div>
                <div className="text-xs text-outline">State: {topic.state}</div>
                {round ? (
                  <div className="text-xs text-outline">
                    Vòng #{round.roundNumber} • Hạn: {new Date(round.endAt).toLocaleDateString("vi-VN")} • GVHD: {round.gvhdApprovalStatus ?? "PENDING"} • CT_HD: {round.ctHdApprovalStatus ?? "PENDING"}
                  </div>
                ) : (
                  <div className="text-xs text-outline">Chưa mở vòng chỉnh sửa</div>
                )}
              </div>
              <a
                className="text-sm text-primary hover:underline"
                href={`/council/revision-approval?topicId=${topic.id}`}
              >
                Xem chi tiết
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: JSX.Element }) {
  return (
    <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
      <div className="text-xs text-outline flex items-center gap-2">{icon}{label}</div>
      <div className="text-2xl font-bold text-on-surface mt-1">{value}</div>
    </div>
  );
}
