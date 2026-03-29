/**
 * Google Sheets column layout for each tab.
 * Row 1 = header (set up manually in the spreadsheet).
 * Data starts at row 2.
 *
 * USERS tab columns (A-O):
 *   A=id, B=email, C=name, D=role, E=studentId, F=lecturerId, G=department,
 *   H=earnedCredits, I=requiredCredits, J=completedBcttScore,
 *   K=totalQuota, L=quotaUsed, M=phone, N=isActive, O=createdAt
 *
 * PERIODS tab columns (A-H):
 *   A=id, B=code, C=type, D=openDate, E=closeDate, F=status, G=createdAt, H=updatedAt
 *
 * TOPICS tab columns (A-P):
 *   A=id, B=periodId, C=type, D=title, E=domain, F=companyName,
 *   G=studentUserId, H=supervisorUserId, I=state,
 *   J=approvalDeadlineAt, K=submitStartAt, L=submitEndAt,
 *   M=reasonRejected, N=revisionsAllowed, O=createdAt, P=updatedAt
 *
 * ASSIGNMENTS tab columns (A-G):
 *   A=id, B=topicId, C=userId, D=topicRole, E=status, F=assignedAt, G=revokedAt
 *
 * SUBMISSIONS tab columns (A-J):
 *   A=id, B=topicId, C=uploaderUserId, D=fileType, E=version,
 *   F=driveFileId, G=driveLink, H=uploadedAt, I=originalFileName, J=fileSize
 *
 * SCORES tab columns (A-K):
 *   A=id, B=topicId, C=scorerUserId, D=scorerRole, E=status,
 *   F=totalScore, G=rubricData(JSON), H=allowDefense, I=questions(JSON), J=submittedAt, K=updatedAt
 *
 * SCORE_SUMMARIES tab columns (A-K):
 *   A=id, B=topicId, C=gvhdScore, D=gvpbScore, E=councilAvgScore,
 *   F=finalScore, G=result, H=confirmedByGvhd, I=confirmedByCtHd, J=published, K=updatedAt
 *
 * NOTIFICATIONS tab columns (A-J):
 *   A=id, B=receiverUserId, C=topicId, D=type, E=title, F=body,
 *   G=deepLink, H=isRead, I=createdAt, J=readAt
 *
 * EXPORT_FILES tab columns (A-N):
 *   A=id, B=topicId, C=exportType, D=status, E=driveFileId, F=driveLink,
 *   G=downloadUrl, H=fileName, I=mimeType, J=errorMessage, K=requestedBy, L=createdAt, M=completedAt, N=expiresAt
 *
 * SCHEDULES tab columns (A-I):
 *   A=id, B=topicId, C=defenseAt, D=locationType, E=locationDetail, F=notes, G=createdBy, H=createdAt, I=updatedAt
 *
 * AUDIT_LOGS tab columns (A-G):
 *   A=id, B=action, C=actorId, D=actorRole, E=topicId, F=detail(JSON), G=createdAt
 */
export const SHEET_NAMES = {
  USERS: 'Users',
  PERIODS: 'Periods',
  TOPICS: 'Topics',
  ASSIGNMENTS: 'Assignments',
  SUBMISSIONS: 'Submissions',
  SCORES: 'Scores',
  SCORE_SUMMARIES: 'ScoreSummaries',
  NOTIFICATIONS: 'Notifications',
  EXPORT_FILES: 'ExportFiles',
  SCHEDULES: 'Schedules',
  AUDIT_LOGS: 'AuditLogs',
} as const;
