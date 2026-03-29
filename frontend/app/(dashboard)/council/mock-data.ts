export interface CouncilEvaluation {
  id: string;
  topicName: string;
  studentName: string;
  studentId: string;
  reportFile: string;
  status: "PENDING" | "SCORED";
  defenseDate: string;
}

export const MOCK_COUNCIL_EVALUATIONS: CouncilEvaluation[] = [
  {
    id: "ce1",
    topicName: "Nghiên cứu áp dụng Blockchain trong truy xuất nguồn gốc nông sản",
    studentName: "Trần Văn B",
    studentId: "20110123",
    reportFile: "20110123_TranVanB_KLTN_Final.pdf",
    status: "PENDING",
    defenseDate: "2024-05-15T08:00:00Z"
  }
];

export interface CouncilSummary {
  id: string;
  topicName: string;
  studentName: string;
  studentId: string;
  gvhdScore: number;
  gvpbScore: number;
  councilScores: { memberName: string; score: number }[];
  status: "MISSING_SCORES" | "READY_TO_SUMMARIZE" | "SUMMARIZED";
}

export const MOCK_SUMMARY: CouncilSummary[] = [
  {
    id: "sum1",
    topicName: "Nghiên cứu áp dụng Blockchain trong truy xuất nguồn gốc nông sản",
    studentName: "Trần Văn B",
    studentId: "20110123",
    gvhdScore: 8.5,
    gvpbScore: 8.0,
    councilScores: [
      { memberName: "TS. Nguyễn Văn A", score: 8.5 },
      { memberName: "ThS. Trần Thị B", score: 8.0 },
      { memberName: "TS. Lê Trọng C", score: 8.25 }
    ],
    status: "READY_TO_SUMMARIZE"
  }
];
