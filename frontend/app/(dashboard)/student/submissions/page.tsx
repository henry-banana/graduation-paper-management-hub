"use client";

import { FileText, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";

const SUBMISSION_HISTORY = [
  { id: "1", name: "20110xxx_NguyenVanA_BCTT.pdf", date: "29/03/2026 14:30", status: "accepted", size: "3.2 MB" },
  { id: "2", name: "20110xxx_NguyenVanA_BCTT_v2.zip", date: "15/03/2026 09:12", status: "pending", size: "45.7 MB" },
];

export default function StudentSubmissionsPage() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">
          Nộp báo cáo
        </h1>
        <p className="text-sm text-outline font-body">
          Đăng tải file báo cáo cuối kỳ, source code và tài liệu liên quan.
        </p>
      </div>

      {/* Deadline Alert */}
      <div className="flex items-center gap-4 bg-error-container/20 border border-error/20 rounded-2xl px-6 py-4">
        <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center flex-shrink-0">
          <Clock className="w-5 h-5 text-error" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-on-surface">Hạn nộp cuối: <span className="text-error">30/11/2024 23:59</span></p>
          <p className="text-xs text-outline mt-0.5">Còn 14 ngày · Nộp trễ hạn sẽ bị trừ điểm theo quy định khoa.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Upload Area */}
          <div className="col-span-2 space-y-6">
            <FileUpload 
              onUpload={(file) => console.log('Upload success:', file.name)} 
              accept=".pdf,.docx,.zip" 
              maxSize={50} 
            />

          {/* Requirements */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10">
            <h4 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-primary" />
              Yêu cầu file nộp
            </h4>
            <ul className="space-y-2 text-sm text-outline">
              {[
                "File báo cáo PDF: MSSV_HoTen_BCTT/KLTN.pdf",
                "Source code (nếu có): MSSV_HoTen_SourceCode.zip",
                "Báo cáo Turnitin (nếu trên 20%): MSSV_HoTen_Turnitin.pdf",
              ].map((req, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Submission History */}
        <div className="col-span-1 space-y-4">
          <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider font-label">
            Lịch sử nộp
          </h3>
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden divide-y divide-outline-variant/10">
            {SUBMISSION_HISTORY.map((item) => (
              <div key={item.id} className="p-4 hover:bg-surface-container-low transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${item.status === "accepted" ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"}`}>
                    {item.status === "accepted" ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-on-surface truncate">{item.name}</p>
                    <p className="text-[10px] text-outline mt-1">{item.date} · {item.size}</p>
                    <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${item.status === "accepted" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {item.status === "accepted" ? "Đã chấp nhận" : "Đang chờ"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick tips */}
          <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4">
            <p className="text-xs text-primary font-semibold mb-2">💡 Lưu ý</p>
            <p className="text-xs text-outline leading-relaxed">
              Mỗi lần nộp mới sẽ ghi đè phiên bản cũ. Hệ thống sẽ tự động thông báo đến GVHD sau khi bạn nộp thành công.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
