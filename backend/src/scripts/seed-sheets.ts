/**
 * seed-sheets.ts — Schema v3.2 (CLEAN SEED — fully corrected)
 * ─────────────────────────────────────────────────────────────
 * Usage:
 *   npm run seed:sheets              (upsert — thêm vào nếu chưa có)
 *   npm run seed:sheets:reset        (XÓA SẠCH rồi seed lại từ đầu)
 *   npm run seed:sheets:validate     (chỉ đếm rows, không ghi gì)
 *
 * Design:
 *   - Data (Users) tab: 3 SV + 5 GV + 1 TBM = 9 users
 *   - Dot (Periods): 3 đợt (BCTT HK1-24-25 closed + BCTT HK1-25-26 open + KLTN HK2-25-26 open)
 *   - Topics: 3 topics
 *       + topic-bctt-demo: BCTT / IN_PROGRESS (dùng để demo GVHD/SV flow)
 *       + topic-bctt-done: BCTT / COMPLETED   (dùng để kiểm tra UI lịch sử)
 *       + topic-kltn-demo: KLTN / SCORING     (dùng để demo GVPB+Council flow)
 *   - Trangthaidetai (Assignments): GVHD + GVPB + CT_HD + 2×TV_HD + TK_HD
 *   - TenDetai (Submissions): 1 submission CONFIRMED cho BCTT / 1 cho KLTN
 *   - Điểm (Scores): draft+submitted cho BCTT GVHD + KLTN GVHD + KLTN GVPB
 *   - RevisionRounds: 1 OPEN round mỗi topic
 *   - ScoreSummaries: 1 summary cho BCTT done
 *   - BB GVHD, GVPB, NC, HĐồng: rubric criteria đầy đủ
 *   - Notifications: 3 cái (system + personal)
 *   - AuditLogs: 0 (clean slate)
 *   - SystemConfig: weights chuẩn
 * ─────────────────────────────────────────────────────────────
 */

import 'dotenv/config';
import { google, sheets_v4 } from 'googleapis';

// ─── Auth ────────────────────────────────────────────────────
const EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? '';
const RAW_KEY = process.env.GOOGLE_PRIVATE_KEY ?? '';
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID ?? '';

if (!EMAIL || !RAW_KEY || !SPREADSHEET_ID) {
  console.error('❌  Missing env vars: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SPREADSHEET_ID');
  process.exit(1);
}

const privateKey = RAW_KEY.replace(/\\n/g, '\n');
const auth = new google.auth.JWT(EMAIL, undefined, privateKey, [
  'https://www.googleapis.com/auth/spreadsheets',
]);
const sheets: sheets_v4.Sheets = google.sheets({ version: 'v4', auth });

// ─── Helpers ─────────────────────────────────────────────────
function now(): string { return new Date().toISOString(); }
function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString();
}
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

type Row = (string | number | boolean | null)[];

async function ensureTab(sheetName: string, headers: string[]): Promise<void> {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = (spreadsheet.data.sheets ?? []).map((s) => s.properties?.title ?? '');
  if (!existing.some((t) => t.trim() === sheetName.trim())) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
    });
    console.log(`  📋  Created tab: ${sheetName}`);
  }
  const lastCol = colLetter(headers.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A1:${lastCol}1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers] },
  });
}

async function clearData(sheetName: string): Promise<void> {
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A2:ZZ`,
  });
}

async function appendRows(sheetName: string, rows: Row[]): Promise<void> {
  if (!rows.length) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
}

async function countRows(sheetName: string): Promise<number> {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A2:A`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    return (res.data.values ?? []).filter((r) => r[0]).length;
  } catch { return -1; }
}

function colLetter(n: number): string {
  let name = '';
  while (n > 0) { const m = (n - 1) % 26; name = String.fromCharCode(65 + m) + name; n = Math.floor((n - m) / 26); }
  return name || 'A';
}

