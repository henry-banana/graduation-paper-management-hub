"use client";

import { useState } from "react";
import { Bell, Check, Trash2, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    title: "Đề tài đã được duyệt",
    message: "GVHD TS. Nguyễn Văn A đã duyệt đề tài KLTN của bạn.",
    isRead: false,
    createdAt: "2024-03-29T08:30:00Z",
    link: "/student/topics"
  },
  {
    id: "n2",
    title: "Có hồ sơ mới cần phản biện",
    message: "Bạn vừa được phân công làm GVPB cho đề tài của SV Trần Văn B.",
    isRead: true,
    createdAt: "2024-03-28T14:15:00Z",
    link: "/gvpb/reviews"
  }
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Thông báo</h1>
          <p className="text-sm text-gray-500">Cập nhật các hoạt động mới nhất liên quan đến bạn.</p>
        </div>
        <button 
          onClick={markAllAsRead}
          className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
        >
          <Check className="w-4 h-4 mr-2 text-gray-400" />
          Đánh dấu tất cả đã đọc
        </button>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-12 pl-12 flex flex-col items-center justify-center text-gray-500">
             <Bell className="w-12 h-12 text-gray-300 mb-4" />
             <p>Bạn không có thông báo nào.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {notifications.map((notification) => (
              <li key={notification.id} className={`p-4 sm:px-6 relative transition-colors ${notification.isRead ? "bg-white" : "bg-blue-50/30"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${notification.isRead ? "text-gray-900" : "text-blue-900"}`}>
                      {notification.title}
                      {!notification.isRead && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-blue-600"></span>}
                    </p>
                    <p className={`text-sm mt-1 line-clamp-2 ${notification.isRead ? "text-gray-500" : "text-blue-800/80"}`}>
                      {notification.message}
                    </p>
                    <div className="mt-2 flex items-center text-xs text-gray-400">
                      <span>{new Date(notification.createdAt).toLocaleString('vi-VN')}</span>
                      {notification.link && (
                        <>
                          <span className="mx-2">•</span>
                          <Link href={notification.link} className="text-blue-600 hover:text-blue-800 inline-flex items-center font-medium">
                            Xem chi tiết <ArrowRight className="w-3 h-3 ml-1" />
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0 flex items-center space-x-2">
                    {!notification.isRead && (
                      <button onClick={() => markAsRead(notification.id)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50" title="Đánh dấu đã đọc">
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => deleteNotification(notification.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50" title="Xóa thông báo">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
