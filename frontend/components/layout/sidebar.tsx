"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X, BookOpen, Clock, CheckSquare, Users, FileText, Bell, ClipboardList, ChevronRight, LogOut } from "lucide-react";

const ROLE_LABELS: Record<string, { label: string; color: string; abbr: string }> = {
  STUDENT: { label: "Sinh viên", color: "bg-blue-500", abbr: "SV" },
  GVHD: { label: "GV Hướng dẫn", color: "bg-green-600", abbr: "HD" },
  GVPB: { label: "GV Phản biện", color: "bg-purple-600", abbr: "PB" },
  TBM: { label: "Thư ký BM", color: "bg-orange-500", abbr: "TK" },
  TV_HD: { label: "Thành viên HĐ", color: "bg-indigo-600", abbr: "TV" },
  TK_HD: { label: "Thư ký HĐ", color: "bg-teal-600", abbr: "TK" },
  CT_HD: { label: "Chủ tịch HĐ", color: "bg-red-600", abbr: "CT" },
};

const routes: Record<string, { name: string; path: string; icon: any }[]> = {
  STUDENT: [
    { name: "Thông báo", path: "/student/notifications", icon: Bell },
    { name: "Thông tin sinh viên", path: "/student/profile", icon: Users },
    { name: "Đăng ký đề tài", path: "/student/topics/register", icon: BookOpen },
    { name: "Đề tài của tôi", path: "/student/topics", icon: ClipboardList },
  ],
  GVHD: [
    { name: "Duyệt đề tài", path: "/gvhd/pending", icon: Clock },
    { name: "Tiến độ hướng dẫn", path: "/gvhd/topics", icon: BookOpen },
    { name: "Chấm điểm (Rubric)", path: "/gvhd/scoring", icon: CheckSquare },
    { name: "Thông báo", path: "/notifications", icon: Bell },
  ],
  GVPB: [
    { name: "Hồ sơ phản biện", path: "/gvpb/reviews", icon: CheckSquare },
    { name: "Thông báo", path: "/notifications", icon: Bell },
  ],
  TBM: [
    { name: "Quản lý đợt", path: "/tbm/periods", icon: Clock },
    { name: "Phân công hội đồng", path: "/tbm/assignments", icon: Users },
    { name: "Lịch trình bảo vệ", path: "/tbm/schedules", icon: FileText },
    { name: "Lịch sử xuất file", path: "/exports", icon: ClipboardList },
  ],
  TV_HD: [
    { name: "Chấm điểm HĐ", path: "/council/scoring", icon: CheckSquare },
  ],
  TK_HD: [
    { name: "Tổng hợp điểm", path: "/council/summary", icon: FileText },
  ],
  CT_HD: [
    { name: "Chấm điểm HĐ", path: "/council/scoring", icon: CheckSquare },
    { name: "Xác nhận công bố", path: "/council/final-confirm", icon: CheckSquare },
  ],
};

export function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (val: boolean) => void }) {
  const pathname = usePathname();
  const [role, setRole] = useState("STUDENT");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const match = document.cookie.match(new RegExp("(^| )user_role=([^;]+)"));
    if (match) setRole(match[2]);
  }, []);

  const currentRoutes = routes[role] || routes["STUDENT"];
  const roleInfo = ROLE_LABELS[role] || { label: role, color: "bg-primary", abbr: role.substring(0, 2) };
  
  // Find the longest matching route to prevent parent routes from highlighting when on a child route
  const activeRoute = mounted ? [...currentRoutes].sort((a, b) => b.path.length - a.path.length).find(r => pathname === r.path || pathname?.startsWith(r.path + "/")) : null;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col transform transition-all duration-300 ease-in-out md:translate-x-0 md:static md:flex-shrink-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: "linear-gradient(160deg, #0b1c30 0%, #00335b 50%, #004a80 100%)" }}
      >
        {/* Top: Logo + School Name */}
        <div className="relative px-6 pt-8 pb-6 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 relative flex-shrink-0">
              <Image src="/logo-ute.png" alt="UTE Logo" fill className="object-contain" />
            </div>
            <div>
              <h1 className="text-white font-headline font-bold text-sm leading-tight">Sư Phạm KT TP.HCM</h1>
              <p className="text-white/50 text-[10px] mt-0.5 font-label uppercase tracking-wider">KLTN Hub</p>
            </div>
          </div>
          <button className="md:hidden text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors" onClick={() => setIsOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role badge */}
        <div className="px-4 py-3 mx-4 mt-4 bg-white/5 border border-white/10 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${roleInfo.color} flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-inner`}>
              {roleInfo.abbr}
            </div>
            <div>
              <p className="text-white text-sm font-semibold leading-tight">{roleInfo.label}</p>
              <p className="text-white/40 text-[10px] mt-0.5">Vai trò hiện tại</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          <p className="text-white/30 text-[10px] uppercase tracking-widest font-label px-3 mb-3">Điều hướng</p>
          {currentRoutes.map((route) => {
            const Icon = route.icon;
            const isActive = activeRoute?.path === route.path;

            return (
              <Link
                key={route.path}
                href={route.path}
                className={`group flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-200 ${
                  isActive
                    ? "bg-white text-[#00335b] shadow-lg"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
                onClick={() => setIsOpen(false)}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4.5 h-4.5 ${isActive ? "text-primary" : "text-white/60 group-hover:text-white"}`} style={{ width: "18px", height: "18px" }} />
                  <span className="font-medium text-sm">{route.name}</span>
                </div>
                {isActive && <ChevronRight className="w-4 h-4 text-primary/60" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer: logout */}
        <div className="p-4 border-t border-white/10">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-white/50 hover:text-white hover:bg-white/10 transition-all text-sm">
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
    </>
  );
}
