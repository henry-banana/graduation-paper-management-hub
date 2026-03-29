"use client";

import { useState } from "react";
import { Plus, Clock, Edit } from "lucide-react";
import { MOCK_PERIODS } from "../mock-data";

export default function TBMPeriodsPage() {
  const [periods, setPeriods] = useState(MOCK_PERIODS);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "OPEN": return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 flex items-center w-fit"><Clock className="w-3 h-3 mr-1" /> Đang mở</span>;
      case "CLOSED": return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Đã đóng</span>;
      case "UPCOMING": return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Sắp tới</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Quản lý đợt BCTT/KLTN</h1>
          <p className="text-sm text-gray-500">Thiết lập thời gian mở và đóng hệ thống cho giảng viên và sinh viên.</p>
        </div>
        <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
          <Plus className="w-5 h-5 mr-2" />
          Tạo đợt mới
        </button>
      </div>

      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên đợt</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loại</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thời gian</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {periods.map(period => (
                <tr key={period.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{period.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {period.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(period.startDate).toLocaleDateString("vi-VN")} - {new Date(period.endDate).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(period.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-gray-400 hover:text-blue-600"><Edit className="w-5 h-5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}
