"use client";

import { useState } from "react";
import { Check, X, FileText, Download } from "lucide-react";
import { MOCK_REVIEWS } from "../../gvhd/mock-data";

export default function GVPBReviewsPage() {
  const [reviews, setReviews] = useState(MOCK_REVIEWS);

  const handleApprove = (id: string) => {
    alert("Đã duyệt CHẤP NHẬN cho sinh viên bảo vệ.");
    setReviews(reviews.filter(r => r.id !== id));
  };

  const handleReject = (id: string) => {
    const reason = prompt("Lý do KHÔNG CHO phép bảo vệ (Sinh viên sẽ phải chỉnh sửa và GVHD duyệt lại):");
    if (reason) {
      alert(`Đã từ chối. Phản hồi sẽ được gửi lại GVHD.`);
      setReviews(reviews.filter(r => r.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Review Trước Bảo Vệ (GVPB)</h1>
        <p className="text-sm text-gray-500">Xem xét hồ sơ và quyết định &quot;Cho phép bảo vệ&quot; hay &quot;Không cho phép bảo vệ&quot;.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {reviews.length === 0 ? (
          <div className="text-center p-12 bg-gray-50 border rounded-lg text-gray-500">
            Không có hồ sơ nào đang chờ phản biện.
          </div>
        ) : reviews.map((review) => (
          <div key={review.id} className="bg-white border rounded-xl shadow-sm p-6 flex flex-col md:flex-row gap-6">
             <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{review.topicName}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <span className="font-medium text-gray-900">{review.studentName} ({review.studentId})</span>
                    <span>|</span>
                    <span className="text-red-600 font-medium">Hạn phản hồi: {new Date(review.deadline).toLocaleDateString("vi-VN")}</span>
                  </div>
                </div>

                <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100 flex items-center justify-between">
                  <div className="flex items-center text-sm font-medium text-gray-800">
                    <FileText className="w-5 h-5 text-blue-600 mr-3" />
                    {review.reportFile}
                  </div>
                  <button className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800">
                    <Download className="w-4 h-4 mr-1" /> Tải báo cáo
                  </button>
                </div>
             </div>

             <div className="md:w-64 border-t md:border-t-0 md:border-l pt-6 md:pt-0 md:pl-6 flex flex-col justify-center gap-3">
                <span className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-1">Kết luận đánh giá</span>
                <button 
                  onClick={() => handleApprove(review.id)}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 shadow-sm"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Đồng ý bảo vệ
                </button>
                <button 
                  onClick={() => handleReject(review.id)}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                >
                  <X className="w-4 h-4 mr-2" />
                  Không cho bảo vệ
                </button>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
