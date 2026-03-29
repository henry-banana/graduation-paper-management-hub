export interface Topic {
  id: string;
  code: string;
  name: string;
  type: "BCTT" | "KLTN";
  state: "IN_PROGRESS" | "PENDING_GV" | "CONFIRMED" | "GRADING" | "COMPLETED" | "CANCELLED";
  instructorName: string;
  companyName?: string;
  category: string;
  periodName: string;
  createdAt: string;
}

export const MOCK_TOPICS: Topic[] = [
  {
    id: "t1",
    code: "BCTT-2023-01",
    name: "Xây dựng hệ thống quản lý kho HKT",
    type: "BCTT",
    state: "COMPLETED",
    instructorName: "TS. Nguyễn Văn A",
    companyName: "Công ty TNHH HKT",
    category: "Web Development",
    periodName: "HK1 - 2023-2024",
    createdAt: "2023-09-01T08:00:00Z"
  },
  {
    id: "t2",
    code: "KLTN-2023-15",
    name: "Nghiên cứu ứng dụng AI trong quản lý chuỗi cung ứng",
    type: "KLTN",
    state: "IN_PROGRESS",
    instructorName: "TS. Nguyễn Văn A",
    category: "AI/Machine Learning",
    periodName: "HK2 - 2023-2024",
    createdAt: "2024-01-15T08:00:00Z"
  }
];
