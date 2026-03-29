"use client";

import { FileDown, RefreshCcw, CheckCircle2, Clock, FileWarning } from "lucide-react";

interface ExportJob {
  id: string;
  name: string;
  status: "COMPLETED" | "PROCESSING" | "FAILED";
  requestedAt: string;
  downloadUrl?: string;
  errorMessage?: string;
}

const MOCK_EXPORTS: ExportJob[] = [
  {
    id: "ex1",
    name: "Hồ sơ điểm KLTN - HK2 (2023-2024).docx",
    status: "COMPLETED",
    requestedAt: "2024-05-20T14:30:00Z",
    downloadUrl: "#",
  },
  {
    id: "ex2",
    name: "Phiếu điểm GVHD - N.V.A",
    status: "PROCESSING",
    requestedAt: "2024-05-[...]T15:00:00Z",
  },
  {
    id: "ex3",
    name: "Báo cáo tổng kết đợt BCTT",
    status: "FAILED",
    requestedAt: "2024-05-[...]T10:00:00Z",
    errorMessage: "Lỗi kết nối Google Drive, vui lòng thử lại."
  }
];

export default function ExportsPage() {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED": return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "PROCESSING": return <Clock className="w-5 h-5 text-yellow-500" />;
      case "FAILED": return <FileWarning className="w-5 h-5 text-red-500" />;
      default: return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "COMPLETED": return <span className="text-green-700">Đã hoàn thành</span>;
      case "PROCESSING": return <span className="text-yellow-700">Đang xử lý...</span>;
      case "FAILED": return <span className="text-red-700">Thất bại</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Quản lý Xuất File (Exports)</h1>
          <p className="text-sm text-gray-500">Lịch sử xuất file Word Rubric và bảng điểm sang Google Drive.</p>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
           <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên file</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thời gian yêu cầu</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {MOCK_EXPORTS.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{job.name}</div>
                    {job.errorMessage && <div className="text-xs text-red-500 mt-1">{job.errorMessage}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2 text-sm">
                      {getStatusIcon(job.status)}
                      <span className="font-medium">{getStatusText(job.status)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {job.requestedAt.includes('[...]') ? "Vài phút trước" : new Date(job.requestedAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {job.status === "COMPLETED" ? (
                      <a href={job.downloadUrl} className="inline-flex items-center text-blue-600 hover:text-blue-900">
                        <FileDown className="w-4 h-4 mr-1" /> Tải xuống
                      </a>
                    ) : job.status === "FAILED" ? (
                      <button className="inline-flex items-center text-gray-500 hover:text-gray-900">
                        <RefreshCcw className="w-4 h-4 mr-1" /> Thử lại
                      </button>
                    ) : (
                      <span className="text-gray-400">Đang tạo file...</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
           </table>
        </div>
      </div>
    </div>
  );
}
