"use client";

import { useEffect, useState } from "react";
import { FileDown, RefreshCcw, CheckCircle2, Clock, FileWarning, RefreshCw, Plus, ChevronDown, X, Loader2 } from "lucide-react";
import { ApiListResponse, ApiResponse, api } from "@/lib/api";

interface ExportJob {
  id: string;
  filename?: string;
  type?: string;
  name?: string;
  status: "COMPLETED" | "PROCESSING" | "FAILED";
  requestedAt?: string;
  createdAt?: string;
  driveLink?: string;
  downloadUrl?: string;
  errorMessage?: string;
}

interface TopicOption {
  id: string;
  title: string;
  type: "BCTT" | "KLTN";
  state: string;
  student?: { fullName: string; studentId?: string };
}

type RubricRole = "GVHD" | "GVPB" | "COUNCIL";

const RUBRIC_TYPE_LABELS: Record<RubricRole, string> = {
  GVHD: "Hướng dẫn (GVHD)",
  GVPB: "Phản biện (GVPB)",
  COUNCIL: "Hội đồng",
};

const EXPORT_ENDPOINT: Record<string, Record<RubricRole, string>> = {
  BCTT: {
    GVHD: "/topics/{id}/exports/rubric-bctt",
    GVPB: "/topics/{id}/exports/rubric-bctt",
    COUNCIL: "/topics/{id}/exports/rubric-bctt",
  },
  KLTN: {
    GVHD: "/topics/{id}/exports/rubric-gvhd",
    GVPB: "/topics/{id}/exports/rubric-gvpb",
    COUNCIL: "/topics/{id}/exports/rubric-council",
  },
};

