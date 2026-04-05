/**
 * Google Sheets column layout — Schema v3.2
 *
 * Strategy: Tab names match teacher's Google Sheets EXACTLY.
 * Teacher columns come first; app-specific columns are appended to the right.
 * App-specific tabs (not in teacher sheet) are added to the same spreadsheet.
 *
 * ─── TEACHER TABS (exact names) ──────────────────────────────────────────────
 *
 * Data (≡ Users) — A-N (14 cols):
 *   A=Email, B=MS, C=Ten, D=Role, E=Major, F=HeDaoTao
 *   [App cols] G=id, H=phone, I=completedBcttScore, J=totalQuota, K=quotaUsed,
 *              L=expertise, M=isActive, N=createdAt
 *   Role values in sheet: SV | GV | TBM  (mapped to STUDENT | LECTURER | TBM)
 *
 * Dot (≡ Periods) — A-K (11 cols):
 *   A=StartReg, B=EndReg, C=Loaidetai, D=Major, E=Dot, F=Active, G=StartEx, H=EndEx
 *   [App cols] I=id, J=createdAt, K=updatedAt
 *
 * Trangthaidetai (≡ Assignments + inline schedule refs) — A-L (12 cols):
 *   A=EmailSV, B=EmailGV, C=Role, D=Diadiem, E=Diem, F=End
 *   [App cols] G=id, H=topicId, I=userId, J=status, K=assignedAt, L=revokedAt
 *   Teacher role values: GVHD | GVPB | CTHD | TVHD | ThukyHD
 *   App topicRole:       GVHD | GVPB | CT_HD | TV_HD | TK_HD
 *
 * Điểm (≡ Scores) — A-AA (27 cols):
 *   A=Email, B=Tên SV, C=MSSV, D=Tên Đề tài, E=GV, F=Role,
 *   G=TC1, H=TC2, I=TC3, J=TC4, K=TC5, L=TC6, M=TC7, N=TC8, O=TC9, P=TC10
 *   [App cols] Q=id, R=topicId, S=scorerUserId, T=scorerRole, U=status,
 *              V=totalScore, W=rubricData, X=allowDefense, Y=questions,
 *              Z=submittedAt, AA=updatedAt
 *
 * BB GVHD - Ứng dụng (≡ RubricCriteria for GVHD / Ứng dụng) — A-F (6 cols):
 *   A=Tên TC, B=Điểm tối đa
 *   [App cols] C=id, D=code, E=order, F=scorerRole
 *
 * BB GVHD - NC (≡ RubricCriteria for GVHD / NC) — A-F (6 cols): same as above
 *
 * BB GVPB - Ứng dụng (≡ RubricCriteria for GVPB / Ứng dụng) — A-F (6 cols): same
 *
 * BB GVPB - NC (≡ RubricCriteria for GVPB / NC) — A-F (6 cols): same
 *
 * Chấm điểm của HĐồng (≡ RubricCriteria for TV_HD / CT_HD) — A-F (6 cols):
 *   A=Tên TC, B=Mô tả (teacher uses desc instead of maxScore here)
 *   [App cols] C=id, D=code, E=order, F=scorerRole
 *   Note: maxScore for HĐồng is seeded separately or uses default 10.
 *
 * TenDetai (≡ Submissions) — A-W (23 cols):
 *   A=EmailSV, B=Tendetai, C=DotHK, D=Loaidetai, E=Version, F=Linkbai
 *   [App cols] G=id, H=topicId, I=uploaderUserId, J=fileType,
 *              K=revisionRoundId, L=revisionRoundNumber, M=versionNumber,
 *              N=versionLabel, O=status, P=deadlineAt, Q=confirmedAt,
 *              R=isLocked, S=canReplace, T=driveFileId, U=uploadedAt,
 *              V=originalFileName, W=fileSize
 *
 * Bienban (≡ ExportFiles) — A-O (15 cols):
 *   A=Email, B=Bienban
 *   [App cols] C=id, D=topicId, E=exportType, F=status, G=driveFileId,
 *              H=driveLink, I=downloadUrl, J=fileName, K=mimeType,
 *              L=errorMessage, M=requestedBy, N=createdAt, O=completedAt
 *
 * Quota — A-D (4 cols): Email, Major, HeDaoTao, Quota  [read-only reference]
 *
 * Major — A-C (3 cols): Email, Major, Field  [read-only reference]
 *
 * Detaigoiy (≡ SuggestedTopics) — A-F (6 cols):
 *   A=Email, B=Tendetai, C=Dot
 *   [App cols] D=id, E=lecturerUserId, F=createdAt
 *
 * ─── APP-SPECIFIC TABS ───────────────────────────────────────────────────────
 *
 * Topics — A-P (16 cols):
 *   A=id, B=periodId, C=type, D=title, E=domain, F=companyName,
 *   G=studentUserId, H=supervisorUserId, I=state,
 *   J=approvalDeadlineAt, K=submitStartAt, L=submitEndAt,
 *   M=reasonRejected, N=revisionsAllowed, O=createdAt, P=updatedAt
 *
 * RevisionRounds — A-J (10 cols):
 *   A=id, B=topicId, C=roundNumber, D=status, E=startAt,
 *   F=endAt, G=requestedBy, H=reason, I=createdAt, J=updatedAt
 *
 * ScoreSummaries — A-T (20 cols):
 *   A=id, B=topicId, C=gvhdScore, D=gvpbScore, E=councilAvgScore,
 *   F=finalScore, G=result, H=confirmedByGvhd, I=confirmedByCtHd, J=published, K=updatedAt,
 *   L=councilComments,
 *   M=appealRequestedAt, N=appealRequestedBy, O=appealReason, P=appealStatus,
 *   Q=appealResolvedAt, R=appealResolvedBy, S=appealResolutionNote, T=appealScoreAdjusted
 *
 * Notifications — A-K (11 cols):
 *   A=id, B=receiverUserId, C=topicId, D=type, E=title, F=body,
 *   G=deepLink, H=isRead, I=createdAt, J=readAt, K=scope
 *
 * Schedules — A-I (9 cols):
 *   A=id, B=topicId, C=defenseAt, D=locationType, E=locationDetail,
 *   F=notes, G=createdBy, H=createdAt, I=updatedAt
 *
 * AuditLogs — A-G (7 cols):
 *   A=id, B=action, C=actorId, D=actorRole, E=topicId, F=detail, G=createdAt
 *
 * SystemConfig — A-D (4 cols):
 *   A=key, B=value, C=description, D=updatedAt
 */

