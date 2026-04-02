interface NotificationLinkSource {
  topicId?: string;
  deepLink?: string;
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