export default function ExportsPage() {
  const [exports, setExports] = useState<ExportJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create rubric panel state
  const [showCreate, setShowCreate] = useState(false);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [rubricRole, setRubricRole] = useState<RubricRole>("GVHD");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiListResponse<ExportJob>>("/exports?page=1&size=50");
      setExports(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải danh sách exports.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  // Load topics when create panel opens
  useEffect(() => {
    if (!showCreate || topics.length > 0) return;
    setIsLoadingTopics(true);
    void (async () => {
      try {
        // Try gvhd first, fall back to gvpb/council
        const res = await api.get<ApiListResponse<TopicOption>>(
          "/topics?role=gvhd&page=1&size=100&state=GRADING,SUBMITTED,COMPLETED"
        );
        setTopics(res.data ?? []);
        if (res.data[0]) setSelectedTopicId(res.data[0].id);
      } catch {
        // Try without role filter
        try {
          const res2 = await api.get<ApiListResponse<TopicOption>>("/topics?page=1&size=100");
          setTopics(res2.data ?? []);
          if (res2.data[0]) setSelectedTopicId(res2.data[0].id);
        } catch {
          setTopics([]);
        }
      } finally {
        setIsLoadingTopics(false);
      }
    })();
  }, [showCreate, topics.length]);

  const selectedTopic = topics.find(t => t.id === selectedTopicId) ?? null;

  const handleCreate = async () => {
    if (!selectedTopicId || !selectedTopic) return;
    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    const topicType = selectedTopic.type;
    const endpointTemplate = EXPORT_ENDPOINT[topicType]?.[rubricRole]
      ?? `/topics/{id}/exports/rubric-${rubricRole.toLowerCase()}`;
    const endpoint = endpointTemplate.replace("{id}", selectedTopicId);

    try {
      await api.post<ApiResponse<unknown>>(endpoint, {});
      setCreateSuccess("Đã gửi yêu cầu xuất rubric. File sẽ xuất hiện trong danh sách bên dưới trong giây lát.");
      setShowCreate(false);
      // Reload after short delay for backend processing
      setTimeout(() => { void load(); }, 2000);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Không thể tạo file.");
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED": return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "PROCESSING": return <Clock className="w-5 h-5 text-yellow-500" />;
      case "FAILED": return <FileWarning className="w-5 h-5 text-red-500" />;
      default: return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "COMPLETED": return <span className="text-green-700">Đã hoàn thành</span>;
      case "PROCESSING": return <span className="text-yellow-700">Đang xử lý...</span>;
      case "FAILED": return <span className="text-red-700">Thất bại</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">Xuất File Rubric</h1>
          <p className="text-sm text-outline mt-1">Tạo và quản lý file chấm điểm Word (.docx) trên Google Drive.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            aria-label="Làm mới danh sách"
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-outline-variant/20 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
          <button
            onClick={() => { setShowCreate(!showCreate); setCreateError(null); setCreateSuccess(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Tạo Rubric mới
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCreate ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Create Rubric Panel */}
      {showCreate && (
        <div className="bg-surface-container-lowest rounded-3xl border border-primary/20 p-6 space-y-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-on-surface">Tạo file Rubric mới</h2>
            <button
              onClick={() => setShowCreate(false)}
              aria-label="Đóng panel tạo rubric"
              className="text-outline hover:text-on-surface w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Topic selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-outline uppercase tracking-wide">Đề tài</label>
              {isLoadingTopics ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container text-sm text-outline">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang tải...
                </div>
              ) : topics.length === 0 ? (
                <div className="px-3 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container text-sm text-outline">
                  Không có đề tài nào ở trạng thái chấm điểm.
                </div>
              ) : (
                <select
                  value={selectedTopicId}
                  onChange={e => setSelectedTopicId(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                >
                  {topics.map(t => (
                    <option key={t.id} value={t.id}>
                      [{t.type}] {t.student?.fullName ?? ""} {t.student?.studentId ? `(${t.student.studentId})` : ""} — {t.title.slice(0, 50)}{t.title.length > 50 ? "..." : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Rubric role */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-outline uppercase tracking-wide">Loại Rubric</label>
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(RUBRIC_TYPE_LABELS) as RubricRole[]).map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setRubricRole(role)}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      rubricRole === role
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "border-outline-variant/20 text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    {RUBRIC_TYPE_LABELS[role]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview of what will be created */}
          {selectedTopic && (
            <div className="bg-surface-container rounded-2xl px-4 py-3 text-sm text-on-surface-variant flex items-start gap-2">
              <FileDown className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <span>
                Sẽ tạo: <strong className="text-on-surface">
                  rubric_{selectedTopic.type.toLowerCase()}_{rubricRole.toLowerCase()}_{selectedTopic.student?.studentId ?? "sv"}
                </strong>.docx → upload Google Drive
              </span>
            </div>
          )}

          {createError && (
            <div className="bg-error-container/20 border border-error/20 rounded-xl px-4 py-3 text-sm text-error">
              {createError}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-xl border border-outline-variant/20 text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={() => void handleCreate()}
              disabled={isCreating || !selectedTopicId || topics.length === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Đang tạo...</>
              ) : (
                <><FileDown className="w-4 h-4" />Xuất Rubric</>
              )}
            </button>
          </div>
        </div>
      )}

      {createSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {createSuccess}
        </div>
      )}

      {error && (
        <div className="bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Export history table */}
      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
          <h2 className="font-semibold text-on-surface text-sm">Lịch sử xuất file</h2>
          <span className="text-xs text-outline">{exports.length} file</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-outline animate-spin" />
            <span className="ml-3 text-sm text-outline">Đang tải...</span>
          </div>
        ) : exports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FileDown className="w-10 h-10 text-outline/40" />
            <p className="text-sm text-on-surface-variant font-medium">Chưa có file export nào.</p>
            <p className="text-xs text-outline">Nhấn &quot;Tạo Rubric mới&quot; để bắt đầu.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-outline-variant/10">
              <thead className="bg-surface-container/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-outline uppercase tracking-wider">Tên file / Loại</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-outline uppercase tracking-wider">Trạng thái</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-outline uppercase tracking-wider">Thời gian</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-outline uppercase tracking-wider">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {exports.map((job) => (
                  <tr key={job.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-on-surface">{job.filename ?? job.type ?? job.name ?? job.id}</div>
                      {job.errorMessage && <div className="text-xs text-error mt-1">{job.errorMessage}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm">
                        {getStatusIcon(job.status)}
                        {getStatusText(job.status)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-outline">
                      {job.createdAt ? new Date(job.createdAt).toLocaleString("vi-VN") : job.requestedAt ? new Date(job.requestedAt).toLocaleString("vi-VN") : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {job.status === "COMPLETED" && (job.driveLink ?? job.downloadUrl) ? (
                        <a
                          href={job.driveLink ?? job.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Tải xuống ${job.filename ?? "file"}`}
                          className="inline-flex items-center gap-1.5 text-primary hover:underline font-semibold"
                        >
                          <FileDown className="w-4 h-4" /> Tải xuống
                        </a>
                      ) : job.status === "FAILED" ? (
                        <button
                          onClick={() => void load()}
                          aria-label="Làm mới danh sách"
                          className="inline-flex items-center gap-1.5 text-outline hover:text-on-surface"
                        >
                          <RefreshCcw className="w-4 h-4" /> Làm mới
                        </button>
                      ) : (
                        <span className="text-outline/60">Đang tạo...</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
