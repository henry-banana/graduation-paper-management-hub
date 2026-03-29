"use client";

import { useState } from "react";
import { BookOpen, AlertCircle, ChevronDown, Send, Calendar, Info, Lock } from "lucide-react";

// MOCK DATA for business rule check
const MOCK_USER_STATUS = {
  credits: 130, // example: not enough to graduate or do KLTN
  bcttDone: false, // BCTT must be true to register KLTN
};

const PERIODS = [
  { id: "dot1", label: "ĐỢT 1 - HK2 25-26", start: "01/02/2026", end: "10/02/2026", open: false },
  { id: "dot2", label: "ĐỢT 2 - HK2 25-26", start: "01/05/2026", end: "10/05/2026", open: true },
];

export default function StudentTopicRegisterPage() {
  const [form, setForm] = useState({
    topicName: "",
    domain: "",
    gvhdEmail: "",
    periodId: "dot2",
    type: "BCTT", // start with BCTT
    company: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const selectedPeriod = PERIODS.find(p => p.id === form.periodId);
  const canRegisterKLTN = MOCK_USER_STATUS.bcttDone; // Must finish BCTT to do KLTN

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value;
    if (newType === "KLTN" && !canRegisterKLTN) {
      setError("Bạn chưa đủ điều kiện đăng ký KLTN. Bắt buộc phải hoàn thành Báo cáo thực tập trước.");
      setForm({ ...form, type: "BCTT" });
      return;
    }
    setError("");
    setForm({ ...form, type: newType });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.topicName || !form.domain || !form.gvhdEmail || !form.periodId) {
      setError("Vui lòng điền đầy đủ các trường bắt buộc.");
      return;
    }
    if (!selectedPeriod?.open) {
      setError("Đợt đăng ký này hiện không mở. Vui lòng chọn đợt khác hoặc chờ đến kỳ đăng ký tiếp theo.");
      return;
    }
    if (form.type === "KLTN" && !canRegisterKLTN) {
      setError("Hệ thống phát hiện bạn chưa hoàn thành Báo cáo thực tập. Không thể đăng ký KLTN.");
      return;
    }

    setError("");
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm p-12 flex flex-col items-center text-center gap-6">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold font-headline text-on-surface">Đăng ký thành công!</h2>
            <p className="text-outline mt-2 max-w-sm">Đề tài đã được gửi đến GVHD. Vui lòng chờ xác nhận trong vòng <strong>5-7 ngày làm việc</strong>.</p>
          </div>
          <button onClick={() => setSubmitted(false)} className="text-sm text-primary font-semibold hover:underline">
            Đăng ký đề tài khác
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">Đăng ký đề tài</h1>
        <p className="text-sm text-outline mt-1">Đăng ký đề tài BCTT hoặc KLTN. Khóa luận chỉ dành cho SV đã hoàn thành BCTT.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-outline-variant/10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-bold text-on-surface font-headline">Đăng ký đề tài mới</h3>
            </div>

            <div className="p-6 space-y-5">
              {error && (
                <div className="flex items-start gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-error mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}

              {/* Tên đề tài */}
              <div>
                <label className="block text-sm font-semibold text-on-surface mb-2">Tên đề tài <span className="text-error">*</span></label>
                <input
                  type="text"
                  value={form.topicName}
                  onChange={e => setForm({ ...form, topicName: e.target.value })}
                  placeholder="Nhập tên đề tài..."
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Mảng & GVHD */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-on-surface mb-2">Mảng <span className="text-error">*</span></label>
                  <input
                    type="text"
                    value={form.domain}
                    onChange={e => setForm({ ...form, domain: e.target.value })}
                    placeholder="VD: Web, AI..."
                    className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-on-surface mb-2">Email GVHD <span className="text-error">*</span></label>
                  <input
                    type="email"
                    value={form.gvhdEmail}
                    onChange={e => setForm({ ...form, gvhdEmail: e.target.value })}
                    placeholder="gvhd@hcmute.edu.vn"
                    className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* Đợt & Loại */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-on-surface mb-2">Đợt <span className="text-error">*</span></label>
                  <div className="relative">
                    <select
                      value={form.periodId}
                      onChange={e => setForm({ ...form, periodId: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none pr-9"
                    >
                      {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-on-surface mb-2">Loại <span className="text-error">*</span></label>
                  <div className="relative">
                    <select
                      value={form.type}
                      onChange={handleTypeChange}
                      className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none pr-9"
                    >
                      <option value="BCTT">Báo cáo thực tập</option>
                      <option value="KLTN" disabled={!canRegisterKLTN}>Khóa luận tốt nghiệp {!canRegisterKLTN && "(Bị khóa)"}</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none" />
                  </div>
                  {!canRegisterKLTN && (
                    <p className="text-[10px] text-error mt-1 flex items-center gap-1"><Lock className="w-3 h-3"/> Chưa hoàn thành BCTT</p>
                  )}
                </div>
              </div>

              {/* Công ty */}
              <div>
                <label className="block text-sm font-semibold text-on-surface mb-2">Công ty thực tập <span className="text-outline font-normal">(nếu có)</span></label>
                <input
                  type="text"
                  value={form.company}
                  onChange={e => setForm({ ...form, company: e.target.value })}
                  placeholder="Tên công ty..."
                  className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <button type="submit" className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 hover:shadow-lg transition-all active:scale-95 text-sm mt-2">
                <Send className="w-4 h-4" /> Đăng ký
              </button>
            </div>
          </form>
        </div>

        {/* Right Info */}
        <div className="space-y-4">
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant/10">
              <h4 className="font-semibold text-on-surface text-sm flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Lịch đăng ký</h4>
            </div>
            <div className="p-4 space-y-3">
              {PERIODS.map((p) => (
                <div key={p.id} className={`px-4 py-3 rounded-2xl border ${p.open ? "border-green-200 bg-green-50" : "border-outline-variant/15 bg-surface-container"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-on-surface">{p.label}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.open ? "bg-green-500 text-white" : "bg-surface-container-high text-outline"}`}>{p.open ? "Đang mở" : "Đóng"}</span>
                  </div>
                  <p className="text-xs text-outline">{p.start} — {p.end}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Rule Card */}
          <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-900 leading-relaxed space-y-1.5">
                <p className="font-bold">Quy định KLTN</p>
                <p>Sinh viên muốn đăng ký Khóa luận tốt nghiệp phải có điểm <strong>Báo cáo thực tập &gt;= 5.0</strong>. Hệ thống sẽ tự động khóa tùy chọn KLTN nếu chưa đạt điều kiện này.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
