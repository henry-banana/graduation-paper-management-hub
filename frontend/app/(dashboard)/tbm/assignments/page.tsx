"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, Check, ChevronDown, GraduationCap,
  RefreshCw, Search, UserCheck, Users, X,
} from "lucide-react";
import { ApiListResponse, ApiRequestError, ApiResponse, api } from "@/lib/api";

/* ---------- Types ---------- */
interface TopicDto {
  id: string;
  title: string;
  type: "BCTT" | "KLTN";
  state: string;
  studentUserId?: string;
  supervisorUserId?: string;
  periodId?: string;
  student?: { id: string; fullName: string; studentId?: string };
  supervisor?: { id: string; fullName: string; email?: string };
  reviewer?: { id: string; fullName: string } | null;
  council?: { id: string; name: string } | null;
  period?: { id: string; code: string };
}

interface AssignmentDto {
  id: string;
  topicId: string;
  userId: string;
  topicRole: "GVHD" | "GVPB" | "TV_HD" | "CT_HD" | "TK_HD";
  status: "ACTIVE" | "REVOKED";
}

interface TeacherDto {
  id: string;
  fullName: string;
  email: string;
  // Bug #9 fix: Use backend field names (lecturerId, totalQuota, quotaUsed)
  lecturerId?: string;
  staffId?: string; // Keep for backward compat, alias of lecturerId
  roles?: string[];
  totalQuota?: number;
  quotaUsed?: number;
  currentLoad?: number; // Keep for backward compat, alias of quotaUsed
}

type AssignTab = "gvpb" | "council";

/* ---------- Council assign form ---------- */
interface CouncilForm {
  chairUserId: string;
  secretaryUserId: string;
  memberUserIds: string[];
  defenseAt?: string;
  location?: string;
}

const EMPTY_COUNCIL: CouncilForm = {
  chairUserId: "",
  secretaryUserId: "",
  memberUserIds: [],
  defenseAt: "",
  location: "",
};

