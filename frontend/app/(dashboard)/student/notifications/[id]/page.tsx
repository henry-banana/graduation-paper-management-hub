"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  Info,
  CheckCircle2,
  Megaphone,
  Bell,
  ExternalLink,
  Clock,
} from "lucide-react";
import { ApiResponse, api } from "@/lib/api";
import { resolveStudentNotificationLink } from "@/lib/notifications";

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

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  TOPIC_REJECTED: "Đề tài bị từ chối",
  TOPIC_APPROVED: "Đề tài được duyệt",
  DEADLINE_REMINDER: "Nhắc nhở deadline",
  DEADLINE_OVERDUE: "Đề tài quá hạn",
  SUBMISSION_UPLOADED: "Bài nộp thành công",
  SCORE_PUBLISHED: "Điểm đã được công bố",
  SYSTEM: "Hệ thống",
};

function mapTypeToUi(type: string): UiNotificationType {
  switch (type) {
    case "TOPIC_REJECTED":
      return "important";
    case "DEADLINE_REMINDER":
    case "DEADLINE_OVERDUE":
      return "warning";
    case "TOPIC_APPROVED":
    case "SUBMISSION_UPLOADED":
    case "SCORE_PUBLISHED":
      return "success";
    default:
      return "info";
  }
}

const TYPE_CONFIG: Record<
  UiNotificationType,
  {
    icon: typeof AlertCircle;
    color: string;
    bg: string;
    border: string;
    label: string;
    badge: string;
  }
> = {
  important: {
    icon: AlertCircle,
    color: "text-error",
    bg: "bg-error/5",
    border: "border-error/20",
    label: "Quan trọng",
    badge: "bg-error/10 text-error",
  },
  info: {
    icon: Info,
    color: "text-primary",
    bg: "bg-primary/5",
    border: "border-primary/20",
    label: "Thông tin",
    badge: "bg-primary/10 text-primary",
  },
  warning: {
    icon: AlertCircle,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    label: "Lưu ý",
    badge: "bg-amber-100 text-amber-700",
  },
  success: {
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    label: "Hoàn thành",
    badge: "bg-green-100 text-green-700",
  },
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", { hour12: false });
}

function resolveTopicLink(notification: NotificationDto): string | null {
  const resolved = resolveStudentNotificationLink(notification);
  if (!resolved || resolved === "/student/notifications") {
    return null;
  }

  return resolved;
}

export default function NotificationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const notifId = typeof params?.id === "string" ? params.id : "";

  const [notification, setNotification] = useState<NotificationDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!notifId) return;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await api.get<ApiResponse<NotificationDto>>(
          `/notifications/${notifId}`,
        );
        setNotification(res.data);

        // Mark as read silently
        if (!res.data.isRead) {
          void api
            .patch<ApiResponse<{ updated: boolean }>>(
              `/notifications/${notifId}/read`,
              { isRead: true },
            )
            .catch(() => {
              /* silent fail */
            });
        }
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

    void load();
  }, [notifId]);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2 text-sm text-outline animate-pulse">
          <Bell className="w-4 h-4" />
          Đang tải thông báo...
        </div>
      </div>
    );
  }

  if (error || !notification) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Link
          href="/student/notifications"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-outline hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại Thông báo
        </Link>
        <div className="flex items-start gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-error mt-0.5 flex-shrink-0" />
          <p className="text-sm text-error">
            {error ?? "Không tìm thấy thông báo này."}
          </p>
        </div>
      </div>
    );
  }

  const uiType = mapTypeToUi(notification.type);
  const cfg = TYPE_CONFIG[uiType];
  const Icon = cfg.icon;
  const topicLink = resolveTopicLink(notification);
  const typeLabel =
    NOTIFICATION_TYPE_LABELS[notification.type] ?? NOTIFICATION_TYPE_LABELS["SYSTEM"];

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      {/* Back */}
      <Link
        href="/student/notifications"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-outline hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Quay lại Thông báo
      </Link>

      {/* Main Card */}
      <div
        className={`rounded-3xl border overflow-hidden shadow-sm ${cfg.border} ${cfg.bg}`}
      >
        {/* Header */}
        <div className={`px-8 py-6 border-b ${cfg.border}`}>
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-white/70 border ${cfg.border}`}
            >
              <Icon className={`w-6 h-6 ${cfg.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span
                  className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${cfg.badge}`}
                >
                  {cfg.label}
                </span>
                <span className="text-[10px] font-semibold text-outline uppercase tracking-widest bg-surface-container px-2.5 py-1 rounded-full">
                  {typeLabel}
                </span>
                <span className="text-[10px] font-semibold text-outline uppercase tracking-widest bg-surface-container px-2.5 py-1 rounded-full">
                  {notification.scope === "GLOBAL" ? "Thông báo chung" : "Cá nhân"}
                </span>
              </div>
              <h1 className="text-lg font-bold text-on-surface font-headline leading-snug">
                {notification.title}
              </h1>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 bg-surface-container-lowest">
          {notification.body ? (
            <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
              {notification.body}
            </p>
          ) : (
            <p className="text-sm text-outline italic">
              Thông báo không có nội dung chi tiết.
            </p>
          )}
        </div>

        {/* Footer metadata */}
        <div className={`px-8 py-4 border-t ${cfg.border} bg-white/30 flex items-center gap-6 flex-wrap text-xs text-outline`}>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {formatDateTime(notification.createdAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <Megaphone className="w-3.5 h-3.5" />
            {notification.scope === "GLOBAL" ? "Hệ thống" : "Cá nhân"}
          </span>
          {!notification.isRead && (
            <span className="flex items-center gap-1.5 text-primary font-semibold">
              <span className="w-2 h-2 rounded-full bg-primary" />
              Chưa đọc
            </span>
          )}
        </div>
      </div>

      {/* CTA: Go to related topic */}
      {topicLink && (
        <Link
          href={topicLink}
          className="flex items-center justify-between gap-4 px-6 py-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 hover:bg-primary/5 hover:border-primary/20 transition-colors group"
        >
          <div>
            <p className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
              Xem đề tài liên quan
            </p>
            <p className="text-xs text-outline mt-0.5">
              Nhấn để mở trang chi tiết đề tài
            </p>
          </div>
          <ExternalLink className="w-4 h-4 text-outline group-hover:text-primary transition-colors flex-shrink-0" />
        </Link>
      )}

      {/* Action: Back */}
      <button
        type="button"
        onClick={() => router.back()}
        className="w-full py-3 rounded-2xl border border-outline-variant/20 text-sm font-semibold text-outline hover:text-on-surface hover:border-outline-variant/40 transition-colors"
      >
        Quay lại trang trước
      </button>
    </div>
  );
}
