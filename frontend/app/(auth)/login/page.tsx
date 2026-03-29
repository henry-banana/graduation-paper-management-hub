"use client";

import Image from "next/image";

export default function LoginPage() {
  const handleLogin = () => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      'http://localhost:3001/api/v1';
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
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b1c30]/85 via-[#00335b]/70 to-[#004a80]/60" />
      </div>

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo + School */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 relative mb-4 drop-shadow-xl">
            <Image
              src="/logo-ute.png"
              alt="Logo UTE"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-white text-center font-headline font-bold text-lg tracking-wide drop-shadow-md">
            TRƯỜNG ĐH SƯ PHẠM KỸ THUẬT TP.HCM
          </h1>
          <div className="mt-3 w-56 h-px bg-white/30" />
          <h2 className="text-white/90 text-center font-semibold text-sm tracking-[0.15em] mt-3 uppercase">
            HỆ THỐNG QUẢN LÝ KHÓA LUẬN TỐT NGHIỆP
          </h2>
        </div>

        {/* Login Card */}
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
          <div className="px-8 pt-8 pb-6 text-center border-b border-white/10">
            <h3 className="text-white font-headline text-2xl font-bold">ĐĂNG NHẬP</h3>
            <p className="text-white/60 text-sm mt-2 font-body">
              Cổng hệ thống quản lý khóa luận tốt nghiệp
            </p>
          </div>

          <div className="p-8">
            <button
              id="google-login-btn"
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white rounded-2xl font-semibold text-[#00335b] hover:bg-gray-50 hover:shadow-2xl hover:shadow-black/10 transition-all duration-300 active:scale-95 text-sm"
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Đăng nhập với Google</span>
            </button>
            <p className="text-white/40 text-xs text-center mt-4 font-body">
              Sử dụng tài khoản Google của nhà trường cấp
            </p>
          </div>

          <div className="px-8 py-5 border-t border-white/10 text-center">
            <p className="text-white/30 text-xs font-body">
              © 2024 Trường ĐH Sư phạm Kỹ thuật TP.HCM
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
