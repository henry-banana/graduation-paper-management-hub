"use client";

import { useState } from "react";
import { Send, AlertCircle, CheckCircle2, Megaphone, Users, GraduationCap, BookOpen } from "lucide-react";
import { api } from "@/lib/api";

type NotificationScope = "ALL" | "STUDENTS" | "LECTURERS";

export default function TBMNotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<NotificationScope>("ALL");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      setError("Vui lòng nhập đầy đủ tiêu đề và nội dung");
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post("/notifications/broadcast", {
        type: "GENERAL",
        title: `[${getScopeLabel(scope)}] ${title}`,
        body: body,
        scope: scope,
      });

      setSuccess(`Đã gửi thông báo tới ${getScopeLabel(scope).toLowerCase()}!`);
      setTitle("");
      setBody("");
      setTimeout(() => setSuccess(null), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi khi gửi thông báo");
    } finally {
      setIsSending(false);
    }
  };

  const getScopeLabel = (s: NotificationScope) => {
    switch (s) {
      case "ALL":
        return "Toàn bộ";
      case "STUDENTS":
        return "Sinh viên";
      case "LECTURERS":
        return "Giảng viên";
      default:
        return "";
    }
  };

  const getScopeIcon = (s: NotificationScope) => {
    switch (s) {
      case "ALL":
        return <Megaphone className="w-5 h-5" />;
      case "STUDENTS":
        return <GraduationCap className="w-5 h-5" />;
      case "LECTURERS":
        return <BookOpen className="w-5 h-5" />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gửi thông báo</h1>
        <p className="text-sm text-gray-600 mt-1">
          Tạo và gửi thông báo tới toàn bộ hệ thống hoặc nhóm người dùng cụ thể
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Đối tượng nhận thông báo
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(["ALL", "STUDENTS", "LECTURERS"] as NotificationScope[]).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`p-4 rounded-xl border-2 transition flex items-center gap-3 ${
                  scope === s
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                {getScopeIcon(s)}
                <span className="font-semibold">{getScopeLabel(s)}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-2">
            Tiêu đề thông báo
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Ví dụ: Thông báo lịch bảo vệ KLTN học kỳ 2"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">{title.length}/200 ký tự</p>
        </div>

        <div>
          <label htmlFor="body" className="block text-sm font-semibold text-gray-700 mb-2">
            Nội dung thông báo
          </label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            rows={8}
            placeholder="Nhập nội dung thông báo chi tiết..."
            className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">{body.length}/1000 ký tự</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-800">
            <strong>Xem trước:</strong> Thông báo sẽ hiển thị với tiêu đề{" "}
            <span className="font-mono bg-white px-2 py-0.5 rounded">
              [{getScopeLabel(scope)}] {title || "(Tiêu đề)"}
            </span>
          </p>
        </div>

        <button
          onClick={() => void handleSend()}
          disabled={isSending || !title.trim() || !body.trim()}
          className="w-full px-6 py-3 bg-primary text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition flex items-center justify-center gap-2"
        >
          <Send className="w-5 h-5" />
          {isSending ? "Đang gửi..." : `Gửi thông báo tới ${getScopeLabel(scope).toLowerCase()}`}
        </button>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
        <p className="font-semibold mb-2">Lưu ý:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Thông báo sẽ được gửi đến tất cả người dùng trong nhóm đã chọn</li>
          <li>Người nhận sẽ thấy thông báo trong trang Thông báo của họ</li>
          <li>Không thể thu hồi thông báo sau khi gửi</li>
          <li>Tiêu đề và nội dung phải rõ ràng, dễ hiểu</li>
        </ul>
      </div>
    </div>
  );
}