export default function TBMAssignmentsPage() {
  const [tab, setTab] = useState<AssignTab>("gvpb");
  const [topics, setTopics] = useState<TopicDto[]>([]);
  const [teachers, setTeachers] = useState<TeacherDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"" | "BCTT" | "KLTN">("");

  // GVPB assign state
  const [gvpbMap, setGvpbMap] = useState<Record<string, string>>({}); // topicId → teacherId
  const [isAssigningGvpb, setIsAssigningGvpb] = useState<string | null>(null);

  // Council assign modal
  const [councilTopic, setCouncilTopic] = useState<TopicDto | null>(null);
  const [councilForm, setCouncilForm] = useState<CouncilForm>(EMPTY_COUNCIL);
  const [isAssigningCouncil, setIsAssigningCouncil] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [topicRes, teacherRes] = await Promise.all([
        api.get<ApiListResponse<TopicDto>>("/topics?role=tbm&page=1&size=100"),
        api.get<ApiListResponse<TeacherDto>>("/users?role=LECTURER&page=1&size=100"),
      ]);
      setTopics(topicRes.data ?? []);
      setTeachers(teacherRes.data ?? []);
      // Init gvpbMap from existing reviewers
      const map: Record<string, string> = {};
      (topicRes.data ?? []).forEach(t => {
        if (t.reviewer?.id) map[t.id] = t.reviewer.id;
      });
      setGvpbMap(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải dữ liệu.");
    } finally {
      setIsLoading(false);
    }
  };

  const findTeacherById = (teacherId: string) =>
    teachers.find((teacher) => teacher.id === teacherId);

  const getTeacherRemainingSlots = (teacher: TeacherDto): number | null => {
    if (typeof teacher.totalQuota === "number" && typeof teacher.quotaUsed === "number") {
      return teacher.totalQuota - teacher.quotaUsed;
    }
    return null;
  };

  const getTeacherLabel = (teacher: TeacherDto): string => {
    const remaining = getTeacherRemainingSlots(teacher);
    const code = teacher.lecturerId?.trim() || teacher.staffId?.trim();
    const codeSuffix = code ? ` · ${code}` : "";
    const quotaSuffix = remaining != null ? ` (còn ${Math.max(remaining, 0)} slot)` : "";
    return `${teacher.fullName}${codeSuffix}${quotaSuffix}`;
  };

  const getSupervisorDisplay = (topic: TopicDto): { name: string; codeOrEmail?: string } => {
    const mappedTeacher = topic.supervisorUserId
      ? findTeacherById(topic.supervisorUserId)
      : undefined;

    const name =
      topic.supervisor?.fullName?.trim() ||
      mappedTeacher?.fullName?.trim() ||
      "Chưa cập nhật GVHD";
    // Bug #9 fix: Use lecturerId (backend field) or fallback to staffId (alias)
    const codeOrEmail =
      mappedTeacher?.lecturerId?.trim() ||
      mappedTeacher?.staffId?.trim() ||
      topic.supervisor?.email?.trim() ||
      mappedTeacher?.email?.trim() ||
      undefined;

    return { name, codeOrEmail };
  };

  const findActiveGvpbAssignment = async (topicId: string): Promise<AssignmentDto | null> => {
    const response = await api.get<ApiResponse<AssignmentDto[]>>(
      `/topics/${topicId}/assignments`,
    );

    return (
      response.data.find(
        (assignment) =>
          assignment.topicRole === "GVPB" && assignment.status === "ACTIVE",
      ) ?? null
    );
  };

  const refreshTeachers = async () => {
    const teacherRes = await api.get<ApiListResponse<TeacherDto>>(
      "/users?role=LECTURER&page=1&size=100",
    );
    setTeachers(teacherRes.data ?? []);
  };

  const updateTopicReviewer = (topicId: string, teacherId: string) => {
    const reviewer = findTeacherById(teacherId);
    if (!reviewer) return;

    setTopics((prev) =>
      prev.map((topic) =>
        topic.id === topicId
          ? {
            ...topic,
            reviewer: {
              id: reviewer.id,
              fullName: reviewer.fullName,
            },
          }
          : topic,
      ),
    );
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() =>
    topics
      .filter(t => !filterType || t.type === filterType)
      .filter(t =>
        (t.student?.fullName?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
        (t.title?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
        (t.supervisor?.fullName?.toLowerCase() ?? "").includes(search.toLowerCase()),
      ),
    [topics, search, filterType],
  );

  const gvpbTopics = useMemo(
    () => filtered.filter(t => ["CONFIRMED", "IN_PROGRESS", "PENDING_CONFIRM", "DEFENSE"].includes(t.state)),
    [filtered],
  );
  const councilTopics = useMemo(
    () => filtered.filter(t => t.type === "KLTN" && ["PENDING_CONFIRM", "DEFENSE"].includes(t.state)),
    [filtered],
  );

  const handleAssignGvpb = async (topicId: string) => {
    const teacherId = gvpbMap[topicId];
    if (!teacherId) return;

    const topic = topics.find((item) => item.id === topicId);
    if (topic?.reviewer?.id === teacherId) {
      setSuccess("GVPB hiện tại đã là giảng viên được chọn.");
      setTimeout(() => setSuccess(null), 3000);
      return;
    }

    setIsAssigningGvpb(topicId);
    setError(null);
    try {
      await api.post<ApiResponse<unknown>>(`/topics/${topicId}/assignments/gvpb`, { userId: teacherId });
      updateTopicReviewer(topicId, teacherId);
      await refreshTeachers();
      setSuccess("Phân công GVPB thành công.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 409) {
        try {
          const currentAssignment = await findActiveGvpbAssignment(topicId);

          if (!currentAssignment) {
            throw new Error("Không tìm thấy phân công GVPB hiện tại để thay thế.");
          }

          if (currentAssignment.userId === teacherId) {
            setSuccess("GVPB hiện tại đã là giảng viên được chọn.");
            setTimeout(() => setSuccess(null), 3000);
            return;
          }

          await api.patch<ApiResponse<unknown>>(
            `/assignments/${currentAssignment.id}/replace`,
            {
              newUserId: teacherId,
              reason: "TBM cập nhật phân công GVPB từ màn hình quản lý.",
            },
          );

          updateTopicReviewer(topicId, teacherId);
          await refreshTeachers();
          setSuccess("Đã thay thế GVPB thành công.");
          setTimeout(() => setSuccess(null), 3000);
          return;
        } catch (replaceError) {
          setError(
            replaceError instanceof Error
              ? replaceError.message
              : "Thay thế GVPB thất bại.",
          );
          return;
        }
      }

      setError(e instanceof Error ? e.message : "Phân công GVPB thất bại.");
    } finally {
      setIsAssigningGvpb(null);
    }
  };

  const handleAssignCouncil = async () => {
    if (!councilTopic) return;
    const memberUserIds = Array.from(
      new Set(councilForm.memberUserIds.filter(Boolean))
    ).filter(
      (id) => id !== councilForm.chairUserId && id !== councilForm.secretaryUserId,
    );
    if (memberUserIds.length < 1) {
      setError("Hội đồng cần ít nhất 1 thành viên (không trùng Chủ tịch/Thư ký).");
      return;
    }
    setIsAssigningCouncil(true);
    setError(null);
    try {
      await api.post<ApiResponse<unknown>>(`/topics/${councilTopic.id}/assignments/council`, {
        chairUserId: councilForm.chairUserId,
        secretaryUserId: councilForm.secretaryUserId,
        memberUserIds,
      });
      setTopics(prev => prev.map(t =>
        t.id === councilTopic!.id
          ? { ...t, council: { id: "assigned", name: "Đã phân công" } }
          : t,
      ));
      setCouncilTopic(null);
      setSuccess("Phân công Hội đồng thành công.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Phân công Hội đồng thất bại.");
    } finally {
      setIsAssigningCouncil(false);
    }
  };

  const toggleCouncilMember = (uid: string) => {
    setCouncilForm(prev => ({
      ...prev,
      memberUserIds: prev.memberUserIds.includes(uid)
        ? prev.memberUserIds.filter(x => x !== uid)
        : [...prev.memberUserIds, uid],
    }));
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-headline text-on-surface">Phân công phản biện & Hội đồng</h1>
          <p className="text-sm text-outline mt-1">Gán GVPB và Hội đồng cho các đề tài.</p>
        </div>
        <button
          onClick={() => void load()}
          aria-label="Làm mới danh sách phân công"
          title="Làm mới"
          className="p-2.5 rounded-xl border border-outline-variant/20 hover:bg-surface-container transition-colors self-start"
        >
          <RefreshCw className={`w-4 h-4 text-outline ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-3 bg-error-container/20 border border-error/20 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-error flex-shrink-0" /><p className="text-sm text-error">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <Check className="w-4 h-4 text-green-600 flex-shrink-0" /><p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Tabs + Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-1 bg-surface-container rounded-2xl p-1">
          {([["gvpb", "Phân công GVPB", UserCheck], ["council", "Phân công Hội đồng", Users]] as const).map(([t, label, Icon]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:bg-surface-container-low"}`}
            >
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm SV, đề tài, GVHD..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface placeholder:text-outline/60" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value as "" | "BCTT" | "KLTN")}
            className="px-3 py-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/20 text-sm text-on-surface focus:outline-none">
            <option value="">Tất cả loại</option><option value="BCTT">BCTT</option><option value="KLTN">KLTN</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 animate-spin text-outline" /><span className="ml-3 text-sm text-outline">Đang tải...</span></div>
      ) : (
        <>
          {/* =========== GVPB TAB =========== */}
          {tab === "gvpb" && (
            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden">
              {gvpbTopics.length === 0 ? (
                <div className="p-16 flex flex-col items-center gap-4">
                  <GraduationCap className="w-10 h-10 text-outline/40" />
                  <p className="text-on-surface-variant font-medium">Không có đề tài cần phân công GVPB.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-outline-variant/10">
                    <thead>
                      <tr className="bg-surface-container/50">
                        {["Sinh viên", "Đề tài", "Loại", "Đợt", "GVHD", "GVPB hiện tại", "Phân công"].map(h => (
                          <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-outline uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {gvpbTopics.map(t => {
                        const acting = isAssigningGvpb === t.id;
                        const supervisorDisplay = getSupervisorDisplay(t);
                        return (
                          <tr key={t.id} className="hover:bg-surface-container-low/30 transition-colors">
                            <td className="px-4 py-4">
                              <p className="text-sm font-semibold text-on-surface">{t.student?.fullName ?? "Chưa có thông tin sinh viên"}</p>
                              <p className="text-xs text-outline">{t.student?.studentId ?? "Chưa có MSSV"}</p>
                            </td>
                            <td className="px-4 py-4 max-w-[200px]">
                              <p className="text-xs text-on-surface line-clamp-2" title={t.title}>{t.title}</p>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${t.type === "KLTN" ? "bg-purple-100 text-purple-700" : "bg-primary/10 text-primary"}`}>{t.type}</span>
                            </td>
                            <td className="px-4 py-4 text-xs text-outline whitespace-nowrap">{t.period?.code ?? t.periodId ?? "—"}</td>
                            <td className="px-4 py-4 text-xs text-on-surface-variant">
                              <p className="text-on-surface-variant">{supervisorDisplay.name}</p>
                              {supervisorDisplay.codeOrEmail && (
                                <p className="text-outline">{supervisorDisplay.codeOrEmail}</p>
                              )}
                            </td>
                            <td className="px-4 py-4 text-xs">
                              {t.reviewer
                                ? <span className="flex items-center gap-1 text-green-600"><Check className="w-3 h-3" />{t.reviewer.fullName}</span>
                                : <span className="text-outline italic">Chưa phân công</span>}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2 min-w-[180px]">
                                <div className="relative flex-1">
                                  <select
                                    value={gvpbMap[t.id] ?? ""}
                                    onChange={e => setGvpbMap(prev => ({ ...prev, [t.id]: e.target.value }))}
                                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-outline-variant/20 bg-surface-container text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                                  >
                                    <option value="">Chọn GV phản biện...</option>
                                    {teachers
                                      .filter(tc => tc.id !== (t.supervisor?.id ?? t.supervisorUserId))
                                      .map(tc => {
                                        const remaining = getTeacherRemainingSlots(tc);
                                        const isAtCapacity = remaining != null && remaining <= 0;
                                        const isSelected = gvpbMap[t.id] === tc.id;
                                        return (
                                          <option
                                            key={tc.id}
                                            value={tc.id}
                                            disabled={isAtCapacity && !isSelected}
                                          >
                                            {getTeacherLabel(tc)}
                                          </option>
                                        );
                                      })}
                                  </select>
                                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-outline pointer-events-none" />
                                </div>
                                <button
                                  onClick={() => void handleAssignGvpb(t.id)}
                                  disabled={acting || !gvpbMap[t.id]}
                                  className="px-3 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
                                >
                                  {acting ? "..." : "Xác nhận"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* =========== COUNCIL TAB =========== */}
          {tab === "council" && (
            <div className="space-y-4">
              {councilTopics.length === 0 ? (
                <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 p-16 flex flex-col items-center gap-4">
                  <Users className="w-10 h-10 text-outline/40" />
                  <p className="text-on-surface-variant font-medium">Không có đề tài cần phân công Hội đồng.</p>
                </div>
              ) : (
                <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-outline-variant/10">
                      <thead>
                        <tr className="bg-surface-container/50">
                          {["Sinh viên", "Đề tài", "Loại", "GVHD", "GVPB", "Hội đồng", ""].map(h => (
                            <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-outline uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/10">
                        {councilTopics.map(t => (
                          <tr key={t.id} className="hover:bg-surface-container-low/30 transition-colors">
                            <td className="px-4 py-4">
                              <p className="text-sm font-semibold text-on-surface">{t.student?.fullName ?? "—"}</p>
                              <p className="text-xs text-outline">{t.student?.studentId ?? ""}</p>
                            </td>
                            <td className="px-4 py-4 max-w-[180px]">
                              <p className="text-xs text-on-surface line-clamp-2">{t.title}</p>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${t.type === "KLTN" ? "bg-purple-100 text-purple-700" : "bg-primary/10 text-primary"}`}>{t.type}</span>
                            </td>
                            <td className="px-4 py-4 text-xs text-on-surface-variant">{t.supervisor?.fullName ?? "—"}</td>
                            <td className="px-4 py-4 text-xs text-on-surface-variant">{t.reviewer?.fullName ?? <span className="italic text-outline">Chưa có</span>}</td>
                            <td className="px-4 py-4 text-xs">
                              {t.council
                                ? <span className="flex items-center gap-1 text-green-600"><Check className="w-3 h-3" />Đã phân công</span>
                                : <span className="text-outline italic">Chưa có</span>}
                            </td>
                            <td className="px-4 py-4">
                              <button
                                onClick={() => { setCouncilTopic(t); setCouncilForm(EMPTY_COUNCIL); }}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-all"
                              >
                                <Users className="w-3.5 h-3.5" />Phân công
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Council Modal */}
      {councilTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-outline-variant/10">
              <div>
                <h3 className="font-bold text-on-surface text-lg">Phân công Hội đồng</h3>
                <p className="text-xs text-outline mt-0.5 truncate">{councilTopic.student?.fullName} — {councilTopic.title.slice(0, 50)}</p>
              </div>
              <button onClick={() => setCouncilTopic(null)} className="p-1.5 rounded-xl hover:bg-surface-container transition-colors">
                <X className="w-5 h-5 text-outline" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Chủ tịch */}
              <div>
                <label className="block text-xs font-semibold text-outline mb-1.5 uppercase">Chủ tịch Hội đồng *</label>
                <select value={councilForm.chairUserId} onChange={e => setCouncilForm(p => ({ ...p, chairUserId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="">Chọn Chủ tịch...</option>
                  {teachers.map(tc => <option key={tc.id} value={tc.id}>{getTeacherLabel(tc)}</option>)}
                </select>
              </div>
              {/* Thư ký */}
              <div>
                <label className="block text-xs font-semibold text-outline mb-1.5 uppercase">Thư ký *</label>
                <select value={councilForm.secretaryUserId} onChange={e => setCouncilForm(p => ({ ...p, secretaryUserId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="">Chọn Thư ký...</option>
                  {teachers.map(tc => <option key={tc.id} value={tc.id}>{getTeacherLabel(tc)}</option>)}
                </select>
              </div>
              {/* Thành viên */}
              <div>
                <label className="block text-xs font-semibold text-outline mb-2 uppercase">Thành viên Hội đồng (chọn nhiều)</label>
                <div className="max-h-40 overflow-y-auto space-y-1 border border-outline-variant/20 rounded-xl p-3 bg-surface-container">
                  {teachers.map(tc => (
                    <label key={tc.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-surface-container-low px-2 py-1 rounded-lg transition-colors">
                      <input
                        type="checkbox"
                        checked={councilForm.memberUserIds.includes(tc.id)}
                        onChange={() => toggleCouncilMember(tc.id)}
                        className="w-4 h-4 rounded accent-primary"
                      />
                      <span className="text-sm text-on-surface">{tc.fullName}</span>
                      <span className="text-xs text-outline ml-auto">{tc.email}</span>
                    </label>
                  ))}
                </div>
              </div>
              {/* Defense schedule */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5 uppercase">Ngày & Giờ bảo vệ</label>
                  <input type="datetime-local" value={councilForm.defenseAt ?? ""} onChange={e => setCouncilForm(p => ({ ...p, defenseAt: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5 uppercase">Địa điểm</label>
                  <input value={councilForm.location ?? ""} onChange={e => setCouncilForm(p => ({ ...p, location: e.target.value }))} placeholder="VD: Phòng B2-01"
                    className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
            </div>
            {error && (
              <div className="mx-6 mb-4 flex items-center gap-3 bg-error-container/20 border border-error/20 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-error" /><p className="text-sm text-error">{error}</p>
              </div>
            )}
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setCouncilTopic(null)} className="flex-1 px-4 py-2.5 border border-outline-variant/20 rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors">Hủy</button>
              <button onClick={() => void handleAssignCouncil()} disabled={isAssigningCouncil || !councilForm.chairUserId || !councilForm.secretaryUserId}
                className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-60">
                {isAssigningCouncil ? "Đang phân công..." : "Xác nhận phân công"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
