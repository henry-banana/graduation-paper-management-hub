"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";

function AuthErrorContent() {
  const searchParams = useSearchParams();

  const message = useMemo(() => {
    const raw = searchParams.get("message");
    return raw || "Hệ thống không thể xác thực tài khoản Google của bạn.";
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-8 shadow-sm">
        <div className="flex items-start gap-3 text-error">
          <AlertCircle className="w-5 h-5 mt-0.5" />
          <div>
            <h1 className="text-lg font-bold text-on-surface">Đăng nhập thất bại</h1>
            <p className="text-sm mt-2 text-on-surface-variant">{message}</p>
          </div>
        </div>

        <Link
          href="/login"
          className="mt-6 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Thử đăng nhập lại
        </Link>
      </div>
    </main>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <AuthErrorContent />
    </Suspense>
  );
}
