"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { ApiResponse, api } from "@/lib/api";
import {
  AccountRole,
  clearAuthSession,
  setCurrentRoles,
  setAuthSession,
  setUserProfile,
  UiRole,
} from "@/lib/auth/session";

interface AuthMeDto {
  id: string;
  email: string;
  fullName: string;
  accountRole: AccountRole;
  uiRole?: UiRole;
}

function getRedirectPath(accountRole: AccountRole, uiRole?: UiRole): string {
  if (accountRole === "STUDENT") {
    return "/student/notifications";
  }

  if (accountRole === "TBM") {
    return "/tbm/periods";
  }

  if (uiRole === "GVPB") {
    return "/gvpb/reviews";
  }

  if (uiRole === "TV_HD") {
    return "/council/scoring";
  }

  if (uiRole === "TK_HD") {
    return "/council/summary";
  }

  if (uiRole === "CT_HD") {
    return "/council/final-confirm";
  }

  return "/gvhd/pending";
}

function AuthCallbackLoading() {
  return (
    <main className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-8 shadow-sm text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
        <h1 className="text-lg font-bold text-on-surface mt-4">Đang hoàn tất đăng nhập...</h1>
        <p className="text-sm text-on-surface-variant mt-2">Hệ thống đang thiết lập phiên làm việc của bạn.</p>
      </div>
    </main>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const accessToken = useMemo(() => searchParams.get("accessToken"), [searchParams]);
  const refreshToken = useMemo(() => searchParams.get("refreshToken"), [searchParams]);
  const expiresInRaw = useMemo(() => searchParams.get("expiresIn"), [searchParams]);

  useEffect(() => {
    const bootstrapSession = async () => {
      if (!accessToken) {
        setError("Không nhận được access token từ hệ thống đăng nhập.");
        return;
      }

      const expiresIn = Number(expiresInRaw || "3600");
      if (Number.isNaN(expiresIn) || expiresIn <= 0) {
        setError("Giá trị expiresIn không hợp lệ.");
        return;
      }

      try {
        clearAuthSession();
        setAuthSession({
          accessToken,
          refreshToken: refreshToken ?? undefined,
          expiresIn,
        });
        api.setToken(accessToken);

        const response = await api.get<ApiResponse<AuthMeDto>>("/auth/me");
        setUserProfile(response.data);
        if (response.data.uiRole) {
          setCurrentRoles(response.data.accountRole, response.data.uiRole);
        }

        router.replace(getRedirectPath(response.data.accountRole, response.data.uiRole));
      } catch (callbackError) {
        clearAuthSession();
        const message =
          callbackError instanceof Error
            ? callbackError.message
            : "Đăng nhập thất bại. Vui lòng thử lại.";
        setError(message);
      }
    };

    void bootstrapSession();
  }, [accessToken, expiresInRaw, refreshToken, router]);

  if (error) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-8 shadow-sm">
          <div className="flex items-start gap-3 text-error">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div>
              <h1 className="text-lg font-bold text-on-surface">Đăng nhập không thành công</h1>
              <p className="text-sm mt-2 text-on-surface-variant">{error}</p>
            </div>
          </div>

          <Link
            href="/login"
            className="mt-6 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Quay về trang đăng nhập
          </Link>
        </div>
      </main>
    );
  }

  return <AuthCallbackLoading />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackLoading />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
