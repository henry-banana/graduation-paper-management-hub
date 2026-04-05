export const SCORE_SCORER_ROLES = ['GVHD', 'GVPB', 'TV_HD'] as const;

export const SCORE_SUMMARY_REQUEST_ROLES = ['TK_HD', 'CT_HD', 'TBM'] as const;

export const SCORE_CONFIRM_ROLES = ['GVHD', 'CT_HD'] as const;

export const SCORE_STATUSES = ['DRAFT', 'SUBMITTED'] as const;

export const SCORE_RESULTS = ['PASS', 'FAIL', 'PENDING'] as const;

// Bug #10 fix: Remove COMPLETED from allowed states - scoring should be locked after completion
export const SCORE_ALLOWED_TOPIC_STATES = ['GRADING', 'SCORING', 'DEFENSE'] as const;

export const SCORE_PASS_THRESHOLD = 5;