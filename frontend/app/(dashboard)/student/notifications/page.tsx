"use client";

import { useState } from "react";
import { Search, Bell, AlertCircle, Info, CheckCircle2, ChevronRight, Megaphone, User } from "lucide-react";

const GENERAL_NOTIFICATIONS = [
  { id: "g1", title: "Thông báo về việc công bố lịch thi học kỳ 2/2025-2026 ĐỢT 1 cho sinh viên", sender: "PDT_Phạm Thị Thúy Hạnh", date: "24/03/2026", time: "07:37:08", type: "important", read: false },
  { id: "g2", title: "Phòng Đào tạo thông báo kết quả xét tốt nghiệp tới các Sinh viên đại học chính quy có đăng ký xét tốt nghiệp đợt 2 - Tháng 03/2026 trên trang Online của Trường.", sender: "PDT_Bùi Thị Quỳnh", date: "18/03/2026", time: "18:44:22", type: "info", read: false },
  { id: "g3", title: "Thông báo về lịch thi kiểm tra trình độ tiếng Anh đầu ra đợt thi tháng 3/2026", sender: "PDT_Phạm Thị Thúy Hạnh", date: "16/03/2026", time: "16:30:31", type: "info", read: true },
  { id: "g4", title: "Phòng Đào tạo thông báo Sinh viên có tên trong danh sách Dự kiến ĐƯỢC/KHÔNG được công nhận tốt nghiệp lần 1 ngày 09/03/2026.", sender: "PDT_Bùi Thị Quỳnh", date: "09/03/2026", time: "19:37:37", type: "important", read: true },
  { id: "g5", title: "Thông báo về việc đăng ký thi kiểm tra trình độ tiếng Anh đầu ra đợt tháng 3/2026", sender: "PDT_Phạm Thị Thúy Hạnh", date: "03/03/2026", time: "09:54:02", type: "info", read: true },
  { id: "g6", title: "Thông báo về việc rút học phần qua mạng học kỳ 2 (đợt 1) năm học 2025 - 2026 (dành cho sinh viên chính quy tại trường)", sender: "PDT_Phạm Thị Thúy Hạnh", date: "24/02/2026", time: "09:08:10", type: "info", read: true },
  { id: "g7", title: "Thông báo về việc xét cảnh báo học tập, buộc thôi học - Học kỳ 2/2025-2026 đối với sinh viên đại học chính quy.", sender: "PDT_Bùi Thị Quỳnh", date: "05/02/2026", time: "08:15:20", type: "warning", read: true },
];

const PERSONAL_NOTIFICATIONS = [
  { id: "p1", title: "GVHD Nguyễn Thị B đã xác nhận đề tài KLTN-2024-15 của bạn", sender: "Hệ thống", date: "28/03/2026", time: "14:30:00", type: "success", read: false },
  { id: "p2", title: "Đề tài KLTN-2024-15 đang chờ xác nhận từ GVHD. Thời hạn: 28/4 - vui lòng chú ý.", sender: "Hệ thống", date: "25/03/2026", time: "09:00:00", type: "warning", read: false },
  { id: "p3", title: "Bạn đã nộp báo cáo thành công vào 29/03/2026 14:30. GVHD sẽ chấm điểm trong 3-5 ngày làm việc.", sender: "Hệ thống", date: "29/03/2026", time: "14:30:22", type: "success", read: true },
];

const TYPE_CONFIG = {
  important: { icon: AlertCircle, color: "text-error", bg: "bg-error/10", label: "Quan trọng", badge: "bg-error/15 text-error" },
  info: { icon: Info, color: "text-primary", bg: "bg-primary/10", label: "Thông tin", badge: "bg-primary/10 text-primary" },
  warning: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", label: "Lưu ý", badge: "bg-amber-100 text-amber-700" },
  success: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", label: "Hoàn thành", badge: "bg-green-100 text-green-700" },
};

