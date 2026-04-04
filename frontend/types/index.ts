// === Account & Auth ===
export type AccountRole = "STUDENT" | "LECTURER" | "TBM";
export type TopicRole = "GVHD" | "GVPB" | "TV_HD" | "CT_HD" | "TK_HD";

export interface User {
  id: string;
  email: string;
  name: string;
  role: AccountRole;
  mssv?: string;
  msgv?: string;
}

// === Topic ===
export type TopicType = "BCTT" | "KLTN";
export type TopicState =
  | "DRAFT"
  | "PENDING_GV"
  | "PENDING_CONFIRM"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "GRADING"
  | "DEFENSE"
  | "SCORING"
  | "COMPLETED"
  | "CANCELLED";

export interface Topic {
  id: string;
  type: TopicType;
  title: string;
  description?: string;
  studentId: string;
  gvhdId: string;
  state: TopicState;
  periodId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TopicListPerson {
  id: string;
  fullName: string;
  studentId?: string;
}

export interface TopicListPeriod {
  code: string;
}

export interface TopicListLatestSubmission {
  id: string;
  driveLink: string;
  version: number;
}

export interface TopicListScores {
  gvhd: number | null;
  gvpb: number | null;
  councilAvg: number | null;
  council: number | null;
  final: number | null;
  isReady: boolean;
  isSummarized: boolean;
  gvhdConfirmed: boolean;
  ctHdConfirmed: boolean;
  published: boolean;
}

export interface CouncilTopicListItem {
  id: string;
  title: string;
  type: TopicType;
  state: TopicState;
  student: TopicListPerson;
  supervisor?: TopicListPerson;
  reviewer?: TopicListPerson;
  period: TopicListPeriod;
  latestSubmission: TopicListLatestSubmission;
  scores: TopicListScores;
  councilRole?: 'CT_HD' | 'TK_HD' | 'TV_HD';
  isPublished?: boolean;
  councilMinutesLink?: string;
}

// === Period ===
export interface Period {
  id: string;
  type: TopicType;
  semester: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

// === Score ===
export interface Score {
  id: string;
  topicId: string;
  scorerId: string;
  scorerRole: TopicRole;
  criteriaScores: Record<string, number>;
  totalScore: number;
  comment?: string;
}

// === Notification ===
export type NotificationType =
  | "TOPIC_SUBMITTED"
  | "TOPIC_APPROVED"
  | "TOPIC_REJECTED"
  | "SCORE_SUBMITTED";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

// === API Response ===
export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
