"use client";

import { useState } from "react";
import { ClipboardList, CheckCircle2, AlertTriangle } from "lucide-react";
import { MOCK_SUMMARY } from "../mock-data";

export default function CouncilSummaryPage() {
  const [summaries, setSummaries] = useState(MOCK_SUMMARY);

  const handleSummarize = (id: string, index: number) => {
    if (window.confirm("Bạn xác nhận tổng hợp điểm? Điểm trung bình cộng sẽ được tính và lưu vào hồ sơ.")) {
      const updated = [...summaries];
      updated[index].status = "SUMMARIZED";
      setSummaries(updated);
      alert("Đã tổng hợp thành công. Hồ sơ chờ CT_HD và GVHD xác nhận.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tổng hợp điểm (Thư ký HĐ)</h1>
        <p className="text-sm text-gray-500">Chỉ được phép tổng hợp khi đã có đủ phiếu điểm từ GVHD, GVPB, và tất cả TV Hội đồng.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {summaries.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg text-gray-500 border border-dashed">
            Không có hồ sơ nào cần tổng hợp.
          </div>
        ) : summaries.map((summary, idx) => {
          const councilAvg = summary.councilScores.reduce((acc, curr) => acc + curr.score, 0) / summary.councilScores.length;
          const finalScore = (summary.gvhdScore + summary.gvpbScore + councilAvg) / 3;

          return (
            <div key={summary.id} className="bg-white border rounded-xl shadow-sm overflow-hidden p-6 md:p-8">
               <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 mb-6">
                 <div>
                    <h3 className="text-lg font-bold text-gray-900">{summary.topicName}</h3>
                    <p className="text-sm text-gray-500 mt-1">SV: {summary.studentName} ({summary.studentId})</p>
                 </div>
                 
                 <div className="flex-shrink-0 flex items-center justify-center p-4 bg-gray-50 rounded-xl border">
                    <div className="text-center">
                      <span className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">Dự kiến TB</span>
                      <span className="block text-3xl font-black text-blue-600">{finalScore.toFixed(2)}</span>
                    </div>
                 </div>
               </div>

               <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Sinh viên</th>
                        <th className="px-4 py-3 text-center font-medium border-l border-r border-gray-200 bg-blue-50/50">Điểm GVHD</th>
                        <th className="px-4 py-3 text-center font-medium border-r border-gray-200 bg-purple-50/50">Điểm GVPB</th>
                        <th className="px-4 py-3 text-center font-medium bg-emerald-50/50">Điểm TV HĐ (Trung bình)</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">{summary.studentName}</td>
                        <td className="px-4 py-3 text-center font-bold text-gray-700 border-l border-r border-gray-200 bg-blue-50/50">{summary.gvhdScore.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center font-bold text-gray-700 border-r border-gray-200 bg-purple-50/50">{summary.gvpbScore.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center font-bold text-gray-700 bg-emerald-50/50">{councilAvg.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
               </div>

               <div className="flex justify-end">
                  {summary.status === "READY_TO_SUMMARIZE" ? (
                    <button 
                      onClick={() => handleSummarize(summary.id, idx)}
                      className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <ClipboardList className="w-4 h-4 mr-2" /> Ghi biên bản tổng hợp
                    </button>
                  ) : summary.status === "SUMMARIZED" ? (
                    <span className="inline-flex items-center text-sm font-medium text-green-600 bg-green-50 px-4 py-2 rounded-md border border-green-200">
                      <CheckCircle2 className="w-5 h-5 mr-2" /> Đã tổng hợp thành công
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-sm font-medium text-red-600 bg-red-50 px-4 py-2 rounded-md border border-red-200">
                      <AlertTriangle className="w-5 h-5 mr-2" /> Thiếu phiếu điểm
                    </span>
                  )}
               </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
