"use client";

import { useEffect, useState } from "react";
import { Send, AlertCircle, CheckCircle2, RefreshCw, User } from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";

interface TopicDto {
  id: string;
  title: string;
  type: "BCTT" | "KLTN";
  studentUserId: string;
}

interface StudentDto {
  id: string;
  name?: string;
  email: string;
  studentId?: string;
}

export default function GVHDNotificationsPage() {
  const [topics, setTopics] = useState<TopicDto[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [studentInfo, setStudentInfo] = useState<StudentDto | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [isLoadingStudent, setIsLoadingStudent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void loadTopics();
  }, []);

  useEffect(() => {
    if (selectedTopicId) {
      void loadStudentInfo();
    } else {
      setStudentInfo(null);
    }
  }, [selectedTopicId]);

  const loadTopics = async () => {
    setIsLoadingTopics(true);
    try {
      const res = await api.get<ApiListResponse<TopicDto>>(
        "/topics?role=gvhd&page=1&size=100"
      );
      setTopics(res.data ?? []);
      if (res.data && res.data.length > 0) {
        setSelectedTopicId(res.data[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải danh sách đề tài");
    } finally {
      setIsLoadingTopics(false);
    }
  };

  const loadStudentInfo = async () => {
    if (!selectedTopicId) return;

    setIsLoadingStudent(true);
    try {
      const topic = topics.find((t) => t.id === selectedTopicId);
      if (!topic) return;

      const res = await api.get<ApiResponse<StudentDto>>(
        `/users/${topic.studentUserId}`
      );
      setStudentInfo(res.data);
    } catch (e) {
      console.error("Cannot load student info:", e);
    } finally {
      setIsLoadingStudent(false);
    }
  };

  const handleSend = async () => {
    if (!selectedTopicId) {
      setError("Vui lòng chọn đề tài");
      return;
    }

    if (!title.trim() || !body.trim()) {
      setError("Vui lòng nhập đầy đủ tiêu đề và nội dung");
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccess(null);

    try {
      const topic = topics.find((t) => t.id === selectedTopicId);
      if (!topic) throw new Error("Không tìm thấy đề tài");

      await api.post("/notifications/personal", {
        receiverUserId: topic.studentUserId,
        type: "GENERAL",
        title: title,
        body: body,
        topicId: selectedTopicId,
      });

      setSuccess(
        `Đã gửi thông báo tới sinh viên ${studentInfo?.name || studentInfo?.email}!`
      );
      setTitle("");
      setBody("");
      setTimeout(() => setSuccess(null), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi khi gửi thông báo");
    } finally {
      setIsSending(false);
    }
  };

  const selectedTopic = topics.find((t) => t.id === selectedTopicId);

  if (isLoadingTopics) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-3 text-gray-600">Đang tải...</span>
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Bạn chưa hướng dẫn sinh viên nào</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gửi thông báo tới sinh viên</h1>
        <p className="text-sm text-gray-600 mt-1">
          Gửi thông báo cá nhân cho sinh viên bạn đang hướng dẫn
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
          <label htmlFor="topic" className="block text-sm font-semibold text-gray-700 mb-2">
            Chọn đề tài (sinh viên)
          </label>
          <select
            id="topic"
            value={selectedTopicId}
            onChange={(e) => setSelectedTopicId(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                [{topic.type}] {topic.title}
              </option>
            ))}
          </select>

          {isLoadingStudent ? (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Đang tải thông tin sinh viên...
            </div>
          ) : studentInfo ? (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
              <User className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-blue-900">
                  {studentInfo.name || "Chưa có tên"}
                </p>
                <p className="text-blue-700">
                  MSSV: {studentInfo.studentId || "N/A"} • Email: {studentInfo.email}
                </p>
              </div>
            </div>
          ) : null}
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
            placeholder="Ví dụ: Nhận xét về bản KLTN lần 1"
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
            placeholder="Nhập nội dung thông báo chi tiết, góp ý, nhận xét..."
            className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">{body.length}/1000 ký tự</p>
        </div>

        {selectedTopic && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800">
              <strong>Xem trước:</strong> Sinh viên sẽ nhận thông báo về đề tài{" "}
              <span className="font-mono bg-white px-2 py-0.5 rounded">
                {selectedTopic.title}
              </span>
            </p>
          </div>
        )}

        <button
          onClick={() => void handleSend()}
          disabled={isSending || !selectedTopicId || !title.trim() || !body.trim()}
          className="w-full px-6 py-3 bg-primary text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition flex items-center justify-center gap-2"
        >
          <Send className="w-5 h-5" />
          {isSending ? "Đang gửi..." : "Gửi thông báo"}
        </button>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
        <p className="font-semibold mb-2">Lưu ý:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Thông báo chỉ gửi cho sinh viên được chọn</li>
          <li>Sinh viên sẽ thấy thông báo trong trang Thông báo của họ</li>
          <li>Không thể thu hồi thông báo sau khi gửi</li>
          <li>Nội dung nên rõ ràng, mang tính hướng dẫn</li>
        </ul>
      </div>
    </div>
  );
}
