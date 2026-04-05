"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";

interface RevisionStatusItem {
  topicId: string;
  topicTitle: string;
  studentName: string;
  supervisorName: string;
  roundNumber: number;
  roundStatus: "OPEN" | "CLOSED";
  gvhdApprovalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  gvhdApprovedAt?: string;
  ctHdApprovalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  ctHdApprovedAt?: string;
}

interface PeriodDto {
  id: string;
  code: string;
  status: string;
}

export default function TbmRevisionStatusPage() {
  const [items, setItems] = useState<RevisionStatusItem[]>([]);
  const [periods, setPeriods] = useState<PeriodDto[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");

  // Load periods
  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<ApiListResponse<PeriodDto>>("/periods?page=1&size=50");
        setPeriods(res.data ?? []);
        // Select current/most recent period by default
        const current = (res.data ?? []).find((p) => p.status === "REGISTRATION_OPEN" || p.status === "ACTIVE");
        if (current) {
          setSelectedPeriodId(current.id);
        } else if (res.data?.length) {
          setSelectedPeriodId(res.data[0].id);
        }
      } catch {
        // Ignore period loading error
      }
    })();
  }, []);

  // Load revision status
  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const url = selectedPeriodId
          ? `/topics/revision-status?periodId=${selectedPeriodId}`
          : "/topics/revision-status";
        const res = await api.get<ApiListResponse<RevisionStatusItem>>(url);
        setItems(res.data ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không thể tải dữ liệu");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [selectedPeriodId]);

  // Filtered items
  const filteredItems = useMemo(() => {
    if (filterStatus === "all") return items;
    return items.filter((item) => {
      const gvhdOk = item.gvhdApprovalStatus === "APPROVED";
      const ctHdOk = item.ctHdApprovalStatus === "APPROVED";
      if (filterStatus === "approved") return gvhdOk && ctHdOk;
      if (filterStatus === "pending") return !gvhdOk || !ctHdOk;
      if (filterStatus === "rejected") {
        return item.gvhdApprovalStatus === "REJECTED" || item.ctHdApprovalStatus === "REJECTED";
      }
      return true;
    });
  }, [items, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    const total = items.length;
    const fullyApproved = items.filter(
      (i) => i.gvhdApprovalStatus === "APPROVED" && i.ctHdApprovalStatus === "APPROVED"
    ).length;
    const pending = items.filter(
      (i) => i.gvhdApprovalStatus !== "APPROVED" || i.ctHdApprovalStatus !== "APPROVED"
    ).length;
    const rejected = items.filter(
      (i) => i.gvhdApprovalStatus === "REJECTED" || i.ctHdApprovalStatus === "REJECTED"
    ).length;
    return { total, fullyApproved, pending, rejected };
  }, [items]);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
            <CheckCircle2 className="w-3 h-3" /> Đã duyệt
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
            <XCircle className="w-3 h-3" /> Từ chối
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
            <Clock className="w-3 h-3" /> Chờ
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">
            —
          </span>
        );
    }
  };

  const handleExportCsv = () => {
    const headers = ["STT", "MSSV/Tên SV", "Đề tài", "GVHD", "Vòng", "Trạng thái GVHD", "Trạng thái CT_HĐ"];
    const rows = filteredItems.map((item, idx) => [
      idx + 1,
      item.studentName,
      item.topicTitle,
      item.supervisorName,
      item.roundNumber,
      item.gvhdApprovalStatus ?? "—",
      item.ctHdApprovalStatus ?? "—",
    ]);
    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `revision-status-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <Link
            href="/tbm/statistics"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-outline-variant/20 text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Thống kê
          </Link>
        </div>
        <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">
          Trạng thái duyệt chỉnh sửa
        </h1>
        <p className="text-sm text-outline mt-1">
          Theo dõi trạng thái duyệt bài chỉnh sửa sau bảo vệ của GVHD và Chủ tịch Hội đồng.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4 text-center">
          <p className="text-3xl font-bold text-on-surface">{stats.total}</p>
          <p className="text-xs text-outline mt-1">Tổng đề tài</p>
        </div>
        <div className="bg-green-50 rounded-2xl border border-green-200/50 p-4 text-center">
          <p className="text-3xl font-bold text-green-700">{stats.fullyApproved}</p>
          <p className="text-xs text-green-600 mt-1">Đã duyệt hoàn tất</p>
        </div>
        <div className="bg-amber-50 rounded-2xl border border-amber-200/50 p-4 text-center">
          <p className="text-3xl font-bold text-amber-700">{stats.pending}</p>
          <p className="text-xs text-amber-600 mt-1">Đang chờ duyệt</p>
        </div>
        <div className="bg-red-50 rounded-2xl border border-red-200/50 p-4 text-center">
          <p className="text-3xl font-bold text-red-700">{stats.rejected}</p>
          <p className="text-xs text-red-600 mt-1">Bị từ chối</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-outline" />
          <span className="text-sm text-outline">Lọc:</span>
        </div>

        <select
          value={selectedPeriodId}
          onChange={(e) => setSelectedPeriodId(e.target.value)}
          className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Tất cả đợt</option>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="approved">Đã duyệt hoàn tất</option>
          <option value="pending">Đang chờ</option>
          <option value="rejected">Bị từ chối</option>
        </select>

        <button
          onClick={handleExportCsv}
          disabled={filteredItems.length === 0}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-error" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-outline" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-8 text-center">
          <p className="text-on-surface-variant">
            Không có dữ liệu chỉnh sửa nào theo bộ lọc hiện tại.
          </p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant/10 bg-surface-container/50">
                  <th className="text-left px-4 py-3 font-semibold text-outline">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-outline">Sinh viên</th>
                  <th className="text-left px-4 py-3 font-semibold text-outline">Đề tài</th>
                  <th className="text-left px-4 py-3 font-semibold text-outline">GVHD</th>
                  <th className="text-center px-4 py-3 font-semibold text-outline">Vòng</th>
                  <th className="text-center px-4 py-3 font-semibold text-outline">GVHD duyệt</th>
                  <th className="text-center px-4 py-3 font-semibold text-outline">CT_HĐ duyệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {filteredItems.map((item, idx) => (
                  <tr key={item.topicId} className="hover:bg-surface-container-low/50">
                    <td className="px-4 py-3 text-outline">{idx + 1}</td>
                    <td className="px-4 py-3 text-on-surface font-medium">{item.studentName}</td>
                    <td className="px-4 py-3 text-on-surface max-w-xs truncate" title={item.topicTitle}>
                      {item.topicTitle.slice(0, 40)}{item.topicTitle.length > 40 ? "…" : ""}
                    </td>
                    <td className="px-4 py-3 text-on-surface">{item.supervisorName}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                        #{item.roundNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(item.gvhdApprovalStatus)}</td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(item.ctHdApprovalStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
