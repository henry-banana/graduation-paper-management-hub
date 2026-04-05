"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Info,
  Loader2,
  Megaphone,
  Search,
  Send,
} from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";
import {
  getCurrentTopicRoles,
  getCurrentUiRole,
  getUserProfile,
  TopicRole,
  UiRole,
} from "@/lib/auth/session";

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

interface TopicOptionDto {
  id: string;
  title: string;
  type: "BCTT" | "KLTN";
  state: string;
  studentUserId?: string;
  supervisorUserId?: string;
  student?: { id: string; fullName: string; studentId?: string };
  supervisor?: { id?: string; fullName: string };
}

interface AssignmentDto {
  id: string;
  topicId: string;
  userId: string;
  topicRole: "GVHD" | "GVPB" | "TV_HD" | "CT_HD" | "TK_HD";
  status: "ACTIVE" | "REVOKED";
}

interface UserOptionDto {
  id: string;
  fullName: string;
  email: string;
  accountRole?: "STUDENT" | "LECTURER" | "TBM";
  studentId?: string;
  lecturerId?: string;
  isActive?: boolean;
}

interface RecipientOption {
  id: string;
  label: string;
  subLabel: string;
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

const TOPIC_QUERY_BY_TOPIC_ROLE: Record<TopicRole, string> = {
  GVHD: "gvhd",
  GVPB: "gvpb",
  TV_HD: "tv_hd",
  TK_HD: "tk_hd",
  CT_HD: "ct_hd",
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

function getTopicQueriesByRole(uiRole: UiRole, topicRoles: TopicRole[]): string[] {
  if (uiRole === "TBM") {
    return ["tbm"];
  }

  const queries = new Set<string>();
  if (uiRole === "LECTURER" || uiRole === "GVHD") {
    queries.add("gvhd");
    topicRoles.forEach((role) => {
      const mapped = TOPIC_QUERY_BY_TOPIC_ROLE[role];
      if (mapped) {
        queries.add(mapped);
      }
    });
    return Array.from(queries);
  }

  if (uiRole === "GVPB") {
    queries.add("gvpb");
  }
  if (uiRole === "TV_HD") {
    queries.add("tv_hd");
  }
  if (uiRole === "TK_HD") {
    queries.add("tk_hd");
  }
  if (uiRole === "CT_HD") {
    queries.add("ct_hd");
  }

  if (queries.size === 0) {
    queries.add("gvhd");
  }
  return Array.from(queries);
}

function mapUserToRecipient(user: UserOptionDto): RecipientOption {
  const code = user.studentId?.trim() || user.lecturerId?.trim();
  return {
    id: user.id,
    label: user.fullName,
    subLabel: code ? `${code} · ${user.email}` : user.email,
  };
}

function topicOptionLabel(topic: TopicOptionDto): string {
  const studentName = topic.student?.fullName ?? "Sinh viên";
  return `[${topic.type}] ${studentName} - ${topic.title}`;
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
  const [uiRole, setUiRole] = useState<UiRole>("LECTURER");

  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [topicOptions, setTopicOptions] = useState<TopicOptionDto[]>([]);
  const [globalRecipientOptions, setGlobalRecipientOptions] = useState<RecipientOption[]>([]);
  const [recipientOptions, setRecipientOptions] = useState<RecipientOption[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [selectedReceiverId, setSelectedReceiverId] = useState("");
  const [composeTitle, setComposeTitle] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [isLoadingTopicOptions, setIsLoadingTopicOptions] = useState(false);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [isSendingPersonal, setIsSendingPersonal] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [composeSuccess, setComposeSuccess] = useState<string | null>(null);

  const currentUserId = useMemo(() => getUserProfile()?.id ?? "", []);
  const isTbm = uiRole === "TBM";

  const loadNotifications = useCallback(async () => {
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
  }, []);

  const loadComposeTopics = useCallback(async () => {
    setIsLoadingTopicOptions(true);
    setComposeError(null);

    try {
      const nextUiRole = getCurrentUiRole();
      setUiRole(nextUiRole);
      const topicRoles = getCurrentTopicRoles();
      const roleQueries = getTopicQueriesByRole(nextUiRole, topicRoles);

      const topicResponses = await Promise.all(
        roleQueries.map((query) =>
          api.get<ApiListResponse<TopicOptionDto>>(`/topics?role=${query}&page=1&size=100`),
        ),
      );

      const topicMap = new Map<string, TopicOptionDto>();
      topicResponses.forEach((response) => {
        response.data.forEach((topic) => {
          topicMap.set(topic.id, topic);
        });
      });

      const mergedTopics = Array.from(topicMap.values()).sort((a, b) =>
        (a.student?.fullName ?? a.title).localeCompare(b.student?.fullName ?? b.title, "vi"),
      );
      setTopicOptions(mergedTopics);

      if (nextUiRole === "TBM") {
        const usersResponse = await api.get<ApiListResponse<UserOptionDto>>(
          "/users?page=1&size=100",
        );
        const mappedUsers = usersResponse.data
          .filter((user) => user.id !== currentUserId && user.isActive !== false)
          .map(mapUserToRecipient)
          .sort((a, b) => a.label.localeCompare(b.label, "vi"));
        setGlobalRecipientOptions(mappedUsers);
      } else {
        setGlobalRecipientOptions([]);
      }
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải danh sách gửi thông báo.";
      setComposeError(message);
    } finally {
      setIsLoadingTopicOptions(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void loadNotifications();
    void loadComposeTopics();
  }, [loadComposeTopics, loadNotifications]);

  useEffect(() => {
    setSelectedReceiverId("");
    setComposeSuccess(null);

    if (!selectedTopicId) {
      if (isTbm) {
        setRecipientOptions(globalRecipientOptions);
      } else {
        setRecipientOptions([]);
      }
      return;
    }

    setIsLoadingRecipients(true);
    setComposeError(null);

    void (async () => {
      try {
        const [topicResponse, assignmentsResponse] = await Promise.all([
          api.get<ApiResponse<TopicOptionDto>>(`/topics/${selectedTopicId}`),
          api.get<ApiResponse<AssignmentDto[]>>(`/topics/${selectedTopicId}/assignments`),
        ]);

        const participantIds = new Set<string>();
        const topic = topicResponse.data;
        if (topic.studentUserId) {
          participantIds.add(topic.studentUserId);
        } else if (topic.student?.id) {
          participantIds.add(topic.student.id);
        }
        if (topic.supervisorUserId) {
          participantIds.add(topic.supervisorUserId);
        } else if (topic.supervisor?.id) {
          participantIds.add(topic.supervisor.id);
        }

        assignmentsResponse.data
          .filter((assignment) => assignment.status === "ACTIVE")
          .forEach((assignment) => {
            participantIds.add(assignment.userId);
          });

        if (currentUserId) {
          participantIds.delete(currentUserId);
        }

        const users = await Promise.all(
          Array.from(participantIds).map(async (userId) => {
            try {
              const userResponse = await api.get<ApiResponse<UserOptionDto>>(`/users/${userId}`);
              return userResponse.data;
            } catch {
              return null;
            }
          }),
        );

        const options = users
          .filter((user): user is UserOptionDto => Boolean(user))
          .map(mapUserToRecipient)
          .sort((a, b) => a.label.localeCompare(b.label, "vi"));
        setRecipientOptions(options);
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải danh sách người nhận.";
        setComposeError(message);
        setRecipientOptions([]);
      } finally {
        setIsLoadingRecipients(false);
      }
    })();
  }, [currentUserId, globalRecipientOptions, isTbm, selectedTopicId]);

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

  const handleSendPersonal = async () => {
    setComposeError(null);
    setComposeSuccess(null);

    if (!isTbm && !selectedTopicId) {
      setComposeError("Giảng viên phải chọn đề tài liên quan trước khi gửi.");
      return;
    }

    if (!selectedReceiverId) {
      setComposeError("Vui lòng chọn người nhận.");
      return;
    }

    if (!composeBody.trim()) {
      setComposeError("Nội dung thông báo không được để trống.");
      return;
    }

    setIsSendingPersonal(true);
    try {
      await api.post<ApiResponse<NotificationDto>>("/notifications/personal", {
        receiverUserId: selectedReceiverId,
        topicId: selectedTopicId || undefined,
        title: composeTitle.trim() || undefined,
        body: composeBody.trim(),
      });

      setComposeSuccess("Đã gửi thông báo cá nhân thành công.");
      setComposeBody("");
      setComposeTitle("");
      void loadNotifications();
    } catch (sendError) {
      const message =
        sendError instanceof Error
          ? sendError.message
          : "Không thể gửi thông báo cá nhân.";
      setComposeError(message);
    } finally {
      setIsSendingPersonal(false);
    }
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

  const canSend = Boolean(
    selectedReceiverId &&
      composeBody.trim() &&
      (isTbm || selectedTopicId),
  );

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

      <section className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-on-surface">Gửi thông báo cá nhân</h2>
            <p className="text-xs text-outline mt-1">
              {isTbm
                ? "TBM có thể gửi theo đề tài hoặc gửi trực tiếp đến tài khoản cụ thể."
                : "Giảng viên chỉ được gửi cho người tham gia trong đề tài mình phụ trách."}
            </p>
          </div>
          {(isLoadingTopicOptions || isLoadingRecipients) && (
            <div className="flex items-center gap-2 text-xs text-outline">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Đang tải dữ liệu...
            </div>
          )}
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-outline">
              Đề tài liên quan {isTbm ? "(tùy chọn)" : "*"}
            </label>
            <select
              value={selectedTopicId}
              onChange={(event) => setSelectedTopicId(event.target.value)}
              className="w-full px-3 py-2.5 bg-surface-container rounded-xl border border-outline-variant/20 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">
                {isTbm ? "Không gắn đề tài cụ thể" : "Chọn đề tài..."}
              </option>
              {topicOptions.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topicOptionLabel(topic)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-outline">
              Người nhận *
            </label>
            <select
              value={selectedReceiverId}
              onChange={(event) => setSelectedReceiverId(event.target.value)}
              disabled={isLoadingRecipients || recipientOptions.length === 0}
              className="w-full px-3 py-2.5 bg-surface-container rounded-xl border border-outline-variant/20 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              <option value="">
                {isLoadingRecipients
                  ? "Đang tải người nhận..."
                  : recipientOptions.length > 0
                    ? "Chọn người nhận..."
                    : "Không có người nhận khả dụng"}
              </option>
              {recipientOptions.map((recipient) => (
                <option key={recipient.id} value={recipient.id}>
                  {recipient.label} - {recipient.subLabel}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-outline">
              Tiêu đề (tùy chọn)
            </label>
            <input
              value={composeTitle}
              onChange={(event) => setComposeTitle(event.target.value)}
              placeholder="Ví dụ: Nhắc bổ sung báo cáo trước hạn"
              className="w-full px-3 py-2.5 bg-surface-container rounded-xl border border-outline-variant/20 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-outline">
              Nội dung *
            </label>
            <textarea
              value={composeBody}
              onChange={(event) => setComposeBody(event.target.value)}
              rows={4}
              placeholder="Nhập nội dung thông báo..."
              className="w-full px-3 py-2.5 bg-surface-container rounded-xl border border-outline-variant/20 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>

          {composeError && (
            <div className="md:col-span-2 flex items-start gap-2.5 bg-error-container/20 border border-error/20 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-error mt-0.5 flex-shrink-0" />
              <p className="text-sm text-error">{composeError}</p>
            </div>
          )}

          {composeSuccess && (
            <div className="md:col-span-2 flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-green-700">{composeSuccess}</p>
            </div>
          )}

          <div className="md:col-span-2 flex justify-end">
            <button
              type="button"
              onClick={() => void handleSendPersonal()}
              disabled={isSendingPersonal || !canSend}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              {isSendingPersonal ? "Đang gửi..." : "Gửi thông báo cá nhân"}
            </button>
          </div>
        </div>
      </section>

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
