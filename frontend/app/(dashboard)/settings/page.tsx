"use client";

import { BellRing, Monitor, Shield } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-headline text-on-surface">Cài đặt tài khoản</h1>
        <p className="text-sm text-outline mt-1">
          Quản lý tùy chọn giao diện, thông báo và bảo mật cho tài khoản hiện tại.
        </p>
      </div>

      <div className="grid gap-6">
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <Monitor className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-on-surface">Giao diện</h2>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-outline-variant/10">
            <div>
              <p className="text-sm font-semibold text-on-surface">Chế độ hiển thị</p>
              <p className="text-xs text-outline mt-0.5">
                Chọn chế độ sáng/tối hoặc tự động theo hệ điều hành.
              </p>
            </div>
            <select className="px-3 py-1.5 bg-surface-container rounded-lg border border-outline-variant/20 text-sm">
              <option>Theo hệ thống</option>
              <option>Sáng (Light)</option>
              <option>Tối (Dark)</option>
            </select>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <BellRing className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-on-surface">Thông báo</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/10">
              <p className="text-sm font-semibold text-on-surface">
                Nhận email khi có thông báo mới
              </p>
              <input
                type="checkbox"
                className="w-4 h-4 text-primary bg-surface-container border-outline-variant/20"
                defaultChecked
              />
            </div>
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/10">
              <p className="text-sm font-semibold text-on-surface">
                Nhắc nhở khi gần đến hạn nộp/chấm điểm
              </p>
              <input
                type="checkbox"
                className="w-4 h-4 text-primary bg-surface-container border-outline-variant/20"
                defaultChecked
              />
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-on-surface">Bảo mật phiên đăng nhập</h2>
          </div>
          <p className="text-sm text-on-surface-variant">
            Bạn có thể đăng xuất khỏi tất cả thiết bị bằng cách đăng xuất và đăng nhập lại.
            Hệ thống sẽ tự động cập nhật token phiên đăng nhập.
          </p>
        </div>
      </div>
    </div>
  );
}
