"use client";

import { useState, useEffect } from "react";
import { Settings2, UserCircle, X } from "lucide-react";

const ROLES = [
  { id: "STUDENT", label: "Sinh viên" },
  { id: "LECTURER", label: "Giảng viên (tổng quát)" },
  { id: "GVHD", label: "Giảng viên HD" },
  { id: "GVPB", label: "Giảng viên PB" },
  { id: "TBM", label: "Trưởng bộ môn" },
  { id: "TV_HD", label: "Thành viên HĐ" },
  { id: "CT_HD", label: "Chủ tịch HĐ" },
  { id: "TK_HD", label: "Thư ký HĐ" },
];

function inferAccountRole(roleId: string): "STUDENT" | "LECTURER" | "TBM" {
  if (roleId === "STUDENT") return "STUDENT";
  if (roleId === "TBM") return "TBM";
  return "LECTURER";
}

export function RoleSwitcher() {
  const isProduction = process.env.NODE_ENV === "production";

  const [isOpen, setIsOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState("STUDENT");

  useEffect(() => {
    if (isProduction) return;

    // Read cookie on mount
    const match = document.cookie.match(new RegExp('(^| )user_role=([^;]+)'));
    if (match) {
      setCurrentRole(match[2]);
    }
  }, [isProduction]);

  if (isProduction) {
    return null;
  }

  const handleSwitch = (roleId: string) => {
    const accountRole = inferAccountRole(roleId);
    const maxAge = 7 * 24 * 60 * 60;

    localStorage.setItem("kltn_user_role", roleId);
    localStorage.setItem("kltn_account_role", accountRole);

    document.cookie = `user_role=${roleId}; path=/; max-age=${maxAge}; samesite=lax`;
    document.cookie = `account_role=${accountRole}; path=/; max-age=${maxAge}; samesite=lax`;

    setIsOpen(false);
    window.location.href = "/";
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-64 bg-white/90 backdrop-blur-xl border border-outline-variant/20 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5">
          <div className="flex items-center justify-between p-4 border-b border-outline-variant/10 bg-surface-container-low">
            <h3 className="font-headline font-bold text-sm text-on-surface flex items-center gap-2">
              <UserCircle className="w-4 h-4 text-primary" />
              Chuyển đổi Role (Dev)
            </h3>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-on-surface-variant hover:text-error transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {ROLES.map((role) => (
              <button
                key={role.id}
                onClick={() => handleSwitch(role.id)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-between ${
                  currentRole === role.id 
                    ? "bg-primary text-white shadow-md shadow-primary/20" 
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                {role.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${currentRole === role.id ? "bg-white/20" : "bg-outline-variant/30 text-outline"}`}>
                  {role.id}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-[#0b1c30] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
        title="Đổi Role (Dev Only)"
      >
        <Settings2 className="w-5 h-5" />
      </button>
    </div>
  );
}
