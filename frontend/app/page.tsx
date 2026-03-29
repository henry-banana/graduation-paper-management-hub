"use client";

import Image from "next/image";
import { useState } from "react";

export default function HomePage() {
  const [loginType, setLoginType] = useState<"student" | "teacher" | null>(null);

  const handleLogin = () => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:3001/api/v1";
    window.location.href = `${apiUrl}/auth/google`;
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/background-login.webp"
          alt="UTE Campus Background"
          fill
          className="object-cover object-center"
          priority
          quality={90}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b1c30]/85 via-[#00335b]/70 to-[#004a80]/60" />
        {/* Light noise grain */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")" }} />
      </div>

      {/* White divider line (frosted glass panel) */}
      <div className="relative z-10 w-full max-w-4xl mx-4">
        {/* Header: Logo + School name */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 relative mb-4 drop-shadow-xl">
            <Image
              src="/logo-ute.png"
              alt="Logo Đại học Sư phạm Kỹ thuật TP.HCM"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-white text-center font-headline font-bold text-lg md:text-xl tracking-wide drop-shadow-md">
            TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP.HCM
          </h1>

          {/* White frosted separator line */}
          <div className="mt-3 w-64 h-px bg-white/30" />

          <h2 className="text-white/90 text-center font-headline font-semibold text-sm md:text-base tracking-[0.15em] mt-3 uppercase">
            HỆ THỐNG QUẢN LÝ KHÓA LUẬN TỐT NGHIỆP
          </h2>
        </div>

        {/* Login Panel */}
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
          {/* Panel Header */}
          <div className="px-8 pt-8 pb-6 text-center border-b border-white/10">
            <h3 className="text-white font-headline text-2xl font-bold">ĐĂNG NHẬP</h3>
            <p className="text-white/60 text-sm mt-2 font-body">
              Cổng hệ thống quản lý khóa luận tốt nghiệp
            </p>
          </div>

          {/* Two-column: Student | Teacher */}
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10">
            {/* Student Column */}
            <div className="p-8 flex flex-col items-center gap-6">
              <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              </div>
              <div className="text-center">
                <h4 className="text-white font-semibold text-lg font-headline">Sinh viên</h4>
                <p className="text-white/50 text-xs mt-1 font-body">Dành cho sinh viên BCTT & KLTN</p>
              </div>
              <button
                onClick={handleLogin}
                className="group w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white rounded-2xl font-semibold text-[#00335b] hover:bg-primary-fixed hover:shadow-2xl hover:shadow-primary/20 transition-all duration-300 active:scale-95 text-sm"
              >
                <GoogleIcon />
                <span>Đăng nhập với Google</span>
              </button>
              <p className="text-white/30 text-xs text-center font-body">
                Sử dụng email <span className="text-white/60">@student.hcmute.edu.vn</span>
              </p>
            </div>

            {/* Teacher Column */}
            <div className="p-8 flex flex-col items-center gap-6">
              <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                </svg>
              </div>
              <div className="text-center">
                <h4 className="text-white font-semibold text-lg font-headline">Giảng viên</h4>
                <p className="text-white/50 text-xs mt-1 font-body">Dành cho GVHD, GVPB, Hội đồng & TBM</p>
              </div>
              <button
                onClick={handleLogin}
                className="group w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white rounded-2xl font-semibold text-[#00335b] hover:bg-primary-fixed hover:shadow-2xl hover:shadow-primary/20 transition-all duration-300 active:scale-95 text-sm"
              >
                <GoogleIcon />
                <span>Đăng nhập với Google</span>
              </button>
              <p className="text-white/30 text-xs text-center font-body">
                Sử dụng email <span className="text-white/60">@hcmute.edu.vn</span>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-5 border-t border-white/10 text-center">
            <p className="text-white/30 text-xs font-body">
              © 2024 Trường ĐH Sư phạm Kỹ thuật TP.HCM • Khoa CNTT
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
