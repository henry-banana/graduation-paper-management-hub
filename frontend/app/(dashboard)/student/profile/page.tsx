"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, GraduationCap, BookOpen, Award, User, Building, Calendar, Hash, Users } from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";
import { TOPIC_STATE_LABELS } from "@/lib/constants/vi-labels";

interface UserProfileDto {
  id: string;
  email: string;
  fullName: string;
  studentId?: string;
  department?: string;
  earnedCredits?: number;
  requiredCredits?: number;
  completedBcttScore?: number;
  canRegisterKltn?: boolean;
}

interface TopicDto {
  id: string;
  type: "BCTT" | "KLTN";
  state: string;
}

const GradReq = ({ label, value, status }: { label: string; value: string; status: "done" | "pending" | "not_started" }) => {
  const cfg = {
    done: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", text: "Hoàn thành", badge: "bg-green-100 text-green-700" },
    pending: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", text: "Đang thực hiện", badge: "bg-amber-100 text-amber-700" },
    not_started: { icon: XCircle, color: "text-outline", bg: "bg-surface-container", text: "Chưa bắt đầu", badge: "bg-surface-container text-outline" },
  }[status];
  const Icon = cfg.icon;
  return (
    <div className="flex items-center justify-between py-4 border-b border-outline-variant/10 last:border-0">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-on-surface-variant">{label}</span>
        <span className="text-xs text-outline mt-0.5">{value}</span>
      </div>
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
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [topics, setTopics] = useState<TopicDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [profileRes, topicsRes] = await Promise.all([
          api.get<ApiResponse<UserProfileDto>>("/users/me"),
          api.get<ApiListResponse<TopicDto>>("/topics?role=student&page=1&size=100"),
        ]);

        setProfile(profileRes.data);
        setTopics(topicsRes.data);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Không thể tải thông tin sinh viên.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, []);

  const bcttState = useMemo(() => {
    const topic = topics.find((item) => item.type === "BCTT");
    if (!topic) {
      return { label: "Chưa đăng ký", status: "not_started" as const };
    }

    if (topic.state === "COMPLETED") {
      return { label: "Hoàn thành", status: "done" as const };
    }

    if (topic.state === "CANCELLED") {
      return { label: "Đã hủy", status: "not_started" as const };
    }

    return { label: TOPIC_STATE_LABELS[topic.state]?.label || topic.state, status: "pending" as const };
  }, [topics]);

  const kltnState = useMemo(() => {
    const topic = topics.find((item) => item.type === "KLTN");
    if (!topic) {
      return { label: "Chưa đăng ký", status: "not_started" as const };
    }

    if (topic.state === "COMPLETED") {
      return { label: "Hoàn thành", status: "done" as const };
    }

    if (topic.state === "CANCELLED") {
      return { label: "Đã hủy", status: "not_started" as const };
    }

    return { label: TOPIC_STATE_LABELS[topic.state]?.label || topic.state, status: "pending" as const };
  }, [topics]);

  const earnedCreditsRaw = Number(profile?.earnedCredits ?? 0);
  const requiredCreditsRaw = Number(profile?.requiredCredits ?? 0);
  const earnedCredits = Number.isFinite(earnedCreditsRaw) ? Math.max(0, earnedCreditsRaw) : 0;
  const requiredCredits = Number.isFinite(requiredCreditsRaw) ? Math.max(0, requiredCreditsRaw) : 0;
  const remainingCredits =
    requiredCredits > 0 ? Math.max(0, requiredCredits - earnedCredits) : 0;
  const completedBcttScore = profile?.completedBcttScore ?? 0;
  const creditsProgressPercent = requiredCredits > 0
    ? Math.min(100, Math.round((earnedCredits / requiredCredits) * 100))
    : 0;
  const isKltnEligible = profile?.canRegisterKltn ?? (
    bcttState.status === "done" &&
    completedBcttScore > 5
  );

  if (isLoading) {
    return <div className="text-sm text-outline">Đang tải thông tin sinh viên...</div>;
  }

  if (error || !profile) {
    return (
      <div className="flex items-start gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
        <AlertCircle className="w-4 h-4 text-error mt-0.5 flex-shrink-0" />
        <p className="text-sm text-error">{error ?? "Không tìm thấy hồ sơ sinh viên."}</p>
      </div>
    );
  }

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
              <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                <User className="w-10 h-10 text-primary/60" />
              </div>
            </div>
            <div className="pb-1">
              <h2 className="text-2xl font-bold font-headline text-on-surface">{profile.fullName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-outline">{profile.studentId ?? "-"}</span>
                <span className="text-outline/30">·</span>
                <span className="text-sm text-outline">{profile.email}</span>
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-2xl border border-outline-variant/15 overflow-hidden">
            {[
              { icon: Hash, label: "Mã sinh viên", value: profile.studentId ?? "-" },
              { icon: Building, label: "Bộ môn", value: profile.department ?? "-" },
              { icon: User, label: "Họ tên", value: profile.fullName },
              { icon: BookOpen, label: "Email", value: profile.email },
                { icon: Calendar, label: "Số tín chỉ đã tích lũy", value: earnedCredits.toFixed(0) },
                { icon: Users, label: "Số tín chỉ yêu cầu (tham khảo)", value: requiredCredits > 0 ? requiredCredits.toFixed(0) : "Chưa cấu hình" },
                { icon: Award, label: "Điểm BCTT đã xác nhận", value: completedBcttScore > 0 ? completedBcttScore.toFixed(2) : "Chưa có" },
                { icon: GraduationCap, label: "Điều kiện đăng ký KLTN", value: isKltnEligible ? "Đủ điều kiện" : "Chưa đủ điều kiện" },
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
          {isKltnEligible ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Đủ điều kiện KLTN
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
              <AlertCircle className="w-3.5 h-3.5" />
              Chưa đủ điều kiện KLTN
            </span>
          )}
        </div>
        <div className="px-6 py-2">
          <div className="py-4 border-b border-outline-variant/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-on-surface-variant">Số tín chỉ đã tích lũy</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-on-surface">
                  {requiredCredits > 0 ? `${earnedCredits.toFixed(0)}/${requiredCredits.toFixed(0)}` : `${earnedCredits.toFixed(0)}`}
                </span>
                {creditsProgressPercent >= 100 ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Đạt yêu cầu
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                    {creditsProgressPercent}%
                  </span>
                )}
              </div>
            </div>
            {/* Progress bar: green when complete, primary when in progress */}
            <div className="w-full bg-surface-container h-3 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  creditsProgressPercent >= 100
                    ? "bg-gradient-to-r from-green-500 to-green-400"
                    : "bg-gradient-to-r from-primary to-primary-container"
                }`}
                style={{ width: `${creditsProgressPercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-outline">
              <span>0</span>
              <span>
                {requiredCredits > 0
                  ? remainingCredits > 0
                    ? `Còn thiếu ${remainingCredits.toFixed(0)} tín chỉ`
                    : `Đã đủ ${requiredCredits.toFixed(0)} tín chỉ yêu cầu`
                  : `${earnedCredits.toFixed(0)} tín chỉ tích lũy`}
              </span>
              {requiredCredits > 0 && <span>{requiredCredits.toFixed(0)}</span>}
            </div>
          </div>

          <GradReq label="Báo cáo thực tập (BCTT)" value={bcttState.label} status={bcttState.status} />
          <GradReq label="Khóa luận tốt nghiệp (KLTN)" value={kltnState.label} status={kltnState.status} />
        </div>

        {!isKltnEligible && (
          <div className="px-6 py-4 border-t border-outline-variant/10 bg-amber-50/50">
            <p className="text-xs text-amber-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Hệ thống chỉ mở khóa đăng ký KLTN khi BCTT hoàn thành và điểm BCTT lớn hơn 5.0.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
