"use client";

import { CheckCircle2, XCircle, AlertCircle, GraduationCap, BookOpen, Award, User, Building, Calendar, Hash, Users } from "lucide-react";

const STUDENT_INFO = {
  name: "Nguyễn Văn A",
  studentId: "20110123",
  dob: "01/01/2002",
  gender: "Nam",
  major: "Công nghệ Thông tin",
  faculty: "Khoa CNTT",
  className: "20110CL2A",
  cohort: "2020",
  email: "20110123@student.hcmute.edu.vn",
  avatar: null,
  // Graduation requirements
  credits: { completed: 150, required: 150 },
  bctt: "Hoàn thành",
  kltn: "Hoàn thành",
};

const GradReq = ({ label, value, status }: { label: string; value: string; status: "done" | "pending" | "not_started" }) => {
  const cfg = {
    done: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", text: "Hoàn thành", badge: "bg-green-100 text-green-700" },
    pending: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", text: "Đang thực hiện", badge: "bg-amber-100 text-amber-700" },
    not_started: { icon: XCircle, color: "text-outline", bg: "bg-surface-container", text: "Chưa bắt đầu", badge: "bg-surface-container text-outline" },
  }[status];
  const Icon = cfg.icon;
  return (
    <div className="flex items-center justify-between py-4 border-b border-outline-variant/10 last:border-0">
      <span className="text-sm font-medium text-on-surface-variant">{label}</span>
      <div className="flex items-center gap-4">
        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}>
          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
          {cfg.text}
        </span>
      </div>
    </div>
  );
};

export default function StudentProfilePage() {
  const creditPct = (STUDENT_INFO.credits.completed / STUDENT_INFO.credits.required) * 100;
  const allDone = STUDENT_INFO.bctt === "Hoàn thành" && STUDENT_INFO.kltn === "Hoàn thành" && STUDENT_INFO.credits.completed >= STUDENT_INFO.credits.required;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">Thông tin sinh viên</h1>
        <p className="text-sm text-on-surface-variant mt-1">Thông tin cá nhân và điều kiện tốt nghiệp.</p>
      </div>

      {/* Profile card */}
      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
        {/* Background gradient header */}
        <div className="h-24 bg-gradient-to-r from-primary to-primary-container relative" />

        <div className="px-8 pb-8 relative z-10">
          {/* Avatar */}
          <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-6 -mt-10 md:-mt-14 mb-8">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-surface-container-lowest border-4 border-surface-container-lowest shadow-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
              {STUDENT_INFO.avatar ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={STUDENT_INFO.avatar} alt={STUDENT_INFO.name} className="w-full h-full object-cover" />
                </>
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                  <User className="w-10 h-10 text-primary/60" />
                </div>
              )}
            </div>
            <div className="pb-1">
              <h2 className="text-2xl font-bold font-headline text-on-surface">{STUDENT_INFO.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-outline">{STUDENT_INFO.studentId}</span>
                <span className="text-outline/30">·</span>
                <span className="text-sm text-outline">{STUDENT_INFO.email}</span>
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-2xl border border-outline-variant/15 overflow-hidden">
            {[
              { icon: Hash, label: "Mã sinh viên", value: STUDENT_INFO.studentId },
              { icon: Building, label: "Khoa", value: STUDENT_INFO.faculty },
              { icon: User, label: "Họ tên", value: STUDENT_INFO.name },
              { icon: BookOpen, label: "Ngành", value: STUDENT_INFO.major },
              { icon: Calendar, label: "Ngày sinh", value: STUDENT_INFO.dob },
              { icon: Users, label: "Lớp", value: STUDENT_INFO.className },
              { icon: User, label: "Giới tính", value: STUDENT_INFO.gender },
              { icon: GraduationCap, label: "Khóa", value: STUDENT_INFO.cohort },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className={`flex items-center gap-4 px-5 py-4 border-b border-outline-variant/10 ${i % 2 === 0 ? "md:border-r md:border-outline-variant/10" : ""} ${i >= 6 ? "md:border-b-0" : ""} last:border-0`}>
                  <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-on-surface-variant" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-on-surface-variant">{item.label}</p>
                    <p className="text-sm font-semibold text-on-surface mt-0.5">{item.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Graduation requirements */}
      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Award className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-bold text-on-surface font-headline">Yêu cầu tốt nghiệp</h3>
          </div>
          {allDone && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Đủ điều kiện KLTN
            </span>
          )}
        </div>
        <div className="px-6 py-2">
          {/* Credits progress bar */}
          <div className="py-4 border-b border-outline-variant/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-on-surface-variant">Số tín chỉ đã hoàn thành</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-on-surface">{STUDENT_INFO.credits.completed}/{STUDENT_INFO.credits.required}</span>
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${STUDENT_INFO.credits.completed >= STUDENT_INFO.credits.required ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {STUDENT_INFO.credits.completed >= STUDENT_INFO.credits.required ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {STUDENT_INFO.credits.completed >= STUDENT_INFO.credits.required ? "Đạt" : "Chưa đạt"}
                </span>
              </div>
            </div>
            <div className="w-full bg-primary/10 h-2.5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary-container transition-all duration-700"
                style={{ width: `${Math.min(creditPct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-outline">
              <span>0 tín chỉ</span>
              <span>{STUDENT_INFO.credits.required} tín chỉ</span>
            </div>
          </div>

          <GradReq label="Báo cáo thực tập (BCTT)" value={STUDENT_INFO.bctt} status="done" />
          <GradReq label="Khóa luận tốt nghiệp (KLTN)" value={STUDENT_INFO.kltn} status="done" />
        </div>

        {!allDone && (
          <div className="px-6 py-4 border-t border-outline-variant/10 bg-amber-50/50">
            <p className="text-xs text-amber-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Chỉ mở khóa đăng ký KLTN khi đủ tín chỉ và hoàn thành Báo cáo thực tập.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
