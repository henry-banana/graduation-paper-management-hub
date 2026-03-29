"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Clock, FileText, Award, ChevronDown, ChevronUp, UploadCloud, AlertCircle, ArrowLeft, Lock, Filter, Play } from "lucide-react";
import Link from "next/link";

// BCTT/KLTN steps
const BCTT_STEPS = [
  { key: "REGISTER", label: "ĐĂNG KÝ\nĐỀ TÀI" },
  { key: "CONFIRMED", label: "XÁC NHẬN\nĐỀ TÀI" },
  { key: "REPORT", label: "THỰC HIỆN\nBÁO CÁO" },
  { key: "GRADING", label: "CHẤM\nĐIỂM" },
  { key: "DONE", label: "HOÀN TẤT\nBÁO CÁO" },
];

const KLTN_STEPS = [
  { key: "REGISTER", label: "ĐĂNG KÝ\nĐỀ TÀI", desc: "Đề tài đang trong trạng thái chờ xác nhận từ GVHD." },
  { key: "CONFIRMED", label: "XÁC NHẬN\nĐỀ TÀI", desc: "Đề tài đã hoàn thành bước xác nhận. Vui lòng chờ đến giai đoạn Thực hiện." },
  { key: "REPORT", label: "THỰC HIỆN\nĐỀ TÀI", desc: "Đề tài đang trong giai đoạn thực hiện. Vui lòng nộp báo cáo trước hạn." },
  { key: "FINAL_CONFIRM", label: "XÁC NHẬN\nHOÀN TẤT", desc: "Đề tài đang được đăng ký ra Hội đồng bảo vệ." },
  { key: "DEFENSE", label: "BẢO VỆ\nĐỀ TÀI", desc: "Sinh viên chuẩn bị bảo vệ trước Hội đồng. Theo dõi thông báo để biết lịch trình." },
  { key: "GRADING", label: "CHẤM ĐIỂM\nĐỀ TÀI", desc: "Hội đồng và Giảng viên phản biện đang tiến hành chấm điểm." },
  { key: "DONE", label: "HOÀN TẤT\nKLTN", desc: "Đề tài đã hoàn tất. Xem tổng điểm ở bảng điểm." },
];