function NotifRow({ item, onClick }: { item: typeof GENERAL_NOTIFICATIONS[0]; onClick?: () => void }) {
  const cfg = TYPE_CONFIG[item.type as keyof typeof TYPE_CONFIG];
  const Icon = cfg.icon;
  return (
    <div
      onClick={onClick}
      className={`group flex items-start gap-4 px-6 py-4 hover:bg-surface-container-low/60 transition-all duration-200 cursor-pointer border-b border-outline-variant/10 last:border-0 ${!item.read ? "bg-primary/[0.03]" : ""}`}
    >
      <div className={`w-9 h-9 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
        <Icon className={`w-4.5 h-4.5 ${cfg.color}`} style={{ width: 18, height: 18 }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          {!item.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
          <p className={`text-sm leading-snug ${!item.read ? "font-semibold text-on-surface" : "text-on-surface-variant"} group-hover:text-on-surface transition-colors`}>
            {item.title}
          </p>
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
          <span className="text-xs text-outline">{item.sender}</span>
          <span className="text-xs text-outline/60">{item.date} {item.time}</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-outline/40 group-hover:text-primary transition-colors mt-1 flex-shrink-0" />
    </div>
  );
}

export default function StudentNotificationsPage() {
  const [tab, setTab] = useState<"general" | "personal">("general");
  const [search, setSearch] = useState("");

  const list = tab === "general" ? GENERAL_NOTIFICATIONS : PERSONAL_NOTIFICATIONS;
  const filtered = list.filter(n => n.title.toLowerCase().includes(search.toLowerCase()));
  const unreadGeneral = GENERAL_NOTIFICATIONS.filter(n => !n.read).length;
  const unreadPersonal = PERSONAL_NOTIFICATIONS.filter(n => !n.read).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">Thông báo</h1>
          <p className="text-sm text-outline mt-1 font-body">Nhận thông tin về đăng ký đề tài, xác nhận GVHD và kết quả điểm.</p>
        </div>
        <button className="flex items-center gap-2 text-xs font-semibold text-primary hover:underline">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Đánh dấu tất cả đã đọc
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden shadow-sm">
        {/* Tab bar */}
        <div className="flex border-b border-outline-variant/10">
          <button
            onClick={() => setTab("general")}
            className={`relative flex items-center gap-2.5 px-6 py-4 text-sm font-semibold transition-colors flex-1 justify-center ${tab === "general" ? "text-primary border-b-2 border-primary" : "text-outline hover:text-on-surface"}`}
          >
            <Megaphone className="w-4 h-4" />
            THÔNG BÁO CHUNG
            {unreadGeneral > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                {unreadGeneral}
              </span>
            )}
          </button>
          <div className="w-px bg-outline-variant/15 my-2" />
          <button
            onClick={() => setTab("personal")}
            className={`relative flex items-center gap-2.5 px-6 py-4 text-sm font-semibold transition-colors flex-1 justify-center ${tab === "personal" ? "text-primary border-b-2 border-primary" : "text-outline hover:text-on-surface"}`}
          >
            <User className="w-4 h-4" />
            THÔNG BÁO CÁ NHÂN
            {unreadPersonal > 0 && (
              <span className="w-5 h-5 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center">
                {unreadPersonal}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-outline-variant/10">
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              type="text"
              placeholder="Tìm kiếm thông báo..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface-container rounded-xl border border-outline-variant/15 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-on-surface placeholder:text-outline/60"
            />
          </div>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-3 bg-surface-container/40 border-b border-outline-variant/10">
          <span className="text-xs font-bold uppercase tracking-widest text-outline">Tiêu đề</span>
          <span className="text-xs font-bold uppercase tracking-widest text-outline text-right">Người gửi</span>
          <span className="text-xs font-bold uppercase tracking-widest text-outline text-right w-32">Thời gian gửi</span>
        </div>

        {/* List */}
        <div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-outline">
              <Bell className="w-10 h-10 text-outline/30" />
              <p className="text-sm">Không có thông báo nào</p>
            </div>
          ) : (
            filtered.map(item => <NotifRow key={item.id} item={item} />)
          )}
        </div>

        {filtered.length > 0 && (
          <div className="px-6 py-4 border-t border-outline-variant/10 text-center">
            <p className="text-xs text-outline">Hiển thị {filtered.length} / {list.length} thông báo</p>
          </div>
        )}
      </div>
    </div>
  );
}
