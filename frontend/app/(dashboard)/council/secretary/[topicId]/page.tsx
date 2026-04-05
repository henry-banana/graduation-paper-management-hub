"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Download, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { ApiResponse, api } from "@/lib/api";

interface TopicDto { id: string; title: string; type: "BCTT" | "KLTN"; state: string; studentUserId: string; }
interface ScoreDto { id: string; scorerRole: string; totalScore: number; isSubmitted: boolean; }
interface ScoreSummaryDto { councilAvgScore?: number; finalScore: number; result: string; councilComments?: string; }

export default function SecretaryDetailPage() {
  const params = useParams();
  const topicId = params.topicId as string;
  const [topic, setTopic] = useState<TopicDto | null>(null);
  const [scores, setScores] = useState<ScoreDto[]>([]);
  const [summary, setSummary] = useState<ScoreSummaryDto | null>(null);
  const [councilComments, setCouncilComments] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        const [topicRes, scoresRes, summaryRes] = await Promise.all([
          api.get<ApiResponse<TopicDto>>(`/topics/${topicId}`),
          api.get<ApiResponse<ScoreDto[]>>(`/topics/${topicId}/scores`),
          api.get<ApiResponse<ScoreSummaryDto>>(`/topics/${topicId}/scores/summary`),
        ]);
        setTopic(topicRes.data);
        setScores(scoresRes.data ?? []);
        setSummary(summaryRes.data);
        setCouncilComments(summaryRes.data.councilComments ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không thể tải dữ liệu");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [topicId]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.patch(`/topics/${topicId}/scores/council-comments`, { councilComments });
      setSuccess("Đã lưu góp ý hội đồng");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi khi lưu");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadMinutes = async () => {
    try {
      const res = await api.post<ApiResponse<{ url: string }>>(`/exports/minutes/${topicId}`, {});
      if (res.data?.url) window.open(res.data.url, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi khi tạo biên bản");
    }
  };

  if (isLoading) return <div className="flex justify-center py-20"><RefreshCw className="w-6 h-6 animate-spin" /></div>;

  const gvhd = scores.find(s => s.scorerRole === "GVHD");
  const gvpb = scores.find(s => s.scorerRole === "GVPB");
  const ctHd = scores.find(s => s.scorerRole === "CT_HD");
  const tkHd = scores.find(s => s.scorerRole === "TK_HD");
  const tvHd = scores.filter(s => s.scorerRole === "TV_HD");

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      <Link href="/council/secretary" className="inline-flex items-center gap-2 text-sm text-outline hover:text-primary"><ArrowLeft className="w-4 h-4" />Quay lại</Link>
      <h1 className="text-2xl font-bold">{topic?.title}</h1>
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2"><AlertCircle className="w-4 h-4 text-red-600" /><p className="text-sm text-red-700">{error}</p></div>}
      {success && <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" /><p className="text-sm text-green-700">{success}</p></div>}
      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-bold mb-4">Tổng hợp điểm</h3>
        <table className="w-full text-sm">
          <thead><tr className="border-b"><th className="text-left pb-2">Vai trò</th><th className="text-right pb-2">Điểm</th><th className="text-center pb-2">Trạng thái</th></tr></thead>
          <tbody className="divide-y">
            <tr><td className="py-2">GVHD</td><td className="text-right font-bold">{gvhd ? gvhd.totalScore.toFixed(2) : "-"}</td><td className="text-center text-xs">{gvhd?.isSubmitted ? "✓ Đã nộp" : "Chưa nộp"}</td></tr>
            <tr><td className="py-2">GVPB</td><td className="text-right font-bold">{gvpb ? gvpb.totalScore.toFixed(2) : "-"}</td><td className="text-center text-xs">{gvpb?.isSubmitted ? "✓ Đã nộp" : "Chưa nộp"}</td></tr>
            <tr><td className="py-2">CT_HD</td><td className="text-right font-bold">{ctHd ? ctHd.totalScore.toFixed(2) : "-"}</td><td className="text-center text-xs">{ctHd?.isSubmitted ? "✓ Đã nộp" : "Chưa nộp"}</td></tr>
            <tr><td className="py-2">TK_HD</td><td className="text-right font-bold">{tkHd ? tkHd.totalScore.toFixed(2) : "-"}</td><td className="text-center text-xs">{tkHd?.isSubmitted ? "✓ Đã nộp" : "Chưa nộp"}</td></tr>
            {tvHd.map((s, i) => <tr key={s.id}><td className="py-2">TV_HD {i+1}</td><td className="text-right font-bold">{s.totalScore.toFixed(2)}</td><td className="text-center text-xs">{s.isSubmitted ? "✓ Đã nộp" : "Chưa nộp"}</td></tr>)}
            <tr className="bg-purple-50 font-bold"><td className="py-3">Điểm tổng kết</td><td className="text-right text-xl text-purple-700">{summary?.finalScore.toFixed(2) ?? "-"}</td><td className="text-center"><span className={`px-2 py-1 rounded text-xs ${summary?.result === "PASS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{summary?.result === "PASS" ? "ĐẠT" : "KHÔNG ĐẠT"}</span></td></tr>
          </tbody>
        </table>
      </div>
      <div className="bg-white rounded-2xl border p-6 space-y-4">
        <h3 className="font-bold">Góp ý Hội đồng</h3>
        <textarea value={councilComments} onChange={e => setCouncilComments(e.target.value)} rows={6} className="w-full rounded-xl border px-4 py-3" placeholder="Nhập góp ý của hội đồng..." />
        <div className="flex gap-3">
          <button onClick={() => void handleSave()} disabled={isSaving} className="px-4 py-2 bg-primary text-white rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2"><Save className="w-4 h-4" />{isSaving ? "Đang lưu..." : "Lưu góp ý"}</button>
          <button onClick={() => void handleDownloadMinutes()} className="px-4 py-2 bg-purple-600 text-white rounded-xl font-semibold flex items-center gap-2"><Download className="w-4 h-4" />Tải biên bản</button>
        </div>
      </div>
    </div>
  );
}
