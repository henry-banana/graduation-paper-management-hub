"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Menu, Bell, ChevronDown, LogOut, Settings, UserCircle } from "lucide-react";
import { ApiResponse, getApiBaseUrl, api } from "@/lib/api";
import {
  clearAuthSession,
  getCurrentUiRole,
  getRefreshToken,
  getUserProfile,
} from "@/lib/auth/session";

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

const ROLE_ABBR: Record<string, string> = {
  STUDENT: "SV",
  LECTURER: "GV",
  GVHD: "HD",
  GVPB: "PB",
  TBM: "TBM",
  TV_HD: "TV",
  TK_HD: "TK",
  CT_HD: "CT",
};

export function Header({ setIsSidebarOpen }: { setIsSidebarOpen: (val: boolean) => void }) {
  const router = useRouter();
  const [role, setRole] = useState("STUDENT");
  const [fullName, setFullName] = useState("Tài khoản");
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const currentRole = getCurrentUiRole();
    setRole(currentRole);

    const profile = getUserProfile();
    if (profile?.fullName) {
      setFullName(profile.fullName);
    }

    const loadUnreadCount = async () => {
      try {
        const response = await api.get<ApiResponse<{ unreadCount: number }>>(
          "/notifications/unread-count",
        );
        setUnreadCount(response.data.unreadCount);
      } catch {
        setUnreadCount(0);
      }
    };

    void loadUnreadCount();
  }, []);

  const notificationPath = role === "STUDENT" ? "/student/notifications" : "/notifications";

  const handleLogout = async () => {
    const refreshToken = getRefreshToken();

    try {
      if (refreshToken) {
        await fetch(`${getApiBaseUrl()}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken }),
          credentials: "include",
        });
      }
    } catch {
      // Keep local logout behavior even when remote logout fails.
    } finally {
      clearAuthSession();
      setShowDropdown(false);
      router.replace("/login");
    }
  };

  return (
    <header className="bg-surface/80 backdrop-blur-xl sticky top-0 z-40 w-full border-b border-outline-variant/10 shadow-[0_4px_30px_rgba(11,28,48,0.04)]">
      <div className="flex items-center justify-between px-4 md:px-6 h-16">
        {/* Left: hamburger */}
        <div className="flex items-center gap-3">
          <button
            className="md:hidden p-2 -ml-1 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors active:scale-95"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Mở menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Right: notifications + user */}
        <div className="flex items-center gap-1">
          {/* Notification bell */}
          <Link
            href={notificationPath}
            className="relative p-2 text-on-surface-variant hover:bg-primary/5 hover:text-primary rounded-full transition-colors active:scale-95"
            aria-label="Thông báo"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>

          {/* User dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-surface-container transition-colors ml-1"
            >
              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{ROLE_ABBR[role] ?? role.substring(0, 2)}</span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-on-surface leading-tight">{fullName}</p>
                <p className="text-[10px] text-outline">{ROLE_LABELS[role] || role}</p>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-outline transition-transform ${showDropdown ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown menu */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-52 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/10 py-2 z-50">
                <div className="px-4 py-3 border-b border-outline-variant/10">
                  <p className="text-sm font-semibold text-on-surface">Tài khoản</p>
                  <p className="text-xs text-outline mt-0.5">{fullName}</p>
                  <p className="text-xs text-outline mt-0.5">{ROLE_LABELS[role] || role}</p>
                </div>
                <Link href={role === "STUDENT" ? "/student/profile" : "/profile"} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors">
                  <UserCircle className="w-4 h-4" />
                  Hồ sơ cá nhân
                </Link>
                <Link href={role === "STUDENT" ? "/student/settings" : "/settings"} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors">
                  <Settings className="w-4 h-4" />
                  Cài đặt
                </Link>
                <div className="border-t border-outline-variant/10 mt-2 pt-2">
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error-container/20 transition-colors rounded-b-2xl"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
