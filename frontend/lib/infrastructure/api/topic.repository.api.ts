import { ApiListResponse, api } from "@/lib/api";
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
}

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
    const [topicsRes, periodsRes] = await Promise.all([
      api.get<ApiListResponse<TopicDto>>("/topics?role=student&page=1&size=100"),
      api.get<ApiListResponse<PeriodDto>>("/periods?page=1&size=100"),
    ]);

    const periodMap = new Map(
      periodsRes.data.map((period) => [period.id, period.code]),
    );

    return topicsRes.data.map((topic) => ({
      id: topic.id,
      name: topic.title,
      type: topic.type,
      gvhdEmail: topic.supervisorUserId,
      gvhdName: topic.supervisorUserId,
      period: periodMap.get(topic.periodId) ?? topic.periodId,
      periodCode: periodMap.get(topic.periodId) ?? topic.periodId,
      state: topic.state,
      updatedAt: formatDateTime(topic.updatedAt),
      score: null,
      company: topic.companyName ?? null,
    }));
  }
}
