export interface Topic {
  id: string;
  name: string;
  type: string;
  gvhdEmail: string;
  gvhdName: string;
  period: string;
  periodCode: string;
  state: string;
  updatedAt: string;
  score: number | null;
  company: string | null;
  // API response extras (bulk-approve, GVHD views)
  studentName?: string;
  studentEmail?: string;
  title?: string;        // alias for name in some endpoints
  studentUserId?: string;
}

export interface TopicRepository {
  getMyTopics(): Promise<Topic[]>;
}
