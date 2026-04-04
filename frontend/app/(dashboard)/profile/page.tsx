"use client";

import { ComponentType, useEffect, useState } from "react";
import {
  AlertCircle,
  Award,
  BookOpen,
  Building,
  CheckCircle2,
  GraduationCap,
  Hash,
  Mail,
  User,
  Users,
} from "lucide-react";
import { ApiResponse, api } from "@/lib/api";
import { getCurrentUiRole } from "@/lib/auth/session";

interface UserProfileDto {
  id: string;
  email: string;
  fullName: string;
  accountRole: "STUDENT" | "LECTURER" | "TBM";
  studentId?: string;
  lecturerId?: string;
  department?: string;
  earnedCredits?: number;
  requiredCredits?: number;
  completedBcttScore?: number;
  canRegisterKltn?: boolean;
  totalQuota?: number;
  quotaUsed?: number;
}

const ROLE_LABELS: Record<string, string> = {
  STUDENT: "Sinh viên",
  LECTURER: "Giảng viên",
  GVHD: "GV Hướng dẫn",
  GVPB: "GV Phản biện",
  TBM: "Trưởng bộ môn",
  TV_HD: "Thành viên HĐ",
  TK_HD: "Thư ký HĐ",
  CT_HD: "Chủ tịch HĐ",
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [uiRole, setUiRole] = useState<string>("STUDENT");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const currentUiRole = getCurrentUiRole();
        setUiRole(currentUiRole);

        const response = await api.get<ApiResponse<UserProfileDto>>("/users/me");
        setProfile(response.data);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải thông tin tài khoản.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  if (isLoading) {
    return <div className="text-sm text-outline">Đang tải hồ sơ...</div>;
  }

  if (error || !profile) {
    return (
      <div className="flex items-start gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
        <AlertCircle className="w-4 h-4 text-error mt-0.5 flex-shrink-0" />
        <p className="text-sm text-error">
          {error ?? "Không tìm thấy thông tin tài khoản."}
        </p>
      </div>
    );
  }

  const earnedCredits = Number(profile.earnedCredits ?? 0);
  const requiredCredits = Number(profile.requiredCredits ?? 0);
  const quotaUsed = Number(profile.quotaUsed ?? 0);
  const totalQuota = Number(profile.totalQuota ?? 0);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">
          Hồ sơ cá nhân
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Thông tin tài khoản và trạng thái vai trò hiện tại.
        </p>
      </div>

      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-primary to-primary-container" />

        <div className="px-6 md:px-8 pb-8 -mt-8">
          <div className="w-16 h-16 rounded-2xl bg-surface-container-lowest border-4 border-surface-container-lowest shadow flex items-center justify-center">
            <User className="w-8 h-8 text-primary/70" />
          </div>

          <div className="mt-4">
            <h2 className="text-2xl font-bold font-headline text-on-surface">
              {profile.fullName}
            </h2>
            <p className="text-sm text-outline mt-1">
              {ROLE_LABELS[uiRole] ?? uiRole} · {ROLE_LABELS[profile.accountRole] ?? profile.accountRole}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-2xl border border-outline-variant/15 overflow-hidden mt-6">
            <InfoRow icon={Hash} label="Mã tài khoản" value={profile.id} />
            <InfoRow icon={Mail} label="Email" value={profile.email} />
            <InfoRow icon={Building} label="Bộ môn" value={profile.department ?? "-"} />
            <InfoRow icon={Users} label="Loại tài khoản" value={ROLE_LABELS[profile.accountRole] ?? profile.accountRole} />
            <InfoRow icon={BookOpen} label="MSSV" value={profile.studentId ?? "-"} />
            <InfoRow icon={GraduationCap} label="MSGV" value={profile.lecturerId ?? "-"} />
          </div>
        </div>
      </div>

      {profile.accountRole === "STUDENT" && (
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <Award className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-on-surface">Tiến độ học vụ</h3>
          </div>
          <div className="space-y-3 text-sm">
            <p className="text-on-surface-variant">
              Tín chỉ: <span className="font-semibold text-on-surface">{earnedCredits}</span>
              {requiredCredits > 0 ? (
                <>
                  /<span className="font-semibold text-on-surface">{requiredCredits}</span>
                </>
              ) : null}
            </p>
            <p className="text-on-surface-variant">
              Điểm BCTT: <span className="font-semibold text-on-surface">{(profile.completedBcttScore ?? 0).toFixed(2)}</span>
            </p>
            <p className="flex items-center gap-2 text-on-surface-variant">
              {profile.canRegisterKltn ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600" />
              )}
              <span>
                {profile.canRegisterKltn
                  ? "Đủ điều kiện đăng ký KLTN"
                  : "Chưa đủ điều kiện đăng ký KLTN"}
              </span>
            </p>
          </div>
        </div>
      )}

      {(profile.accountRole === "LECTURER" || profile.accountRole === "TBM") && totalQuota > 0 && (
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-on-surface">Thông tin quota hướng dẫn</h3>
          </div>
          <p className="text-sm text-on-surface-variant">
            Đã sử dụng <span className="font-semibold text-on-surface">{quotaUsed}</span> /{" "}
            <span className="font-semibold text-on-surface">{totalQuota}</span> quota.
          </p>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-4 border-b border-outline-variant/10 md:[&:nth-last-child(-n+2)]:border-b-0 md:[&:nth-child(odd)]:border-r md:[&:nth-child(odd)]:border-outline-variant/10">
      <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-on-surface-variant" />
      </div>
      <div>
        <p className="text-xs text-on-surface-variant">{label}</p>
        <p className="text-sm font-semibold text-on-surface mt-0.5">{value}</p>
      </div>
    </div>
  );
}
