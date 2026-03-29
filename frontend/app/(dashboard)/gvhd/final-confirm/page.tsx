"use client";

import { useState } from "react";
import { Check, ShieldAlert } from "lucide-react";

export default function GVHDFinalConfirmPage() {
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    if (window.confirm("Bạn xác nhận bảng điểm tổng hợp là chính xác và đồng ý công bố điểm cho Khóa luận này? Thao tác này là không thể hoàn tác.")) {
      setConfirmed(true);
      alert("Đã xác nhận thành công!");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Xác nhận công bố điểm (Final Confirm)</h1>
        <p className="text-sm text-gray-500">Bước cuối cùng trước khi điểm KLTN được công bố chính thức cho sinh viên. Yêu cầu xác nhận đồng thời từ Chủ tịch Hội đồng và GVHD.</p>
      </div>

      <div className="bg-white border rounded-xl shadow-sm p-8 max-w-2xl mx-auto flex flex-col items-center justify-center text-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${confirmed ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
          {confirmed ? <Check className="w-10 h-10" /> : <ShieldAlert className="w-10 h-10" />}
        </div>
        
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {confirmed ? "Đã xác nhận công bố" : "Xác nhận điểm: KLTN-2024-05"}
        </h2>
        
        <p className="text-sm text-gray-500 mb-8 max-w-sm">
          {confirmed 
            ? "Bạn đã ký số/xác nhận điện tử cho bảng điểm này. Không cần thao tác thêm. Chờ CT_HD xác nhận để hoàn tất quy trình."
            : "Với tư cách là Giảng viên hướng dẫn, bạn cần rà soát điểm số tổng hợp lần cuối trước khi điểm chính thức được công bố lên hệ thống cho sinh viên."}
        </p>

        {!confirmed ? (
          <button 
            onClick={handleConfirm}
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Tôi xác nhận điểm đã chính xác
          </button>
        ) : (
          <div className="flex items-center space-x-2 text-sm text-green-700 font-medium">
            <Check className="w-4 h-4" /> Đã ghi nhận xác nhận của bạn
          </div>
        )}
      </div>
    </div>
  );
}
