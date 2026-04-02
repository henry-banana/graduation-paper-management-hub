"use client";

import { useEffect, useState } from "react";
import { FileDown, RefreshCcw, CheckCircle2, Clock, FileWarning, RefreshCw } from "lucide-react";
import { ApiListResponse, api } from "@/lib/api";

interface ExportJob {
  id: string;
  filename?: string;
  type?: string;
  status: "COMPLETED" | "PROCESSING" | "FAILED" | "PENDING";
  createdAt?: string;
  driveLink?: string;
  errorMessage?: string;
}

export default function ExportsPage() {
  const [exports, setExports] = useState<ExportJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<ExportJob>>("/exports?page=1&size=50");
      setExports(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải danh sách exports.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED": return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "PROCESSING":
      case "PENDING": return <Clock className="w-5 h-5 text-yellow-500" />;
      case "FAILED": return <FileWarning className="w-5 h-5 text-red-500" />;
      default: return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "COMPLETED": return <span className="text-green-700 font-medium">Đã hoàn thành</span>;
      case "PROCESSING": return <span className="text-yellow-700 font-medium">Đang xử lý...</span>;
      case "PENDING": return <span className="text-yellow-600 font-medium">Đang chờ...</span>;
      case "FAILED": return <span className="text-red-700 font-medium">Thất bại</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">Quản lý Xuất File</h1>
          <p className="text-sm text-outline mt-1">Lịch sử xuất file Word Rubric và bảng điểm sang Google Drive.</p>
        </div>
        <button
          onClick={() => void load()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-outline-variant/20 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      {error && (
        <div className="bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-outline animate-spin" />
            <span className="ml-3 text-sm text-outline">Đang tải...</span>
          </div>
        ) : exports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FileDown className="w-10 h-10 text-outline/40" />
            <p className="text-sm text-on-surface-variant">Chưa có file export nào.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-outline-variant/10">
              <thead className="bg-surface-container/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-outline uppercase tracking-wider">Tên file / Loại</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-outline uppercase tracking-wider">Trạng thái</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-outline uppercase tracking-wider">Thời gian</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-outline uppercase tracking-wider">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {exports.map((job) => (
                  <tr key={job.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-on-surface">{job.filename ?? job.type ?? job.id}</div>
                      {job.errorMessage && <div className="text-xs text-error mt-1">{job.errorMessage}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm">
                        {getStatusIcon(job.status)}
                        {getStatusText(job.status)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-outline">
                      {job.createdAt ? new Date(job.createdAt).toLocaleString("vi-VN") : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {job.status === "COMPLETED" && job.driveLink ? (
                        <a
                          href={job.driveLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-primary hover:underline font-semibold"
                        >
                          <FileDown className="w-4 h-4" /> Tải xuống
                        </a>
                      ) : job.status === "FAILED" ? (
                        <button
                          onClick={() => void load()}
                          className="inline-flex items-center gap-1.5 text-outline hover:text-on-surface"
                        >
                          <RefreshCcw className="w-4 h-4" /> Làm mới
                        </button>
                      ) : (
                        <span className="text-outline/60">Đang tạo...</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
