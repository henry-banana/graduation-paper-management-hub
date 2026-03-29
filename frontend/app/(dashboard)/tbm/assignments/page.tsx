"use client";

import { useState } from "react";
import { Users, UserPlus } from "lucide-react";
import { MOCK_ASSIGNMENTS } from "../mock-data";

export default function TBMAssignmentsPage() {
  const [assignments, setAssignments] = useState(MOCK_ASSIGNMENTS);

  const handleAssign = (id: string) => {
    alert("Mở form chỉ định GV Phản biện và Thành viên Hội đồng (Gồm TV_HD, CT_HD, TK_HD)");
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Phân công Hội đồng & GVPB</h1>
        <p className="text-sm text-gray-500">Theo dõi và chỉ định hội đồng đánh giá cho các đề tài đủ điều kiện bảo vệ.</p>
      </div>

      <div className="bg-white border rounded-lg shadow-sm p-6 overflow-hidden">
        {assignments.length === 0 ? (
          <div className="text-center py-10 text-gray-500">Không có đề tài cần phân công.</div>
        ) : (
          <div className="space-y-4">
            {assignments.map(a => (
              <div key={a.id} className="border rounded-lg p-5 flex flex-col md:flex-row justify-between md:items-center gap-4 hover:shadow-sm transition-shadow">
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">{a.topicName}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600">
                    <span className="flex items-center"><Users className="w-4 h-4 mr-1 text-gray-400" /> SV: {a.studentName} ({a.studentId})</span>
                    <span>GVHD: <span className="font-medium text-gray-800">{a.gvhd}</span></span>
                  </div>
                </div>
                
                <div className="flex-shrink-0">
                  {a.status === "UNASSIGNED" ? (
                    <button onClick={() => handleAssign(a.id)} className="w-full justify-center md:w-auto inline-flex items-center px-4 py-2 border border-blue-600 text-sm font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Phân công ngay
                    </button>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 bg-green-50 text-green-700 text-sm font-medium rounded-full border border-green-200">
                      Đã phân công
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