// ─── Schema v3.2 — Tab Headers ───────────────────────────────
// Must match sheets.constants.ts EXACTLY
const SHEET_HEADERS: Record<string, string[]> = {
  'Data': [
    'Email', 'MS', 'Ten', 'Role', 'Major', 'HeDaoTao',
    'id', 'phone', 'completedBcttScore', 'totalQuota', 'quotaUsed',
    'expertise', 'isActive', 'createdAt', 'earnedCredits', 'requiredCredits',
  ],
  'Dot': [
    'StartReg', 'EndReg', 'Loaidetai', 'Major', 'Dot',
    'Active', 'StartEx', 'EndEx', 'id', 'createdAt', 'updatedAt',
  ],
  'Trangthaidetai': [
    'EmailSV', 'EmailGV', 'Role', 'Diadiem', 'Diem', 'End',
    'id', 'topicId', 'userId', 'status', 'assignedAt', 'revokedAt',
  ],
  'Điểm': [
    'Email', 'Tên SV', 'MSSV', 'Tên Đề tài', 'GV', 'Role',
    'TC1', 'TC2', 'TC3', 'TC4', 'TC5', 'TC6', 'TC7', 'TC8', 'TC9', 'TC10',
    'id', 'topicId', 'scorerUserId', 'scorerRole', 'status',
    'totalScore', 'rubricData', 'allowDefense', 'questions', 'submittedAt', 'updatedAt',
  ],
  'BB GVHD - Ứng dụng': ['Tên TC', 'Điểm tối đa', 'id', 'code', 'order', 'scorerRole'],
  'BB GVHD - NC':        ['Tên TC', 'Điểm tối đa', 'id', 'code', 'order', 'scorerRole'],
  'BB GVPB - Ứng dụng': ['Tên TC', 'Điểm tối đa', 'id', 'code', 'order', 'scorerRole'],
  'BB GVPB - NC':        ['Tên TC', 'Điểm tối đa', 'id', 'code', 'order', 'scorerRole'],
  'Chấm điểm của HĐồng': ['Tên TC', 'Mô tả', 'id', 'code', 'order', 'scorerRole'],
  'TenDetai': [
    'EmailSV', 'Tendetai', 'DotHK', 'Loaidetai', 'Version', 'Linkbai',
    'id', 'topicId', 'uploaderUserId', 'fileType',
    'revisionRoundId', 'revisionRoundNumber', 'versionNumber', 'versionLabel', 'status',
    'deadlineAt', 'confirmedAt', 'isLocked', 'canReplace',
    'driveFileId', 'uploadedAt', 'originalFileName', 'fileSize',
  ],
  'Bienban': [
    'Email', 'Bienban',
    'id', 'topicId', 'exportType', 'status', 'driveFileId',
    'driveLink', 'downloadUrl', 'fileName', 'mimeType',
    'errorMessage', 'requestedBy', 'createdAt', 'completedAt',
  ],
  'Quota':    ['Email', 'Major', 'HeDaoTao', 'Quota'],
  'Major':    ['Email', 'Major', 'Field'],
  'Detaigoiy': ['Email', 'Tendetai', 'Dot', 'id', 'lecturerUserId', 'createdAt'],
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

// ─── IDs ──────────────────────────────────────────────────────
// Users
const U_SV1    = 'u-sv-001';   // Nguyễn Văn An   — BCTT demo
const U_SV2    = 'u-sv-002';   // Trần Thị Bích   — KLTN demo (eligible)
const U_SV3    = 'u-sv-003';   // Lê Văn Cường    — fresh start
const U_GV1    = 'u-gv-001';   // PGS.TS Phan Văn Đức   — GVHD + CT_HD KLTN
const U_GV2    = 'u-gv-002';   // TS. Nguyễn Thị Em     — GVPB + TV_HD KLTN
const U_GV3    = 'u-gv-003';   // TS. Hoàng Văn Phú     — TV_HD KLTN
const U_GV4    = 'u-gv-004';   // ThS. Võ Thị Giang     — TK_HD KLTN
const U_GV5    = 'u-gv-005';   // ThS. Bùi Ngọc Hải     — free GV
const U_TBM    = 'u-tbm-001';  // Trưởng Bộ Môn CNPM

// Email lookup (used to populate teacher columns correctly)
const EMAIL_SV = {
  [U_SV1]: 'nguyen.van.an@student.hcmute.edu.vn',
  [U_SV2]: 'tran.thi.bich@student.hcmute.edu.vn',
  [U_SV3]: 'le.van.cuong@student.hcmute.edu.vn',
};
const EMAIL_GV = {
  [U_GV1]: 'phan.van.duc@hcmute.edu.vn',
  [U_GV2]: 'nguyen.thi.em@hcmute.edu.vn',
  [U_GV3]: 'hoang.van.phu@hcmute.edu.vn',
  [U_GV4]: 'vo.thi.giang@hcmute.edu.vn',
  [U_GV5]: 'bui.ngoc.hai@hcmute.edu.vn',
  [U_TBM]: 'tbm.cnpm@hcmute.edu.vn',
};
const NAME_SV = {
  [U_SV1]: 'Nguyễn Văn An',
  [U_SV2]: 'Trần Thị Bích',
  [U_SV3]: 'Lê Văn Cường',
};
const NAME_GV = {
  [U_GV1]: 'PGS.TS Phan Văn Đức',
  [U_GV2]: 'TS. Nguyễn Thị Em',
  [U_GV3]: 'TS. Hoàng Văn Phú',
  [U_GV4]: 'ThS. Võ Thị Giang',
  [U_GV5]: 'ThS. Bùi Ngọc Hải',
  [U_TBM]: 'Trưởng BM CNPM',
};

// Periods
const P_BCTT_OLD  = 'period-bctt-old';    // BCTT HK1-2024-2025 (closed — historical)
const P_BCTT_NOW  = 'period-bctt-now';    // BCTT HK1-2025-2026 (OPEN)
const P_KLTN_NOW  = 'period-kltn-now';    // KLTN HK2-2025-2026 (OPEN)

// Topics
const T_BCTT_DEMO = 'topic-bctt-demo';   // BCTT IN_PROGRESS (active demo)
const T_BCTT_DONE = 'topic-bctt-done';   // BCTT COMPLETED   (history demo)
const T_KLTN_DEMO = 'topic-kltn-demo';   // KLTN SCORING     (council demo)

// Topic titles (used in teacher columns)
const TITLE_BCTT_DEMO = 'Xây dựng ứng dụng quản lý thực tập sinh cho doanh nghiệp vừa và nhỏ';
const TITLE_BCTT_DONE = 'Nghiên cứu và cài đặt hệ thống phân tán sử dụng Docker và Kubernetes';
const TITLE_KLTN_DEMO = 'Hệ thống quản lý khóa luận tốt nghiệp sử dụng trí tuệ nhân tạo';

const T = now();

// ─── SEED DATA ────────────────────────────────────────────────

// ── Data (Users) ──────────────────────────────────────────────
// Email, MS, Ten, Role, Major, HeDaoTao, id, phone,
// completedBcttScore, totalQuota, quotaUsed, expertise, isActive, createdAt,
// earnedCredits, requiredCredits
const DATA_ROWS: Row[] = [
  // Students (SV) — completedBcttScore đủ để làm KLTN (>= 6.0), credits đủ (>= 120)
  [EMAIL_SV[U_SV1], 'SV21001', NAME_SV[U_SV1], 'SV', 'CNPM', 'Chính quy',
   U_SV1, '0901111001', 7.5, '', '', '', 'TRUE', T, 125, 120],
  [EMAIL_SV[U_SV2], 'SV21002', NAME_SV[U_SV2], 'SV', 'CNPM', 'Chính quy',
   U_SV2, '0901111002', 6.8, '', '', '', 'TRUE', T, 122, 120],
  [EMAIL_SV[U_SV3], 'SV21003', NAME_SV[U_SV3], 'SV', 'CNPM', 'Chính quy',
   U_SV3, '0901111003', '',  '', '', '', 'TRUE', T, 90,  120],  // NOT eligible (< 120 credits)

  // Lecturers (GV)
  [EMAIL_GV[U_GV1], 'GV001', NAME_GV[U_GV1], 'GV', 'CNPM', '',
   U_GV1, '0902221001', '', 5, 2, 'AI, Machine Learning, Phần mềm', 'TRUE', T, '', ''],
  [EMAIL_GV[U_GV2], 'GV002', NAME_GV[U_GV2], 'GV', 'CNPM', '',
   U_GV2, '0902221002', '', 4, 1, 'Web, Mobile, IoT',               'TRUE', T, '', ''],
  [EMAIL_GV[U_GV3], 'GV003', NAME_GV[U_GV3], 'GV', 'KTMT', '',
   U_GV3, '0902221003', '', 6, 1, 'Mạng máy tính, Hệ thống nhúng',  'TRUE', T, '', ''],
  [EMAIL_GV[U_GV4], 'GV004', NAME_GV[U_GV4], 'GV', 'CNPM', '',
   U_GV4, '0902221004', '', 3, 0, 'Cơ sở dữ liệu, Phân tích dữ liệu', 'TRUE', T, '', ''],
  [EMAIL_GV[U_GV5], 'GV005', NAME_GV[U_GV5], 'GV', 'CNPM', '',
   U_GV5, '0902221005', '', 4, 0, 'Bảo mật, Blockchain',            'TRUE', T, '', ''],

  // TBM
  [EMAIL_GV[U_TBM], 'TBM001', NAME_GV[U_TBM], 'TBM', 'CNPM', '',
   U_TBM, '0903331001', '', '', '', '', 'TRUE', T, '', ''],
];

// ── Dot (Periods) ─────────────────────────────────────────────
// StartReg, EndReg, Loaidetai, Major, Dot, Active, StartEx, EndEx, id, createdAt, updatedAt
const DOT_ROWS: Row[] = [
  // BCTT - đã đóng (historical data)
  ['2024-08-01', '2024-09-30', 'BCTT', 'CNPM', 'HK1-2024-2025', 'FALSE',
   '2024-10-01', '2025-01-15', P_BCTT_OLD, T, T],
  // BCTT - đang mở
  ['2026-01-01', '2026-12-31', 'BCTT', 'CNPM', 'HK1-2025-2026', 'TRUE',
   '2026-03-01', '2026-12-31', P_BCTT_NOW, T, T],
  // KLTN - đang mở
  ['2026-01-01', '2026-12-31', 'KLTN', 'CNPM', 'HK2-2025-2026', 'TRUE',
   '2026-04-01', '2026-12-31', P_KLTN_NOW, T, T],
];

// ── Topics ────────────────────────────────────────────────────
// id, periodId, type, title, domain, companyName,
// studentUserId, supervisorUserId, state,
// approvalDeadlineAt, submitStartAt, submitEndAt,
// reasonRejected, revisionsAllowed, createdAt, updatedAt
const TOPICS_ROWS: Row[] = [
  // [1] BCTT demo — IN_PROGRESS (SV có thể nộp bài, GVHD đang hướng dẫn)
  [
    T_BCTT_DEMO, P_BCTT_NOW, 'BCTT',
    TITLE_BCTT_DEMO,
    'Công nghệ phần mềm', 'Công ty TNHH Tech Việt',
    U_SV1, U_GV1, 'IN_PROGRESS',
    daysAgo(5),            // approvalDeadlineAt (đã qua, đã approve)
    daysAgo(3),            // submitStartAt (đã mở)
    daysFromNow(60),       // submitEndAt (còn 60 ngày)
    '', 2, T, T,
  ],
  // [2] BCTT done — COMPLETED (lịch sử đã hoàn thành)
  [
    T_BCTT_DONE, P_BCTT_OLD, 'BCTT',
    TITLE_BCTT_DONE,
    'Hệ thống phân tán', '',
    U_SV2, U_GV2, 'COMPLETED',
    '2024-09-15T17:00:00.000Z',
    '2024-10-01T00:00:00.000Z',
    '2025-01-10T17:00:00.000Z',
    '', 1, T, T,
  ],
  // [3] KLTN demo — SCORING (đủ assignments để tính summary)
  [
    T_KLTN_DEMO, P_KLTN_NOW, 'KLTN',
    TITLE_KLTN_DEMO,
    'Trí tuệ nhân tạo ứng dụng', '',
    U_SV2, U_GV1, 'SCORING',
    daysAgo(30),           // approvalDeadlineAt đã qua
    daysAgo(60),           // submitStartAt
    daysFromNow(30),       // submitEndAt
    '', 2, T, T,
  ],
];

// ── Trangthaidetai (Assignments) ──────────────────────────────
// EmailSV, EmailGV, Role (teacher), Diadiem, Diem, End,
// id, topicId, userId, status, assignedAt, revokedAt
// NOTE: Role dùng teacher values: GVHD, GVPB, CTHD, TVHD, ThukyHD
const TRANGTHAIDETAI_ROWS: Row[] = [
  // BCTT demo assignments
  [EMAIL_SV[U_SV1], EMAIL_GV[U_GV1], 'GVHD', '', '', '',
   'assign-bctt-demo-gvhd', T_BCTT_DEMO, U_GV1, 'ACTIVE', T, ''],

  // BCTT done assignments (historical)
  [EMAIL_SV[U_SV2], EMAIL_GV[U_GV2], 'GVHD', '', '', '',
   'assign-bctt-done-gvhd', T_BCTT_DONE, U_GV2, 'ACTIVE', T, ''],

  // KLTN demo assignments — đầy đủ: GVHD + GVPB + CT_HD + 2×TV_HD + TK_HD
  [EMAIL_SV[U_SV2], EMAIL_GV[U_GV1], 'GVHD',    '', '', '',
   'assign-kltn-gvhd',  T_KLTN_DEMO, U_GV1, 'ACTIVE', T, ''],
  [EMAIL_SV[U_SV2], EMAIL_GV[U_GV2], 'GVPB',    '', '', '',
   'assign-kltn-gvpb',  T_KLTN_DEMO, U_GV2, 'ACTIVE', T, ''],
  [EMAIL_SV[U_SV2], EMAIL_GV[U_GV1], 'CTHD',    '', '', '',      // CT_HD = GVHD cũng có thể
   'assign-kltn-cthd',  T_KLTN_DEMO, U_GV1, 'ACTIVE', T, ''],
  [EMAIL_SV[U_SV2], EMAIL_GV[U_GV3], 'TVHD',    '', '', '',
   'assign-kltn-tv1',   T_KLTN_DEMO, U_GV3, 'ACTIVE', T, ''],
  [EMAIL_SV[U_SV2], EMAIL_GV[U_GV4], 'TVHD',    '', '', '',
   'assign-kltn-tv2',   T_KLTN_DEMO, U_GV4, 'ACTIVE', T, ''],
  [EMAIL_SV[U_SV2], EMAIL_GV[U_GV5], 'ThukyHD', '', '', '',
   'assign-kltn-tk',    T_KLTN_DEMO, U_GV5, 'ACTIVE', T, ''],
];

// ── RevisionRounds ────────────────────────────────────────────
// id, topicId, roundNumber, status, startAt, endAt, requestedBy, reason, createdAt, updatedAt
const REVISION_ROUNDS_ROWS: Row[] = [
  // BCTT demo: 1 open round
  [
    'rr-bctt-demo-1', T_BCTT_DEMO, 1, 'OPEN',
    daysAgo(3), daysFromNow(60),
    U_TBM, 'Vòng nộp báo cáo chính thức', T, T,
  ],
  // BCTT done: 1 closed round (historical)
  [
    'rr-bctt-done-1', T_BCTT_DONE, 1, 'CLOSED',
    '2024-10-01T00:00:00.000Z', '2025-01-10T17:00:00.000Z',
    U_TBM, 'Vòng nộp chính thức HK1-2024-2025', T, T,
  ],
  // KLTN demo: 1 closed round (done nộp rồi)
  [
    'rr-kltn-demo-1', T_KLTN_DEMO, 1, 'CLOSED',
    daysAgo(60), daysAgo(10),
    U_TBM, 'Vòng nộp khóa luận chính thức', T, T,
  ],
];

// ── TenDetai (Submissions) ────────────────────────────────────
// EmailSV, Tendetai, DotHK, Loaidetai, Version, Linkbai,
// id, topicId, uploaderUserId, fileType,
// revisionRoundId, revisionRoundNumber, versionNumber, versionLabel, status,
// deadlineAt, confirmedAt, isLocked, canReplace,
// driveFileId, uploadedAt, originalFileName, fileSize
const TENDETAI_ROWS: Row[] = [
  // BCTT demo — DRAFT (SV vừa nộp, chưa confirm)
  [
    EMAIL_SV[U_SV1], TITLE_BCTT_DEMO, 'HK1-2025-2026', 'BCTT', 1, '',
    'sub-bctt-demo-1', T_BCTT_DEMO, U_SV1, 'REPORT',
    'rr-bctt-demo-1', 1, 1, 'V1', 'DRAFT',
    daysFromNow(60), '', 'FALSE', 'TRUE',
    '', daysAgo(1), 'bao_cao_thuc_tap_v1.pdf', 2097152,
  ],
  // BCTT done — CONFIRMED (đã nộp xong)
  [
    EMAIL_SV[U_SV2], TITLE_BCTT_DONE, 'HK1-2024-2025', 'BCTT', 1,
    'https://drive.google.com/file/d/sub-bctt-done-drv/view',
    'sub-bctt-done-1', T_BCTT_DONE, U_SV2, 'REPORT',
    'rr-bctt-done-1', 1, 1, 'V1', 'CONFIRMED',
    '2025-01-10T17:00:00.000Z', '2025-01-08T10:00:00.000Z', 'TRUE', 'FALSE',
    'sub-bctt-done-drv', daysAgo(90), 'bao_cao_phan_tan_v1.pdf', 3145728,
  ],
  // KLTN demo — CONFIRMED (đã nộp, đang trong SCORING)
  [
    EMAIL_SV[U_SV2], TITLE_KLTN_DEMO, 'HK2-2025-2026', 'KLTN', 1,
    'https://drive.google.com/file/d/sub-kltn-demo-drv/view',
    'sub-kltn-demo-1', T_KLTN_DEMO, U_SV2, 'REPORT',
    'rr-kltn-demo-1', 1, 1, 'V1', 'CONFIRMED',
    daysAgo(10), daysAgo(15), 'TRUE', 'FALSE',
    'sub-kltn-demo-drv', daysAgo(20), 'khoa_luan_tot_nghiep_v1.pdf', 5242880,
  ],
];

// ── Điểm (Scores) ─────────────────────────────────────────────
// Email, Tên SV, MSSV, Tên Đề tài, GV, Role,
// TC1..TC10,
// id, topicId, scorerUserId, scorerRole, status,
// totalScore, rubricData, allowDefense, questions, submittedAt, updatedAt

const RUBRIC_GVHD_BCTT = JSON.stringify([
  { criterion: 'Thái độ và tinh thần làm việc', score: 8.5, max: 10 },
  { criterion: 'Chất lượng nội dung báo cáo',  score: 8.0, max: 10 },
  { criterion: 'Tính sáng tạo và giải pháp',   score: 7.5, max: 10 },
  { criterion: 'Trình bày và hình thức',        score: 8.0, max: 10 },
  { criterion: 'Kết quả đạt được',              score: 8.0, max: 10 },
]);
const TOTAL_GVHD_BCTT = 8.5 + 8.0 + 7.5 + 8.0 + 8.0; // = 40

const RUBRIC_GVHD_KLTN = JSON.stringify([
  { criterion: 'Quá trình hướng dẫn và theo dõi', score: 8.0, max: 10 },
  { criterion: 'Chất lượng nghiên cứu',           score: 8.5, max: 10 },
  { criterion: 'Tính ứng dụng thực tiễn',         score: 7.5, max: 10 },
  { criterion: 'Hình thức báo cáo viết',          score: 8.0, max: 10 },
  { criterion: 'Đúng hạn và hợp tác',             score: 9.0, max: 10 },
]);
const TOTAL_GVHD_KLTN = 8.0 + 8.5 + 7.5 + 8.0 + 9.0; // = 41

const RUBRIC_GVPB_KLTN = JSON.stringify([
  { criterion: 'Phản biện nội dung đề tài',    score: 7.5, max: 10 },
  { criterion: 'Chất lượng kết quả đạt được',  score: 8.0, max: 10 },
  { criterion: 'Khả năng trả lời câu hỏi',     score: 7.0, max: 10 },
  { criterion: 'Tính hoàn thiện sản phẩm',     score: 8.0, max: 10 },
]);
const TOTAL_GVPB_KLTN = 7.5 + 8.0 + 7.0 + 8.0; // = 30.5

const makeScoreRow = (opts: {
  id: string; topicId: string;
  emailSV: string; nameSV: string; mssv: string; titleDetai: string;
  gvName: string; role: string;
  tc: number[]; // up to 10 TC values (fill with 0 if fewer)
  scorerUserId: string; scorerRole: string; status: string;
  totalScore: number; rubricData: string;
  allowDefense?: boolean; questions?: string; submittedAt?: string;
}): Row => {
  const tc = [...opts.tc, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].slice(0, 10);
  return [
    opts.emailSV, opts.nameSV, opts.mssv, opts.titleDetai, opts.gvName, opts.role,
    tc[0], tc[1], tc[2], tc[3], tc[4], tc[5], tc[6], tc[7], tc[8], tc[9],
    opts.id, opts.topicId, opts.scorerUserId, opts.scorerRole, opts.status,
    opts.totalScore, opts.rubricData,
    opts.allowDefense ?? false,
    opts.questions ?? '[]',
    opts.submittedAt ?? '',
    T,
  ];
};

const DIEM_ROWS: Row[] = [
  // BCTT done — GVHD đã chấm xong (SUBMITTED)
  makeScoreRow({
    id: 'score-bctt-done-gvhd', topicId: T_BCTT_DONE,
    emailSV: EMAIL_SV[U_SV2], nameSV: NAME_SV[U_SV2], mssv: 'SV21002',
    titleDetai: TITLE_BCTT_DONE, gvName: NAME_GV[U_GV2], role: 'GVHD',
    tc: [8.5, 8.0, 7.5, 8.0, 8.0],
    scorerUserId: U_GV2, scorerRole: 'GVHD', status: 'SUBMITTED',
    totalScore: TOTAL_GVHD_BCTT, rubricData: RUBRIC_GVHD_BCTT,
    allowDefense: true, submittedAt: daysAgo(85),
  }),

  // KLTN demo — GVHD SUBMITTED
  makeScoreRow({
    id: 'score-kltn-gvhd', topicId: T_KLTN_DEMO,
    emailSV: EMAIL_SV[U_SV2], nameSV: NAME_SV[U_SV2], mssv: 'SV21002',
    titleDetai: TITLE_KLTN_DEMO, gvName: NAME_GV[U_GV1], role: 'GVHD',
    tc: [8.0, 8.5, 7.5, 8.0, 9.0],
    scorerUserId: U_GV1, scorerRole: 'GVHD', status: 'SUBMITTED',
    totalScore: TOTAL_GVHD_KLTN, rubricData: RUBRIC_GVHD_KLTN,
    allowDefense: true, submittedAt: daysAgo(5),
  }),

  // KLTN demo — GVPB SUBMITTED
  makeScoreRow({
    id: 'score-kltn-gvpb', topicId: T_KLTN_DEMO,
    emailSV: EMAIL_SV[U_SV2], nameSV: NAME_SV[U_SV2], mssv: 'SV21002',
    titleDetai: TITLE_KLTN_DEMO, gvName: NAME_GV[U_GV2], role: 'GVPB',
    tc: [7.5, 8.0, 7.0, 8.0],
    scorerUserId: U_GV2, scorerRole: 'GVPB', status: 'SUBMITTED',
    totalScore: TOTAL_GVPB_KLTN, rubricData: RUBRIC_GVPB_KLTN,
    allowDefense: true, submittedAt: daysAgo(3),
  }),
];

// ── Rubric Criteria ───────────────────────────────────────────
// BB GVHD - Ứng dụng: Tên TC, Điểm tối đa, id, code, order, scorerRole
const BB_GVHD_UNG_DUNG_ROWS: Row[] = [
  ['Thái độ trong quá trình thực hiện',               10, 'tc-gvhd-ud-01', 'TC1', 1, 'GVHD'],
  ['Chất lượng mở đầu / giới thiệu đề tài',           10, 'tc-gvhd-ud-02', 'TC2', 2, 'GVHD'],
  ['Chất lượng nội dung chương 1 (Tổng quan)',         10, 'tc-gvhd-ud-03', 'TC3', 3, 'GVHD'],
  ['Chất lượng nội dung chương 2 (Phân tích, TK)',     10, 'tc-gvhd-ud-04', 'TC4', 4, 'GVHD'],
  ['Chất lượng nội dung chương 3 (Giải pháp)',         10, 'tc-gvhd-ud-05', 'TC5', 5, 'GVHD'],
  ['Chất lượng nội dung chương 4 (Cài đặt, KQ)',       10, 'tc-gvhd-ud-06', 'TC6', 6, 'GVHD'],
  ['Chất lượng kết luận và hướng phát triển',          10, 'tc-gvhd-ud-07', 'TC7', 7, 'GVHD'],
  ['Hình thức báo cáo (định dạng, chính tả)',          10, 'tc-gvhd-ud-08', 'TC8', 8, 'GVHD'],
  ['Tính hoàn thiện của sản phẩm / demo',              10, 'tc-gvhd-ud-09', 'TC9', 9, 'GVHD'],
  ['Tính đúng hạn và tinh thần hợp tác với GVHD',     10, 'tc-gvhd-ud-10', 'TC10', 10, 'GVHD'],
];

// BB GVHD - NC (nghiên cứu khoa học): tiêu chí khác BCTT
const BB_GVHD_NC_ROWS: Row[] = [
  ['Tính mới và sáng tạo của hướng nghiên cứu',        10, 'tc-gvhd-nc-01', 'TC1', 1, 'GVHD'],
  ['Chất lượng tổng quan tài liệu',                    10, 'tc-gvhd-nc-02', 'TC2', 2, 'GVHD'],
  ['Phương pháp nghiên cứu',                           10, 'tc-gvhd-nc-03', 'TC3', 3, 'GVHD'],
  ['Kết quả thực nghiệm và phân tích',                 10, 'tc-gvhd-nc-04', 'TC4', 4, 'GVHD'],
  ['Khả năng ứng dụng thực tiễn',                      10, 'tc-gvhd-nc-05', 'TC5', 5, 'GVHD'],
  ['Chất lượng báo cáo khoa học',                      10, 'tc-gvhd-nc-06', 'TC6', 6, 'GVHD'],
  ['Thái độ và tinh thần trong suốt dự án',            10, 'tc-gvhd-nc-07', 'TC7', 7, 'GVHD'],
];

// BB GVPB - Ứng dụng
const BB_GVPB_UNG_DUNG_ROWS: Row[] = [
  ['Phản biện về tính khả thi của đề tài',             10, 'tc-gvpb-ud-01', 'TC1', 1, 'GVPB'],
  ['Chất lượng phân tích yêu cầu và thiết kế',         10, 'tc-gvpb-ud-02', 'TC2', 2, 'GVPB'],
  ['Chất lượng kết quả đạt được',                      10, 'tc-gvpb-ud-03', 'TC3', 3, 'GVPB'],
  ['Tính hoàn thiện và ổn định của sản phẩm',          10, 'tc-gvpb-ud-04', 'TC4', 4, 'GVPB'],
  ['Khả năng trả lời câu hỏi phản biện',               10, 'tc-gvpb-ud-05', 'TC5', 5, 'GVPB'],
  ['Hình thức báo cáo viết',                           10, 'tc-gvpb-ud-06', 'TC6', 6, 'GVPB'],
];

// BB GVPB - NC
const BB_GVPB_NC_ROWS: Row[] = [
  ['Tính đóng góp khoa học của đề tài',                10, 'tc-gvpb-nc-01', 'TC1', 1, 'GVPB'],
  ['Chất lượng phương pháp nghiên cứu',                10, 'tc-gvpb-nc-02', 'TC2', 2, 'GVPB'],
  ['Độ tin cậy của kết quả thực nghiệm',               10, 'tc-gvpb-nc-03', 'TC3', 3, 'GVPB'],
  ['Khả năng phát triển tiếp theo',                    10, 'tc-gvpb-nc-04', 'TC4', 4, 'GVPB'],
  ['Khả năng phản biện khoa học',                      10, 'tc-gvpb-nc-05', 'TC5', 5, 'GVPB'],
];

// Chấm điểm của HĐồng (TV_HD và CT_HD dùng chung)
const CHAM_DIEM_HDONG_ROWS: Row[] = [
  ['Chất lượng nội dung nghiên cứu và báo cáo', 'Độ sâu, tính sáng tạo, tổng quan đầy đủ',           'tc-hd-01', 'TC1', 1, 'TV_HD'],
  ['Trình bày báo cáo (slides, diễn đạt)',       'Rõ ràng, mạch lạc, chuyên nghiệp, đúng thời gian', 'tc-hd-02', 'TC2', 2, 'TV_HD'],
  ['Trả lời câu hỏi hội đồng',                  'Chính xác, tự tin, thể hiện hiểu biết sâu',         'tc-hd-03', 'TC3', 3, 'TV_HD'],
  ['Hình thức báo cáo viết',                    'Tuân thủ định dạng, ít lỗi chính tả, dễ đọc',       'tc-hd-04', 'TC4', 4, 'TV_HD'],
  ['Mức độ hoàn thiện và khả năng triển khai',  'Sản phẩm/nghiên cứu có thể ứng dụng thực tế',      'tc-hd-05', 'TC5', 5, 'TV_HD'],
];

// ── ScoreSummaries ────────────────────────────────────────────
// id, topicId, gvhdScore, gvpbScore, councilAvgScore,
// finalScore, result, confirmedByGvhd, confirmedByCtHd, published, updatedAt
// Weights: GVHD=50%, GVPB=25%, Council=25%
const gvhdScoreBctt = TOTAL_GVHD_BCTT / 5;   // avg = 8.0
const finalBctt = gvhdScoreBctt;              // BCTT chỉ có GVHD

const SCORE_SUMMARIES_ROWS: Row[] = [
  // BCTT done — đã tổng kết, GVHD confirmed, published
  [
    'summary-bctt-done', T_BCTT_DONE,
    gvhdScoreBctt, '', '',
    finalBctt, 'PASS',
    'TRUE', 'FALSE', 'TRUE', T,
  ],
];

// ── Notifications ─────────────────────────────────────────────
// id, receiverUserId, topicId, type, title, body, deepLink, isRead, createdAt, readAt, scope
const NOTIFICATIONS_ROWS: Row[] = [
  [
    'notif-sys-001', 'ALL', '', 'SYSTEM',
    '📢 Hệ thống KLTN đã được cập nhật phiên bản mới',
    'Hệ thống đã được cập nhật với nhiều tính năng mới. Vui lòng đăng nhập lại.',
    '/notifications/notif-sys-001', 'FALSE', T, '', 'GLOBAL',
  ],
  [
    'notif-sv1-001', U_SV1, T_BCTT_DEMO, 'TOPIC_APPROVED',
    '✅ GVHD đã xác nhận hướng dẫn đề tài của bạn',
    `PGS.TS Phan Văn Đức đã xác nhận hướng dẫn đề tài "${TITLE_BCTT_DEMO.slice(0, 40)}..."`,
    `/student/topics/${T_BCTT_DEMO}`, 'FALSE', T, '', 'PERSONAL',
  ],
  [
    'notif-sv2-001', U_SV2, T_KLTN_DEMO, 'TOPIC_MOVED_TO_SCORING',
    '🎓 Khóa luận của bạn đã chuyển sang giai đoạn chấm điểm',
    `Hội đồng chấm điểm đang được chuẩn bị cho đề tài "${TITLE_KLTN_DEMO.slice(0, 40)}..."`,
    `/student/topics/${T_KLTN_DEMO}`, 'FALSE', T, '', 'PERSONAL',
  ],
];

// ── SystemConfig ──────────────────────────────────────────────
const SYSTEM_CONFIG_ROWS: Row[] = [
  ['score.weight.gvhd',        '0.5',   'Trọng số điểm GVHD (50%)', T],
  ['score.weight.gvpb',        '0.25',  'Trọng số điểm GVPB (25%)', T],
  ['score.weight.council',     '0.25',  'Trọng số điểm TB hội đồng (25%)', T],
  ['score.pass.threshold',     '5.0',   'Điểm tối thiểu để đạt (thang 10)', T],
  ['submission.max_file_mb',   '50',    'Kích thước file tối đa (MB)', T],
  ['kltn.min_credits',         '120',   'Số tín chỉ tích lũy tối thiểu để làm KLTN', T],
  ['kltn.min_bctt_score',      '6.0',   'Điểm BCTT tối thiểu để làm KLTN', T],
  ['approval.deadline_days',   '5',     'Số ngày GVHD có để phê duyệt/từ chối', T],
];

// ─── Main ────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isReset = args.includes('--reset');
  const isValidateOnly = args.includes('--validate-only');

  console.log('\n🚀  KLTN Seed Script — Schema v3.2 (CLEAN SEED)');
  console.log(`  Spreadsheet: ${SPREADSHEET_ID}`);
  console.log(`  Mode: ${isValidateOnly ? 'VALIDATE' : isReset ? 'RESET + SEED' : 'SEED (upsert)'}\n`);

  const tabNames = Object.keys(SHEET_HEADERS);

  if (isValidateOnly) {
    console.log('📊  Row counts per tab:');
    for (const sheetName of tabNames) {
      const count = await countRows(sheetName);
      const status = count === -1 ? '⚠️  tab not found' : `${count} rows`;
      console.log(`  ${sheetName.padEnd(30)} ${status}`);
    }
    console.log('\n✅  Validation complete.\n');
    return;
  }

  // Ensure tabs + headers
  console.log('📋  Ensuring tabs and headers...');
  for (const [sheetName, headers] of Object.entries(SHEET_HEADERS)) {
    await ensureTab(sheetName, headers);
    process.stdout.write(`  ✓ ${sheetName}\n`);
  }

  // Clear data if --reset (skip Quota, Major which are teacher-managed read-only)
  if (isReset) {
    const skipClear = new Set(['Quota', 'Major', 'Data']); // Data kept for manual teacher management
    console.log('\n🗑️   Clearing data rows...');
    for (const sheetName of tabNames) {
      if (skipClear.has(sheetName)) {
        console.log(`  ⏭  ${sheetName} — skipped`);
        continue;
      }
      await clearData(sheetName);
      process.stdout.write(`  ✓ ${sheetName} cleared\n`);
    }
    // Also clear Data tab for full reset
    await clearData('Data');
    console.log('  ✓ Data cleared (full reset)');
  }

  // Seed data
  console.log('\n🌱  Seeding data...');

  const dataToSeed: [string, Row[]][] = [
    ['Data',                  DATA_ROWS],
    ['Dot',                   DOT_ROWS],
    ['Topics',                TOPICS_ROWS],
    ['Trangthaidetai',        TRANGTHAIDETAI_ROWS],
    ['RevisionRounds',        REVISION_ROUNDS_ROWS],
    ['TenDetai',              TENDETAI_ROWS],
    ['Điểm',                  DIEM_ROWS],
    ['BB GVHD - Ứng dụng',   BB_GVHD_UNG_DUNG_ROWS],
    ['BB GVHD - NC',          BB_GVHD_NC_ROWS],
    ['BB GVPB - Ứng dụng',   BB_GVPB_UNG_DUNG_ROWS],
    ['BB GVPB - NC',          BB_GVPB_NC_ROWS],
    ['Chấm điểm của HĐồng',  CHAM_DIEM_HDONG_ROWS],
    ['ScoreSummaries',        SCORE_SUMMARIES_ROWS],
    ['Notifications',         NOTIFICATIONS_ROWS],
    ['SystemConfig',          SYSTEM_CONFIG_ROWS],
  ];

  for (const [sheetName, rows] of dataToSeed) {
    if (rows.length === 0) {
      console.log(`  ⏭  ${sheetName.padEnd(28)} (no data)`);
      continue;
    }
    await appendRows(sheetName, rows);
    console.log(`  ✓ ${sheetName.padEnd(28)} ${rows.length} rows`);
  }

  // Final validation
  console.log('\n📊  Final row counts:');
  const expectedCounts: Record<string, number> = {
    'Data': DATA_ROWS.length,
    'Dot': DOT_ROWS.length,
    'Topics': TOPICS_ROWS.length,
    'Trangthaidetai': TRANGTHAIDETAI_ROWS.length,
    'RevisionRounds': REVISION_ROUNDS_ROWS.length,
    'TenDetai': TENDETAI_ROWS.length,
    'Điểm': DIEM_ROWS.length,
    'BB GVHD - Ứng dụng': BB_GVHD_UNG_DUNG_ROWS.length,
    'BB GVHD - NC': BB_GVHD_NC_ROWS.length,
    'BB GVPB - Ứng dụng': BB_GVPB_UNG_DUNG_ROWS.length,
    'BB GVPB - NC': BB_GVPB_NC_ROWS.length,
    'Chấm điểm của HĐồng': CHAM_DIEM_HDONG_ROWS.length,
    'ScoreSummaries': SCORE_SUMMARIES_ROWS.length,
    'Notifications': NOTIFICATIONS_ROWS.length,
    'SystemConfig': SYSTEM_CONFIG_ROWS.length,
  };

  let allOk = true;
  for (const sheetName of tabNames) {
    const count = await countRows(sheetName);
    const expected = expectedCounts[sheetName];
    const status =
      count === -1 ? '⚠️  not found'
      : expected !== undefined && count >= expected ? `✅ ${count} rows (expected >=${expected})`
      : expected !== undefined ? `⚠️  ${count} rows (expected >=${expected})`
      : `${count} rows`;
    const ok = count === -1 || (expected === undefined) || count >= expected;
    if (!ok) allOk = false;
    console.log(`  ${sheetName.padEnd(30)} ${status}`);
  }

  if (allOk) {
    console.log('\n✅  Seed complete — all tabs have expected data!\n');
  } else {
    console.log('\n⚠️   Seed complete with warnings — some tabs have fewer rows than expected.\n');
  }

  // Print summary of seed IDs for E2E testing reference
  console.log('📌  Seed IDs reference (for E2E testing):');
  console.log(`  Users:    SV1=${U_SV1} SV2=${U_SV2} SV3=${U_SV3}`);
  console.log(`            GV1=${U_GV1} GV2=${U_GV2} GV3=${U_GV3} GV4=${U_GV4} TBM=${U_TBM}`);
  console.log(`  Periods:  BCTT_NOW=${P_BCTT_NOW} KLTN_NOW=${P_KLTN_NOW}`);
  console.log(`  Topics:   BCTT_DEMO=${T_BCTT_DEMO} (IN_PROGRESS)`);
  console.log(`            BCTT_DONE=${T_BCTT_DONE} (COMPLETED)`);
  console.log(`            KLTN_DEMO=${T_KLTN_DEMO} (SCORING, full council)`);
  console.log('');
}

main().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
