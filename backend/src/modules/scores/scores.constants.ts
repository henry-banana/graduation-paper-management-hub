export const SCORE_SCORER_ROLES = ['GVHD', 'GVPB', 'TV_HD'] as const;

// Bug fix: Restrict summary request to TK_HD only (secretary role)
// CT_HD and TBM should not aggregate scores - this is TK_HD responsibility
export const SCORE_SUMMARY_REQUEST_ROLES = ['TK_HD'] as const;

export const SCORE_CONFIRM_ROLES = ['GVHD', 'CT_HD'] as const;

export const SCORE_STATUSES = ['DRAFT', 'SUBMITTED'] as const;

export const SCORE_RESULTS = ['PASS', 'FAIL', 'PENDING'] as const;

// Scoring is only allowed in scoring phases.
// KLTN must transition DEFENSE -> SCORING before any score mutation.
export const SCORE_ALLOWED_TOPIC_STATES = ['GRADING', 'SCORING'] as const;

export const SCORE_PASS_THRESHOLD = 5;
