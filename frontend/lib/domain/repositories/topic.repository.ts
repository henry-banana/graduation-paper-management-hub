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
}

export interface TopicRepository {
  getMyTopics(): Promise<Topic[]>;
}
