"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock, FileText, CheckCircle, AlertTriangle } from "lucide-react";

export default function GVHDTopicDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  
  // Mock Topic state
  const [topicState, setTopicState] = useState("IN_PROGRESS");

  const handleTransitionToGrading = () => {
    if (window.confirm("Bạn có chắc chắn muốn chuyển đề tài này sang trạng thái CHẤM ĐIỂM? Sau khi chuyển sẽ không thể trở lại.")) {
      setTopicState("GRADING");
      alert("Đã chuyển sang trạng thái chấm điểm.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4 mb-8">
        <button onClick={() => router.back()} className="p-2 bg-white border shadow-sm rounded-full text-gray-500 hover:bg-gray-50">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Chi tiết đề tài</h1>
          <p className="text-sm text-gray-500">Mã đề tài: KLTN-2024-05 | Sinh viên: Trần Văn B</p>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Nghiên cứu áp dụng Blockchain trong truy xuất nguồn gốc nông sản</h2>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-medium">KLTN</span>
            <span>Blockchain</span>
            <span className="text-gray-300">|</span>
            <span>SV: 20110123</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Trạng thái</span>
          {topicState === "IN_PROGRESS" ? (
             <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full flex items-center">
               <Clock className="w-4 h-4 mr-1.5" /> Đang thực hiện
             </span>
          ) : (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-semibold rounded-full flex items-center">
               <FileText className="w-4 h-4 mr-1.5" /> Đang chấm điểm
             </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-xl shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-semibold flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            Kiểm soát trạng thái
          </h3>
          <p className="text-sm text-gray-600">
            Chuyển đề tài sang trạng thái chấm điểm khi sinh viên đã nộp báo cáo đầy đủ hoặc đã qua hạn nộp bài.
          </p>
          <button 
            disabled={topicState === "GRADING"}
            onClick={handleTransitionToGrading}
            className={`w-full justify-center inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
              topicState === "IN_PROGRESS" ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            Chuyển sang Chấm điểm
          </button>
        </div>

        <div className="bg-white border rounded-xl shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-semibold flex items-center">
            <FileText className="w-5 h-5 text-gray-500 mr-2" />
            File báo cáo sinh viên
          </h3>
          <p className="text-sm text-gray-600">
            Sinh viên đã nộp 1 file báo cáo cuối kỳ vào ngày 01/04/2024.
          </p>
          <div className="p-3 bg-gray-50 rounded border flex justify-between items-center">
            <span className="text-sm font-medium">BCTT_TranVanB.pdf</span>
            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Tải về</button>
          </div>
        </div>
      </div>
    </div>
  );
}
