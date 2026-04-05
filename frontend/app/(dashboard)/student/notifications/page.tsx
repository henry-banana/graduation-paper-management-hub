"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Bell,
  AlertCircle,
  Info,
  CheckCircle2,
  ChevronRight,
  Megaphone,
  User,
} from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";

interface NotificationDto {
  id: string;
  scope?: "PERSONAL" | "GLOBAL";
  topicId?: string;
  type: string;
  title: string;
  body?: string;
  deepLink?: string;
  isRead: boolean;
  createdAt: string;
}

type UiNotificationType = "important" | "info" | "warning" | "success";

const TYPE_CONFIG: Record<
  UiNotificationType,
  {
    icon: typeof AlertCircle;
    color: string;
    bg: string;
    label: string;
    badge: string;
  }
> = {
  important: {
    icon: AlertCircle,
    color: "text-error",
    bg: "bg-error/10",
    label: "Quan trọng",
    badge: "bg-error/15 text-error",
  },
  info: {
    icon: Info,
    color: "text-primary",
    bg: "bg-primary/10",
    label: "Thông tin",
    badge: "bg-primary/10 text-primary",
  },
  warning: {
    icon: AlertCircle,
    color: "text-amber-600",
    bg: "bg-amber-50",
    label: "Lưu ý",
    badge: "bg-amber-100 text-amber-700",
  },
  success: {
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50",
    label: "Hoàn thành",
    badge: "bg-green-100 text-green-700",
  },
};

function mapTypeToUi(type: string): UiNotificationType {
  switch (type) {
    case "TOPIC_REJECTED":
      return "important";
    case "DEADLINE_REMINDER":
    case "DEADLINE_OVERDUE":
    case "SCORE_APPEAL_REQUESTED":
      return "warning";
    case "TOPIC_APPROVED":
    case "SUBMISSION_UPLOADED":
    case "SCORE_PUBLISHED":
    case "SCORE_APPEAL_RESOLVED":
      return "success";
    default:
      return "info";
  }
}

function formatDateTime(value: string): { date: string; time: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: value, time: "" };
  }

  return {
    date: date.toLocaleDateString("vi-VN"),
    time: date.toLocaleTimeString("vi-VN", { hour12: false }),
  };
}

function NotifRow({
  item,
  onClick,
}: {
  item: NotificationDto;
  onClick?: () => void;
}) {
  const uiType = mapTypeToUi(item.type);
  const cfg = TYPE_CONFIG[uiType];
  const Icon = cfg.icon;
  const formatted = formatDateTime(item.createdAt);

  return (
    <div
      onClick={onClick}
      className={`group flex items-start gap-4 px-6 py-4 hover:bg-surface-container-low/60 transition-all duration-200 cursor-pointer border-b border-outline-variant/10 last:border-0 ${!item.isRead ? "bg-primary/[0.03]" : ""}`}
    >
      <div
        className={`w-9 h-9 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}
      >
        <Icon className={`w-4.5 h-4.5 ${cfg.color}`} style={{ width: 18, height: 18 }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          {!item.isRead && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
          <div>
            <p
              className={`text-sm leading-snug ${!item.isRead ? "font-semibold text-on-surface" : "text-on-surface-variant"} group-hover:text-on-surface transition-colors`}
            >
              {item.title}
            </p>
            {item.body && <p className="text-xs text-outline mt-1 line-clamp-2">{item.body}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <span
            className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${cfg.badge}`}
          >
            {cfg.label}
          </span>
          <span className="text-xs text-outline">{item.scope === "GLOBAL" ? "Thông báo chung" : "Cá nhân"}</span>
          <span className="text-xs text-outline/60">
            {formatted.date} {formatted.time}
          </span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-outline/40 group-hover:text-primary transition-colors mt-1 flex-shrink-0" />
    </div>
  );
}

function StudentNotificationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"general" | "personal">("general");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSearch(searchParams.get("q") ?? "");
  }, [searchParams]);

  const loadNotifications = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<ApiListResponse<NotificationDto>>(
        "/notifications?page=1&size=100",
      );
      setNotifications(response.data);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Không thể tải thông báo.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  const generalNotifications = useMemo(() => {
    return notifications.filter(
      (notification) =>
        notification.scope === "GLOBAL" ||
        (!notification.scope && !notification.topicId),
    );
  }, [notifications]);

  const personalNotifications = useMemo(() => {
    return notifications.filter(
      (notification) =>
        notification.scope === "PERSONAL" ||
        (!notification.scope && Boolean(notification.topicId)),
    );
  }, [notifications]);

  const list = tab === "general" ? generalNotifications : personalNotifications;

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return list;
    }

    return list.filter((notification) => {
      const title = notification.title.toLowerCase();
      const body = notification.body?.toLowerCase() ?? "";
      return title.includes(keyword) || body.includes(keyword);
    });
  }, [list, search]);

  const unreadGeneral = generalNotifications.filter(
    (notification) => !notification.isRead,
  ).length;
  const unreadPersonal = personalNotifications.filter(
    (notification) => !notification.isRead,
  ).length;

  const handleOpenNotification = async (notification: NotificationDto) => {
    try {
      if (!notification.isRead) {
        await api.patch<ApiResponse<{ updated: boolean }>>(
          `/notifications/${notification.id}/read`,
          { isRead: true },
        );

        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notification.id ? { ...item, isRead: true } : item,
          ),
        );
      }

      router.push(`/student/notifications/${notification.id}`);
    } catch (markError) {
      const message =
        markError instanceof Error
          ? markError.message
          : "Không thể cập nhật trạng thái thông báo.";
      setError(message);
    }
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications
      .filter((notification) => !notification.isRead)
      .map((notification) => notification.id);

    if (!unreadIds.length) {
      return;
    }

    try {
      await api.post<ApiResponse<{ updatedCount: number }>>(
        "/notifications/read-bulk",
        {
          notificationIds: unreadIds,
        },
      );

      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (markError) {
      const message =
        markError instanceof Error ? markError.message : "Không thể đánh dấu đã đọc.";
      setError(message);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">
            Thông báo
          </h1>
          <p className="text-sm text-outline mt-1 font-body">
            Nhận thông tin về đăng ký đề tài, xác nhận GVHD và kết quả điểm.
          </p>
        </div>
        <button
          type="button"
          onClick={handleMarkAllRead}
          className="flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Đánh dấu tất cả đã đọc
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-error mt-0.5 flex-shrink-0" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden shadow-sm">
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

        <div className="px-6 py-4 border-b border-outline-variant/10">
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="text"
              placeholder="Tìm kiếm thông báo..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface-container rounded-xl border border-outline-variant/15 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-on-surface placeholder:text-outline/60"
            />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-3 bg-surface-container/40 border-b border-outline-variant/10">
          <span className="text-xs font-bold uppercase tracking-widest text-outline">Tiêu đề</span>
          <span className="text-xs font-bold uppercase tracking-widest text-outline text-right">Nguồn</span>
          <span className="text-xs font-bold uppercase tracking-widest text-outline text-right w-32">Thời gian gửi</span>
        </div>

        <div>
          {isLoading ? (
            <div className="p-6 text-sm text-outline">Đang tải thông báo...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-outline">
              <Bell className="w-10 h-10 text-outline/30" />
              <p className="text-sm">Không có thông báo nào</p>
            </div>
          ) : (
            filtered.map((item) => (
              <NotifRow
                key={item.id}
                item={item}
                onClick={() => void handleOpenNotification(item)}
              />
            ))
          )}
        </div>

        {filtered.length > 0 && (
          <div className="px-6 py-4 border-t border-outline-variant/10 text-center">
            <p className="text-xs text-outline">
              Hiển thị {filtered.length} / {list.length} thông báo
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudentNotificationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-outline">Đang tải...</div>}>
      <StudentNotificationsContent />
    </Suspense>
  );
}
