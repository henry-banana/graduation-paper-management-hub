export type AccountRole = 'STUDENT' | 'LECTURER' | 'TBM';

export type TopicRole = 'GVHD' | 'GVPB' | 'TV_HD' | 'CT_HD' | 'TK_HD';

export interface AuthUser {
  userId: string;
  email: string;
  role: AccountRole;
  topicRoles?: TopicRole[];
}
