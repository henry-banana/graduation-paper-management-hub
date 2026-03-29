import { Topic, TopicRepository } from "../../domain/repositories/topic.repository";

const MOCK_MY_TOPICS: Topic[] = [
  {
    id: "t1",
    name: "Xây dựng hệ thống quản lý kho HKT",
    type: "BCTT",
    gvhdEmail: "nguyenvana@hcmute.edu.vn",
    gvhdName: "TS. Nguyễn Văn A",
    period: "ĐỢT 1 HK2 25-26",
    periodCode: "2526",
    state: "COMPLETED",
    updatedAt: "04:29:27 23/3/2026",
    score: 9.5,
    company: "Công ty TNHH HKT",
  },
  {
    id: "t2",
    name: "Nghiên cứu ứng dụng AI trong quản lý chuỗi cung ứng",
    type: "KLTN",
    gvhdEmail: "nguyenthib@hcmute.edu.vn",
    gvhdName: "TS. Nguyễn Thị B",
    period: "ĐỢT 2 HK2 25-26",
    periodCode: "2526",
    state: "PENDING_GV",
    updatedAt: "04:29:27 23/3/2026",
    score: null,
    company: null,
  },
];

export class MockTopicRepository implements TopicRepository {
  async getMyTopics(): Promise<Topic[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(MOCK_MY_TOPICS), 500);
    });
  }
}
