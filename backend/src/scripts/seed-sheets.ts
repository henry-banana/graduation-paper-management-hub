/**
 * seed-sheets.ts — Schema v3.2
 * ─────────────────────────────────────────────────────────────
 * Usage:
 *   npm run seed:sheets              (upsert — keeps existing data)
 *   npm run seed:sheets:reset        (CLEAR app data tabs then seed)
 *   npm run seed:sheets:validate     (read-only: count rows per tab)
 *
 * Tab names now match teacher's Google Sheet EXACTLY:
 *   Data, Dot, Trangthaidetai, Điểm, TenDetai, Bienban,
 *   BB GVHD - Ứng dụng, BB GVHD - NC, BB GVPB - Ứng dụng,
 *   BB GVPB - NC, Chấm điểm của HĐồng, Quota, Major, Detaigoiy
 *
 * App-specific tabs:
 *   Topics, RevisionRounds, ScoreSummaries, Notifications,
 *   Schedules, AuditLogs, SystemConfig
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
function now(): string {
  return new Date().toISOString();
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
  // Write / overwrite header row
  const lastCol = columnName(headers.length);
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
  } catch {
    return -1; // tab doesn't exist
  }
}

function columnName(n: number): string {
  let name = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    name = String.fromCharCode(65 + m) + name;
    n = Math.floor((n - m) / 26);
  }
  return name || 'A';
}

// ─── Schema v3.2 — Tab Headers ───────────────────────────────
const SHEETS: Record<string, string[]> = {
  // ── Teacher tabs ──
  'Data': [
    'Email', 'MS', 'Ten', 'Role', 'Major', 'HeDaoTao',
    'id', 'phone', 'completedBcttScore', 'totalQuota', 'quotaUsed', 'expertise', 'isActive', 'createdAt',
    'earnedCredits', 'requiredCredits',
  ],
  'Dot': [
    'StartReg', 'EndReg', 'Loaidetai', 'Major', 'Dot', 'Active', 'StartEx', 'EndEx',
    'id', 'createdAt', 'updatedAt',
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

// ─── Seed Data (v3.2 layout) ──────────────────────────────────
const T = now();
const PERIOD_ID = 'period-2025-1';
const PERIOD_ID2 = 'period-2025-2';

// Data tab: Email, MS, Ten, Role, Major, HeDaoTao, id, phone, completedBcttScore, totalQuota, quotaUsed, expertise, isActive, createdAt, earnedCredits, requiredCredits
const DATA_ROWS: Row[] = [
  // Students (Role=SV) — earnedCredits / requiredCredits for KLTN eligibility
  ['haitrann218@gmail.com',                'SV21004', 'Nguyễn Hải Trân',   'SV',  'CNPM', 'Chính quy', 'u-sv-004', '0901111004', 7.5, '', '', '',           'TRUE', T, 120, 120],
  ['nguyen.van.an@student.hcmute.edu.vn',  'SV21001', 'Nguyễn Văn An',     'SV',  'CNPM', 'Chính quy', 'u-sv-001', '0901111001', 7.5, '', '', '',           'TRUE', T, 120, 120],
  ['tran.thi.bich@student.hcmute.edu.vn',  'SV21002', 'Trần Thị Bích',     'SV',  'CNPM', 'Chính quy', 'u-sv-002', '0901111002', 6.0, '', '', '',           'TRUE', T, 100, 120],
  // Lecturers (Role=GV)
  ['phan.van.duc@hcmute.edu.vn',    'GV001', 'PGS.TS Phan Văn Đức', 'GV',  'CNPM', '', 'u-gv-001', '0902221001', '', 5, 2, 'AI, ML',           'TRUE', T, '', ''],
  ['nguyen.thi.em@hcmute.edu.vn',   'GV002', 'TS. Nguyễn Thị Em',   'GV',  'CNPM', '', 'u-gv-002', '0902221002', '', 4, 0, 'Web, Mobile',       'TRUE', T, '', ''],
  ['hoang.van.phu@hcmute.edu.vn',   'GV003', 'TS. Hoàng Văn Phú',   'GV',  'KTMT', '', 'u-gv-003', '0902221003', '', 6, 1, 'Mạng, Hệ thống',   'TRUE', T, '', ''],
  ['vo.thi.giang@hcmute.edu.vn',    'GV004', 'ThS. Võ Thị Giang',   'GV',  'CNPM', '', 'u-gv-004', '0902221004', '', 3, 0, '',                 'TRUE', T, '', ''],
  // TBM
  ['tbm.cnpm@hcmute.edu.vn',        'TBM001', 'Trưởng BM CNPM',     'TBM', 'CNPM', '', 'u-tbm-001', '0903331001', '', '', '', '',               'TRUE', T, '', ''],
];

const PERIOD_ID3 = 'period-2025-3';

// Dot tab: StartReg, EndReg, Loaidetai, Major, Dot, Active, StartEx, EndEx, id, createdAt, updatedAt
// Dates must be OPEN (today is 2026-04-02) for registration to work
const DOT_ROWS: Row[] = [
  ['2026-01-01', '2026-12-31', 'BCTT', 'CNPM', 'HK1-2025-2026', 'TRUE', '2026-03-01', '2026-12-31', PERIOD_ID3,  T, T],
  ['2026-01-01', '2026-12-31', 'KLTN', 'CNPM', 'HK2-2025-2026', 'TRUE', '2026-04-01', '2026-12-31', PERIOD_ID2, T, T],
  ['2025-01-01', '2025-06-30', 'BCTT', 'CNPM', 'HK1-2024-2025', 'TRUE', '2025-03-01', '2025-06-15', PERIOD_ID,  T, T],
];

// Topics tab (app-specific) — only keep topic-001 for demo (u-sv-001), haitrann (u-sv-004) starts clean
const TOPICS_ROWS: Row[] = [
  [
    'topic-001', PERIOD_ID, 'BCTT',
    'Xây dựng hệ thống quản lý tài liệu nội bộ cho doanh nghiệp',
    'Phần mềm doanh nghiệp', 'Công ty TNHH Tech Việt',
    'u-sv-001', 'u-gv-001', 'IN_PROGRESS',
    '2025-01-15T17:00:00.000Z', '2025-03-01T00:00:00.000Z', '2025-06-15T17:00:00.000Z',
    '', 2, T, T,
  ],
];

// Trangthaidetai tab: EmailSV, EmailGV, Role, Diadiem, Diem, End, id, topicId, userId, status, assignedAt, revokedAt
const TRANGTHAIDETAI_ROWS: Row[] = [
  ['nguyen.van.an@student.hcmute.edu.vn',  'phan.van.duc@hcmute.edu.vn',   'GVHD', '', '', '', 'assign-001', 'topic-001', 'u-gv-001', 'ACTIVE', T, ''],
  ['tran.thi.bich@student.hcmute.edu.vn',  'nguyen.thi.em@hcmute.edu.vn',  'GVHD', '', '', '', 'assign-002', 'topic-002', 'u-gv-002', 'ACTIVE', T, ''],
  ['nguyen.van.an@student.hcmute.edu.vn',  'phan.van.duc@hcmute.edu.vn',   'GVHD', '', '', '', 'assign-003', 'topic-003', 'u-gv-001', 'ACTIVE', T, ''],
];

// RevisionRounds tab (app-specific)
const REVISION_ROUNDS_ROWS: Row[] = [
  ['rr-001', 'topic-001', 1, 'CLOSED', '2025-03-01T00:00:00.000Z', '2025-06-15T17:00:00.000Z', 'u-tbm-001', 'Kết thúc đợt nộp chính', T, T],
  ['rr-002', 'topic-001', 2, 'OPEN',   '2025-06-16T00:00:00.000Z', '2025-06-25T17:00:00.000Z', 'u-tbm-001', 'Mở đợt chỉnh sửa bổ sung', T, T],
];

// TenDetai tab: EmailSV, Tendetai, DotHK, Loaidetai, Version, Linkbai, id, topicId, uploaderUserId, fileType, ...
const TENDETAI_ROWS: Row[] = [
  [
    'nguyen.van.an@student.hcmute.edu.vn',
    'Xây dựng hệ thống quản lý tài liệu nội bộ cho doanh nghiệp',
    'HK1-2024-2025', 'BCTT', 1, '', // Version=1, Linkbai=empty (not uploaded yet)
    'sub-001', 'topic-001', 'u-sv-001', 'REPORT',
    'rr-001', 1, 1, 'V1', 'CONFIRMED',
    '2025-06-15T17:00:00.000Z', '2025-06-14T08:00:00.000Z', 'FALSE', 'TRUE',
    '', T, 'bao_cao_luan_van_v1.pdf', 2145728,
  ],
];

// Rubric criteria for BB GVHD - Ứng dụng
const BB_GVHD_UNG_DUNG_ROWS: Row[] = [
  ['Thái độ trong quá trình thực hiện',               10, 'tc-gvhd-ung-1', 'TC1', 1, 'GVHD'],
  ['Chất lượng mở đầu / giới thiệu',                  10, 'tc-gvhd-ung-2', 'TC2', 2, 'GVHD'],
  ['Chất lượng nội dung chương 1 (Tổng quan)',         10, 'tc-gvhd-ung-3', 'TC3', 3, 'GVHD'],
  ['Chất lượng nội dung chương 2 (Phân tích, TK)',     10, 'tc-gvhd-ung-4', 'TC4', 4, 'GVHD'],
  ['Chất lượng nội dung chương 3 (Giải pháp)',         10, 'tc-gvhd-ung-5', 'TC5', 5, 'GVHD'],
  ['Chất lượng nội dung chương 4 (Kết quả)',           10, 'tc-gvhd-ung-6', 'TC6', 6, 'GVHD'],
  ['Chất lượng kết luận và đề nghị',                  10, 'tc-gvhd-ung-7', 'TC7', 7, 'GVHD'],
  ['Hình thức báo cáo (định dạng, trình bày)',         10, 'tc-gvhd-ung-8', 'TC8', 8, 'GVHD'],
  ['Tính hoàn thiện của sản phẩm / demo',             10, 'tc-gvhd-ung-9', 'TC9', 9, 'GVHD'],
  ['Tính đúng hạn và tinh thần hợp tác',              10, 'tc-gvhd-ung-10','TC10', 10, 'GVHD'],
];

// Rubric criteria for Chấm điểm của HĐồng (TV_HD)
const CHAM_DIEM_HDONG_ROWS: Row[] = [
  ['Chất lượng nội dung nghiên cứu',           'Đánh giá tính sáng tạo, chiều sâu của đề tài',       'tc-hd-1', 'TC1', 1, 'TV_HD'],
  ['Trình bày báo cáo',                        'Rõ ràng, mạch lạc, slides chuyên nghiệp',            'tc-hd-2', 'TC2', 2, 'TV_HD'],
  ['Trả lời câu hỏi hội đồng',                 'Chính xác, tự tin, thể hiện hiểu biết sâu',          'tc-hd-3', 'TC3', 3, 'TV_HD'],
  ['Hình thức báo cáo viết',                   'Tuân thủ định dạng, ít lỗi chính tả',                'tc-hd-4', 'TC4', 4, 'TV_HD'],
  ['Ứng dụng thực tiễn và mức độ hoàn thiện',  'Sản phẩm/hệ thống có thể deploy được không',        'tc-hd-5', 'TC5', 5, 'TV_HD'],
];

// Notifications
const SV1_ID = 'u-sv-001';
const NOTIFICATIONS_ROWS: Row[] = [
  ['notif-001', 'ALL', '', 'SYSTEM', '📢 Thông báo mở đăng ký KLTN HK2 2024-2025', 'Thời gian đăng ký: 01/02/2025 – 15/02/2025.', '/student/notifications/notif-001', 'FALSE', T, '', 'GLOBAL'],
  ['notif-002', 'ALL', '', 'DEADLINE_REMINDER', '⚠️ Hạn nộp BCTT sắp đến', 'Deadline ngày 15/06/2025 lúc 17:00.', '/student/notifications/notif-002', 'FALSE', T, '', 'GLOBAL'],
  ['notif-003', SV1_ID, 'topic-001', 'TOPIC_APPROVED', '✅ GVHD đã xác nhận đề tài', 'PGS.TS Phan Văn Đức đã xác nhận hướng dẫn.', '/student/topics/topic-001', 'FALSE', T, '', 'PERSONAL'],
  ['notif-004', SV1_ID, 'topic-001', 'SUBMISSION_UPLOADED', '📄 Bài nộp đã được ghi nhận', 'File "bao_cao_luan_van_v1.pdf" đã được nhận.', '/student/topics/topic-001', 'TRUE', T, T, 'PERSONAL'],
  ['notif-005', SV1_ID, 'topic-003', 'SYSTEM', '🔔 Đề tài KLTN đang chờ GVHD xác nhận', 'Vui lòng chờ xác nhận trong vòng 3 ngày làm việc.', '/student/topics/topic-003', 'FALSE', T, '', 'PERSONAL'],
];

// SystemConfig defaults
const SYSTEM_CONFIG_ROWS: Row[] = [
  ['score.weight.gvhd', '0.5', 'Trọng số điểm GVHD trong tổng điểm', T],
  ['score.weight.gvpb', '0.25', 'Trọng số điểm GVPB trong tổng điểm', T],
  ['score.weight.council', '0.25', 'Trọng số điểm trung bình hội đồng trong tổng điểm', T],
  ['score.council.member_count', '1', 'Số thành viên HĐ tham gia chấm (dùng để tính avg)', T],
  ['submission.max_version_per_round', '10', 'Số phiên bản tối đa cho mỗi revision round', T],
  ['submission.file_max_size_mb', '50', 'Kích thước file tối đa (MB)', T],
];

// ─── Main ────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isReset = args.includes('--reset');
  const isValidateOnly = args.includes('--validate-only');

  console.log('\n🚀  KLTN Seed Script — Schema v3.2');
  console.log(`  Spreadsheet: ${SPREADSHEET_ID}`);
  console.log(`  Mode: ${isValidateOnly ? 'VALIDATE' : isReset ? 'RESET + SEED' : 'SEED (upsert)'}\n`);

  const tabNames = Object.keys(SHEETS);

  // ── Validate only ──
  if (isValidateOnly) {
    console.log('📊  Row counts per tab:');
    for (const sheetName of tabNames) {
      const count = await countRows(sheetName);
      const status = count === -1 ? '⚠️  tab not found' : `${count} rows`;
      console.log(`  ${sheetName.padEnd(28)} ${status}`);
    }
    console.log('\n✅  Validation complete.\n');
    return;
  }

  // ── Ensure all tabs exist with correct headers ──
  console.log('📋  Ensuring tabs and headers...');
  for (const [sheetName, headers] of Object.entries(SHEETS)) {
    await ensureTab(sheetName, headers);
    process.stdout.write(`  ✓ ${sheetName}\n`);
  }

  // ── Clear if --reset (skip Quota, Major which are teacher-only) ──
  if (isReset) {
    const skipClear = new Set(['Quota', 'Major']);
    console.log('\n🗑️   Clearing data rows (keeping Quota, Major)...');
    for (const sheetName of tabNames) {
      if (skipClear.has(sheetName)) {
        console.log(`  ⏭  ${sheetName} — skipped (read-only ref)`);
        continue;
      }
      await clearData(sheetName);
      process.stdout.write(`  ✓ ${sheetName} cleared\n`);
    }
  }

  // ── Seed data ──
  console.log('\n🌱  Seeding data...');

  const data: [string, Row[]][] = [
    ['Data', DATA_ROWS],
    ['Dot', DOT_ROWS],
    ['Topics', TOPICS_ROWS],
    ['RevisionRounds', REVISION_ROUNDS_ROWS],
    ['Trangthaidetai', TRANGTHAIDETAI_ROWS],
    ['TenDetai', TENDETAI_ROWS],
    ['BB GVHD - Ứng dụng', BB_GVHD_UNG_DUNG_ROWS],
    ['Chấm điểm của HĐồng', CHAM_DIEM_HDONG_ROWS],
    ['Notifications', NOTIFICATIONS_ROWS],
    ['SystemConfig', SYSTEM_CONFIG_ROWS],
  ];

  for (const [sheetName, rows] of data) {
    await appendRows(sheetName, rows);
    console.log(`  ✓ ${sheetName.padEnd(28)} ${rows.length} rows`);
  }

  // ── Summary ──
  console.log('\n📊  Final row counts:');
  for (const sheetName of tabNames) {
    const count = await countRows(sheetName);
    const status = count === -1 ? '⚠️  not found' : `${count} rows`;
    console.log(`  ${sheetName.padEnd(28)} ${status}`);
  }

  console.log('\n✅  Seed complete!\n');
}

main().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
