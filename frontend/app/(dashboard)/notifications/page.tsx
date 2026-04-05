"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Bell,
  AlertCircle,
  Info,
  CheckCircle2,
  ChevronRight,
  Check,
  Megaphone,
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

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: NotificationDto;
  onOpen: () => void;
}) {
  const uiType = mapTypeToUi(notification.type);
  const cfg = TYPE_CONFIG[uiType];
  const Icon = cfg.icon;
  const created = formatDateTime(notification.createdAt);
  const sourceLabel = notification.scope === "GLOBAL" ? "Thông báo chung" : "Cá nhân";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group w-full text-left flex items-start gap-4 px-6 py-4 hover:bg-surface-container-low/60 transition-all duration-200 border-b border-outline-variant/10 last:border-0 ${!notification.isRead ? "bg-primary/[0.03]" : ""}`}
    >
      <div
        className={`w-9 h-9 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}
      >
        <Icon className={`w-4.5 h-4.5 ${cfg.color}`} style={{ width: 18, height: 18 }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          {!notification.isRead && (
            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
          )}
          <div>
            <p
              className={`text-sm leading-snug ${!notification.isRead ? "font-semibold text-on-surface" : "text-on-surface-variant"} group-hover:text-on-surface transition-colors`}
            >
              {notification.title}
            </p>
            {notification.body && (
              <p className="text-xs text-outline mt-1 line-clamp-2">
                {notification.body}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span
            className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${cfg.badge}`}
          >
            {cfg.label}
          </span>
          <span className="text-xs text-outline">{sourceLabel}</span>
          <span className="text-xs text-outline/60">
            {created.date} {created.time}
          </span>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-outline/40 group-hover:text-primary transition-colors mt-1 flex-shrink-0" />
    </button>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải thông báo.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const filteredNotifications = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return notifications;
    }

    return notifications.filter((item) => {
      const title = item.title.toLowerCase();
      const body = item.body?.toLowerCase() ?? "";
      return title.includes(keyword) || body.includes(keyword);
    });
  }, [notifications, search]);

  const markAllAsRead = () => {
    const unreadIds = notifications
      .filter((item) => !item.isRead)
      .map((item) => item.id);

    if (!unreadIds.length) {
      return;
    }

    void (async () => {
      try {
        await api.post<ApiResponse<{ updatedCount: number }>>(
          "/notifications/read-bulk",
          { notificationIds: unreadIds },
        );

        setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      } catch (markError) {
        const message =
          markError instanceof Error
            ? markError.message
            : "Không thể đánh dấu đã đọc.";
        setError(message);
      }
    })();
  };

  const handleOpenNotification = (notification: NotificationDto) => {
    void (async () => {
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

        router.push(`/notifications/${notification.id}`);
      } catch (markError) {
        const message =
          markError instanceof Error
            ? markError.message
            : "Không thể cập nhật trạng thái thông báo.";
        setError(message);
      }
    })();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">
            Thông báo
          </h1>
          <p className="text-sm text-outline mt-1">
            Cập nhật các hoạt động mới nhất liên quan đến bạn.
          </p>
        </div>

        <button
          type="button"
          onClick={markAllAsRead}
          className="inline-flex items-center px-4 py-2 bg-surface-container-lowest border border-outline-variant/20 text-on-surface text-sm font-semibold rounded-xl hover:bg-surface-container transition-colors"
        >
          <Check className="w-4 h-4 mr-2 text-outline" />
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
        <div className="px-6 py-4 border-b border-outline-variant/10 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-2 text-sm text-outline">
            <Megaphone className="w-4 h-4" />
            <span>
              Chưa đọc: <strong className="text-on-surface">{unreadCount}</strong>
            </span>
          </div>

          <div className="relative w-full sm:w-80">
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

        <div className="grid grid-cols-[1fr_auto] gap-4 px-6 py-3 bg-surface-container/40 border-b border-outline-variant/10">
          <span className="text-xs font-bold uppercase tracking-widest text-outline">Tiêu đề</span>
          <span className="text-xs font-bold uppercase tracking-widest text-outline text-right">Nguồn</span>
        </div>

        <div>
          {isLoading ? (
            <div className="p-6 text-sm text-outline">Đang tải thông báo...</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-outline">
              <Bell className="w-10 h-10 text-outline/30" />
              <p className="text-sm">Không có thông báo nào</p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onOpen={() => handleOpenNotification(notification)}
              />
            ))
          )}
        </div>

        {filteredNotifications.length > 0 && (
          <div className="px-6 py-4 border-t border-outline-variant/10 text-center">
            <p className="text-xs text-outline">
              Hiển thị {filteredNotifications.length} / {notifications.length} thông báo
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
