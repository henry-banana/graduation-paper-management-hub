import { ApiListResponse, ApiResponse, api } from "@/lib/api";
import { Topic, TopicRepository } from "../../domain/repositories/topic.repository";

interface TopicDto {
  id: string;
  title: string;
  type: "BCTT" | "KLTN";
  state: string;
  supervisorUserId: string;
  periodId: string;
  companyName?: string;
  updatedAt?: string;
  supervisor?: {
    fullName?: string;
    lecturerId?: string;
    email?: string;
  };
}

interface SupervisorOptionDto {
  id: string;
  fullName: string;
  email?: string;
  lecturerId?: string;
}

const EMPTY_SUPERVISORS_RESPONSE: ApiResponse<SupervisorOptionDto[]> = {
  data: [],
};

interface PeriodDto {
  id: string;
  code: string;
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("vi-VN", {
    hour12: false,
  });
}

export class ApiTopicRepository implements TopicRepository {
  async getMyTopics(): Promise<Topic[]> {
    const [topicsRes, periodsRes, teachersRes] = await Promise.all([
      api.get<ApiListResponse<TopicDto>>("/topics?role=student&page=1&size=100"),
      api.get<ApiListResponse<PeriodDto>>("/periods?page=1&size=100"),
      api
        .get<ApiResponse<SupervisorOptionDto[]>>("/users/supervisors/options")
        .catch(() => EMPTY_SUPERVISORS_RESPONSE),
    ]);

    const periodMap = new Map(
      periodsRes.data.map((period) => [period.id, period.code]),
    );

    const teacherMap = new Map(
      (teachersRes.data ?? []).map((teacher) => [teacher.id, teacher]),
    );

    return topicsRes.data.map((topic) => {
      const teacher = teacherMap.get(topic.supervisorUserId);
      const gvhdName =
        teacher?.fullName?.trim() ||
        topic.supervisor?.fullName?.trim() ||
        "GVHD chưa cập nhật";
      const gvhdCodeOrEmail =
        teacher?.lecturerId?.trim() ||
        topic.supervisor?.lecturerId?.trim() ||
        teacher?.email?.trim() ||
        topic.supervisor?.email?.trim() ||
        "—";

      return {
        id: topic.id,
        name: topic.title,
        type: topic.type,
        gvhdEmail: gvhdCodeOrEmail,
        gvhdName,
        period: periodMap.get(topic.periodId) ?? topic.periodId,
        periodCode: periodMap.get(topic.periodId) ?? topic.periodId,
        state: topic.state,
        updatedAt: formatDateTime(topic.updatedAt),
        score: null,
        company: topic.companyName ?? null,
      };
    });
  }
}
