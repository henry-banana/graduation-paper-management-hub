export interface Period {
  id: string;
  name: string;
  type: "BCTT" | "KLTN";
  startDate: string;
  endDate: string;
  status: "UPCOMING" | "OPEN" | "CLOSED";
}

export const MOCK_PERIODS: Period[] = [
  {
    id: "p1",
    name: "Đợt BCTT Học kỳ 1 (2024-2025)",
    type: "BCTT",
    startDate: "2024-09-01T00:00:00Z",
    endDate: "2024-12-30T23:59:59Z",
    status: "CLOSED",
  },
  {
    id: "p2",
    name: "Đợt KLTN Học kỳ 2 (2024-2025)",
    type: "KLTN",
    startDate: "2025-01-15T00:00:00Z",
    endDate: "2025-05-30T23:59:59Z",
    status: "OPEN",
  }
];

export interface AssignmentTask {
  id: string;
  studentName: string;
  studentId: string;
  topicName: string;
  gvhd: string;
  gvpb?: string;
  councilMembers?: string[];
  status: "UNASSIGNED" | "ASSIGNED";
}

export const MOCK_ASSIGNMENTS: AssignmentTask[] = [
  {
    id: "a1",
    studentName: "Nguyễn Lê E",
    studentId: "20110789",
    topicName: "Phát triển hệ thống IoT giám sát môi trường nước",
    gvhd: "TS. Nguyễn Văn A",
    status: "UNASSIGNED"
  }
];

export interface Schedule {
  id: string;
  topicName: string;
  studentName: string;
  defenseDate: string;
  type: "ONLINE" | "OFFLINE";
  location: string;
}

export const MOCK_SCHEDULES: Schedule[] = [
  {
    id: "s1",
    topicName: "Phát triển hệ thống IoT giám sát môi trường nước",
    studentName: "Nguyễn Lê E",
    defenseDate: "2024-05-15T08:00:00Z",
    type: "ONLINE",
    location: "Google Meet (Link sẽ được gửi sau)"
  }
];
