export interface PendingTopic {
  id: string;
  studentName: string;
  studentId: string;
  topicName: string;
  type: "BCTT" | "KLTN";
  submittedAt: string;
  companyName?: string;
  category: string;
}

export const MOCK_PENDING_TOPICS: PendingTopic[] = [
  {
    id: "t3",
    studentName: "Trần Văn B",
    studentId: "20110123",
    topicName: "Nghiên cứu áp dụng Blockchain trong truy xuất nguồn gốc nông sản",
    type: "KLTN",
    submittedAt: "2024-03-28T10:00:00Z",
    category: "Blockchain",
  },
  {
    id: "t4",
    studentName: "Lê Thị C",
    studentId: "20110456",
    topicName: "Xây dựng website thương mại điện tử bằng Next.js",
    type: "BCTT",
    submittedAt: "2024-03-29T08:30:00Z",
    companyName: "Công ty phần mềm ABC",
    category: "Web Development",
  }
];

export interface ReviewTask {
  id: string;
  studentName: string;
  studentId: string;
  topicName: string;
  type: "KLTN"; // GVPB chỉ có KLTN
  reportFile: string;
  deadline: string;
  status: "PENDING_REVIEW" | "REVIEWED";
}

export const MOCK_REVIEWS: ReviewTask[] = [
  {
    id: "r1",
    studentName: "Nguyễn Lê E",
    studentId: "20110789",
    topicName: "Phát triển hệ thống IoT giám sát môi trường nước",
    type: "KLTN",
    reportFile: "20110789_NguyenLeE_KLTN_V1.pdf",
    deadline: "2024-04-15T23:59:59Z",
    status: "PENDING_REVIEW"
  }
];
