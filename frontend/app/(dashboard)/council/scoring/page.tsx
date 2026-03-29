"use client";

import { useState } from "react";
import { Calculator, Download, Search } from "lucide-react";
import { MOCK_COUNCIL_EVALUATIONS } from "../mock-data";

export default function CouncilScoringPage() {
  const [evaluations, setEvaluations] = useState(MOCK_COUNCIL_EVALUATIONS);

  const handleScore = (id: string) => {
    alert("Chuyển đến màn hình nhập phiếu điểm Rubric riêng cho Thành viên/Chủ tịch Hội đồng");
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Đánh giá Hội đồng (TV_HĐ / CT_HĐ)</h1>
        <p className="text-sm text-gray-500">Danh sách các đề tài cần bạn nhập phiếu điểm thành viên hội đồng.</p>
      </div>

      <div className="bg-white border rounded-lg shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="relative w-full sm:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none sm:text-sm"
              placeholder="Tìm theo MSSV, Tên SV, Tên đề tài..."
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Đề tài & Sinh viên</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Báo cáo</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái phiếu</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {evaluations.map((ev) => (
                <tr key={ev.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{ev.topicName}</div>
                    <div className="text-sm text-gray-500 mt-1">{ev.studentName} ({ev.studentId})</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium">
                      <Download className="w-4 h-4 mr-1" /> PDF
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {ev.status === "PENDING" ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Chưa chấm
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Đã nộp phiếu
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => handleScore(ev.id)}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <Calculator className="w-4 h-4 mr-2" /> Nhập điểm
                    </button>
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