export const SHEET_NAMES = {
  // ── Teacher tabs (exact names matching teacher's Google Sheet) ──
  DATA: 'Data',                           // ≡ Users
  DOT: 'Dot',                             // ≡ Periods
  TRANGTHAIDETAI: 'Trangthaidetai',       // ≡ Assignments
  DIEM: 'Điểm',                           // ≡ Scores
  BB_GVHD_UNG_DUNG: 'BB GVHD - Ứng dụng',
  BB_GVHD_NC: 'BB GVHD - NC',
  BB_GVPB_UNG_DUNG: 'BB GVPB - Ứng dụng',
  BB_GVPB_NC: 'BB GVPB - NC',
  CHAM_DIEM_HDONG: 'Chấm điểm của HĐồng',
  TENDETAI: 'TenDetai',                   // ≡ Submissions
  BIENBAN: 'Bienban',                     // ≡ ExportFiles
  QUOTA: 'Quota',                         // read-only reference
  MAJOR: 'Major',                         // read-only reference
  DETAIGOIY: 'Detaigoiy',                 // ≡ SuggestedTopics

  // ── App-specific tabs ──
  TOPICS: 'Topics',
  REVISION_ROUNDS: 'RevisionRounds',
  SCORE_SUMMARIES: 'ScoreSummaries',
  NOTIFICATIONS: 'Notifications',
  SCHEDULES: 'Schedules',
  AUDIT_LOGS: 'AuditLogs',
  SYSTEM_CONFIG: 'SystemConfig',
} as const;

export type SheetName = (typeof SHEET_NAMES)[keyof typeof SHEET_NAMES];

