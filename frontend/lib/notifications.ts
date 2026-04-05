import type { UiRole } from "@/lib/auth/session";

interface NotificationLinkSource {
  topicId?: string;
  deepLink?: string;
}

function extractTopicIdFromTopicsPath(path: string): string | null {
  const segments = path.replace(/^\/+/, "").split("/");
  if (segments[0] !== "topics") {
    return null;
  }

  return segments[1] || null;
}

function resolveStaffTopicLink(topicId: string, uiRole: UiRole): string {
  const encodedTopicId = encodeURIComponent(topicId);

  switch (uiRole) {
    case "TBM":
      return `/tbm/assignments?topicId=${encodedTopicId}`;
    case "GVPB":
      return `/gvpb/reviews?topicId=${encodedTopicId}`;
    case "TV_HD":
    case "TK_HD":
      return `/council/scoring?topicId=${encodedTopicId}`;
    case "CT_HD":
      return `/council/final-confirm?topicId=${encodedTopicId}`;
    case "GVHD":
    case "LECTURER":
    default:
      return `/gvhd/topics/${encodedTopicId}`;
  }
}

function canUseDirectDeepLink(path: string, uiRole: UiRole): boolean {
  if (path.startsWith("/notifications")) {
    return false;
  }

  if (path.startsWith("/student/")) {
    return false;
  }

  if (path.startsWith("/tbm/")) {
    return uiRole === "TBM";
  }

  if (path.startsWith("/gvpb/")) {
    return uiRole === "GVPB" || uiRole === "LECTURER";
  }

  if (path.startsWith("/gvhd/")) {
    return uiRole === "GVHD" || uiRole === "LECTURER";
  }

  if (path.startsWith("/council/")) {
    return (
      uiRole === "LECTURER" ||
      uiRole === "TV_HD" ||
      uiRole === "TK_HD" ||
      uiRole === "CT_HD"
    );
  }

  return true;
}

export function resolveStudentNotificationLink(
  notification: NotificationLinkSource,
): string | null {
  const deepLink = notification.deepLink?.trim();

  if (deepLink?.startsWith('/student/notifications')) {
    return null;
  }

  if (deepLink?.startsWith('/student/')) {
    return deepLink;
  }

  if (deepLink?.startsWith('/topics/')) {
    const segments = deepLink.replace(/^\/+/, '').split('/');
    const topicId = segments[1];

    if (!topicId) {
      return '/student/topics';
    }

    const encodedTopicId = encodeURIComponent(topicId);
    return `/student/topics/${encodedTopicId}`;
  }

  if (notification.topicId) {
    return `/student/topics/${encodeURIComponent(notification.topicId)}`;
  }

  return null;
}

export function resolveStaffNotificationLink(
  notification: NotificationLinkSource,
  uiRole: UiRole,
): string | null {
  const deepLink = notification.deepLink?.trim();

  if (deepLink) {
    if (deepLink.startsWith("/topics/")) {
      const topicId = extractTopicIdFromTopicsPath(deepLink);
      if (topicId) {
        return resolveStaffTopicLink(topicId, uiRole);
      }
    }

    if (deepLink.startsWith("/")) {
      return canUseDirectDeepLink(deepLink, uiRole) ? deepLink : null;
    }
  }

  if (notification.topicId) {
    return resolveStaffTopicLink(notification.topicId, uiRole);
  }

  return null;
}
