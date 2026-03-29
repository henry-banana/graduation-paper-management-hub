"use client";

import { BellRing, Lock, Monitor, Shield, Smartphone } from "lucide-react";

export default function StudentSettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-headline text-on-surface">Cài đặt</h1>
        <p className="text-sm text-outline mt-1">Quản lý các ưu tiên hiển thị, bảo mật và thông báo.</p>
      </div>

      <div className="grid gap-6">
        {/* Appearance */}
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <Monitor className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-on-surface">Giao diện</h2>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-outline-variant/10">
            <div>
              <p className="text-sm font-semibold text-on-surface">Chế độ ban đêm / ban ngày</p>
              <p className="text-xs text-outline mt-0.5">Tự động thay đổi theo hệ điều hành hoặc thiết lập cứng</p>
            </div>
            <select className="px-3 py-1.5 bg-surface-container rounded-lg border border-outline-variant/20 text-sm">
              <option>Theo hệ thống</option>
              <option>Sáng (Light)</option>
              <option>Tối (Dark)</option>
            </select>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <BellRing className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-on-surface">Thông báo & Email</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/10">
              <div>
                <p className="text-sm font-semibold text-on-surface">Nhận email khi có thông báo mới từ GVHD</p>
              </div>
              <input type="checkbox" className="w-4 h-4 text-primary bg-surface-container border-outline-variant/20" defaultChecked />
            </div>
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/10">
              <div>
                <p className="text-sm font-semibold text-on-surface">Thông báo nhắc nhở hạn nộp báo cáo (trước 2 ngày)</p>
              </div>
              <input type="checkbox" className="w-4 h-4 text-primary bg-surface-container border-outline-variant/20" defaultChecked />
            </div>
          </div>
        </div>

        {/* Security / Devices */}
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-on-surface">Bảo mật & Phiên đăng nhập</h2>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center">
                <Monitor className="w-5 h-5 text-outline" />
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">Phiên hiện tại (Chrome trên Windows)</p>
                <p className="text-xs text-green-600 mt-0.5 font-medium">Đang hoạt động - IP: 192.168.1.1</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