/** Canonical header rows per sheet (v3.2) */
export const SHEET_HEADERS: Record<SheetName, string[]> = {
  // ── Teacher tab: Data ──
  'Data': [
    // Teacher cols
    'Email', 'MS', 'Ten', 'Role', 'Major', 'HeDaoTao',
    // App cols (G–N)
    'id', 'phone', 'completedBcttScore', 'totalQuota', 'quotaUsed',
    'expertise', 'isActive', 'createdAt',
    // Extended app cols (O–P) — DB-01 fix: align with UsersRepository.toRow() 16-col output
    'earnedCredits', 'requiredCredits',
  ],

  // ── Teacher tab: Dot ──
  'Dot': [
    // Teacher cols
    'StartReg', 'EndReg', 'Loaidetai', 'Major', 'Dot', 'Active', 'StartEx', 'EndEx',
    // App cols
    'id', 'createdAt', 'updatedAt',
  ],

  // ── Teacher tab: Trangthaidetai ──
  'Trangthaidetai': [
    // Teacher cols
    'EmailSV', 'EmailGV', 'Role', 'Diadiem', 'Diem', 'End',
    // App cols
    'id', 'topicId', 'userId', 'status', 'assignedAt', 'revokedAt',
  ],

  // ── Teacher tab: Điểm ──
  'Điểm': [
    // Teacher cols
    'Email', 'Tên SV', 'MSSV', 'Tên Đề tài', 'GV', 'Role',
    'TC1', 'TC2', 'TC3', 'TC4', 'TC5', 'TC6', 'TC7', 'TC8', 'TC9', 'TC10',
    // App cols
    'id', 'topicId', 'scorerUserId', 'scorerRole', 'status',
    'totalScore', 'rubricData', 'allowDefense', 'questions', 'submittedAt', 'updatedAt',
  ],

  // ── Teacher tab: BB GVHD - Ứng dụng ──
  'BB GVHD - Ứng dụng': [
    // Teacher cols
    'Tên TC', 'Điểm tối đa',
    // App cols
    'id', 'code', 'order', 'scorerRole',
  ],

  // ── Teacher tab: BB GVHD - NC ──
  'BB GVHD - NC': [
    'Tên TC', 'Điểm tối đa',
    'id', 'code', 'order', 'scorerRole',
  ],

  // ── Teacher tab: BB GVPB - Ứng dụng ──
  'BB GVPB - Ứng dụng': [
    'Tên TC', 'Điểm tối đa',
    'id', 'code', 'order', 'scorerRole',
  ],

  // ── Teacher tab: BB GVPB - NC ──
  'BB GVPB - NC': [
    'Tên TC', 'Điểm tối đa',
    'id', 'code', 'order', 'scorerRole',
  ],

  // ── Teacher tab: Chấm điểm của HĐồng ──
  'Chấm điểm của HĐồng': [
    'Tên TC', 'Mô tả',
    'id', 'code', 'order', 'scorerRole',
  ],

  // ── Teacher tab: TenDetai ──
  'TenDetai': [
    // Teacher cols
    'EmailSV', 'Tendetai', 'DotHK', 'Loaidetai', 'Version', 'Linkbai',
    // App cols
    'id', 'topicId', 'uploaderUserId', 'fileType',
    'revisionRoundId', 'revisionRoundNumber', 'versionNumber', 'versionLabel', 'status',
    'deadlineAt', 'confirmedAt', 'isLocked', 'canReplace',
    'driveFileId', 'uploadedAt', 'originalFileName', 'fileSize',
  ],

  // ── Teacher tab: Bienban ──
  'Bienban': [
    // Teacher cols
    'Email', 'Bienban',
    // App cols
    'id', 'topicId', 'exportType', 'status', 'driveFileId',
    'driveLink', 'downloadUrl', 'fileName', 'mimeType',
    'errorMessage', 'requestedBy', 'createdAt', 'completedAt',
  ],

  // ── Teacher tabs: read-only reference ──
  'Quota': ['Email', 'Major', 'HeDaoTao', 'Quota'],
  'Major': ['Email', 'Major', 'Field'],

  // ── Teacher tab: Detaigoiy ──
  'Detaigoiy': [
    // Teacher cols
    'Email', 'Tendetai', 'Dot',
    // App cols
    'id', 'lecturerUserId', 'createdAt',
  ],

  // ── App-specific tabs ──
  'Topics': [
    'id', 'periodId', 'type', 'title', 'domain', 'companyName',
    'studentUserId', 'supervisorUserId', 'state',
    'approvalDeadlineAt', 'submitStartAt', 'submitEndAt',
    'reasonRejected', 'revisionsAllowed', 'createdAt', 'updatedAt',
  ],
  'RevisionRounds': [
    'id', 'topicId', 'roundNumber', 'status', 'startAt',
    'endAt', 'requestedBy', 'reason', 'createdAt', 'updatedAt',
  ],
  'ScoreSummaries': [
    'id', 'topicId', 'gvhdScore', 'gvpbScore', 'councilAvgScore',
    'finalScore', 'result', 'confirmedByGvhd', 'confirmedByCtHd', 'published', 'updatedAt',
    'councilComments',
    'appealRequestedAt', 'appealRequestedBy', 'appealReason', 'appealStatus',
    'appealResolvedAt', 'appealResolvedBy', 'appealResolutionNote', 'appealScoreAdjusted',
  ],
  'Notifications': [
    'id', 'receiverUserId', 'topicId', 'type', 'title', 'body',
    'deepLink', 'isRead', 'createdAt', 'readAt', 'scope',
  ],
  'Schedules': [
    'id', 'topicId', 'defenseAt', 'locationType', 'locationDetail',
    'notes', 'createdBy', 'createdAt', 'updatedAt',
  ],
  'AuditLogs': ['id', 'action', 'actorId', 'actorRole', 'topicId', 'detail', 'createdAt'],
  'SystemConfig': ['key', 'value', 'description', 'updatedAt'],
};

/** Tabs that should NOT be cleared on --reset */
export const PRESERVED_ON_RESET: SheetName[] = [SHEET_NAMES.DATA];