function ProgressStepper({ steps, activeIdx }: { steps: typeof BCTT_STEPS; activeIdx: number }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1 scrollbar-hide py-4 px-2">
      {steps.map((step, i) => {
        const isDone = i < activeIdx;
        const isActive = i === activeIdx;
        return (
          <div key={step.key} className="flex items-center flex-shrink-0">
            <div
              className={`relative flex flex-col items-center justify-center px-4 py-3 rounded-xl text-center transition-all duration-300 min-w-[100px] h-14 ${
                isActive
                  ? "bg-primary text-white shadow-lg shadow-primary/30 ring-2 ring-primary ring-offset-2 scale-105 z-10"
                  : isDone
                  ? "bg-primary/80 text-white"
                  : "bg-surface-container text-outline border border-outline-variant/20"
              }`}
            >
              {isDone && <CheckCircle2 className="w-3.5 h-3.5 absolute top-1.5 right-1.5 text-white/70" />}
              <span className="text-[10px] font-bold leading-tight tracking-wide whitespace-pre-line text-center">{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 h-0.5 flex-shrink-0 mx-1 rounded-full ${i < activeIdx ? "bg-primary/70" : "bg-outline-variant/30"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SubmissionPanel({ topic, activeIdx }: { topic: any, activeIdx: number }) {
  const [expanded, setExpanded] = useState(true);
  const isLocked = activeIdx < 2; // < REPORT
  const isSubmitted = topic.submissionState === "SUBMITTED";

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${isLocked ? "border-outline-variant/15 bg-surface-container/30" : "border-primary/20 bg-primary/5 shadow-sm"}`}>
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-surface-container/60 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {isLocked ? <Lock className="w-4 h-4 text-outline" /> : <UploadCloud className={`w-4 h-4 ${isSubmitted ? 'text-green-600' : 'text-primary'}`} />}
            <span className="text-sm font-semibold text-on-surface">Nộp báo cáo cuối kỳ</span>
            {isSubmitted && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase">Đã nộp</span>}
          </div>
          <span className="text-xs text-outline">{isLocked ? "Tính năng đang bị khóa" : (isSubmitted ? "Đã nộp bài thành công" : "Mở nộp bài")}</span>
        </div>
        <div className="flex items-center gap-4">
          {!isLocked && topic.submissionDeadline && (
            <span className={`text-xs font-semibold px-2 py-1 rounded bg-surface-container-high ${isSubmitted ? "text-outline" : "text-error"}`}>
              Hạn: {topic.submissionDeadline}
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-outline" /> : <ChevronDown className="w-4 h-4 text-outline" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-outline-variant/10">
          {isLocked ? (
            <div className="px-5 py-10 flex flex-col items-center gap-3 text-outline bg-surface-container-lowest">
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center">
                <Lock className="w-5 h-5 text-outline/40" />
              </div>
              <p className="text-sm">Tính năng nộp bài sẽ mở khi hệ thống chuyển sang trạng thái <strong>THỰC HIỆN ĐỀ TÀI</strong>.</p>
            </div>
          ) : (
            <div className="px-6 py-5 bg-surface-container-lowest flex flex-col items-start gap-4">
              <div className="w-full grid grid-cols-2 text-sm border border-outline-variant/15 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-surface-container/40 font-medium text-outline border-b border-outline-variant/15">Trạng thái chấm điểm</div>
                <div className="px-4 py-3 border-b border-outline-variant/15 font-semibold text-on-surface">{activeIdx >= 5 ? "Đã chấm điểm" : "Chưa chấm điểm"}</div>
                
                <div className="px-4 py-3 bg-surface-container/40 font-medium text-outline border-b border-outline-variant/15">Thời gian cập nhật</div>
                <div className="px-4 py-3 border-b border-outline-variant/15 text-on-surface">{isSubmitted ? "Hôm nay, 14:30" : "-"}</div>
                
                <div className="px-4 py-3 bg-surface-container/40 font-medium text-outline">File đính kèm</div>
                <div className="px-4 py-3 flex items-center gap-2">
                  {isSubmitted ? (
                    <a href="#" className="flex items-center gap-2 p-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors">
                      <FileText className="w-4 h-4" /> <span className="text-xs font-semibold underline">Baocao_KLTN_NguyenVanA.pdf</span>
                    </a>
                  ) : "-"}
                </div>
              </div>

              {!isSubmitted && (
                <button className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-sm">
                  <UploadCloud className="w-4 h-4" /> Thêm bài nộp
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col items-center gap-1.5 bg-surface-container-lowest rounded-2xl px-3 py-4 border border-outline-variant/15 shadow-sm">
      <span className="text-[10px] uppercase font-bold text-outline text-center leading-tight h-6 flex items-end">{label}</span>
      <div className="h-px w-full bg-outline-variant/10 my-1" />
      {value != null ? (
        <span className="text-2xl font-black text-primary font-headline">{value}</span>
      ) : (
        <span className="text-xs text-outline/50 font-bold mt-1 uppercase tracking-wider">Chưa có</span>
      )}
    </div>
  );
}

export default function StudentTopicDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  // INITIAL MOCK STATE. We make it stateful so we can build a control panel to preview Slide 6-13
  const [activeKltnStep, setActiveKltnStep] = useState(0); 
  const [isSubmitted, setIsSubmitted] = useState(false);

  // MOCK TOPIC based on the dynamic state
  const topic = {
    id: "t2",
    name: "Nghiên cứu ứng dụng AI trong quản lý chuỗi cung ứng",
    type: "KLTN",
    gvhdName: "TS. Nguyễn Thị B",
    studentName: "Nguyễn Văn A",
    period: "ĐỢT 2 HK2 25-26",
    stateIndex: activeKltnStep,
    submissionOpen: activeKltnStep >= 2, // >= REPORT
    submissionDeadline: "30/04/2026",
    submissionState: isSubmitted ? "SUBMITTED" : "NOT_SUBMITTED",
    // Scores populate over time
    scorePGVHD: activeKltnStep >= 5 ? 8.5 : null,
    scoreSGVHD: activeKltnStep >= 5 ? 9.0 : null,
    scoreHD: activeKltnStep >= 6 ? 9.5 : null, 
    scoreTotal: activeKltnStep >= 6 ? 9.0 : null,
    
    announcements: [
      { id: "a1", message: KLTN_STEPS[activeKltnStep].desc, sender: "Hệ thống", time: "Vừa xong" },
      ...(isSubmitted ? [{ id: "a2", message: "Đã nộp báo cáo thành công.", sender: "Hệ thống", time: "10 phút trước" }] : []),
      ...(activeKltnStep >= 6 ? [{ id: "a3", message: "Hội đồng đánh giá rất cao tính thực tiễn của đề tài.", sender: "TS. Trần Văn C (CT HĐ)", time: "Hôm qua" }] : [])
    ]
  };

  const currentDesc = KLTN_STEPS[topic.stateIndex]?.desc;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      {/* Utility Debug Nav - FOR PREVIEW SLIDE 6-13 */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-black/80 backdrop-blur-xl border border-white/10 p-3 rounded-full flex items-center gap-2 shadow-2xl">
        <span className="px-3 text-xs font-bold text-white uppercase tracking-widest hidden md:inline">TEST PANEL:</span>
        {KLTN_STEPS.map((s, i) => (
          <button
            key={i}
            onClick={() => setActiveKltnStep(i)}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${activeKltnStep === i ? 'bg-primary text-white scale-110' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {i}
          </button>
        ))}
        <div className="w-px h-6 bg-white/20 mx-2" />
        <button 
          onClick={() => setIsSubmitted(!isSubmitted)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${isSubmitted ? 'bg-green-500 text-white' : 'bg-white/10 text-white'}`}
          disabled={activeKltnStep < 2}
          title={activeKltnStep < 2 ? "Chưa tới giai đoạn nộp bài" : ""}
        >
          {isSubmitted ? 'Đã nộp bài' : 'Chưa nộp bài'}
        </button>
      </div>

      <Link href="/student/topics" className="inline-flex items-center gap-1.5 text-sm font-semibold text-outline hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" /> Quay lại Đề tài của tôi
      </Link>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header & Stepper */}
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
            <div className="p-6 bg-gradient-to-br from-primary/5 to-transparent">
              <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase rounded-full mb-3">
                {topic.type}
              </span>
              <h1 className="text-xl md:text-2xl font-bold font-headline text-on-surface leading-snug">{topic.name}</h1>
              
              <div className="mt-8 bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4 shadow-sm overflow-hidden relative">
                <span className="absolute top-0 right-0 px-3 py-1 bg-primary rounded-bl-xl text-[10px] font-bold text-white uppercase shadow-sm">
                  Tiến độ
                </span>
                <ProgressStepper steps={KLTN_STEPS} activeIdx={topic.stateIndex} />
              </div>
            </div>

            {/* Status Alert from slides */}
            <div className="px-6 py-4 bg-amber-50/50 border-t border-b border-amber-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Play className="w-4 h-4 text-amber-600 ml-0.5" />
              </div>
              <p className="text-sm font-semibold text-amber-800">{currentDesc}</p>
            </div>

            <div className="px-6 py-5">
              <h4 className="text-xs font-bold uppercase tracking-widest text-outline mb-4">Thông tin đề tài</h4>
              <div className="grid sm:grid-cols-2 gap-y-4 gap-x-8">
                <div><span className="block text-xs text-outline mb-1">GV Hướng dẫn</span><span className="text-sm font-semibold text-on-surface">{topic.gvhdName}</span></div>
                <div><span className="block text-xs text-outline mb-1">Đợt</span><span className="text-sm font-semibold text-on-surface">{topic.period}</span></div>
              </div>
            </div>
          </div>

          <SubmissionPanel topic={topic} activeIdx={activeKltnStep} />
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Score Box */}
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-surface-container/30 border-b border-outline-variant/10 flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm text-on-surface">Kết quả điểm</h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3 relative">
              <ScoreCard label="Hướng dẫn" value={topic.scorePGVHD} />
              <ScoreCard label="Phản biện" value={topic.scoreSGVHD} />
              <div className="col-span-2">
                <ScoreCard label="Hội đồng" value={topic.scoreHD} />
              </div>
              {activeKltnStep < 5 && (
                 <div className="absolute inset-x-2 top-2 bottom-3 bg-surface-container-lowest/80 backdrop-blur-sm border border-outline-variant/10 rounded-2xl flex flex-col items-center justify-center text-center p-4">
                   <Lock className="w-6 h-6 text-outline mb-2" />
                   <p className="text-xs font-semibold text-outline">Điểm được công bố sau<br/>khi thư ký nhập đánh giá.</p>
                 </div>
              )}
            </div>
          </div>

          {/* Announcements */}
          <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-surface-container/30 border-b border-outline-variant/10">
              <h3 className="font-bold text-sm text-on-surface flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-primary" /> Bảng thông báo
              </h3>
            </div>
            <div className="divide-y divide-outline-variant/10">
              {topic.announcements.map((a: any) => (
                <div key={a.id} className="p-4 hover:bg-surface-container/30 transition-colors">
                  <p className="text-sm font-medium text-on-surface-variant leading-snug">{a.message}</p>
                  <div className="flex justify-between items-center mt-2 text-[10px] text-outline font-medium tracking-wide">
                    <span>{a.sender}</span>
                    <span>{a.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
